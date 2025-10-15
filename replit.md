# Tiber Fantasy

## Overview
Tiber Fantasy is a free, open-source NFL fantasy football analytics dashboard launched in October 2025. It aims to democratize advanced analytics by providing a unified 6-tab platform (Home, Rankings, Matchups, Strategy, Moves, Leagues) with real-time 2025 NFL data, OVR player ratings (Madden-style 1-99), Defense vs Position matchups, and Strength of Schedule analytics with EPA metrics. The platform is committed to complete independence, offering high-end fantasy football insights without paywalls or partnerships.

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
The platform is built on a comprehensive 3-tier ELT architecture (Bronze → Silver → Gold layers) providing enterprise-grade data processing and analytics.

**Core Infrastructure:**
- **Backend**: Node.js/TypeScript (Express.js) and Python (Flask) with an ELT pipeline.
- **Frontend**: React 18, TypeScript, Tailwind CSS, TanStack Query, shadcn/ui.
- **Database**: PostgreSQL with Drizzle ORM.
- **Player Identity**: Unified resolution for 11,400+ players across major fantasy platforms.
- **Quality System**: Multi-dimensional validation, data lineage tracking, and confidence scoring.

**Core Features & Design Patterns:**
- **Unified Player Hub (UPH)**: Centralized data architecture.
- **Player Evaluation & Consensus**: "Player Compass" for dynamic profiles and "OTC Consensus" for community-driven rankings.
- **OVR (Overall Rating) System**: Madden-style 1-99 player rating system based on weighted blending of multiple inputs. API endpoints available at `/api/ovr/*`.
- **AI & Analytics**: "Competence Mode" for AI advice, Adaptive Consensus Engine, and DeepSeek + Compass Fusion System for predictive analysis.
- **Rankings & VORP**: Comprehensive Rankings Hub, enhanced VORP with dynasty mode and age penalties, and an Enhanced ECR Comparison System.
- **Rookie & Player Analysis**: Dedicated Rookie Evaluation System, Target Competition Analysis (TCIP), Player Usage Context Module, and Stud Detection Module.
- **EPA Analytics**: Advanced efficiency metrics from nfl-data-py play-by-play data, including EPA per play/target, Air EPA vs YAC EPA, success rates, and team offensive/defensive EPA context rankings.
- **SOS Team Analytics**: Comprehensive strength of schedule system with position-specific matchup intelligence. Includes EPA-based defense and offense rankings, week-specific matchup scores (0-100 scale), position-specific SOSv3, alignment-aware, and coverage-aware scoring. API endpoints at `/api/sos/*`.
- **Defense vs Position (DvP) Matchup System**: Calculates fantasy points allowed by defenses against specific positions using NFLfastR data. Features a 5-tier matchup rating system and API endpoints at `/api/dvp/*`.
- **Data Integration & Sync**: Sleeper Sync with cache fallback, Canonical Player Pool System, Roster Shift Listener, and Roster Sync System.
- **Live Data & Processing**: Live Data Integration Pipeline with multi-source data capture and a Hot List Player Extraction System.
- **Backend Services**: Backend Spine with Logs & Projections Service and a multi-format Ratings Engine.
- **UI/UX Enhancements**: Interactive GlowCard components, pulsing GlowCTA buttons, skeleton loading, and a top loading bar.

## Recent Changes

### TIBER v1.5 Upgrade (October 15, 2025)
**Feature:** Upgraded TIBER (Tactical Index for Breakout Efficiency and Regression) to v1.5 with First Downs per Route Run as the primary metric based on Ryan Heath research showing 0.750 correlation with future fantasy performance.

**Implementation:**
- New v1.5 formula weights: First Down (35%), EPA (25%), Usage (25%), TD (10%), Team (5%)
- Added first down columns (`first_down`, `first_down_pass`, `first_down_rush`) to NFLfastR schema
- Re-imported Week 1-6 data: 16,011 plays with 3,591 first downs (22.4% rate)
- Routes run approximation: `targets * 3.5` (industry standard for WR/TE)
- Updated `tiber_scores` table with `firstDownScore`, `firstDownRate`, `totalFirstDowns` columns

