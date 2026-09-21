# Tiber Fantasy

## Overview
TIBER is an open NFL intelligence platform designed to serve as a central "brain" for football analysis, accessible to AI agents, personal assistants, and human users. Externally branded as TiberClaw, it offers a unified intelligence layer covering both fantasy football and real NFL evaluation, including scoring engines, player evaluation, matchup analysis, rookie grading, and trade analysis. All intelligence is provided via authenticated REST endpoints. The platform is free, open-source, and committed to being paywall-free.

The core concept is that TIBER provides structured, high-confidence outputs that various agents and clients can consume and act upon, without dictating their specific actions. Its broad coverage spans fantasy skill positions, IDP, matchup context, and real NFL efficiency metrics, positioning it as a general football intelligence source rather than a narrow tool.

## User Preferences
Preferred communication style: Simple, everyday language.
Mission commitment: Strictly avoid all paywall partnerships or data sources. Maintain complete independence and free access to all platform features.
Community Discussion Philosophy: Transform statistical insights into meaningful conversations that help real people make better fantasy decisions.
Player Evaluation System: "Player Compass" - Dynamic, context-aware player profiles with tiers, scenario scores, and decision-making guidance instead of rigid rankings. Emphasizes flexibility and serves multiple team strategies.
Agent Integration Philosophy: TIBER outputs canonical, structured intelligence that agents (TiberClaw and others) can consume directly. Responses follow the shared intelligence contract (shared/types/intelligence.ts) so any agent can parse them without custom logic per endpoint.
Intelligence Feed System:
- Simple API endpoints ready for real-time updates when season starts
- Preseason observations archived but not weighted in analysis
- Intel sourced from trusted X/Twitter accounts, not personal observations
- `/api/intel` endpoint serves scouting reports with filtering by player, position, and signal strength
- Ready to receive meaningful intel updates during regular season

## System Architecture
The platform utilizes a 3-tier ELT architecture (Bronze → Silver → Gold layers) emphasizing data quality and confidence scoring.

**Core Infrastructure:**
- **Backend**: Node.js/TypeScript (Express.js) and Python (Flask).
- **Frontend**: React 18, TypeScript, Tailwind CSS, TanStack Query, shadcn/ui.
- **Database**: PostgreSQL with Drizzle ORM and `pgvector` extension.
- **Player Identity**: A unified `Identity Bridge` uses `gsis_id` for consistent player resolution, focusing on `activeSkillPlayers`.

**UI/UX Decisions (v2 Light Mode Redesign):**
- **Color Scheme**: Light mode with white/grey backgrounds, accented by Ember (`#e2640d`).
- **Typography**: Instrument Sans (UI), JetBrains Mono (data/code), Newsreader (editorial).
- **Layout**: Fixed 220px sidebar for navigation.
- **Homepage (`Dashboard.tsx`)**: Features a hero section, position-filter toolbar, status cards, a FORGE-powered player data table, insights, and chat preview.
- **Universal Current Week System**: API endpoint (`/api/system/current-week`) for real-time NFL week detection.

