# TIBER Fantasy - Weekly Roadmap (Feb 23 - Mar 1, 2026)

> Produced from a full codebase audit covering: FORGE engine, server security, database schema, ELT pipeline, frontend, and test coverage.

---

## Executive Summary

The codebase has strong architectural bones — a well-separated 3-tier ELT pipeline, a modular FORGE engine, and a clean React frontend. However, the audit uncovered **100+ issues** across 6 domains. The most critical themes are:

1. **FORGE engine correctness** — Division-by-zero risks, inconsistent normalization, and sequential batch execution
2. **Security gaps** — SSL cert validation disabled in prod, API keys accepted via query params, no input bounds checking
3. **~3-5% test coverage** — 17 test files covering 483+ source files; zero frontend tests
4. **Data pipeline fragility** — No transaction wrapping in Bronze/Silver layers, N+1 query patterns in Gold layer
5. **Frontend staleness** — Hardcoded `2025` season values, stale closures, 2600+ line component files

The roadmap below is organized by day with the highest-impact, lowest-risk fixes first.

---

## Monday — FORGE Engine Correctness

**Theme**: Fix math bugs that could produce incorrect Alpha scores.

### P0: Division-by-Zero Guards
- [ ] `server/modules/forge/forgeEngine.ts:624-627` — `normalizeRange` returns `NaN` when `min === max`. Add guard: `if (max === min) return 50;`
- [ ] `server/modules/forge/xfpVolumePillar.ts:310` — Same pattern in `normalizeMetric`. Guard against zero range.
- [ ] `server/modules/forge/roleConsistencyPillar.ts:254-258` — `cvToScore` can propagate `NaN` from stdev. Add `isNaN` check.

### P0: Falsy-Zero Bug
- [ ] `server/modules/forge/forgeEngine.ts:1002` — `momentum_score` of `0` is falsy, skipping valid calculation. Change `roleBank['momentum_score'] ?` to `roleBank['momentum_score'] != null ?`

### P1: Inconsistent Normalization
- [ ] Audit the three normalization strategies (min-max in `forgeEngine.ts:310`, IQR-sigmoid in `robustNormalize.ts:84`, min-max in `xfpVolumePillar.ts:193`) and document when each should be used. Consider consolidating into a shared `normalize()` utility.

### P1: Inconsistent Default Scores
- [ ] Document the philosophy: `forgeEngine.ts` defaults to `50` (neutral), `roleConsistencyPillar.ts` defaults to `25` (low). Add code comments explaining why these differ or unify them.

### P1: Type Safety
- [ ] `forgeEngine.ts:327` — `as number` cast on `roleBank['games_played']` without validation. Add `typeof` guard or `Number()` coercion.

---

## Tuesday — FORGE Performance & Batch Execution

**Theme**: Make batch scoring viable for 200+ player runs.

### P0: Parallelize Batch Execution
- [ ] `server/modules/forge/forgeEngine.ts:1143-1149` — `runForgeEngineBatch` awaits each player sequentially in a `for` loop. Refactor to use `Promise.all()` with concurrency limiting (e.g., `p-limit` with concurrency of 10).

### P1: Reduce N+1 Queries
- [ ] `forgeEngine.ts:506-529, 913-927` — Player ID resolution queries `player_identity_map` individually per player. Extract to a shared `resolvePlayerId()` utility that can batch-resolve IDs.
- [ ] `forgeEngine.ts:710-850` — `computeDynastyContext` fires 8+ sequential DB queries per player. Parallelize independent queries with `Promise.all()`.

### P1: Deduplicate Code
- [ ] Extract the duplicated `player_identity_map` lookup logic (lines 913-927 and 506-529) into `server/modules/forge/utils/resolvePlayerId.ts`.
- [ ] Extract duplicated `mean()`/`stdev()` in `roleConsistencyPillar.ts:265-274` to use the existing implementations.

### P2: Document Magic Numbers
- [ ] Add constants file `server/modules/forge/constants.ts` with documented thresholds:
  - `BASELINE_PILLAR = 40` — why 40?
  - `GAMES_FULL_CREDIT = { QB: 12, RB: 10, WR: 10, TE: 10 }` — calibration basis?
  - Pillar weights per position — link to calibration data
  - Team context normalization ranges (`-0.2 to 0.3` for pass EPA, etc.)

---

## Wednesday — Server Security Hardening

