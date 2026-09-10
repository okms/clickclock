import { describe, expect, it } from "vitest";
import { FakeClock } from "./ports";
import { emptyDoc, ensureDay } from "./store";
import { dayKey, startOfDay } from "./format";
import { Timer } from "./timer";
import type { Doc } from "./types";

const T0 = new Date(2026, 8, 10, 8, 0, 0).getTime(); // local 2026-09-10 08:00:00

function mk(doc: Doc = emptyDoc(), t = T0) {
  const clock = new FakeClock(t);
  const timer = new Timer(doc, clock);
  return { timer, clock };
}

describe("TT-08 never Running after construction", () => {
  it("fresh doc starts Stopped", () => {
    const { timer } = mk();
    expect(timer.state).toEqual({ kind: "stopped" });
  });

  it("doc with a closed period today starts Paused (manual)", () => {
    const doc = emptyDoc();
    const dk = dayKey(T0);
    ensureDay(doc, dk).periods.push({ start: T0 - 3600_000, end: T0 });
    const { timer } = mk(doc);
    expect(timer.state).toEqual({ kind: "paused", reason: "manual" });
  });

  it("dangling active period is recovered and closed at lastSeen", () => {
    const doc = emptyDoc();
    const dk = dayKey(T0);
    doc.active = { dayKey: dk, start: T0 - 3600_000, lastSeen: T0 - 1800_000 };
    const { timer } = mk(doc);
    expect(timer.state).toEqual({ kind: "paused", reason: "manual" });
    expect(timer.todaySeconds()).toBe(1800);
    expect(timer.doc.active).toBeNull();
  });
});

describe("TT-01 start counts wall-clock time", () => {
  it("start then advance 3600s yields 3600 seconds", () => {
    const { timer, clock } = mk();
    expect(timer.start()).toBe(true);
    clock.advance(3600_000);
    expect(timer.todaySeconds()).toBe(3600);
    expect(timer.state).toEqual({ kind: "running", resumedAt: null });
  });
});

describe("TT-02 / TT-06 pause keeps total, sessions sum", () => {
  it("start, +1000s, pause, +500s no change, start, +200s -> 1200, two periods", () => {
    const { timer, clock } = mk();
    timer.start();
    clock.advance(1000_000);
    expect(timer.pause()).toBe(true);
    clock.advance(500_000);
    expect(timer.todaySeconds()).toBe(1000);
    timer.start();
    clock.advance(200_000);
    expect(timer.todaySeconds()).toBe(1200);
    timer.pause();
    const dk = timer.todayKey();
    expect(timer.doc.days[dk]?.periods.length).toBe(2);
  });
});

describe("TT-03 toggle", () => {
  it("toggles stopped -> running -> paused manual", () => {
    const { timer, clock } = mk();
    timer.toggle();
    expect(timer.state.kind).toBe("running");
    clock.advance(1000);
    timer.toggle();
    expect(timer.state).toEqual({ kind: "paused", reason: "manual" });
  });
});

describe("TT-04 stop resets today's total", () => {
  it("stop after 1000s zeroes today, canStop false, periods empty", () => {
    const { timer, clock } = mk();
    timer.start();
    clock.advance(1000_000);
    expect(timer.stop()).toBe(true);
    expect(timer.todaySeconds()).toBe(0);
    expect(timer.state).toEqual({ kind: "stopped" });
    expect(timer.canStop).toBe(false);
    const dk = timer.todayKey();
    expect(timer.doc.days[dk]?.periods).toEqual([]);
    expect(timer.stop()).toBe(false);
  });

  it("stop only touches today, yesterday survives", () => {
    const doc = emptyDoc();
    const yKey = dayKey(T0 - 24 * 3600_000);
    ensureDay(doc, yKey).periods.push({ start: T0 - 25 * 3600_000, end: T0 - 24 * 3600_000 });
    const { timer, clock } = mk(doc);
    timer.start();
    clock.advance(1000_000);
    timer.stop();
    expect(doc.days[yKey]?.periods.length).toBe(1);
  });
});

describe("TT-07 accuracy within 1s per hour (exact via timestamps)", () => {
  it("3600 ticks of 1000ms each with idle 0 yields exactly 3600s", () => {
    const { timer, clock } = mk();
    timer.start();
    for (let i = 0; i < 3600; i++) {
      clock.advance(1000);
      timer.tick(0);
    }
    expect(timer.todaySeconds()).toBe(3600);
  });
});

describe("TT-09 counting continues while hidden (no ticks under threshold)", () => {
  it("advance 240s with no tick, then tick(0) still running with 240s", () => {
    const { timer, clock } = mk();
    timer.start();
    clock.advance(240_000);
    const result = timer.tick(0);
    expect(timer.state.kind).toBe("running");
    expect(timer.todaySeconds()).toBe(240);
    expect(result.transition).toBe(false);
  });
});

describe("TT-11 gap between ticks longer than threshold is not worked time", () => {
  it("20 min gap with no tick -> paused auto, idleMinutes 20, nothing counted, active null", () => {
    const { timer, clock } = mk();
    timer.start();
    clock.advance(20 * 60_000);
    const result = timer.tick(0);
    expect(timer.state).toEqual({ kind: "paused", reason: "auto", idleMinutes: 20 });
    expect(timer.todaySeconds()).toBe(0);
    expect(timer.doc.active).toBeNull();
    expect(result.transition).toBe(true);
  });

  it("a tick at +60s before the gap counts that 60s", () => {
    const { timer, clock } = mk();
    timer.start();
    clock.advance(60_000);
    timer.tick(0);
    clock.advance(20 * 60_000);
    timer.tick(0);
    expect(timer.todaySeconds()).toBe(60);
  });
});

