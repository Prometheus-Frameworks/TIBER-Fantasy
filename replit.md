# TIBER FANTASY

## Overview
**Tiber Fantasy** is a free, open-source NFL fantasy football analytics dashboard designed to democratize advanced analytics for all leagues. Launched October 2025 as a unified 6-tab platform (Home, Rankings, Matchups, Strategy, Moves, Leagues), it provides real-time 2025 NFL data powered by NFLfastR, OVR player ratings (Madden-style 1-99), Defense vs Position matchups, and Strength of Schedule analytics with EPA metrics. The platform maintains complete independence with no paywalls or partnerships, making high-end fantasy football insights accessible to everyone.

## Recent Changes

### October 11, 2025 - Platform Rebuild & Rebrand to Tiber Fantasy
**Complete frontend rebuild from "On The Clock" to unified "Tiber Fantasy" dashboard:**
- ✅ **Full Rebrand**: Retired "On The Clock" branding, launched as "Tiber Fantasy" 
- ✅ **Unified Dashboard**: Reduced from 100+ fragmented pages to single 6-tab interface
- ✅ **Tab Structure**: Home (hero + stats), Rankings (OVR), Matchups (DvP), Strategy (SOS), Moves (coming soon), Leagues (coming soon)
- ✅ **Route Simplification**: Single entry point (`/`) with URL-based tab navigation and query params
- ✅ **Performance**: OVR API cached (6hrs) responding in <20ms (down from 30+ second timeouts)
- ✅ **SEO Optimization**: Comprehensive meta tags (Open Graph, Twitter Cards, canonical links)
- ✅ **Mobile Responsive**: Sidebar navigation with responsive design for all screen sizes
- ✅ **Code Cleanup**: Deleted 90+ legacy pages, no LSP errors, production-ready codebase
- ✅ **E2E Tested**: All P0 features verified (Rankings, Matchups, Strategy tabs functional)

**Production TODOs (Pre-Launch):**
- Create og-image.jpg for social sharing previews
- Update domain URLs from tiberfantasy.com to actual production domain
- Replace vite.svg favicon with Tiber Fantasy branded logo

**Backend Status**: All existing APIs intact and functional (OVR, DvP, SOS, EPA services). Gold-layer ETL processing has non-blocking errors (calculateRiskMetrics, market signals) - frontend unaffected.

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
**UNIFIED PLAYER HUB (UPH)** - The platform is now built on a comprehensive 3-tier ELT architecture providing enterprise-grade data processing and analytics for fantasy football. The system transforms raw data from multiple sources into clean, enriched analytics facts through Bronze (raw data storage) → Silver (normalized canonical tables) → Gold (advanced analytics facts) layers.

**Core Infrastructure:**
- **Node.js/TypeScript Backend**: Express.js server with complete ELT pipeline
- **React 18 Frontend**: TypeScript, Tailwind CSS, TanStack Query, shadcn/ui
- **PostgreSQL Database**: Production-ready with Drizzle ORM and comprehensive indexing
- **Cross-Platform Player Identity**: Unified 11,400+ player resolution across Sleeper, ESPN, Yahoo
- **Enterprise Quality System**: Multi-dimensional validation, data lineage tracking, confidence scoring

**Core Features & Design Patterns:**

