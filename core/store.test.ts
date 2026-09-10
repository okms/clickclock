import { describe, it, expect } from "vitest";
import { daySeconds, emptyDoc, ensureDay, recoverAtLaunch } from "./store";
import type { Doc } from "./types";

const T0 = new Date(2026, 8, 10, 8, 0, 0).getTime(); // 2026-09-10 08:00 local

describe("store: totals and recovery", () => {
  it("PERS-06 daySeconds sums closed periods and the adjustment", () => {
    const doc = emptyDoc();
    const day = ensureDay(doc, "2026-09-10");
    day.periods.push({ start: T0, end: T0 + 3600_000 }, { start: T0 + 7200_000, end: T0 + 9000_000 });
    day.adjustmentSeconds = 900;
    expect(daySeconds(doc, "2026-09-10", T0 + 20_000_000)).toBe(3600 + 1800 + 900);
  });

  it("TT-01 daySeconds includes the open active period for that day only", () => {
    const doc = emptyDoc();
    doc.active = { dayKey: "2026-09-10", start: T0, lastSeen: T0 };
    expect(daySeconds(doc, "2026-09-10", T0 + 90_000)).toBe(90);
    expect(daySeconds(doc, "2026-09-09", T0 + 90_000)).toBe(0);
  });

  it("TT-12 daySeconds never goes below zero", () => {
    const doc = emptyDoc();
    ensureDay(doc, "2026-09-10").adjustmentSeconds = -500;
    expect(daySeconds(doc, "2026-09-10", T0)).toBe(0);
  });

  it("TT-08/TT-11 recoverAtLaunch closes a dangling active period at its heartbeat", () => {
    const doc: Doc = emptyDoc();
    doc.active = { dayKey: "2026-09-10", start: T0, lastSeen: T0 + 1_800_000 };
    const out = recoverAtLaunch(doc);
    expect(out.active).toBeNull();
    expect(out.days["2026-09-10"]?.periods).toEqual([{ start: T0, end: T0 + 1_800_000 }]);
    expect(daySeconds(out, "2026-09-10", T0 + 99_999_999)).toBe(1800);
    // input is not mutated
    expect(doc.active).not.toBeNull();
  });

  it("PERS-04 recoverAtLaunch drops a zero-length active period and keeps other days", () => {
    const doc: Doc = emptyDoc();
    ensureDay(doc, "2026-09-09").periods.push({ start: T0 - 86_400_000, end: T0 - 82_800_000 });
    doc.active = { dayKey: "2026-09-10", start: T0, lastSeen: T0 - 5 };
    const out = recoverAtLaunch(doc);
    expect(out.days["2026-09-10"]).toBeUndefined();
    expect(daySeconds(out, "2026-09-09", T0)).toBe(3600);
  });

  it("PERS-01 recoverAtLaunch is the identity when nothing was running", () => {
    const doc = emptyDoc();
    expect(recoverAtLaunch(doc)).toBe(doc);
  });
});
