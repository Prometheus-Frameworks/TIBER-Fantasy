# Tiber Fantasy — Context Log

Running changelog of significant changes across all agents. Most recent entries at top.
Every agent should append an entry here after completing work.

---

### 2026-03-24 — Codex: Production root now serves frontend SPA shell
- **What changed:** Updated `server/index.ts` production root handling so `GET /` serves `dist/public/index.html` when available, retained `GET /health` JSON health checks, and added an explicit safe JSON fallback when static assets are missing. Added reusable `mountProductionFrontend` helper for production static + SPA fallback wiring.
- **Files modified:** `server/index.ts`, `server/__tests__/productionRootRouting.test.ts`, `README.md`, `replit.md`, `.claude/context-log.md`, `.claude/agents/codex.md`
- **Validation:** Ran focused Jest suite for production routing behavior and confirmed health JSON, root frontend serving, API route preservation, and SPA fallback behavior.
- **Notes:** Change is routing-only; bootstrap path, API mounting, and DB/model logic remain untouched.

### 2026-02-22 — Replit Agent: QB FIRE Support + Snap% Fix + Column Cleanup
- **What changed:** Added full QB support to Fantasy Lab FIRE system. Backend: extended FIRE API with QB per-game stats (passAtt/G, comp%, passY/G, passTD/G, INT/G, rushAtt/G, rushY/G, rushTD/G) computed from silver_player_weekly_stats rolling window. Frontend: added QB to position selector, built position-aware column system (QB-specific columns auto-swap, Conversion column hidden for QB since it's null). Fixed Snap% bug (was dividing by total player-snaps instead of team offensive plays; added `team_off_plays = MAX(snaps)` to `team_weekly_totals_mv`). Cleaned column labels (Opp→Opportunity, Conv→Conversion, FPG→Fantasy PPG, etc).
- **Files modified:** `server/routes/fireRoutes.ts` (WeeklyPlayerStatRow extended, QB stats aggregation, FirePlayer.stats extended), `client/src/pages/FantasyLab.tsx` (Position type, column defs, position selector), `team_weekly_totals_mv` (added team_off_plays column), `replit.md`, `.claude/context-log.md`, `.claude/agents/replit-agent.md`, `server/modules/fantasyLab/README.md`
- **Validation:** API returns QB FIRE data with correct per-game stats. Snap% now shows 60-85% for starters (was 3-8%). E2E test passed.
- **Notes:** QB Conversion pillar still pending — FIRE uses 2-pillar scoring for QB (75% Opportunity + 25% Role). Column system uses `positions?: Position[]` field to control visibility per position.

### 2026-02-17 — Replit Agent: FORGE Pillar Weight Tuning & Calibration Fix
- **What changed:** Recalibrated FORGE redraft pillar weights based on PPG↔pillar correlation analysis. Updated calibration percentile anchors (p10/p90) to reduce ceiling compression. Key findings: RB stability (-0.668 corr) and TE stability (-0.786 corr) are anti-signals; WR stability (+0.801 corr) is positive. QB team context (0.661 corr) was strongest single QB predictor.
- **Files modified:** `server/modules/forge/forgeGrading.ts` (weights + dynasty weights), `server/modules/forge/types.ts` (calibration params), `.claude/tasks/pillar-weight-tuning.md` (research doc with resolution), `replit.md`
- **Validation:** Full recompute of 357 players. RB T1 count: 17→8 (within 5-8 target). Spearman rank correlations: RB 0.943, TE 0.939, WR 0.908, QB 0.623. CMC now tops RB rankings at 91.6 (was tied at 95.0 with Irving/JT).
- **Notes:** Remaining Bucky Irving inversion (91.2, 13.8 PPG) is a Volume pillar design issue — Volume measures opportunity count, not per-play production. Future work: redesign Volume and Stability pillar formulas.

### 2026-02-16 — Replit Agent: Quality Sentinel Dashboard UI
- **What changed:** Built the Quality Sentinel Dashboard frontend at `/sentinel` with health overview cards, module breakdown, interactive Test Lab (12 pre-built scenarios across forge/personnel/datalab/system modules), issues panel with filtering and muting, and event feed with expandable details. Added sentinel to sidebar under System section with NEW badge. Also completed backend integration: added sentinel schema tables to `shared/schema.ts`, integrated sentinel checks into FORGE score and batch endpoints, mounted sentinel routes.
- **Files modified:** `client/src/pages/SentinelDashboard.tsx` (new), `client/src/App.tsx`, `client/src/components/TiberLayout.tsx`, `shared/schema.ts`, `server/modules/forge/routes.ts`
- **Validation:** All sentinel API endpoints tested via curl - health, issues, events, run/forge, run/datalab, run/system all return correct responses. Rules correctly flag out-of-bounds alpha, NaN values, tier mismatches, empty batches, zero snaps, invalid classifications, missing snapshots, and missing response keys.
- **Notes:** Test Lab lets you inject manipulated data and see sentinel flags in real time. Uses project conventions: ember accent (#e2640d), JetBrains Mono for data, default query fetcher pattern.

### 2026-02-16 — Replit Agent: Quality Sentinel Task Spec for Codex
- **What changed:** Created comprehensive Codex task spec for the Quality Sentinel validation layer. Covers rule engine architecture, 16 initial rules across FORGE/Personnel/DataLab/System modules, sentinel_events DB schema, 5 API endpoints, inline integration pattern, and detailed validation criteria with curl commands.
- **Files modified:** `.claude/tasks/build-quality-sentinel.md` (new)
- **Validation:** Spec reviewed for consistency with existing FORGE types, personnel service patterns, and route registration conventions.
- **Notes:** Backend-only scope — frontend admin dashboard and UI badges deferred to Replit Agent as follow-up. Based on deep research report analyzing Great Expectations, Monte Carlo, Datadog, and Sentry patterns. Designed for Codex's PR-based workflow on branch `codex/build-quality-sentinel`.

### 2026-02-16 — Claude Code: Fix Personnel Usage Under-Counting
- **What changed:** Rewrote personnel module to use nflverse `pbp_participation` data instead of only counting primary actors (passer/rusher/receiver). Added `bronze_pbp_participation` table and Python ingest script. Updated frontend labels from "plays" to "snaps".
- **Files modified:** `shared/schema.ts`, `server/modules/personnel/personnelService.ts`, `server/scripts/import_pbp_participation.py` (new), `client/src/pages/PersonnelUsage.tsx`, `server/modules/personnel/MODULE.md`
- **Validation:** Nacua 869 snaps (was 224), Hunter 303 snaps (was 46), top-5 WRs all 800+. All validation criteria passed.
- **Notes:** Task spec at `.claude/tasks/fix-personnel-undercounting.md` has full resolution details. Nacua 869 vs PFR 727 gap is methodology difference (acceptable).

### 2026-02-16 — Replit Agent: Create Personnel Usage Task Spec
- **What changed:** Created enhanced task spec for the personnel undercounting bug with full agent onboarding context, root cause SQL diagnostics, solution paths, and validation criteria.
- **Files modified:** `.claude/tasks/fix-personnel-undercounting.md` (new)
- **Validation:** Spec confirmed root cause via SQL queries showing Nacua 224 primary-actor plays vs 727 PFR snaps.
- **Notes:** This was the first task spec in the `.claude/tasks/` system. Designed as a template for future specs.

### 2026-02-15 — Replit Agent: Build Personnel Usage Page
- **What changed:** Built frontend page at `/personnel` with position tabs, search, sort, expandable player cards, colored personnel breakdown bars, and classification badges. Added SQL-optimized backend aggregation. Added sidebar nav entry with "NEW" badge.
- **Files modified:** `client/src/pages/PersonnelUsage.tsx` (new), `client/src/index.css` (CSS additions), `client/src/App.tsx` (route), `client/src/components/TiberLayout.tsx` (nav), `server/modules/personnel/personnelService.ts` (SQL rewrite)
- **Validation:** API verified via curl returning proper data. Architect review passed.
- **Notes:** Initial version used primary-actor counting (later fixed by Claude Code above).

### 2026-02-15 — Codex: Add NFL Personnel Grouping Visibility (PR #11)
- **What changed:** Created personnel module infrastructure — service, classifier, routes, backfill script. Added `offense_personnel`, `defense_personnel`, `offense_formation` columns to `bronze_nflfastr_plays`. Backfilled 45,184 plays with personnel data from nflverse pbp_participation parquet.
- **Files modified:** `server/modules/personnel/personnelService.ts` (new), `server/modules/personnel/personnelClassifier.ts` (new), `server/routes/personnelRoutes.ts` (new), `server/scripts/backfillPersonnel.ts` (new), `shared/schema.ts` (3 columns added)
- **Validation:** 92.6% personnel data coverage across 2025 plays.
- **Notes:** Branch: `codex/add-nfl-personnel-grouping-visibility`. Merged via PR #11.

### 2026-02-15 — Replit Agent: Module Documentation & Architecture Updates
- **What changed:** Added MODULE.md files and updated architecture documentation.
- **Files modified:** Various MODULE.md files, `replit.md`
- **Validation:** Documentation review.

### 2026-02-14 — Replit Agent: Project Architecture Documentation
- **What changed:** Added comprehensive project architecture and module documentation.
- **Files modified:** Architecture docs, module docs
- **Validation:** Documentation review.

### 2026-02-13 — Replit Agent: FORGE Workbench
- **What changed:** Built interactive FORGE workbench at `/forge-workbench` for exploring player engine internals — search, pillar breakdowns, weight sliders, mode toggle.
- **Files modified:** `client/src/pages/ForgeWorkbench.tsx` (new), route/nav registration
- **Validation:** End-to-end testing.

### 2026-02-13 — Replit Agent: Metrics Dictionary
- **What changed:** Built detailed metrics dictionary page for browsing all NFL data point definitions.
- **Files modified:** `client/src/pages/MetricsDictionary.tsx` (new), route/nav registration
- **Validation:** End-to-end testing.

### 2026-02-12 — Replit Agent: System Architecture Diagram
- **What changed:** Built interactive system architecture visualization page.
- **Files modified:** Architecture page files, route/nav registration
- **Validation:** Visual verification.

### 2026-02-11 — Replit Agent: X Intelligence Scanner
- **What changed:** Built Grok-powered X/Twitter scanning for fantasy football trends, injuries, breakouts. Created scan types, endpoints, and frontend page.
- **Files modified:** `server/services/xIntelligenceScanner.ts`, `client/src/pages/XIntelligence.tsx`, route registration
- **Validation:** End-to-end testing with Grok integration.

### 2026-02-11 — Replit Agent: LLM Gateway
- **What changed:** Built provider-agnostic LLM gateway with automatic fallback across 4 providers (OpenRouter, OpenAI, Anthropic, Gemini). Task-based routing with 9 task types.
- **Files modified:** `server/llm/` directory (types, config, logger, fallback, providers, index)
- **Validation:** Multi-provider fallback testing.

### 2026-02-10 — Replit Agent: v2 Light Mode Redesign
- **What changed:** Complete UI redesign from dark to light mode. New design system with ember accent, three-font system, fixed sidebar layout.
- **Files modified:** `client/src/index.css`, `client/src/components/TiberLayout.tsx`, multiple page files
- **Validation:** Visual verification across all pages.

### Earlier History (Pre-2026-02-10)

#### Codex Contributions (via GitHub PRs)
- **PR #9** (2025-12-28): NFLfastR inventory audit
- **PR #8** (2025-12-16): FORGE scoring audit and playbook sync
- **PR #7** (2025-12-16): UI/UX cleanup for homepage redesign
- **PR #6** (2025-12-14): Sleeper sync and league overview
- **PR #5** (2025-12-13): Sleeper league sync v1
- **PR #4** (2025-12-11): Command hub and journal analysis
- **PR #3** (2025-12-10): Remove legacy Oasis/OTC naming
- **PR #2** (2025-12-10): Replace OTC/Oasis/Hardening with Tiber/TrackStar
- **PR #1** (2025-12-09): Internal documentation for FORGE scoring system

### 2026-02-16 — Codex: FORGE tiers cache migration
- **What changed:** Added precomputed `forge_grade_cache` schema, implemented `forgeGradeCache` service for compute+upsert+read, added `/api/forge/tiers` and `/api/forge/compute-grades` endpoints, and migrated `/tiers` UI to consume cached FORGE Alpha/tier data with fallback messaging.
- **Files modified:** `shared/schema.ts`, `server/modules/forge/forgeGradeCache.ts`, `server/modules/forge/routes.ts`, `client/src/pages/TiberTiers.tsx`
- **Validation:** Ran build, attempted db push + tests + dev server (blocked by missing `DATABASE_URL`), verified route and schema wiring via source inspection.
- **Notes:** Admin endpoint expects `FORGE_ADMIN_KEY`; cache version defaults to `v1`; frontend now treats cache-empty responses as compute-in-progress.

### 2026-02-17 — Codex: FORGE snapshot data quality guardrails
- **What changed:** Added a new snapshot validator module with row-level guardrails (null/anomalous snap share handling, ghost/inactive row drops, and outlier warnings), and integrated it into FORGE xFP volume, role consistency ingestion, and context snapshot week counting.
- **Files modified:** `server/modules/forge/snapshotDataValidator.ts`, `server/modules/forge/xfpVolumePillar.ts`, `server/modules/forge/roleConsistencyPillar.ts`, `server/modules/forge/forgeEngine.ts`, `server/modules/forge/__tests__/snapshotDataValidator.test.ts`
- **Validation:** Ran focused validator unit tests (pass), attempted existing FORGE test suite (blocked by missing `DATABASE_URL`).
- **Notes:** Validator emits summary logs per player and detailed warnings only when fewer than 5 clean weeks remain.

### 2026-02-17 — Codex: FORGE end-to-end integration test coverage
- **What changed:** Added full FORGE integration test suite covering batch sanity, pinned player ranking guards, cross-position calibration checks, mode consistency, and stability regression protections using live DB reads and real E+G pipeline functions.
- **Files modified:** `server/modules/forge/__tests__/forgeIntegration.test.ts`
- **Validation:** Attempted targeted Jest run; blocked in this container because `DATABASE_URL` is not set.
- **Notes:** Test resolves canonical player IDs from `player_identity_map` dynamically to avoid brittle slug assumptions.

### 2026-02-17 — Codex: FORGE QB volume switched to continuous xFP
- **What changed:** Replaced QB volume pillar's role-bank blend with derived `xfp_per_game` (weight 1.0) to remove quantized bucket effects, and calibrated QB xFP normalization bounds for better spread with less clipping.
- **Files modified:** `server/modules/forge/forgeEngine.ts`, `server/services/xFptsConfig.ts`
- **Validation:** Ran TypeScript/Jest FORGE integration suite command (blocked by missing `DATABASE_URL`), then ran full production build successfully.
- **Notes:** QB xFP coefficients remain at dropback=0.50 and rushAttempt=0.65; documented sanity outputs (elite ~20.75, average ~16.95).

### 2026-02-17 — Codex: FORGE FPOE-based efficiency pillar decomposition
- **What changed:** Replaced volume-correlated role-bank efficiency mixes with FPOE-first efficiency pillar configs across WR/RB/TE/QB so volume (xFP/G) and efficiency (FPOE/G) are complementary. Kept QB EPA/CPOE/sack-rate components as secondary passing-efficiency context and documented that current FPOE normalization remains `[-5, +10]` pending DB-backed percentile validation.
- **Files modified:** `server/modules/forge/forgeEngine.ts`
- **Validation:** Ran `npm test -- server/modules/forge/__tests__/snapshotDataValidator.test.ts` (pass) and `npm run build` (pass, pre-existing duplicate-class-member warning in `server/olc/adjusters.ts`).
- **Notes:** Could not run the requested SQL distribution check because this container has no `DATABASE_URL`; normalization range should be revisited once DB access is available.

### 2026-02-18 — Codex: Fantasy Lab Phase 1 weekly data foundation
- **What changed:** Added `fantasy_metrics_weekly_mv` materialized view migration consolidating DataDive weekly usage, xFP v2, and latest market context; implemented `/api/fantasy-lab/weekly`, `/api/fantasy-lab/player`, and admin refresh endpoint `/api/admin/fantasy-lab/refresh`; added Fantasy Lab QA sanity script and backend module documentation.
- **Files modified:** `migrations/0011_fantasy_lab_weekly_mv.sql`, `server/routes/fantasyLabRoutes.ts`, `server/routes.ts`, `server/scripts/qaFantasyLabPhase1.ts`, `server/modules/fantasyLab/README.md`, `package.json`
- **Validation:** Ran `npm run build` (pass with pre-existing warning), attempted `npm run typecheck` (repo-wide pre-existing errors), attempted `npm run qa:fantasy-lab -- 2025 1` (DB unavailable in container: ECONNREFUSED).
- **Notes:** Materialized view uses latest snapshot per season/week and latest-known market signals/facts; xFP surfaced as `x_ppr_v2` + `xfpgoe_ppr_v2`; half/std xFP currently null placeholders pending source availability.

### 2026-02-19 — Codex: Fantasy Lab Phase 2 FIRE + Delta + UI
- **What changed:** Added compute-on-demand FIRE API for RB/WR/TE (`/api/fire/eg/batch`, `/api/fire/eg/player`) using rolling 4-week windows, position-specific snap eligibility, percentile-normalized pillars, and RoleIndex fallback logic. Added Hybrid Delta API (`/api/delta/eg/batch`) joining FORGE alpha and FIRE with percentile display delta + z-score rank delta and BUY_LOW/SELL_HIGH labeling. Added a minimal `/fantasy-lab` page with season/week/position/view controls, FIRE table, DELTA table, and explicit QB gap notice.
- **Files modified:** `server/routes/fireRoutes.ts`, `server/routes.ts`, `client/src/pages/FantasyLab.tsx`, `client/src/App.tsx`, `client/src/components/TiberLayout.tsx`
- **Validation:** `npm run build` passed (existing unrelated duplicate member warning in `server/olc/adjusters.ts`). Attempted `npm run dev` for UI verification/screenshot, blocked due missing `DATABASE_URL`.
- **Notes:** QB FIRE remains excluded by design; endpoints include metadata notes/thresholds and role fallback metadata.

### 2026-02-20 — Codex: QB FIRE v1 opportunity + role integration
- **What changed:** Added QB xFP v1 data model and migration (`qb_xfp_weekly`), created bucket-smoothed QB xFP ETL script, expanded Fantasy Lab MV with QB xFP/role fields, enabled QB in FIRE with scoring presets (`redraft|dynasty`) and QB-specific eligibility/role scoring (Opportunity + Role only), and documented data audit + validation runbook reports.
- **Files modified:** `migrations/0012_qb_fire_v1.sql`, `scripts/etl/qb_xfp_weekly.py`, `server/routes/fireRoutes.ts`, `server/routes/fantasyLabRoutes.ts`, `package.json`, `reports/qb_fire_v1_data_audit.md`, `reports/qb_fire_v1_validation.md`
- **Validation:** Ran build successfully; DB-backed ETL/API validation commands are documented but blocked because `DATABASE_URL` is not set in this container.
- **Notes:** DELTA remains RB/WR/TE-only by design until QB conversion/FPOE lands in v1.1.

### 2026-02-23 — Codex: FORGE IDP Phase 1 scaffold + routing integration
- **What changed:** Added initial IDP ingestion/baseline/engine modules, extended FORGE E+G position typing to include defensive groups, added defensive branch in `runForgeEngine` + `runForgeEngineBatch`, and mounted admin IDP routes (`/api/admin/idp/ingest`, `/baselines`, `/status`).
- **Files modified:** `shared/idpSchema.ts`, `server/modules/forge/forgeEngine.ts`, `server/modules/forge/forgeGrading.ts`, `server/modules/forge/forgeGradeCache.ts`, `server/modules/forge/routes.ts`, `server/routes/idpAdminRoutes.ts`, `server/routes.ts`, `server/modules/forge/idp/*`, plus offensive-helper typing updates in `roleConsistencyPillar.ts`, `xfpVolumePillar.ts`, and `snapshotDataValidator.ts`.
- **Validation:** Ran `npx tsc --noEmit` and a targeted `npx tsc --noEmit ...` command; both are currently blocked by broad pre-existing repository/type dependency issues.
- **Notes:** IDP tables are queried via raw SQL because current Drizzle schema does not expose `idp_*` models yet.

### 2026-02-24 — Codex: Phase 0 CATALYST PBP enrichment plumbing
- **What changed:** Added `wp` + `score_differential` columns to Bronze NFLfastR schema, created migration/backfill SQL to populate from `raw_data`, updated NFLfastR import scripts (2024/2025 bulk + fast import) to persist both fields at ingest time, and added a dedicated DB validation script for coverage/range/spot-check queries.
- **Files modified:** `shared/schema.ts`, `migrations/0013_catalyst_pbp_enrichment.sql`, `server/scripts/import_nflfastr_2024_bulk.py`, `server/scripts/import_nflfastr_2025_bulk.py`, `server/scripts/fast_nflfastr_import.py`, `server/scripts/validate_catalyst_pbp_enrichment.py`
- **Validation:** `python -m py_compile ...` passed for updated scripts; `npm run build` passed (existing warning in `server/olc/adjusters.ts`).
- **Notes:** Could not execute DB-backed enrichment validation because this container does not provide `DATABASE_URL`; run `server/scripts/validate_catalyst_pbp_enrichment.py` in a DB-enabled environment after applying migration.

### 2026-03-02 — Codex: Add rookie profiles schema + seed script
- **What changed:** Added `rookie_profiles` Drizzle table to `shared/schema.ts` and created `scripts/seed-rookie-profiles.ts` to merge combine + grade JSON inputs on player name and insert 91 merged rows.
- **Files modified:** `shared/schema.ts`, `scripts/seed-rookie-profiles.ts`
- **Validation:** Ran `npm run db:push` (blocked by missing `DATABASE_URL` in this environment).
- **Notes:** Seed script expects `data/rookies/2026_combine_results.json` and `data/rookies/2026_rookie_grades.json` to exist and enforces exactly 91 merged rows.

### 2026-03-06 — Codex: Canonical v1 trade analyze endpoint + compare semantic cleanup
- **What changed:** Extended canonical comparison route semantics to accept either `player_a/player_b` or legacy-style `player1/player2` aliases while preserving canonical output. Added new `POST /api/v1/intelligence/trade/analyze` route in v1 API that accepts canonical `side_a/side_b` (plus compatibility aliases `teamA/teamB`) and returns canonical `TradeAnalysisResponse` via a new mapper adapter. Reused existing `evaluateTradePackage` service without introducing new football logic.
- **Files modified:** `server/api/v1/routes.ts`, `server/api/v1/mappers/toTradeAnalysisResponse.ts`
- **Validation:** Ran `npm run typecheck` (fails due broad pre-existing repo TypeScript issues), `npm test` (partial pass; failures include DB-dependent tests due missing `DATABASE_URL` plus existing suite failures), and targeted `npx tsc --noEmit server/api/v1/routes.ts server/api/v1/mappers/toTradeAnalysisResponse.ts` (fails from existing global typing/dependency conflicts).
- **Notes:** Legacy trade surfaces remain untouched; this is additive via `/api/v1/intelligence/trade/analyze`.

### 2026-03-20 — Codex: External model adapter layer for role opportunity
- **What changed:** Added a dedicated external model adapter layer for promoted lab integrations, implemented the first `Role-and-opportunity-model` client/adapter/service stack with canonical edge validation and typed failure mapping, and exposed a contained integration endpoint plus readiness/config status route.
- **Files modified:** `server/modules/externalModels/**`, `server/routes/roleOpportunityIntegrationRoutes.ts`, `server/routes.ts`, `README.md`, `replit.md`, `.claude/conventions.md`
- **Validation:** Ran targeted Jest suites for the adapter/service and integration route, built the production bundle, and smoke-tested the readiness endpoint with curl against a minimal Express app.
- **Notes:** The adapter normalizes share-style metrics into 0..1 decimals for TIBER-facing output while preserving optional raw canonical payloads for debugging.

### 2026-03-20 — Codex: Player detail role opportunity enrichment
- **What changed:** Added opt-in role-opportunity enrichment to `GET /api/player-identity/player/:id`, introduced a failure-tolerant player-detail insight envelope helper, added focused route/enrichment tests, and documented the response contract plus non-fatal behavior.
- **Files modified:** `server/routes/playerIdentityRoutes.ts`, `server/modules/externalModels/roleOpportunity/playerDetailEnrichment.ts`, `server/modules/externalModels/roleOpportunity/__tests__/playerDetailEnrichment.test.ts`, `server/routes/__tests__/playerIdentityRoutes.test.ts`, `README.md`, `replit.md`, `server/modules/externalModels/MODULE.md`
- **Validation:** Ran targeted Jest suites for the player-detail enrichment helper and player identity route, and ran a production build.
- **Notes:** Enrichment is only fetched when `includeRoleOpportunity=true` and still requires explicit `season` + `week`; upstream failures are surfaced inside `roleOpportunityInsight.error` instead of breaking the base player payload.

### 2026-03-20 — Codex: Player detail enrichment orchestrator
- **What changed:** Extracted player-detail external insight assembly into a reusable orchestrator module, moved role-opportunity enrichment behind it, kept the route-level opt-in validation/response semantics intact, and added focused orchestrator + route compatibility coverage.
- **Files modified:** `server/modules/externalModels/playerDetailEnrichment/*`, `server/routes/playerIdentityRoutes.ts`, `server/routes/__tests__/playerIdentityRoutes.test.ts`, `README.md`, `server/modules/externalModels/MODULE.md`, `replit.md`
- **Validation:** Ran targeted Jest suites for the orchestrator, route, and role-opportunity envelope helper; ran production build.
- **Notes:** Future player-detail enrichments should plug into the orchestrator rather than add direct conditionals inside `playerIdentityRoutes.ts`.


### 2026-03-20 — Codex: Module classification audit + architecture doctrine
- **What changed:** Added a repo-level module classification audit documenting which in-repo model-like systems are core, temporary legacy core, extract candidates, deprecations, deletes-after-replacement, or unknown. Added explicit architecture doctrine notes clarifying that TIBER-Fantasy is the shell/orchestration core and that standalone model brains should move behind adapters/orchestrators when practical.
- **Files modified:** `docs/architecture/TIBER_FANTASY_MODULE_CLASSIFICATION_AUDIT.md`, `README.md`, `server/modules/externalModels/MODULE.md`, `replit.md`
- **Validation:** Ran `git diff --check` and `npm run build` (passes with a pre-existing duplicate-class-member warning in `server/olc/adjusters.ts`).
- **Notes:** This PR is documentation-only and does not move, delete, or rewrite business logic; `UNKNOWN` is used where runtime usage could not be confirmed from the audit.
### 2026-03-20 — Codex: Legacy module freeze/extraction notices
- **What changed:** Added blunt module-level classification notices for FORGE, CATALYST, FIRE, doctrine modules, Metric Matrix, Start/Sit, OVR, and tiberMatrix, plus a short architecture work-rules doc that makes the repo-wide audit operational.
- **Files modified:** `server/modules/forge/MODULE.md`, `server/modules/catalyst/MODULE.md`, `server/modules/fantasyLab/README.md`, `server/routes/fireRoutes.ts`, `server/doctrine/MODULE.md`, `server/modules/metricMatrix/MODULE.md`, `server/modules/startSit/MODULE.md`, `server/modules/ovr/MODULE.md`, `server/modules/tiberMatrix/MODULE.md`, `docs/architecture/LEGACY_MODULE_WORK_RULES.md`
- **Validation:** `git diff --check` passed; `npm run build` passed with the existing duplicate-class-member warning in `server/olc/adjusters.ts`.
- **Notes:** This PR is documentation-only and intentionally does not extract, delete, or rewrite any legacy module runtime paths.

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

### 2026-03-21 — Codex: FORGE parity fixture pack + snapshot harness
- **What changed:** Added a committed FORGE parity fixture pack, a deterministic parity harness/snapshot formatter, focused harness tests, and brief migration docs for rerunning labeled compare fixtures without changing production FORGE traffic.
- **Files modified:** `server/modules/externalModels/forge/fixtures/forgeParityFixtures.ts`, `server/modules/externalModels/forge/forgeParityHarness.ts`, `server/modules/externalModels/forge/runForgeParityHarness.ts`, `server/modules/externalModels/forge/__tests__/forgeParityFixtures.test.ts`, `server/modules/externalModels/forge/__tests__/forgeParityHarness.test.ts`, `server/modules/externalModels/forge/README.md`, `README.md`, `server/modules/externalModels/MODULE.md`, `replit.md`
- **Validation:** Focused Jest parity fixture/harness suites passed; `npm run build` passed with the existing duplicate-class-member warning in `server/olc/adjusters.ts`; `git diff --check` passed.
- **Notes:** Harness intentionally reuses the existing compare service and preserves compare-only migration semantics; optional local runner is `tsx server/modules/externalModels/forge/runForgeParityHarness.ts`.

### 2026-03-21 — Codex: FORGE parity harness debug metadata + npm runner
- **What changed:** Extended the FORGE parity harness summary with a stable `results` array alias and per-fixture `confidenceDelta`/`componentDeltas` metadata in deterministic snapshot output, added an `npm run forge:parity` helper, and refreshed migration docs to point contributors at the runner plus debug fields.
- **Files modified:** `server/modules/externalModels/forge/forgeParityHarness.ts`, `server/modules/externalModels/forge/__tests__/forgeParityHarness.test.ts`, `server/modules/externalModels/forge/README.md`, `server/modules/externalModels/MODULE.md`, `README.md`, `replit.md`, `package.json`
- **Validation:** Ran targeted Jest parity suites with snapshot update and ran `npm run build` (passes with the existing duplicate-class-member warning in `server/olc/adjusters.ts`).
- **Notes:** This keeps the existing compare endpoint contract intact; the new `results` field is additive and mirrors `perFixture` for deterministic migration reporting.

### 2026-03-21 — Codex: FORGE parity report endpoint + exporter
- **What changed:** Added a migration-only `GET /api/integrations/forge/parity-report` route plus a dedicated parity report service that wraps the existing FORGE parity harness in a stable readiness-aware contract. Added a small report exporter/runner for local stdout or JSON inspection without changing production `/api/forge/*` behavior.
- **Files modified:** `server/modules/externalModels/forge/*`, `server/routes/forgeIntegrationRoutes.ts`, `server/routes/__tests__/forgeIntegrationRoutes.test.ts`, `README.md`, `server/modules/externalModels/forge/README.md`, `server/modules/externalModels/MODULE.md`, `replit.md`, `package.json`
- **Validation:** Ran targeted Jest suites for the integration route, parity harness, report service, and exporter; ran `npm run build`; ran `git diff --check`.
- **Notes:** When external FORGE is disabled or `FORGE_SERVICE_BASE_URL` is missing, the parity report returns a deterministic unavailable summary with `harnessRan=false` and `skippedReason` metadata instead of throwing.


### 2026-03-21 — Codex: Opt-in external FORGE player detail preview
- **What changed:** Added an additive `externalForgeInsight` preview path to `GET /api/player-identity/player/:id` behind `includeExternalForge=true`, reused the existing external FORGE adapter/service boundary via the player-detail enrichment orchestrator, and kept failures non-fatal with a stable unavailable/error envelope.
- **Files modified:** `server/routes/playerIdentityRoutes.ts`, `server/modules/externalModels/playerDetailEnrichment/*`, `server/modules/externalModels/forge/playerDetailEnrichment.ts`, `server/modules/externalModels/forge/__tests__/playerDetailEnrichment.test.ts`, `server/routes/__tests__/playerIdentityRoutes.test.ts`, `README.md`, `server/modules/externalModels/MODULE.md`, `server/modules/externalModels/forge/README.md`, `replit.md`
- **Validation:** Ran targeted Jest suites for the player-detail orchestrator, new external FORGE player-detail helper, and player identity route; ran `npm run build`; ran `git diff --check`.
- **Notes:** Legacy FORGE remains the default everywhere else. External FORGE preview currently stays narrow to QB/RB/WR/TE player detail and defaults preview `week` to `season` plus mode to `redraft` unless explicitly overridden.

### 2026-03-21 — Codex: Player detail FORGE comparison preview
- **What changed:** Added opt-in `includeForgeComparison=true` support to player detail, reusing the existing external FORGE compare service to return side-by-side legacy/external FORGE insight plus stable parity metadata while keeping failures non-fatal and defaults unchanged.
- **Files modified:** `server/routes/playerIdentityRoutes.ts`, `server/modules/externalModels/playerDetailEnrichment/*`, `server/modules/externalModels/forge/playerDetailEnrichment.ts`, `server/routes/__tests__/playerIdentityRoutes.test.ts`, `server/modules/externalModels/forge/__tests__/playerDetailEnrichment.test.ts`, `server/modules/externalModels/playerDetailEnrichment/__tests__/playerDetailEnrichmentOrchestrator.test.ts`, `README.md`, `server/modules/externalModels/MODULE.md`, `server/modules/externalModels/forge/README.md`, `replit.md`
- **Validation:** Ran targeted Jest suites for the route/orchestrator/player-detail FORGE helpers, `npm run build`, and `git diff --check`.
- **Notes:** Comparison mode is migration-only preview behavior. Legacy FORGE remains the default; external-only preview via `includeExternalForge=true` is still supported unchanged.

### 2026-03-21 — Codex: FORGE migration review endpoint for sampled comparisons
- **What changed:** Added a migration-only `GET /api/integrations/forge/review` endpoint plus `forgeMigrationReviewService.ts` to sample existing legacy FORGE batch players, reuse the compare service per player, aggregate stable summary metrics, and contain per-player failures/disabled-integration states without changing live FORGE defaults.
- **Files modified:** `server/modules/externalModels/forge/*`, `server/routes/forgeIntegrationRoutes.ts`, `server/routes/__tests__/forgeIntegrationRoutes.test.ts`, `README.md`, `server/modules/externalModels/forge/README.md`, `server/modules/externalModels/MODULE.md`, `replit.md`
- **Validation:** Ran focused Jest suites for the migration review service and route, ran `npm run build`, ran `git diff --check`, and smoke-tested the new route shape with `curl` against a mocked local Express app.
- **Notes:** Sampling intentionally reuses `runForgeEngineBatch` so review requests stay tied to existing player sources. The route is operator/migration-only and does not add UI, persistence, or product behavior changes.

### 2026-03-23 — Codex: WR Breakout Lab Signal-Validation promotion
- **What changed:** Added the first read-only Signal-Validation-Model promotion in TIBER Data Lab with a filesystem-backed external-model adapter/service/route, a new `/tiber-data-lab/breakout-signals` page, season-aware WR signal-card table rendering, best-recipe summary display, empty/error/loading states, and lightweight row expansion for full signal-card fields.
- **Files modified:** `server/modules/externalModels/signalValidation/*`, `server/routes/dataLabBreakoutSignalsRoutes.ts`, `server/routes.ts`, `server/routes/__tests__/dataLabBreakoutSignalsRoutes.test.ts`, `client/src/pages/BreakoutSignalsLab.tsx`, `client/src/components/data-lab/BreakoutSignalsView.tsx`, `client/src/lib/breakoutSignals.ts`, `client/src/App.tsx`, `client/src/pages/DataLabHub.tsx`, `client/src/lib/metricRegistry.ts`, `client/src/__tests__/breakoutSignalsView.test.ts`, `README.md`, `server/modules/externalModels/MODULE.md`, `replit.md`, `jest.config.cjs`
- **Validation:** Focused Jest suites for the Signal Validation adapter, Data Lab route, and view rendering passed; `npm run build` passed with the existing duplicate-class-member warning in `server/olc/adjusters.ts`; `git diff --check` passed. Repo-wide `npm run typecheck` still fails on unrelated pre-existing TypeScript issues outside this PR.
- **Notes:** The adapter defaults to `SIGNAL_VALIDATION_EXPORTS_DIR` (or `./data/signal-validation`) and intentionally only consumes promoted exports (`wr_player_signal_cards_{season}.csv` and `wr_best_recipe_summary.json`). No rescoring logic was added to TIBER-Fantasy.

### 2026-03-23 — Codex: WR Breakout Lab polish pass
- **What changed:** Added client-side sort/search/quick-filter controls to the WR Breakout Lab table, grouped read-only detail sections for expanded rows, stronger best-recipe provenance copy, and clearer loading/empty/error/operator-hint states without changing any breakout scoring logic.
- **Files modified:** `client/src/components/data-lab/BreakoutSignalsView.tsx`, `client/src/lib/breakoutSignals.ts`, `client/src/pages/BreakoutSignalsLab.tsx`, `client/src/__tests__/breakoutSignalsView.test.ts`, `README.md`, `server/modules/externalModels/signalValidation/README.md`, `replit.md`
- **Validation:** Ran the focused WR Breakout Lab Jest suite, `npm run build`, and `git diff --check`.
- **Notes:** All new table controls are client-side only and preserve the module's read-only Signal-Validation-Model trust posture.

### 2026-03-23 — Codex: Age Curve / ARC Lab promotion
- **What changed:** Added the third promoted read-only Data Lab sub-model with a new `/tiber-data-lab/age-curves` page, a dedicated external-model adapter/client/service stack under `server/modules/externalModels/ageCurves/`, a normalized `GET /api/data-lab/age-curves` route, searchable/filterable age-curve table rendering, expandable detail/provenance sections, and a lightweight expected-vs-actual bar comparison.
- **Files modified:** `server/modules/externalModels/ageCurves/*`, `server/routes/dataLabAgeCurvesRoutes.ts`, `server/routes/__tests__/dataLabAgeCurvesRoutes.test.ts`, `server/routes.ts`, `client/src/lib/ageCurves.ts`, `client/src/components/data-lab/AgeCurvesView.tsx`, `client/src/pages/AgeCurvesLab.tsx`, `client/src/__tests__/ageCurvesView.test.ts`, `client/src/App.tsx`, `client/src/pages/DataLabHub.tsx`, `client/src/lib/metricRegistry.ts`, `README.md`, `server/modules/externalModels/MODULE.md`, `replit.md`
- **Validation:** Ran focused Jest suites for the Age Curve adapter, route, and view; ran `npm run build`; ran `git diff --check`; smoke-tested `GET /api/data-lab/age-curves?season=2025` against a local mocked Express mount with `curl`.
- **Notes:** The module remains read only and intentionally does not recompute ARC logic. The adapter prefers an upstream compatibility endpoint but can also consume a stable exported artifact at `AGE_CURVE_EXPORTS_PATH`.

### 2026-03-23 — Codex: Data Lab promoted-module cohesion pass
- **What changed:** Reworked the Data Lab hub so the three promoted labs read as one system with consistent promoted/read-only framing, concise module-purpose and usage guidance, and a dedicated promoted-module section. Added cross-module navigation blocks inside Breakout, Role & Opportunity, and Age Curve / ARC Lab plus lightweight player carry-through via `playerId` / `playerName` deep links. Updated focused frontend tests and added a short README/replit architecture note.
- **Files modified:** `client/src/pages/DataLabHub.tsx`, `client/src/components/data-lab/BreakoutSignalsView.tsx`, `client/src/components/data-lab/RoleOpportunityView.tsx`, `client/src/components/data-lab/AgeCurvesView.tsx`, `client/src/components/data-lab/PromotedModuleSystemCard.tsx`, `client/src/lib/dataLabPromotedModules.ts`, `client/src/pages/BreakoutSignalsLab.tsx`, `client/src/pages/RoleOpportunityLab.tsx`, `client/src/pages/AgeCurvesLab.tsx`, `client/src/lib/metricRegistry.ts`, `client/src/__tests__/*`, `README.md`, `replit.md`
- **Validation:** Ran focused Jest suites for the promoted Data Lab views/helpers/hub, `npm run build`, and `git diff --check`.
- **Notes:** This is product-layer integration only. No scoring, adapter, database, or promotion-scope logic changed.

### 2026-03-23 — Codex: Point Scenario Lab promotion
- **What changed:** Added the fourth promoted read-only Data Lab sub-model with a new `/tiber-data-lab/point-scenarios` page, a dedicated external-model adapter/client/service stack under `server/modules/externalModels/pointScenarios/`, a normalized `GET /api/data-lab/point-scenarios` route, a searchable/filterable scenario table, and a detail drawer for full scenario payload/provenance inspection plus light cross-links back to the other promoted labs.
- **Files modified:** `server/modules/externalModels/pointScenarios/*`, `server/routes/dataLabPointScenariosRoutes.ts`, `server/routes/__tests__/dataLabPointScenariosRoutes.test.ts`, `server/routes.ts`, `client/src/lib/pointScenarios.ts`, `client/src/components/data-lab/PointScenariosView.tsx`, `client/src/pages/PointScenariosLab.tsx`, `client/src/App.tsx`, `client/src/pages/DataLabHub.tsx`, `client/src/lib/dataLabPromotedModules.ts`, `client/src/lib/metricRegistry.ts`, `client/src/__tests__/pointScenariosView.test.ts`, `client/src/__tests__/dataLabHub.test.ts`, `client/src/__tests__/dataLabPromotedModules.test.ts`, `README.md`, `server/modules/externalModels/MODULE.md`, `replit.md`
- **Validation:** Ran focused Jest suites for the Point Scenario adapter, route, view, and promoted-module helper/hub coverage; ran `npm run build`; ran `git diff --check`.
- **Notes:** The module remains read only and intentionally does not author scenarios or recompute any Point-prediction-Model logic. The frontend is positioned as scenario-analysis context, not a final rankings surface.

### 2026-03-23 — Codex: Player Research Workspace cross-model synthesis surface
- **What changed:** Added the new read-only `/tiber-data-lab/player-research` surface and `GET /api/data-lab/player-research` route, backed by a `server/modules/externalModels/playerResearch/` orchestration layer that reuses the four promoted lab adapters without rescoring. Added player-name search, `playerId` deep-linking, season carry-through, partial-data/error handling, section-level link-outs, and updated promoted-module docs/hub metadata.
- **Files modified:** `server/modules/externalModels/playerResearch/*`, `server/routes/dataLabPlayerResearchRoutes.ts`, `server/routes.ts`, `client/src/pages/PlayerResearchLab.tsx`, `client/src/components/data-lab/PlayerResearchWorkspaceView.tsx`, `client/src/lib/playerResearch.ts`, `client/src/lib/dataLabPromotedModules.ts`, `client/src/pages/DataLabHub.tsx`, `README.md`, `replit.md`, `server/modules/externalModels/MODULE.md`
- **Validation:** Focused Jest suites for service aggregation, route behavior, client query/search helpers, and rendering all passed. `npm run build` passed with the pre-existing duplicate-class-member warning in `server/olc/adjusters.ts`.
- **Notes:** Workspace preserves a read-only trust posture and gracefully degrades when one or more promoted modules are missing or unavailable.

### 2026-03-23 — Codex: Data Lab promoted-module stabilization pass
- **What changed:** Standardized promoted-module UX patterns across Breakout, Role & Opportunity, Age Curve / ARC, Point Scenario, and Player Research; added shared state/provenance/navigation helpers; preserved season carry-through in promoted deep links; surfaced operator-visible route diagnostics for misconfigured vs no-data vs malformed upstream states; and added a lightweight hub status/help panel for promoted read-only dependencies.
- **Files modified:** `client/src/components/data-lab/*`, `client/src/lib/dataLabPromotedModules.ts`, promoted lab page wrappers, promoted lab/frontend tests, Data Lab hub, `server/routes/dataLab*Routes.ts`, `server/modules/externalModels/promotedModuleOperator.ts`, route tests, `README.md`, `server/modules/externalModels/MODULE.md`, `replit.md`
- **Validation:** Focused Jest suites for promoted Data Lab views/helpers/routes passed; `npm run build` passed with the pre-existing duplicate-class-member warning in `server/olc/adjusters.ts`; `git diff --check` passed.
- **Notes:** This is a hardening pass only — no new model promotions, no scoring changes, and no ingestion/database changes. Route errors now include additive operator metadata that the client uses for clearer operator hints.

### 2026-03-23 — Codex: Team Research Workspace team-level synthesis surface
- **What changed:** Added the read-only Team Research Workspace at `/tiber-data-lab/team-research` plus a new `teamResearch/` external-model orchestrator and `/api/data-lab/team-research` endpoint. The workspace aggregates promoted breakout, role, ARC, and point-scenario summaries for one team with team search, `team` deep-linking, key-player summaries, direct link-outs to Player Research, and explicit partial-data/error handling.
- **Files modified:** `server/modules/externalModels/teamResearch/*`, `server/routes/dataLabTeamResearchRoutes.ts`, `server/routes.ts`, `client/src/pages/TeamResearchLab.tsx`, `client/src/components/data-lab/TeamResearchWorkspaceView.tsx`, `client/src/lib/teamResearch.ts`, `client/src/lib/dataLabPromotedModules.ts`, `client/src/components/data-lab/PromotedModuleSystemCard.tsx`, `client/src/components/data-lab/PlayerResearchWorkspaceView.tsx`, `client/src/pages/DataLabHub.tsx`, `client/src/App.tsx`, `README.md`, `server/modules/externalModels/MODULE.md`, `replit.md`
- **Validation:** Focused Jest suites for the new service, route, promoted-nav helpers, hub, and workspace rendering all passed. `npm run build` passed with the pre-existing duplicate-class-member warning in `server/olc/adjusters.ts`.
- **Notes:** Workspace preserves a read-only trust posture, distinguishes missing team data from upstream/config errors, and intentionally links back into Player Research rather than inventing any new scoring or write paths.

### 2026-03-23 — Codex: Surface Data Lab discovery in core flows
- **What changed:** Added lightweight Player Research / Team Research quick links to core player-facing surfaces, added a compact read-only Data Lab discovery widget on the main dashboard that opens the Command Center, and added focused frontend tests for the new deep-link + widget behavior.
- **Files modified:** `client/src/components/data-lab/CoreResearchQuickLinks.tsx`, `client/src/components/data-lab/DataLabDiscoveryWidget.tsx`, `client/src/pages/PlayerPage.tsx`, `client/src/pages/TiberTiers.tsx`, `client/src/pages/Dashboard.tsx`, `client/src/__tests__/coreResearchQuickLinks.test.ts`, `client/src/__tests__/dataLabDiscoveryWidget.test.ts`, `README.md`, `replit.md`
- **Validation:** Ran targeted Jest suites for the new quick-link/widget coverage, `git diff --check`, and `npm run build` (passes with the existing duplicate-class-member warning in `server/olc/adjusters.ts`).
- **Notes:** This is intentionally an integration/discovery pass only — links reuse existing query-param conventions and the dashboard widget consumes Command Center outputs without recomputing or duplicating Data Lab model logic.


### 2026-03-23 — Codex: Player-page inline Research Summary block
- **What changed:** Added a compact read-only Research Summary block to `PlayerPage.tsx` that fetches the existing promoted Player Research workspace payload and shows a restrained subset of breakout, recipe, role/opportunity, age-curve, and point-scenario notes when available. Added explicit minimal CTA/empty behavior when no promoted summaries exist and a separate unavailable state when the promoted research system cannot be reached.
- **Files modified:** `client/src/components/data-lab/PlayerResearchSummaryBlock.tsx`, `client/src/pages/PlayerPage.tsx`, `client/src/__tests__/playerResearchSummaryBlock.test.ts`, `README.md`, `replit.md`
- **Validation:** Ran focused Jest coverage for the new summary block plus existing research-link behavior; ran `npm run build`; ran `git diff --check`.
- **Notes:** The player page remains read only and does not recompute any model logic locally; it simply surfaces a few promoted/orchestrated Player Research outputs and links users into the full workspace.

### 2026-03-23 — Codex: Schedule / SoS team summary surfacing Team Research
- **What changed:** Added a compact read-only `TeamResearchSummaryBlock` driven by the existing Team Research workspace payload, wired it into the routed Schedule / SoS team surface so a selected team now shows lightweight offensive-context / role / breakout / scenario / developmental notes plus a stable CTA into `/tiber-data-lab/team-research`, and preserved distinct empty vs unavailable states without recomputing model logic locally.
- **Files modified:** `client/src/components/data-lab/TeamResearchSummaryBlock.tsx`, `client/src/pages/SchedulePage.tsx`, `client/src/__tests__/teamResearchSummaryBlock.test.ts`, `README.md`, `replit.md`
- **Validation:** Ran focused Jest coverage for the new summary block + existing team research link helpers, ran `npm run build`, and ran `git diff --check`.
- **Notes:** The inline block intentionally stays lightweight and read only; the Schedule / SoS team table now acts as the main non-Data-Lab team-facing surface for promoted Team Research context.
