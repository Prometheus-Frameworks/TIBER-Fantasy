# Claude Code Task: Saturday Test Foundation

## Objective
Establish a test foundation for the most critical backend paths. Currently ~3-5% coverage across 483+ source files with 14 test files. The FORGE engine orchestrator (`forgeEngine.ts`, 40+ KB) is untested.

## Existing Setup
- **Jest config**: `jest.config.cjs` — ts-jest, `@shared` alias mapped, `testMatch: ['**/__tests__/**/*.test.ts']`
- **Existing test files**: 14 files across `server/modules/forge/__tests__/`, `server/services/__tests__/`, `server/routes/__tests__/`, `server/__tests__/`
- **Duplicate to remove**: `server/modules/__tests__/recursiveAlphaEngine.test.ts` (older copy of `server/modules/forge/__tests__/recursiveAlphaEngine.test.ts`)

## Tasks

### 1. FORGE Engine Unit Tests (P0)
**File**: `server/modules/forge/__tests__/forgeEngine.test.ts`

Test the core math functions in `server/modules/forge/forgeEngine.ts`:

- **`computePillarScore(config, lookup)`** — Given a pillar config with metric weights and a metric lookup map, verify it returns a weighted average. Test edge cases: empty config, missing metrics in lookup, all-zero weights.
- **`normalizeRange(value, min, max)`** — Verify it maps values to 0-100 range. Key edge case: `min === max` should return 50 (not NaN). Test negative ranges, inverted min/max.
- **`computeDerivedMetric(formula, lookup)`** — Test derived metric formulas (e.g., `fpoe_per_game`). Verify division-by-zero guards.
- **`cvToScore(cv)`** — Coefficient of variation to score conversion. Verify NaN/Infinity guards.
- **`dampenPillarScores(pillars)`** — Verify dampening pulls extreme scores toward center without changing rank order.

These functions are not currently exported individually, so you may need to either:
a) Add targeted exports for testability, or
b) Test through the public `runForgeEngine()` interface with mocked DB queries

Preferred approach: Add `export` to the pure math utility functions that don't depend on DB access (normalizeRange, cvToScore, dampenPillarScores, computePillarScore) so they can be unit-tested directly. Don't export DB-dependent functions.

### 2. Position Feature Extractor Tests (P0)
**Files to test**: `server/modules/forge/qbFeatures.ts`, `server/modules/forge/rbFeatures.ts`, `server/modules/forge/wrFeatures.ts`, `server/modules/forge/teFeatures.ts`
**Test file**: `server/modules/forge/__tests__/featureExtractors.test.ts`

Each feature extractor takes a `ForgeContext` object and returns position-specific metrics. Test:
- Returns expected metric keys for each position
- Handles missing/null stats gracefully (no crashes)
- Metric values are reasonable numbers (not NaN, not Infinity)

### 3. Route Smoke Tests (P1)
**File**: `server/routes/__tests__/apiSmoke.test.ts`

Basic HTTP-level tests for the 5 most-used API routes. Use `supertest` (install if not present) against the Express app:

```
GET /api/forge/grades/WR?season=2025 → 200, returns array
GET /api/tiers/WR → 200, returns object with tiers
GET /api/system/current-week → 200, returns { week, season }
GET /api/catalyst/batch?season=2024 → 200, returns array
GET /api/fire/eg/batch?position=WR → 200, returns array
```

Each test should verify:
- Status code is 200
- Response is valid JSON
- Response shape matches expected structure (array vs object)

Note: The Express app is created in `server/index.ts` and exported (or use `server/routes.ts` directly). You may need to create a test helper that boots the Express app without starting the listener.

### 4. Jest Coverage Configuration (P1)
Update `jest.config.cjs` to add:
```js
collectCoverage: true,
coverageDirectory: 'coverage',
coverageThreshold: { global: { lines: 5 } }, // start low, ratchet up
coveragePathIgnorePatterns: ['/node_modules/', '/client/', '/__tests__/'],
```

### 5. Cleanup (P1)
- Remove the duplicate test file: `server/modules/__tests__/recursiveAlphaEngine.test.ts`
- If the `server/modules/__tests__/` directory is empty after removal, remove the directory too

## Important Context

- The project uses PostgreSQL (Neon). DB connection is in `server/infra/db.ts`. For unit tests of pure functions, mock the DB. For smoke tests, you can either use the real DB or mock at the service layer.
- Schema is in `shared/schema.ts` — very large file, use grep to find what you need.
- The FORGE engine pipeline: `forgeEngine.ts` → `forgeGrading.ts` → position feature extractors → pillar configs
- `ts-jest` is the transformer. TypeScript strict mode is on.
- Don't install new test frameworks — stick with Jest + ts-jest that's already configured.
- `supertest` may need to be installed for route smoke tests.

## Success Criteria
- [ ] All new tests pass (`npx jest --verbose`)
- [ ] FORGE core math functions have at least 5 test cases each
- [ ] Route smoke tests cover 5 endpoints
- [ ] Coverage reporting is enabled and runs
- [ ] Duplicate test file removed
- [ ] No existing tests broken
