# ClickClock

A personal, local-only daily work timer. It counts while you work, pauses itself when you
walk away, and shows today's total the two ways timesheets want it: `7.50` and `07:30`.
It lives in the menu bar or system tray and never talks to a network.

## Install

Download the latest release from this repository's Releases page.

- **macOS** (Apple Silicon `aarch64` or Intel `x64`): open the `.dmg` and drag ClickClock to
  Applications. The app is ad-hoc signed but not notarized with an Apple Developer ID, so
  the first launch is blocked with "Apple could not verify ClickClock is free of malware".
  Click Done, open System Settings, go to Privacy & Security, scroll to the Security section
  and click **Open Anyway**, then confirm. Alternatively, once, in Terminal:

  ```sh
  xattr -d com.apple.quarantine /Applications/ClickClock.app
  ```

  If macOS instead says the app "is damaged", you have a build older than v0.1.1; download
  the current release.
- **Windows** (`x64`): run the `.msi` or the `-setup.exe` installer. SmartScreen may show
  "Unknown publisher": choose More info, then Run anyway.

Neither warning means the app uses the network. It does not. Removing the warnings for good
needs an Apple Developer ID (signing and notarization) and a Windows code-signing
certificate; neither is configured.

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
.github/     CI on every push; a release build for macOS and Windows on every v* tag
```

## Develop

Requirements: Node 20+ with `pnpm`, and Rust (`brew install rust` on macOS, or rustup)
for the shell.

```sh
pnpm install
pnpm test          # core and app unit tests (run with TZ=Europe/Oslo)
pnpm typecheck
pnpm dev           # the UI alone in a browser, with a simulated idle control
pnpm tauri dev     # the real app
pnpm tauri build   # a bundle under src-tauri/target/release/bundle/
```

## Release

Bump `version` in `package.json`, `src-tauri/tauri.conf.json` and `src-tauri/Cargo.toml`,
commit, then:

```sh
git tag v0.2.0
git push origin main --tags
```

The release workflow builds macOS (arm64, x64) and Windows (x64) bundles and publishes
them on a GitHub Release named after the tag.

## Data

One file in your per-user application data directory, `clickclock.json`. It is plain
JSON you can read, back up, or edit. Nothing is sent anywhere.

## Licence

MIT. See `LICENSE`.
