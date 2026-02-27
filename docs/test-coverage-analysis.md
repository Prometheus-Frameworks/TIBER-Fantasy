# Test Coverage Analysis

**Date**: 2026-02-27

## Summary

The codebase has approximately **4–6% test coverage**, with 15 test files (`.test.ts`) covering ~477 server source files. Client-side code is entirely excluded from testing. The Jest config enforces only a 5% line coverage threshold — effectively no enforcement.

```
Module            Tests   Files   Coverage
-----------------------------------------
forge/              5      29       17%
metricMatrix/       1       2       50%
consensus/          1       3       33%
routes/             4      61        7%
services/           3     108        3%
client/             0     ~200        0%
```

---

## What Is Tested Well

The FORGE module has the strongest coverage:

- **`forgeEngine.test.ts`** — `computePillarScore`, `normalizeRange`, `applyGamesPlayedDampening`, `cvToScore`
- **`featureExtractors.test.ts`** — All 4 position feature builders (QB/RB/WR/TE) with edge cases including data-quality capping for <3 games
- **`recursiveAlphaEngine.test.ts`** — Two-pass alpha scoring, momentum blending, volatility calculations
- **`snapshotDataValidator.test.ts`** — Ghost row detection, snap share outlier detection (>3σ), null value handling
- **`playerVectorService.test.ts`** — Normalization utilities, position-specific caps, availability scaling

---

## Priority Areas for Improvement

### Priority 1 — Core FORGE Logic (Untested)

**`server/modules/forge/alphaEngine.ts`** and **`alphaV2.ts`**
Mocked in existing tests but never directly exercised. The alpha scoring computation — which drives every player grade — has no direct unit coverage. A regression here would silently corrupt all rankings.

**`server/modules/forge/forgeFootballLens.ts`**
The football-sense validation layer (TD spike detection, volume/efficiency mismatches) is completely untested despite being a core product differentiator. False positives or missed flags go undetected.

**`server/modules/forge/contextModifiers.ts`** and **`forgeAlphaModifiers.ts`**
Modifier application adjusts final scores based on environmental and matchup context. Bugs here introduce silent, hard-to-reproduce scoring errors.

---

### Priority 2 — High-Complexity Services (0% Coverage)

**`server/services/UPHCoordinator.ts`** (~60KB — largest file in the codebase)
Coordinates the data pipeline with zero tests. Any regression here can silently stall data ingestion.

**`server/services/GoldLayerService.ts`** (~31KB)
Aggregates the final facts and metrics consumed by every API endpoint. Bugs here propagate to all downstream rankings and recommendations.

**`server/modules/sos/sos.service.ts`** (~29KB)
The strength-of-schedule service affects all FORGE scores through matchup adjustments. Complex branching logic with no test coverage.

**`server/modules/startSit/startSitEngine.ts`**
The start/sit recommendation engine is a primary user-facing feature with zero tests.

---

### Priority 3 — Sentinel Rule Engine

**`server/modules/sentinel/sentinelEngine.ts`** and **`sentinelRules.ts`**
The validation and rule engine that gates data quality has no coverage. Incorrect rules allow bad data to flow silently into rankings.

---

### Priority 4 — Route Smoke Tests (57 untested routes)

The pattern in `apiSmoke.test.ts` is solid and should be extended to:

- `adpRoutes.ts` (~33KB) — ADP data is heavily used by the UI
- `fireRoutes.ts` (~42KB) — Complex multi-step route logic
- `compassRoutes.ts` — Position compass endpoints
- `matchupRoutes.ts` — Matchup scoring endpoints
- `dynastyRoutes.ts` — Dynasty-specific ranking logic

---

### Priority 5 — Client-Side (0% Coverage)

The Jest config explicitly excludes `/client/`. There are no tests for React components, custom hooks, or routing. The hooks layer is particularly high-value given the TanStack Query caching:

- `client/src/hooks/` — Data-fetching hooks with cache invalidation logic
- `client/src/pages/TiberTiers` — Core ranking view
- `client/src/pages/PlayerPage` — Player detail view

---

## Recommended Test Backlog

Ordered by impact:

| # | File | Reason |
|---|------|--------|
| 1 | `forge/alphaEngine.ts` | Every player grade depends on it; currently only mocked |
| 2 | `forge/forgeFootballLens.ts` | Key differentiator; silent failures affect all grades |
| 3 | `forge/contextModifiers.ts` | Silent score corruption risk |
| 4 | `modules/startSit/startSitEngine.ts` | Primary user feature, zero coverage |
| 5 | `modules/sentinel/sentinelEngine.ts` | Data integrity gatekeeper |
| 6 | `modules/sos/sos.service.ts` | Affects all FORGE scores; 29KB of untested logic |
| 7 | `services/GoldLayerService.ts` | All API consumers depend on this layer |
| 8 | `routes/adpRoutes.ts` | High-use route; smoke tests needed |
| 9 | `services/PlayerIdentityService.ts` | Cross-platform ID bugs are silent and hard to debug |
| 10 | `client/src/hooks/` | Cache invalidation bugs are user-facing and hard to reproduce |

---

## Quick Configuration Win

Raise the coverage threshold in `jest.config.cjs`. Even moving from 5% → 20% makes regressions visible in CI:

```js
// jest.config.cjs
coverageThreshold: {
  global: {
    lines: 20,     // was 5
    functions: 15,
    branches: 10,
  }
}
```

Once client tests are added, remove `/client/` from `coveragePathIgnorePatterns` so the full picture is reflected in coverage reports.
