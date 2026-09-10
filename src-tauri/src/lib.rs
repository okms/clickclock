//! ClickClock desktop shell.
//!
//! This crate is the fixed Rust surface described in
//! `docs/design/architecture.md` section 3.4: window, tray, two plugins,
//! four commands. It holds no timer state; the web app owns all logic and
//! drives the tray through the `set_tray` command.

pub mod doc;
pub mod tray_image;

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
    /// The (text, overlay) the tray icon was last rendered with, so the
    /// once-per-second `set_tray` call can skip re-rendering and
    /// `set_icon`-ing when nothing actually changed.
    last_icon: Option<(Option<String>, String)>,
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

/// Updates the tray tooltip, the enabled state of the Start/Pause/Stop menu
/// items, and the tray icon image. The app is the only source of truth for
/// this state; Rust just renders what it is told (TRAY-02, TRAY-03,
/// TRAY-09..TRAY-11).
///
/// `text` is today's total as decimal hours (e.g. `"7.50"`), or `None` to
/// show the plain clock icon (TRAY-10). `overlay` is `"pause"`, `"stop"`,
/// or anything else for no overlay (TRAY-11).
#[tauri::command]
fn set_tray(
    app: AppHandle,
    tooltip: String,
    running: bool,
    can_start: bool,
    can_pause: bool,
    can_stop: bool,
    text: Option<String>,
    overlay: String,
) -> Result<(), String> {
    // `running` is accepted for forward compatibility; today's tray shape
    // is driven entirely by `text` and `overlay`, not `running` directly.
    let _ = running;

    let state = app.state::<Mutex<TrayState>>();
    let mut guard = state.lock().map_err(|err| err.to_string())?;

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

    // Windows trays are a fixed 16px square with no room for text; show the
    // clock icon (with overlay) there and reserve the text rendering for
    // platforms with variable-width tray items, i.e. macOS (TRAY-09).
    let icon_text = if cfg!(target_os = "windows") { None } else { text };

    let cache_key = (icon_text.clone(), overlay.clone());
    if guard.last_icon.as_ref() != Some(&cache_key) {
        let overlay_kind = tray_image::parse_overlay(&overlay);
        let rendered = tray_image::render(icon_text.as_deref(), overlay_kind, 2);
        let image = tauri::image::Image::new_owned(rendered.rgba, rendered.width, rendered.height);
        // Sets the icon and re-asserts the macOS template flag atomically,
        // avoiding a double-render flicker (falls back to plain `set_icon`
        // on other platforms).
        guard
            .tray
            .set_icon_with_as_template(Some(image), true)
            .map_err(|err| err.to_string())?;
        guard.last_icon = Some(cache_key);
    }

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

    // The initial icon: a monochrome, transparent template image rendered
    // by `tray_image`, showing "0.00" with the stopped overlay (TRAY-09,
    // TRAY-11) until the app sends its first real `set_tray` update.
    // Template images let macOS recolor black-on-transparent shapes to
    // match the light/dark menu bar instead of flattening them to a disc.
    let initial = tray_image::render(Some("0.00"), tray_image::Overlay::Stop, 2);
    let initial_icon =
        tauri::image::Image::new_owned(initial.rgba, initial.width, initial.height);

    let tray = TrayIconBuilder::new()
        .icon(initial_icon)
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
            // TRAY-08: left click toggles the timer (start when not
            // Running, pause when Running), the same as the main control.
            // The app decides what "toggle" means; Rust just forwards the
            // click.
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let _ = tray.app_handle().emit("tray-action", "toggle");
            }
        })
        .build(app)?;

    app.manage(Mutex::new(TrayState {
        start,
        pause,
        stop,
        tray,
        last_icon: Some((Some("0.00".to_string()), "stop".to_string())),
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
        .expect("error while running ClickClock");
}
