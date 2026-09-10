/**
 * Platform factory for the app.
 * Returns the real TauriPlatform when running inside the Tauri shell,
 * otherwise a MockPlatform (browser dev, tests).
 */
import { MockPlatform } from "./mock";
import type { Platform } from "./platform";

export async function createPlatform(): Promise<Platform> {
  if ("__TAURI_INTERNALS__" in window) {
    const { TauriPlatform } = await import("./tauri");
    return TauriPlatform.create();
  }
  return new MockPlatform();
}
