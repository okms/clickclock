/**
 * The persisted document: construction, totals, and crash recovery.
 * Schema is ADR-0003. Parsing, serialisation and history live here too (M1.2).
 */
import type { DayRecord, Doc, Settings } from "./types";
import { DEFAULT_SETTINGS, IDLE_THRESHOLD_OPTIONS } from "./types";
import { formatDayShort, weekKey, weekLabel } from "./format";

export function emptyDoc(): Doc {
  return { version: 1, settings: { ...DEFAULT_SETTINGS }, days: {}, active: null };
}

/** Get or create the record for a day. Mutates `doc`. */
export function ensureDay(doc: Doc, dayKey: string): DayRecord {
  let day = doc.days[dayKey];
  if (!day) {
    day = { periods: [], adjustmentSeconds: 0 };
    doc.days[dayKey] = day;
  }
  return day;
}

/**
 * Seconds recorded for `dayKey` as of `nowMs`: closed periods, plus the manual
 * adjustment, plus the open active period if it belongs to that day. Never negative.
 */
export function daySeconds(doc: Doc, dayKey: string, nowMs: number): number {
  const day = doc.days[dayKey];
  let ms = 0;
  if (day) {
    for (const p of day.periods) ms += Math.max(0, p.end - p.start);
  }
  if (doc.active && doc.active.dayKey === dayKey) {
    ms += Math.max(0, nowMs - doc.active.start);
  }
  const seconds = ms / 1000 + (day?.adjustmentSeconds ?? 0);
  return Math.max(0, seconds);
}

/**
 * TT-08, TT-11, PERS-04: if the product was Running when it last died, close the
 * dangling active period at its last heartbeat. Returns a new document; never Running.
 */
export function recoverAtLaunch(doc: Doc): Doc {
  if (!doc.active) return doc;
  const { dayKey, start, lastSeen } = doc.active;
  const out: Doc = { ...doc, days: { ...doc.days }, active: null };
  const end = Math.max(start, lastSeen);
  if (end > start) {
    const existing = out.days[dayKey];
    out.days[dayKey] = {
      periods: [...(existing?.periods ?? []), { start, end }],
      adjustmentSeconds: existing?.adjustmentSeconds ?? 0,
    };
  }
  return out;
}

/**
 * PERS-05: Serialize a document to pretty-printed JSON with 2-space indent.
 */
export function serializeDoc(doc: Doc): string {
  return JSON.stringify(doc, null, 2);
}

/**
 * PERS-01, PERS-02, PERS-04, SET-05: Parse JSON to a Doc with validation.
 * Returns emptyDoc() for invalid input. Never throws.
 */
export function parseDoc(json: string | null): Doc {
  try {
    if (!json) return emptyDoc();
    const parsed = JSON.parse(json);

    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return emptyDoc();
    }

    if (parsed.version !== 1) {
      return emptyDoc();
    }

    // Validate and build settings
    const settings: Settings = { ...DEFAULT_SETTINGS };
    if (parsed.settings && typeof parsed.settings === "object") {
      const s = parsed.settings;
      if (typeof s.idleThresholdMinutes === "number" && IDLE_THRESHOLD_OPTIONS.includes(s.idleThresholdMinutes as any)) {
        settings.idleThresholdMinutes = s.idleThresholdMinutes;
      }
      if (typeof s.autoResume === "boolean") {
        settings.autoResume = s.autoResume;
      }
      if (typeof s.launchAtLogin === "boolean") {
        settings.launchAtLogin = s.launchAtLogin;
      }
      if (typeof s.showTimeInTray === "boolean") {
        settings.showTimeInTray = s.showTimeInTray;
      }
    }

    // Validate and build days
    const days: Record<string, DayRecord> = {};
    if (parsed.days && typeof parsed.days === "object" && !Array.isArray(parsed.days)) {
      for (const [key, dayData] of Object.entries(parsed.days)) {
        // Key must match YYYY-MM-DD format
        if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) {
          continue;
        }

        if (!dayData || typeof dayData !== "object") {
          continue;
        }

        const d = dayData as any;
        const periods: any[] = [];

        if (Array.isArray(d.periods)) {
          for (const p of d.periods) {
            if (typeof p === "object" && p !== null) {
              const start = p.start;
              const end = p.end;
              // Both must be finite numbers and end >= start
              if (typeof start === "number" && typeof end === "number" && isFinite(start) && isFinite(end) && end >= start) {
                periods.push({ start, end });
              }
            }
          }
        }

        const adjustmentSeconds = typeof d.adjustmentSeconds === "number" && isFinite(d.adjustmentSeconds) ? d.adjustmentSeconds : 0;

        days[key] = {
          periods,
          adjustmentSeconds,
        };
      }
    }

    // Validate and build active
    let active = null;
    if (parsed.active && typeof parsed.active === "object") {
      const a = parsed.active;
      if (
        typeof a.dayKey === "string" &&
        typeof a.start === "number" &&
        typeof a.lastSeen === "number" &&
        isFinite(a.start) &&
        isFinite(a.lastSeen)
      ) {
        active = {
          dayKey: a.dayKey,
          start: a.start,
          lastSeen: a.lastSeen,
        };
      }
    }

    return {
      version: 1,
      settings,
      days,
      active,
    };
  } catch {
    return emptyDoc();
  }
}

