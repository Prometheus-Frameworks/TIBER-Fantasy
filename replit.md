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
- **Unified Player Hub (UPH)**: Centralized data architecture for player information.
- **Player Evaluation**: "Player Compass" for dynamic profiles, "OTC Consensus" for community rankings, and a Madden-style 1-99 OVR (Overall Rating) system.
- **AI & Analytics**: "Competence Mode" for AI advice, Adaptive Consensus Engine, and DeepSeek + Compass Fusion System for predictive analysis.
- **Rankings & VORP**: Comprehensive Rankings Hub, enhanced VORP with dynasty and age adjustments, and an Enhanced ECR Comparison System.
- **Player Analysis**: Dedicated Rookie Evaluation System, Target Competition Analysis (TCIP), Player Usage Context Module, and Stud Detection Module.
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
- **RAG Chat System**: Integrates Google Gemini AI for embeddings and chat generation, providing teaching-focused responses with source citations.
  - **Context-Aware Personality**: Natural, friendly tone for casual greetings; full Scout-GM voice for fantasy questions.
  - **League Context Integration**: Pre-fetches complete roster data from `league_context` table, builds structured snapshot, and prepends to context for reliable roster awareness.
  - **Smart Greeting Detection**: Distinguishes true small-talk from fantasy questions.
  - **Investigative Conversation Framework**: 4-phase approach (Acknowledge roster, Ask priorities, Provide tailored recommendations, Invite follow-up).
  - **Metadata-First Extraction**: Uses `metadata.playerName` from Sleeper sync for reliable roster parsing, with regex fallback for legacy data.
  - **VORP Integration**: Automatically detects player mentions in chat messages and calculates real-time VORP (Value Over Replacement Player) from 2024 Sleeper game logs. Provides objective performance data (position rank, total points, PPG, VORP score, tier classification) to complement narrative analysis. Supports QB/RB/WR/TE with replacement levels at QB12, RB24, WR36, TE12 for 12-team PPR leagues.

## Database Schema

**Core Tables:**
- `chunks` - TIBER narratives with 768-dim vector embeddings (Gemini)
  - id, content, embedding (vector), metadata (JSONB), created_at
- `leagues` - User fantasy leagues  
  - id (UUID), user_id, league_name, platform, league_id_external, settings (JSONB), created_at, updated_at
- `league_context` - Vector-searchable league events (trades, roster moves)
  - id, league_id (FK), content, embedding (vector), metadata (JSONB), created_at
- `chat_sessions` - User conversation sessions
  - id (UUID), user_level, league_id (FK, nullable), created_at, updated_at
- `chat_messages` - Chat history
  - id, session_id (FK), role ('user'|'assistant'), content, created_at

**Extensions:**
- pgvector 0.8.0 - Vector similarity search for semantic retrieval

## Deployment

**Production Environment:**
- **URL**: https://tiber-fantasy.onrender.com (API-only, no frontend)
- **Database**: PostgreSQL 17 on Render with pgvector 0.8.0 enabled
- **Web Service**: Node.js on Render (auto-deploys from GitHub main branch)
- **Build Pipeline**: `pip install -r requirements.txt && npm ci && npm run build`
- **Python Dependencies**: Installed during build (nfl_data_py, pandas, numpy, etc.)

**Development Environment:**
- **Frontend**: Replit (mobile/desktop preview)
- **Database**: PostgreSQL with pgvector (local or Render)
- **Hot Reload**: Vite dev server

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

## Known Issues & Roadmap

**Active Development:**
- League context retrieval optimization (ensuring roster data surfaces in chat responses)
- Conversational flow refinement (multi-turn investigative dialogue)
- Sidebar feature audit (validating which features are functional vs placeholders)

**Planned Features:**
- Scale RAG narratives from 6 to 50-100+ player analyses
- Sleeper auto-sync scheduling (weekly roster/transaction updates)
- User authentication system
- Production frontend deployment strategy

**Technical Debt:**
- Legacy module deprecation audit (20+ analytics modules, some unused)
- Automated testing framework
- API endpoint comprehensive documentation
- Performance optimization for vector search at scale