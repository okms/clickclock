import { describe, it, expect } from "vitest";
import type { UpdateInfo } from "../platform/platform";
import { updateMessage, stateFromResult, type UpdateState } from "./updates";

describe("UPD-03: updates view", () => {
  describe("updateMessage", () => {
    it("UPD-03: returns empty string for idle state", () => {
      const result = updateMessage({ kind: "idle" });
      expect(result).toBe("");
    });

    it("UPD-03: returns 'Checking…' for checking state", () => {
      const result = updateMessage({ kind: "checking" });
      expect(result).toBe("Checking…");
    });

    it("UPD-03: returns \"You're up to date.\" for latest state", () => {
      const result = updateMessage({ kind: "latest" });
      expect(result).toBe("You're up to date.");
    });

    it("UPD-03: returns version message for available state", () => {
      const result = updateMessage({ kind: "available", version: "0.3.0", url: "https://example.com" });
      expect(result).toBe("Version 0.3.0 is available.");
    });

    it("UPD-03: returns error message for failed state", () => {
      const result = updateMessage({ kind: "failed" });
      expect(result).toBe("Couldn't check. Are you online?");
    });
  });

  describe("stateFromResult", () => {
    it("UPD-03: maps isNewer true to available state with version and url", () => {
      const info: UpdateInfo = {
        current: "0.2.1",
        latest: "0.3.0",
        url: "https://github.com/okms/clickclock/releases/latest",
        isNewer: true,
      };
      const result = stateFromResult(info);
      expect(result).toEqual({
        kind: "available",
        version: "0.3.0",
        url: "https://github.com/okms/clickclock/releases/latest",
      });
    });

    it("UPD-03: maps isNewer false to latest state", () => {
      const info: UpdateInfo = {
        current: "0.2.1",
        latest: "0.2.1",
        url: "https://github.com/okms/clickclock/releases/latest",
        isNewer: false,
      };
      const result = stateFromResult(info);
      expect(result).toEqual({ kind: "latest" });
    });
  });
});
