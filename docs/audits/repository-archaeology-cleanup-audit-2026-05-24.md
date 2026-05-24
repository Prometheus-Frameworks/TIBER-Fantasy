# Repository Archaeology Cleanup Audit - 2026-05-24

Issue: https://github.com/Prometheus-Frameworks/TIBER-Fantasy/issues/139

## Scope

This is an audit-only report. No files were deleted, moved, quarantined, or refactored.

The goal is to identify which legacy-looking files and directories are currently required, which are integration handoff material, which are documentation/reference material, and which should be handled in later cleanup PRs.

## Method

Evidence was gathered from:

- Runtime and deploy entrypoints: `package.json`, `server/index.ts`, `server/routes.ts`, `client/src/App.tsx`, `vite.config.ts`, `tsconfig.json`, `jest.config.cjs`, `railway.toml`, `nixpacks.toml`, `build.sh`.
- Direct reference checks with `rg` across imports, route registration, package/build/deploy config, tests, scripts, docs, and config files.
- File inventory checks for root files, requested legacy directories, generated artifacts, and tracked generated outputs.
- TIBER boundary docs: `AGENTS.md`, `README.md`, `ARCHITECTURE.md`, `CURRENT_PHASE.md`, `CODEBASE_MAP.md`, and `server/modules/externalModels/MODULE.md`.

Searches excluded `node_modules` for signal quality. `coverage/` was excluded during most reference checks, then inspected separately as a generated tracked artifact directory.

## Current Runtime Shape

| Area | Evidence | Cleanup implication |
|---|---|---|
| Node/Express backend | `package.json` runs `tsx server/index.ts` in dev, bundles `server/index.ts` in build, and starts `node dist/index.mjs` in production. `server/index.ts` imports `server/api/v1/routes` and `server/routes`. | The current runtime is the TypeScript/Node app, not the Flask app. |
| React/Vite frontend | `vite.config.ts` sets `root` to `client`, builds to `dist/public`, and aliases `@` to `client/src`, `@shared` to `shared`, and `@assets` to `attached_assets`. `client/src/App.tsx` owns current product routes. | `client/`, `shared/`, `server/`, `client/public/`, and related config are runtime/build required. |
| Deploy | `railway.toml` uses Nixpacks and `sh build.sh`; `nixpacks.toml` runs `npm run build`; `build.sh` bundles `server/index.ts`, runs `vite build`, and copies `server/bootstrap.mjs` to `dist/index.mjs`. | Deploy does not invoke root Python or Flask files. |
| Type/test scope | `tsconfig.json` includes only `client/src/**/*`, `shared/**/*`, and `server/**/*`. `jest.config.cjs` matches `**/__tests__/**/*.test.ts` and writes `coverage/`. | Root one-off TypeScript/Python test scripts are outside canonical typecheck/Jest scope unless manually run. |
| Runtime docs mount | `server/routes.ts` serves `docs/` at `/docs`. | `docs/` is a documented/reference surface and should not be bulk-deleted. |
| Data ownership boundary | `AGENTS.md` states TIBER-Fantasy is not canonical data authority; TIBER-Data owns canonical contracts, IDs, source metadata, and governed handoff artifacts. | Local data dumps need stronger separation between runtime cache, promoted handoff, and stale canonical copies. |

## Classification Summary

| Bucket | Areas |
|---|---|
| Runtime required | `client/`, `server/`, `shared/`, `migrations/`, `config/`, `ovr_inputs/`, selected `data/`, selected `server/data/`, selected root JSON/CSV files, `rag_news.db`, core package/build/deploy config. |
| Adapter / integration required | `server/modules/externalModels/`, promoted artifact fallback paths under `data/`, TIBER-Data player ownership paths, `tiber-cowork-plugin/` if the Claude Cowork distribution remains supported. |
| Docs/reference keep | `AGENTS.md`, `README.md`, `ARCHITECTURE.md`, `CURRENT_PHASE.md`, `CODEBASE_MAP.md`, `docs/`, `archive/`, `reports/`, `manus/`, `codex-handoff/`, selected root planning docs. |
| Candidate for archive quarantine | Old Flask stack, root Python research scripts, root ad hoc TypeScript tests, most of `attached_assets/`, `live_data/`, root old static HTML/utility assets, nested `TIBER-Fantasy/tiber-cowork-plugin/`. |
| Candidate for deletion | Generated `coverage/`, SQLite sidecars after storage decision, obvious generated/cache/debug outputs with no runtime refs, stale root data dumps after runtime whitelist and TIBER-Data replacement are proven. |
| Needs owner decision | Stale root docs consolidation, Python environment files, root `public/` because one UI link points at `signals-and-notes.html`, local canonical-looking player/team/depth-chart datasets, plugin duplication and distribution policy. |

