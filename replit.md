# Tiber Fantasy

## Overview
Tiber Fantasy is a free, open-source NFL fantasy football analytics dashboard. It provides real-time NFL data, Madden-style OVR player ratings, Defense vs Position matchups, and Strength of Schedule analytics using EPA metrics. Its core purpose is to deliver high-end fantasy football insights without paywalls, empowering users with superior decision-making tools. Future ambitions include a "Player Compass" for dynamic player evaluation, an "OTC Consensus" for community-driven rankings, and advanced AI insights via the TIBER Brain OS.

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
- **AI & Analytics**: "Competence Mode" AI, Adaptive Consensus Engine, DeepSeek + Compass Fusion System for predictive analysis. Includes a RAG Chat System using Google Gemini AI for teaching-focused, context-aware responses.
- **Rankings & VORP**: Comprehensive Rankings Hub, enhanced VORP with dynasty and age adjustments, and an Enhanced ECR Comparison System.
- **Player Analysis**: Rookie Evaluation System, Target Competition Analysis (TCIP), Player Usage Context Module, Stud Detection Module, and TIBER (Tactical Index for Breakout Efficiency and Regression) for breakout efficiency, snap count analysis, and trend analysis.
- **EPA Analytics**: Advanced efficiency metrics from nfl-data-py play-by-play data, including EPA per play/target, Air EPA vs YAC EPA, success rates, and team offensive/defensive EPA context rankings.
- **SOS Team Analytics**: Comprehensive strength of schedule system with position-specific matchup intelligence.
- **Defense vs Position (DvP) Matchup System**: Calculates fantasy points allowed by defenses against specific positions using NFLfastR data.
- **Data Integration & Sync**: Sleeper Sync, Canonical Player Pool, Roster Shift Listener, and Roster Sync. Includes a robust NFL Schedule Sync Infrastructure using NFLverse data.
- **Live Data Processing**: Live Data Integration Pipeline with multi-source data capture and a Hot List Player Extraction System.
- **Strategy Tab**: Redesigned for Start/Sit recommendations, Waiver Wire Targets (integrating TIBER and Waiver Wisdom Module), and SOS Rankings.
- **Weekly Takes System**: Quick, punchy matchup insights with position-specific one-liners and concrete statistics.
- **Role Banks (WR, RB, TE, QB)**: Season-level analytical classification systems for position-specific role evaluation, using multi-dimensional scoring models and tier classifications. Includes Admin Sandboxes for experimental alpha scoring and archetype classification.
- **FORGE v0.3 (Football-Oriented Recursive Grading Engine)**: Self-contained, read-only scoring module providing unified alpha scores (0-100) for WR/RB/TE/QB positions. Features position-specific weighted sub-scores, trajectory tracking, and confidence scoring. Integrates Offensive Environment Modifier (EnvScore) and Weekly Matchup Context Modifier (MatchupScore) into player rankings.
  - **Datadive Integration (v1.1)**: For season >= 2025, FORGE reads exclusively from Datadive snapshot tables instead of legacy weekly_stats. Feature flag `USE_DATADIVE_FORGE` controls behavior (default true). Key integrations:
    - Player eligibility from `datadive_snapshot_player_season` table
    - Season stats (gamesPlayed, targets, yards, TDs) from season snapshots
    - Advanced metrics (YPRR, aDOT, EPA/play) from snapshot data
    - Weighted EPA metrics (epaPerTarget, rushEpaPerPlay) calculated from weekly rows
    - Files: `datadiveContext.ts` (bridge service), `contextFetcher.ts` (FORGE context loader)
