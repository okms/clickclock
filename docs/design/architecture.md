# Architecture

How Consultant Timer is built, why, and what could go wrong. The feature set is defined in
`../spec/`; this document never redefines behaviour, it only decides how to deliver it.

Decisions are recorded as ADRs in `decisions/`. This document is the readable summary.

---

## 1. Goals for the implementation

Derived from the brief ("a more flexible and feasible way to implement this, as a personal
tool") and the spec's non-functional requirements:

1. **Feasible with cheap agents.** Most code should be in a language and shape that small
   models write reliably and that can be unit-tested without a display: plain TypeScript.
   Native or OS-specific code is kept to a small, fixed surface.
2. **Flexible.** Adding history, a configurable threshold, or manual adjustments must not
   require touching OS code. Swapping the desktop shell must not require touching the
   timer logic.
3. **Honest time.** The timer logic must be deterministic and testable with a fake clock,
   because the hard bugs (midnight, sleep, idle removal) are all about time.
4. **Local-only, small, quiet.** `NF-01`, `NF-02`, `NF-07`.
5. **Cross-platform enough.** macOS and Windows (`NF-05`). The owner works on macOS; the
   original ran on Windows.

---

## 2. Options considered

| | A. Native per platform (Win32/Go, Swift) | B. Electron | C. Tauri 2 | D. Wails (Go) | E. Browser/PWA |
|---|---|---|---|---|---|
| OS idle time | Manual per platform | Built in (`powerMonitor`) | Small crate, 3 platforms | Manual per platform | **Impossible** |
| Tray + menu | Manual | Built in | Built in | v3 only (alpha) | Impossible |
| Launch at login | Manual | Built in | Official plugin | Manual | Impossible |
| Single instance | Manual | Built in | Official plugin | Manual | n/a |
| Installed size | ~2–10 MB | ~200 MB | ~10 MB | ~10 MB | 0 |
| Idle RAM | ~10 MB | ~100–150 MB | ~40–70 MB | ~40–70 MB | n/a |
| Toolchain present here | No | **Yes** (Node) | Needs Rust (one install) | Needs Go | Yes |
| Cheap-agent fluency | Low | **High** | High for the TS side, medium for the Rust side | Medium | High |
| Testability of timer logic | Low | High (TS) | High (TS) | Medium | High |
| Fits `NF-07` footprint | Yes | No | Yes | Yes | n/a |

E is out immediately: a web page cannot see system idle time or live in the tray, and
those are the product. A is what the original did; it is small and fast but every feature
is OS code, which is exactly what cheap agents get wrong and what makes the tool
inflexible. D has the weakest tray story. That leaves B and C.

**B (Electron)** is the most *feasible*: every OS capability the spec needs is a
first-party API, the toolchain is already installed, and small models know it cold. Its
cost is footprint: ~200 MB on disk and ~100 MB+ resident for a tool whose predecessor was
2 MB.

**C (Tauri 2)** hits the footprint target, has official plugins for autostart and
single-instance, a built-in tray, and needs one third-party crate for idle time. Its cost
is a Rust toolchain and a small amount of Rust that cheap agents write less reliably.

### Decision

**Tauri 2 shell around a pure TypeScript core** (ADR-0001, ADR-0002), designed so that
Electron can replace the shell by writing one adapter file if Rust ever becomes a blocker.
The Rust surface is deliberately kept under ~150 lines and is fully specified in this
document so it is a transcription task, not a design task.

---

## 3. Structure

```
core/          pure TypeScript, zero dependencies, no DOM, no OS
  timer.ts       state machine: Stopped/Paused/Running, idle removal, gap handling, rollover
  format.ts      decimal hours, HH:MM, week grouping
  store.ts       document schema, migrations, total derivation
  ports.ts       interfaces the core needs: Clock, IdleSource, Storage
  *.test.ts      unit tests with a fake clock; every test is named after a spec ID

app/           the main view; vanilla TypeScript + CSS, built with Vite
  index.html
  styles.css     tokens and components from docs/design/ui.md
  main.ts        wires Platform + core + view
  view/          small render functions, no framework
  platform/
    platform.ts  the Platform interface (idle, storage, autostart, tray, clipboard, lifecycle)
    mock.ts      browser implementation with fake idle and localStorage; runs with `vite dev`
    tauri.ts     real implementation over Tauri commands and events

src-tauri/     Rust shell, small and fixed
  src/main.rs    window, tray, plugins, four commands (see 3.4)
  tauri.conf.json
  icons/
```

### 3.1 Core: the timer as a pure function of time

The core never reads the clock or the OS itself. It is driven:

```ts
interface Clock      { now(): number }                     // epoch ms
interface IdleSource { idleSeconds(): Promise<number> }
interface Storage    { load(): Promise<Doc|null>; save(doc: Doc): Promise<void> }
```

`Timer` exposes `start()`, `pause()`, `stop()`, `adjust(seconds)`, and `tick()`. The shell
calls `tick()` once a second with nothing else; the core reads `clock.now()` and
`idle.idleSeconds()` and decides what happened, including:

- **Rollover** (`TT-10`): if the local date of `now` differs from the active period's date,
  the active period is closed at 23:59:59.999 local of the old day and a new one opened at
  00:00 of the new day.
- **Gap** (`TT-11`): if `now - lastTick` exceeds the idle threshold, the active period is
  closed at `lastTick` and the state becomes `Paused(auto)`. Auto-resume rules then apply.
- **Idle** (`IDLE-02`, `IDLE-03`): if Running and idle ≥ threshold, the active period is
  closed at `now - idle` (clamped to its own start) and the state becomes `Paused(auto,
  idleMinutes)`.
- **Auto-resume** (`IDLE-05`): if `Paused(auto)` and idle < 2 s and auto-resume is on,
  a new period opens at `now`.

Because everything is derived from timestamps, a throttled or delayed `tick()` cannot make
the total wrong; it can only make the display late.

### 3.2 Data model (ADR-0003)

One JSON file, `consultant-timer.json`, in the per-user app data directory:

```json
{
  "version": 1,
  "settings": { "idleThresholdMinutes": 5, "autoResume": true, "launchAtLogin": true },
  "days": {
    "2026-09-10": {
      "periods": [ { "start": 1757484131000, "end": 1757489400000 } ],
      "adjustmentSeconds": 0
    }
  },
  "active": { "dayKey": "2026-09-10", "start": 1757490000000, "lastSeen": 1757490030000 }
}
```

- Timestamps are epoch milliseconds (unambiguous across DST and time zones). Day keys are
  local dates (`YYYY-MM-DD`) computed at the time of the event.
- A day's total = Σ(end − start) + `adjustmentSeconds`·1000 + (if `active` is for that
  day: `now − active.start`).
