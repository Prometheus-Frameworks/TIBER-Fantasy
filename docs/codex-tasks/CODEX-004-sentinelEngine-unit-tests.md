# CODEX-004: Unit Tests for `sentinelEngine.ts`

## Context

`server/modules/sentinel/sentinelEngine.ts` is the data-quality gatekeeper.
It validates incoming data and fires events when rules are violated. Incorrect rules
allow bad data to flow silently into rankings.

The file exports:
- `evaluate(module, data)` → `SentinelReport` (synchronous, pure)
- `evaluateRule(ruleId, data)` → `SentinelCheckResult` (synchronous, pure)
- `recordEvents(events)` → `Promise<void>` (DB write — mock)
- `muteIssue(fingerprint, reason?)` → `Promise<void>` (DB write — mock)
- `getIssues(filters?)` → `Promise<...>` (DB read — mock)
- `getEventFeed(filters?)` → `Promise<...>` (DB read — mock)
- `getHealthSummary()` → `Promise<...>` (DB read — mock)

Focus unit tests on the **synchronous** functions (`evaluate`, `evaluateRule`).
The async DB functions need only a smoke test confirming they resolve without throwing
when the DB is mocked.

## Task

Create `server/modules/sentinel/__tests__/sentinelEngine.test.ts`.

## Pattern Reference

Follow `server/modules/forge/__tests__/forgeEngine.test.ts`.

## Setup

```typescript
// Mock DB to avoid DATABASE_URL errors and prevent real DB calls
jest.mock('../../infra/db', () => ({
  db: {
    insert: jest.fn().mockReturnValue({ values: jest.fn().mockResolvedValue(undefined) }),
    update: jest.fn().mockReturnValue({ set: jest.fn().mockReturnValue({ where: jest.fn().mockResolvedValue(undefined) }) }),
    select: jest.fn().mockReturnValue({ from: jest.fn().mockReturnValue({ where: jest.fn().mockResolvedValue([]) }) }),
  },
}));

import {
  evaluate,
  evaluateRule,
  recordEvents,
  muteIssue,
  getIssues,
  getHealthSummary,
} from '../sentinelEngine';
```

Adjust mock paths if needed after inspecting the actual import paths in `sentinelEngine.ts`.

## Test Cases

### `evaluate(module, data)` — output contract

First, check `server/modules/sentinel/sentinelRules.ts` to understand the shape of
`SentinelModule` and which rule IDs are registered. Use a real module name from that file.

```
it('returns a SentinelReport with passed, failed, and skipped arrays')
it('passed + failed + skipped equals total rules in the module')
it('returns all rules as skipped when data is an empty object')
it('does not throw when module has no rules')
```

### `evaluateRule(ruleId, data)` — result contract

```
it('returns { passed: true } for a valid ruleId with compliant data')
it('returns { passed: false, reason: string } for a valid ruleId with non-compliant data')
it('returns { passed: false, reason: "Rule not found" } for an unknown ruleId')
```

### Async functions — smoke tests

```
it('recordEvents resolves without throwing when given an empty array')
it('muteIssue resolves without throwing')
it('getIssues resolves to an array')
it('getHealthSummary resolves to an object with a summary key')
```

## Notes for Codex

- Read `server/modules/sentinel/sentinelRules.ts` before writing tests to understand
  the actual rule IDs and module names available. Do not guess them.
- The mock path for `db` may differ — verify with `grep -n "from.*infra/db\|from.*db'" server/modules/sentinel/sentinelEngine.ts`
- If `evaluate` or `evaluateRule` do not exist as named exports, adapt to the actual
  public API in the file (e.g., a class with methods).

## Acceptance Criteria

- `npx jest sentinelEngine.test.ts` passes with no errors
- At least 10 `it()` blocks
- `evaluate` and `evaluateRule` are directly called (not mocked) in the tests
- DB calls are fully mocked — no real database connection
