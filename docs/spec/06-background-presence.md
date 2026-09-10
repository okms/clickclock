# TRAY: Background presence

The product is meant to run all day. It therefore has a presence outside its main view,
in the place the operating system reserves for long-running utilities (system tray, menu
bar, or equivalent). This document calls that place "the tray".

## Requirements

### TRAY-01 Always present while running — Baseline
While the product is running it must show an icon in the tray.

### TRAY-02 State and total at a glance — Baseline
Hovering or otherwise inspecting the tray icon must reveal the current state and today's
total in both formats without opening the main view.

### TRAY-03 Control from the tray — Baseline
The tray must offer these actions: **Start**, **Pause**, **Stop / Clear today**, **Show**
(bring up the main view), and **Quit**. Actions that do not apply in the current state are
shown as unavailable rather than hidden.

### TRAY-04 Open the main view from the tray — Withdrawn
Superseded by `TRAY-08`: the primary activation now toggles tracking. The main view is
opened from the tray menu (`TRAY-03`, Show).

### TRAY-05 The icon reflects the state — Withdrawn
Superseded by `TRAY-09`, `TRAY-10` and `TRAY-11`.

### TRAY-06 Closing the main view keeps the product alive — Accepted
Closing the main view should hide it and leave the product running in the tray. Quitting
is an explicit action (`TRAY-03`). The product should say so the first time it happens.

*Rationale.* The baseline exits when its window is closed, which silently stops
tracking. For a tool that is supposed to run all day this is a trap.

### TRAY-07 Single instance — Accepted
Only one instance of the product may run per user at a time. Launching it again should
bring the existing main view to the front.

### TRAY-08 Left click toggles tracking — Accepted
The tray icon's primary activation (left click) must start tracking when the product is
not Running and pause it when it is Running, exactly like the main control (`TT-03`).

### TRAY-09 The tray shows today's total — Accepted
By default the tray item must show today's total as text in hours and minutes (`7:30`, the
primary figure of `DISP-02`) instead of a fixed icon, updating live like the main view.

*Platform note.* This applies where the tray supports variable-width items (the macOS
menu bar). Where the tray is a fixed small square (Windows), the product shows the icon
(`TRAY-10` off behaviour) and the tooltip (`TRAY-02`) carries the time.

### TRAY-10 Time or icon is a setting — Accepted
A setting, on by default, chooses between showing the time (`TRAY-09`) and showing the
plain clock icon. See `SET-06`.

### TRAY-11 Paused and Stopped are marked on the tray item — Accepted
When Paused, a small pause glyph must mark the tray item; when Stopped, a stop glyph. When
the time is shown, the glyph sits **beside** the digits (to their right, with a small gap),
never over them, because overlaid marks make small tray text unreadable. In icon mode the
glyph is overlaid on the right side of the clock. The glyph is semi-transparent (about
half opacity). When Running there is no glyph.
