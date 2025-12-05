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
- **New Homepage (Dec 2024)**: Horizontal feature navigation with Dashboard, Rankings, Schedule, Data Lab tabs. Condensed chat panel on right side with live Tiber Chat integration. Dashboard widgets for Quick Insights, FORGE Movers, and Start/Sit suggestions. League selector in header with real data from `/api/leagues`. Previous sidebar-style chat homepage available at `/legacy-chat` as fallback.
- **Mobile-First PWA (Dec 2024)**: Progressive Web App with "Add to Home Screen" capability for iOS and Android. Service worker caches static assets. Responsive design with breakpoints at sm (640px), md (768px), and lg (1024px). Tables hide secondary columns on mobile using `hidden sm:table-cell` patterns. Touch-friendly buttons and inputs with proper sizing.
- **Universal Current Week System (Dec 2024)**: `/api/system/current-week` endpoint provides real-time NFL week detection based on the 2025 schedule. Frontend components (HomepageRedesign, StrategyTab) use the `useCurrentNFLWeek()` hook to dynamically fetch the current week for Start/Sit and matchup-based features. Week detection uses `shared/weekDetection.ts` which has the full 2025 NFL schedule with precise game start/end times.

**Technical Implementations & Feature Specifications:**
- **Unified Player Hub (UPH)**: Centralizes player data, "Player Compass" profiles, "OTC Consensus" rankings, and Madden-style OVR.
- **AI & Analytics**: "Competence Mode" AI, Adaptive Consensus Engine, DeepSeek + Compass Fusion System, RAG Chat System using Google Gemini AI. Features Tiber Memory for persistent conversation and Dual Memory Pools (FANTASY vs GENERAL) for context separation. Tiber Voice offers Insight and Analyst chat modes with a 5-tier Truth Hierarchy and reasoning heuristics.
- **FORGE (Football-Oriented Recursive Grading Engine)**: A self-contained scoring module providing unified alpha scores (0-100) for skill positions, including trajectory tracking, confidence scoring, and modifiers for offensive environment and weekly matchup context. Integrates with Datadive snapshot tables.
- **Tiber Tiers (FORGE v0.2)**: Position-specific tier classification system with thresholds (QB T1≥85, RB T1≥82, WR T1≥84, TE T1≥80). Features weekly mover rules: max ±1 tier/week, max ±10 Alpha from matchups, bottom-8 offense max +4 boost, low snap projections (< 60%) get zero upward adjustment, true elites (Alpha≥85) max -6 drop protection. Efficiency caps: QB uncapped (100), WR/RB/TE capped at 85.
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