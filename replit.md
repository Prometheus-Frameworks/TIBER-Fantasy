# ON THE CLOCK

## Overview
On The Clock is an open-source fantasy football platform designed to provide advanced, democratized analytics for dynasty leagues. Its core purpose is to offer community-driven tools and high-end, accessible insights without paywalls, fostering a movement that challenges traditional barriers in fantasy football analysis. A key feature, "Competence Mode," provides truth-first, context-aware AI-driven dynasty advice. The project aims to empower users with accurate guidance and a deeper understanding of dynasty league strategy, aspiring to become a leading, independent resource in the fantasy football community.

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
    - **Database Architecture**: Four PostgreSQL tables (team_epa, team_blocking_context, team_coverage_matchups, team_alignment_matchups) storing 28 NFL teams' analytics from screenshot datasets
    - **Position-Specific SOS**: SOSv3 function provides tailored matchup breakdowns by position (RB/WR/QB/TE) with alignment-aware and coverage-aware scoring
    - **Alignment Matchups**: Outside WR vs Slot vs TE with FPG allowed and matchup scores for WR/TE positions
    - **Coverage Breakdowns**: Zone/Man/2-High/1-High coverage with FPDB allowed, defensive usage rates, and matchup scores for QB/WR/TE positions  
    - **Blocking Context**: Run blocking (YBC per attempt) and pass protection (pressure rate inverted) for RB/QB positions
    - **API Endpoint**: `/api/sos/weekly/v3` with position, week, season filtering returning enriched analytics
    - **UI Components**: SOSAnalyticsPage at `/sos/analytics` with React Query data fetching, position filters, color-coded matchup cards, null-safe rendering
    - **Home Page Integration**: Featured section showcasing SOS capabilities with EPA, alignment, coverage, and blocking analytics cards
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