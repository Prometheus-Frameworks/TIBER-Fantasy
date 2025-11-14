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
- **AI & Analytics**: "Competence Mode" for AI advice, Adaptive Consensus Engine, and DeepSeek + Compass Fusion System for predictive analysis.
- **Rankings & VORP**: Comprehensive Rankings Hub, enhanced VORP with dynasty and age adjustments, and an Enhanced ECR Comparison System.
- **Player Analysis**: Rookie Evaluation System, Target Competition Analysis (TCIP), Player Usage Context Module, and Stud Detection Module.
- **EPA Analytics**: Advanced efficiency metrics from nfl-data-py play-by-play data, including EPA per play/target, Air EPA vs YAC EPA, success rates, and team offensive/defensive EPA context rankings. Includes an EPA Sanity Check System and a production-ready EPA Rankings Tab with a 5-tier classification.
- **SOS Team Analytics**: Comprehensive strength of schedule system with position-specific matchup intelligence.
- **Defense vs Position (DvP) Matchup System**: Calculates fantasy points allowed by defenses against specific positions using NFLfastR data, featuring a 5-tier rating system.
- **Data Integration & Sync**: Sleeper Sync with cache fallback, Canonical Player Pool System, Roster Shift Listener, and Roster Sync System.
- **Live Data Processing**: Live Data Integration Pipeline with multi-source data capture and a Hot List Player Extraction System.
- **Backend Services**: Backend Spine with Logs & Projections Service and a multi-format Ratings Engine.
- **TIBER (Tactical Index for Breakout Efficiency and Regression)**: Version 1.5, using First Downs per Route Run and real NFLfastR snap count data for player participation. Includes 4-week trend analysis and detailed player drawer with weekly/season toggle.
- **Player Search**: Functionality to search player game logs and statistics.
- **QB Stats Review Tab**: Comprehensive validation page for QBs displaying all available NFLfastR stats, Baldwin reference data, and Tiber adjustments.
- **Enhanced Player Card Component**: Features TIBER trend charts, last 3 weeks summary, and ROS Matchup Calendar.
- **Strategy Tab**: Redesigned for Start/Sit recommendations, Waiver Wire Targets based on TIBER, and SOS Rankings.
- **Weekly Takes System**: Quick, punchy matchup insights with position-specific one-liners and concrete statistics.
- **League System**: Supports user-created fantasy leagues with context-aware AI interactions, integrating league settings, trades, and roster moves via vector-searchable context. Includes Sleeper league auto-sync for rosters and transactions.
- **RAG Chat System**: Integrates Google Gemini AI for embeddings and chat generation, providing teaching-focused responses with clean, natural language output.
  - **Context-Aware Personality**: Natural, friendly tone for casual greetings; full Scout-GM voice for fantasy questions. Strict anti-hallucination rules requiring data-backed claims. Acknowledges data gaps.
  - **League Context Integration**: Pre-fetches roster data, builds structured snapshot, and prepends to context for reliable roster awareness.
  - **Session Isolation**: Complete chat session management with "New Chat" button and automatic session reset on league switching.
  - **Smart Greeting Detection**: Distinguishes true small-talk from fantasy questions.
  - **Investigative Conversation Framework**: 4-phase approach (Acknowledge roster, Ask priorities, Provide tailored recommendations, Invite follow-up).
  - **Metadata-First Extraction**: Uses `metadata.playerName` from Sleeper sync for reliable roster parsing, with regex fallback.
  - **VORP Integration**: Automatically detects player mentions (requires full names: "Josh Jacobs" not "Jacobs") and calculates real-time VORP from 2025 Sleeper game logs. Provides objective performance data (position rank, total points, PPG, VORP score, tier classification). VORP data is pinned at top of context for priority citation.
  - **Top Performers Season Awareness**: Fetches and caches top 24 players at each position (QB, RB, WR, TE) from 2025 Sleeper data. Automatically included in EVERY chat for comprehensive season context. 1-hour cache TTL with stale-data fallback prevents API overload while maintaining awareness. TIBER now knows season leaders (RB1-RB24, WR1-WR24, etc.) without explicit user mentions.
  - **Citation System**: Strict enforcement of citing provided VORP data. System prompt requires exact position ranks and stats when available. No [Source N] labels in user-facing responses.
  - **Conversational Focus**: Answers user's actual question first (150-250 words), then optionally expands. Avoids mentioning 5+ players before addressing core question.
  - **Elite Player Recognition**: Top-12 performers at each position acknowledged as legitimate starters/studs, not "dart throws." System prompt enforces recognition of elite production.
  - **Player Detection**: Pre-filtering of excluded words (Is, Are, And, etc.) before regex matching to prevent false positives. Requires minimum 2 capitalized words for reliable full-name detection.
  - **Player Alias System**: Supports ~80 common nicknames for reliable VORP lookups.
  - **Pattern Observation System**: Epistemic-framed pattern bank teaching evaluation frameworks. Includes a jargon dictionary, 6 embedded pattern chunks with epistemic framing, and an NFLfastR validation service for live data queries.
  - **Hallucination Prevention System**: Comprehensive dual-layer protection against citing unavailable metrics. System enforces strict data boundaries through aggressive context sanitization (removes ALL sentences mentioning banned metrics before LLM sees them) plus reinforced system prompt rules prohibiting citation of both specific values AND trends. Prevents hallucinations for: snap share, snap count, yards per carry (YPC), touches per game, target share, route participation, red zone usage. When asked about unavailable metrics, TIBER refuses and redirects to available data (rankings, PPG, VORP, tiers). Example: "I don't have snap share data. He's RB5 with 16.7 PPG." Context sanitization implemented via `sanitizeContext()` function in geminiEmbeddings.ts, applied at retrieval time. System prompt includes STRICT DATA BOUNDARIES, MANDATORY RESPONSE RULES, CRITICAL ANTI-HALLUCINATION RULE, and ABSOLUTE RULE against "analysis shows/notes" phrasing with banned metrics.
  - **RAG Content Validation Rule**: TIBER does NOT use "Football Fact Snippets" as evidence for matchup analysis, defensive strength, or predicting outcomes. Only RAG content explicitly tagged as DATA can be cited as evidence. Untagged snippets are treated as narrative context only, never as actionable statistics. This prevents TIBER from citing unverified or narrative content as factual data.
  - **NFLfastR Data Availability**: 2025 play-by-play data currently unavailable (HTTP 404 from nflverse). Only 2024 historical data accessible. All NFLfastR-dependent metrics (snap counts, YPC trends, efficiency stats) marked as `queryable: false` in jargon mapping. Validation endpoint returns data unavailability status. When season data becomes available, jargon mapping can be updated to enable queries.
  - **Regression Test Suite**: 13 automated tests covering VORP citation, source leakage, elite recognition, season awareness, conversational focus, player detection, hallucination prevention (banned metrics, fake stats, data boundaries, ranking corrections), and tier classification. Achieved 92.3% pass rate (12/13 passing) before external Gemini API outage. Tests validate refusal of snap share, YPC, fake stat rejection, multi-metric boundary consistency, and fake ranking corrections. Run via `tsx server/tests/rag-regression-tests.ts`.
  - **Ancient Observer Personality**: TIBER identity evolution with dual meaning (technical acronym + philosophical metaphor), 80/15/5 voice modulation for varying interaction depths, and a mystery element.
  - **2024 Baseline Training Data Integration**: Comprehensive historical training dataset (127 chunks total) teaching TIBER evaluation frameworks while maintaining strict year separation. Components: (1) 94 player stat profiles from 2024 season (10 QB + 84 RB/WR/TE) with production metrics (rush/receiving yards, TDs, YPC, efficiency); (2) 30 historical usage patterns (2017-2024) teaching snap share, target share, touches, route participation, and red zone correlations with breakouts/regressions; (3) 3 elite position baselines (RB/WR/TE) defining top-tier benchmarks. **Purpose**: Teach "what elite production looks like" using historical data to help users recognize patterns in current season. **Temporal Framing Rules**: 2024 data always framed as historical ("In 2024...", "had", "was", "finished") never as current season. **Dual-Context Pattern**: Seamlessly combines 2024 historical baseline with 2025 VORP data (e.g., "In 2024 Barkley had 2005 rush yards, 13 TDs, 5.8 YPC (RB1). Current 2025 season he's RB5 with 16.7 PPG."). **Year Separation**: Absolute boundary enforced - 2024 = teaching baseline (past tense), 2025 = current season (VORP/rankings/PPG only). System prompt includes mandatory temporal framing section preventing confusion between years. Historical patterns teach evaluation concepts (snap share thresholds, target distributions) without hallucinating 2025 metrics. **Retrieval Optimization**: Hybrid search with intent detection (7 regex patterns) boosts 2024 baseline chunks when queries mention "2024", "last season", "elite production", etc. Metadata filtering uses season='2024' OR type='historical_pattern' to prioritize relevant teaching data. Season metadata normalized to strings for consistent PostgreSQL JSONB filtering. Data loaded via embeddings into chunks table for vector retrieval. Validated via dual-context integration tests confirming 80% pass rate with proper temporal framing and accurate citation.

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