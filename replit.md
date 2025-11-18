# Tiber Fantasy

## Overview
Tiber Fantasy is a free, open-source NFL fantasy football analytics dashboard launched in October 2025. It provides a 6-tab platform with real-time 2025 NFL data, Madden-style OVR player ratings, Defense vs Position matchups, and Strength of Schedule analytics using EPA metrics. The project aims to offer high-end fantasy football insights without paywalls or partnerships, fostering meaningful conversations and better decision-making for fantasy players. Its ambition is to offer a dynamic "Player Compass" for player evaluation and an "OTC Consensus" for community-driven rankings, alongside advanced AI insights.

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
The platform employs a 3-tier ELT architecture (Bronze → Silver → Gold layers) for robust data processing.

**Core Infrastructure:**
- **Backend**: Node.js/TypeScript (Express.js) and Python (Flask).
- **Frontend**: React 18, TypeScript, Tailwind CSS, TanStack Query, shadcn/ui.
- **Database**: PostgreSQL with Drizzle ORM and `pgvector` extension.
- **Player Identity**: Unified resolution for 11,400+ players across major fantasy platforms.
- **Data Quality**: Multi-dimensional validation, data lineage, and confidence scoring.

**UI/UX Decisions**:
- Dark navy background (`bg-[#0a0e1a]`), slate cards (`bg-[#141824]`), blue-purple gradient accents, and white/light typography.
- Features interactive GlowCard components, pulsing GlowCTA buttons, skeleton loading, and a top loading bar.

