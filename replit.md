# Tiber Fantasy

## Overview
Tiber Fantasy is a free, open-source NFL fantasy football analytics dashboard providing real-time NFL data, Madden-style OVR player ratings, Defense vs Position matchups, and Strength of Schedule analytics using EPA metrics. The project's core purpose is to offer high-end fantasy football insights without paywalls, fostering meaningful conversations and better decision-making for fantasy players. It aims to develop a "Player Compass" for dynamic player evaluation, an "OTC Consensus" for community-driven rankings, and advanced AI insights via the TIBER Brain OS.

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
The platform employs a 3-tier ELT architecture (Bronze → Silver → Gold layers) for robust data processing.

**Core Infrastructure:**
- **Backend**: Node.js/TypeScript (Express.js) and Python (Flask).
- **Frontend**: React 18, TypeScript, Tailwind CSS, TanStack Query, shadcn/ui.
- **Database**: PostgreSQL with Drizzle ORM and `pgvector` extension.
- **Player Identity**: Unified resolution for 11,400+ players across major fantasy platforms.
- **Data Quality**: Multi-dimensional validation, data lineage, and confidence scoring.

**UI/UX Decisions**:
- Dark navy background (`bg-[#0a0e1a]`), slate cards (`bg-[#141824]`), blue-purple gradient accents, and white/light typography.
- Features interactive GlowCard components, pulsing GlowCTA buttons, skeleton loading, and a top loading bar.

**Technical Implementations & Feature Specifications:**
- **Unified Player Hub (UPH)**: Centralized data for player information, "Player Compass" profiles, "OTC Consensus" rankings, and Madden-style OVR.
- **AI & Analytics**: "Competence Mode" AI, Adaptive Consensus Engine, DeepSeek + Compass Fusion System for predictive analysis.
- **Rankings & VORP**: Comprehensive Rankings Hub, enhanced VORP with dynasty and age adjustments, and an Enhanced ECR Comparison System.
- **Player Analysis**: Rookie Evaluation System, Target Competition Analysis (TCIP), Player Usage Context Module, and Stud Detection Module.
- **EPA Analytics**: Advanced efficiency metrics from nfl-data-py play-by-play data, including EPA per play/target, Air EPA vs YAC EPA, success rates, and team offensive/defensive EPA context rankings. Includes a 5-tier classification.
- **SOS Team Analytics**: Comprehensive strength of schedule system with position-specific matchup intelligence.
- **Defense vs Position (DvP) Matchup System**: Calculates fantasy points allowed by defenses against specific positions using NFLfastR data, featuring a 5-tier rating system.
- **Data Integration & Sync**: Sleeper Sync, Canonical Player Pool, Roster Shift Listener, and Roster Sync.
- **Live Data Processing**: Live Data Integration Pipeline with multi-source data capture and a Hot List Player Extraction System.
- **TIBER (Tactical Index for Breakout Efficiency and Regression)**: Version 1.5, using First Downs per Route Run and real NFLfastR snap count data for player participation, 4-week trend analysis, and detailed player drawer.
- **Player Search**: Functionality to search player game logs and statistics.
- **Enhanced Player Card Component**: Features TIBER trend charts, last 3 weeks summary, and ROS Matchup Calendar.
- **Strategy Tab**: Redesigned for Start/Sit recommendations, Waiver Wire Targets based on TIBER, and SOS Rankings.
- **Weekly Takes System**: Quick, punchy matchup insights with position-specific one-liners and concrete statistics.
- **League System**: Supports user-created fantasy leagues with context-aware AI interactions, integrating league settings, trades, and roster moves via vector-searchable context. Includes Sleeper league auto-sync.
- **RAG Chat System**: Integrates Google Gemini AI for embeddings and chat generation, providing teaching-focused responses with context-aware personality (natural for greetings, Scout-GM for fantasy). Features:
    - **Anti-Hallucination**: Strict rules requiring data-backed claims, acknowledging data gaps.
    - **League Context Integration**: Pre-fetches and prepends roster data.
    - **VORP Integration**: Detects player mentions, calculates real-time VORP from 2025 Sleeper game logs, and provides objective performance data.
    - **Top Performers Season Awareness**: Fetches and caches top 24 players at each position from 2025 Sleeper data.
    - **Citation System**: Enforces citing provided VORP data.
    - **Player Detection & Alias System**: Robust detection with support for ~80 common nicknames.
    - **Hallucination Prevention**: Dual-layer protection against citing unavailable metrics.
    - **Format Brain (Redraft vs Dynasty Detection)**: Dual-brain system detecting query format to adjust response depth and time horizon based on heuristic-based signal patterns.
    - **Temporal-Precision Enforcement**: Dual-layer system ensuring responses cite only the requested year, with auto-regeneration for violations and support for explicit multi-year comparisons.
    - **TIBER UX & Epistemic Fixes**: Prevents citing non-existent stats for players without NFL data, manages data availability by season, enforces tactical layer for stat queries, and structures trade evaluation responses.
    - **TIBER Brain OS v1 Integration**: Brain OS document embedded into RAG with priority metadata, integrated into system prompt with 10 Commandments summary, voice guidance, and anti-stat-dump guardrail (max 2 metrics per answer). Foundation for all advice (process > prizes, youth → peak → age, etc.).
    - **Weekly Statline RAG v1**: Eliminates hallucinations for "What did X do Week Y?" queries by serving real NFLfastR game log data, with robust detection, retrieval, and formatting for player statlines.

## External Dependencies
- **MySportsFeeds API**: Injury reports and NFL roster automation.
- **Sleeper API**: Player projections, game logs, ADP data, league sync, and current roster data.
- **NFLfastR (nflverse)**: 2025 play-by-play data.
- **NFL-Data-Py**: 2024 weekly statistics, depth charts, and 2025 snap count data.
- **R Server**: External API for OASIS (Offensive Architecture Scoring & Insight System) data.
- **Axios**: HTTP requests.
- **Zod**: Runtime type validation.
- **Recharts**: Charting and data visualization.
- **connect-pg-simple**: PostgreSQL-based session storage.
- **@neondatabase/serverless**: PostgreSQL connection for serverless environments.
- **Google Gemini API**: For AI embeddings and chat generation within the RAG system.