*   **Player Evaluation & Consensus:** Features a "Player Compass" for dynamic, context-aware player profiles, and "OTC Consensus" for community-driven rankings with format-specific splits and a seeding protocol for manual updates.
*   **OVR (Overall Rating) System:** Comprehensive **Madden-style 1-99 player rating system** that aggregates all ranking inputs through position-specific weighted blending. Combines RankingsFusion, PlayerCompass, RatingsEngine, and OASIS environment data with confidence-based weighting and non-linear percentile mapping. API endpoints at `/api/ovr/*` with filtering, pagination, and distribution statistics.
*   **AI & Analytics:** Includes "Competence Mode" for AI-driven advice, an Adaptive Consensus Engine with injury-aware adjustments and explanatory functionality, and a DeepSeek + Compass Fusion System for predictive power and explainability.
*   **Rankings & VORP:** A comprehensive Rankings Hub, enhanced VORP system with dynasty mode, age penalties, and FLEX allocation, and an Enhanced ECR Comparison System for signal-aware analysis.
*   **Rookie & Player Analysis:** Dedicated Rookie Evaluation System with a 4-component insulation boost and data pipeline, Target Competition Analysis (TCIP), Player Usage Context Module, and a Stud Detection Module.
*   **EPA Analytics:** Advanced efficiency metrics via nfl-data-py play-by-play data processing: EPA per play/target, Air EPA vs YAC EPA separation (route-running vs after-catch ability), success rates, YAC over expected, and team offensive/defensive EPA context rankings. Python-based EPA processor (`epaProcessor.py`) analyzes 35k+ plays to generate efficiency insights for QB, RB, WR, TE positions.
*   **SOS Team Analytics (October 2025):** Comprehensive strength of schedule system with position-specific matchup intelligence powered by real team analytics data:
    - **Database Architecture**: Four PostgreSQL tables (team_defensive_context, team_offensive_context, team_coverage_matchups, team_receiver_alignment_matchups) storing 28 NFL teams' analytics from screenshot datasets. Schedule table enhanced with home_score, away_score, and result columns for game history tracking.
    - **Week 5 SOS Predictions (NEW)**: Accurate EPA-based ranking system for predictive matchup analysis:
      - **Defense Rankings**: Weighted scoring (50% pass EPA allowed, 30% rush EPA allowed, 20% pressure rate) where lower score = harder matchup. LAR #1 (balanced elite), DEN #2, MIN #3 (best pass D, weak run D)
      - **Offense Rankings**: Weighted scoring (60% pass EPA, 40% rush EPA) where higher score = better offense. BUF #1 (0.357 pass EPA), IND #2, DAL #3
      - **Week 5 Matchup Scores**: 0-100 scale where higher = easier matchup for offense (defense score inverted). Green tier (67+), Yellow (33-66), Red (<33)
      - **API Endpoints**: `/api/sos/rankings/defense`, `/api/sos/rankings/offense`, `/api/sos/week5`, `/api/sos/team/history` with position/season/team filtering
      - **Frontend Integration**: `/sos` page defaults to "Week 5 (NEW)" mode with accurate predictions. Note: W5 mode always displays Week 5 regardless of week selector
      - **Expandable Team Game History**: Interactive dropdown UI on team rankings showing weeks 1-4 game results with color-coded W/L (green for wins, red for losses), opponent, score, and home/away indicators. Fetches real game data from nfl-data-py via fetchGameResults.py script.
    - **Position-Specific SOS**: SOSv3 function provides tailored matchup breakdowns by position (RB/WR/QB/TE) with alignment-aware and coverage-aware scoring
    - **Alignment Matchups**: Outside WR vs Slot vs TE with FPG allowed and matchup scores for WR/TE positions
    - **Coverage Breakdowns**: Zone/Man/2-High/1-High coverage with FPDB allowed, defensive usage rates, and matchup scores for QB/WR/TE positions  
    - **Blocking Context**: Run blocking (YBC per attempt) and pass protection (pressure rate inverted) for RB/QB positions
    - **UI Components**: SOSAnalyticsPage at `/sos/analytics` with React Query data fetching, position filters, color-coded matchup cards, null-safe rendering
    - **Home Page Integration**: Featured section showcasing SOS capabilities with EPA, alignment, coverage, and blocking analytics cards
