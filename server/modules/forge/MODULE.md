# FORGE Module Navigation Manifest

## 1. Overview

**FORGE** (Football-Oriented Recursive Grading Engine) is the core player evaluation system that computes Alpha scores (0–100) for NFL skill positions (QB, RB, WR, TE). It aggregates weekly statistical snapshots, role bank data, team context, and strength-of-schedule into four pillar scores—**Volume**, **Efficiency**, **Team Context**, and **Stability**—then applies position-specific weights across three scoring modes (redraft, dynasty, bestball) to produce a calibrated Alpha and tier assignment (T1–T5). A recursive pass blends prior Alpha history with momentum to smooth week-over-week volatility, and a Football Lens filter flags suspicious statistical patterns before final output.

---

## 2. Architecture Diagram

```
                         ┌─────────────────────────────────┐
                         │        contextFetcher.ts         │
                         │  (DB: snapshots, role banks,     │
                         │   team context, SoS, identity)   │
                         └───────────────┬─────────────────┘
                                         │ ForgeContext
                                         ▼
┌────────────────────────────────────────────────────────────────────┐
│                     forgeEngine.ts  (E)                             │
│                                                                    │
│  ┌──────────┐  ┌──────────────┐  ┌─────────────┐  ┌───────────┐  │
│  │  Volume   │  │  Efficiency  │  │ Team Context │  │ Stability │  │
│  │  Pillar   │  │   Pillar     │  │   Pillar     │  │  Pillar   │  │
│  └─────┬────┘  └──────┬───────┘  └──────┬───────┘  └─────┬─────┘  │
│        └───────────────┴────────────────┴────────────────┘         │
│                         │ ForgePillarScores                        │
└─────────────────────────┼──────────────────────────────────────────┘
                          ▼
              ┌───────────────────────┐
              │ forgeFootballLens.ts   │
              │ (F) Issue detection:   │
              │ TD spikes, vol/eff     │
              │ mismatches             │
              └───────────┬───────────┘
                          │ pillars + issues[]
                          ▼
┌────────────────────────────────────────────────────────────────────┐
│                     forgeGrading.ts  (G)                           │
│                                                                    │
│  Position weights ──► baseAlpha ──► recursionBias ──► tier map     │
│  (redraft/dynasty/     (0-100)      (80/20 blend,     (T1-T5)     │
│   bestball modes)                    ±3 momentum)                  │
│                                                                    │
│  QB Context blending: redraft 60/40, dynasty 40/60                 │
└────────────────────────┼───────────────────────────────────────────┘
                         │ alpha + tier
                         ▼
              ┌───────────────────────┐
              │   SoS Enrichment       │
              │ sosService + multiplier│
              │ (0.90–1.10 adjustment) │
              └───────────┬───────────┘
                          │ final enriched score
                          ▼
              ┌───────────────────────┐
              │   routes.ts / API      │
              │  34 endpoints          │
              └───────────────────────┘
```

---

## 3. File Index

### Backend Core (`server/modules/forge/`)