## Detailed Findings

### Runtime Required

| Area | Classification | Evidence | Notes |
|---|---|---|---|
| `client/`, `server/`, `shared/` | Runtime required | `package.json` dev/build/start scripts target `server/index.ts`; `tsconfig.json` includes these trees; `client/src/App.tsx` registers current routes. | No cleanup in these areas without normal feature ownership review. |
| `migrations/` | Runtime required | `server/index.ts` imports Drizzle migrator and runs migrations from `migrations`; `drizzle.config.ts` points `out` to `./migrations` and schema to `./shared/schema.ts`. | Keep. |
| `config/` | Runtime required | Root config files are referenced by current services and docs; package scripts include config-driven QA/metric commands. | Keep unless each file gets a route/service-specific audit. |
| `ovr_inputs/` | Runtime required | `server/services/ovrEngine.ts` reads all four files directly: `compass_mapping.csv`, `ovr_delta_rules.json`, `decay_engine.json`, and `preseason_to_base_ovr.csv`. | Do not quarantine unless OVR runtime is removed or adapterized. |
| `knowledge/` | Adapter / integration required | `server/scripts/embed-brain-os.ts`, `embed-theory.ts`, and `embed-waiver-wisdom.ts` read from `knowledge/`. `server/services/MODULE_RAG.md` documents it as RAG knowledge source. | Keep as RAG source material. Consider moving under `docs/rag/` only with script updates. |
| `rag_news.db` | Runtime required | `server/routes/ragRoutes.ts` defaults `RAG_DB` to `rag_news.db`; `server/routes.ts` mounts `createRagRouter()` and calls `initRagOnBoot()`. | Current Node RAG route expects this SQLite DB unless `RAG_DB` is configured elsewhere. |
| `fantasy_lexicon.v1.json`, `fantasy_synonyms.v1.json`, `team_synonyms.v1.json` | Runtime required | `server/routes/ragRoutes.ts` loads these by default unless `FF_LEXICON_PATH`, `FF_SYNONYMS_PATH`, or `FF_TEAM_SYNONYMS_PATH` override them. | Keep with RAG until paths are moved/configured. |
| `complete_18_week_rb_logs.json` | Runtime required | `server/routes/rbCompassRoutes.ts` reads it from repo root. | Runtime dependency, but it is canonical-looking historical data and should eventually be replaced by an upstream or generated artifact path. |
| `wr_18_week_gamelogs.json` | Runtime required for generation endpoint | `server/api/generate-wr-snap-data.ts` reads it from repo root. | Keep until the WR snap generation route is replaced or the file is moved behind config. |
| `projections.json` | Runtime fallback | `server/advancedRankings.ts` reads root `projections.json` as fallback projections. | Keep until fallback behavior is retired or moved to `server/data/`/external cache. |
| `data/current_intel.json` | Runtime required | `server/routes.ts` reads/writes it for `/api/intel/current` and `/api/intel/add`; `server/services/xIntelligenceScanner.ts` stores X intel there. | Treat as runtime state/cache, not canonical truth. |
| `data/player_pool.json`, `data/player_index.json` | Runtime required | `server/playerPool.ts` reads both; `client/src/lib/playerPool.ts` fetches `/data/player_index.json`. | Keep for now; later migrate identity to TIBER-Data contract or generated build artifact. |
| `data/rookies/2026_rookie_grades_v2.json` | Adapter / integration required | `server/modules/externalModels/rookies/rookieArtifactClient.ts` defaults to this path; README documents `ROOKIE_PROMOTED_ARTIFACT_PATH`. | Acceptable only as a promoted TIBER-Rookies handoff copy, not canonical source. |
| `data/signal-validation/` | Adapter / integration required | `server/modules/externalModels/signalValidation/signalValidationClient.ts` defaults to this directory and expects `wr_player_signal_cards_{season}.csv` plus `wr_best_recipe_summary.json`. | Keep as promoted Signal-Validation export fallback. |
| `data/role-opportunity/role_opportunity_lab.json` | Adapter / integration required | `server/modules/externalModels/roleOpportunity/roleOpportunityClient.ts` defaults `ROLE_OPPORTUNITY_EXPORTS_PATH` to this file. | Keep as promoted Role Opportunity fallback. |
| `server/data/nflfastr_jargon_mapping.json` | Runtime required | Imported by `server/services/nflfastrValidation.ts` and `server/services/geminiEmbeddings.ts`. | Keep. |
| `server/data/wr_ratings.csv`, `server/data/wr_snap_percentages_2024.json` | Runtime required | Read by `server/services/wrGameLogsService.ts`, `server/routes.ts`, and `server/services/sleeperSnapService.ts`. | Keep until WR routes are migrated. |
| `server/data/rb_projections_2025.json` | Runtime required | Read by `server/services/rbProjectionsService.ts` and `server/routes/rbCompassRoutes.ts`. | Keep. |
| `server/data/game_logs_2024.json`, `season_stats_2024.json`, `weekly_projections_2025.json` | Runtime required | `server/services/logsProjectionsService.ts` reads these files. | Keep unless service is replaced. |
| `server/data/screenshot_data_bank.json` | Runtime required for team analytics loader | `server/modules/team-analytics/dataLoader.ts` reads it. | Keep until team analytics ingestion is moved. |
| `server/data/sleeper_cache/players.json` | Runtime cache | `server/services/sleeperSyncService.ts` reads/writes `server/data/sleeper_cache/players.json` and `projections.json`. | Runtime-adjacent cache, but should probably be moved to ignored/cache storage. |

