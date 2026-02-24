# Tiber Fantasy

## Overview
Tiber Fantasy is a free, open-source NFL fantasy football analytics dashboard. Its core purpose is to democratize access to advanced fantasy football tools, providing real-time NFL data, Madden-style OVR player ratings, Defense vs Position matchups, and Strength of Schedule analytics using EPA metrics. The project aims to empower users with superior decision-making capabilities, removing the paywalls typically associated with such sophisticated insights. Future ambitions include a dynamic "Player Compass" for player evaluation, a "TIBER Consensus" for community-driven rankings, and AI-powered insights through the TIBER Brain OS.

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
- **Database**: PostgreSQL with Drizzle ORM and `pgvector` extension.
- **Player Identity**: Unified resolution across major fantasy platforms using `gsis_id` and an `Identity Bridge`, focusing on `activeSkillPlayers`.
- **Data Quality**: Multi-dimensional validation, data lineage tracking, and confidence scoring.

**UI/UX Decisions (v2 Light Mode Redesign):**
- **Color Scheme**: Light mode with white/grey backgrounds, accented by Ember (`#e2640d`).
- **Typography**: Three-font system: Instrument Sans (UI), JetBrains Mono (data/code), Newsreader (editorial).
- **Layout**: Fixed 220px sidebar for navigation.
- **Homepage (`Dashboard.tsx`)**: Features a hero section, position-filter toolbar, status cards, a FORGE-powered player data table, insights, and chat preview.
- **Universal Current Week System**: API endpoint (`/api/system/current-week`) for real-time NFL week detection.

**Technical Implementations & Feature Specifications:**
- **Unified Player Hub (UPH)**: Centralizes player data, "Player Compass" profiles, "TIBER Consensus" rankings, and Madden-style OVR.
- **AI & Analytics**: Incorporates "Competence Mode" AI, Adaptive Consensus Engine, DeepSeek + Compass Fusion System, RAG Chat System using Google Gemini AI, Tiber Memory (FANTASY vs GENERAL pools), and Tiber Voice with a 5-tier Truth Hierarchy.
- **FORGE (Football-Oriented Recursive Grading Engine)**: Core player evaluation system providing unified Alpha scores (0-100) for skill positions. It includes:
    - **Modular Design**: Separates Engine (data/metrics) from Grading (scoring/tiers) via `/api/forge/eg/batch` and `/api/forge/eg/player` endpoints.
    - **Evaluation Modes**: Supports `redraft`, `dynasty`, `bestball` with weighted adjustments.
    - **Pillar-Based Scoring**: Computes four pillar scores (volume, efficiency, team context, stability) with correlation-tuned weights. Efficiency now centers on derived `fpoe_per_game`.
    - **Calibration**: Position-specific percentile anchors mapping raw scores to 25-95 Alpha range.
    - **Tiber Tiers**: Position-specific tier thresholds.
    - **Multi-Week Aggregation**: Aggregates data across official snapshots for season-grounded Alpha scores.
    - **Tools**: FORGE Workbench for exploration, Next Man Up for opportunity shifts, and FORGE SoS for strength of schedule.
    - **QB Context**: Team-to-QB mapping system providing QB-aware context for skill positions.
- **Tiber Tiers Page (`/tiers`)**: User-facing rankings powered by FORGE, with filters, adjustable weights, and mode toggles.
- **Tiber Data Lab (Department)**: Research department containing:
    - **Snapshots**: Snapshot-based NFL data spine.
    - **Personnel Groupings**: Formation intelligence.
    - **Role Banks**: Season-level positional archetype classifications.
- **xFPTS v2 (Expected Fantasy Points v2)**: Context-aware expected fantasy points system.
- **Position-Aware Enrichment**: Full position-specific enrichment layer.
- **EPA Analytics**: Advanced efficiency metrics.
- **Defense vs Position (DvP) Matchup System**: Calculates fantasy points allowed by defenses.
- **Data Integration & Sync**: Includes Sleeper Sync, Canonical Player Pool, and NFL Schedule Sync.
- **LLM Gateway (`server/llm/`)**: Provider-agnostic `callLLM()` entry point with fallback across OpenRouter, OpenAI, Anthropic, and Google Gemini. Supports 9 task types with priority tiers, including an X Intelligence Scanner (`server/services/xIntelligenceScanner.ts`) for Grok-powered X/Twitter scanning.

