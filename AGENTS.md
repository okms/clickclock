# AGENTS.md

Operating manual for AI agents working in this repository. Humans should read it too.

ClickClock is a **personal, local-only daily work timer** for one consultant. It shows
today's worked time as decimal hours and hh:mm, pauses itself when the computer is idle,
and lives in the system tray. It is not a timesheet platform and it is never shared between
people. See `docs/spec/` for what it does and `docs/design/` for how we build it.

---

## 1. Who does what

There are two kinds of agent work here, and they are done by different models on purpose.

### Planning is done by Claude Fable 5.1 only

The following work is **always** performed by the orchestrating session running
**Claude Fable 5.1** (`claude-fable-5-1`) and is **never delegated** to a subagent:

- Reading and interpreting the specification.
- Writing or changing anything under `docs/spec/` and `docs/design/`.
- Architecture decisions (`docs/design/decisions/`).
- Decomposing work into tasks and writing subagent briefs.
- Reviewing every diff a subagent produces, against the spec, before it is committed.
- Committing to git.
- Deciding that something is "done".

If you are a subagent reading this: you implement the brief you were given. You do not
change the spec, the design docs, the architecture, or the task scope. If the brief is
wrong or impossible, stop and report why instead of improvising.

### Implementation is delegated to cheap, efficient subagents

Implementation, test writing, refactors, fixing lint or type errors, and mechanical
changes are delegated with the `Agent` tool. The orchestrator is allowed and **encouraged**
to do so; doing implementation work directly in the Fable session is the exception, not
the rule, and needs a one-line justification in the commit message body.

Model choice for subagents, in order of preference:

| Situation | Model |
|---|---|
| Default for any implementation task | `haiku` (Claude Haiku 4.5) |
| A Haiku attempt failed twice on the same brief, or the task touches concurrency, native/OS APIs, or Rust | `sonnet` (Claude Sonnet 5) |
| Never for implementation | `opus`, `fable` |

Rules for keeping subagents cheap:

- **One brief, one task.** A brief touches one milestone task from `docs/plan/milestones.md`
  and should be finishable in a single agent run. If you cannot write the acceptance
  criteria in five lines, the task is too big; split it.
- **Point at files, don't describe the repo.** List the exact files to read and the exact
  files allowed to change. Subagents must not explore beyond that list.
- **Give the spec IDs.** Every brief names the requirement IDs (for example `TT-03`,
  `IDLE-02`) it must satisfy. The subagent writes tests named after those IDs.
- **Give the commands.** The brief states the exact commands that must pass (test, lint,
  typecheck). The subagent runs them and pastes the final output in its report.
- **Subagents do not commit.** They leave a clean working tree diff and a short report:
  what changed, what commands passed, anything they were unsure about.
- **Run independent briefs in parallel** in a single `Agent` call batch.
- **Use `fork` only** when the subagent genuinely needs this session's context. Otherwise
  start a fresh `general-purpose` agent with a self-contained brief; it is cheaper.

Use `docs/plan/subagent-brief-template.md` for every brief.

### Red-green TDD is mandatory

Every implementation brief follows red-green-refactor, and the subagent's report must
show it:

1. **Red.** Write the tests first, named after the spec IDs they cover
   (`it("TT-04 stop clears today's total", ...)`). Run them. Paste the failing output.
2. **Green.** Write the smallest implementation that makes them pass. Run them. Paste the
   passing output.
3. **Refactor.** Tidy without changing behaviour. Run them again.

A diff that arrives with tests and implementation but no evidence of the red run is sent
back. Behaviour that cannot be unit-tested (a tray menu, a native window) gets a manual
checklist in the brief instead, and the subagent reports which items it verified.

---

## 2. The specification is the source of truth

- `docs/spec/` describes the feature set with stable requirement IDs. It is written
  without reference to any implementation and must stay that way.
- **If behaviour changes, the spec changes in the same commit.** A code change that alters
  user-visible behaviour without a matching spec change is a defect and gets reverted.
- New ideas enter the spec with status `Proposed`. They become `Accepted` when the owner
  says so, and only `Accepted` or `Baseline` requirements are implemented.
