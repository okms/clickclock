import { describe, it, expect, vi, beforeEach } from "vitest";

const invokeMock = vi.fn();
const listenMock = vi.fn();
const hideMock = vi.fn();
const getCurrentWindowMock = vi.fn(() => ({ hide: hideMock }));
const isEnabledMock = vi.fn();
const enableMock = vi.fn();
const disableMock = vi.fn();

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: (...args: unknown[]) => listenMock(...args),
}));

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => getCurrentWindowMock(),
}));

vi.mock("@tauri-apps/plugin-autostart", () => ({
  isEnabled: (...args: unknown[]) => isEnabledMock(...args),
  enable: (...args: unknown[]) => enableMock(...args),
  disable: (...args: unknown[]) => disableMock(...args),
}));

// Imported after the mocks above so the module under test picks them up.
import { TauriPlatform } from "./tauri";

describe("TauriPlatform", () => {
  beforeEach(() => {
    invokeMock.mockReset();
    listenMock.mockReset();
    hideMock.mockReset();
    getCurrentWindowMock.mockClear();
    isEnabledMock.mockReset();
    enableMock.mockReset();
    disableMock.mockReset();
    // Default: listen resolves with a no-op unsubscribe function.
    listenMock.mockResolvedValue(() => {});
  });

  it("IDLE-01: idleSeconds resolves the number invoke(\"idle_seconds\") returns", async () => {
    invokeMock.mockImplementation(async (cmd: string) => {
      if (cmd === "idle_seconds") return 42;
      throw new Error(`unexpected command ${cmd}`);
    });
    const platform = await TauriPlatform.create();
    await expect(platform.idleSeconds()).resolves.toBe(42);
  });

  it("IDLE-01: idleSeconds resolves 0 when invoke rejects", async () => {
    invokeMock.mockImplementation(async (cmd: string) => {
      if (cmd === "idle_seconds") throw new Error("boom");
      return undefined;
    });
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const platform = await TauriPlatform.create();
    await expect(platform.idleSeconds()).resolves.toBe(0);
    warnSpy.mockRestore();
  });

  it("PERS-01: loadDoc passes through null and a string", async () => {
    invokeMock.mockImplementation(async (cmd: string) => {
      if (cmd === "read_doc") return null;
      return undefined;
    });
    const platform = await TauriPlatform.create();
    await expect(platform.loadDoc()).resolves.toBeNull();

    invokeMock.mockImplementation(async (cmd: string) => {
      if (cmd === "read_doc") return '{"a":1}';
      return undefined;
    });
    await expect(platform.loadDoc()).resolves.toBe('{"a":1}');
  });

  it("PERS-01: saveDoc calls invoke(\"write_doc\", { json })", async () => {
    invokeMock.mockResolvedValue(undefined);
    const platform = await TauriPlatform.create();
    await platform.saveDoc('{"a":1}');
    expect(invokeMock).toHaveBeenCalledWith("write_doc", { json: '{"a":1}' });
  });

  it("AUTO-01: setLaunchAtLogin(true) calls enable() then returns isEnabled()", async () => {
    enableMock.mockResolvedValue(undefined);
    isEnabledMock.mockResolvedValue(true);
    const platform = await TauriPlatform.create();
    await expect(platform.setLaunchAtLogin(true)).resolves.toBe(true);
    expect(enableMock).toHaveBeenCalled();
    expect(isEnabledMock).toHaveBeenCalled();
  });

  it("AUTO-04: when enable() rejects, it returns the current isEnabled() value", async () => {
    enableMock.mockRejectedValue(new Error("nope"));
    isEnabledMock.mockResolvedValue(false);
    const platform = await TauriPlatform.create();
    await expect(platform.setLaunchAtLogin(true)).resolves.toBe(false);
  });

  it("TRAY-02: setTray calls invoke(\"set_tray\", { tooltip, running, canStart, canPause, canStop })", async () => {
    invokeMock.mockResolvedValue(undefined);
    const platform = await TauriPlatform.create();
    await platform.setTray({
      tooltip: "Running, 7.50 hours (07:30)",
      running: true,
      canStart: false,
      canPause: true,
      canStop: true,
      text: "7.50",
      overlay: "none",
    });
    expect(invokeMock).toHaveBeenCalledWith("set_tray", {
      tooltip: "Running, 7.50 hours (07:30)",
      running: true,
      canStart: false,
      canPause: true,
      canStop: true,
      text: "7.50",
      overlay: "none",
    });
  });

  it("TRAY-09: setTray includes text and overlay in the invoke call", async () => {
    invokeMock.mockResolvedValue(undefined);
    const platform = await TauriPlatform.create();
    await platform.setTray({
      tooltip: "Paused, 3.50 hours (03:30)",
      running: false,
      canStart: true,
      canPause: false,
      canStop: false,
      text: null,
      overlay: "pause",
    });
    expect(invokeMock).toHaveBeenCalledWith("set_tray", {
      tooltip: "Paused, 3.50 hours (03:30)",
      running: false,
      canStart: true,
      canPause: false,
      canStop: false,
      text: null,
      overlay: "pause",
    });
  });

  it("TRAY-03: a tray-action event with payload \"pause\" reaches a handler; \"quit\" does not; after unsubscribe nothing is delivered", async () => {
    let trayActionCallback: ((event: { payload: string }) => void) | undefined;
    listenMock.mockImplementation(async (eventName: string, cb: (event: { payload: string }) => void) => {
      if (eventName === "tray-action") {
        trayActionCallback = cb;
      }
      return () => {};
    });
    const platform = await TauriPlatform.create();
    const handler = vi.fn();
    const unsubscribe = platform.onTrayAction(handler);

    expect(trayActionCallback).toBeDefined();
    trayActionCallback!({ payload: "pause" });
    expect(handler).toHaveBeenCalledWith("pause");

    handler.mockClear();
    trayActionCallback!({ payload: "quit" });
    expect(handler).not.toHaveBeenCalled();

    handler.mockClear();
    unsubscribe();
    trayActionCallback!({ payload: "start" });
    expect(handler).not.toHaveBeenCalled();
  });

  it("TRAY-08: a tray-action event with payload \"toggle\" reaches a handler", async () => {
    let trayActionCallback: ((event: { payload: string }) => void) | undefined;
    listenMock.mockImplementation(async (eventName: string, cb: (event: { payload: string }) => void) => {
      if (eventName === "tray-action") {
        trayActionCallback = cb;
      }
      return () => {};
    });
    const platform = await TauriPlatform.create();
    const handler = vi.fn();
    platform.onTrayAction(handler);

    expect(trayActionCallback).toBeDefined();
    trayActionCallback!({ payload: "toggle" });
    expect(handler).toHaveBeenCalledWith("toggle");
  });

  it("TRAY-06: a window-hidden event reaches a handler", async () => {
    let windowHiddenCallback: (() => void) | undefined;
    listenMock.mockImplementation(async (eventName: string, cb: () => void) => {
      if (eventName === "window-hidden") {
        windowHiddenCallback = cb;
      }
      return () => {};
    });
    const platform = await TauriPlatform.create();
    const handler = vi.fn();
    platform.onWindowHidden(handler);

    expect(windowHiddenCallback).toBeDefined();
    windowHiddenCallback!();
    expect(handler).toHaveBeenCalled();
  });
});