**Technical Implementations & Feature Specifications:**
- **Unified Player Hub (UPH)**: Centralized data architecture for player information, "Player Compass" for dynamic profiles, "OTC Consensus" for community rankings, and a Madden-style 1-99 OVR.
- **AI & Analytics**: "Competence Mode" for AI advice, Adaptive Consensus Engine, DeepSeek + Compass Fusion System for predictive analysis.
- **Rankings & VORP**: Comprehensive Rankings Hub, enhanced VORP with dynasty and age adjustments, and an Enhanced ECR Comparison System.
- **Player Analysis**: Rookie Evaluation System, Target Competition Analysis (TCIP), Player Usage Context Module, and Stud Detection Module.
- **EPA Analytics**: Advanced efficiency metrics from nfl-data-py play-by-play data, including EPA per play/target, Air EPA vs YAC EPA, success rates, and team offensive/defensive EPA context rankings. Includes an EPA Sanity Check System and a production-ready EPA Rankings Tab with a 5-tier classification.
- **SOS Team Analytics**: Comprehensive strength of schedule system with position-specific matchup intelligence.
- **Defense vs Position (DvP) Matchup System**: Calculates fantasy points allowed by defenses against specific positions using NFLfastR data, featuring a 5-tier rating system.
- **Data Integration & Sync**: Sleeper Sync with cache fallback, Canonical Player Pool System, Roster Shift Listener, and Roster Sync System.
- **Live Data Processing**: Live Data Integration Pipeline with multi-source data capture and a Hot List Player Extraction System.
- **Backend Services**: Backend Spine with Logs & Projections Service and a multi-format Ratings Engine.
- **TIBER (Tactical Index for Breakout Efficiency and Regression)**: Version 1.5, using First Downs per Route Run and real NFLfastR snap count data for player participation, 4-week trend analysis, and detailed player drawer.
- **Player Search**: Functionality to search player game logs and statistics.
- **Enhanced Player Card Component**: Features TIBER trend charts, last 3 weeks summary, and ROS Matchup Calendar.
- **Strategy Tab**: Redesigned for Start/Sit recommendations, Waiver Wire Targets based on TIBER, and SOS Rankings.
- **Weekly Takes System**: Quick, punchy matchup insights with position-specific one-liners and concrete statistics.
- **League System**: Supports user-created fantasy leagues with context-aware AI interactions, integrating league settings, trades, and roster moves via vector-searchable context. Includes Sleeper league auto-sync.
- **RAG Chat System**: Integrates Google Gemini AI for embeddings and chat generation, providing teaching-focused responses. Features:
    - **Context-Aware Personality**: Natural, friendly tone for casual greetings; full Scout-GM voice for fantasy questions.
    - **Anti-Hallucination**: Strict rules requiring data-backed claims, acknowledging data gaps.
    - **League Context Integration**: Pre-fetches and prepends roster data for reliable awareness.
    - **Session Isolation**: Complete chat session management.
    - **Investigative Conversation Framework**: 4-phase approach (Acknowledge roster, Ask priorities, Provide tailored recommendations, Invite follow-up).
    - **VORP Integration**: Automatically detects player mentions and calculates real-time VORP from 2025 Sleeper game logs. Provides objective performance data.
    - **Top Performers Season Awareness**: Fetches and caches top 24 players at each position from 2025 Sleeper data, included in every chat.
    - **Citation System**: Strict enforcement of citing provided VORP data, no [Source N] labels.
    - **Conversational Focus**: Answers user's actual question first, then optionally expands.
    - **Elite Player Recognition**: Top-12 performers acknowledged as legitimate starters/studs.
    - **Player Detection**: Robust detection with pre-filtering of excluded words and minimum capitalization.
    - **Player Alias System**: Supports ~80 common nicknames for VORP lookups.
    - **Pattern Observation System**: Epistemic-framed pattern bank teaching evaluation frameworks, including jargon dictionary and NFLfastR validation.
    - **Hallucination Prevention System**: Dual-layer protection against citing unavailable metrics through context sanitization and reinforced system prompt rules.
    - **RAG Content Validation Rule**: Only RAG content explicitly tagged as DATA can be cited as evidence.
    - **Ambiguity & Clarification Rule**: Asks clarifying questions for ambiguous queries.
    - **Missing or Partial Data Rule**: Clearly states limitations for unavailable data and bases answers only on available metrics.
    - **Mixed Meta + Tactics Rule**: Prioritizes tactical decisions in responses.
    - **Possessive Form Guard**: Avoids possessive form with banned metrics.
    - **2024 Baseline Training Data Integration**: Uses historical 2024 data (player stats, usage patterns, elite baselines) to teach evaluation frameworks, strictly framed as historical data.
        - **Tactical Contamination Guard**: Blocks 2024 baseline RAG chunks from tactical queries (trade/start-sit/waivers) to prevent historical data from overriding current 2025 stats in decision-making.
    - **Format Brain (Redraft vs Dynasty Detection)**: Dual-brain system detecting query format to adjust response depth and time horizon:
        - **Redraft Detection**: Weekly matchups, start/sit, waivers, ROS focus → Tactical surface responses
        - **Dynasty Detection**: Draft picks, age curves, windows, long-term value → Strategic depth responses
        - **Implementation**: Heuristic-based with 80+ signal patterns, 25/25 test cases passing (100%)
        - **Response Frameworks**: Explicit redraft/dynasty playbooks with decision rules and language patterns to enforce format-appropriate advice
        - **Logging**: Format detection logged alongside layer detection for monitoring
        - **Default Behavior**: Ambiguous queries default to dynasty (general player evaluation context)
    - **Fresh Team Context in VORP**: VORP formatting includes team codes (e.g., "MIN WR20") from live Sleeper API data to counteract stale RAG roster information.
    - **Temporal-Precision Enforcement**: Dual-layer system ensuring responses cite only the requested year when explicitly mentioned:
        - **System Prompt Rule**: Instructs LLM to respect year-specific requests without cross-contamination
        - **Temporal Detection (1990-2049)**: Comprehensive extraction of 4-digit years, 2-digit shorthand ('90-'49), and temporal phrases ("this season", "last year", "two years ago")
        - **Query Parsing**: Unified temporal reference extraction with comparison intent detection
        - **Response Validation**: Identifies out-of-scope year mentions in generated responses
        - **Auto-Regeneration**: Violations trigger automatic regeneration with inline CRITICAL reminder
        - **Re-Validation**: Regenerated responses validated again; HTTP 500 error if second attempt fails
        - **Comprehensive Logging**: All violations, regenerations, and resolutions logged for monitoring
        - **Comparison Support**: Multi-year context allowed when user explicitly invites comparison ("compare 2024 vs 2025", "how does this year differ from last")
    - **TIBER UX & Epistemic Fixes** (November 2025):
        - **Rookie & Pre-NFL Guard**: Prevents citing non-existent stats for players without NFL data in requested seasons
        - **Data Availability Contract**: Season capability helpers (2024 has weekly box scores, 2025 has rankings/PPG only)
        - **Stats Keyword Override**: Forces tactical layer for stat queries ("stats", "statline", "box score", etc.) - never River/Teaching
        - **Trade Evaluation Formatter**: Enforces structured 3-part responses (verdict → bullets → context caveat)
        - **Confession Pattern Handler**: Detects "would you believe me if..." and acknowledges user already acted
        - **River Discipline Snapback**: Removes River language from direct stat queries while preserving for philosophy questions
        - **System Prompt Updates**: Banned "I don't have NFLfastR access" phrase, describes actual data capabilities by season
        - **VORP TTL Cache**: 6-hour cache TTL for NFL state (season + week) to auto-advance throughout season, preventing frozen rankings
        - **Test Coverage**: 21/21 tests passing (100%) validating all fixes

## External Dependencies
- **MySportsFeeds API**: Injury reports and NFL roster automation.
- **Sleeper API**: Player projections, game logs, ADP data, league sync, and current roster data.
- **NFLfastR (nflverse)**: 2025 play-by-play data.
- **NFL-Data-Py**: 2024 weekly statistics, depth charts, and 2025 snap count data.
- **R Server**: External API for OASIS (Offensive Architecture Scoring & Insight System) data.
- **Axios**: HTTP requests.
- **Zod**: Runtime type validation.
- **Recharts**: Charting and data visualization.
- **connect-pg-simple**: PostgreSQL-based session storage.
- **@neondatabase/serverless**: PostgreSQL connection for serverless environments.
- **Google Gemini API**: For AI embeddings and chat generation within the RAG system.