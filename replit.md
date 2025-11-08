# Tiber Fantasy

## Overview
Tiber Fantasy is a free, open-source NFL fantasy football analytics dashboard launched in October 2025. It provides a 6-tab platform with real-time 2025 NFL data, Madden-style OVR player ratings, Defense vs Position matchups, and Strength of Schedule analytics using EPA metrics. The project aims to offer high-end fantasy football insights without paywalls or partnerships, fostering meaningful conversations and better decision-making for fantasy players.

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

## Design Standards (Official)
**Color Scheme** - TIBER FANTASY brand palette (October 2025):
- Background: `bg-[#0a0e1a]` (dark navy)
- Cards/Containers: `bg-[#141824]` (slate)
- Borders: `border-gray-800`
- Selected/Active States: Blue-purple gradients `from-blue-500/20 to-purple-500/20` with `border-blue-500/50`
- Accent Elements: `bg-blue-500/10 text-blue-400 border-blue-500/30`
- Typography: White/light text with explicit color declarations

**Data Quality Standards**:
- Completion %: Minimum 50 attempts (filters backup QBs)
- Yards Per Reception: Minimum 10 receptions
- Apply thresholds to both primary and fallback queries

**Layout Patterns**:
- Clean position/stat filters with visual active states
- Grid layouts for player cards (auto-responsive)
- Consistent spacing and card designs across all pages
- Footer attribution: Season/week info with data source credit

## System Architecture
The platform utilizes a 3-tier ELT architecture (Bronze → Silver → Gold layers) for enterprise-grade data processing and analytics.

**Core Infrastructure:**
- **Backend**: Node.js/TypeScript (Express.js) and Python (Flask) with an ELT pipeline.
- **Frontend**: React 18, TypeScript, Tailwind CSS, TanStack Query, shadcn/ui.
- **Database**: PostgreSQL with Drizzle ORM.
- **Player Identity**: Unified resolution for 11,400+ players across major fantasy platforms.
- **Quality System**: Multi-dimensional validation, data lineage tracking, and confidence scoring.

**Core Features & Design Patterns:**
- **Unified Player Hub (UPH)**: Centralized data architecture.
- **Player Evaluation & Consensus**: "Player Compass" for dynamic profiles and "OTC Consensus" for community-driven rankings.
- **OVR (Overall Rating) System**: Madden-style 1-99 player rating system based on weighted blending of multiple inputs.
- **AI & Analytics**: "Competence Mode" for AI advice, Adaptive Consensus Engine, and DeepSeek + Compass Fusion System for predictive analysis.
- **Rankings & VORP**: Comprehensive Rankings Hub, enhanced VORP with dynasty mode and age penalties, and an Enhanced ECR Comparison System.
- **Rookie & Player Analysis**: Dedicated Rookie Evaluation System, Target Competition Analysis (TCIP), Player Usage Context Module, and Stud Detection Module.
- **EPA Analytics**: Advanced efficiency metrics from nfl-data-py play-by-play data, including EPA per play/target, Air EPA vs YAC EPA, success rates, and team offensive/defensive EPA context rankings.
- **SOS Team Analytics**: Comprehensive strength of schedule system with position-specific matchup intelligence.
- **Defense vs Position (DvP) Matchup System**: Calculates fantasy points allowed by defenses against specific positions using NFLfastR data, featuring a 5-tier rating system.
- **Data Integration & Sync**: Sleeper Sync with cache fallback, Canonical Player Pool System, Roster Shift Listener, and Roster Sync System.
- **Live Data & Processing**: Live Data Integration Pipeline with multi-source data capture and a Hot List Player Extraction System.
- **Backend Services**: Backend Spine with Logs & Projections Service and a multi-format Ratings Engine.
- **UI/UX Enhancements**: Interactive GlowCard components, pulsing GlowCTA buttons, skeleton loading, and a top loading bar.
- **TIBER (Tactical Index for Breakout Efficiency and Regression)**: Version 1.5 implemented, using First Downs per Route Run as a primary metric with **real NFLfastR snap count data** integration (October 2025). Replaces placeholder snap percentages with accurate play participation data from `bronze_nflfastr_snap_counts` table. Uses team-constrained lastname matching to prevent surname collisions and includes 4-week trend analysis (rising/stable/falling).
- **Player Search**: Feature for searching player game logs and statistics.
- **EPA Sanity Check System**: Internal validation system for QB context metrics, comparing against Ben Baldwin's adjusted EPA methodology.
- **EPA Rankings Tab**: Production-ready public rankings page showing QBs ordered by adjusted EPA with 5-tier classification system (Elite/Good/Average/Below Average/Poor), podium icons for top 3, and comprehensive performance metrics.
- **QB Stats Review Tab**: Comprehensive QB validation page displaying all available NFLfastR stats, Baldwin reference data, context metrics (drops, pressures, YAC, defense faced), and Tiber adjustments. Enables manual eye-testing of rankings with complete statistical breakdown per QB, sorted by Baldwin's adjusted EPA (descending).
- **Enhanced Player Card Component**: Features TIBER trend charts, last 3 weeks summary, and ROS Matchup Calendar.
- **Strategy Tab Overhaul**: Redesigned for Start/Sit recommendations with context-aware analysis, Waiver Wire Targets based on TIBER, and SOS Rankings.
- **Weekly Takes System**: Quick, punchy matchup insights tab featuring position-specific one-liners (QB/RB/WR/TE) with concrete statistics. Format: **Player Name** - key insight with stat. Currently using sample data, ready for live integration with DvP matchups, EPA context, and usage trends. Avoids DFS terminology, focuses on actionable fantasy insights.
- **Interactive TIBER Breakdown**: Click any player in the Rankings tab to open a detailed drawer showing complete TIBER score breakdown (first down efficiency, EPA impact, usage, TD upside, team context) with comprehensive metrics and game stats. Features consistent API response structure across cached and calculated scores via transformCachedScore() helper function, ensuring reliable data presentation regardless of cache state.
- **Weekly/Season Toggle**: TIBER player drawer includes toggle to view either single-week performance (Weekly mode) or season-to-date cumulative stats (Season mode). Weekly mode uses eq() for precise single-week data; Season mode uses lte() for cumulative totals. Cache strategy: Season mode writes to cache for performance; Weekly mode always calculates fresh to ensure accuracy.

