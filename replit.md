# Tiber Fantasy

## Overview
Tiber Fantasy is a free, open-source NFL fantasy football analytics dashboard providing real-time NFL data, Madden-style OVR player ratings, Defense vs Position matchups, and Strength of Schedule analytics using EPA metrics. Its purpose is to offer high-end fantasy football insights without paywalls, empowering fantasy players with better decision-making tools. Future ambitions include a "Player Compass" for dynamic player evaluation, an "OTC Consensus" for community-driven rankings, and advanced AI insights via the TIBER Brain OS.

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
- **AI & Analytics**: "Competence Mode" AI, Adaptive Consensus Engine, DeepSeek + Compass Fusion System for predictive analysis.
- **Rankings & VORP**: Comprehensive Rankings Hub, enhanced VORP with dynasty and age adjustments, and an Enhanced ECR Comparison System.
- **Player Analysis**: Rookie Evaluation System, Target Competition Analysis (TCIP), Player Usage Context Module, and Stud Detection Module.
- **EPA Analytics**: Advanced efficiency metrics from nfl-data-py play-by-play data, including EPA per play/target, Air EPA vs YAC EPA, success rates, and team offensive/defensive EPA context rankings.
- **SOS Team Analytics**: Comprehensive strength of schedule system with position-specific matchup intelligence.
- **Defense vs Position (DvP) Matchup System**: Calculates fantasy points allowed by defenses against specific positions using NFLfastR data.
- **Data Integration & Sync**: Sleeper Sync, Canonical Player Pool, Roster Shift Listener, and Roster Sync.
- **Live Data Processing**: Live Data Integration Pipeline with multi-source data capture and a Hot List Player Extraction System.
- **TIBER (Tactical Index for Breakout Efficiency and Regression)**: Uses First Downs per Route Run and real NFLfastR snap count data for player participation, 4-week trend analysis, and detailed player drawer.
- **Enhanced Player Card Component**: Features TIBER trend charts, last 3 weeks summary, and ROS Matchup Calendar.
- **Strategy Tab**: Redesigned for Start/Sit recommendations, Waiver Wire Targets based on TIBER, and SOS Rankings.
- **Weekly Takes System**: Quick, punchy matchup insights with position-specific one-liners and concrete statistics.
- **Waiver Wisdom Module**: Intelligent waiver wire recommendation system combining Sleeper ownership data (<50% threshold), recent usage patterns, trending signals, and archetype classification.
- **WR Role Bank**: Season-level analytical classification system for WR role evaluation using a Fantasy Efficiency Blend and a four-dimension scoring model. Includes a five-tier classification system.
- **WR Admin Sandbox**: Experimental admin dashboard for testing new WR ranking formulas, featuring an Alpha Composite Score and 8 advanced analytical metrics with IR status integration. Default season: 2025.
- **WR Rankings Page**: User-facing rankings at `/rankings/wr` displaying Sandbox α vs FORGE α side-by-side with disagreement filter. Uses 2025 season data.
- **RB Role Bank**: Season-level analytical classification system for RB role evaluation using a four-dimension scoring model and a seven-tier classification system, with position-specific metrics and binary flags.
- **TE Role Bank**: Season-level analytical classification system for TE role evaluation using a four-dimension scoring model and a seven-tier classification system, with position-specific metrics and binary flags.
- **TE Admin Sandbox (Phase 2)**: Experimental admin dashboard for TE alpha scoring featuring a 4-pillar model with enhanced Snap Stickiness, real alignment data, TD Role Score, TE Archetypes, and volatility metrics.
- **QB Admin Sandbox v1.2**: Experimental admin dashboard for QB alpha scoring featuring a 4-pillar model: Volume (25%), Production (25%), Efficiency (35%), Context (15%). **v1.2 Lens System**: Two new lens-style presets with lens-aware Konami behavior: (1) **Fantasy Lens v1** (`qb_fantasy_lens_v1`) - Fantasy-first view with weights Vol=20/Prod=40/Eff=25/Ctx=15 and enhanced Konami boost (12%/6% for 6+/4+ rush FP/G), ideal for fantasy decisions where rushing QBs like Hurts, Allen, Daniels rise relative to pocket passers, (2) **Real Ball Lens v1** (`qb_realball_lens_v1`) - Real QB quality view with weights Vol=20/Prod=20/Eff=40/Ctx=20 and Konami boost DISABLED, ideal for evaluating true QB quality where efficiency+context QBs like Mahomes, Maye, Stafford dominate. **v1.1 Features**: Updated Production Pillar (45% FP/G + 30% Rush FP/G + 15% Pass TDs + 10% RZ TDs), Per-Player Context Index (varies 29-74 using sack rate, CPOE, pace, rush scheme), Tightened Dual Threat Archetype. **QB Archetypes**: Five classifications (DUAL_THREAT, DEEP_BALL, GAME_MANAGER, POCKET_PASSER, DEVELOPING). **2025 Results**: 34 QBs with 100+ attempts, 12 DUAL_THREAT. **REST API**: `/api/admin/qb-rankings-sandbox`.
- **QB Role Bank (Alpha Context Bank)**: Season-level analytical classification system for QB role evaluation using a four-pillar scoring model (Volume, Rushing, Efficiency, Momentum) and six alpha tier classifications.
- **League System**: Supports user-created fantasy leagues with context-aware AI interactions, integrating league settings, trades, and roster moves via Sleeper league auto-sync.
- **RAG Chat System**: Integrates Google Gemini AI for embeddings and chat generation, providing teaching-focused responses with context-aware personality, anti-hallucination rules, and various specialized modules.
- **TIBER WAIVER VORP PATCH**: Separates "Trade Brain" (VORP) from "Waiver Brain" (Interest Score) based on query mode detection, integrating Waiver Wisdom API.
- **FORGE v0.1 (Football-Oriented Recursive Grading Engine)**: Self-contained, read-only scoring module providing unified alpha scores (0-100) for WR/RB/TE/QB positions. Features position-specific weighted sub-scores (volume, efficiency, roleLeverage, stability, contextFit), trajectory tracking (rising/flat/declining), and confidence scoring (0-100). Integrates with PlayerIdentityService, Sleeper snap service, game logs, and environment services. API: `/api/forge/preview`, `/api/forge/score/:playerId`, `/api/forge/batch`, `/api/forge/health`. Module location: `server/modules/forge/`.
  - **Alpha Calibration (v0.1.1)**: WR alpha scores are calibrated via a linear monotonic mapping of raw engine scores to an intuitive 0-100 scale. Based on 2025 season week 10 distribution (raw range ~30-52), calibration maps: raw floor (30) → calibrated 25, raw ceiling (52) → calibrated 90. This spreads top WRs into the 70-90 band (matching Sandbox scale) while preserving ranking order. The underlying feature weights (volume, efficiency, role, stability, context) are unchanged. Response includes both `alpha` (calibrated) and `rawAlpha` (pre-calibration) for debugging. Config: `ALPHA_CALIBRATION` in `server/modules/forge/types.ts`.

## External Dependencies
- **MySportsFeeds API**: Injury reports and NFL roster automation.
- **Sleeper API**: Player projections, game logs, ADP data, league sync, and current roster data.
- **NFLfastR (nflverse)**: Play-by-play parquet files for weekly usage backfills.
- **NFL-Data-Py**: Weekly statistics, depth charts, and snap count data.
- **R Server**: External API for OASIS (Offensive Architecture Scoring & Insight System) data.
- **Axios**: HTTP requests.
- **Zod**: Runtime type validation.
- **Recharts**: Charting and data visualization.
- **connect-pg-simple**: PostgreSQL-based session storage.
- **@neondatabase/serverless**: PostgreSQL connection for serverless environments.
- **Google Gemini API**: For AI embeddings and chat generation.