# CODEX-005: Unit Tests for the StartSit Module

## Context

The `server/modules/startSit/` directory contains two testable files:

1. **`dataAssembler.ts`** — exports `buildStartSitPlayerProfile(playerId, week, season)`.
   Queries the DB and assembles a `StartSitPlayerProfile`. Needs DB mocking.

2. **`startSitAgent.ts`** — exports `StartSitAgent` class and singleton `startSitAgent`.
   The `StartSitAgent` class calls `buildStartSitPlayerProfile` and an LLM service
   to produce start/sit recommendations. Both dependencies need mocking.

This is a primary user-facing feature with zero test coverage. Silent bugs here affect
real user decisions.

## Task

Create `server/modules/startSit/__tests__/startSit.test.ts`.

## Pattern Reference

Follow `server/modules/forge/__tests__/forgeEngine.test.ts` for pure functions.
Follow `server/services/__tests__/leagueDashboardService.test.ts` for mocked service patterns.

## Setup

```typescript
// Prevent DB connection at import time
jest.mock('../../infra/db', () => ({ db: {} }));

// Mock dataAssembler so StartSitAgent tests don't need real DB
jest.mock('../dataAssembler', () => ({
  buildStartSitPlayerProfile: jest.fn(),
}));

// Mock the LLM gateway
jest.mock('../../llm/llmGateway', () => ({
  callLLM: jest.fn(),
}));

import { buildStartSitPlayerProfile } from '../dataAssembler';
import { startSitAgent } from '../startSitAgent';
import type { StartSitPlayerProfile } from '../dataAssembler';
```

Adjust mock paths after inspecting actual import paths in each file.

## Fixtures

```typescript
function makeProfile(overrides: Partial<StartSitPlayerProfile> = {}): StartSitPlayerProfile {
  return {
    playerId: 'test-player-001',
    name: 'Test Player',
    position: 'WR',
    team: 'KC',
    week: 10,
    season: 2024,
    forgeAlpha: 72,
    fireScore: 68,
    matchupScore: 65,
    ...overrides,
  };
}
```

## Test Cases

### `buildStartSitPlayerProfile` — via mock verification

Since `buildStartSitPlayerProfile` is an async DB function, test that:

```
it('is called with correct playerId, week, and season parameters')
it('returns null (or throws) when player is not found')
```

### `StartSitAgent` — recommendation logic

```
it('returns a recommendation when profile is valid')
it('recommendation contains a decision field: "start" or "sit"')
it('recommendation contains a reasoning string')
it('calls callLLM exactly once per recommendation request')
it('handles null profile (player not found) gracefully without throwing')
it('handles LLM timeout/rejection without crashing')
```

### Edge cases

```
it('does not call LLM when profile cannot be assembled')
it('recommendation decision is always "start" or "sit", never undefined')
```

## Notes for Codex

- Read `server/modules/startSit/dataAssembler.ts` and `startSitAgent.ts` fully before
  writing tests — the exact method names and return types may differ from this spec.
- If `startSitAgent` exposes a method like `getRecommendation(playerId, week, season)`,
  test that directly. If it uses `recommend()` or a different name, adapt accordingly.
- Verify LLM gateway import path with:
  `grep -n "from.*llm\|from.*LLM\|callLLM" server/modules/startSit/startSitAgent.ts`

## Acceptance Criteria

- `npx jest startSit.test.ts` passes with no errors
- `buildStartSitPlayerProfile` and the `StartSitAgent` recommendation method are both tested
- At least 8 `it()` blocks
- No real DB connections or HTTP calls