/**
 * SET-05/SET-06: Update settings with validation. Returns a new Doc, never mutates input.
 * Invalid settings values are ignored (not applied).
 */
export function withSettings(doc: Doc, patch: Partial<Settings>): Doc {
  const settings: Settings = { ...doc.settings };

  if ("idleThresholdMinutes" in patch && patch.idleThresholdMinutes !== undefined) {
    if (IDLE_THRESHOLD_OPTIONS.includes(patch.idleThresholdMinutes as any)) {
      settings.idleThresholdMinutes = patch.idleThresholdMinutes;
    }
  }

  if ("autoResume" in patch && typeof patch.autoResume === "boolean") {
    settings.autoResume = patch.autoResume;
  }

  if ("launchAtLogin" in patch && typeof patch.launchAtLogin === "boolean") {
    settings.launchAtLogin = patch.launchAtLogin;
  }

  if ("showTimeInTray" in patch && typeof patch.showTimeInTray === "boolean") {
    settings.showTimeInTray = patch.showTimeInTray;
  }

  return {
    ...doc,
    settings,
  };
}

export interface HistoryDay {
  dayKey: string;
  label: string;
  seconds: number;
}

export interface HistoryWeek {
  key: string;
  label: string;
  seconds: number;
  days: HistoryDay[];
}

/**
 * HIST-01, HIST-02: Query history of previous days grouped by week.
 * Returns weeks ordered most recent first.
 * Includes only days with dayKey < todayKey and daySeconds > 0.
 * Week's seconds includes today's daySeconds if today is in that week.
 * Does not emit empty weeks.
 */
export function history(doc: Doc, todayKey: string, nowMs: number): HistoryWeek[] {
  const todayWeekKey = weekKey(todayKey);

  // Collect all previous days with > 0 seconds, sorted descending
  const previousDays: Array<{ dayKey: string; seconds: number }> = [];

  for (const dayKeyStr of Object.keys(doc.days)) {
    if (dayKeyStr < todayKey) {
      const seconds = daySeconds(doc, dayKeyStr, nowMs);
      if (seconds > 0) {
        previousDays.push({ dayKey: dayKeyStr, seconds });
      }
    }
  }

  previousDays.sort((a, b) => b.dayKey.localeCompare(a.dayKey));

  // Group consecutive days by week
  const weekMap = new Map<string, Array<{ dayKey: string; seconds: number }>>();

  for (const day of previousDays) {
    const wk = weekKey(day.dayKey);
    if (!weekMap.has(wk)) {
      weekMap.set(wk, []);
    }
    weekMap.get(wk)!.push(day);
  }

  // Add today's seconds to its week if there are days in that week
  let todaySeconds = daySeconds(doc, todayKey, nowMs);

  // Build result: week -> days sorted descending by dayKey
  const result: HistoryWeek[] = [];

  // Process weeks in order (most recent first by first day's dayKey)
  for (const [wkKey, daysInWeek] of weekMap) {
    // Sort days in this week by dayKey descending
    daysInWeek.sort((a, b) => b.dayKey.localeCompare(a.dayKey));

    // Calculate week seconds: sum of previous days + today if this is today's week
    let weekSeconds = daysInWeek.reduce((sum, day) => sum + day.seconds, 0);
    if (wkKey === todayWeekKey) {
      weekSeconds += todaySeconds;
    }

    const historyDays: HistoryDay[] = daysInWeek.map((day) => ({
      dayKey: day.dayKey,
      label: formatDayShort(day.dayKey),
      seconds: day.seconds,
    }));

    result.push({
      key: wkKey,
      label: weekLabel(daysInWeek[0]!.dayKey, todayKey),
      seconds: weekSeconds,
      days: historyDays,
    });
  }

  // Sort weeks by first day's dayKey descending (most recent first)
  result.sort((a, b) => {
    const aFirstDay = a.days[0]?.dayKey ?? "";
    const bFirstDay = b.days[0]?.dayKey ?? "";
    return bFirstDay.localeCompare(aFirstDay);
  });

  return result;
}
