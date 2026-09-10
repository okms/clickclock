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

### TRAY-04 Open the main view from the tray — Baseline
Activating the tray icon (for example double-click, or the platform's primary activation)
must bring the main view to the front.

### TRAY-05 The icon reflects the state — Deferred
The tray icon should visibly differ between Running and not Running so the state can be
read without hovering.

### TRAY-06 Closing the main view keeps the product alive — Accepted
Closing the main view should hide it and leave the product running in the tray. Quitting
is an explicit action (`TRAY-03`). The product should say so the first time it happens.

*Rationale.* The baseline exits when its window is closed, which silently stops
tracking. For a tool that is supposed to run all day this is a trap.

### TRAY-07 Single instance — Accepted
Only one instance of the product may run per user at a time. Launching it again should
bring the existing main view to the front.
