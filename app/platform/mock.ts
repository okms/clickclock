import type { Platform, TrayAction, TrayStatus, UpdateInfo } from "./platform";

export interface MockOptions {
  storage?: Storage;
  storageKey?: string;
  clipboard?: { writeText(t: string): Promise<void> };
}

/**
 * A Storage-like in-memory implementation for environments without localStorage.
 */
class InMemoryStorage implements Storage {
  private data = new Map<string, string>();

  get length(): number {
    return this.data.size;
  }

  clear(): void {
    this.data.clear();
  }

  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }

  key(index: number): string | null {
    const keys = Array.from(this.data.keys());
    return keys[index] ?? null;
  }

  removeItem(key: string): void {
    this.data.delete(key);
  }

  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }
}

export class MockPlatform implements Platform {
  private storage: Storage;
  private storageKey: string;
  private clipboard: { writeText(t: string): Promise<void> } | undefined;
  private idleValue: number = 0;
  private launchAtLogin: boolean = true;
  public lastTray: TrayStatus | null = null;
  public refuseLaunchAtLogin: boolean = false;
  public readonly copied: string[] = [];
  public readonly openedUrls: string[] = [];
  public nextUpdate: UpdateInfo | Error = {
    current: "0.2.1",
    latest: "0.2.1",
    url: "https://github.com/okms/clickclock/releases/latest",
    isNewer: false,
  };
  private trayHandlers: Set<(action: TrayAction) => void> = new Set();
  private windowHiddenHandlers: Set<() => void> = new Set();
  private tickHandlers: Set<() => void> = new Set();
  private tickIntervals: Map<() => void, ReturnType<typeof setInterval>> = new Map();

  constructor(opts?: MockOptions) {
    // Determine storage
    if (opts?.storage) {
      this.storage = opts.storage;
    } else if (typeof globalThis !== "undefined" && globalThis.localStorage) {
      this.storage = globalThis.localStorage;
    } else {
      this.storage = new InMemoryStorage();
    }

    this.storageKey = opts?.storageKey ?? "clickclock.doc";
    this.clipboard = opts?.clipboard;
  }

  async idleSeconds(): Promise<number> {
    return this.idleValue;
  }

  async loadDoc(): Promise<string | null> {
    const json = this.storage.getItem(this.storageKey);
    return json;
  }

  async saveDoc(json: string): Promise<void> {
    this.storage.setItem(this.storageKey, json);
  }

  async getLaunchAtLogin(): Promise<boolean> {
    return this.launchAtLogin;
  }

  async setLaunchAtLogin(enabled: boolean): Promise<boolean> {
    if (this.refuseLaunchAtLogin) {
      return this.launchAtLogin;
    }
    this.launchAtLogin = enabled;
    return enabled;
  }

  async setTray(status: TrayStatus): Promise<void> {
    this.lastTray = status;
  }

  onTrayAction(handler: (action: TrayAction) => void): () => void {
    this.trayHandlers.add(handler);
    return () => {
      this.trayHandlers.delete(handler);
    };
  }

  async copyText(text: string): Promise<void> {
    if (this.clipboard) {
      await this.clipboard.writeText(text);
    } else if (typeof globalThis !== "undefined" && globalThis.navigator?.clipboard) {
      await globalThis.navigator.clipboard.writeText(text);
    } else {
      this.copied.push(text);
    }
  }

  async hideWindow(): Promise<void> {
    // No-op
  }

  onWindowHidden(handler: () => void): () => void {
    this.windowHiddenHandlers.add(handler);
    return () => {
      this.windowHiddenHandlers.delete(handler);
    };
  }

  async quit(): Promise<void> {
    // No-op
  }

  async checkForUpdates(): Promise<UpdateInfo> {
    if (this.nextUpdate instanceof Error) {
      throw this.nextUpdate;
    }
    return this.nextUpdate;
  }

  async openUrl(url: string): Promise<void> {
    this.openedUrls.push(url);
  }

  onTick(handler: () => void): () => void {
    this.tickHandlers.add(handler);
    const interval = setInterval(handler, 1000);
    this.tickIntervals.set(handler, interval);
    return () => {
      this.tickHandlers.delete(handler);
      const existing = this.tickIntervals.get(handler);
      if (existing) {
        clearInterval(existing);
        this.tickIntervals.delete(handler);
      }
    };
  }

  // Test/demo controls
  simulateIdle(seconds: number): void {
    this.idleValue = seconds;
  }

  fireTray(action: TrayAction): void {
    for (const handler of this.trayHandlers) {
      handler(action);
    }
  }

  fireWindowHidden(): void {
    for (const handler of this.windowHiddenHandlers) {
      handler();
    }
  }

  /** Test control: synchronously call all registered onTick handlers. */
  fireTick(): void {
    for (const handler of this.tickHandlers) {
      handler();
    }
  }
}