**Technical Implementations & Feature Specifications:**
- **Unified Player Hub (UPH)**: Centralizes player data, "Player Compass" profiles, "TIBER Consensus" rankings, and Madden-style OVR.
- **AI & Analytics**: Integrates "Competence Mode" AI, Adaptive Consensus Engine, DeepSeek + Compass Fusion System, RAG Chat System using Google Gemini AI, Tiber Memory (FANTASY vs GENERAL pools), and Tiber Voice with a 5-tier Truth Hierarchy.
- **CATALYST (Contextual Adaptive Tactical Leverage Yield Score)**: Identifies clutch performers vs garbage-time stat padders using EPA weighted by win probability, opponent quality, game script, and recency. Python scoring engine at `server/modules/catalyst/catalystCalculator.py`. Scores stored in `catalyst_scores` table (weekly cumulative, seasons 2024 + 2025). UI at `/catalyst` features: season toggle (2024/2025, defaults 2025), 5-tier label system (Elite Clutch / Clutch / Neutral / Low Signal / Garbage Time Risk), component factor bars with plain-language explanations, and a collapsible "2024 → 2025 Signal Validation" YoY comparison panel showing how 2024 clutch leaders performed in 2025. To regenerate scores: `python3 server/modules/catalyst/catalystCalculator.py <season>`.
- **FORGE (Football-Oriented Recursive Grading Engine)**: A core player evaluation system providing unified Alpha scores (0-100) for skill positions AND IDP positions. It features a modular design with endpoints for batch and individual player evaluation, supports `redraft`, `dynasty`, `bestball` modes, and uses pillar-based scoring (volume, efficiency, team context, stability). It includes position-specific percentile calibration, Tiber Tiers, multi-week aggregation, and tools like FORGE Workbench, Next Man Up, and FORGE SoS. It also incorporates a team-to-QB mapping system for QB-aware context. IDP positions (EDGE, DI, LB, CB, S) use the `idpForgeEngine` which reads from `idp_player_season` + `idp_player_week`. Role banks exist for all 9 positions (QB/RB/WR/TE + EDGE/DI/LB/CB/S). To recompute defensive role banks: `tsx server/scripts/computeAllDefensiveRoleBank.ts [season]`. FORGE grade cache compute endpoint: `POST /api/forge/compute-grades` with `x-admin-key: 001247291`.
- **Tiber Tiers Page (`/tiers`)**: User-facing rankings served by `GET /api/rankings/v2/weekly`. The public `v2-canonical-identity-2026-08-09` revision makes item `playerId` canonical-only and nullable: only coherent canonical/resolved identity states are linkable, while unresolved producer rows remain visible with their source identifier under `identity.sourceId`.
- **Tiber Data Lab**: Research department managing Snapshots, Personnel Groupings, Role Banks, the read-only WR Breakout Lab at `/tiber-data-lab/breakout-signals`, the read-only Role & Opportunity Lab at `/tiber-data-lab/role-opportunity`, the read-only Age Curve / ARC Lab at `/tiber-data-lab/age-curves`, and the read-only Point Scenario Lab at `/tiber-data-lab/point-scenarios`. The WR Breakout Lab is powered by promoted Signal-Validation-Model exports surfaced through `server/modules/externalModels/signalValidation/` and `GET /api/data-lab/breakout-signals`; TIBER-Fantasy only renders exported signal cards / recipe summaries, now with client-side operator sort/search/filter polish and grouped read-only detail sections, and does not recompute breakout scores. The Role & Opportunity Lab is the second promoted sub-model and is powered through `server/modules/externalModels/roleOpportunity/` plus `GET /api/data-lab/role-opportunity`, sourcing TIBER-Data compatibility payloads or stable exported artifacts while remaining strictly read only and non-recomputing. The Age Curve / ARC Lab is the third promoted sub-model and is powered through `server/modules/externalModels/ageCurves/` plus `GET /api/data-lab/age-curves`, sourcing adapter-friendly ARC outputs or stable exported artifacts while remaining strictly read only and non-recomputing. The Point Scenario Lab is the fourth promoted sub-model and is powered through `server/modules/externalModels/pointScenarios/` plus `GET /api/data-lab/point-scenarios`, sourcing Point-prediction-Model scenario outputs or stable exported artifacts while remaining strictly read only and non-recomputing. The four promoted labs now share a stabilization layer: consistent loading / empty / error copy, shared read-only + provenance wording, operator-visible upstream/config guidance, a lightweight hub help/status panel, and cross-module links that carry `playerId` / `playerName` plus season so operators can pivot the same player across breakout, deployment, developmental, and scenario context without re-searching.
 The first cross-model synthesis surface in that promoted lane is now the Player Research Workspace at `/tiber-data-lab/player-research`, powered by `server/modules/externalModels/playerResearch/` plus `GET /api/data-lab/player-research`. It starts with TIBER-Data roster truth from the read-only `player_ownership_v0` consumer (`GET /api/data-lab/player-ownership`) and then reuses the four promoted read-only adapters to aggregate one player’s breakout, role, ARC, and point-scenario summaries in one place, supports player-name search + `playerId` deep-linking, carries season through module links, and keeps explicit partial-data/error states without implying any local recomputation of roster truth or the underlying models.
 The Team Research Workspace at `/tiber-data-lab/team-research`, powered by `server/modules/externalModels/teamResearch/` plus `GET /api/data-lab/team-research`, is the team-level complement to Player Research. It reuses the same four promoted read-only adapters plus canonical team metadata to aggregate one offensive environment’s opportunity, breakout, developmental, and scenario context in one place, supports team search + `team` deep-linking, links each notable player back into Player Research, and preserves explicit partial-data/error states without implying any local recomputation of the underlying models.
 The Data Lab Command Center at `/tiber-data-lab/command-center`, powered by `server/modules/externalModels/dataLabCommandCenter/` plus `GET /api/data-lab/command-center`, is now the front door for the promoted research lane. It reuses the same four promoted read-only adapters to surface the strongest current section-level signals, a lightweight ready/empty/unavailable strip, and quick links into Player Research / Team Research without recomputing any underlying model logic or inventing a single cross-model score.

