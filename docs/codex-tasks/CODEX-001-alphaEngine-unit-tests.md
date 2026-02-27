# CODEX-001: Unit Tests for `alphaEngine.ts`

## Context

`server/modules/forge/alphaEngine.ts` contains `calculateAlphaScore` — the single function
that produces every FORGE player grade (0–100). It is currently only **mocked** in other test
files and has no direct unit coverage. A regression here silently corrupts all rankings.

The function is pure given mocked dependencies. It imports from:
- `./forgeAlphaModifiers` (mock this)
- `./fibonacciPatternResonance` (mock this)
- `./utils/scoring` (real — `clamp`, `roundTo`)
- `./types` (real — constants and types)

## Task

Create `server/modules/forge/__tests__/alphaEngine.test.ts`.

## Pattern Reference

Follow the style of `server/modules/forge/__tests__/forgeEngine.test.ts`:
- Mock `../../../infra/db` at the top to avoid DATABASE_URL errors at import time
- Mock heavy dependencies at the module level with `jest.mock()`
- Use `describe` / `it` / `expect` with inline fixture objects
- All tests are synchronous, DB-free, and HTTP-free

## Setup

```typescript
// Prevent db.ts from throwing when DATABASE_URL is not set
jest.mock('../../../infra/db', () => ({ db: {} }));

// Mock FPR so it returns a neutral output and doesn't need DB
jest.mock('../fibonacciPatternResonance', () => ({
  computeFPR: jest.fn(() => ({
    fprScore: 50,
    patterns: [],
    confidence: 0.5,
  })),
}));

// Mock applyForgeModifiers so modifier logic is isolated
jest.mock('../forgeAlphaModifiers', () => ({
  applyForgeModifiers: jest.fn((rawAlpha: number) => rawAlpha),
}));

import { calculateAlphaScore } from '../alphaEngine';
import type { ForgeContext, ForgeFeatureBundle } from '../types';
```

## Fixtures

Build minimal fixture factories:

```typescript
function makeContext(overrides: Partial<ForgeContext> = {}): ForgeContext {
  return {
    playerName: 'Test Player',
    position: 'WR',
    season: 2024,
    gamesPlayed: 10,
    age: 25,
    ...overrides,
  };
}

function makeFeatures(overrides: Partial<ForgeFeatureBundle> = {}): ForgeFeatureBundle {
  return {
    volume: 70,
    efficiency: 65,
    teamContext: 60,
    stability: 55,
    ...overrides,
  };
}
```

## Test Cases

### `calculateAlphaScore` — output shape

```
it('returns a ForgeScore with alpha, subScores, trajectory, and confidence')
it('alpha is always clamped between 0 and 100')
```

### `calculateAlphaScore` — position handling

```
it('returns a valid score for each position: QB, RB, WR, TE')
```

### `calculateAlphaScore` — scoring mode

```
it('dynasty mode applies age penalty for old players (age >= 30)')
it('dynasty mode does not penalise young players (age <= 26)')
it('redraft mode ignores age')
```

### `calculateAlphaScore` — modifiers

```
it('passes through env modifier to applyForgeModifiers when provided')
it('passes through matchup modifier to applyForgeModifiers when provided')
it('skips modifier call when no modifiers supplied')
```

### `calculateAlphaScore` — edge cases

```
it('does not crash when all feature inputs are 0')
it('does not crash when all feature inputs are 100')
it('handles gamesPlayed = 1 without NaN')
```

## Acceptance Criteria

- `npx jest alphaEngine.test.ts` passes with no errors
- At least 10 `it()` blocks
- No real DB connections or HTTP calls
- All assertions use `expect(...).toBe/toBeCloseTo/toBeGreaterThanOrEqual/toBeLessThanOrEqual`
