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

### 2026-03-02 — Rookie profiles DB schema + seed script
- Added `rookie_profiles` table in `shared/schema.ts` with profile/grade/combine fields and supporting indexes.
- Added `scripts/seed-rookie-profiles.ts` that reads `data/rookies/2026_combine_results.json` + `data/rookies/2026_rookie_grades.json`, merges by normalized player name, validates 91 rows, and inserts into `rookie_profiles` via `server/infra/db.ts`.
- Validation: `npm run db:push` attempted, but environment has no `DATABASE_URL`.

### 2026-03-06 — Canonical trade analyze endpoint (v1) + comparison semantic cleanup
- Added compatibility-aware compare semantics in `POST /api/v1/intelligence/compare` by accepting canonical `player_a/player_b` and transitional aliases `player1/player2`, while keeping canonical `ComparisonResponse` output and existing comparison service logic unchanged.
- Implemented `POST /api/v1/intelligence/trade/analyze` returning canonical `TradeAnalysisResponse` by adapting existing `evaluateTradePackage` output through a new mapper (`server/api/v1/mappers/toTradeAnalysisResponse.ts`).
- Kept legacy trade routes/services working; no changes to transitional routes in `server/routes/*` or trade service scoring logic.
- Validation run:
  - `npm run typecheck` (fails due pre-existing repository-wide TS errors)
  - `npm test` (fails in existing suites; includes `DATABASE_URL`-dependent failure)
  - `npx tsc --noEmit server/api/v1/routes.ts server/api/v1/mappers/toTradeAnalysisResponse.ts` (fails due pre-existing global typings/dependency issues)

### 2026-03-20 — External model adapter layer for role opportunity
- Added `server/modules/externalModels/` as the first dedicated boundary for promoted lab/model repos.
- Implemented `Role-and-opportunity-model` integration as a focused client/adapter/service stack:
  - `roleOpportunityClient.ts` for env-based config, timeout handling, and HTTP→typed error mapping.
  - `roleOpportunityAdapter.ts` for canonical payload validation and stable TIBER insight mapping.
  - `roleOpportunityService.ts` for the internal interface consumed by routes.
- Added contained integration routes in `server/routes/roleOpportunityIntegrationRoutes.ts`:
  - `GET /api/integrations/role-opportunity/:playerId?season=2025&week=17`
  - `GET /api/integrations/role-opportunity/health`
- Registered the new route module in `server/routes.ts` without widening the integration surface elsewhere.
- Updated docs/conventions (`README.md`, `replit.md`, `.claude/conventions.md`) to document the adapter pattern and required env vars.
- Added tests covering:
  - canonical payload → internal insight mapping
  - malformed payload rejection
  - timeout mapping
  - 404 mapping
  - integration endpoint envelope
  - disabled/missing-config behavior
- Validation:
  - `npm test -- roleOpportunityAdapter.test.ts` ✅
  - `npm test -- roleOpportunityIntegrationRoutes.test.ts` ✅
  - `npm run build` ✅
  - `curl http://127.0.0.1:<port>/api/integrations/role-opportunity/health` against a minimal local Express mount ✅

### 2026-03-20 — Player detail role opportunity enrichment
- Added opt-in `roleOpportunityInsight` enrichment to `GET /api/player-identity/player/:id` using the existing external-model adapter/service rather than direct upstream calls.
- Added `playerDetailEnrichment.ts` helper to convert role-opportunity success/failure into a stable player-detail status envelope with `available`, `fetchedAt`, and either `data` or `error`.
- Added focused tests covering:
  - normal player detail response with no enrichment request
  - enriched player detail response when requested
  - successful upstream mapping into the player-detail envelope
  - timeout, unavailable, not-found, disabled-config, and malformed-payload containment
- Updated `README.md`, `replit.md`, and `server/modules/externalModels/MODULE.md` with the endpoint contract, opt-in query params, example payloads, and explicit non-fatal behavior.
- Validation:
  - `npx jest --config jest.config.cjs --runInBand --coverage=false server/modules/externalModels/roleOpportunity/__tests__/playerDetailEnrichment.test.ts` ✅
  - `npx jest --config jest.config.cjs --runInBand --coverage=false server/routes/__tests__/playerIdentityRoutes.test.ts` ✅
  - `npm run build` ✅ (with existing duplicate-class-member warning in `server/olc/adjusters.ts`)

