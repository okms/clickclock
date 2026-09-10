import { describe, it, expect } from "vitest";
import { daySeconds, emptyDoc, ensureDay, recoverAtLaunch, serializeDoc, parseDoc, withSettings, history } from "./store";
import type { Doc, Settings } from "./types";

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

describe("store: parsing, serialisation, and history", () => {
  it("PERS-05 serializeDoc outputs pretty-printed JSON with 2-space indent", () => {
    const doc: Doc = emptyDoc();
    const day = ensureDay(doc, "2026-09-10");
    day.periods.push({ start: T0, end: T0 + 3600_000 });
    day.adjustmentSeconds = 900;
    doc.settings.idleThresholdMinutes = 10;
    doc.active = { dayKey: "2026-09-10", start: T0 + 3600_000, lastSeen: T0 + 3600_000 };

    const output = serializeDoc(doc);
    expect(output).toContain("\n  ");
    expect(output).toContain('"version": 1');
    expect(output).toContain('"idleThresholdMinutes": 10');
  });

  it("PERS-05 parseDoc round-trips serializeDoc", () => {
    const doc: Doc = emptyDoc();
    const day = ensureDay(doc, "2026-09-10");
    day.periods.push({ start: T0, end: T0 + 3600_000 });
    day.adjustmentSeconds = 900;
    doc.settings.idleThresholdMinutes = 10;
    doc.active = { dayKey: "2026-09-10", start: T0 + 3600_000, lastSeen: T0 + 3600_000 };

    const serialized = serializeDoc(doc);
    const parsed = parseDoc(serialized);
    expect(parsed).toEqual(doc);
  });

  it("PERS-01 parseDoc(null) returns emptyDoc()", () => {
    expect(parseDoc(null)).toEqual(emptyDoc());
  });

  it("PERS-01 parseDoc with non-JSON string returns emptyDoc()", () => {
    expect(parseDoc("not json")).toEqual(emptyDoc());
  });

  it("PERS-01 parseDoc with non-object JSON returns emptyDoc()", () => {
    expect(parseDoc(JSON.stringify([1, 2, 3]))).toEqual(emptyDoc());
  });

  it("PERS-01 parseDoc with version !== 1 returns emptyDoc()", () => {
    expect(parseDoc(JSON.stringify({ version: 2 }))).toEqual(emptyDoc());
  });

  it("SET-05 parseDoc validates idleThresholdMinutes and falls back to default", () => {
    const json = JSON.stringify({
      version: 1,
      settings: {
        idleThresholdMinutes: 7,
        autoResume: true,
        launchAtLogin: true,
      },
      days: {},
      active: null,
    });
    const parsed = parseDoc(json);
    expect(parsed.settings.idleThresholdMinutes).toBe(5);
  });

  it("SET-05 parseDoc validates autoResume and falls back if not boolean", () => {
    const json = JSON.stringify({
      version: 1,
      settings: {
        idleThresholdMinutes: 5,
        autoResume: "yes",
        launchAtLogin: true,
      },
      days: {},
      active: null,
    });
    const parsed = parseDoc(json);
    expect(parsed.settings.autoResume).toBe(true);
  });

  it("SET-05 parseDoc keeps valid boolean launchAtLogin", () => {
    const json = JSON.stringify({
      version: 1,
      settings: {
        idleThresholdMinutes: 5,
        autoResume: true,
        launchAtLogin: false,
      },
      days: {},
      active: null,
    });
    const parsed = parseDoc(json);
    expect(parsed.settings.launchAtLogin).toBe(false);
  });

  it("PERS-02 parseDoc keeps valid days and drops malformed ones", () => {
    const json = JSON.stringify({
      version: 1,
      settings: {
        idleThresholdMinutes: 5,
        autoResume: true,
        launchAtLogin: true,
      },
      days: {
        "2026-09-10": {
          periods: [
            { start: T0, end: T0 + 3600_000 },
            { start: T0 + 7200_000, end: T0 + 5400_000 }, // end < start, drop
          ],
          adjustmentSeconds: 900,
        },
        "2026-09-09": {
          periods: [
            { start: T0, end: T0 + 1800_000 },
          ],
          adjustmentSeconds: 0,
        },
        "yesterday": {
          periods: [],
          adjustmentSeconds: 0,
        },
      },
      active: null,
    });
    const parsed = parseDoc(json);
    expect(parsed.days["2026-09-10"]?.periods).toHaveLength(1);
    expect(parsed.days["2026-09-10"]?.periods[0]).toEqual({ start: T0, end: T0 + 3600_000 });
    expect(parsed.days["2026-09-09"]).toBeDefined();
    expect(parsed.days["yesterday"]).toBeUndefined();
  });

  it("PERS-02 parseDoc drops period with non-numeric start or end", () => {
    const json = JSON.stringify({
      version: 1,
      settings: { idleThresholdMinutes: 5, autoResume: true, launchAtLogin: true },
      days: {
        "2026-09-10": {
          periods: [
            { start: T0, end: T0 + 3600_000 },
            { start: "not-a-number", end: T0 + 5400_000 },
          ],
          adjustmentSeconds: 0,
        },
      },
      active: null,
    });
    const parsed = parseDoc(json);
    expect(parsed.days["2026-09-10"]?.periods).toHaveLength(1);
  });

  it("PERS-04 parseDoc keeps valid active period", () => {
    const json = JSON.stringify({
      version: 1,
      settings: { idleThresholdMinutes: 5, autoResume: true, launchAtLogin: true },
      days: {},
      active: {
        dayKey: "2026-09-10",
        start: T0,
        lastSeen: T0 + 1800_000,
      },
    });
    const parsed = parseDoc(json);
    expect(parsed.active).toEqual({
      dayKey: "2026-09-10",
      start: T0,
      lastSeen: T0 + 1800_000,
    });
  });

  it("PERS-04 parseDoc nulls active if missing lastSeen", () => {
    const json = JSON.stringify({
      version: 1,
      settings: { idleThresholdMinutes: 5, autoResume: true, launchAtLogin: true },
      days: {},
      active: {
        dayKey: "2026-09-10",
        start: T0,
      },
    });
    const parsed = parseDoc(json);
    expect(parsed.active).toBeNull();
  });

  it("PERS-04 parseDoc nulls active if start or lastSeen is not finite", () => {
    const json = JSON.stringify({
      version: 1,
      settings: { idleThresholdMinutes: 5, autoResume: true, launchAtLogin: true },
      days: {},
      active: {
        dayKey: "2026-09-10",
        start: null,
        lastSeen: T0 + 1800_000,
      },
    });
    const parsed = parseDoc(json);
    expect(parsed.active).toBeNull();
  });

  it("SET-05 withSettings returns a new doc with updated settings", () => {
    const doc = emptyDoc();
    doc.settings.idleThresholdMinutes = 5;
    const updated = withSettings(doc, { idleThresholdMinutes: 10 });
    expect(updated.settings.idleThresholdMinutes).toBe(10);
    expect(updated).not.toBe(doc);
    expect(doc.settings.idleThresholdMinutes).toBe(5);
  });

  it("SET-05 withSettings validates idleThresholdMinutes and leaves unchanged if invalid", () => {
    const doc = emptyDoc();
    doc.settings.idleThresholdMinutes = 5;
    const updated = withSettings(doc, { idleThresholdMinutes: 4 });
    expect(updated.settings.idleThresholdMinutes).toBe(5);
  });

  it("SET-05 withSettings validates boolean settings", () => {
    const doc = emptyDoc();
    const updated = withSettings(doc, { autoResume: false, launchAtLogin: false });
    expect(updated.settings.autoResume).toBe(false);
    expect(updated.settings.launchAtLogin).toBe(false);
  });

  it("SET-06 parseDoc keeps showTimeInTray: false", () => {
    const json = JSON.stringify({
      version: 1,
      settings: {
        idleThresholdMinutes: 5,
        autoResume: true,
        launchAtLogin: true,
        showTimeInTray: false,
      },
      days: {},
      active: null,
    });
    const parsed = parseDoc(json);
    expect(parsed.settings.showTimeInTray).toBe(false);
  });

  it("SET-06 parseDoc ignores invalid showTimeInTray (non-boolean) and keeps default true", () => {
    const json = JSON.stringify({
      version: 1,
      settings: {
        idleThresholdMinutes: 5,
        autoResume: true,
        launchAtLogin: true,
        showTimeInTray: "no",
      },
      days: {},
      active: null,
    });
    const parsed = parseDoc(json);
    expect(parsed.settings.showTimeInTray).toBe(true);
  });

  it("SET-06 withSettings applies showTimeInTray: false", () => {
    const doc = emptyDoc();
    const updated = withSettings(doc, { showTimeInTray: false });
    expect(updated.settings.showTimeInTray).toBe(false);
  });

  it("SET-06 serialize/parse round-trips showTimeInTray setting", () => {
    const doc = emptyDoc();
    doc.settings.showTimeInTray = false;
    const serialized = serializeDoc(doc);
    const parsed = parseDoc(serialized);
    expect(parsed.settings.showTimeInTray).toBe(false);
  });

  it("HIST-01 history returns weeks with correct grouping and ordering", () => {
    const doc: Doc = emptyDoc();
    // 2026-09-04 is Friday (week 36)
    // 2026-09-08 is Tuesday (week 37)
    // 2026-09-09 is Wednesday (week 37)
    // 2026-09-10 is Thursday (week 37, today)

    const day1 = ensureDay(doc, "2026-09-04");
    day1.periods.push({ start: T0, end: T0 + 10_800_000 }); // 3h

    const day2 = ensureDay(doc, "2026-09-08");
    day2.periods.push({ start: T0, end: T0 + 3600_000 }); // 1h

    const day3 = ensureDay(doc, "2026-09-09");
    day3.periods.push({ start: T0, end: T0 + 7200_000 }); // 2h

    const day4 = ensureDay(doc, "2026-09-10");
    day4.periods.push({ start: T0, end: T0 + 1800_000 }); // 30m today

    const result = history(doc, "2026-09-10", T0 + 1800_000);

    expect(result).toHaveLength(2);

    // First week: current week (W37)
    expect(result[0]!.key).toBe("2026-W37");
    expect(result[0]!.label).toBe("This week");
    expect(result[0]!.seconds).toBe(3600 + 7200 + 1800); // 09-08 + 09-09, today's period is not included in days but in week total? Actually re-read...
    expect(result[0]!.days).toHaveLength(2);
    expect(result[0]!.days[0]!.dayKey).toBe("2026-09-09");
    expect(result[0]!.days[1]!.dayKey).toBe("2026-09-08");

    // Second week: W36
    expect(result[1]!.key).toBe("2026-W36");
    expect(result[1]!.label).toBe("Week 36");
    expect(result[1]!.seconds).toBe(10_800_000 / 1000); // 3h
    expect(result[1]!.days).toHaveLength(1);
    expect(result[1]!.days[0]!.dayKey).toBe("2026-09-04");
  });

  it("HIST-02 history includes today's running active period in this week", () => {
    const doc: Doc = emptyDoc();
    const day = ensureDay(doc, "2026-09-09");
    day.periods.push({ start: T0, end: T0 + 3600_000 }); // 1h yesterday

    doc.active = {
      dayKey: "2026-09-10",
      start: T0,
      lastSeen: T0,
    };

    const nowMs = T0 + 900_000; // 15 minutes later
    const result = history(doc, "2026-09-10", nowMs);

    expect(result).toHaveLength(1);
    expect(result[0]!.key).toBe("2026-W37");
    expect(result[0]!.label).toBe("This week");
    expect(result[0]!.seconds).toBe(3600 + 900); // 1h from yesterday + 15m from today's active
  });

  it("HIST-01 history does not list days with zero seconds", () => {
    const doc: Doc = emptyDoc();
    const day1 = ensureDay(doc, "2026-09-08");
    day1.periods.push({ start: T0, end: T0 + 3600_000 }); // 1h

    const day2 = ensureDay(doc, "2026-09-09");
    day2.periods = []; // zero seconds

    const result = history(doc, "2026-09-10", T0);

    expect(result).toHaveLength(1);
    expect(result[0]!.days).toHaveLength(1);
    expect(result[0]!.days[0]!.dayKey).toBe("2026-09-08");
  });

  it("HIST-01 history returns empty array for doc with only today's data", () => {
    const doc: Doc = emptyDoc();
    doc.active = {
      dayKey: "2026-09-10",
      start: T0,
      lastSeen: T0,
    };

    const result = history(doc, "2026-09-10", T0 + 900_000);

    expect(result).toHaveLength(0);
  });

  it("HIST-02 history does not emit empty weeks (only previous days)", () => {
    const doc: Doc = emptyDoc();
    const day = ensureDay(doc, "2026-09-08");
    day.periods.push({ start: T0, end: T0 + 3600_000 }); // 1h

    const result = history(doc, "2026-09-10", T0);

    // Should have one week with one day
    expect(result).toHaveLength(1);
    expect(result[0]!.days).toHaveLength(1);
  });

  it("HIST-01 history formats day labels correctly", () => {
    const doc: Doc = emptyDoc();
    const day = ensureDay(doc, "2026-09-09");
    day.periods.push({ start: T0, end: T0 + 3600_000 }); // 1h

    const result = history(doc, "2026-09-10", T0);

    expect(result[0]!.days[0]!.label).toBe("Wed 9 Sep");
  });
});
