# Subagent brief template

Copy this into the `Agent` prompt. Fill every section; delete nothing.

```
You are implementing one task in the ClickClock repository at <ABSOLUTE PATH>.
Read AGENTS.md first and obey it. You do not commit. You do not edit docs/spec, docs/design,
AGENTS.md, or any file outside the "Files you may change" list.

## Task
<one paragraph: what to build>

## Spec requirements to satisfy
<IDs and the exact text of each requirement, pasted>

## Files to read (and nothing else)
- <path>: <why>

## Files you may change
- <path> (create|edit)

## Contract
<exact exported names, signatures, and behaviours; paste interfaces>

## Red-green TDD
1. Write the tests first in <test file>. Name each test after the spec ID it covers.
   Required cases:
   - <Given / when / then>
2. Run `<test command>`; paste the failing output in your report.
3. Implement until green. Run `<test command>` and `<typecheck command>`; paste output.
4. Refactor; run again.

## Acceptance
- `<command>` exits 0
- <observable criterion>

## Report back
- Files changed
- The red output and the green output (last 30 lines each)
- Anything you were unsure about, in one line each
```
