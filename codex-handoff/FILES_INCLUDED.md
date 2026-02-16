# FILES INCLUDED — Domain Map

All paths relative to project root.

---

## 1. FORGE Engine (READ ONLY — do not modify logic)

| File | Lines | Purpose |
|------|-------|---------|
| `server/modules/forge/forgeEngine.ts` | 1034 | Core engine: `runForgeEngine()` computes 4 pillar scores per player. `runForgeEngineBatch()` loops sequentially (this is the 38s bottleneck). `fetchForgeContext()` gathers roleBank + teamContext + SoS. |
| `server/modules/forge/forgeGrading.ts` | 269 | Applies position-specific weights → raw Alpha → calibrated Alpha → tier assignment |
| `server/modules/forge/forgeFootballLens.ts` | 177 | Detects football-sense issues (game script, injury, role change) and applies adjustments |
| `server/modules/forge/types.ts` | 617 | All FORGE types: `ForgeScore`, `ForgeSubScores`, `ALPHA_WEIGHTS`, `TIBER_TIERS_2025`, `ForgeContext`, pillar configs |
| `server/modules/forge/alphaV2.ts` | 182 | Alpha V2 formula: recency bias (last 4 weeks = 65%), position weights, elite ceiling protection |
| `server/modules/forge/alphaEngine.ts` | ~200 | Alpha calculation: weighted pillar aggregation |
| `server/modules/forge/recursiveAlphaEngine.ts` | 211 | Two-pass recursive scoring (Pass 0 raw → Pass 1 surprise/momentum adjustment) |
| `server/modules/forge/tiberTiers.ts` | ~150 | `assignTier()`, `assignSimpleTier()`, tier thresholds per position |
| `server/modules/forge/forgeService.ts` | 574 | Main service: `getForgeScoreForPlayer()`, `getForgeScoresBatch()` — high-level API |
| `server/modules/forge/forgeGateway.ts` | 75 | Internal gateway: `getForgeBatch()` for server-side consumers |
| `server/modules/forge/forgeSnapshot.ts` | 70 | File-based snapshot creation (writes JSON to `data/forge/`) |
| `server/modules/forge/index.ts` | 76 | Module exports |
| `server/modules/forge/features/wrFeatures.ts` | ~200 | WR feature builder |
| `server/modules/forge/features/rbFeatures.ts` | ~200 | RB feature builder |
| `server/modules/forge/features/teFeatures.ts` | ~200 | TE feature builder |
| `server/modules/forge/features/qbFeatures.ts` | ~200 | QB feature builder |

## 2. FORGE Routes (MODIFY — add new endpoint)

| File | Lines | Purpose |
|------|-------|---------|
| `server/modules/forge/routes.ts` | 2595 | All FORGE HTTP routes. **Add** `/api/forge/tiers` (GET) and `/api/forge/compute-grades` (POST) here. |

## 3. Database Schema (MODIFY — add new table)

| File | Lines | Purpose |
|------|-------|---------|
| `shared/schema.ts` | 5284 | All Drizzle ORM table definitions. **Add** `forge_grade_cache` table. Existing relevant tables: `forgePlayerState` (line 4494), `wrRoleBank` (line 3438), `rbRoleBank` (3528), `teRoleBank` (3603), `qbRoleBank` (3676), `teamOffensiveContext` (1780), `datadiveSnapshotPlayerWeek` (4832). |

## 4. Frontend (MODIFY — switch data source)

| File | Lines | Purpose |
|------|-------|---------|
| `client/src/pages/TiberTiers.tsx` | 530 | Tiers page component. Currently fetches from `/api/data-lab/lab-agg` and applies PPG tier thresholds. **Replace** with `/api/forge/tiers` fetch and FORGE-native rendering. |

## 5. New Files to Create

| File | Purpose |
|------|---------|
| `server/modules/forge/forgeGradeCache.ts` | Grade computation + DB caching service. Calls `runForgeEngine()` per player, applies lens + grading, upserts to `forge_grade_cache`. |

## 6. Data Lab (REFERENCE ONLY — do not modify)

| File | Lines | Purpose |
|------|-------|---------|
| `server/modules/datalab/snapshots/snapshotRoutes.ts` | 1571 | `/api/data-lab/lab-agg` endpoint (line 1195). Currently powers Tiers page. After migration, Tiers page will no longer use this. |

## 7. Supporting Infrastructure (REFERENCE ONLY)

| File | Purpose |
|------|---------|
| `server/infra/db.ts` | Database connection (`db` export, uses `@neondatabase/serverless`) |
| `server/modules/forge/forgeStateService.ts` | Recursion state persistence (reads/writes `forge_player_state`) |
| `server/modules/forge/context/contextFetcher.ts` | Context data fetcher for FORGE service |
| `server/services/datadiveContext.ts` | Datadive snapshot helpers |

## 8. Related Config

| File | Purpose |
|------|---------|
| `drizzle.config.ts` | Drizzle config — DO NOT EDIT |
| `package.json` | Dependencies — DO NOT EDIT directly, use packager tool |