| File | Size | Role | Key Exports |
|------|------|------|-------------|
| `index.ts` | ~2K | Module barrel exports | `forgeService`, `getForgeBatch`, `getForgeScoreForPlayer`, type re-exports |
| `types.ts` | ~18K | All FORGE type definitions | `ForgeScore`, `ForgeSubScores`, `PlayerPosition`, `ForgeTrajectory`, `ForgeScoreOptions`, `IForgeService`, `ALPHA_WEIGHTS`, `TIBER_TIERS_2025`, `ALPHA_CALIBRATION` |
| `forgeEngine.ts` | ~36K | **E in E+G**: Data fetching, normalization, 4-pillar computation | `Position`, `MetricSource`, `PillarMetricConfig`, `PositionPillarConfig`, `ForgePillarScores`, `QbContextData`, `runForgeEngine()`, `computePillarScore()`, `createMetricLookup()` |
| `forgeGrading.ts` | ~9K | **G in E+G**: Weight application, mode adjustments, tier assignment | `ViewMode`, `ForgeWeights`, `ForgeGradeResult`, `gradeForge()`, `gradeForgeWithMeta()`, `mapAlphaToTier()`, `applyRecursionBias()` |
| `forgeFootballLens.ts` | ~5K | **F in FORGE**: Football-sense issue detection | `applyFootballLens()`, `FootballLensIssue` (severity: info/warn/block) |
| `forgeService.ts` | ~20K | High-level service facade | `forgeService` (singleton), `getForgeScoreForPlayer()`, `getForgeScoresBatch()` |
| `forgeGateway.ts` | ~2K | Batch query gateway | `getForgeBatch()`, `getForgeScoreForPlayer()`, `ForgeBatchQuery`, `ForgeBatchResult` |
| `forgeSnapshot.ts` | ~2K | Snapshot creation utility | `createForgeSnapshot()`, `ForgeSnapshotOptions`, `ForgeSnapshotMeta` |
| `forgeStateService.ts` | ~8K | Recursive state persistence | `getPlayerStateHistory()`, state read/write |
| `forgePlayerContext.ts` | ~14K | Player context resolution & search | `getForgePlayerContext()`, `searchForgePlayersSimple()` |
| `forgeAlphaModifiers.ts` | ~4K | Alpha adjustment modifiers | Modifier functions for alpha post-processing |
| `alphaEngine.ts` | ~22K | Original alpha calculation engine | `calculateAlphaScore()` |
| `alphaV2.ts` | ~5K | V2 alpha batch calculation | `batchCalculateAlphaV2()`, `AlphaV2Result` |
| `recursiveAlphaEngine.ts` | ~7K | Two-pass recursive scoring | `calculateRecursiveAlpha()`, `getRecursionSummary()` (80/20 blend, ±3 momentum) |
| `tiberTiers.ts` | ~6K | Tier thresholds and mapping | `assignTier()`, `assignSimpleTier()`, `applyMoverRules()`, `getTierThresholds()`, `getTierLabel()`, `getTierColor()` |
| `robustNormalize.ts` | ~4K | Normalization utilities | Robust percentile-based normalization |
| `contextModifiers.ts` | ~4K | Context adjustment modifiers | Context-based score adjustments |
| `qbContextPopulator.ts` | ~15K | QB context scoring | `populateQbContext2025()`, `getPrimaryQbContext()` (skill, redraft, dynasty, stability, durability) |
| `matchupService.ts` | ~8K | Matchup analysis | Matchup scoring for position vs defense |
| `dvpMatchupService.ts` | ~11K | Defense vs Position matchup | DvP-based matchup scoring |
| `environmentService.ts` | ~6K | Team environment detection | Environment score (0–100) computation |
| `envMatchupRefresh.ts` | ~17K | Environment matchup refresh | Bulk refresh of env + matchup data |
| `sosService.ts` | ~13K | Strength of schedule | `getTeamPositionSoS()`, `getPlayerSoS()`, `getAllTeamSoSByPosition()`, `getTeamWeeklySoS()` |
| `fibonacciPatternResonance.ts` | ~6K | Pattern resonance scoring | `computeFPRForPlayer()`, FPR pattern/band classification |
| `routes.ts` | ~85K | FORGE API routes (34 endpoints) | `registerForgeRoutes()`, `forgeRouter` |

### Subdirectories

| File | Role | Key Exports |
|------|------|-------------|
| `context/contextFetcher.ts` | DB context aggregation across week snapshots | `fetchContext()` |
| `features/wrFeatures.ts` | WR-specific feature builder | `buildWRFeatures()` |
| `features/rbFeatures.ts` | RB-specific feature builder | `buildRBFeatures()` |
| `features/teFeatures.ts` | TE-specific feature builder | `buildTEFeatures()` |
| `features/qbFeatures.ts` | QB-specific feature builder | `buildQBFeatures()` |
| `helpers/sosMultiplier.ts` | SoS multiplier calculation | `applySosMultiplier()` |
| `simulation/forgeSimService.ts` | Simulation service | Simulation scenarios |
| `utils/scoring.ts` | Scoring utilities | Helper scoring functions |
| `__tests__/recursiveAlphaEngine.test.ts` | Unit tests | Recursive engine tests |

