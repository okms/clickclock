/**
 * Platform factory for the app.
 * Returns a MockPlatform for now; later tasks add Tauri support.
 */
import { MockPlatform } from "./mock";
import type { Platform } from "./platform";

export async function createPlatform(): Promise<Platform> {
  return new MockPlatform();
}
