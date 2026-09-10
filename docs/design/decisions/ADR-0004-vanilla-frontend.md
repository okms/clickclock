# ADR-0004: Vanilla TypeScript and CSS for the view, built with Vite

- Status: Accepted
- Date: 2026-09-10

## Context

The main view has one screen with a large number, two buttons, a status line, and (when
accepted) a short history list and three settings. The whole UI state is one small object.

## Decision

No UI framework. Vanilla TypeScript with small render functions over a fixed DOM, CSS with
custom properties for the design tokens in `../ui.md`, Vite for dev server and bundling.
`design/prototype.html` at the repository root is the visual reference and is kept in sync
with the app's tokens.

## Consequences

- Nothing to learn, nothing to upgrade, tiny bundle.
- Cheap agents handle it well; the failure mode of frameworks (state sync bugs) is avoided
  by having one `render(state)` function.
- If the UI ever grows past a few screens this decision should be revisited with a new ADR.