### Adapter / Integration Required

| Area | Classification | Evidence | Notes |
|---|---|---|---|
| `server/modules/externalModels/` | Adapter / integration required | `server/modules/externalModels/MODULE.md` defines the boundary for promoted model services and TIBER-Data-owned artifacts. | This is the correct downstream consumer pattern. |
| TIBER-Data player ownership paths | Adapter / integration required | `server/modules/externalModels/playerOwnership/playerOwnershipClient.ts` defaults to `../TIBER-Data/exports/promoted/player_ownership/...`. README documents the env vars. | Good boundary: references upstream promoted artifacts instead of local canonical copies. |
| Age Curve, Point Scenario, Team State default paths | Adapter / integration required, but missing local artifacts | Clients default to `data/age-curves`, `data/point-scenarios`, and `data/team-state` paths, but these dirs were not present in inventory. | This is okay if configured by env or expected unavailable states; document in runbooks if intentional. |
| `tiber-cowork-plugin/` | Adapter / integration required or docs/reference keep | Docs mention it as Claude Cowork distribution; it contains `.claude-plugin/plugin.json`, commands, skills, and OpenClaw tools. | Keep if the plugin remains a supported distribution channel. Cleanup should focus on duplicate config, not the whole plugin. |

### Docs / Reference Keep

| Area | Classification | Evidence | Notes |
|---|---|---|---|
| `AGENTS.md`, `README.md`, `ARCHITECTURE.md`, `CURRENT_PHASE.md`, `CODEBASE_MAP.md` | Docs/reference keep | Required by root agent instructions and architecture docs; `AGENTS.md` defines TIBER ownership boundaries. | Keep. |
| `docs/` | Docs/reference keep | `server/routes.ts` serves `docs/` statically; repo docs include architecture, contracts, runbooks, tasks, ADRs, and audits. | Keep, but old docs can be consolidated in a docs-only PR. |
| `docs/architecture/TIBER_FANTASY_MODULE_CLASSIFICATION_AUDIT.md` and `FORGE_EXTERNALIZATION_TRANSITION_SPEC.md` | Docs/reference keep | These directly describe legacy-module classification and externalization direction. | Use as input to follow-up cleanup batches. |
| `archive/` | Docs/reference keep | Contains completed milestone and sleeper sync records. No runtime refs found outside docs/scripts. | Already an archive. Keep unless owner wants deeper pruning. |
| `reports/` | Docs/reference keep / needs consolidation | Contains audit, roadmap, validation, and session reports. `manus/` templates reference writing reports into this folder. | Do not delete. Consider moving durable reports under `docs/reports/` later. |
| `manus/` | Docs/reference keep | `CURRENT_PHASE.md` calls the governance pack live; `AGENT_BOOTSTRAP.md` and report docs reference it. | Keep unless the Manus workflow is retired. Note README references `manus/CONTRIBUTING.md`, which was not present. |
| `codex-handoff/` | Docs/reference keep | Contains API, DB, instrumentation, runbook, and sanity sample handoff docs. No runtime refs found. | Keep for now; consolidate under `docs/dev/` later if owner agrees. |
| Root docs such as `DATA_ARCHITECTURE_MAP.md`, `TIBER_CONTEXT.md`, `SESSION_STATE.md`, `WR_ROLE_BANK_V1_1_AUDIT.md` | Needs owner decision | Many are historical or duplicate architecture/context docs; not runtime referenced by config. | Consolidate, do not delete blindly. |

