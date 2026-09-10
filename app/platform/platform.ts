export type TrayAction = "start" | "pause" | "stop" | "show" | "quit" | "toggle";

export interface TrayStatus {
  tooltip: string; // e.g. "Running, 7.50 hours (07:30)"
  running: boolean;
  canStart: boolean;
  canPause: boolean;
  canStop: boolean;
  text: string | null; // e.g. "7.50" when showTimeInTray, null otherwise
  overlay: "none" | "pause" | "stop"; // indicator shown on the tray icon
}

export interface UpdateInfo {
  current: string;
  latest: string;
  url: string;
  isNewer: boolean;
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
  /** Fires when the host hid the main window because the user closed it (TRAY-06). */
  onWindowHidden(handler: () => void): () => void;
  /** Subscribe to the host's once-per-second tick. Returns an unsubscribe function. */
  onTick(handler: () => void): () => void;
  /** Quit the product. */
  quit(): Promise<void>;
  /** UPD-01/02: one request, only when called. Rejects when the check could not be completed. */
  checkForUpdates(): Promise<UpdateInfo>;
  /** UPD-04: open a URL in the user's browser. */
  openUrl(url: string): Promise<void>;
}
