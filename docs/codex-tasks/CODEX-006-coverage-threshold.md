# CODEX-006: Raise Jest Coverage Threshold

## Context

`jest.config.cjs` currently enforces only 5% line coverage — effectively no enforcement.
With the test files added in CODEX-001 through CODEX-005, the real coverage is now
meaningfully higher. Raising the threshold makes regressions visible in CI.

This is a **configuration-only change** — no test files are added or modified.

## Task

Edit `jest.config.cjs` to raise the `coverageThreshold`.

## Change

```js
// Before (current)
coverageThreshold: {
  global: {
    lines: 5,
  }
}

// After
coverageThreshold: {
  global: {
    lines: 20,
    functions: 15,
    branches: 10,
  }
}
```

## Verification

Run:

```bash
npx jest --coverage
```

The command should exit 0 (pass). If it exits non-zero, the threshold is too high for
the current state of the codebase — lower it by 5 percentage points at a time until it
passes, and document the final values chosen.

## Notes for Codex

- Do NOT remove `/client/` from `coveragePathIgnorePatterns` in this task.
  Client-side testing is a separate effort.
- Do NOT modify any test files or source files — this task is configuration only.
- After editing, run `npx jest --coverage 2>&1 | tail -20` and confirm no coverage
  threshold failure messages appear.

## Acceptance Criteria

- `jest.config.cjs` has `lines >= 20`, `functions >= 15`, `branches >= 10`
- `npx jest --coverage` exits 0
- No other files are modified