- **FORGE SoS v1 (Strength of Schedule)**: Position-specific schedule difficulty analysis using internal FORGE data. Endpoints: `/api/forge/sos/team-position` (team + position SoS), `/api/forge/sos/player/:playerId` (player SoS), `/api/forge/sos/rankings` (all teams ranked by easiest schedule). Returns RoS (rest of season), Next 3 weeks, and Playoff (weeks 15-17) SoS scores on 0-100 scale (higher = easier). Uses `forge_team_matchup_context` for defense ratings and `schedule` table for opponent lookup.
- **Admin API Lexicon**: Developer tool at `/admin/api-lexicon` for browsing and testing Forge/Tiber API endpoints. Features searchable endpoint registry, tag filtering, sample parameters, live response previews with important field highlighting, and cURL command generation. Registry maintained at `server/infra/apiRegistry.ts`.
- **Tiber Memory v0.1 (Conversation Memory System)**: Persistent conversation memory for Tiber AI chat. Features conversation threading, message history, and scoped memory snapshots (global, league, session). Endpoints: `/api/tiber/chat` (chat with memory), `/api/tiber/conversations/:userId` (list conversations), `/api/tiber/conversation/:conversationId/messages` (get messages). Uses `TiberMemoryManager` service for context building and `TiberPromptBuilder` for Tiber-specific prompts.
- **Tiber Dual Memory Pools v1 (FANTASY vs GENERAL)**: Separates conversation memory into two pools to prevent philosophical/metaphorical language from leaking into fantasy analysis. FANTASY mode activated when any Forge hints provided (forgePlayerId, forgePosition, forgeTeamId). GENERAL mode for all other conversations. Mode-based routing ensures fantasy conversations use only analytical context while general conversations can include broader topics. Response includes `mode` field indicating active memory pool.
- **ForgeContext v0 (FORGE-Tiber Integration)**: Wires live FORGE data into Tiber chat prompts. When clients provide optional hints (`forgePlayerId`, `forgePosition`, `forgeTeamId`), Tiber's responses are grounded in actual FORGE alpha scores, subscores (volume, efficiency, stability, contextFit), and SoS metrics. Uses `ForgeContextLoader` service to call underlying FORGE services directly (no HTTP self-calls). Fully backwards compatible - all hints are optional.
- **Tiber Voice v1 (Prompt Architecture)**: Gemini-optimized reasoning and grounding system for Tiber AI. Features:
  - **Truth Hierarchy**: Tier 0 (FORGE data = absolute law) > Tier 1 (role/injury context) > Tier 2 (narratives/vibes)
  - **Reasoning Pipeline**: Alpha check → Subscores → Environment → Matchup/Schedule
  - **Reasoning Heuristics**: Volume Law, Stability Principle, Anchor Rule, Skeptic's Razor
  - **Style Guide**: Bottom Line Up Front, no fluff, no invented stats, direct analytical tone
  - **Grounding**: `trimForgeContext` sends minimal FORGE payload; Tiber refuses to hallucinate missing metrics
  - Files: `tiberPromptBuilder.ts` (system prompt), `forgeContextLoader.ts` (data trimmer)
- **Tiber Data Lab v1 (Operation DataDive)**: Snapshot-based NFL data spine for reproducible analytics. Features:
  - **Snapshot System**: Immutable weekly data snapshots with validation (min 200 rows, 28+ teams, no null IDs)
  - **Advanced Metrics**: TPRR (targets per route), YPRR (yards per route), EPA/play, success rate, snap share
  - **Tables**: `datadive_snapshot_meta` (snapshot audit), `datadive_player_week_staging` (temp staging), `datadive_snapshot_player_week` (finalized weekly), `datadive_snapshot_player_season` (season aggregates)
  - **API Endpoints**: GET `/api/data-lab/meta/current`, `/api/data-lab/search`, `/api/data-lab/player-week`, `/api/data-lab/player-season`, `/api/data-lab/team-week`, `/api/data-lab/health`
  - **Admin Endpoint**: POST `/api/data-lab/admin/run` with body `{season, week}` triggers snapshot creation
  - **Frontend**: `/tiber-data-lab` page with search, position filter, and player detail drawer
  - Files: `datadiveSnapshot.ts` (service), `dataLabRoutes.ts` (API), `TiberDataLab.tsx` (frontend)
- **xFPTS v2 (Expected Fantasy Points v2)**: Context-aware expected fantasy points system with nflfastR-derived adjustments.
  - **v1 Formula**: Usage-only baselines (WR: 1.85 PPT, TE: 1.65 PPT, RB: 1.50 PPT + 0.85 PPRush)
  - **v2 Formula**: v1 × context multipliers (Red Zone, YAC ratio, Rush EPA, Success Rate)
  - **Multiplier Bounds**: Receiving 1.0-1.3 (boost only), Rush 0.8-1.2 (can penalize)
  - **Tables**: `datadive_nflfastr_metrics` (context metrics), `datadive_expected_fantasy_week` (v1/v2 expected points with multipliers)
  - **API Endpoints**: 
    - POST `/api/data-lab/admin/xfpts-run` with body `{season, week?, extractMetrics?}` triggers v2 computation
    - GET `/api/data-lab/xfpts/player?player_id=X&season=Y` returns player expected fantasy with v2Context debug info
  - **Response Contract**: `PlayerExpectedFantasyWeek` type with nested `v2Context` containing rzShare, yacRatio, rushEpaContribution, rushSuccessContribution
  - Files: `xFptsConfig.ts` (config/multiplier logic), `xFptsService.ts` (computation service)

## OASIS Status (Deprecated)

**Status:** DEPRECATING - Being replaced by internal FORGE SoS/Context module

OASIS (Offensive Architecture Scoring & Insight System) was originally conceived as an external API integration for team offensive environment data. Audit findings:
- No external OASIS API is actually called - all data is internally-generated baseline values
- OASIS endpoints (`/api/oasis/*`) serve hardcoded fallback data
- FORGE already provides equivalent functionality via `forge_team_env_context` and `forge_team_matchup_context` tables

**Migration Plan:**
1. Delete unused OASIS files (oasisRServerClient.ts, otc-power module)
2. Rename OASIS services/types to FORGE naming
3. Migrate active dependencies to use existing FORGE env/matchup infrastructure
4. Retire OASIS naming from codebase

See `docs/oasis_audit.md` for full deprecation plan.

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