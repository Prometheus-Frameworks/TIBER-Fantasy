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
- **FORGE v0.2 (Football-Oriented Recursive Grading Engine)**: Self-contained, read-only scoring module providing unified alpha scores (0-100) for WR/RB/TE/QB positions. Features position-specific weighted sub-scores (volume, efficiency, roleLeverage, stability, contextFit), trajectory tracking (rising/flat/declining), and confidence scoring (0-100). Integrates with PlayerIdentityService, Sleeper snap service, game logs, and environment services. API: `/api/forge/preview`, `/api/forge/score/:playerId`, `/api/forge/batch`, `/api/forge/health`. Module location: `server/modules/forge/`.

### FORGE v0.2 — WR Calibration Layer

**What Changed:**
- Introduced a position-aware calibration layer for WR in `alphaEngine.ts`
- Raw engine scores (`rawAlpha`) were previously compressed (~30–52)
- Calibrated scores now map to an intuitive range (~25–90) for 2025 WRs
- Top WRs (e.g. JSN, Chase, Puka, Amon-Ra, London) now sit in the high 70s–80s
- Δ between Sandbox α and FORGE α is now typically in the -10 to +6 range instead of systemic -30s

### FORGE v0.2.1 — EnvScore Integration

**Offensive Environment Modifier:**
- Integrated team offensive environment scores (EnvScore) into WR and RB rankings
- Data source: `forge_team_environment` table with `env_score_100` (0-100 scale, 50=neutral)
- Weight: `wEnv = 0.40` allows ±40% swings at score extremes

**Formula:**
```
envFactor = 1 + 0.40 * (envScore/50 - 1)
envAdjustedAlpha = baseAlpha * envFactor (clamped to [25, 90])
```

**Examples (Week 12, 2025):**
- LA Rams (envScore=62): +9.6% boost (P.Nacua 80 → 87.68)
- ATL Falcons (envScore=50): 0% change (neutral environment)
- SF 49ers (envScore=51): +0.8% minimal boost

**API Response Fields:**
- `alphaScore`: Final env-adjusted alpha (primary ranking score)
- `forge_alpha_base`: Pre-environment base alpha
- `forge_alpha_env`: Post-environment adjusted alpha
- `forge_env_multiplier`: Environment factor (1.0 = neutral)
- `forge_env_score_100`: Team's offensive environment score

**Frontend:**
- New "Env" column in ForgeRankingsTable showing team environment score
- Color-coded: Elite (60+, green), Good (55+, emerald), Avg (45+), Below (40+), Poor (<40)

**Why We Keep `rawAlpha`:**
- `rawAlpha` = pure engine score, directly from FORGE's feature stack
- `alpha` (calibrated) = UI-facing score for rankings and surface-level display
- Sandbox α = human/tuning layer based on scouting and sliders

We need all three:
- Sandbox α → human intent
- `rawAlpha` → engine truth
- `alpha` → stable, user-friendly scale

**Data Flow:**
1. Features (usage, efficiency, context, penalties, etc.)
2. Engine computes `rawAlpha`
3. `calibrateAlpha(rawAlpha, position)` produces `alpha` using `ALPHA_CALIBRATION`
4. API returns **both**: `rawAlpha` and `alpha`

**Future Calibration Plan:**
- WR is fully calibrated in v0.2
- `ALPHA_CALIBRATION` is position-aware:
  - WR has real `{ p10, p90, outMin, outMax }`
  - RB/TE/QB entries exist but are not yet tuned
- Next steps:
  - Build `/rankings/rb` panel mirroring WR
  - Derive RB `p10/p90` from 2025 data
  - Repeat process for TE and QB once those sandboxes are stable

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