TIBER Management Dashboard is now the first product-shell step toward “sync my team → manage my roster with TIBER.” The user-visible `/management` route (with `/team-management` alias) uses existing league sync/context/dashboard APIs, shows no-team empty states, exposes roster snapshot and diagnosis placeholders, maps model signal readiness, and deep-links into Command Center, Player Research, Team Research, Role & Opportunity, FORGE, Rookie Board, and Point Scenarios without creating new model contracts or fantasy advice. Teamstate movement is queried live from the existing read-only inspection endpoint before the Management card reports ready, and remains outside scoring, rankings, projections, trade advice, player truth, and roster diagnosis automation.
 The public `/draft-review` pilot is a narrower redraft doorway. It accepts a numeric Sleeper league ID or an exact public Sleeper league, draft, or roster URL; league/draft inputs return a minimal public roster selector without authenticating ownership. The state-isolated compiler exposes current roster state, normalized scoring and reserve rules, deterministic lineup/bench checks, and a bounded complete draft board with timer, slot, and turn-distance evidence. It exports an agent-ready context packet without database or shared `default_user` context. It does not use FFC ADP, infer current reserve eligibility or bye weeks, invent Forecast output, grade a draft, or recommend transactions; missing evidence remains explicitly unavailable.
 Core product flows now expose that promoted lane through lightweight discovery hooks: player-facing pages and rankings can deep-link into Player Research, player detail pages now surface a compact inline Research Summary block powered by promoted Player Research outputs, the Schedule / SoS team view now surfaces a compact Team Research Summary block linked to the full Team Research Workspace, team labels can deep-link into Team Research, and the main dashboard carries a compact read-only Command Center widget so users can reach promoted research without a large page redesign or any duplicate model logic.