- `active.lastSeen` is a heartbeat written on every save. On launch, if `active` exists,
  the product was Running when it died: the period is closed at `lastSeen` and the state is
  `Paused` (`TT-08`, `TT-11`, `PERS-04`).
- Saving: on every state transition and every 30 s while Running. Writes go to a
  temporary file then rename over the old one (`PERS-04`).
- `version` enables migrations. Importing the original product's `history.json` (`PERS-07`,
  deferred) is a one-function migration: each `days[date]` float becomes one synthetic
  period.

### 3.3 App: a thin view

No UI framework. The state is a single object; `render(state)` updates a handful of DOM
nodes. The design system lives in `styles.css` and is specified in `ui.md`. The mock
platform lets the whole app run in a browser with `vite dev`, with an on-screen "simulate
idle" control, so UI work never needs Rust and can be done by the cheapest agent.

### 3.4 Shell: the fixed Rust surface

`src-tauri/src/main.rs` does exactly this and nothing more:

1. Registers `tauri-plugin-autostart` and `tauri-plugin-single-instance` (the latter
   focuses the existing window on a second launch).
2. Builds the tray icon (a dedicated monochrome, transparent template image,
   `src-tauri/icons/tray@2x.png`; the opaque app icon would flatten to a disc in the macOS
   menu bar) with menu items Start, Pause, Stop / Clear today, Show, Quit. Menu
   clicks emit a `tray-action` event with the item id to the webview. Tray icon
   double-click (or left-click on macOS) shows and focuses the window.
3. Exposes four commands:
   - `idle_seconds() -> f64` via the `user-idle` crate.
   - `read_doc() -> Option<String>` and `write_doc(json: String)` with temp-file + rename,
     in `app_data_dir()`.
   - `set_tray(state: String, tooltip: String, can_start: bool, can_pause: bool,
     can_stop: bool)` to update tooltip, item enabled flags, and (later, `TRAY-05`) the
     icon variant.
4. Window: fixed initial size 380×520, resizable within limits, not maximisable. Close
   behaviour follows the spec: `TRAY-06` is Proposed, so until it is accepted the window's
   close button quits (matching Baseline).

