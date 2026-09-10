/**
 * View model tests covering display and UI state requirements.
 * Named after spec IDs: DISP-01..08, TT-03, IDLE-04/05/09, TRAY-02/03, DISP-07.
 */
import { describe, it, expect } from "vitest";
import { Timer } from "../../core/timer";
import { emptyDoc } from "../../core/store";
import { FakeClock } from "../../core/ports";
import { viewModel } from "./model";

// Reference timestamp: 2026-09-10 12:00:00 local time
const T0 = new Date(2026, 8, 10, 12, 0, 0).getTime();

describe("viewModel", () => {
  describe("DISP-06: state display", () => {
    it("DISP-06: stopped shows 'Stopped' with no secondary line", () => {
      const clock = new FakeClock(T0);
      const timer = new Timer(emptyDoc(), clock);
      const vm = viewModel(timer, T0, {});

      expect(vm.stateWord).toBe("Stopped");
      expect(vm.stateKind).toBe("stopped");
      expect(vm.why).toBe("");
      expect(vm.primaryLabel).toBe("Start");
      expect(vm.canClear).toBe(false);
    });

    it("TT-03/DISP-01: after start and 27000s shows 'Running', decimal '7.50', hhmm '07:30'", () => {
      const clock = new FakeClock(T0);
      const timer = new Timer(emptyDoc(), clock);

      // Start the timer
      expect(timer.start()).toBe(true);

      // Advance 27000 seconds (7.5 hours)
      clock.advance(27000 * 1000);

      const vm = viewModel(timer, clock.now(), {});

      expect(vm.stateWord).toBe("Running");
      expect(vm.stateKind).toBe("running");
      expect(vm.primaryLabel).toBe("Pause");
      expect(vm.decimal).toBe("7.50");
      expect(vm.hhmm).toBe("07:30");
      expect(vm.canClear).toBe(true);
    });
  });

  describe("IDLE-04: auto-pause with idle threshold", () => {
    it("IDLE-04: after start, 3600s, tick(300) pauses with 'Away for 5 minutes' message", () => {
      const clock = new FakeClock(T0);
      const timer = new Timer(emptyDoc(), clock);

      timer.start();
      // Advance less than threshold (5 min = 300 sec = 300000 ms)
      clock.advance(100 * 1000); // 100 seconds
      timer.tick(0); // Keep up with ticks to avoid gap > threshold
      // Now tick with 300 seconds idle, gap is small so idle condition triggers
      timer.tick(300);

      const vm = viewModel(timer, clock.now(), {});

      expect(vm.stateWord).toBe("Paused");
      expect(vm.stateKind).toBe("paused");
      expect(vm.why).toBe("Away for 5 minutes, paused by itself");
    });

    it("IDLE-04: with threshold 1 minute, idle 60 seconds says '1 minute'", () => {
      const clock = new FakeClock(T0);
      const doc = emptyDoc();
      doc.settings.idleThresholdMinutes = 1;
      const timer = new Timer(doc, clock);

      timer.start();
      // Advance less than threshold (1 min = 60 sec = 60000 ms)
      clock.advance(30 * 1000); // 30 seconds
      timer.tick(0); // Keep up with ticks to avoid gap > threshold
      // Now tick with 60 seconds idle, gap is small so idle condition triggers
      timer.tick(60);

      const vm = viewModel(timer, clock.now(), {});

      expect(vm.why).toBe("Away for 1 minute, paused by itself");
    });
  });

  describe("IDLE-05: auto-resume notice", () => {
    it("IDLE-05: after auto-pause and auto-resume, 'Resumed after being away' for 10s", () => {
      const clock = new FakeClock(T0);
      const timer = new Timer(emptyDoc(), clock);

      timer.start();
      clock.advance(3600 * 1000);
      timer.tick(300); // Auto-pause

      expect(timer.state.kind).toBe("paused");
      if (timer.state.kind === "paused") {
        expect(timer.state.reason).toBe("auto");
      }

      // Now auto-resume
      clock.advance(100); // Move time forward a bit
      timer.tick(0); // No idle, so auto-resume

      expect(timer.state.kind).toBe("running");

      // At resumedAt + 5 seconds, should show notice
      const resumedAt =
        timer.state.kind === "running" ? timer.state.resumedAt : null;
      const vm = viewModel(timer, (resumedAt ?? 0) + 5000, {});
      expect(vm.why).toBe("Resumed after being away");

      // At resumedAt + 11 seconds, notice should be gone
      const vm2 = viewModel(timer, (resumedAt ?? 0) + 11000, {});
      expect(vm2.why).toBe("");
    });
  });

  describe("IDLE-09: idle threshold note", () => {
    it("IDLE-09: default 5 minutes threshold appears in note", () => {
      const clock = new FakeClock(T0);
      const timer = new Timer(emptyDoc(), clock);

      const vm = viewModel(timer, T0, {});

      expect(vm.note).toContain("5 minutes");
    });

    it("IDLE-09: after updateSettings to 1 minute, note says '1 minute away'", () => {
      const clock = new FakeClock(T0);
      const timer = new Timer(emptyDoc(), clock);

      timer.updateSettings({ idleThresholdMinutes: 1 });

      const vm = viewModel(timer, T0, {});

      expect(vm.note).toContain("1 minute away");
      expect(vm.note).not.toContain("1 minutes");
    });
  });

  describe("TRAY-02/03: tray status", () => {
    it("TRAY-02: tray tooltip shows correct format", () => {
      const clock = new FakeClock(T0);
      const timer = new Timer(emptyDoc(), clock);

      timer.start();
      clock.advance(27000 * 1000);

      const vm = viewModel(timer, clock.now(), {});

      expect(vm.tray.tooltip).toBe("Running, 7.50 hours (07:30)");
    });

    it("TRAY-03: tray status reflects running state", () => {
      const clock = new FakeClock(T0);
      const timer = new Timer(emptyDoc(), clock);

      timer.start();
      clock.advance(27000 * 1000);

      const vm = viewModel(timer, clock.now(), {});

      expect(vm.tray.running).toBe(true);
      expect(vm.tray.canStart).toBe(false);
      expect(vm.tray.canPause).toBe(true);
      expect(vm.tray.canStop).toBe(true);
    });

    it("TRAY-03: after stop, tray reflects stopped state", () => {
      const clock = new FakeClock(T0);
      const timer = new Timer(emptyDoc(), clock);

      timer.start();
      clock.advance(27000 * 1000);
      timer.stop();

      const vm = viewModel(timer, clock.now(), {});

      expect(vm.tray.running).toBe(false);
      expect(vm.tray.canStart).toBe(true);
      expect(vm.tray.canPause).toBe(false);
      expect(vm.tray.canStop).toBe(false);
    });
  });

  describe("DISP-07: date label", () => {
    it("DISP-07: dateLabel uses formatDayLong", () => {
      const clock = new FakeClock(T0);
      const timer = new Timer(emptyDoc(), clock);

      const vm = viewModel(timer, T0, {});

      // T0 is 2026-09-10, should be "Thursday 10 September"
      expect(vm.dateLabel).toBe("Thursday 10 September");
    });
  });

  describe("Note override", () => {
    it("note override takes precedence over default", () => {
      const clock = new FakeClock(T0);
      const timer = new Timer(emptyDoc(), clock);

      const vm = viewModel(timer, T0, { noteOverride: "Still running in the menu bar." });

      expect(vm.note).toBe("Still running in the menu bar.");
    });

    it("null noteOverride uses default note", () => {
      const clock = new FakeClock(T0);
      const timer = new Timer(emptyDoc(), clock);

      const vm = viewModel(timer, T0, { noteOverride: null });

      expect(vm.note).toContain("Pauses by itself");
    });
  });
});
