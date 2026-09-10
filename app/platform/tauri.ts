import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { disable, enable, isEnabled } from "@tauri-apps/plugin-autostart";

import type { Platform, TrayAction, TrayStatus } from "./platform";

const TRAY_ACTIONS: ReadonlySet<string> = new Set(["start", "pause", "stop", "show", "toggle"]);

/**
 * Real Platform adapter for the Tauri 2 shell. Talks to the Rust commands
 * and events described in `src-tauri/src/lib.rs` (IDLE-01, PERS-01/03/04,
 * AUTO-01/04, TRAY-02/03/06, DISP-08). No network access (NF-01).
 */
export class TauriPlatform implements Platform {
  private idleWarned = false;
  private trayHandlers: Set<(action: TrayAction) => void> = new Set();
  private windowHiddenHandlers: Set<() => void> = new Set();
  private unlistenTrayAction: UnlistenFn | undefined;
  private unlistenWindowHidden: UnlistenFn | undefined;

  private constructor() {}

  /** Call once after construction; subscribes to the shell's events. */
  static async create(): Promise<TauriPlatform> {
    const platform = new TauriPlatform();

    platform.unlistenTrayAction = await listen<string>("tray-action", (event) => {
      const action = event.payload;
      if (!TRAY_ACTIONS.has(action)) {
        // "quit" is handled by the shell itself; unknown values are ignored.
        return;
      }
      for (const handler of platform.trayHandlers) {
        handler(action as TrayAction);
      }
    });

    platform.unlistenWindowHidden = await listen("window-hidden", () => {
      for (const handler of platform.windowHiddenHandlers) {
        handler();
      }
    });

    return platform;
  }

  async idleSeconds(): Promise<number> {
    try {
      return await invoke<number>("idle_seconds");
    } catch (err) {
      if (!this.idleWarned) {
        this.idleWarned = true;
        console.warn("idleSeconds: invoke(\"idle_seconds\") failed, returning 0", err);
      }
      return 0;
    }
  }

  async loadDoc(): Promise<string | null> {
    return invoke<string | null>("read_doc");
  }

  async saveDoc(json: string): Promise<void> {
    await invoke("write_doc", { json });
  }

  async getLaunchAtLogin(): Promise<boolean> {
    return isEnabled();
  }

  async setLaunchAtLogin(enabled: boolean): Promise<boolean> {
    try {
      if (enabled) {
        await enable();
      } else {
        await disable();
      }
    } catch {
      // Fall through: report whatever is actually in effect (AUTO-04).
    }
    return isEnabled();
  }

  async setTray(status: TrayStatus): Promise<void> {
    await invoke("set_tray", {
      tooltip: status.tooltip,
      running: status.running,
      canStart: status.canStart,
      canPause: status.canPause,
      canStop: status.canStop,
      text: status.text,
      overlay: status.overlay,
    });
  }

  onTrayAction(handler: (action: TrayAction) => void): () => void {
    this.trayHandlers.add(handler);
    return () => {
      this.trayHandlers.delete(handler);
    };
  }

  onWindowHidden(handler: () => void): () => void {
    this.windowHiddenHandlers.add(handler);
    return () => {
      this.windowHiddenHandlers.delete(handler);
    };
  }

  async copyText(text: string): Promise<void> {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return;
      }
    } catch {
      // Fall through to the textarea fallback below.
    }

    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    try {
      document.execCommand("copy");
    } finally {
      document.body.removeChild(textarea);
    }
  }

  async hideWindow(): Promise<void> {
    await getCurrentWindow().hide();
  }

  async quit(): Promise<void> {
    // No-op: quitting is done by the tray menu in the shell (src-tauri/src/lib.rs).
  }
}
