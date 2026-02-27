# Codex — Work Log

Agent: OpenAI Codex
Platform: GitHub (PR-based workflow)
Branch Pattern: `codex/<task-slug>`
Workflow: Creates PRs on GitHub, merged by Architect J after review

---

## Completed Tasks

### PR #11 — 2026-02-15: Add NFL Personnel Grouping Visibility
- **Branch:** `codex/add-nfl-personnel-grouping-visibility`
- **Commit:** `62042440` (merged via `b75f5a13`)
- **Summary:** Created the full personnel module infrastructure — service layer, classifier, API routes, and backfill script. Added 3 new columns to `bronze_nflfastr_plays` (`offense_personnel`, `defense_personnel`, `offense_formation`). Backfilled 45,184 plays with personnel data from nflverse pbp_participation parquet.
- **Key Files:**
  - `server/modules/personnel/personnelService.ts` — Personnel profile query service
  - `server/modules/personnel/personnelClassifier.ts` — Every-down grade classification
  - `server/routes/personnelRoutes.ts` — GET /api/personnel/profile endpoint
  - `server/scripts/backfillPersonnel.ts` — Data ingestion script
  - `shared/schema.ts` — 3 columns added to bronzeNflfastrPlays
- **Validation:** 92.6% personnel data coverage across 2025 plays

### PR #9 — 2025-12-28: NFLfastR Inventory Audit
- **Branch:** `codex/produce-nflfastr-inventory-audit`
- **Summary:** Produced audit of nflfastr data inventory.

### PR #8 — 2025-12-16: FORGE Scoring Audit & Playbook Sync
- **Branch:** `codex/audit-forge-scoring-and-playbook-sync`
- **Summary:** Audited FORGE scoring system and synced playbook documentation.

### PR #7 — 2025-12-16: UI/UX Cleanup for Homepage Redesign
- **Branch:** `codex/ui/ux-cleanup-for-homepage-redesign`
- **Summary:** UI/UX cleanup work supporting the homepage redesign effort.

### PR #6 — 2025-12-14: Sleeper Sync & League Overview
- **Branch:** `codex/implement-sleeper-sync-and-league-overview`
- **Summary:** Implemented Sleeper league sync and overview features.

### PR #5 — 2025-12-13: Sleeper League Sync v1
- **Branch:** `codex/implement-sleeper-league-sync-v1`
- **Summary:** First version of Sleeper league synchronization.

### PR #4 — 2025-12-11: Command Hub & Journal Analysis
- **Branch:** `codex/analyze-command-hub-and-journal-implementation`
- **Summary:** Analysis of command hub and journal implementation patterns.

### PR #3 — 2025-12-10: Remove Legacy Oasis/OTC Naming
- **Branch:** `codex/remove-legacy-oasis/otc-naming`
- **Summary:** Cleaned up legacy naming references (Oasis, OTC).

### PR #2 — 2025-12-10: Rebrand to Tiber/TrackStar
- **Branch:** `codex/replace-otc,-oasis,-hardening-with-tiber,-trackstar`
- **Summary:** Replaced all OTC/Oasis/Hardening references with Tiber/TrackStar branding.

### PR #1 — 2025-12-09: FORGE Scoring Documentation
- **Branch:** `codex/generate-internal-documentation-for-forge-scoring-system`
- **Summary:** Generated comprehensive internal documentation for the FORGE scoring system.

---

## Notes for Future Sessions

