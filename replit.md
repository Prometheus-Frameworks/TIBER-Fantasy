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
- **FORGE (Football-Oriented Recursive Grading Engine)**: A core player evaluation system providing unified Alpha scores (0-100) for skill positions. It features a modular design with endpoints for batch and individual player evaluation, supports `redraft`, `dynasty`, `bestball` modes, and uses pillar-based scoring (volume, efficiency, team context, stability). It includes position-specific percentile calibration, Tiber Tiers, multi-week aggregation, and tools like FORGE Workbench, Next Man Up, and FORGE SoS. It also incorporates a team-to-QB mapping system for QB-aware context.
- **Tiber Tiers Page (`/tiers`)**: User-facing rankings driven by FORGE with filters and adjustable weights.
- **Tiber Data Lab**: Research department managing Snapshots, Personnel Groupings, and Role Banks.
- **xFPTS v2**: Context-aware expected fantasy points system.
- **Position-Aware Enrichment**: Full position-specific data enrichment.
- **EPA Analytics**: Advanced efficiency metrics.
- **Defense vs Position (DvP) Matchup System**: Calculates fantasy points allowed by defenses.
- **Data Integration & Sync**: Includes Sleeper Sync, Canonical Player Pool, and NFL Schedule Sync.
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