- **xFPTS v2**: Context-aware expected fantasy points system.
- **Position-Aware Enrichment**: Full position-specific data enrichment.
- **EPA Analytics**: Advanced efficiency metrics.
- **Defense vs Position (DvP) Matchup System**: Calculates fantasy points allowed by defenses.
- **Data Integration & Sync**: Includes Sleeper Sync, Canonical Player Pool, and NFL Schedule Sync.
- **External Model Adapter Layer**: Promoted lab/model repos must enter through `server/modules/externalModels/` using dedicated clients, edge validation, typed error mapping, and stable TIBER-facing interfaces. First integrations: `Role-and-opportunity-model` via `GET /api/integrations/role-opportunity/:playerId?season=<year>&week=<week>` plus the promoted read-only lab route `GET /api/data-lab/role-opportunity[?season=<year>][&week=<week>]`, Signal-Validation-Model exports via `server/modules/externalModels/signalValidation/` + `GET /api/data-lab/breakout-signals[?season=<year>]`, ARC / age-curve exports via `server/modules/externalModels/ageCurves/` + `GET /api/data-lab/age-curves[?season=<year>]`, Point-prediction-Model scenario outputs via `server/modules/externalModels/pointScenarios/` + `GET /api/data-lab/point-scenarios[?season=<year>]`, live scoring-service routes via `server/modules/externalModels/scoring/` (`POST /api/tiber/weekly/player-card`, `/weekly/rankings`, `/ros/player-card`, `/weekly/compare`) consumed by player detail + rankings surfaces, and the promoted TIBER-Rookies artifact adapter via `server/modules/externalModels/rookies/` + `GET /api/rookies/:season` (product route `/rookies`). Player detail hydration at `GET /api/player-identity/player/:id` now supports opt-in external enrichments through a reusable `playerDetailEnrichment` orchestrator plus scoring flags: `includeRoleOpportunity=true&season=<year>&week=<week>` for role usage preview, `includeExternalForge=true&season=<year>[&week=<week|season>][&externalForgeMode=redraft|dynasty|bestball]` for an additive external FORGE preview, `includeForgeComparison=true&season=<year>[&week=<week|season>][&externalForgeMode=redraft|dynasty|bestball]` for a migration-only side-by-side legacy-vs-external FORGE comparison block, and `includeScoringWeekly=true&includeScoringRos=true&season=<year>&week=<week>` for live scoring snapshots. All preview paths keep stable non-fatal status envelopes while preserving legacy defaults and thin route logic.
- **FORGE externalization migration tooling**: External FORGE now enters through `server/modules/externalModels/forge/` with a dedicated client/adapter/service stack and a compare-only orchestration path. `POST /api/integrations/forge/compare` dual-runs legacy in-repo FORGE and external FORGE for the same single-player offensive E+G request, returning isolated per-side results plus stable diff metadata for migration analysis. `GET /api/integrations/forge/health` reports config/readiness only, `GET /api/integrations/forge/parity-report` exposes a stable migration-only parity summary contract, and `GET /api/integrations/forge/review` returns sampled multi-player comparison batches for operator migration review. Live `/api/forge/*` behavior remains unchanged in this phase.
- **FORGE parity harness/reporting**: External FORGE migration tooling now also includes a committed fixture pack plus a deterministic parity harness/report layer under `server/modules/externalModels/forge/`. The harness replays labeled comparison fixtures through the existing compare service, summarizes `close`/`drift`/`unavailable`/`not_comparable` outcomes, and can be run locally with `npm run forge:parity` for snapshot-style migration tracking. `npm run forge:parity:report` exports the higher-level parity report contract with readiness metadata plus the stable per-fixture `results` array for drift debugging and offline inspection.
- **Architecture Doctrine**: TIBER-Fantasy is the product shell and orchestration core. Standalone model brains should be consumed through adapters/orchestrators and should not become permanent in-repo residents unless explicitly justified. The current cleanup map lives at `docs/architecture/TIBER_FANTASY_MODULE_CLASSIFICATION_AUDIT.md`, and the current FORGE replacement target is defined in `docs/architecture/FORGE_EXTERNALIZATION_TRANSITION_SPEC.md`.
- **LLM Gateway (`server/llm/`)**: A provider-agnostic `callLLM()` entry point with fallback across OpenRouter, OpenAI, Anthropic, and Google Gemini, supporting 9 task types. Includes an X Intelligence Scanner (`server/services/xIntelligenceScanner.ts`) for Grok-powered X/Twitter analysis.

**Deployment Architecture:**
- **Target**: Autoscale (Cloud Run) for stateless REST API, with persistent state in PostgreSQL.
- **Build Process**: `sh build.sh` compiles frontend via `vite build` and bundles server via esbuild.
- **Runtime**: `node dist/index.mjs` for faster startup.
- **Bootstrap (`server/bootstrap.mjs`):** A small file to quickly bind a port and serve basic routes while the main Express app loads.
- **Production Routing Contract**: `GET /health` is the canonical machine-readable health probe. Production `GET /` serves the frontend SPA shell when `dist/public/index.html` is present; if frontend assets are missing, `/` returns a small JSON fallback response instead of a hard failure.