### 2026-03-20 — Player detail enrichment orchestrator for external insights
- Added `server/modules/externalModels/playerDetailEnrichment/` with:
  - `types.ts` defining stable request/result contracts for player-detail external insights.
  - `playerDetailEnrichmentOrchestrator.ts` delegating enrichment assembly and keeping role-opportunity failure-tolerant.
- Refactored `server/routes/playerIdentityRoutes.ts` so the route now parses/validates query params, fetches the base player identity, and delegates opt-in external insight assembly to the orchestrator.
- Added/updated tests covering:
  - empty orchestration result when no enrichments are requested
  - happy-path role-opportunity orchestration
  - preserved unavailable/error envelopes
  - clear missing-season/week handling inside the orchestrator
  - route compatibility for happy path, unavailable path, and missing-param validation
- Updated docs (`README.md`, `server/modules/externalModels/MODULE.md`, `replit.md`) to document the orchestrator as the extension point for future player-detail insights.
- Validation:
  - `NODE_OPTIONS=--experimental-vm-modules npx jest --config jest.config.cjs --runInBand --coverage=false server/modules/externalModels/playerDetailEnrichment/__tests__/playerDetailEnrichmentOrchestrator.test.ts server/routes/__tests__/playerIdentityRoutes.test.ts server/modules/externalModels/roleOpportunity/__tests__/playerDetailEnrichment.test.ts` ✅
  - `npm run build` ✅ (existing duplicate-class-member warning remains in `server/olc/adjusters.ts`)


### 2026-03-20 — Module classification audit + architecture doctrine
- Added `docs/architecture/TIBER_FANTASY_MODULE_CLASSIFICATION_AUDIT.md` to classify major in-repo model-like systems as `CORE`, `LEGACY_CORE_TEMP`, `EXTRACT`, `DEPRECATE_NOW`, `DELETE_AFTER_REPLACEMENT`, or `UNKNOWN`.
- Documented the cleanup map with executive summary, classification table, extraction priorities, safe-to-keep core list, orphan/unclear list, and staged cleanup plan.
- Updated `README.md`, `server/modules/externalModels/MODULE.md`, and `replit.md` with a short doctrine note: TIBER-Fantasy is the shell/orchestration core, while standalone model brains should live outside core when practical and be consumed through adapters/orchestrators.
- Validation run:
  - `git diff --check` ✅
  - `npm run build` ✅ (existing duplicate class member warning remains in `server/olc/adjusters.ts`)

### 2026-03-20 — Legacy module freeze/extraction notices
- Added visible local notices for the highest-priority audit targets so contributors see freeze/extract guidance inside the module folders they are most likely to open.
- Updated module docs for FORGE, Metric Matrix, Start/Sit, and OVR.
- Added new local module notices for CATALYST, doctrine, and tiberMatrix.
- Added FIRE extraction/freeze notices in both `server/modules/fantasyLab/README.md` and the top of `server/routes/fireRoutes.ts`.
- Added `docs/architecture/LEGACY_MODULE_WORK_RULES.md` to convert the audit doctrine into practical contribution rules.
- Validation:
  - `git diff --check` ✅
  - `npm run build` ✅ (existing duplicate class member warning remains in `server/olc/adjusters.ts`)

### 2026-03-21 — Codex: FORGE externalization transition spec
- **What changed:** Added a concrete FORGE externalization transition spec defining the future external service contract, TIBER/core responsibilities, and staged migration plan. Updated FORGE module docs to point contributors at the new spec, added an external-models note that FORGE is the next planned target, and refreshed the architecture doctrine summary.
- **Files modified:** `docs/architecture/FORGE_EXTERNALIZATION_TRANSITION_SPEC.md`, `server/modules/forge/MODULE.md`, `server/modules/externalModels/MODULE.md`, `replit.md`
- **Validation:** Ran `git diff --check` and `npm run build` (passes with the existing duplicate-class-member warning in `server/olc/adjusters.ts`).
- **Notes:** This PR is documentation-only. It does not extract, delete, or rewrite runtime FORGE code; any unconfirmed FORGE consumers remain explicitly marked as identified/likely/unknown in the spec.