**Theme**: Close the most exploitable security gaps.

### P0: Fix SSL Certificate Validation
- [ ] `server/infra/db.ts:16` — `rejectUnauthorized: false` disables SSL cert validation in production. Change to `true` or configure with proper CA cert.

### P0: Remove Query Parameter Auth
- [ ] `server/middleware/adminAuth.ts:9-11` — API keys accepted via `req.query.admin_key`. Remove this vector — query params are logged in access logs and leak via Referer headers.

### P1: Add Input Validation (Zod)
- [ ] Install `zod` and create validation schemas for the most exposed endpoints:
  - `server/routes.ts:1023-1025` — Bound `limit` (1-500), `week` (1-18), `season` (2020-2030)
  - `server/routes/forgeSimRoutes.ts:49` — Fix week validation to 1-18 (currently says 1-17)
  - `server/routes.ts:4845-4848` — Bound roster position maxes (1-10)
  - `server/routes.ts:2922` — Validate `minConfidence` is 0.0-1.0

### P1: External API Timeouts
- [ ] `server/integrations/sleeperClient.ts:32-39` — No timeout on fetch. Add `AbortSignal.timeout(10000)` and retry logic (2 retries with exponential backoff).
- [ ] `server/data/injuryClient.ts:56-79` — Returns `[]` on any error, silencing real failures. Log the error category (network vs auth vs parse) before returning fallback.

### P2: Rate Limiting Improvements
- [ ] `server/middleware/rateLimit.ts:35-36` — Replace probabilistic cleanup (`Math.random() < 0.01`) with `setInterval` cleanup every 60 seconds.
- [ ] Add rate limiting to ETL admin routes (`server/routes/etlRoutes.ts`).

---

## Thursday — Database & Pipeline Integrity

**Theme**: Prevent data corruption under concurrent load.

### P0: Transaction Wrapping
- [ ] `server/services/BronzeLayerService.ts:139-154` — `storeRawPayload()` has a race condition between duplicate check and insert. Wrap in `db.transaction()`.
- [ ] `server/services/SilverLayerService.ts:163-226` — No transaction context. Batch operations should be atomic — wrap in transaction with rollback on failure.

### P1: Missing Foreign Keys
- [ ] `shared/schema.ts` — `brandSignals.playerId` has NO foreign key to `playerIdentityMap.canonicalId`. Add FK constraint.
- [ ] `shared/schema.ts` — `advancedSignals.playerId` references `players.id` but has no FK defined. Add it.

### P1: Add CHECK Constraints
- [ ] `tiberScores.tiberScore` — Add `CHECK (tiber_score >= 0 AND tiber_score <= 100)`
- [ ] Week columns — Add `CHECK (week >= 0 AND week <= 18)` across fact tables
- [ ] Confidence scores — Add `CHECK (confidence >= 0 AND confidence <= 1.0)`

### P1: Missing Composite Indexes
- [ ] `playerWeekFacts` — Add composite index on `(playerId, season, week)` — this is the primary query pattern
- [ ] `marketSignals` — Add composite index on `(canonicalPlayerId, season, week)`

### P2: Gold Layer N+1 Queries
- [ ] `server/services/GoldLayerService.ts:207-232` — `processBatch()` likely queries per-player. Profile and batch where possible.

---

## Friday — Frontend Reliability

**Theme**: Fix bugs users can hit today.

### P0: Hardcoded Season Values
- [ ] Replace all hardcoded `2025` season references with `useCurrentNFLWeek()` hook:
  - `client/src/pages/TiberTiers.tsx:77`
  - `client/src/pages/RankingsHub.tsx:484, 494`
  - `client/src/pages/ForgeLabEquationSandbox.tsx`
  - `client/src/pages/QBLab.tsx`, `RushingLab.tsx`, `ReceivingLab.tsx`, `SituationalLab.tsx`

### P0: Stale Closure in PlayerPage
- [ ] `client/src/pages/PlayerPage.tsx:256-265` — `scrollToSection` uses `collapsedSections` from closure but doesn't include it in dependency array. Add it to `useCallback` deps.