describe("TT-10 midnight rollover", () => {
  it("closes the active period at midnight and opens a new one, state carries over", () => {
    const t235900 = new Date(2026, 8, 10, 23, 59, 0).getTime();
    const { timer, clock } = mk(emptyDoc(), t235900);
    timer.start();
    clock.advance(120_000); // 2 minutes -> 00:01:00 next day
    const result = timer.tick(0);
    expect(timer.state.kind).toBe("running");
    expect(result.transition).toBe(true);

    const boundary = startOfDay("2026-09-11");
    const oldDay = timer.doc.days["2026-09-10"];
    expect(oldDay?.periods).toEqual([{ start: t235900, end: boundary }]);
    expect(timer.doc.active?.dayKey).toBe("2026-09-11");
    expect(timer.doc.active?.start).toBe(boundary);
    expect(timer.todayKey()).toBe("2026-09-11");
    expect(timer.todaySeconds()).toBe(60);
  });
});

describe("IDLE-02/03/04 idle pauses automatically with clamped period and whole idle minutes", () => {
  it("3600s of ticking then a 300s idle tick pauses with 5 idle minutes and 3300s total", () => {
    const { timer, clock } = mk();
    timer.start();
    for (let i = 0; i < 60; i++) {
      clock.advance(60_000);
      timer.tick(0);
    }
    const result = timer.tick(300);
    expect(timer.state).toEqual({ kind: "paused", reason: "auto", idleMinutes: 5 });
    expect(timer.todaySeconds()).toBe(3300);
    expect(result.transition).toBe(true);
  });

  it("IDLE-03 clamp: idle longer than elapsed never produces negative total or end<start", () => {
    const { timer, clock } = mk();
    timer.start();
    clock.advance(100_000);
    timer.tick(300);
    expect(timer.state.kind).toBe("paused");
    expect(timer.todaySeconds()).toBe(0);
    const dk = timer.todayKey();
    for (const p of timer.doc.days[dk]?.periods ?? []) {
      expect(p.end).toBeGreaterThanOrEqual(p.start);
    }
  });
});

describe("IDLE-05 auto-resume after short idle", () => {
  it("continuing from an auto pause, tick(0) resumes running with resumedAt = now, total continues", () => {
    const { timer, clock } = mk();
    timer.start();
    for (let i = 0; i < 60; i++) {
      clock.advance(60_000);
      timer.tick(0);
    }
    timer.tick(300); // auto pause, 3300s total
    const result = timer.tick(0);
    expect(timer.state).toEqual({ kind: "running", resumedAt: clock.now() });
    expect(timer.todaySeconds()).toBe(3300);
    expect(result.transition).toBe(true);
  });
});

describe("IDLE-06 manual pause never auto-resumes", () => {
  it("start, manual pause, advance, tick(0) stays paused manual", () => {
    const { timer, clock } = mk();
    timer.start();
    clock.advance(10_000);
    timer.pause();
    clock.advance(10_000);
    timer.tick(0);
    expect(timer.state).toEqual({ kind: "paused", reason: "manual" });
  });
});

describe("IDLE-07 autoResume can be disabled by settings", () => {
  it("with autoResume false, auto pause then tick(0) stays paused auto", () => {
    const { timer, clock } = mk();
    timer.updateSettings({ autoResume: false });
    timer.start();
    clock.advance(10 * 60_000);
    timer.tick(0); // gap triggers auto pause (TT-11 path), still paused auto
    expect(timer.state.kind).toBe("paused");
    const before = timer.state;
    timer.tick(0);
    expect(timer.state).toEqual(before);
  });
});

describe("IDLE-08 threshold comes from settings", () => {
  it("idleThresholdMinutes 1: +120s then tick(60) pauses auto with 60s total", () => {
    const { timer, clock } = mk();
    timer.updateSettings({ idleThresholdMinutes: 1 });
    timer.start();
    clock.advance(60_000);
    timer.tick(0);
    clock.advance(60_000);
    const result = timer.tick(60);
    expect(timer.state.kind).toBe("paused");
    if (timer.state.kind === "paused") expect(timer.state.reason).toBe("auto");
    expect(timer.todaySeconds()).toBe(60);
    expect(result.transition).toBe(true);
  });
});

describe("PERS-04 heartbeat updated on every tick while running", () => {
  it("doc.active.lastSeen tracks clock.now() on each running tick", () => {
    const { timer, clock } = mk();
    timer.start();
    clock.advance(10_000);
    timer.tick(0);
    expect(timer.doc.active?.lastSeen).toBe(clock.now());
    clock.advance(20_000);
    timer.tick(0);
    expect(timer.doc.active?.lastSeen).toBe(clock.now());
  });
});

describe("TickResult.transition reflects state changes", () => {
  it("plain heartbeat tick reports no transition; state change ticks report transition", () => {
    const { timer, clock } = mk();
    timer.start();
    clock.advance(1000);
    expect(timer.tick(0).transition).toBe(false);
    clock.advance(20 * 60_000);
    expect(timer.tick(0).transition).toBe(true); // TT-11 gap
  });
});

describe("Derived stopped state", () => {
  it("start then pause immediately with 0 elapsed reads as stopped", () => {
    const { timer } = mk();
    timer.start();
    timer.pause();
    expect(timer.state).toEqual({ kind: "stopped" });
  });
});
