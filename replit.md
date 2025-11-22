# Tiber Fantasy

## Overview
Tiber Fantasy is a free, open-source NFL fantasy football analytics dashboard. It provides real-time NFL data, Madden-style OVR player ratings, Defense vs Position matchups, and Strength of Schedule analytics using EPA metrics. The project's core purpose is to offer high-end fantasy football insights without paywalls, empowering fantasy players with better decision-making tools. Future ambitions include a "Player Compass" for dynamic player evaluation, an "OTC Consensus" for community-driven rankings, and advanced AI insights via the TIBER Brain OS.

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
- **TIBER (Tactical Index for Breakout Efficiency and Regression)**: Version 1.5, uses First Downs per Route Run and real NFLfastR snap count data for player participation, 4-week trend analysis, and detailed player drawer.
- **Enhanced Player Card Component**: Features TIBER trend charts, last 3 weeks summary, and ROS Matchup Calendar.
- **Strategy Tab**: Redesigned for Start/Sit recommendations, Waiver Wire Targets based on TIBER, and SOS Rankings.
- **Weekly Takes System**: Quick, punchy matchup insights with position-specific one-liners and concrete statistics.
- **Waiver Wisdom Module**: Intelligent waiver wire recommendation system combining Sleeper ownership data (<50% threshold), recent usage patterns, trending signals, and archetype classification. Features a three-tier scoring system and dynamic FAAB suggestions.
- **WR Role Bank v1.0**: Season-level analytical classification system for WR role evaluation using a four-dimension scoring model (volume, consistency, high-value usage, momentum) and a five-tier classification system.
- **RB Role Bank v1.0**: Season-level analytical classification system for RB role evaluation using a four-dimension scoring model (volume, consistency, high-value usage, momentum) and a seven-tier classification system (ELITE_WORKHORSE, HIGH_END_RB1, MID_RB1, STRONG_RB2, ROTATIONAL_RB, LIMITED_USAGE, UNKNOWN). Features position-specific metrics including carries per game, opportunities (carries + targets), PPR per opportunity, and red zone touches. Includes three binary flags: pureRusherFlag (>90% carries), passingDownBackFlag (>50% routes vs carries), and breakoutWatchFlag (momentum ≥80, games <10). Uses `player_positions` view (sourced from player_identity_map.nfl_data_py_id) for accurate position filtering. **2024 Results**: 107 RB candidates processed. **2025 Results**: 95 RB candidates processed.
- **TE Role Bank v1.0**: Season-level analytical classification system for TE role evaluation using a four-dimension scoring model (volume, consistency, high-value usage, momentum) and a seven-tier classification system (ELITE_TE1, STRONG_TE1, MID_TE1, HIGH_TE2, STREAMER, BLOCKING_TE, UNKNOWN). Features position-specific metrics including targets per game, target share average, PPR per target, and red zone targets per game. Includes three binary flags: redZoneWeaponFlag (≥1.5 RZ targets/game), cardioTEFlag (≥35 routes/game), and breakoutWatchFlag (momentum ≥80, games <10). Uses `player_positions` view (sourced from player_identity_map.nfl_data_py_id) for accurate position filtering. **2024 Results**: 86 TE candidates processed (Kelce, McBride, Kittle, Andrews classified as STRONG_TE1). **2025 Results**: 79 TE candidates processed.
- **League System**: Supports user-created fantasy leagues with context-aware AI interactions, integrating league settings, trades, and roster moves via vector-searchable context, including Sleeper league auto-sync.
- **RAG Chat System**: Integrates Google Gemini AI for embeddings and chat generation, providing teaching-focused responses with context-aware personality. Features include anti-hallucination rules, league context integration, VORP integration, player detection, format brain (Redraft vs Dynasty), temporal-precision enforcement, TIBER Brain OS integration (10 Commandments summary, voice guidance), Weekly Statline RAG, Advanced Metrics Mixed Response System, and Deep Theory Modules (Pressure, Signal, Entropy, Psychology, Ecosystem).
- **TIBER WAIVER VORP PATCH v1.0**: Separates "Trade Brain" (uses VORP) from "Waiver Brain" (uses Interest Score) based on query mode detection, integrating Waiver Wisdom API for specific candidate recommendations.

## External Dependencies
- **MySportsFeeds API**: Injury reports and NFL roster automation.
- **Sleeper API**: Player projections, game logs, ADP data, league sync, and current roster data.
- **NFLfastR (nflverse)**: 2024-2025 play-by-play parquet files for comprehensive weekly usage backfills.
- **NFL-Data-Py**: 2024 weekly statistics, depth charts, and snap count data.
- **R Server**: External API for OASIS (Offensive Architecture Scoring & Insight System) data.
- **Axios**: HTTP requests.
- **Zod**: Runtime type validation.
- **Recharts**: Charting and data visualization.
- **connect-pg-simple**: PostgreSQL-based session storage.
- **@neondatabase/serverless**: PostgreSQL connection for serverless environments.
- **Google Gemini API**: For AI embeddings and chat generation within the RAG system.