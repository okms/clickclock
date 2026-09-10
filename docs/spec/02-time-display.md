# DISP: Time display

## Requirements

### DISP-01 Two formats shown at once — Baseline
Today's total must be shown simultaneously as:

- **decimal hours** with exactly two decimals, for example `7.50`, and
- **hours and minutes** as zero-padded `HH:MM`, for example `07:30`.

Both refer to the same underlying total.

### DISP-02 Decimal hours are primary — Baseline
The decimal-hours figure is the primary figure and must be the most prominent element of
the main view. `HH:MM` is secondary.

*Rationale.* Consultants enter decimal hours into timesheets; `HH:MM` is the sanity check.

### DISP-03 Rounding rules — Baseline
- Decimal hours: total seconds ÷ 3600, rounded half-up to two decimals.
- `HH:MM`: whole minutes, truncated (never rounded up). Hours are not capped at 24 but are
  not expected to exceed it.

### DISP-04 Live update — Baseline
While Running, the displayed figures must update at least once per second so the user can
see the timer is alive.

### DISP-05 Copyable figures — Baseline
The user must be able to select and copy each displayed figure as plain text (`7.50`,
`07:30`) so it can be pasted into a timesheet.

### DISP-06 State is always visible — Baseline
The main view must show the current tracking state in words: Running, Paused, or Stopped.
For a Paused state the view must also say *why* when the pause was automatic, including
how long the user had been idle (`IDLE-04`).

### DISP-07 The date is visible — Proposed
The main view should show which day the total belongs to, so the user is never in doubt
after a midnight rollover or a laptop left open overnight.

### DISP-08 Quick copy — Proposed
The product may offer a one-action way to copy the decimal-hours figure to the clipboard.
