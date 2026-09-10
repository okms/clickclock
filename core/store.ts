/**
 * The persisted document: construction, totals, and crash recovery.
 * Schema is ADR-0003. Parsing, serialisation and history live here too (M1.2).
 */
import type { DayRecord, Doc } from "./types";
import { DEFAULT_SETTINGS } from "./types";

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
