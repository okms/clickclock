# ClickClock: feature specification

## Purpose

ClickClock answers one question for one person, many times a day:
**how much have I worked today?**

It is a personal daily work timer. The user starts it in the morning, it counts while they
work, pauses itself when they walk away, and shows the total in the two formats consultants
actually type into timesheets: decimal hours (`7.50`) and hours and minutes (`07:30`).

It is deliberately not a timesheet, project tracker, or invoicing tool.

## Provenance

The baseline feature set was written down by observing a simple Windows-only daily timer
the owner had been using before this project. ClickClock is an independent product with its
own code, design and name and is not affiliated with that tool. Requirements that describe
the observed baseline behaviour carry status **Baseline**. Everything else is new and carries
status **Proposed** until accepted.

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
  - `Baseline`: behaviour of the baseline, kept.
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
| `UPD` | Checking for updates | `10-updates.md` |
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
- 2026-09-10: Owner asked for the tray to show elapsed time and for left click to toggle
  tracking. Added TRAY-08..11 and SET-06 (Accepted); withdrew TRAY-04 and TRAY-05. Planner's
  choices, easy to flip: the tray text is decimal hours; the state glyph sits beside the digits
  (owner's correction: overlaying it made the text unreadable) at about half opacity; Windows falls back to the icon because its tray items are
  fixed squares.
- 2026-09-10: Owner asked for an in-app "check for updates". Added `UPD-01..04` (Accepted),
  `UPD-05` (Deferred) and narrowed `NF-01`: the check is manual only and is the single
  network access the product has. Planner's choice: the request resolves the project's
  releases/latest page redirect rather than calling an API, so no keys or rate limits.
- 2026-09-10: Owner's review: decimal hours as the primary figure read badly ("what does
  0.19 hours mean?"). DISP-02 revised: hours and minutes (`H:MM`) are primary in the main
  view and the tray; decimal hours are the secondary, timesheet value. DISP-03 drops the
  leading zero on hours.
