# Manual checklist for a release candidate

Run against a bundled build (`pnpm tauri build`), not `tauri dev`, because launch-at-login
points at the built app. Tick, date, and note the build hash.

### Verified 2026-09-10 on the dev build (`ea9dfed`), macOS, by the planning session
Launch shows Stopped/`0.00`/`00:00` and Start (TT-08); date line in words (DISP-07);
Start ticks every second with Running and a green dot, Pause keeps the total, Start
resumes, the one control relabels (TT-01, TT-02, TT-03, DISP-04); several sessions sum
(TT-06, seen in the stored JSON); the JSON document is readable and matches (PERS-05);
threshold change to 1 minute persisted and reflected in the note (SET-01, IDLE-09);
tray icon visible as a clock glyph in the menu bar (TRAY-01); appearance follows the
system (SET-04, dark); after a shell restart while Running the app came back Paused with the
total kept (TT-08, PERS-01, PERS-04 recovery); filled Start button while Paused. Everything below is still to be run against the bundle.

## Launch and state
- [ ] TT-08 First launch shows Stopped, `0.00`, `00:00`; the primary control says Start.
- [ ] TT-08 Relaunch with a stored total shows Paused with that total; never Running.
- [ ] DISP-07 The date line shows today's date in words.

## Counting
- [ ] TT-01 Start: the figures tick every second; state row says Running with a green dot.
- [ ] TT-02 Pause: figures stop; state says Paused; Start resumes from the same total.
- [ ] TT-03 The one control reads Start when not Running and Pause when Running.
- [ ] TT-04/TT-05 Clear today asks for confirmation; Keep does nothing; Clear sets `0.00` and Stopped.
- [ ] TT-06 Several start/pause cycles add up.
- [ ] TT-13 Space or Enter on the focused primary control toggles it.
- [ ] DISP-05 Both figures can be selected and copied; DISP-08 clicking the figure copies `7.50` and shows "Copied".

## Idle
- [ ] IDLE-02/03 Set threshold 1 minute. Start, do not touch the computer for 65 s: it pauses, and the total is what it was when you stopped touching it.
- [ ] IDLE-04 The state row says "Away for 1 minute, paused by itself".
- [ ] IDLE-05 Move the mouse: it resumes by itself and briefly says "Resumed after being away".
- [ ] IDLE-06 Pause manually, wait, move the mouse: it stays Paused.
- [ ] IDLE-07 Turn off "Resume when I come back"; repeat the idle test: it stays Paused after you return.
- [ ] TT-11 Start, sleep the Mac for 3 minutes (threshold 1): on wake it is Paused and the total grew by at most 1 minute.

## Persistence
- [ ] PERS-01 Quit from the tray while Paused with a total; relaunch: same total.
- [ ] PERS-04 Force-quit while Running (Activity Monitor); relaunch: Paused, total within 30 s of what was shown.
- [ ] PERS-05 The JSON file in the app data directory is readable and matches the UI.

## Tray
- [ ] TRAY-01 Icon visible in the menu bar. TRAY-02 Tooltip shows state and both figures.
- [ ] TRAY-03 Menu shows Start, Pause, Stop / Clear today, Show, Quit with correct enabled states.
- [ ] TRAY-08 Left click on the tray item starts tracking; a second left click pauses it.
- [ ] TRAY-09 The menu bar shows today's decimal hours and updates while Running.
- [ ] TRAY-10 Turning "Show time in the menu bar" off shows the clock glyph instead; on restores the time.
- [ ] TRAY-11 Paused shows a translucent pause mark over the item; Stopped a square; Running none.
- [ ] TRAY-06 Close the window: the app keeps running; tray Show brings it back. First time, the note explains this.
- [ ] TRAY-07 Launch the app a second time: the existing window is focused, no second icon.

## Settings and autostart
- [ ] SET-01 Threshold options 1, 2, 3, 5, 10, 15, 20, 30; the note line reflects the choice.
- [ ] AUTO-01/04 Toggle "Open at login" off and on; System Settings > General > Login Items reflects it.
- [ ] AUTO-02 A fresh install has it on.
- [ ] SET-04 Switch macOS appearance: the app follows.

## History
- [ ] HIST-01 Previous days list, most recent first, both figures.
- [ ] HIST-02 "This week" and "Week NN" totals are correct.
- [ ] HIST-03 Clicking a past day's decimal figure copies it.

## Non-functional
- [ ] NF-01 With Wi-Fi off everything works. Little Snitch / `lsof -i` shows no connections from the app.
- [ ] NF-02 Idle CPU under 1 % while Running (Activity Monitor).
- [ ] NF-07 Bundle size and memory noted: ____ MB / ____ MB.