*   **Defense vs Position (DvP) Matchup System (October 2025):** Complete fantasy matchup analyzer calculating fantasy points allowed by defenses against specific positions using real NFLfastR play-by-play data:
    - **Database Architecture**: PostgreSQL table `defense_vs_position_stats` storing fantasy scoring (PPR/Half-PPR/Standard), rankings, matchup ratings, and advanced metrics (EPA, plays against, unique players faced)
    - **Position-Specific Calculation Logic**:
      - **QB**: Passing plays (1pt/25yds, 4pts/TD, -2pts/INT) + QB rushing plays (1pt/10yds, 6pts/TD)
      - **RB**: Rushing plays (1pt/10yds, 6pts/TD) + receiving plays (1pt/rec PPR, 1pt/10yds, 6pts/TD)
      - **WR/TE**: Receiving plays only (1pt/rec PPR, 1pt/10yds, 6pts/TD)
    - **Unique Player Tracking**: Position-specific player identification (QB uses passer_id/rusher_id, RB uses rusher_id/receiver_id, WR/TE uses receiver_id only)
    - **Matchup Rating System**: 5-tier system based on defensive rank (1-6: elite-matchup, 7-12: good, 13-20: neutral, 21-26: tough, 27-32: avoid)
    - **API Endpoints**: 
      - GET `/api/dvp?position={QB|RB|WR|TE}&season=2025&week={1-5}` - Returns ranked defenses vs position
      - POST `/api/dvp/calculate` - Triggers DvP calculations from NFLfastR data
      - GET `/api/dvp/matchup/{position}/{defense}?season=2025&week=1` - Returns specific matchup analysis with rating and projected boost
    - **Frontend Integration**: `/dvp` page with position/week/scoring format filters, color-coded defense ranking cards showing fantasy points allowed, EPA, plays faced, and unique players
    - **2025 Season Coverage**: Weeks 1-5 fully calculated (563 total matchups):
      - Week 1: 128 matchups (2,052 plays) - KC #1 worst vs QB: 22.6 PPR pts, SEA #1 worst vs TE: 21.9 PPR pts
      - Week 2: 126 matchups (1,159 plays) - DAL #1 worst vs QB: 14.32 PPR pts
      - Week 3: 122 matchups (665 plays)
      - Week 4: 108 matchups (343 plays)
      - Week 5: 79 matchups (197 plays) - LV #1 worst vs TE: 8.1 PPR pts
    - **Bulk Import Pipeline**: Optimized Python script using `execute_batch()` for efficient NFLfastR data ingestion from nflverse parquet releases
*   **Data Integration & Sync:** Implements Sleeper Sync with cache fallback, a Canonical Player Pool System, a Roster Shift Listener for transaction monitoring, and a Roster Sync System merging Sleeper and NFL data.
*   **Live Data & Processing:** Features a Live Data Integration Pipeline with multi-source data capture (MySportsFeeds, SportsDataIO, Sleeper API), a Hot List Player Extraction System, and a Snap Counts Knowledge System.
*   **Backend Services:** Includes a Backend Spine with Logs & Projections Service, a multi-format Ratings Engine, and a dedicated OTC Power Rankings Service microservice.
*   **UI/UX Enhancements:** Interactive GlowCard components, pulsing GlowCTA buttons, comprehensive skeleton loading, enhanced Button components, and a top loading bar.

**Technical Stack:**

*   **Backend**: Python (Flask), Node.js (Express.js, TypeScript)
*   **Frontend**: React 18, TypeScript, Jinja2, Wouter, TanStack Query, shadcn/ui (Radix UI), Tailwind CSS
*   **Data**: CSV/JSON, PostgreSQL, Drizzle ORM, Drizzle Kit, JSONL format
*   **Data Pipeline**: Python with nfl-data-py, pandas

## External Dependencies
*   **MySportsFeeds API**: Injury reports and NFL roster automation.
*   **Sleeper API**: Player projections, game logs, ADP data, league sync, and current roster data.
*   **NFL-Data-Py**: 2024 weekly statistics via nflfastR, depth charts via nflverse APIs.
*   **R Server**: External API for OASIS (Offensive Architecture Scoring & Insight System) data.
*   **Axios**: HTTP requests.
*   **Zod**: Runtime type validation.
*   **Recharts**: Charting and data visualization.
*   **connect-pg-simple**: PostgreSQL-based session storage.
*   **@neondatabase/serverless**: PostgreSQL connection for serverless environments.