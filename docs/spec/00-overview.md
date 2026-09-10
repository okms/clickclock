# Consultant Timer: feature specification

## Purpose

Consultant Timer answers one question for one person, many times a day:
**how much have I worked today?**

It is a personal daily work timer. The user starts it in the morning, it counts while they
work, pauses itself when they walk away, and shows the total in the two formats consultants
actually type into timesheets: decimal hours (`7.50`) and hours and minutes (`07:30`).

It is deliberately not a timesheet, project tracker, or invoicing tool.

## Provenance

This specification was derived by reviewing the behaviour of the original
[Consultant Timer](https://github.com/sirarsalih/consultant-timer) by Sirar Salih
(MIT, reviewed at commit `703e90c`, 2026-09-09). Requirements that describe that
behaviour carry status **Baseline**. Everything else is new and carries status
**Proposed** until accepted.

The specification describes *what* the product does, never *how*. Words like "window",
"button", and "tray" are used in their everyday sense and do not prescribe technology.

## Scope

In scope: a single user, a single computer, a single running total per calendar day, and
the mechanics of keeping that total honest.

Out of scope is listed in `99-out-of-scope.md` and is binding.

## How to read the requirements

Each requirement has:

- an **ID** such as `TT-03`: a two-to-five letter area prefix and a two-digit number.
  IDs are never reused or renumbered. A withdrawn requirement keeps its ID with status
  `Withdrawn`.
- a **status**:
  - `Baseline`: behaviour of the original product, kept.
  - `Proposed`: suggested for this rewrite, not yet approved. Not to be implemented.
  - `Accepted`: approved for implementation.
  - `Deferred`: approved in principle, explicitly not now.
  - `Withdrawn`: no longer wanted.
- a **statement** using *must* (mandatory), *should* (strong default), or *may* (optional).
- optionally a **rationale** and **acceptance notes**.

## Areas

| Prefix | Area | File |
|---|---|---|
| `TT` | Time tracking | `01-time-tracking.md` |
| `DISP` | Time display | `02-time-display.md` |
| `IDLE` | Idle and absence detection | `03-idle-detection.md` |
| `PERS` | Persistence | `04-persistence.md` |
| `AUTO` | Start with the computer | `05-autostart.md` |
| `TRAY` | Background presence | `06-background-presence.md` |
| `HIST` | History | `07-history.md` |
| `SET` | Settings | `08-settings.md` |
| `NF` | Non-functional | `09-non-functional.md` |
| | Out of scope | `99-out-of-scope.md` |

## Vocabulary

- **Day**: a calendar date in the computer's local time zone. The day changes at local
  midnight.
- **Today's total**: the amount of worked time recorded for the current day.
- **Tracking states**: exactly one of
  - **Running**: time is being counted towards today's total.
  - **Paused**: time is not being counted; today's total is kept. A pause is either
    **manual** (the user asked for it) or **automatic** (the product detected absence).
  - **Stopped**: time is not being counted and today's total is zero.
- **Idle**: the user has produced no keyboard or pointer input on the computer for a
  period of time.
- **Idle threshold**: the idle duration after which the product treats the user as absent.

## Decision log

- 2026-09-10: Owner granted full autonomy on technical and design decisions within this
  specification. The first version implements every `Baseline` and `Accepted` requirement.
  Accepted for v1: TT-05, TT-13, DISP-07, DISP-08, IDLE-07, IDLE-08, PERS-05, PERS-06,
  TRAY-06, TRAY-07, HIST-01..03, SET-01, SET-02, SET-04, NF-05..07. Deferred: TT-12,
  TRAY-05, HIST-04, HIST-05, PERS-07.
