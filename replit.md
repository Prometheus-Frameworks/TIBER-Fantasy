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
- **FORGE (Football-Oriented Recursive Grading Engine)**: The core player evaluation system. FORGE provides unified Alpha scores (0-100) for skill positions, serving as the numeric authority for all player assessments.

### FORGE Philosophy & Acronym

| Letter | Meaning | Description |
|--------|---------|-------------|
| **F** | **Football** | Grounded in football reality. Every metric, threshold, and weight reflects what happens on the field - not abstract math. |
| **O** | **Oriented** | Toward decision confidence. FORGE exists to help real managers make real calls with clarity. |
| **R** | **Recursive** | Performance compounds. Each week's Alpha depends on historical trajectory. Outputs feed back as inputs. |
| **G** | **Grading** | Four pillars (Volume, Efficiency, Stability, Context) → calibrated Alpha score (0-100). |
| **E** | **Engine** | The data pipeline. Advanced metrics flow in, actionable intelligence flows out. |

**The O Statement (FORGE Philosophy):**
> *"FORGE is oriented toward decision confidence. Every Alpha score exists to answer one question: Should I start this player? We don't chase hot takes. We don't parrot consensus. We measure what happened, project what's likely, and give you the clarity to decide. When Tiber speaks, FORGE is the foundation. When you doubt, the data defends."*

### FORGE Data Pipeline Architecture

```
DATA SOURCES (The "E" - Engine Input)
├── Role Banks (Season-Level)
│   ├── WR Role Bank: ALPHA, CO_ALPHA, PRIMARY_SLOT, SECONDARY, ROTATIONAL
│   ├── RB Role Bank: ELITE_WORKHORSE, HIGH_END_RB1, MID_RB1, STRONG_RB2, etc.
│   ├── TE Role Bank: Similar tiering with position-specific thresholds
│   └── QB Role Bank: Similar tiering with QB-specific metrics
│
├── Datadive (2025 Enriched Metrics)
│   ├── WR/TE: YPRR, WOPR, RACR, EPA/target, air yards share, xyac, separation
│   ├── RB: RYOE, opportunity share, elusive rating, stuffed rate, YCO
│   ├── QB: CPOE, DAKOTA, EPA/play, pressured EPA, PACR
│   └── All: snap share, route rate, target share
│
└── Legacy Tables (2024 fallback)
    └── playerAdvanced2024, playerSeason2024, qb_epa_adjusted
           │
           ▼
CONTEXT FETCHER (contextFetcher.ts)
├── Assembles ForgeContext with seasonStats, weeklyStats, advancedMetrics
├── Fetches roleMetrics, teamEnvironment, dvpData
└── Resolves player IDs across platforms
           │
           ▼
FEATURE BUILDERS (Position-Specific)
├── wrFeatures.ts  → WR: targets/game, YPRR, EPA/target, catch rate OE
├── rbFeatures.ts  → RB: opportunities, RYOE, YAC, opportunity share
├── teFeatures.ts  → TE: targets, YPRR, EPA/target, inline usage
└── qbFeatures.ts  → QB: EPA/play, CPOE, AYPA, TD-INT differential
           │
           ▼
GRADING ENGINE (alphaEngine.ts)
├── calculateSubScores() → Volume, Efficiency, Stability, Context (0-100 each)
├── calculateWeightedAlpha() → Position-specific weights applied
├── calibrateAlpha() → Map to intuitive 0-100 scale
├── calculateTrajectory() → Rising / Flat / Declining
└── calculateConfidence() → Data quality adjustments (20-100)
           │
           ▼
RECURSIVE ENGINE (recursiveAlphaEngine.ts)
├── Pass 0: Raw Alpha from current week metrics
├── Pass 1: Stability adjustments based on:
│   ├── alphaPrev (previous week's Alpha)
│   ├── surprise (deviation from expected)
│   ├── volatility (8-week rolling stddev)
│   └── momentum (3-week trend vs baseline)
└── State persisted to forge_player_state table
           │
           ▼
OUTPUT: ForgeScore with Alpha, Tier, Trajectory, Confidence
```

### FORGE Technical Implementation

- **Recursion v1 (Dec 2024)**: Stateful two-pass scoring. Key formulas: `expected_alpha = alpha_prev * 0.7 + position_baseline * 0.3`, `surprise = alpha_raw - expected_alpha`. Position baselines: QB=65, RB=58, WR=60, TE=55. API: `/api/forge/recursive/batch?position=QB&persist=true`, `/api/forge/recursive/player/:playerId`.
- **Tiber Tiers (v0.2)**: Position-specific tier thresholds (QB T1≥85, RB T1≥82, WR T1≥84, TE T1≥80). Weekly mover rules: max ±1 tier/week, max ±10 Alpha from matchups, elite protection (Alpha≥85 max -6 drop). Efficiency caps: QB uncapped, WR/RB/TE capped at 85.
- **Next Man Up**: Opportunity tracking for players gaining touches when starters go OUT/IR, displayed with green/red arrows in FORGE Movers.
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
- **DST Streamer (Dec 2024)**: Weekly defense/special teams streaming recommendations in Rankings Hub. Scoring formula combines defense strength (turnover rate, sack rate, points allowed) with opponent vulnerability (turnover-worthy rate, sack rate allowed, pressure rate). Tier distribution targets ~4 T1, ~10 T2, ~12 T3, ~2 T4 defenses per week. Available at `/api/data-lab/dst-streamer?week=X&season=Y` and via DST tab in Rankings. Features **DSTMatchupModal** transparency view showing full calculation breakdown (defense metrics, opponent vulnerability, matchup boost) when clicking any matchup row.
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