### Candidate For Archive Quarantine

| Area | Classification | Evidence | Notes |
|---|---|---|---|
| Old Flask stack: `app.py`, `routes/*.py`, `README_FLASK.md`, `flask_requirements.txt` | Candidate for archive quarantine | Deploy/build scripts do not invoke Flask. `app.py` registers Flask blueprints from `routes/`; Python tests reference Flask; current Node runtime is `server/index.ts`. | Quarantine as a coherent legacy Flask app after owner sign-off. |
| Root Flask/support Python: `tiber_scope.py`, `tiber_identity.py`, `tiber_core_logic.py`, `tiber_dynasty_evaluation.py`, `roster_shift_listener.py` | Candidate for archive quarantine | Referenced by `app.py`, Flask routes, or other root Python modules, not by current Node runtime. | Move with Flask stack in one PR, not piecemeal. |
| Root Python data scripts: `fetch_*`, `populate_game_logs.py`, `verify_18_weeks.py`, `debug_wr_data.py`, `rb_*analysis.py`, `tiber_rb_gamelogs.py` | Candidate for archive quarantine | Generate root JSON/CSV outputs and are not package/deploy entrypoints. Some are documented in old pipeline notes. | Quarantine to `archive/legacy-python-data-scripts/` only after data-source replacement is documented. |
| Root Python tests: `test_*.py`, `test-python-comprehensive.py` | Candidate for archive quarantine | Not part of `npm run test`; no pytest script is canonical. Some import Flask `app.py`. | Move with Flask/data-script batch unless owner still runs them manually. |
| Root ad hoc TypeScript tests: `_check_bronze.ts`, `_verify.ts`, `_test_bronze_to_silver.ts`, `_test_full_pipeline.ts` | Candidate for archive quarantine | Outside `tsconfig` include and Jest `testMatch`; referenced by old ETL docs and `CODEBASE_MAP.md`. | If still useful, move under `scripts/` or `docs/legacy-etl/` with run instructions. |
| `live_data/` | Candidate for archive quarantine | No current route/build/test references found; references appear only in archive docs and pasted historical assets. | Good small quarantine candidate after confirming no operator process reads it manually. |
| Most of `attached_assets/` | Candidate for archive quarantine | 507 tracked files, mostly screenshots, pasted prompts, zips, PDFs, and one-off CSVs. Runtime search found no `@assets` imports; only `server/tests/load-2024-baseline-data.ts` directly reads two pasted baseline text files. | Do not bulk-delete. Quarantine in batches after preserving the two test fixture references or moving them to a fixture path. |
| Root old static shell: `index.html`, `qr-code.html`, `qb-stats-review.png`, `drops-label.png`, `generated-icon.png`, utility JS | Candidate for archive quarantine / needs owner decision | Current Vite app uses `client/index.html`; root `index.html` is old "On The Clock" static shell. No current build references found. | Quarantine only after checking any external static hosting expectations. |
| Nested duplicate `TIBER-Fantasy/tiber-cowork-plugin/plugin-config.json` | Candidate for archive quarantine or deletion | Search found it as a nested duplicate path; `.gitignore` ignores `tiber-cowork-plugin/plugin-config.json`, not nested config. | Verify it contains no secret, then remove or ignore in plugin cleanup PR. |

### Candidate For Deletion

These should be deleted only in follow-up PRs after the runtime whitelist above is protected.