- Tests reference requirement IDs in their names so coverage can be traced.
- `docs/design/` (architecture, UI, ADRs) must also be updated when the approach changes.
  A new architectural choice gets a new ADR; old ADRs are superseded, never edited.

---

## 3. Git discipline

- **One remote, `origin`, a private GitHub repository.** Work happens on `main` and is
  pushed there after each reviewed commit or batch. No pull requests are required for a
  single-owner repository; do not open any unless the owner asks.
- **Releases are tags.** Pushing a `v*` tag runs `.github/workflows/release.yml`, which
  builds macOS and Windows bundles and publishes a GitHub Release. Bump the version in
  `package.json`, `src-tauri/tauri.conf.json` and `src-tauri/Cargo.toml` in one commit
  before tagging. Never move or delete a published tag.
- **Commit often and atomically.** One logical change per commit. Commit after every
  completed task, after every reviewed subagent diff, and after every doc change.
- A behaviour change and its spec update belong in the **same** commit. Unrelated changes
  never share a commit.
- Conventional Commits, imperative mood, present tense:
  `feat(core): ...`, `fix(ui): ...`, `docs(spec): ...`, `test(core): ...`,
  `chore: ...`, `refactor(...): ...`. Scopes: `spec`, `design`, `plan`, `core`, `ui`,
  `shell`, `platform`, `repo`.
- The body references requirement IDs touched (`Implements TT-01, TT-02`).
- Commits made by an agent end with a `Co-Authored-By:` trailer naming the model that did
  the work, for example `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- Never rewrite history on `main`. Never force-push.
- Work happens on `main` unless an experiment is genuinely disposable; then use a branch
  and delete it afterwards.

---

## 4. The loop

1. **Read** the relevant spec sections and the current milestone in `docs/plan/milestones.md`.
2. **Plan** (Fable): pick the next task, confirm its spec IDs and acceptance criteria are
   precise. If the spec is ambiguous, fix the spec first and commit that.
3. **Brief** (Fable): write the brief from the template.
4. **Implement** (subagent): run it. Parallelise independent tasks.
5. **Review** (Fable): read the whole diff. Check it against the named spec IDs, the
   design docs, and section 5 below. Run the stated commands yourself. Send it back with
   a precise correction if anything is off; do not fix it by hand unless the fix is a
   one-liner.
6. **Commit** (Fable): atomic commit, spec/plan updates included.
7. **Update the plan**: tick the task in `docs/plan/milestones.md` in the same or the next
   commit.

---

## 5. Definition of done for any change

- Named requirement IDs are satisfied and have tests where the behaviour is testable.
- All commands stated in the brief pass; the output was actually looked at.
- No user-visible behaviour exists that the spec does not describe.
- No dependency was added without a line in the relevant ADR or `docs/design/architecture.md`.
- Nothing in the repo phones home, syncs, or requires an account. Local-only is a
  hard requirement (`NF-01`..`NF-04`).
- The UI still matches `docs/design/ui.md` (tokens, states, copy).
- The change is committed.

---

## 6. Repository map

```
.github/workflows/        ci.yml (tests on every push), release.yml (bundles on v* tags)
AGENTS.md                 this file
CLAUDE.md                 imports this file for Claude Code
README.md                 human-facing overview
docs/
  README.md               index of all documentation
  spec/                   feature specification, implementation-free, requirement IDs
  design/                 architecture, UI design system, ADRs
  plan/                   milestones and the subagent brief template
design/
  prototype.html          self-contained UI prototype; the visual reference for the app
```

Implementation directories (`core/`, `app/`, `src-tauri/`) are created by milestone tasks
and described in `docs/design/architecture.md` when they appear.

---

## 7. Things that are not allowed

- Adding multi-user, sync, cloud, accounts, telemetry, or network access of any kind.
- Turning the product into a timesheet, project or invoicing tool. See `docs/spec/99-out-of-scope.md`.
- Implementing anything with status `Proposed` or `Deferred`.
- Letting a subagent edit `docs/spec/`, `docs/design/`, `AGENTS.md`, or commit.
- Force-pushing, or pushing to any remote other than `origin`.
- Leaving work uncommitted or unpushed at the end of a session.
