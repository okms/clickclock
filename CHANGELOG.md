# Changelog

All notable changes to ClickClock are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow semantic
versioning. The section for a tag becomes that GitHub Release's notes, and the release
workflow refuses to publish a tag that has no section here.

## [Unreleased]

## [0.3.1] - 2026-09-10

### Fixed
- The small "hours" timesheet line under the main figure is left-aligned again; it had
  centred itself after becoming clickable.

## [0.3.0] - 2026-09-10

### Changed
- Hours and minutes are now the primary figure everywhere: the main view shows `0:12`
  large, with `0.21 hours` beneath it as the timesheet value; the menu bar shows `0:12`;
  history lists hours and minutes first. Hours no longer carry a leading zero.
- Clicking either figure copies that figure's own text.

### Added
- Check for updates, in Settings under the installed version. It runs only when you click
  it, makes one request to this project's release page, and offers to open the download
  page when a newer version exists. Nothing else in the app touches the network.

## [0.2.1] - 2026-09-10

### Fixed
- The menu bar total kept freezing when the window was closed to the tray. The
  once-per-second tick is now driven from the native side instead of a page timer, and
  the app opts out of App Nap. Totals were never wrong; only the display stalled.

## [0.2.0] - 2026-09-10

### Added
- The menu bar item shows today's total instead of a fixed icon, with a small pause mark
  beside it when paused and a square when stopped.
- Left-clicking the menu bar item starts or pauses tracking. Show and Quit remain in the
  right-click menu.
- Setting "Show time in the menu bar" (on by default); off shows the clock glyph instead.

### Changed
- The tray icon is a proper template image; it had rendered as a solid disc.

## [0.1.1] - 2026-09-10

### Fixed
- Downloaded macOS builds were reported as "damaged" by Gatekeeper because the bundle
  carried no signature. The bundle is now ad-hoc signed, which yields the normal
  "Open Anyway" path in System Settings instead.

## [0.1.0] - 2026-09-10

First version.

### Added
- One running total per day, with Start/Pause as a single control and Clear today with
  confirmation. Never starts counting on its own after launch.
- Automatic pause after five minutes without keyboard or mouse input, with the idle time
  removed from the total, and automatic resume when you return (both configurable).
- Sleep and midnight handled: suspended time is not counted; the day rolls over at local
  midnight.
- Time shown as decimal hours and hours:minutes, both copyable.
- History of previous days grouped by week, with weekly totals.
- Settings: idle threshold, auto-resume, open at login. Appearance follows the system.
- Menu bar / tray presence with Start, Pause, Stop, Show and Quit; closing the window keeps
  the app running; one instance only.
- All data in one plain JSON file on this computer; no network access.
- Builds for macOS (Apple Silicon and Intel) and Windows (x64).

[Unreleased]: https://github.com/okms/clickclock/compare/v0.3.1...HEAD
[0.3.1]: https://github.com/okms/clickclock/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/okms/clickclock/compare/v0.2.1...v0.3.0
[0.2.1]: https://github.com/okms/clickclock/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/okms/clickclock/compare/v0.1.1...v0.2.0
[0.1.1]: https://github.com/okms/clickclock/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/okms/clickclock/releases/tag/v0.1.0
