# CODEX-002: Unit Tests for `forgeFootballLens.ts`

## Context

`server/modules/forge/forgeFootballLens.ts` exports a single function `applyFootballLens`.
It inspects pillar scores and returns adjusted pillars plus a list of football-sense issues
(e.g. TD spike detection, volume/efficiency mismatches). It is a key product differentiator
with **zero test coverage**. Silent failures allow bad grades to surface to users.

The function is **purely functional** — it only imports types from `forgeEngine.ts` and has
no external dependencies. No mocking is needed beyond the standard DB guard.

## Task

Create `server/modules/forge/__tests__/forgeFootballLens.test.ts`.

## Pattern Reference

Follow `server/modules/forge/__tests__/forgeEngine.test.ts`. The football lens is simpler —
no mocking needed beyond the DB guard at the top.

## Setup

```typescript
jest.mock('../../../infra/db', () => ({ db: {} }));

import { applyFootballLens } from '../forgeFootballLens';
import type { ForgeEngineOutput, ForgePillarScores } from '../forgeEngine';
```

## Fixtures

```typescript
function makeOutput(
  position: 'WR' | 'RB' | 'TE' | 'QB',
  pillars: Partial<ForgePillarScores>,
  gamesPlayed = 10
): ForgeEngineOutput {
  return {
    position,
    gamesPlayed,
    pillars: {
      volume: 60,
      efficiency: 60,
      teamContext: 60,
      stability: 60,
      ...pillars,
    },
  } as ForgeEngineOutput;
}
```

## Test Cases

### WR rules

```
it('flags WR_TD_SPIKE_LOW_VOLUME when WR volume < 40 and efficiency > 85')
it('scales down WR efficiency pillar by 0.9 on TD spike flag')
it('flags WR_HIGH_VOLUME_LOW_EFFICIENCY when volume > 75 and efficiency < 40')
it('does NOT scale efficiency on WR_HIGH_VOLUME_LOW_EFFICIENCY (info only)')
it('produces no issues for a balanced WR (volume=65, efficiency=65)')
```

### RB rules

```
it('flags RB_VOLUME_WITH_BAD_EFFICIENCY when volume > 70 and efficiency < 50')
it('flags RB_WORKHORSE_BAD_OFFENSE when volume > 80 and teamContext < 35')
it('flags RB_LOW_VOLUME_HIGH_EFFICIENCY and scales efficiency by 0.92')
```

### TE rules

```
it('flags TE_TD_DEPENDENT when volume < 35 and efficiency > 80')
it('scales down TE efficiency pillar by 0.88 on TD-dependent flag')
```

### QB rules

```
it('flags QB_BOOM_BUST when efficiency > 85 and stability < 40')
it('flags QB_GARBAGE_TIME_VOLUME when volume > 75 and efficiency < 45')
```

### Cross-position rules

```
it('flags PILLAR_POLARIZATION when one pillar >= 90 and another <= 30')
it('flags SMALL_SAMPLE_SIZE when gamesPlayed < 3')
it('does not flag SMALL_SAMPLE_SIZE when gamesPlayed >= 3')
```

### Output contract

```
it('always returns pillars and issues keys')
it('returned pillars are always clamped between 0 and 100')
it('does not mutate the original engineOutput pillars object')
```

## Acceptance Criteria

- `npx jest forgeFootballLens.test.ts` passes with no errors
- Every issue code in the source (`WR_TD_SPIKE_LOW_VOLUME`, `RB_WORKHORSE_BAD_OFFENSE`,
  `TE_TD_DEPENDENT`, `QB_BOOM_BUST`, `QB_GARBAGE_TIME_VOLUME`, `PILLAR_POLARIZATION`,
  `SMALL_SAMPLE_SIZE`) is covered by at least one test
- Pillar scaling factors (0.9, 0.92, 0.88) are verified with `toBeCloseTo`
