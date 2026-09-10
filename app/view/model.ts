/**
 * Pure view model computation: no DOM, no I/O.
 * Derives display state from Timer and now time.
 */
import type { Timer } from "../../core/timer";
import type { TrayStatus } from "../platform/platform";
import { formatDecimalHours, formatHHMM, formatDayLong } from "../../core/format";

export interface ViewModel {
  stateWord: "Running" | "Paused" | "Stopped";
  stateKind: "running" | "paused" | "stopped";
  why: string;
  dateLabel: string;
  decimal: string;
  hhmm: string;
  primaryLabel: "Start" | "Pause";
  canClear: boolean;
  note: string;
  tray: TrayStatus;
}

export interface ViewModelOptions {
  noteOverride?: string | null;
}

export function viewModel(
  timer: Timer,
  nowMs: number,
  opts: ViewModelOptions
): ViewModel {
  const state = timer.state;
  const totalSeconds = timer.todaySeconds();
  const todayKey = timer.todayKey();
  const decimal = formatDecimalHours(totalSeconds);
  const hhmm = formatHHMM(totalSeconds);
  const dateLabel = formatDayLong(todayKey);

  // Determine state word and kind
  let stateWord: "Running" | "Paused" | "Stopped";
  let stateKind: "running" | "paused" | "stopped";
  let why = "";

  if (state.kind === "running") {
    stateWord = "Running";
    stateKind = "running";

    // Check for auto-resume notice: within 10 seconds of resumedAt
    if (state.resumedAt !== null && nowMs - state.resumedAt < 10_000) {
      why = "Resumed after being away";
    }
  } else if (state.kind === "paused") {
    stateWord = "Paused";
    stateKind = "paused";

    // Auto-pause reason
    if (state.reason === "auto") {
      const minutes = state.idleMinutes;
      const minuteWord = minutes === 1 ? "minute" : "minutes";
      why = `Away for ${minutes} ${minuteWord}, paused by itself`;
    }
  } else {
    stateWord = "Stopped";
    stateKind = "stopped";
  }

  // Primary button label
  const primaryLabel = stateWord === "Running" ? "Pause" : "Start";

  // Can clear: only when there's time to clear
  const canClear = totalSeconds > 0;

  // Note: default describes the idle threshold; can be overridden
  let note: string;
  if (opts.noteOverride !== undefined && opts.noteOverride !== null) {
    note = opts.noteOverride;
  } else {
    const threshold = timer.settings.idleThresholdMinutes;
    const minuteWord = threshold === 1 ? "minute" : "minutes";
    note = `Pauses by itself after ${threshold} ${minuteWord} away. Everything stays on this computer.`;
  }

  // Tray status
  const tray: TrayStatus = {
    tooltip: `${stateWord}, ${decimal} hours (${hhmm})`,
    running: stateKind === "running",
    canStart: timer.canStart,
    canPause: timer.canPause,
    canStop: timer.canStop,
  };

  return {
    stateWord,
    stateKind,
    why,
    dateLabel,
    decimal,
    hhmm,
    primaryLabel,
    canClear,
    note,
    tray,
  };
}