The webview runs under a strict Content Security Policy (`default-src 'self'`, IPC only in
`connect-src`), so the app cannot reach the network even by accident; fonts and all assets
are bundled (`NF-01`).

Autostart state is read and written by the webview via the plugin's JS binding.
Clipboard uses the browser `navigator.clipboard` API inside the webview (no plugin).

---

## 4. Critical review of this approach

Written before any code exists so that the risks are on record.

### 4.1 Risks and mitigations

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R1 | Rust toolchain is not installed on the owner's machine; first build is slow (several minutes) and cheap agents may thrash on compiler errors. | Certain (toolchain) / Medium (thrash) | Medium | One-time `rustup` install is a milestone-0 task. The Rust file is fully specified above; AGENTS.md escalates Rust work to `sonnet` after two Haiku failures. If it still blocks, ADR-0002 names Electron as the fallback: same core, same app, one new `platform/electron.ts` plus a ~60-line main process. |
| R2 | `user-idle` crate is third-party; could lag Tauri or OS releases. | Low | High (it *is* the feature) | It wraps three stable OS calls (`GetLastInputInfo`, `CGEventSourceSecondsSinceLastEventType`, XScreenSaver). If it breaks, the same three calls fit in ~40 lines of Rust with `windows-sys` and `core-graphics`. Verified as a milestone-0 spike before anything else is built. |
| R3 | Webview timers throttle when the window is hidden, so `tick()` runs late. | High on macOS | Low | Totals derive from timestamps, never from tick counts (3.1). Late ticks delay auto-pause detection, but `IDLE-03` removes the measured idle time anyway, so the total stays correct. |
| R4 | If the window is *destroyed* rather than hidden, the webview and the timer die with it. | Medium | High | The shell never destroys the window except on Quit. Until `TRAY-06` is accepted, close means quit (Baseline), which is at least explicit. Recommend accepting `TRAY-06`. |
| R5 | Sleep/wake: no reliable suspend event reaches the webview. | High | Medium | Not needed: the gap rule (`TT-11`) detects the sleep from the tick timestamps. Idle time reported by the OS after wake is also large, which triggers the same path. |
| R6 | Autostart in development mode points at the dev binary, not the bundled app. | Certain in dev | Low | Only test `AUTO-*` against a bundled build; say so in the milestone. |
| R7 | Unsigned app: Gatekeeper on macOS and SmartScreen on Windows warn on first launch. | Certain | Low for a personal tool | Document the right-click-open / "more info" path in README. Ad-hoc signing on macOS removes the worst of it. Same situation as the original. |
| R8 | Two sources of truth for tray state (Rust menu vs. TS state). | Medium | Low | Rust holds no state. Every TS state change calls `set_tray`; Rust only renders what it is told. |
| R9 | Local date logic (rollover, week grouping) is easy to get wrong across DST. | Medium | Medium | All date math lives in `core/format.ts` and `core/timer.ts` with fake-clock tests around DST transitions and midnight. Timestamps stored as epoch ms. |
| R10 | Concurrent writers to the JSON file (two instances). | Low | High | `tauri-plugin-single-instance` (`TRAY-07`, Proposed but cheap; recommend accepting). Atomic rename means the worst case is a lost heartbeat, not a corrupt file. |

### 4.2 What this approach gives up

- **Size versus the original.** ~10 MB and ~50 MB RAM instead of 2 MB and ~10 MB. Within
  `NF-07`. Accepted.
- **Two languages.** A small amount of Rust in a mostly TypeScript project. Bounded by
  design (3.4).
- **Timer logic runs in a webview**, not in the native process. Robust because of 3.1, but
  if it ever proves flaky the escape hatch is to port `core/timer.ts` to Rust behind the
  same `Platform` interface; the tests transfer as fixtures. That would be a new ADR.

### 4.3 What it makes easy

- History (`HIST`): the data is already per-period; the view is a list.
- Configurable threshold and auto-resume (`SET`): settings already in the document.
- Manual adjustments (`TT-12`): one field per day, already in the schema.
- Import of the original's data (`PERS-07`): a pure function over JSON.
- Running the UI in a browser for design and review with no native build at all.
- Replacing the shell (Electron, or a native Swift menu-bar app later) without touching the
  timer.

### 4.4 Review verdict

Feasible. The riskiest assumptions (R1, R2) are cheap to verify and are the first two
tasks in `../plan/milestones.md`. Recommend accepting `TRAY-06` and `TRAY-07` before
milestone 2 because they remove the two behaviours most likely to lose a day's time.
