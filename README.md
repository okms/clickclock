# Consultant Timer

A personal, local-only daily work timer. It counts while you work, pauses itself when you
walk away, and shows today's total the two ways timesheets want it: `7.50` and `07:30`.
It lives in the menu bar or system tray and never talks to a network.

This is a from-scratch re-implementation of the idea behind
[sirarsalih/consultant-timer](https://github.com/sirarsalih/consultant-timer) (MIT),
built from a written specification rather than from its code.

## Where things are

| | |
|---|---|
| What it does | `docs/spec/` (start at `00-overview.md`) |
| How it is built and why | `docs/design/architecture.md`, `docs/design/decisions/` |
| How it looks | `docs/design/ui.md` and `design/prototype.html` |
| Plan and progress | `docs/plan/milestones.md` |
| Rules for agents working here | `AGENTS.md` |

## Layout

```
core/        pure TypeScript timer logic, unit-tested with a fake clock
app/         the main view (vanilla TypeScript + CSS, Vite) and the Platform adapters
src-tauri/   the Tauri 2 desktop shell: window, tray, idle time, file storage
design/      UI prototype and icon source
docs/        specification, architecture, plan
```

## Develop

Requirements: Node 20+ with `pnpm`, and Rust (`brew install rust` on macOS) for the shell.

```sh
pnpm install
pnpm test          # core and app unit tests (run with TZ=Europe/Oslo)
pnpm typecheck
pnpm dev           # the UI alone in a browser, with a simulated idle control
pnpm tauri dev     # the real app
pnpm tauri build   # a bundle under src-tauri/target/release/bundle/
```

## Running an unsigned build

The app is not code-signed. On macOS, the first launch may be blocked by Gatekeeper:
right-click the app, choose Open, then confirm. On Windows, SmartScreen may show
"Unknown publisher": choose More info, then Run anyway. Neither warning means the app uses
the network; it does not.

## Data

One file in your per-user application data directory, `consultant-timer.json`. It is plain
JSON you can read, back up, or edit. Nothing is sent anywhere.

## Licence

MIT. See `LICENSE`.
