# CODEX-003: Unit Tests for `contextModifiers.ts` and `forgeAlphaModifiers.ts`

## Context

These two files contain the modifier layer that adjusts FORGE alpha scores based on
environment and matchup context. Bugs here introduce silent, hard-to-reproduce scoring
errors that affect every player grade.

Both files are **purely functional** — no DB, no HTTP, no external services.

### `server/modules/forge/contextModifiers.ts` exports:
- `applyForgeEnvModifier({ alpha, envScore })` → adjusted alpha (number)
- `getEnvLabel(score)` → string label for env score
- `applyForgeMatchupModifier({ alpha, matchupScore })` → adjusted alpha
- `getMatchupLabel(score)` → string label for matchup score

### `server/modules/forge/forgeAlphaModifiers.ts` exports:
- `applyForgeModifiers(rawAlpha, env, matchup)` → adjusted alpha
- `getEnvScoreLabel(score)` → string
- `getMatchupScoreLabel(score)` → string
- `calculateModifierEffect(alpha, modifierScore, weight)` → number

## Task

Create `server/modules/forge/__tests__/contextModifiers.test.ts`.
Both files can be covered in a single test file since they are closely related.

## Pattern Reference

Follow `server/modules/forge/__tests__/forgeEngine.test.ts`.

## Setup

```typescript
jest.mock('../../../infra/db', () => ({ db: {} }));

import {
  applyForgeEnvModifier,
  getEnvLabel,
  applyForgeMatchupModifier,
  getMatchupLabel,
} from '../contextModifiers';

import {
  applyForgeModifiers,
  getEnvScoreLabel,
  getMatchupScoreLabel,
  calculateModifierEffect,
} from '../forgeAlphaModifiers';
```

## Test Cases

### `applyForgeEnvModifier`

```
it('returns alpha unchanged when envScore is null')
it('returns alpha unchanged when envScore is 50 (neutral)')
it('increases alpha when envScore > 50 (favorable environment)')
it('decreases alpha when envScore < 50 (unfavorable environment)')
it('clamps result to [0, 100]')
```

### `getEnvLabel`

```
it('returns a non-empty string for any numeric input')
it('returns a string for null input')
it('returns different labels for scores of 20, 50, and 80')
```

### `applyForgeMatchupModifier`

```
it('returns alpha unchanged when matchupScore is null')
it('returns alpha unchanged when matchupScore is 50 (neutral)')
it('increases alpha when matchupScore > 50 (favorable matchup)')
it('decreases alpha when matchupScore < 50 (unfavorable matchup)')
it('clamps result to [0, 100]')
```

### `getMatchupLabel`

```
it('returns a non-empty string for any numeric input')
it('returns a string for null input')
```

### `calculateModifierEffect`

```
it('returns 0 when modifierScore is 50 (neutral)')
it('returns a positive value when modifierScore > 50')
it('returns a negative value when modifierScore < 50')
it('scales proportionally with weight')
```

### `applyForgeModifiers`

```
it('returns rawAlpha unchanged when both env and matchup are null')
it('applies both env and matchup adjustments when both are provided')
it('result is always a number between 0 and 100')
```

### Label functions (`getEnvScoreLabel`, `getMatchupScoreLabel`)

```
it('return a non-empty string for scores 0, 25, 50, 75, 100')
```

## Acceptance Criteria

- `npx jest contextModifiers.test.ts` passes with no errors
- All 4 exports from `contextModifiers.ts` and all 4 exports from `forgeAlphaModifiers.ts`
  are covered by at least one test each
- Clamping behavior (output always 0–100) is explicitly asserted
