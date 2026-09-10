//! Consultant Timer desktop shell.
//!
//! This crate is the fixed Rust surface described in
//! `docs/design/architecture.md` section 3.4: window, tray, two plugins,
//! four commands. It holds no timer state; the web app owns all logic and
//! drives the tray through the `set_tray` command.

pub mod doc;

use std::sync::Mutex;

use tauri::{
    menu::{Menu, MenuItem, MenuItemBuilder, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIcon, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager, WindowEvent, Wry,
};
use tauri_plugin_autostart::MacosLauncher;
use user_idle::UserIdle;

use doc::DOC_FILENAME;

/// The tray's menu items and the tray icon itself, kept in managed state so
/// `set_tray` can update them later. Rust holds no *timer* state here, only
/// handles to the widgets it needs to mutate on the app's instruction (ADR
/// risk R8 in architecture.md: Rust only renders what it is told).
struct TrayState {
    start: MenuItem<Wry>,
    pause: MenuItem<Wry>,
    stop: MenuItem<Wry>,
    tray: TrayIcon<Wry>,
}

/// Shows the main window and brings it to the front (TRAY-04, and the
/// `show` menu item / single-instance relaunch).
fn show_and_focus_main(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.set_focus();
    }
}

/// IDLE-01: seconds since the last keyboard/pointer input, system-wide.
#[tauri::command]
fn idle_seconds() -> Result<f64, String> {
    UserIdle::get_time()
        .map(|idle| idle.as_seconds() as f64)
        .map_err(|err| format!("{err:?}"))
}

/// Reads the document from the per-user app data directory (PERS-03).
/// `Ok(None)` means the file does not exist yet (first run).
#[tauri::command]
fn read_doc(app: AppHandle) -> Result<Option<String>, String> {
    let dir = app.path().app_data_dir().map_err(|err| err.to_string())?;
    let path = dir.join(DOC_FILENAME);
    doc::read_doc_at(&path).map_err(|err| err.to_string())
}

/// Writes the document atomically (PERS-04): temp file, then rename.
#[tauri::command]
fn write_doc(app: AppHandle, json: String) -> Result<(), String> {
    let dir = app.path().app_data_dir().map_err(|err| err.to_string())?;
    let path = dir.join(DOC_FILENAME);
    doc::atomic_write(&path, &json).map_err(|err| err.to_string())
}

/// Updates the tray tooltip and the enabled state of the Start/Pause/Stop
/// menu items. The app is the only source of truth for this state; Rust
/// just renders what it is told (TRAY-02, TRAY-03).
#[tauri::command]
fn set_tray(
    app: AppHandle,
    tooltip: String,
    running: bool,
    can_start: bool,
    can_pause: bool,
    can_stop: bool,
) -> Result<(), String> {
    // `running` is accepted for forward compatibility with the icon-variant
    // requirement (TRAY-05), which is not yet in scope; the tray icon does
    // not change shape today.
    let _ = running;

    let state = app.state::<Mutex<TrayState>>();
    let guard = state.lock().map_err(|err| err.to_string())?;

    guard
        .tray
        .set_tooltip(Some(tooltip))
        .map_err(|err| err.to_string())?;
    guard
        .start
        .set_enabled(can_start)
        .map_err(|err| err.to_string())?;
    guard
        .pause
        .set_enabled(can_pause)
        .map_err(|err| err.to_string())?;
    guard
        .stop
        .set_enabled(can_stop)
        .map_err(|err| err.to_string())?;

    Ok(())
}

/// Builds the tray icon and menu (TRAY-01..TRAY-04) and stashes the item
/// handles in managed state for `set_tray` to update later.
fn setup_tray(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    let start = MenuItemBuilder::with_id("start", "Start").build(app)?;
    let pause = MenuItemBuilder::with_id("pause", "Pause").build(app)?;
    let stop = MenuItemBuilder::with_id("stop", "Stop / Clear today").build(app)?;
    let sep1 = PredefinedMenuItem::separator(app)?;
    let show = MenuItemBuilder::with_id("show", "Show").build(app)?;
    let sep2 = PredefinedMenuItem::separator(app)?;
    let quit = MenuItemBuilder::with_id("quit", "Quit").build(app)?;

    let menu = Menu::with_items(app, &[&start, &pause, &stop, &sep1, &show, &sep2, &quit])?;

    let icon = app
        .default_window_icon()
        .cloned()
        .ok_or("missing default window icon; run `pnpm tauri icon design/icon.svg`")?;

    let tray = TrayIconBuilder::new()
        .icon(icon)
        .icon_as_template(true)
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| {
            let id = event.id().as_ref();
            match id {
                "quit" => app.exit(0),
                "show" => {
                    show_and_focus_main(app);
                    let _ = app.emit("tray-action", id);
                }
                "start" | "pause" | "stop" => {
                    let _ = app.emit("tray-action", id);
                }
                _ => {}
            }
        })
        .on_tray_icon_event(|tray, event| {
            // TRAY-04: left click brings the main window to front.
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                show_and_focus_main(tray.app_handle());
            }
        })
        .build(app)?;

    app.manage(Mutex::new(TrayState {
        start,
        pause,
        stop,
        tray,
    }));

    Ok(())
}

pub fn run() {
    tauri::Builder::default()
        // Must be registered first: it decides whether this process should
        // keep running at all (TRAY-07).
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            show_and_focus_main(app);
        }))
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            None,
        ))
        .invoke_handler(tauri::generate_handler![
            idle_seconds,
            read_doc,
            write_doc,
            set_tray
        ])
        .setup(|app| {
            setup_tray(app)?;
            Ok(())
        })
        .on_window_event(|window, event| {
            if window.label() != "main" {
                return;
            }
            // TRAY-06: closing the window hides it; the product keeps
            // running and Quit (tray menu) is the only way to exit.
            if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
                let _ = window.emit("window-hidden", ());
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running the Consultant Timer application");
}