### P1: Cache Invalidation
- [ ] `client/src/pages/PlayerPage.tsx:367` — Similar players cached for 4 hours with no invalidation on player change. Add `playerId` to query key (verify it's there) and reduce staleTime.
- [ ] `client/src/lib/queryClient.ts:50` — Global `staleTime: Infinity` combined with aggressive local overrides creates unpredictable behavior. Consider a shorter global default (5 min) and let specific queries opt into longer staleness.

### P1: Remove Production Console Logging
- [ ] `client/src/App.tsx:97-99` — `console.log(JSON.stringify(...))` fires on every route change. Wrap in `if (import.meta.env.DEV)`.

### P2: Accessibility Quick Wins
- [ ] `client/src/pages/RankingsHub.tsx:374-393` — Replace `<div onClick>` with `<button>` for "Hidden Gem" card.
- [ ] Add `aria-label` to icon-only buttons across PlayerPage (TrendingUp, TrendingDown, AlertTriangle icons).

### P2: Component Size
- [ ] `client/src/pages/WRRankingsSandbox.tsx` (2672 lines) — Extract helper functions and inline subcomponents to separate files. Identify the top 2-3 chunks to extract.
- [ ] `client/src/pages/PlayerPage.tsx` (1832 lines) — Extract `CompareDrawerContent` (lines 1581-1832) to its own file.

---

## Saturday — Test Foundation

**Theme**: Establish testing infrastructure for the most critical paths.

### Current State
- **17 test files** covering **~3-5%** of 483+ source files
- **Zero** frontend tests
- **Zero** E2E tests
- FORGE engine orchestrator (`forgeEngine.ts`, 40.7 KB) is **untested**

### P0: FORGE Engine Tests
- [ ] Write unit tests for `forgeEngine.ts` — focus on `computePillarScore`, `normalizeRange`, `computeDerivedMetric`
- [ ] Write tests for position-specific feature extractors (`qbFeatures.ts`, `rbFeatures.ts`, `wrFeatures.ts`, `teFeatures.ts`)
- [ ] Remove duplicate test file: `server/modules/__tests__/recursiveAlphaEngine.test.ts` (older copy of forge version)

### P1: Route Smoke Tests
- [ ] Add basic HTTP-level tests for the 5 most-used API routes:
  - `/api/forge/grades/:position`
  - `/api/tiers/:position`
  - `/api/player/:id`
  - `/api/rankings/:position`
  - `/api/current-week`

### P1: Jest Coverage Configuration
- [ ] Add coverage reporting to `jest.config.cjs`:
  ```js
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageThreshold: { global: { lines: 10 } } // start low, ratchet up
  ```

### P2: Data Pipeline Smoke Tests
- [ ] Write tests for `BronzeLayerService.storeRawPayload()` — verify deduplication, error handling
- [ ] Write tests for `SilverLayerService.storeBatchPayloads()` — verify partial failure behavior

---

## Sunday — Review & Plan Next Sprint

- [ ] Review all PRs from the week
- [ ] Run full test suite, check coverage delta
- [ ] Run typecheck (`npm run typecheck`) and address any new errors
- [ ] Update this roadmap with what carried over and new discoveries
- [ ] Plan next week's focus (candidates: E2E tests, Sentinel module, dynasty context improvements, mock data removal from `useLeagueContext.ts`)

---

## Issue Severity Summary

| Area | Critical | High | Medium | Low | Total |
|------|----------|------|--------|-----|-------|
| FORGE Engine | 4 | 4 | 8 | 4 | 20 |
| Server Security | 2 | 4 | 5 | 2 | 13 |
| Database/Pipeline | 2 | 4 | 3 | 2 | 11 |
| Frontend | 2 | 4 | 4 | 3 | 13 |
| Test Coverage | 1 | 3 | 2 | 1 | 7 |
| **Total** | **11** | **19** | **22** | **12** | **64** |

---

## Files Most In Need of Attention

| File | Size | Issues | Priority |
|------|------|--------|----------|
| `server/modules/forge/forgeEngine.ts` | 40.7 KB | 15+ (math, perf, duplication) | Critical |
| `server/routes.ts` | 10.5K lines | 12+ (validation, bounds) | High |
| `shared/schema.ts` | Large | 10+ (FKs, indexes, constraints) | High |
| `client/src/pages/PlayerPage.tsx` | 1832 lines | 8+ (stale closures, cache, a11y) | High |
| `client/src/pages/WRRankingsSandbox.tsx` | 2672 lines | Needs decomposition | Medium |
| `server/services/BronzeLayerService.ts` | - | Race condition, no transactions | High |
| `server/infra/db.ts` | - | SSL validation disabled | Critical |