**Calculation Details:**
```typescript
// Routes run approximation (since NFLfastR only tracks targeted plays)
const routesRun = targets * 3.5; // WRs run ~3.5x more routes than targets
const firstDownRate = receivingFirstDowns / routesRun;

// Scoring thresholds:
// Elite: >17% first down rate = 35 points
// Very Good: 15% = 32 points
// Above Average: 12% = 25 points
// Average: 10% = 21 points
// Below Average: 8% = 14 points
// Poor: <6% = 7 points
```

**Test Results (Justin Jefferson Week 6):**
- TIBER Score: 73 (Stable)
- First Down Rate: 11.56% (17 first downs / 147 routes)
- Breakdown: First Down 21 + EPA 21 + Usage 20 + TD 7 + Team 4 = 73

**Files Updated:**
- `server/services/tiberService.ts`: v1.5 weights and first down calculation
- `server/routes/tiberRoutes.ts`: Cache insert with first down fields
- `client/src/components/TiberBadge.tsx`: v1.5 breakdown UI display
- `shared/schema.ts`: Added first down columns

**API Endpoints:**
- `/api/tiber/score/:nflfastrId?week=6` - Calculate/retrieve TIBER score
- Returns: `tiberScore`, `tier`, `breakdown` (with firstDownScore), `metrics` (with firstDownRate)

### NFLfastR Data Pipeline Fix (October 2025)
**Issue:** Player game logs showed incomplete/incorrect data due to database schema and import issues.
**Root Cause:** NFLfastR play_id is NOT globally unique (4,499 unique IDs across 16,011 plays) - it's per-game unique.
**Solution:**
- Changed `bronzeNflfastrPlays` table from `.unique()` on `playId` to composite unique constraint `(gameId, playId)`
- Created `fast_nflfastr_import.py` script using COPY with temp table for efficient bulk imports
- Successfully imported complete Week 1-6 data: 16,011 plays
- Fixed fantasy points calculation with Number() conversions for SQL aggregation values
- API endpoints working: `/api/player-identity/player/:id` and `/api/game-logs/:nflfastrId/latest`

**Next Steps:**
1. Schedule fast_nflfastr_import.py for nightly runs to auto-load Week 7+ data
2. Add regression test for known box scores
3. Document import workflow (source URL, season range, conflict policy)

### Player Search Feature (October 2025)
**Feature:** "What did [player] do this Sunday?" - Search any player and see their latest game stats.
**Components:**
- `PlayerSearchBar`: Fuzzy search with autocomplete (Fuse.js)
- `PlayerGameCard`: Displays passing, rushing, receiving stats and fantasy points
**Data Flow:**
1. Search → `/api/player-identity/search?name={query}` → canonical ID
2. Player detail → `/api/player-identity/player/:canonicalId` → NFLfastR ID
3. Game log → `/api/game-logs/:nflfastrId/latest` → Week X stats
**Verified:** E2E test passed with Ashton Jeanty Week 6 (23-75-1, 2/4-11 rec, 16.6 PPR)

## External Dependencies
- **MySportsFeeds API**: Injury reports and NFL roster automation.
- **Sleeper API**: Player projections, game logs, ADP data, league sync, and current roster data.
- **NFLfastR (nflverse)**: 2025 play-by-play data via parquet files from GitHub releases. Complete Week 1-6 data (16,011 plays) loaded. Source: `https://github.com/nflverse/nflverse-data/releases/download/pbp/play_by_play_2025.parquet`
- **NFL-Data-Py**: 2024 weekly statistics via nflfastR, depth charts via nflverse APIs.
- **R Server**: External API for OASIS (Offensive Architecture Scoring & Insight System) data.
- **Axios**: HTTP requests.
- **Zod**: Runtime type validation.
- **Recharts**: Charting and data visualization.
- **connect-pg-simple**: PostgreSQL-based session storage.
- **@neondatabase/serverless**: PostgreSQL connection for serverless environments.