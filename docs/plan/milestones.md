# Milestones

Ordered. Each task is one subagent brief. Tick tasks as they land; reference the commit.
Model column is the default per `AGENTS.md`; escalate only as it allows.

## M0: Ground truth
- [x] M0.1 Repo, AGENTS.md, spec, architecture, ADRs, UI design and prototype (Fable) — `fe30800`..`f5eb2a9`
- [x] M0.2 Rust toolchain on the build machine (`brew install rust`) — done 2026-09-10
- [x] M0.3 Project scaffold: package.json, tsconfig, vite, vitest, `core/ports.ts`, `core/types.ts` (Fable; critical-path contracts)

## M1: Core (pure TypeScript, red-green, fake clock)
- [x] M1.1 `core/format.ts`: decimal hours, HH:MM, local day keys, day and week labels, ISO week grouping — DISP-01, DISP-03, DISP-07, HIST-02 — haiku — `47376ec`
- [x] M1.2 `core/store.ts`: empty doc, `migrate` from unknown JSON, total per day, history rows, recovery of a dangling active period at launch — PERS-01, PERS-02, PERS-05, PERS-06, TT-08, TT-11, HIST-01, HIST-02, SET-05 — haiku — `da38f34`
- [x] M1.3 `core/timer.ts`: the state machine — TT-01..TT-04, TT-06..TT-11, IDLE-02..IDLE-06, IDLE-07 — sonnet (time logic is the product's main risk) — `df69afe`

## M2: App (browser-runnable via the mock platform)
- [x] M2.1 `app/platform/platform.ts` interface + `app/platform/mock.ts` (localStorage, simulated idle control) — haiku — `9ff91f7`
- [x] M2.2 `app/index.html`, `app/styles.css`, `app/view/*`, `app/main.ts`: port `design/prototype.html` to the real app over the core; wires save cadence (transition + 30 s heartbeat) — DISP-*, TT-03, TT-05, TT-13, IDLE-04, IDLE-09, HIST-*, SET-*, NF-06 — haiku
- [x] M2.3 View tests for formatting/state mapping that do not need a browser — haiku (in model.test.ts)

## M3: Shell (Tauri 2)
- [x] M3.1 `src-tauri/` scaffold with the four commands, tray, autostart and single-instance plugins, close-hides-window — TRAY-01..04, TRAY-06, TRAY-07, AUTO-*, PERS-03, PERS-04 — sonnet — `b2502eb`
- [x] M3.2 `app/platform/tauri.ts` adapter — sonnet
- [x] M3.3 Spike: `idle_seconds` returns sane values on macOS (manual check) — sonnet (user-idle 0.5 compiles and returns via idle_seconds; value checked in M4.1)

## M4: First version for review
- [x] M4.1 `pnpm tauri build` produces a runnable app bundle; manual checklist in `docs/plan/manual-checklist.md` executed — bundle built 2026-09-10: `Consultant Timer.app` 10 MB, dmg 3.0 MB (aarch64). Checklist: see `manual-checklist.md` for what was verified and what remains.
- [x] M4.2 README updated with build/run instructions and the Gatekeeper note — `README.md`
- [x] M4.3 Spec statuses reviewed; anything not implemented is reflected in the plan — all Baseline and Accepted requirements have an implementation; TT-12, TRAY-05, HIST-04, HIST-05, PERS-07 remain Deferred

## Open items after v1 (for the owner's review)
- Windows build untested (NF-05); the code paths exist (user-idle, autostart plugin) but no Windows machine was available.
- Manual checklist items not yet run: tray menu actions, close-to-tray notice, second-instance focus, launch-at-login in System Settings, sleep/wake gap, idle auto-pause and auto-resume against a real idle period. See `manual-checklist.md`.
- Filled primary button in the Paused/Stopped state was verified in Chrome (mock build) but not yet seen in the Tauri window after the native-appearance reset landed.
