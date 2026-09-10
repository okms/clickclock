/**
 * The timer state machine. Pure TypeScript: no DOM, no OS. Driven by an injected
 * Clock and a tick(idleSeconds) call from the shell. All totals are derived from
 * timestamps in the document, never from tick counts. See docs/design/architecture.md.
 */
import type { Clock } from "./ports";
import type { Doc, Settings, TimerState, TickResult } from "./types";
import { daySeconds, ensureDay, recoverAtLaunch } from "./store";
import { dayKey, nextDayKey, startOfDay } from "./format";

type InternalKind = "stopped" | "paused-manual" | "paused-auto" | "running";

export class Timer {
  readonly doc: Doc;
  private clock: Clock;
  private kind: InternalKind;
  private idleMinutes = 0;
  private resumedAt: number | null = null;
  private lastTick: number;

  constructor(doc: Doc, clock: Clock) {
    this.doc = recoverAtLaunch(doc);
    this.clock = clock;
    const now = clock.now();
    this.lastTick = now;
    this.kind = this.todaySeconds() > 0 ? "paused-manual" : "stopped";
  }

  get state(): TimerState {
    switch (this.kind) {
      case "running":
        return { kind: "running", resumedAt: this.resumedAt };
      case "paused-auto":
        return { kind: "paused", reason: "auto", idleMinutes: this.idleMinutes };
      case "paused-manual":
        if (this.todaySeconds() === 0) return { kind: "stopped" };
        return { kind: "paused", reason: "manual" };
      case "stopped":
      default:
        return { kind: "stopped" };
    }
  }

  get settings(): Settings {
    return this.doc.settings;
  }

  todayKey(): string {
    return dayKey(this.clock.now());
  }

  todaySeconds(): number {
    return daySeconds(this.doc, this.todayKey(), this.clock.now());
  }

  get canStart(): boolean {
    return this.kind !== "running";
  }

  get canPause(): boolean {
    return this.kind === "running";
  }

  get canStop(): boolean {
    return this.kind === "running" || this.todaySeconds() > 0;
  }

  start(): boolean {
    if (this.kind === "running") return false;
    const now = this.clock.now();
    this.doc.active = { dayKey: this.todayKey(), start: now, lastSeen: now };
    this.kind = "running";
    this.resumedAt = null;
    this.lastTick = now;
    return true;
  }

  pause(): boolean {
    if (this.kind !== "running") return false;
    const now = this.clock.now();
    this.closeActive(now);
    this.kind = "paused-manual";
    this.lastTick = now;
    return true;
  }

  stop(): boolean {
    if (!this.canStop) return false;
    const now = this.clock.now();
    if (this.kind === "running") {
      this.closeActive(now);
    }
    const key = this.todayKey();
    this.doc.days[key] = { periods: [], adjustmentSeconds: 0 };
    this.kind = "stopped";
    this.lastTick = now;
    return true;
  }

  toggle(): void {
    if (this.kind === "running") {
      this.pause();
    } else {
      this.start();
    }
  }

  tick(idleSeconds: number): TickResult {
    const now = this.clock.now();
    const thresholdMs = this.settings.idleThresholdMinutes * 60_000;
    let transition = false;

    if (this.kind === "running" && this.doc.active) {
      // TT-11: a gap between ticks longer than the threshold is not worked time.
      if (now - this.lastTick > thresholdMs) {
        this.closeActive(this.lastTick);
        this.kind = "paused-auto";
        this.idleMinutes = Math.round((now - this.lastTick) / 60_000);
        transition = true;
        this.lastTick = now;
        return { transition };
      }

      // TT-10: midnight rollover, possibly across multiple days.
      while (this.doc.active && dayKey(now) !== this.doc.active.dayKey) {
        const oldKey = this.doc.active.dayKey;
        const boundary = startOfDay(nextDayKey(oldKey));
        this.closeActive(boundary);
        const newKey = nextDayKey(oldKey);
        this.doc.active = { dayKey: newKey, start: boundary, lastSeen: boundary };
        transition = true;
      }

      // IDLE-02/03/04: idle time reported by the shell.
      if (idleSeconds * 1000 >= thresholdMs) {
        this.closeActive(now - idleSeconds * 1000);
        this.kind = "paused-auto";
        this.idleMinutes = Math.floor(idleSeconds / 60);
        transition = true;
      } else if (this.doc.active) {
        // PERS-04: heartbeat.
        this.doc.active.lastSeen = now;
      }
    } else if (this.kind === "paused-auto" && this.settings.autoResume && idleSeconds < 2) {
      // IDLE-05: auto-resume after a short idle.
      const now2 = now;
      this.doc.active = { dayKey: dayKey(now2), start: now2, lastSeen: now2 };
      this.kind = "running";
      this.resumedAt = now2;
      transition = true;
    }

    this.lastTick = now;
    return { transition };
  }

  updateSettings(patch: Partial<Settings>): void {
    this.doc.settings = { ...this.doc.settings, ...patch };
  }

  private closeActive(endMs: number): void {
    const active = this.doc.active;
    if (!active) return;
    const end = Math.max(active.start, endMs);
    if (end !== active.start) {
      ensureDay(this.doc, active.dayKey).periods.push({ start: active.start, end });
    }
    this.doc.active = null;
  }
}
