# ADR-0002: Tauri 2 as the desktop shell, Electron as the named fallback

- Status: Accepted
- Date: 2026-09-10

## Context

See `../architecture.md` §2 for the comparison. The spec requires system idle time, a tray
presence, launch at login, and local-only operation, in a lightweight package
(`NF-02`, `NF-07`) on macOS and Windows (`NF-05`).

## Decision

Use **Tauri 2** with:

- `tauri-plugin-autostart` for `AUTO-*`
- `tauri-plugin-single-instance` for `TRAY-07` (when accepted)
- built-in tray icon and menu for `TRAY-*`
- the `user-idle` crate for `IDLE-01`, exposed as one command
- two file commands (`read_doc`, `write_doc` with temp-file + rename) for `PERS-04`

The Rust code is limited to the surface in `architecture.md` §3.4 and is treated as fixed
infrastructure, not a place where features live.

**Fallback.** If the Rust toolchain or Tauri proves to be a blocker, switch to Electron:
same `core/`, same `app/`, a new `platform/electron.ts`, and a small main process using
`powerMonitor.getSystemIdleTime`, `Tray`, `app.setLoginItemSettings`, and
`requestSingleInstanceLock`. That switch would be recorded as a new ADR superseding this one.

## Consequences

- Rust toolchain needed on the build machine (one-time install).
- ~10 MB bundle, ~50 MB RAM, within `NF-07`.
- One third-party crate on the critical path (`user-idle`); mitigated by a spike task and a
  documented 40-line replacement.
- Cheap agents do TypeScript; Rust changes escalate per `AGENTS.md`.