- Codex works via GitHub PRs — always create a branch named `codex/<task-slug>` before starting work.
- PRs are reviewed and merged by Architect J.
- Codex has been strong at audits, data pipeline work, refactoring, and documentation.
- Personnel module was originally built by Codex (PR #11), then the frontend was added by Replit Agent, then the undercounting fix was done by Claude Code.

### Unreleased — 2026-02-16: FORGE tiers cache migration
- **Branch:** current working branch
- **Summary:** Migrated Tiers page from live batch/PPG-derived behavior to cached canonical FORGE Alpha grades. Added `forge_grade_cache` DB table, a compute-and-cache service, and new FORGE endpoints for cache reads and admin-triggered recomputation.
- **Key Files:**
  - `shared/schema.ts` — `forge_grade_cache` table + indexes + types
  - `server/modules/forge/forgeGradeCache.ts` — compute pipeline, fantasy stat enrichment, upsert, cache reads
  - `server/modules/forge/routes.ts` — GET `/api/forge/tiers`, POST `/api/forge/compute-grades`
  - `client/src/pages/TiberTiers.tsx` — switched data source to `/api/forge/tiers`, fallback UX, FORGE-native table fields
- **Validation:** `npm run build` succeeds; db/test/dev commands blocked by missing DB env in this container.

### Unreleased — 2026-02-17: FORGE snapshot data quality guardrails
- **Branch:** current working branch
- **Summary:** Implemented `snapshotDataValidator` for FORGE snapshot ingestion and wired it into xFP volume, role consistency, and context path snapshot validation. Added unit coverage for all core rules plus low-sample warning behavior.
- **Key Files:**
  - `server/modules/forge/snapshotDataValidator.ts` — Validator rules, warning model, summary logging
  - `server/modules/forge/xfpVolumePillar.ts` — Validates snapshot rows before xFP aggregation
  - `server/modules/forge/roleConsistencyPillar.ts` — Validates rows in `fetchWeeklyRoleData`
  - `server/modules/forge/forgeEngine.ts` — Validates context snapshot rows and aligns games played with clean snapshot weeks
  - `server/modules/forge/__tests__/snapshotDataValidator.test.ts` — Rule-by-rule validator tests
- **Validation:** `npm test -- server/modules/forge/__tests__/snapshotDataValidator.test.ts` passed; `npm run test:forge` blocked by missing `DATABASE_URL` in this environment.

### Unreleased — 2026-02-17: FORGE end-to-end integration tests
- **Branch:** current working branch
- **Summary:** Created `forgeIntegration.test.ts` for real DB-backed FORGE coverage with five categories: per-position sanity checks, seasonal pinned-player assertions, cross-position consistency rules, mode consistency checks, and explicit stability regression guards.
- **Key Files:**
  - `server/modules/forge/__tests__/forgeIntegration.test.ts` — New integration suite using `runForgeEngineBatch`, `gradeForgeWithMeta`, and direct `player_identity_map` canonical-ID lookup via `db`
- **Validation:** `NODE_OPTIONS=--experimental-vm-modules npx jest --config jest.config.cjs --runInBand server/modules/forge/__tests__/forgeIntegration.test.ts` failed in this environment because `DATABASE_URL` is unset.

### Unreleased — 2026-02-17: FORGE QB continuous volume via xFP
- **Branch:** current working branch
- **Summary:** Migrated QB volume pillar from quantized role-bank metrics to derived `xfp_per_game` (v3 xFP), matching RB/WR/TE continuous volume treatment and reducing bucketed rank ties.
- **Key Files:**
  - `server/modules/forge/forgeEngine.ts` — QB volume pillar now uses `{ metricKey: 'xfp_per_game', source: 'derived', weight: 1.0 }`
  - `server/services/xFptsConfig.ts` — added QB xFP sanity documentation and adjusted QB normalization range to `{ min: 7.5, max: 24.0 }`
- **Validation:** `NODE_OPTIONS=--experimental-vm-modules npx jest --config jest.config.cjs --runInBand server/modules/forge/__tests__/forgeIntegration.test.ts` blocked by missing `DATABASE_URL`; `npm run build` passed.

### Unreleased — 2026-02-17: FORGE FPOE-first efficiency pillar
- **Branch:** current working branch
- **Summary:** Updated FORGE efficiency pillar configs to center on derived `fpoe_per_game` for WR/RB/TE/QB, reducing overlap with the xFP-based volume pillar and preserving QB passing-skill context with EPA/CPOE/sack-rate secondary metrics.
- **Key Files:**
  - `server/modules/forge/forgeEngine.ts` — updated per-position efficiency metric weights/sources; retained and annotated FPOE normalization `[-5, +10]`
- **Validation:** `npm test -- server/modules/forge/__tests__/snapshotDataValidator.test.ts` passed; `npm run build` passed with existing warning in `server/olc/adjusters.ts`.
- **Notes:** Requested FPOE percentile SQL validation blocked in this environment because `DATABASE_URL` is unset.

### Unreleased — 2026-02-18: Fantasy Lab Phase 1 weekly data foundation
- **Branch:** `feature/fantasy-lab-phase1`
- **Summary:** Implemented backend-only Phase 1 foundation for Fantasy/Market Lab by adding a consolidated weekly materialized view (`fantasy_metrics_weekly_mv`) and new APIs for weekly + player time-series access, plus admin-controlled MV refresh.
- **Key Files:**
  - `migrations/0011_fantasy_lab_weekly_mv.sql` — consolidated MV definition + indexes
  - `server/routes/fantasyLabRoutes.ts` — `/weekly`, `/player`, and `/refresh` handlers
  - `server/routes.ts` — mounted `/api/fantasy-lab/*` and `/api/admin/fantasy-lab/*`
  - `server/scripts/qaFantasyLabPhase1.ts` — sanity checks for non-zero rows, xFP not-all-null, uniqueness
  - `server/modules/fantasyLab/README.md` — source lineage and latest-vs-weekly field docs
- **Validation:** `npm run build` passed (existing duplicate-member warning in `server/olc/adjusters.ts`), `npm run typecheck` failed due unrelated repo-wide TS issues, `npm run qa:fantasy-lab -- 2025 1` failed in this container due PostgreSQL connection refusal.

### 2026-02-19 — Fantasy Lab Phase 2 (FIRE + Delta + Minimal UI)
- Implemented new APIs:
  - `GET /api/fire/eg/batch`
  - `GET /api/fire/eg/player`
  - `GET /api/delta/eg/batch`
- FIRE details:
  - RB/WR/TE-only, rolling 4-week window anchored to `week`
  - Eligibility by rolling snaps (RB >= 50, WR/TE >= 80)
  - Pillars via position-percentile ranks (opportunity, role, conversion)
  - Composite formula: `0.60*Opp + 0.25*Role + 0.15*Conv`
  - RoleIndex includes fallback logic for missing route/target fields with metadata flags
- Delta details:
  - Hybrid delta where display uses percentile (`ForgePct - FirePct`) and ranking uses z-score delta (`z(alpha)-z(fire)`)
  - BUY_LOW / SELL_HIGH labels based on rankZ and displayPct thresholds
- Frontend:
  - Added `/fantasy-lab` route and sidebar nav entry
  - Added controls and tables for FIRE and DELTA tabs
  - Added explicit QB-FIRE-unavailable notice and empty-state handling
- Validation:
  - `npm run build` ✅
  - `npm run dev` blocked (no `DATABASE_URL` in environment)

### 2026-02-20 — QB FIRE v1 (Opportunity + Role only)
- Added migration `0012_qb_fire_v1.sql` to create `qb_xfp_weekly` and augment `fantasy_metrics_weekly_mv` with QB xFP + role-support fields.
- Added ETL entrypoint `scripts/etl/qb_xfp_weekly.py` implementing:
  - Bucketed pass TD / INT / rush TD probabilities with Beta smoothing (`alpha=1`, `beta=20`)
  - Conditional pass yardage by air-yards bucket and QB rush yardage by league QB YPC
  - Upsert into `qb_xfp_weekly` and scoring outputs for redraft/dynasty presets.
- Updated FIRE route logic to include QBs in `/api/fire/eg/batch` and `/api/fire/eg/player`:
  - Added `scoringPreset` param (`redraft|dynasty`, default redraft)
  - QB eligibility: `dropbacks_R >= 80 OR snaps_R >= 100`
  - QB RoleIndex = `0.60*rank(dropbacks_R)+0.25*rank(qb_rush_attempts_R)+0.15*rank(inside10_dropbacks_R)`
  - QB composite: `0.75*Opportunity + 0.25*Role` (no conversion pillar yet)
- Updated fantasy-lab admin refresh endpoint to run the QB xFP ETL before refreshing the MV.
- Added reports:
  - `reports/qb_fire_v1_data_audit.md`
  - `reports/qb_fire_v1_validation.md`
- Validation:
  - `npm run build` ✅
  - DB-dependent checks blocked (`DATABASE_URL` missing in environment).

### 2026-02-23 — FORGE IDP Phase 1 integration scaffold
- Added new IDP modules under `server/modules/forge/idp/`:
  - `idpIngestion.ts` (nflverse defensive CSV pull + upsert into `idp_player_week` / `idp_player_season`)
  - `idpBaselines.ts` (season baseline aggregation into `idp_position_baselines`)
  - `idpPillars.ts` (pillar/weight config for EDGE/DI/LB/CB/S)
  - `idpTeamContext.ts` (defense personnel parser + simple scheme fit scoring)
  - `idpCalibration.ts` (placeholder percentile anchors)
  - `idpForgeEngine.ts` (IDP context + metric lookup + pillar computation)
- Added shared IDP constants/types in `shared/idpSchema.ts`.
- Extended FORGE position typing in `forgeEngine.ts` with offensive/defensive splits and guards (`isDefensivePosition`, `isOffensivePosition`), then routed defensive requests through `runIdpForgeEngine`.
- Updated batch logic to source defensive player IDs from `idp_player_season` with concurrency control.
- Updated grading/cache/types integration to accept defensive positions (`forgeGrading.ts`, `forgeGradeCache.ts`).
- Added admin API router `server/routes/idpAdminRoutes.ts` and mounted it at `/api/admin/idp` in `server/routes.ts`.
- Validation:
  - `npx tsc --noEmit` (fails due existing repo-wide TS issues)
  - `npx tsc --noEmit --pretty false <changed files...>` (fails due existing dependency/global typing issues)

### 2026-02-24 — CATALYST Phase 0 PBP enrichment (wp + score differential)
- Added `wp` and `score_differential` fields to `bronze_nflfastr_plays` Drizzle schema in `shared/schema.ts`.
- Added migration `0013_catalyst_pbp_enrichment.sql`:
  - `ALTER TABLE` add columns if missing
  - backfill from `raw_data->>'wp'` and `raw_data->>'score_differential'`
  - add supporting season/week composite indexes including each new metric.
- Updated NFLfastR ingestion scripts to populate the new columns during imports:
  - `server/scripts/import_nflfastr_2024_bulk.py`
  - `server/scripts/import_nflfastr_2025_bulk.py`
  - `server/scripts/fast_nflfastr_import.py`
- Added `server/scripts/validate_catalyst_pbp_enrichment.py` to run coverage/range checks and a 100-play 2024 Week 1 spot-check sample.
- Validation:
  - `python -m py_compile server/scripts/import_nflfastr_2024_bulk.py server/scripts/import_nflfastr_2025_bulk.py server/scripts/fast_nflfastr_import.py server/scripts/validate_catalyst_pbp_enrichment.py` ✅
  - `npm run build` ✅ (with pre-existing duplicate class member warning in `server/olc/adjusters.ts`)
  - DB checks blocked in this environment because `DATABASE_URL` is not set.

### 2026-02-27 — CODEX-001: Unit Tests for `alphaEngine.ts`
- Added `server/modules/forge/__tests__/alphaEngine.test.ts` with 12 synchronous unit tests for `calculateAlphaScore`.
- Mocked `server/infra/db`, `fibonacciPatternResonance`, and `forgeAlphaModifiers` to keep tests deterministic and free of runtime DB requirements.
- Covered output contract, bounds clamping, position handling (QB/RB/WR/TE), dynasty vs redraft age logic, modifier call plumbing, and edge inputs (0/100 scores + gamesPlayed=1 NaN guard).
- Validation: `npx jest server/modules/forge/__tests__/alphaEngine.test.ts` passed.
