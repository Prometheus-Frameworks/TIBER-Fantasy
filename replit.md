# Tiber Fantasy

## Overview
Tiber Fantasy is a free, open-source NFL fantasy football analytics dashboard. Its purpose is to provide real-time NFL data, Madden-style OVR player ratings, Defense vs Position matchups, and Strength of Schedule analytics using EPA metrics, empowering users with superior decision-making tools without paywalls. Future ambitions include a "Player Compass" for dynamic player evaluation, an "OTC Consensus" for community-driven rankings, and advanced AI insights via the TIBER Brain OS.

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
The platform utilizes a 3-tier ELT architecture (Bronze → Silver → Gold layers).

**Core Infrastructure:**
- **Backend**: Node.js/TypeScript (Express.js) and Python (Flask).
- **Frontend**: React 18, TypeScript, Tailwind CSS, TanStack Query, shadcn/ui.
- **Database**: PostgreSQL with Drizzle ORM and `pgvector` extension.
- **Player Identity**: Unified resolution across major fantasy platforms.
- **Data Quality**: Multi-dimensional validation, data lineage, and confidence scoring.

**UI/UX Decisions**:
- Dark navy background (`bg-[#0a0e1a]`), slate cards (`bg-[#141824]`), blue-purple gradient accents, and white/light typography.
- Interactive GlowCard components, pulsing GlowCTA buttons, skeleton loading, and a top loading bar.

**Technical Implementations & Feature Specifications:**
- **Unified Player Hub (UPH)**: Centralizes player data, "Player Compass" profiles, "OTC Consensus" rankings, and Madden-style OVR.
- **AI & Analytics**: "Competence Mode" AI, Adaptive Consensus Engine, DeepSeek + Compass Fusion System, RAG Chat System using Google Gemini AI. Features Tiber Memory for persistent conversation and Dual Memory Pools (FANTASY vs GENERAL) for context separation. Tiber Voice offers Insight and Analyst chat modes with a 5-tier Truth Hierarchy and reasoning heuristics.
- **FORGE (Football-Oriented Recursive Grading Engine)**: A self-contained scoring module providing unified alpha scores (0-100) for skill positions, including trajectory tracking, confidence scoring, and modifiers for offensive environment and weekly matchup context. Integrates with Datadive snapshot tables.
- **FORGE SoS**: Position-specific strength of schedule analysis for rest of season, next 3 weeks, and playoffs.
- **Tiber Data Lab (Operation DataDive)**: Snapshot-based NFL data spine for reproducible analytics, offering advanced metrics like TPRR, YPRR, EPA/play, and snap share.
- **xFPTS v2 (Expected Fantasy Points v2)**: Context-aware expected fantasy points system with nflfastR-derived adjustments and context multipliers.
- **Position-Aware Enrichment**: Full position-specific enrichment layer with 2025 NFL metrics for QB, WR/TE, RB, and IDP, including CPOE, WOPR, RYOE, and fantasy points calculations.
- **EPA Analytics**: Advanced efficiency metrics from nfl-data-py play-by-play data, including EPA per play/target, Air EPA vs YAC EPA, success rates, and team offensive/defensive EPA context rankings.
- **SOS Team Analytics**: Comprehensive strength of schedule system with position-specific matchup intelligence.
- **Defense vs Position (DvP) Matchup System**: Calculates fantasy points allowed by defenses against specific positions.
- **Data Integration & Sync**: Sleeper Sync, Canonical Player Pool, Roster Shift Listener, Roster Sync, and NFL Schedule Sync Infrastructure.
- **Live Data Processing**: Live Data Integration Pipeline with multi-source data capture and a Hot List Player Extraction System.
- **Strategy Tab**: Provides Start/Sit recommendations, Waiver Wire Targets, and SOS Rankings.
- **Weekly Takes System**: Quick, punchy matchup insights with position-specific one-liners and concrete statistics.
- **Role Banks (WR, RB, TE, QB)**: Season-level analytical classification systems for position-specific role evaluation, using multi-dimensional scoring models and tier classifications.
- **Admin API Lexicon**: Developer tool for browsing and testing Forge/Tiber API endpoints.

## External Dependencies
- **MySportsFeeds API**: Injury reports and NFL roster automation.
- **Sleeper API**: Player projections, game logs, ADP data, league sync, and current roster data.
- **NFLfastR (nflverse)**: Play-by-play parquet files, and NFL schedule data.
- **NFL-Data-Py**: Weekly statistics, depth charts, and snap count data.
- **Axios**: HTTP requests.
- **Zod**: Runtime type validation.
- **Recharts**: Charting and data visualization.
- **connect-pg-simple**: PostgreSQL-based session storage.
- **@neondatabase/serverless**: PostgreSQL connection for serverless environments.
- **Google Gemini API**: For AI embeddings and chat generation.