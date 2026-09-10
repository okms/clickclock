# DISP: Time display

## Requirements

### DISP-01 Two formats shown at once — Baseline
Today's total must be shown simultaneously as:

- **hours and minutes** as `H:MM`, for example `7:30` or `0:10`, and
- **decimal hours** with exactly two decimals, for example `7.50`.

Both refer to the same underlying total.

### DISP-02 Hours and minutes are primary — Accepted
The hours-and-minutes figure is the primary figure and must be the most prominent element
of the main view. Decimal hours are secondary and labelled as the timesheet value.

*History.* The baseline made decimal hours primary. Revised 2026-09-10 by the owner: people
read time as hours and minutes; `0.18 hours` means nothing at a glance, `0:10` does.
Decimal hours stay visible because timesheets want them.

### DISP-03 Rounding rules — Baseline
- Decimal hours: total seconds ÷ 3600, rounded half-up to two decimals.
- `H:MM`: whole minutes, truncated (never rounded up); hours without a leading zero,
  minutes always two digits. Hours are not capped at 24 but are not expected to exceed it.

### DISP-04 Live update — Baseline
While Running, the displayed figures must update at least once per second so the user can
see the timer is alive.

### DISP-05 Copyable figures — Baseline
The user must be able to select and copy each displayed figure as plain text (`7:30`,
`7.50`) so it can be pasted into a timesheet.

### DISP-06 State is always visible — Baseline
The main view must show the current tracking state in words: Running, Paused, or Stopped.
For a Paused state the view must also say *why* when the pause was automatic, including
how long the user had been idle (`IDLE-04`).

### DISP-07 The date is visible — Accepted
The main view should show which day the total belongs to, so the user is never in doubt
after a midnight rollover or a laptop left open overnight.

### DISP-08 Quick copy — Accepted
Clicking either figure copies that figure's text to the clipboard.
