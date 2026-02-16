# Tiber Fantasy

## Overview
Tiber Fantasy is a free, open-source NFL fantasy football analytics dashboard. Its purpose is to provide real-time NFL data, Madden-style OVR player ratings, Defense vs Position matchups, and Strength of Schedule analytics using EPA metrics, empowering users with superior decision-making tools without paywalls. Future ambitions include a "Player Compass" for dynamic player evaluation, a "TIBER Consensus" for community-driven rankings, and advanced AI insights via the TIBER Brain OS. The project's vision is to offer sophisticated tools that are typically paywalled, making them accessible to all fantasy football enthusiasts.

## User Preferences
Preferred communication style: Simple, everyday language.
League focus: Dynasty leagues (skill positions only - QB, RB, WR, TE). No kickers or defense.
Mission commitment: Strictly avoid all paywall partnerships or data sources. Maintain complete independence and free access to all platform features.
Community Discussion Philosophy: Transform statistical insights into meaningful conversations that help real people make better fantasy decisions.
Player Evaluation System: "Player Compass" - Dynamic, context-aware player profiles with tiers, scenario scores, and decision-making guidance instead of rigid rankings. Emphasizes flexibility and serves multiple team strategies.
Intelligence Feed System:
- Simple API endpoints ready for real-time updates when season starts
- Preseason observations archived but not weighted in analysis
- Intel sourced from trusted X/Twitter accounts, not personal observations
- `/api/intel` endpoint serves scouting reports with filtering by player, position, and signal strength
- Ready to receive meaningful intel updates during regular season

## System Architecture
The platform utilizes a 3-tier ELT architecture (Bronze → Silver → Gold layers) with a clear separation of concerns.

