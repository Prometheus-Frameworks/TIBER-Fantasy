# Tiber Fantasy — Context Log

Running changelog of significant changes across all agents. Most recent entries at top.
Every agent should append an entry here after completing work.

---

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
