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
- **Tiber Tiers Page (`/tiers`)**: User-facing rankings driven by FORGE with filters and adjustable weights.
- **Tiber Data Lab**: Research department managing Snapshots, Personnel Groupings, Role Banks, and the read-only WR Breakout Lab at `/tiber-data-lab/breakout-signals`. The WR Breakout Lab is powered by promoted Signal-Validation-Model exports surfaced through `server/modules/externalModels/signalValidation/` and `GET /api/data-lab/breakout-signals`; TIBER-Fantasy only renders exported signal cards / recipe summaries and does not recompute breakout scores.
- **xFPTS v2**: Context-aware expected fantasy points system.
- **Position-Aware Enrichment**: Full position-specific data enrichment.
- **EPA Analytics**: Advanced efficiency metrics.
- **Defense vs Position (DvP) Matchup System**: Calculates fantasy points allowed by defenses.
- **Data Integration & Sync**: Includes Sleeper Sync, Canonical Player Pool, and NFL Schedule Sync.
- **External Model Adapter Layer**: Promoted lab/model repos must enter through `server/modules/externalModels/` using dedicated clients, edge validation, typed error mapping, and stable TIBER-facing interfaces. First integrations: `Role-and-opportunity-model` via `GET /api/integrations/role-opportunity/:playerId?season=<year>&week=<week>` and Signal-Validation-Model exports via `server/modules/externalModels/signalValidation/` + `GET /api/data-lab/breakout-signals[?season=<year>]`. Player detail hydration at `GET /api/player-identity/player/:id` now supports opt-in external enrichments through a reusable `playerDetailEnrichment` orchestrator: `includeRoleOpportunity=true&season=<year>&week=<week>` for role usage preview, `includeExternalForge=true&season=<year>[&week=<week|season>][&externalForgeMode=redraft|dynasty|bestball]` for an additive external FORGE preview, and `includeForgeComparison=true&season=<year>[&week=<week|season>][&externalForgeMode=redraft|dynasty|bestball]` for a migration-only side-by-side legacy-vs-external FORGE comparison block. All preview paths keep stable non-fatal status envelopes while preserving legacy defaults and thin route logic.
- **FORGE externalization migration tooling**: External FORGE now enters through `server/modules/externalModels/forge/` with a dedicated client/adapter/service stack and a compare-only orchestration path. `POST /api/integrations/forge/compare` dual-runs legacy in-repo FORGE and external FORGE for the same single-player offensive E+G request, returning isolated per-side results plus stable diff metadata for migration analysis. `GET /api/integrations/forge/health` reports config/readiness only, `GET /api/integrations/forge/parity-report` exposes a stable migration-only parity summary contract, and `GET /api/integrations/forge/review` returns sampled multi-player comparison batches for operator migration review. Live `/api/forge/*` behavior remains unchanged in this phase.
- **FORGE parity harness/reporting**: External FORGE migration tooling now also includes a committed fixture pack plus a deterministic parity harness/report layer under `server/modules/externalModels/forge/`. The harness replays labeled comparison fixtures through the existing compare service, summarizes `close`/`drift`/`unavailable`/`not_comparable` outcomes, and can be run locally with `npm run forge:parity` for snapshot-style migration tracking. `npm run forge:parity:report` exports the higher-level parity report contract with readiness metadata plus the stable per-fixture `results` array for drift debugging and offline inspection.
- **Architecture Doctrine**: TIBER-Fantasy is the product shell and orchestration core. Standalone model brains should be consumed through adapters/orchestrators and should not become permanent in-repo residents unless explicitly justified. The current cleanup map lives at `docs/architecture/TIBER_FANTASY_MODULE_CLASSIFICATION_AUDIT.md`, and the current FORGE replacement target is defined in `docs/architecture/FORGE_EXTERNALIZATION_TRANSITION_SPEC.md`.
- **LLM Gateway (`server/llm/`)**: A provider-agnostic `callLLM()` entry point with fallback across OpenRouter, OpenAI, Anthropic, and Google Gemini, supporting 9 task types. Includes an X Intelligence Scanner (`server/services/xIntelligenceScanner.ts`) for Grok-powered X/Twitter analysis.

**Deployment Architecture:**
- **Target**: Autoscale (Cloud Run) for stateless REST API, with persistent state in PostgreSQL.
- **Build Process**: `sh build.sh` compiles frontend via `vite build` and bundles server via esbuild.
- **Runtime**: `node dist/index.mjs` for faster startup.
- **Bootstrap (`server/bootstrap.mjs`):** A small file to quickly bind a port and serve basic routes while the main Express app loads.

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
