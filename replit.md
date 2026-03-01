# Tiber Fantasy

## Overview
Tiber Fantasy is an open API platform, branded as TiberClaw, providing an intelligence layer for fantasy football analysis. It offers advanced scoring engines (FORGE, FIRE, CATALYST) accessible via authenticated REST endpoints. The project is free, open-source, and aims to democratize access to sophisticated fantasy football tools without paywalls. Its mission is to transform statistical insights into meaningful discussions to help users make better fantasy decisions. The web application serves as one client among many, including AI agents and personal assistants, that can consume the platform's intelligence.

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
The platform employs a 3-tier ELT architecture (Bronze → Silver → Gold layers) with a focus on data quality, lineage, and confidence scoring.

**Core Infrastructure:**
- **Backend**: Node.js/TypeScript (Express.js) and Python (Flask).
- **Frontend**: React 18, TypeScript, Tailwind CSS, TanStack Query, shadcn/ui.
- **Database**: PostgreSQL with Drizzle ORM and `pgvector` extension.
- **Player Identity**: Uses `gsis_id` and an `Identity Bridge` for unified player resolution, focusing on `activeSkillPlayers`.

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
- **FIRE (Fantasy In-season Rolling Evaluator)**: Rolling 4-week opportunity and role scoring for all skill positions, surfaced via `/api/fire/eg/batch` and `/api/fire/eg/player`.
- **Fantasy Lab (`/fantasy-lab`)**: Full analytics dashboard integrating FIRE table, Hybrid Delta view, and Watchlist, with position-aware columns, presets, sorting, CSV export, and conditional formatting.