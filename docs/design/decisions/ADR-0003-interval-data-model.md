# ADR-0003: Per-period data model in one human-readable JSON file with atomic writes

- Status: Accepted
- Date: 2026-09-10

## Context

The baseline timer stored one floating-point number of seconds per day. That makes history,
corrections, and audit impossible and forces the timer to mutate a running sum every
second. Spec requirements `PERS-04`, `PERS-05`, `PERS-06`, `TT-11`, `TT-12`, and the whole
`HIST` area want more.

## Decision

Store a single JSON document (`clickclock.json`) in the per-user app data directory:

- `settings`
- `days[YYYY-MM-DD] = { periods: [{start, end}], adjustmentSeconds }`
- `active = { dayKey, start, lastSeen } | null` for the currently running period

Timestamps are epoch milliseconds. Day keys are local dates. Totals are derived, never
stored. `active.lastSeen` is a heartbeat updated on every save (every 30 s while Running
and on every transition). Writes are temp-file + rename.

Schema carries `version: 1`; migrations are pure functions `Doc(n) -> Doc(n+1)`.

## Consequences

- History, weekly totals, and adjustments are queries over existing data.
- Crash recovery is deterministic: an `active` period found at launch is closed at
  `lastSeen`.
- The file is readable and hand-editable (`PERS-05`).
- Slightly more data than one float per day; negligible for one user.
- Importing the earlier timer's `history.json` is a one-function migration (deferred, `PERS-07`).