## External Dependencies
- **MySportsFeeds API**: Injury reports and NFL roster automation.
- **Sleeper API**: Player projections, game logs, ADP data, league/roster sync.
- **NFLfastR (nflverse)**: Play-by-play and NFL schedule data.
- **NFL-Data-Py**: Weekly statistics, depth charts, and snap count data.
- **Axios**: HTTP client.
- **Zod**: Runtime type validation.
- **Recharts**: Charting and data visualization.
- **connect-pg-simple**: PostgreSQL-based session storage.
- **@neondatabase/serverless**: PostgreSQL connections in serverless environments.
- **Google Gemini API**: AI embeddings and chat generation.
- **FIRE (Fantasy In-season Rolling Evaluator)**: Rolling 4-week opportunity and role scoring.

### Management Rookie Alpha promoted-artifact fallback (June 2026)
- Management roster snapshots reuse the read-only TIBER-Rookies promoted adapter for `exports/promoted/rookie-alpha/{season}_rookie_alpha_predraft_v0.json` when a roster player remains outside FORGE coverage.
- Additive `rookieAsset` context can expose Rookie Alpha rank/score, position rank, talent score, consensus delta, and a transaction-safe interpretation string when present upstream.
- Team Direction counts matched Rookie Alpha assets as Management evidence coverage only. A separate FORGE scoring-coverage gate must pass before roster strength can be classified; Rookie Alpha is never blended into FORGE roster strength, lineup totals, scoring, or rankings.
- Configure the promoted directory with `ROOKIE_ALPHA_PROMOTED_DIR`; do not depend on TIBER-Rookies runtime routes or `/cards/rookies/*`.

### Management FORGE G6 request-time freshness gate (August 2026)
- Team Direction evaluates `team_direction_forge_player_static_freshness_v1` on every request from the `FORGE_PLAYER_STATIC_V1` root `generated_at` clock.
- Evidence is eligible through exactly 45 elapsed UTC days. Warning, stale, unknown, missing, malformed, future, or unavailable states fail closed; `promoted_at` is retained only for diagnostics and cannot refresh eligibility.
- One versioned receipt drives the classifier and backend diagnostics and is exposed to Management UI and snapshot export. Rejected raw observations remain inspectable but cannot affect FORGE coverage, direction, or confidence.
- This boundary does not alter artifact bytes, scoring/direction thresholds, databases, auth, or deployment.

### TIBER Team web entry (2026-09-10)
`/team` reuses the Draft Review page and compiler; `/draft-review` and both existing query parameter names remain compatible. The public shell opens Team; Management and full-profile root routes are unchanged. Team adds roster refresh/switching, visible starter/bench/reserve/taxi groups and configured reserve rules, and separate locator-link versus snapshot-agent copying. The neutral comparison shows position-relevant 2025 weekly means, with totals/source details and optional roster geometry collapsed. Discuss this comparison copies the selected evidence; preferences and hypotheses belong in the agent conversation. No database, login, API contract, runtime profile, provider configuration or Forecast activation changes. See the Draft Review module record for behavior and validation.

### Draft Review historical evidence study (2026-09-07)
The public Draft Review optionally includes a pinned 2025 descriptive evidence bundle and a two-player comparison. Source admission, identity confidence, null clocks, attribution and missing-value semantics travel with the packet. Manager preferences remain local and export separately from evidence. Hypothetical one/two-for-one roster geometry is read-only and does not establish ownership or recommend/execute transactions. No current projections or regression probabilities are inferred. See `server/modules/draftReview/MODULE.md` for the accepted upstream exception, exact producer commit, offline replay and runtime failure behavior. No new database access or environment variables.

### Team three-player comparison (#372)
The public Team study supports an optional third player, a bounded one-to-three-ID evidence request, and one agent packet with all selected players. Mobile table scrolling retains sticky metric labels; data admission and bundle contents are unchanged.