| Area | Classification | Evidence | Notes |
|---|---|---|---|
| `coverage/` | Candidate for deletion | `jest.config.cjs` writes coverage to `coverage/`; `git ls-files coverage` shows generated HTML/XML/JSON reports are tracked. | Delete in generated-artifacts PR and add `coverage/` to `.gitignore`. |
| `rag_news.db-shm`, `rag_news.db-wal` | Candidate for deletion after RAG storage decision | `rag_news.db` is the runtime DB path, but sidecars are SQLite WAL artifacts with no direct code refs. | Do not delete until RAG boot and deployment storage behavior are confirmed. |
| Root generated/debug outputs with no runtime refs: `fpa_*`, `ctx_*`, `default_test.json`, `rb_comprehensive_analysis.json`, `rb_structured_evaluation.json`, `debug_console_output.md`, `consent_log.json` | Candidate for deletion | No runtime/build refs found. Mostly outputs from ad hoc scripts or tests. | Delete only after owner confirms no audit/legal retention need. |
| Root stale data dumps with no current runtime refs: `depth_charts_*.jsonl`, `player_inputs_2024*.csv`, `player_profile_2024*.csv`, `player_scores_2024.csv`, `quarterbacks_2024_gamelogs.json`, `complete-qb-*`, `elite_te_*`, `wr_2024_additional_game_logs.json`, `wr_snap_percentages_2024.json` | Candidate for deletion or quarantine | Reference checks found generator scripts/docs, but not current Node runtime reads for these root copies. | These are also TIBER-Data boundary risks. Prefer quarantine first, then delete after upstream artifacts replace them. |
| `data/forge/forge_*.json` | Candidate for deletion or generated-cache quarantine | FORGE route docs indicate timestamped snapshots are created under `data/forge/`; no reader was found in the checked runtime paths. | Treat as generated snapshots. Keep only if needed for audit history. |
| `server/data/player_ratings_v1.json`, `server/data/ratings_engine_config.json` | Needs owner decision before deletion | Search found them in stale `build-copy-data.js`/`build-deploy.js`, but not in active build scripts or runtime service reads. | Could be stale rating assets; confirm against `server/src/modules/ratings` ownership before deletion. |

### Needs Owner Decision

| Area | Why owner decision is needed | Recommendation |
|---|---|---|
| Root canonical-looking data dumps | They duplicate player/team/depth-chart/game-log truth inside TIBER-Fantasy, which conflicts with the TIBER-Data ownership boundary if treated as canonical. Some are still runtime fallbacks. | Create a runtime whitelist first, then migrate or quarantine the rest with explicit TIBER-Data replacement paths. |
| `pyproject.toml`, `requirements.txt`, `uv.lock` | Python is still present for scripts and historical Flask work, but production deploy is Node/Nixpacks and `flask_requirements.txt` is Flask-specific. | Decide whether Python remains a supported local data-tooling lane. If yes, split active scripts from legacy Flask deps. |
| Root `public/` | Vite root is `client`, so root `public/` is not the normal Vite public dir. However `client/src/components/data-attribution-footer.tsx` links to `/signals-and-notes.html`, which exists in root `public/`, not `client/public/`. | Decide whether to move live static pages to `client/public/`, route them through Express, or quarantine old static pages. |
| `build-copy-data.js` and `build-deploy.js` | These copy/check `dist/index.js` and specific JSON files, while active deploy uses `build.sh` and `dist/index.mjs`. | Treat as stale build tooling unless an operator still runs them manually. |
| `MainPlayerSystem.json` and related route docs | `server/routes.ts` marks MainPlayerSystem generation as deprecated and returns 410, but `server/services/depthChartService.ts` can still save `MainPlayerSystem.json`. | Decide whether this system is retired; then delete/quarantine the artifact and service path together. |
| `tiber-cowork-plugin/` vs `TIBER-Fantasy/tiber-cowork-plugin/` | The top-level plugin looks intentional; nested folder looks accidental or a previous merge artifact. | Keep the plugin, remove duplicate nested config after secret check. |

## TIBER-Data Boundary Risks

The highest-risk cleanup theme is not file size; it is data authority drift.

Likely boundary violations or future violations:

- Root depth chart and player input/profile/score CSV/JSON files look like canonical data snapshots in the downstream product repo.
- Root 2024 game-log and position datasets are generated historical datasets; some are runtime fallbacks, but the source of truth should be upstream or clearly generated.
- `data/player_pool.json` and `data/player_index.json` are runtime useful but should eventually be produced from TIBER-Data identity contracts rather than hand-maintained in TIBER-Fantasy.
- `server/data/sleeper_cache/players.json` is a runtime cache and should be treated as generated/cache state, not repo truth.
- Promoted artifacts under `data/rookies`, `data/signal-validation`, and `data/role-opportunity` are acceptable only as read-only handoff copies with clear provenance. They should not become places where TIBER-Fantasy edits or normalizes upstream truth silently.