## External Dependencies
- **MySportsFeeds API**: Injury reports and NFL roster automation.
- **Sleeper API**: Player projections, game logs, ADP data, league sync, and current roster data.
- **NFLfastR (nflverse)**: 2025 play-by-play data via parquet files from GitHub releases.
- **NFL-Data-Py**: 2024 weekly statistics via nflfastR, depth charts via nflverse APIs, **2025 snap count data** for TIBER scoring (player participation percentages by week, position, and team).
- **R Server**: External API for OASIS (Offensive Architecture Scoring & Insight System) data.
- **Axios**: HTTP requests.
- **Zod**: Runtime type validation.
- **Recharts**: Charting and data visualization.
- **connect-pg-simple**: PostgreSQL-based session storage.
- **@neondatabase/serverless**: PostgreSQL connection for serverless environments.

## Recent Technical Changes (November 2025)
- **Database Infrastructure Consolidation** (November 8, 2025):
  - Canonical database module: `server/infra/db.ts` (standard PostgreSQL with SSL)
  - Migrated 65+ files from legacy `server/db.ts` (Neon-specific) to canonical module
  - Deleted legacy `server/db.ts` - all imports now use `server/infra/db.ts`
  - Resolved fetchConnectionCache deprecation warning in pg configuration
  - Production deployment on Render with standard PostgreSQL (not Neon serverless)
- **ESM Build Migration**: Converted to full ESM compatibility for production builds on Render
  - `scripts/schedule_updates.js`: Converted from CommonJS require() to ESM imports (node-cron, child_process, fs)
  - `server/routes.ts`: Converted require() to dynamic ESM imports for fs/path modules in /api/intel endpoint
  - Cache operations in `sleeperRosterSync.ts` intentionally use synchronous require() for performance
- **WR Ratings Module**: Standardized CSV naming and path resolution
  - Renamed: `WR_2024_Ratings_With_Tags.csv` → `wr_ratings.csv`
  - Updated path resolution: Changed from `__dirname` to `process.cwd()` for ESM bundle compatibility
  - All references updated in services, routes, and Python scripts
  - Module successfully loading 50 WR players with FPG, VORP, and archetype tags