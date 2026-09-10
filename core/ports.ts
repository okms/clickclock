/**
 * Ports the core depends on. The core never touches the clock, the OS, or storage
 * directly; the shell supplies these. See docs/design/architecture.md §3.1 and ADR-0001.
 */

/** Wall-clock time in epoch milliseconds. */
export interface Clock {
  now(): number;
}

/** Deterministic clock for tests. */
export class FakeClock implements Clock {
  constructor(private t: number) {}
  now(): number {
    return this.t;
  }
  /** Move time forward by `ms`. */
  advance(ms: number): void {
    this.t += ms;
  }
  set(ms: number): void {
    this.t = ms;
  }
}

export const systemClock: Clock = { now: () => Date.now() };