**Core Infrastructure:**
- **Backend**: Node.js/TypeScript (Express.js) and Python (Flask).
- **Frontend**: React 18, TypeScript, Tailwind CSS, TanStack Query, shadcn/ui.
- **Database**: PostgreSQL with Drizzle ORM and `pgvector` extension for advanced data capabilities.
- **Player Identity**: Unified resolution across major fantasy platforms using a dedicated `gsis_id` (NFL's primary player identifier) and an `Identity Bridge`. Player identity is focused on `activeSkillPlayers` (QB, RB, WR, TE) and distinguishes between `Roster Bridge` for ownership features and `Global Identity` for informational purposes.
- **Data Quality**: Implements multi-dimensional validation, data lineage tracking, and confidence scoring.

**UI/UX Decisions (v2 Light Mode Redesign):**
- **Color Scheme**: Light mode with white, `#fafafa`, and `#f4f4f4` backgrounds, accented by Ember (`#e2640d`).
- **Typography**: Three-font system: Instrument Sans (UI), JetBrains Mono (data/code), Newsreader (editorial).
- **Layout**: Fixed 220px sidebar for navigation, featuring Core, Intelligence, and System sections.
- **Homepage (`Dashboard.tsx`)**: Features a hero section, sticky position-filter toolbar, status cards, a FORGE-powered player data table with tier badges and trend bars, insights, and a chat preview.
- **Universal Current Week System**: An API endpoint (`/api/system/current-week`) provides real-time NFL week detection for frontend components.

**Technical Implementations & Feature Specifications:**
- **Unified Player Hub (UPH)**: Centralizes player data, "Player Compass" profiles, "TIBER Consensus" rankings, and Madden-style OVR.
- **AI & Analytics**: Incorporates a "Competence Mode" AI, Adaptive Consensus Engine, DeepSeek + Compass Fusion System, RAG Chat System using Google Gemini AI, Tiber Memory (FANTASY vs GENERAL pools), and Tiber Voice with a 5-tier Truth Hierarchy.
- **FORGE (Football-Oriented Recursive Grading Engine)**: The core player evaluation system providing unified Alpha scores (0-100) for skill positions. It consists of:
    - **F (Football Lens)**: Detects football-sense issues and applies adjustments.
    - **O (Orientation Modes)**: Supports `redraft`, `dynasty`, `bestball` modes with weighted adjustments.
    - **R (Recursion)**: Two-pass scoring with prior alpha blending and momentum adjustments.
    - **G (Grading)**: Position-specific weighting and tier mapping (T1-T5).
    - **E (Engine)**: Fetches context, builds metrics, and computes four pillar scores (volume, efficiency, team context, stability).
    - **FORGE E+G Architecture (v2)**: Modular system separating Engine (data/metrics) from Grading (scoring/tiers), exposed via `/api/forge/eg/batch` and `/api/forge/eg/player` endpoints.
    - **FORGE Workbench (`/forge-workbench`)**: An interactive tool for exploring FORGE internals with player search, adjustable weights, mode toggles, and detailed pillar breakdowns.
    - **FORGE Data Pipeline**: Ingests data from various sources (Role Banks, Datadive, Legacy Tables) to calculate Alpha scores, sub-scores, trajectory, and confidence.
    - **Tiber Tiers (v1.1)**: Position-specific tier thresholds recalibrated for cumulative season data.
    - **FORGE v1.1 Multi-Week Aggregation**: Aggregates data across all official snapshots for season-grounded Alpha scores.
    - **Next Man Up**: Tracks opportunity shifts for players.
    - **FORGE SoS**: Position-specific strength of schedule analysis.
    - **QB Context v1**: A team-to-QB mapping system providing QB-aware context for skill positions, blending short-term and dynasty context with QB scores.
- **Tiber Tiers Page (`/tiers`)**: User-facing rankings powered by FORGE, featuring position filters, adjustable weight sliders, preset systems, season/weekly toggles, and week range filtering. It integrates FORGE E+G v2, mode toggles, and Football Lens Issue Badges.
- **Tiber Data Lab (Department)**: A research department (`server/modules/datalab/`) containing three sub-modules:
    - **Snapshots** (`/tiber-data-lab/snapshots`): Snapshot-based NFL data spine for reproducible analytics, focusing on raw football metrics. Backend at `server/modules/datalab/snapshots/snapshotRoutes.ts`.
    - **Personnel Groupings** (`/tiber-data-lab/personnel`): Formation intelligence with every-down grades and personnel breakdown percentages. Backend at `server/modules/datalab/personnel/personnelService.ts`.
    - **Role Banks** (`/tiber-data-lab/role-banks`): Season-level positional archetype classifications. Backend routes at `server/modules/datalab/rolebank/roleBankRoutes.ts`.
    - **Hub Page** (`/tiber-data-lab`): Department landing page (`DataLabHub.tsx`) with module cards, health stats, and navigation to sub-modules.
- **xFPTS v2 (Expected Fantasy Points v2)**: Context-aware expected fantasy points system.
- **Position-Aware Enrichment**: Full position-specific enrichment layer with 2025 NFL metrics.
- **EPA Analytics**: Advanced efficiency metrics.
- **Defense vs Position (DvP) Matchup System**: Calculates fantasy points allowed by defenses.
- **Data Integration & Sync**: Includes Sleeper Sync, Canonical Player Pool, Roster Shift Listener, Roster Sync, and NFL Schedule Sync.
- **Live Data Processing**: Live Data Integration Pipeline with multi-source data capture and a Hot List Player Extraction System.
- **Strategy Tab**: Provides Start/Sit recommendations, Waiver Wire Targets, and SOS Rankings.
- **Weekly Takes System**: Quick matchup insights.
- **Role Banks**: Season-level analytical classification systems for WR, RB, TE, QB.
- **DST Streamer**: Weekly defense/special teams streaming recommendations with transparent calculation.
- **Admin API Lexicon**: Developer tool for testing Forge/Tiber API endpoints.
- **TIBER Philosophy**: The tactical interface translating FORGE insights into actionable intelligence.

**LLM Gateway (`server/llm/`)**:
- Provider-agnostic `callLLM()` entry point with automatic fallback across OpenRouter, OpenAI, Anthropic, and Google Gemini.
- **Task-Based Routing**: Supports 9 task types (e.g., `router_intent`, `code_patch`, `player_analysis`, `x_intelligence`) with priority tiers.
- **X Intelligence Scanner (`server/services/xIntelligenceScanner.ts`)**: Grok-powered X/Twitter scanning for fantasy football trends, injuries, breakouts, and consensus analysis, utilizing `x_intelligence` task type routed to Grok models via OpenRouter. Endpoints exist for triggering scans, reading filtered intel, and clearing intel.
- **Fallback Chain**: Prioritizes models, skips unavailable providers, and retries on errors.
- **Structured Logging**: Provides detailed JSON logs.

## Multi-Agent Coordination

This project uses multiple AI agents (Replit Agent, Claude Code, Codex). All shared context lives in `.claude/`:

- **`.claude/AGENTS.md`** — Read this first. Master onboarding doc with workflow, file references, and post-task checklist.
- **`.claude/conventions.md`** — Coding patterns, naming rules, guardrails. Extracted from this file for quick reference.
- **`.claude/context-log.md`** — Running changelog (most recent at top). Every agent appends here after completing work.
- **`.claude/agents/`** — Per-agent work logs (`replit-agent.md`, `claude-code.md`, `codex.md`) tracking each platform's contributions.
- **`.claude/tasks/`** — Detailed task specifications with problem, solution, validation criteria, and resolution sections.

**Agent workflow:** Read `AGENTS.md` → check `context-log.md` → check your agent log → run `git log --oneline -15` → do the work → append to `context-log.md` + your agent log → update `replit.md` if architecture changed.

## External Dependencies
- **MySportsFeeds API**: For injury reports and NFL roster automation.
- **Sleeper API**: Provides player projections, game logs, ADP data, and league/roster sync.
- **NFLfastR (nflverse)**: Used for play-by-play data and NFL schedule data.
- **NFL-Data-Py**: Fetches weekly statistics, depth charts, and snap count data.
- **Axios**: HTTP client for making API requests.
- **Zod**: For runtime type validation.
- **Recharts**: Utilized for charting and data visualization components.
- **connect-pg-simple**: Enables PostgreSQL-based session storage.
- **@neondatabase/serverless**: For PostgreSQL connections in serverless environments.
- **Google Gemini API**: Integrated for AI embeddings and chat generation capabilities.