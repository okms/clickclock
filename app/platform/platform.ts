export type TrayAction = "start" | "pause" | "stop" | "show" | "quit";

export interface TrayStatus {
  tooltip: string; // e.g. "Running, 7.50 hours (07:30)"
  running: boolean;
  canStart: boolean;
  canPause: boolean;
  canStop: boolean;
}

export interface Platform {
  /** Seconds since the last keyboard/pointer input on the computer. */
  idleSeconds(): Promise<number>;
  /** Load the persisted document as raw JSON text, or null if none. */
  loadDoc(): Promise<string | null>;
  /** Persist the document text. Must not leave a partially written file on failure. */
  saveDoc(json: string): Promise<void>;
  /** Read whether the product launches at login according to the host. */
  getLaunchAtLogin(): Promise<boolean>;
  /** Ask the host to set launch-at-login. Resolves to the value actually in effect afterwards. */
  setLaunchAtLogin(enabled: boolean): Promise<boolean>;
  /** Push the current state to the tray. No-op if the host has no tray. */
  setTray(status: TrayStatus): Promise<void>;
  /** Subscribe to tray menu actions. Returns an unsubscribe function. */
  onTrayAction(handler: (action: TrayAction) => void): () => void;
  /** Copy plain text. */
  copyText(text: string): Promise<void>;
  /** Hide the main window (TRAY-06) if the host supports it; otherwise no-op. */
  hideWindow(): Promise<void>;
  /** Quit the product. */
  quit(): Promise<void>;
}