### 2026-09-11 — Codex: Three historical Team consumer identities (#372)
- Pinned reviewed Data #268 commit 488220fa05c834aad3a4e2bea839a1843131053a and separate Team admission receipt. Added exactly Parker Washington, Drake London and Chris Rodriguez; all old 72 profiles unchanged, all three name_exact/medium with 16/12/12 recorded weeks.
- Offline builder validates scope, exact identity delta and source/proposal/baseline pins with explicit fail-closed exceptions. Old preparation authority and later consumer authorization (#372 comment 5627769635) remain separate provenance; production authority is not inferred.
- Regenerated 106062-byte artifact and runtime content pin. Validation: 11 Python tests normal/optimized, deterministic replay,54 Jest tests/seven suites; unchanged 72 profiles invariant checked. Build/review/isolated preview receipts follow on PR. No Data edits, #269 changes, merge or production release.

### Team historical evidence expansion — 2026-09-13, local preparation
Nineteen reviewed Data identities extend Team's pinned 2025 bundle from 75 to 94
profiles, retaining every old profile, historical source teams and identity
confidence. The new additive admission provenance distinguishes conversation
acceptance, proposal review and pending implementation review. Antonio Williams
remains outside the 2025 cohort. Full details and validation are in the Draft
Review module and docs/reviews/team-historical-admission-2026-09-13.md.
Publication, merge and production release have not occurred.


### Team preparation-only historical evidence gate — 2026-09-13
The nineteen-player expansion remains an offline preparation bundle. Runtime decoding and caching return those identities as unavailable until a separately reviewed promotion/consumer admission change; prior 75 profiles are unchanged. No environment switch or PR merge activates the cohort. See the Draft Review module P2 repair note.


### Nineteen-player historical promotion (proposed revision, 2026-09-13)
Team's historical evidence consumer pins a separate Data #272 promotion receipt and admits exactly the nineteen previously prepared identities. The earlier preparation receipt remains unchanged and separately attributed. Original historical profiles and source limitations are preserved; Antonio Williams is excluded. Integrity failure returns unavailable, and there are no forecasts or inferred current teams/health/ownership. Merge and any deployment require separate authorization; this proposed consumer revision has not been deployed. See server/modules/draftReview/MODULE.md and docs/reviews/team-historical-promotion-2026-09-13.md.

### Weekly evidence preparation (2026-09-14)
The read-only `/api/draft-review/weekly` preparation endpoint remains unavailable. Its offline candidate adapter and exploratory scoring/bucket policy are documented in `server/modules/externalModels/weeklyBoxscore/MODULE.md`. No weekly data admission, scheduler or UI activation is included; historical Team evidence remains unchanged.

### Team waiver context (2026-09-16)
Team roster handoffs include observed Sleeper waiver settings and labeled budget derivation. A read-only candidate check reuses complete league membership and the cached NFL directory; managers may attach up to five QB/RB/WR/TE candidates to Copy agent context. Unknown claim eligibility/timing and separate observation clocks remain explicit. See server/modules/draftReview/MODULE.md.

### Team waiver comparison (2026-09-19, draft #404 implementation)
Checked waiver shortlist candidates can be compared as a pair using admitted historical evidence and shared comparison tables. A dedicated discussion action copies only that pair plus roster context and observation clocks; missing history and unavailable Forecast remain explicit. See `docs/audits/team-waiver-comparison-2026-09-19.md`. Deployment and phone acceptance are pending.


### Team MCP contract checkpoint (2026-09-21, #383)
Three read-only tool contracts and isolated synthetic tests exist under `server/modules/draftReview/mcp/`. No executable connector or production source wiring is added. See `docs/mcp/team-contracts-checkpoint-2026-09-21.md` for validation and the stdio follow-up.


### Team MCP local stdio checkpoint (2026-09-21, #383)
The guarded `server/mcp/teamStdioServer.ts` executable exposes three read-only tools with source access disabled. SDK and synthetic child-process protocol tests pass. Live reader wiring and actual host acceptance remain pending. See `docs/mcp/team-read-only-v0.md`.