### Backend Support (outside `forge/`)

| File | Role |
|------|------|
| `server/services/forgeContextLoader.ts` | Context loading service |
| `server/services/forgeRebuildService.ts` | Rebuild orchestration |
| `server/routes/adminForge.ts` | Admin FORGE endpoints |
| `server/routes/forgeSimRoutes.ts` | Simulation routes |
| `server/config/forgeSeason.ts` | Season configuration |
| `server/utils/playbookForgeLogger.ts` | FORGE-specific logging |
| `server/modules/ovr/ovrForgeAdapter.ts` | OVR system adapter (consumes FORGE scores) |
| `server/tests/forgeCalibration.spec.ts` | Calibration tests |

### Frontend

| File | Role |
|------|------|
| `client/src/pages/ForgeWorkbench.tsx` | Interactive engine explorer (`/forge-workbench`) |
| `client/src/pages/ForgeLab.tsx` | FORGE Lab page |
| `client/src/pages/ForgeLabEquationSandbox.tsx` | Equation sandbox |
| `client/src/pages/ForgeTransparency.tsx` | Transparency view |
| `client/src/pages/TiberTiers.tsx` | Rankings page using FORGE E+G |
| `client/src/pages/admin/ForgeHub.tsx` | Admin hub |
| `client/src/pages/admin/ForgeSimulation.tsx` | Admin simulation |
| `client/src/components/ForgeRankingsTable.tsx` | Rankings table component |
| `client/src/components/ForgeTransparencyPanel.tsx` | Transparency panel |
| `client/src/api/forge.ts` | FORGE API client (fetch helpers) |
| `client/src/types/forge.ts` | Frontend FORGE types |
| `client/src/forgeLab/equations.ts` | Lab equations |

---

## 4. Data Flow

### Primary E+G Pipeline

1. **Context Fetch** — `context/contextFetcher.ts` queries DB tables (`weekly_stats`, role banks, `team_offensive_context`, `sos_scores`, `player_identity_map`) and assembles a `ForgeContext` object for one player-season-week.
2. **Feature Building** — Position-specific feature builders (`features/wrFeatures.ts`, etc.) transform raw context into normalized feature bundles (volume, efficiency, stability, contextFit), each scored 0–100.
3. **Engine (E)** — `forgeEngine.ts` consumes the context, builds a metric lookup function, and computes four pillar scores using position-specific `PillarMetricConfig` definitions with weighted metric aggregation.
4. **Football Lens (F)** — `forgeFootballLens.ts` scans the pillar scores and raw metrics for football-sense issues (TD regression, volume/efficiency mismatches). Issues carry severity levels: `info`, `warn`, `block`.
5. **Grading (G)** — `forgeGrading.ts` applies position-specific weights per mode (redraft/dynasty/bestball), computes `baseAlpha`, blends QB context into `teamContext` pillar, applies recursion bias (80% current + 20% prior, ±3 momentum cap), then maps to tier (T1–T5).
6. **SoS Enrichment** — `sosService.ts` provides RoS/next-3/playoff SoS; `helpers/sosMultiplier.ts` applies a 0.90–1.10 multiplier to produce the final `alpha`.
7. **API Response** — `routes.ts` serves the enriched score to clients.

### Recursive Scoring Flow

1. `recursiveAlphaEngine.ts` fetches current Alpha + prior Alpha from `forgeStateService.ts`.
2. Blends: `finalAlpha = 0.80 * currentAlpha + 0.20 * priorAlpha`.
3. Applies momentum adjustment: clamped to ±3 points max.
4. Persists updated state for next week's recursion.

### QB Context Flow

1. `qbContextPopulator.ts` → `populateQbContext2025()` computes 5 QB sub-scores (skill, redraft, dynasty, stability, durability).
2. `getPrimaryQbContext()` identifies the franchise QB for a team (injury-aware: <5 games = outlier).
3. `forgeGrading.ts` blends QB context into `teamContext` pillar: redraft (60% team + 40% QB), dynasty (40% team + 60% QB).

