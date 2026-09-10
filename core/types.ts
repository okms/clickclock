/**
 * The persisted document and the timer's public state.
 * Schema is ADR-0003. Timestamps are epoch milliseconds. Day keys are local dates
 * formatted YYYY-MM-DD.
 */

export interface Period {
  /** epoch ms, inclusive */
  start: number;
  /** epoch ms, exclusive; always >= start */
  end: number;
}

export interface DayRecord {
  periods: Period[];
  /** Manual corrections (TT-12, deferred). Always 0 in v1 but part of the schema. */
  adjustmentSeconds: number;
}

export interface Settings {
  /** IDLE-01, IDLE-08, SET-01. Allowed: 1, 2, 3, 5, 10, 15, 20, 30. Default 5. */
  idleThresholdMinutes: number;
  /** IDLE-05, IDLE-07, SET-02. Default true. */
  autoResume: boolean;
  /** AUTO-01, AUTO-02. Default true. The shell mirrors this to the OS. */
  launchAtLogin: boolean;
  /** TRAY-10, SET-06. Default true. */
  showTimeInTray: boolean;
}

/** The currently counting period. Present only while Running. */
export interface ActivePeriod {
  dayKey: string;
  start: number;
  /** Heartbeat updated on every save; used to close the period after a crash (TT-11). */
  lastSeen: number;
}

export interface Doc {
  version: 1;
  settings: Settings;
  days: Record<string, DayRecord>;
  active: ActivePeriod | null;
}

export const DEFAULT_SETTINGS: Settings = {
  idleThresholdMinutes: 5,
  autoResume: true,
  launchAtLogin: true,
  showTimeInTray: true,
};

export const IDLE_THRESHOLD_OPTIONS = [1, 2, 3, 5, 10, 15, 20, 30] as const;

export type PauseReason = "manual" | "auto";

export type TimerState =
  | { kind: "stopped" }
  | { kind: "paused"; reason: "manual" }
  | { kind: "paused"; reason: "auto"; idleMinutes: number }
  | { kind: "running"; resumedAt: number | null };

/** What a call to Timer.tick() reports back to the shell. */
export interface TickResult {
  /** The state kind or reason changed, or a period was opened/closed: save now. */
  transition: boolean;
}