## External Dependencies
- **MySportsFeeds API**: For injury reports and NFL roster automation.
- **Sleeper API**: Provides player projections, game logs, ADP data, and league/roster sync.
- **NFLfastR (nflverse)**: Used for play-by-play data and NFL schedule data.
- **NFL-Data-Py**: Fetches weekly statistics, depth charts, and snap count data.
- **Axios**: HTTP client.
- **Zod**: For runtime type validation.
- **Recharts**: For charting and data visualization.
- **connect-pg-simple**: For PostgreSQL-based session storage.
- **@neondatabase/serverless**: For PostgreSQL connections in serverless environments.
- **Google Gemini API**: Integrated for AI embeddings and chat generation capabilities.
- **FIRE (Fantasy In-season Rolling Evaluator)**: Rolling 4-week opportunity and role scoring for all skill positions (QB/RB/WR/TE). All positions use 3-pillar scoring. QB: Opportunity 60% (qb_xfp) + Role 25% (dropbacks/rush/inside-10) + Conversion 15% (pass yards/TD/INT/rush yards/TD over expectation). RB/WR/TE: Opportunity 60% + Role 25% + Conversion 15% (xfpgoe). Surfaced via `/api/fire/eg/batch` and `/api/fire/eg/player`.
- **Fantasy Lab (`/fantasy-lab`)**: Full analytics dashboard with FIRE table, Hybrid Delta view, and Watchlist. Features position-aware column system (QB-specific passing stats swap in when QB selected), column presets (Basic/Volume/Full), sortable headers, CSV export, and conditional formatting.

## Update Notes (Agent)
- **2026-02-24:** CATALYST Phase 0 plumbing — enriched `bronze_nflfastr_plays` with first-class `wp` and `score_differential` columns (plus backfill migration from `raw_data`) and updated nflfastR import scripts to populate both fields at ingest time for leverage/game-script modeling.
- **2026-02-24:** IDP FORGE Lab Phase 2 — 2025 data ingestion (8,572 weekly rows from PBP, 871 season-aggregated players), week-by-week FORGE replay system (`/api/forge/idp/replay`), weekly Alpha trend sparklines, Risers/Fallers movers panel, upgraded frontend with FORGE Alpha table, position group tabs, season selector (2024/2025), player detail modal with 4-pillar bars and weekly trend table. Replay computes cumulative through-week Alpha scores from week 1 to max week.
- **2026-02-23:** IDP FORGE Lab — Extended FORGE to grade all 5 defensive position groups (EDGE, DI, LB, CB, S) with 4-pillar architecture (Volume, Efficiency w/ Havoc Index anchor at 60%, Team Context, Stability). Position-specific pillar weights: EDGE/DI (25/40/15/20), LB (30/35/15/20), CB/S (25/40/20/15). Data source: nflverse player_stats_def.csv + snap counts. 2024 season ingested: 9,530 weekly rows, 967 season-aggregated players, 25 position baselines. API: `/api/forge/idp/batch?position_group=EDGE&season=2024` and `/api/forge/idp/player/:gsisId`. Calibration anchors are initial placeholders. Team context defaults to neutral (50) until play-by-play data ingested. FIRE and Delta remain skill-position-only.
- **2026-02-23:** Added QB Conversion pillar to FIRE — 3-pillar scoring now for all positions. QB Conversion uses production-over-expectation (pass yards/TD/INT/rush yards/TD vs expected). Weight split: Opp 60%, Role 25%, Conv 15%. Delta engine now supports QB with buy-low/sell-high signals. Conversion column visible for all positions in Fantasy Lab.
- **2026-02-23:** FORGE engine math hardening: division-by-zero guards, falsy-zero momentum_score fix, NaN guards in cvToScore, shared playerIdResolver to eliminate duplicate lookups, batch parallelization (concurrency=10).
- **2026-02-22:** Added QB support to Fantasy Lab FIRE. Backend: QB per-game stats (passAtt/G, comp%, passY/G, passTD/G, INT/G, rushAtt/G, rushY/G, rushTD/G). Frontend: QB position selector, position-aware columns. Fixed Snap% bug (now uses team_off_plays = MAX(snaps) per team/week). Cleaned column labels.
- **2026-02-22:** Built team-level weekly aggregation pipeline (`team_weekly_totals_mv`). Rush Share% and Target Share% now use proper team-total denominators.
- **2026-02-22:** Expanded Fantasy Lab FIRE table from 8 to 24 columns with column preset system (Basic/Volume/Full), sortable headers, color-coded column groups, conditional formatting, and CSV export.
- **2026-02-19:** Merged PR #22 (Phase 3): Delta trust layer with confidence gating, scatter visualization, watchlist, and `/api/delta/eg/player-trend` endpoint.
- **2026-02-18:** Added Fantasy Lab Phase 1 backend data foundation with consolidated materialized view `fantasy_metrics_weekly_mv`.