### 2026-03-21 — Codex: External FORGE adapter + compare endpoint
- **What changed:** Added a migration-safe external FORGE adapter/client/service layer under `server/modules/externalModels/forge/`, introduced a dual-run compare service and contained `/api/integrations/forge/compare` + `/api/integrations/forge/health` routes, and documented the compare-only rollout plus required env vars.
- **Files modified:** `server/modules/externalModels/forge/*`, `server/routes/forgeIntegrationRoutes.ts`, `server/routes.ts`, `server/routes/__tests__/forgeIntegrationRoutes.test.ts`, `README.md`, `server/modules/externalModels/MODULE.md`, `replit.md`
- **Validation:** Ran targeted Jest suites for the external FORGE adapter/service/compare route and ran `npm run build` (passes with the existing duplicate-class-member warning in `server/olc/adjusters.ts`).
- **Notes:** The integration point is intentionally narrow: single-player offensive FORGE E+G comparison only. Live `/api/forge/*` production behavior remains unchanged.

### 2026-03-21 — FORGE parity fixture pack + snapshot harness
- Added committed fixture coverage for elite, stable, volatile, weak-opportunity, low-availability, dynasty, and best-ball FORGE compare cases.
- Added `forgeParityHarness.ts` + `runForgeParityHarness.ts` for deterministic parity summaries/snapshot-style reporting without touching production `/api/forge/*` traffic.
- Added focused Jest coverage for fixture stability, deterministic summary output, aggregation counts, and contained partial failures.
- Validation:
  - `NODE_OPTIONS=--experimental-vm-modules npx jest --config jest.config.cjs --runInBand server/modules/externalModels/forge/__tests__/forgeParityFixtures.test.ts server/modules/externalModels/forge/__tests__/forgeParityHarness.test.ts` ✅
  - `npm run build` ✅ (existing duplicate member warning in `server/olc/adjusters.ts`)
  - `git diff --check` ✅

### 2026-03-21 — Codex: FORGE parity harness debug metadata + npm runner
- **What changed:** Extended the FORGE parity harness summary with a stable `results` array alias and per-fixture `confidenceDelta`/`componentDeltas` metadata in deterministic snapshot output, added an `npm run forge:parity` helper, and refreshed migration docs to point contributors at the runner plus debug fields.
- **Files modified:** `server/modules/externalModels/forge/forgeParityHarness.ts`, `server/modules/externalModels/forge/__tests__/forgeParityHarness.test.ts`, `server/modules/externalModels/forge/README.md`, `server/modules/externalModels/MODULE.md`, `README.md`, `replit.md`, `package.json`
- **Validation:** Ran targeted Jest parity suites with snapshot update and ran `npm run build` (passes with the existing duplicate-class-member warning in `server/olc/adjusters.ts`).
- **Notes:** This keeps the existing compare endpoint contract intact; the new `results` field is additive and mirrors `perFixture` for deterministic migration reporting.

### 2026-03-21 — FORGE parity report endpoint + exporter
- Added `forgeParityReportService.ts` to wrap the existing parity harness in a stable migration-only contract with `generatedAt`, integration readiness metadata, summary counts, and deterministic `results`.
- Added `GET /api/integrations/forge/parity-report` in `server/routes/forgeIntegrationRoutes.ts` without changing legacy `/api/forge/*` behavior or the existing compare endpoint.
- Added `forgeParityReportExporter.ts` plus `runForgeParityReport.ts` and `npm run forge:parity:report` for local stdout/JSON export of the parity report contract.
- Expanded focused Jest coverage for the new report route, report service, and exporter while keeping the compare/health route tests intact.
- Updated `README.md`, `server/modules/externalModels/forge/README.md`, `server/modules/externalModels/MODULE.md`, and `replit.md` to document the migration-only endpoint, exporter usage, and parity-status interpretation.
- Validation:
  - `NODE_OPTIONS=--experimental-vm-modules npx jest --config jest.config.cjs --runInBand --coverage=false server/routes/__tests__/forgeIntegrationRoutes.test.ts server/modules/externalModels/forge/__tests__/forgeParityHarness.test.ts server/modules/externalModels/forge/__tests__/forgeParityReportService.test.ts server/modules/externalModels/forge/__tests__/forgeParityReportExporter.test.ts` ✅
  - `npm run build` ✅ (existing duplicate-class-member warning remains in `server/olc/adjusters.ts`)
  - `git diff --check` ✅
