# Tiber Fantasy

## Overview
Tiber Fantasy is a free, open-source NFL fantasy football analytics dashboard designed to democratize advanced analytics. Launched in October 2025, it offers a 6-tab platform with real-time 2025 NFL data, Madden-style OVR player ratings, Defense vs Position matchups, and Strength of Schedule analytics using EPA metrics. The platform is committed to complete independence, providing high-end fantasy football insights without paywalls or partnerships, aiming to transform statistical insights into meaningful conversations for better fantasy decisions.

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
- **OVR (Overall Rating) System**: Madden-style 1-99 player rating system based on weighted blending of multiple inputs (API endpoints at `/api/ovr/*`).
- **AI & Analytics**: "Competence Mode" for AI advice, Adaptive Consensus Engine, and DeepSeek + Compass Fusion System for predictive analysis.
- **Rankings & VORP**: Comprehensive Rankings Hub, enhanced VORP with dynasty mode and age penalties, and an Enhanced ECR Comparison System.
- **Rookie & Player Analysis**: Dedicated Rookie Evaluation System, Target Competition Analysis (TCIP), Player Usage Context Module, and Stud Detection Module.
- **EPA Analytics**: Advanced efficiency metrics from nfl-data-py play-by-play data, including EPA per play/target, Air EPA vs YAC EPA, success rates, and team offensive/defensive EPA context rankings.
- **SOS Team Analytics**: Comprehensive strength of schedule system with position-specific matchup intelligence, including EPA-based rankings and week-specific scores (API endpoints at `/api/sos/*`).
- **Defense vs Position (DvP) Matchup System**: Calculates fantasy points allowed by defenses against specific positions using NFLfastR data, featuring a 5-tier rating system (API endpoints at `/api/dvp/*`).
- **Data Integration & Sync**: Sleeper Sync with cache fallback, Canonical Player Pool System, Roster Shift Listener, and Roster Sync System.
- **Live Data & Processing**: Live Data Integration Pipeline with multi-source data capture and a Hot List Player Extraction System.
- **Backend Services**: Backend Spine with Logs & Projections Service and a multi-format Ratings Engine.
- **UI/UX Enhancements**: Interactive GlowCard components, pulsing GlowCTA buttons, skeleton loading, and a top loading bar.
- **TIBER (Tactical Index for Breakout Efficiency and Regression)**: Version 1.5 implemented, using First Downs per Route Run as a primary metric, with API endpoints like `/api/tiber/score/:nflfastrId` and `/api/tiber/insights`.
- **Player Search**: Feature for searching player game logs and statistics.

## Recent Changes

### Rankings Page Frontend Fix (October 15, 2025)
**Issue:** Rankings tab displayed no players despite backend API returning 150 fantasy-relevant players correctly.

**Root Causes:**
1. API response format mismatch - frontend expected `{ success: true, data: { players: [...] } }` but backend returned flat array
2. Missing required fields - frontend needed `player_id` (string), `tier`, `confidence` but backend returned `id` (number) without tier/confidence
3. Dynasty/redraft toggle broken - position filter changes didn't trigger cache invalidation

**Solutions Applied:**
1. **Backend (server/routes/ovrRoutes.ts):**
   - Wrapped response in `{ success: true, data: { players: [...] }, meta: {...} }` format
   - Map database `id` to `player_id` as string
   - Calculate `tier` based on OVR (Elite ≥90, Great ≥80, Good ≥70, B ≥60, else C)
   - Add `confidence` score (0.85 for players with avgPoints, 0.65 fallback)

2. **Frontend (client/src/components/tabs/RankingsTab.tsx):**
   - Fixed queryKey to include format: `['/api/ovr', selectedFormat]` for proper cache segregation
   - Added explicit queryFn with format parameter
   - Implemented client-side position filtering (instant, no API calls)
   - Removed dead code (unused buildQueryUrl function)

**Architecture Pattern:**
- **Format changes** (dynasty/redraft): Server-side with API call
- **Position filtering** (QB/RB/WR/TE): Client-side instant filter
- **TIBER filtering** (breakout/regression): Client-side instant filter

**Test Results:**
- ✅ 150 players display on Rankings tab
- ✅ Position filters work: RB shows 33 RBs, WR shows 63 WRs, ALL shows 150
- ✅ Dynasty/redraft toggle triggers new API calls with format parameter
- ✅ TIBER badges, tier, confidence display correctly
- ✅ Client-side filtering is instant (no API delays)

**Files Modified:**
- `server/routes/ovrRoutes.ts` - Response format and data mapping
- `client/src/components/tabs/RankingsTab.tsx` - Query key and filtering logic

### TIBER Acronym Display (October 15, 2025)
**Enhancement:** Added visible TIBER acronym explanation across the platform to help users understand what TIBER means.

**Changes Applied:**
1. **TiberInsights Widget (Home Tab):**
   - Added subtitle under "🧠 TIBER Insights" heading
   - Shows "Tactical Index for Breakout Efficiency and Regression" in small gray text

2. **Rankings Tab TIBER Filter:**
   - Added explanation below "TIBER Filter:" label
   - Shows "Tactical Index for Breakout Efficiency & Regression" in tiny gray text

3. **TIBER Badge Tooltips:**
   - Updated all badge hover tooltips to show full acronym
   - Format: "TIBER: Tactical Index for Breakout Efficiency and Regression\nScore: X/100 (Tier)"

**Files Modified:**
- `client/src/components/TiberInsights.tsx` - Added acronym subtitle to header
- `client/src/components/TiberBadge.tsx` - Updated tooltip text
- `client/src/components/tabs/RankingsTab.tsx` - Added acronym to filter section

## External Dependencies
- **MySportsFeeds API**: Injury reports and NFL roster automation.
- **Sleeper API**: Player projections, game logs, ADP data, league sync, and current roster data.
- **NFLfastR (nflverse)**: 2025 play-by-play data via parquet files from GitHub releases.
- **NFL-Data-Py**: 2024 weekly statistics via nflfastR, depth charts via nflverse APIs.
- **R Server**: External API for OASIS (Offensive Architecture Scoring & Insight System) data.
- **Axios**: HTTP requests.
- **Zod**: Runtime type validation.
- **Recharts**: Charting and data visualization.
- **connect-pg-simple**: PostgreSQL-based session storage.
- **@neondatabase/serverless**: PostgreSQL connection for serverless environments.