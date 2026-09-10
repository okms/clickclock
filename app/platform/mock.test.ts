import { describe, it, expect, beforeEach } from "vitest";
import { MockPlatform } from "./mock";

describe("MockPlatform", () => {
  let storage: Storage;
  let platform: MockPlatform;

  beforeEach(() => {
    // Create a simple in-memory storage implementation
    const data = new Map<string, string>();
    storage = {
      get length(): number {
        return data.size;
      },
      clear() {
        data.clear();
      },
      getItem(key: string) {
        return data.get(key) ?? null;
      },
      key(index: number) {
        return Array.from(data.keys())[index] ?? null;
      },
      removeItem(key: string) {
        data.delete(key);
      },
      setItem(key: string, value: string) {
        data.set(key, value);
      },
    } as Storage;
    platform = new MockPlatform({ storage });
  });

  it("PERS-01: saveDoc then loadDoc round-trips the exact string", async () => {
    const json = '{"version":1,"settings":{"idleThresholdMinutes":5},"days":{},"active":null}';
    await platform.saveDoc(json);
    const loaded = await platform.loadDoc();
    expect(loaded).toBe(json);
  });

  it("PERS-01: loadDoc on a fresh mock returns null", async () => {
    const loaded = await platform.loadDoc();
    expect(loaded).toBeNull();
  });

  it("IDLE-01: idleSeconds resolves 0 by default", async () => {
    const idle = await platform.idleSeconds();
    expect(idle).toBe(0);
  });

  it("IDLE-01: idleSeconds resolves simulated value after simulateIdle", async () => {
    platform.simulateIdle(300);
    const idle = await platform.idleSeconds();
    expect(idle).toBe(300);
  });

  it("AUTO-01: setLaunchAtLogin(false) resolves false", async () => {
    const result = await platform.setLaunchAtLogin(false);
    expect(result).toBe(false);
  });

  it("AUTO-01: getLaunchAtLogin resolves false after setLaunchAtLogin(false)", async () => {
    await platform.setLaunchAtLogin(false);
    const result = await platform.getLaunchAtLogin();
    expect(result).toBe(false);
  });

  it("AUTO-04: with refuseLaunchAtLogin = true, setLaunchAtLogin(false) resolves previous value", async () => {
    // Default is true
    platform.refuseLaunchAtLogin = true;
    const result = await platform.setLaunchAtLogin(false);
    expect(result).toBe(true);
  });

  it("AUTO-04: with refuseLaunchAtLogin = true, getLaunchAtLogin stays true", async () => {
    platform.refuseLaunchAtLogin = true;
    await platform.setLaunchAtLogin(false);
    const result = await platform.getLaunchAtLogin();
    expect(result).toBe(true);
  });

  it("TRAY-02: setTray records lastTray", async () => {
    const status = {
      tooltip: "Running, 7.50 hours (07:30)",
      running: true,
      canStart: false,
      canPause: true,
      canStop: true,
      text: "7.50",
      overlay: "none" as const,
    };
    await platform.setTray(status);
    expect(platform.lastTray).toEqual(status);
  });

  it("TRAY-03: onTrayAction handler receives fireTray action", async () => {
    const actions: string[] = [];
    const unsubscribe = platform.onTrayAction((action) => {
      actions.push(action);
    });
    platform.fireTray("pause");
    expect(actions).toEqual(["pause"]);
  });

  it("TRAY-03: after unsubscribe, handler receives nothing more", async () => {
    const actions: string[] = [];
    const unsubscribe = platform.onTrayAction((action) => {
      actions.push(action);
    });
    platform.fireTray("pause");
    unsubscribe();
    platform.fireTray("start");
    expect(actions).toEqual(["pause"]);
  });

  it("DISP-08: copyText is recorded in copied when no clipboard provided", async () => {
    await platform.copyText("7.50");
    expect(platform.copied).toEqual(["7.50"]);
  });

  it("DISP-08: multiple copyText calls record all values", async () => {
    await platform.copyText("7.50");
    await platform.copyText("hello");
    expect(platform.copied).toEqual(["7.50", "hello"]);
  });

  it("TT-09: onTick handler is called by fireTick()", () => {
    const calls: number[] = [];
    platform.onTick(() => {
      calls.push(1);
    });
    platform.fireTick();
    expect(calls).toEqual([1]);
  });

  it("TT-09: onTick handler is not called after unsubscribe", () => {
    const calls: number[] = [];
    const unsubscribe = platform.onTick(() => {
      calls.push(1);
    });
    platform.fireTick();
    unsubscribe();
    platform.fireTick();
    expect(calls).toEqual([1]);
  });

  it("UPD-01: checkForUpdates resolves nextUpdate by default", async () => {
    const result = await platform.checkForUpdates();
    expect(result).toEqual({
      current: "0.2.1",
      latest: "0.2.1",
      url: "https://github.com/okms/clickclock/releases/latest",
      isNewer: false,
    });
  });

  it("UPD-01: checkForUpdates resolves nextUpdate after setting it", async () => {
    const update = {
      current: "0.2.1",
      latest: "0.3.0",
      url: "https://github.com/okms/clickclock/releases/tag/v0.3.0",
      isNewer: true,
    };
    (platform as any).nextUpdate = update;
    const result = await platform.checkForUpdates();
    expect(result).toEqual(update);
  });

  it("UPD-01: checkForUpdates rejects when nextUpdate is an Error", async () => {
    const error = new Error("Network error");
    (platform as any).nextUpdate = error;
    await expect(platform.checkForUpdates()).rejects.toBe(error);
  });

  it("UPD-04: openUrl records the URL in openedUrls", async () => {
    await platform.openUrl("https://example.com");
    expect((platform as any).openedUrls).toEqual(["https://example.com"]);
  });

  it("UPD-04: openUrl records multiple URLs", async () => {
    await platform.openUrl("https://example.com");
    await platform.openUrl("https://another.com");
    expect((platform as any).openedUrls).toEqual([
      "https://example.com",
      "https://another.com",
    ]);
  });
});