Positive boundary patterns already present:

- `server/modules/externalModels/` validates promoted model payloads at the edge and exposes stable TIBER-facing interfaces.
- Player ownership defaults point to `../TIBER-Data/exports/promoted/...`, which preserves upstream ownership.
- README and runbooks explicitly frame promoted labs as read-only and non-recomputing.

## Suggested Follow-Up PRs

> Update (2026-05-24): Follow-up cleanup PR removed tracked `coverage/` generated artifacts and added `coverage/` to `.gitignore` to prevent reintroduction.

Keep these small. Do not combine them into one cleanup megachange.

1. Generated artifacts PR
   - Delete tracked `coverage/`.
   - Add `coverage/` and SQLite sidecar patterns to `.gitignore`.
   - Do not touch `rag_news.db` in this PR unless RAG storage is decided.

2. Plugin duplication PR
   - Inspect `TIBER-Fantasy/tiber-cowork-plugin/plugin-config.json` for secrets.
   - Remove or ignore only the nested duplicate.
   - Keep top-level `tiber-cowork-plugin/` unless owner retires the distribution channel.

3. Old Flask quarantine PR
   - Move `app.py`, `routes/*.py`, `README_FLASK.md`, `flask_requirements.txt`, Flask-specific root Python tests, and direct Flask support modules together.
   - Add a short archive index explaining that current runtime is Node/Express.

4. Root data runtime whitelist PR
   - Add a documented list of root JSON/CSV files still read by runtime.
   - Move code paths toward configured `data/` or `server/data/` paths where appropriate.
   - Only then quarantine unused root dumps.

5. TIBER-Data boundary PR
   - Replace stale canonical-looking local data copies with upstream promoted artifact paths or generated build/cache outputs.
   - Start with player identity/player pool and depth chart files.

6. Static/public PR
   - Decide whether `public/signals-and-notes.html` is live.
   - If live, move it under `client/public/` or serve root `public/` explicitly.
   - Quarantine old `rankings.html`, `profiles.html`, `analytics.html`, `labyrinth/`, and `recursions/` if not live.

7. Docs consolidation PR
   - Keep root operational docs (`AGENTS.md`, `README.md`, `ARCHITECTURE.md`, `CURRENT_PHASE.md`, `CODEBASE_MAP.md`).
   - Move stale root plans/reports into `docs/archive/` or `archive/docs/` with an index.
   - Fix the README reference to missing `manus/CONTRIBUTING.md`.

8. Python tooling decision PR
   - Decide whether Python is an active local data-tooling lane.
   - If yes, move active scripts under `scripts/` with docs and trim Flask-only dependencies.
   - If no, quarantine the root Python scripts after confirming no current operator workflow depends on them.

## Validation

Validation was attempted after adding only this Markdown report.

| Command | Result | Notes |
|---|---|---|
| `npm run typecheck` | Failed | Broad pre-existing TypeScript errors unrelated to this report. Representative failures include missing modules (`@/lib/redraftApi`, `@radix-ui/react-accordion`, `./sportsdata`), undefined symbols in `server/advancedRankings.ts` (`allProjections`, `Fuse`, `cache`, `path`, `fs`), and multiple existing strictness/schema typing errors across client/server files. |
| `npm run test` | Failed immediately on Windows/PowerShell | The package script uses POSIX inline env syntax: `NODE_OPTIONS=--experimental-vm-modules jest ...`, which PowerShell reports as not recognized. |
| `$env:NODE_OPTIONS='--experimental-vm-modules'; npx.cmd jest --config jest.config.cjs --runInBand` | Timed out after 180 seconds | The suite reported results before hanging on open handles: 82 total suites, 75 passed, 7 failed; 390 total tests, 389 passed, 1 failed. Representative failures: missing `DATABASE_URL` in DB-backed tests, `leagueSyncRoutes.test.ts` receiving 500 instead of 200, missing `./rosterDiff`, missing `vitest`, and duplicate `__filename` parsing in `server/consensus/injuryProfiles.ts`. |

The Jest run rewrote tracked `coverage/` artifacts and created new coverage HTML; those generated validation outputs were restored/removed so this PR remains audit-only.