### Workbench Flow

1. `forgePlayerContext.searchForgePlayersSimple()` — fuzzy player search.
2. `forgeEngine.runForgeEngine()` — full pillar computation.
3. `forgeGrading.gradeForge()` — scored across all 3 modes simultaneously.

---

## 5. API Endpoints

All routes are prefixed with `/api/forge/`.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/preview` | Batch preview scores by position (SoS-enriched) |
| `GET` | `/preview-v2` | V2 Alpha batch preview (recency bias, games floor) |
| `GET` | `/score/:playerId` | Single player FORGE score (SoS-enriched) |
| `GET` | `/health` | Service health check |
| `GET` | `/batch` | Batch scoring (position, limit, week range, PPR/dynasty) |
| `GET` | `/recursive/batch` | Recursive batch scoring with trajectory awareness |
| `GET` | `/recursive/player/:playerId` | Recursive scoring history for one player |
| `POST` | `/snapshot` | Trigger snapshot export (dev-only) |
| `GET` | `/eg/batch` | E+G batch scoring (`?position=WR&mode=dynasty`) |
| `GET` | `/eg/player/:playerId` | Single player E+G scoring |
| `GET` | `/workbench/search` | Player search (`?q=name`) |
| `GET` | `/workbench/player/:playerId` | Full workbench query (all 3 modes) |
| `GET` | `/player/:playerId/fpr` | Fibonacci Pattern Resonance for player |
| `GET` | `/player/:playerId/advanced` | Advanced stats summary |
| `GET` | `/player/:playerId/fantasy-summary` | Fantasy stats summary |
| `GET` | `/sos/team` | Team SoS by position |
| `GET` | `/sos/player/:playerId` | Player SoS |
| `GET` | `/sos/all` | All teams SoS by position |
| `GET` | `/sos/weekly` | Team weekly SoS |
| `GET` | `/environment/team/:team` | Team environment score |
| `GET` | `/matchup/:offTeam/:defTeam` | Matchup score |
| `GET` | `/debug/distribution` | Raw alpha distribution (calibration) |
| `POST` | `/admin/qb-context/populate` | Populate QB context table |
| `GET` | `/admin/qb-context/:team` | Get QB context for team |
| `POST` | `/admin/env-matchup/refresh` | Refresh environment + matchup data |
| `GET` | `/admin/calibration` | Calibration parameters |
| `GET` | `/transparency/:playerId` | Score transparency breakdown |
| `GET` | `/tiers` | Tier thresholds by position |
| `GET` | `/sim/run` | Run simulation scenario |

Additional admin routes in `server/routes/adminForge.ts` and simulation routes in `server/routes/forgeSimRoutes.ts`.

---

## 6. Database Tables

| Table | Purpose | Used By |
|-------|---------|---------|
| `weekly_stats` | Weekly player statistics (fantasy pts, snaps, targets, etc.) | contextFetcher, forgeService |
| `player_identity_map` | Canonical ↔ Sleeper ↔ GSIS ID resolution | forgeEngine, forgePlayerContext |
| `team_offensive_context` | Team offensive metrics (pass EPA, rush EPA, CPOE, etc.) | forgeEngine (teamContext pillar) |
| `team_defensive_context` | Team defensive metrics | dvpMatchupService |
| `sos_scores` | Strength of schedule scores by team/position | sosService, forgeEngine |
| `defense_dvp` | Defense vs Position matchup data | dvpMatchupService, routes |
| `game_logs` | Player game logs | routes (advanced stats), contextFetcher |
| `qb_context_2025` | QB context scores (dynamic table) | qbContextPopulator |
| `{pos}_role_bank` | Position role bank tables (`wr_role_bank`, `rb_role_bank`, etc.) | forgeEngine (dynamic query) |

---

## 7. Cross-Module Dependencies

### FORGE Depends On

| Dependency | File | Usage |
|------------|------|-------|
| Database | `server/infra/db.ts` | All DB queries |
| Schema | `shared/schema.ts` | Table definitions (`playerIdentityMap`, `gameLogs`, etc.) |
| Player Identity | `server/services/PlayerIdentityService.ts` | Canonical ID resolution |
| Drizzle ORM | `drizzle-orm` | Query builder |

### Modules That Depend On FORGE

| Consumer | File | Usage |
|----------|------|-------|
| OVR Module | `server/modules/ovr/ovrForgeAdapter.ts` | Adapts FORGE scores for OVR system |
| TiberTiers Page | `client/src/pages/TiberTiers.tsx` | Displays FORGE-powered rankings |
| ForgeWorkbench | `client/src/pages/ForgeWorkbench.tsx` | Interactive E+G explorer |
| ForgeLab | `client/src/pages/ForgeLab.tsx` | Equation sandbox |
| Dashboard | `client/src/pages/Dashboard.tsx` | Surfaces FORGE data |
| Admin Hub | `client/src/pages/admin/ForgeHub.tsx` | Admin controls |

---

## 8. Common Tasks

### Add a New Pillar Metric

1. **Define metric config** in `forgeEngine.ts` — add entry to the position's `PillarConfig.metrics[]` array (e.g., `WR_PILLARS.volume.metrics`).
2. **Set normalization range** in `forgeEngine.ts` → `normalizeMetric()` → `normalizationRanges` map.
3. **Ensure data source** — if `role_bank`, verify the column exists in the position's role bank table. If `derived`, implement in `computeDerivedMetric()`.
4. **Verify weights sum** — pillar metric weights should sum to 1.0.

### Add a New Position

1. **Add type** in `types.ts` → extend `PlayerPosition` union.
2. **Create pillar config** in `forgeEngine.ts` → new `*_PILLARS` constant + add case in `getPositionPillarConfig()`.
3. **Create feature builder** in `features/` → new `build*Features()` function.
4. **Add weights** in `forgeGrading.ts` → `POSITION_WEIGHTS` and `DYNASTY_WEIGHTS`.
5. **Add tier thresholds** in `forgeGrading.ts` → `POSITION_TIER_THRESHOLDS`, and `types.ts` → `TIBER_TIERS_2025`.
6. **Add calibration** in `types.ts` → `ALPHA_CALIBRATION`.
7. **Update routes** in `routes.ts` to accept the new position value.

### Adjust Scoring Mode Weights

1. **Redraft weights** → `forgeGrading.ts` → `POSITION_WEIGHTS`.
2. **Dynasty weights** → `forgeGrading.ts` → `DYNASTY_WEIGHTS`.
3. **Bestball** is computed dynamically from redraft weights with efficiency boost + stability reduction.

### Recalibrate Alpha Range

1. Run `/api/forge/debug/distribution?position=WR` to observe raw alpha distribution (p10, p50, p90, max).
2. Update `types.ts` → `ALPHA_CALIBRATION` with new `p10`/`p90` observations.
3. Adjust `outMin`/`outMax` for desired calibrated range.

### Add a New API Endpoint

1. Add route handler in `routes.ts` (or `server/routes/adminForge.ts` for admin-only).
2. If it needs new service logic, extend `forgeService.ts`.
3. Add frontend fetch helper in `client/src/api/forge.ts`.
4. Add corresponding TypeScript types to `client/src/types/forge.ts` if response shape is new.

### Change Tier Thresholds

1. Update `types.ts` → `TIBER_TIERS_2025` (display config).
2. Update `forgeGrading.ts` → `POSITION_TIER_THRESHOLDS` (grading logic).
3. Optionally update `tiberTiers.ts` for label/color mapping.

### Debug a Player's Score

1. Hit `GET /api/forge/transparency/:playerId` for full pillar breakdown.
2. Hit `GET /api/forge/workbench/player/:playerId?position=WR` for all-mode comparison.
3. Check `GET /api/forge/debug/distribution?position=WR` for calibration context.
4. Review `forgeEngine.ts` console logs for metric lookup values.
