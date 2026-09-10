# ADR-0001: Pure TypeScript core, thin app, replaceable shell

- Status: Accepted
- Date: 2026-09-10

## Context

The product's difficult logic is about time: idle removal, sleep gaps, midnight rollover.
The product's OS-specific needs (idle time, tray, autostart) are small but platform-bound.
Implementation is to be done mostly by cheap agents, which are reliable with plain,
testable TypeScript and unreliable with OS APIs.

## Decision

Three layers with one-way dependencies:

1. `core/`: pure TypeScript, no dependencies, no DOM, no OS. Driven through injected
   `Clock`, `IdleSource`, and `Storage` ports. Fully unit-tested with a fake clock.
2. `app/`: the view and the `Platform` interface with two implementations, `mock`
   (browser) and the real shell adapter.
3. Shell: the smallest possible native host that satisfies the `Platform` interface.

The core computes totals from timestamps, never from tick counts.

## Consequences

- Timer correctness is testable without a display or a native build.
- UI work runs in a plain browser via the mock platform.
- Swapping the shell is one adapter file plus a small host; it does not touch the core.
- Cost: a little indirection (`Platform` interface) for a small app. Accepted.
