# Tiber Fantasy

## Overview
Tiber Fantasy is a free, open-source NFL fantasy football analytics dashboard. Its purpose is to provide real-time NFL data, Madden-style OVR player ratings, Defense vs Position matchups, and Strength of Schedule analytics using EPA metrics, empowering users with superior decision-making tools without paywalls. Future ambitions include a "Player Compass" for dynamic player evaluation, an "TIBER Consensus" for community-driven rankings, and advanced AI insights via the TIBER Brain OS.

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
- **Player Identity**: Unified resolution across major fantasy platforms via Identity Bridge.
  - **GSIS ID**: Primary NFL player identifier (format: `00-XXXXXXX`), stored in dedicated `gsis_id` column with unique partial index.
  - **activeSkillPlayers Definition**: 
    ```sql
    SELECT COUNT(*) FROM player_identity_map
    WHERE is_active = true AND position IN ('QB', 'RB', 'WR', 'TE')
    ```
    - "Active" = `is_active = true` (excludes merged/deactivated players where `merged_into IS NOT NULL`)
    - Positions = skill positions only (QB, RB, WR, TE) - no kickers, defense, or linemen
  - **Roster Bridge vs Global Identity**: Roster bridge coverage (Sleeper roster players mapped to canonical IDs) is primary for Ownership features. Global identity coverage is informational only - many practice squad/reserve players have no Sleeper presence.
- **Data Quality**: Multi-dimensional validation, data lineage, and confidence scoring.

**UI/UX Decisions (v2 Light Mode Redesign - Feb 2026)**:
- Light mode: White background (`#ffffff`), `#fafafa` secondary, `#f4f4f4` tertiary. Ember accent (`#e2640d`).
- Three-font system: Instrument Sans (UI), JetBrains Mono (data/code), Newsreader (editorial).
- Fixed 220px sidebar (`TiberLayout.tsx`) with nav sections (Core, Intelligence, System), Promethean Charter box, breathing ember dot logo.
- CSS custom properties for all colors/spacing. Legacy dark→light CSS overrides in `index.css` transform existing dark-themed pages.
- **Homepage** (`Dashboard.tsx`): Hero section, sticky position-filter toolbar (WR/RB/QB/TE), status cards row, FORGE-powered player data table with tier badges and trend bars, two-column insights + chat preview, connected services footer.
- **Universal Current Week System**: `/api/system/current-week` endpoint for real-time NFL week detection, used by frontend components.

**Technical Implementations & Feature Specifications:**
- **Unified Player Hub (UPH)**: Centralizes player data, "Player Compass" profiles, "TIBER Consensus" rankings, and Madden-style OVR.
- **AI & Analytics**: "Competence Mode" AI, Adaptive Consensus Engine, DeepSeek + Compass Fusion System, RAG Chat System using Google Gemini AI, Tiber Memory (FANTASY vs GENERAL pools), and Tiber Voice (Insight/Analyst modes with 5-tier Truth Hierarchy).
- **FORGE (Football-Oriented Recursive Grading Engine)**: Core player evaluation system providing unified Alpha scores (0-100) for skill positions. Full FORGE acronym implementation:
    - **F (Football Lens)**: `forgeFootballLens.ts` - Detects football-sense issues (TD spikes, volume/efficiency mismatches, pillar polarization). Applies bounded pillar adjustments when warranted. Returns issues with severity levels (info/warn/block).
    - **O (Orientation Modes)**: ViewMode support for `redraft`, `dynasty`, `bestball`. Dynasty emphasizes stability (+30%), bestball emphasizes efficiency (+20%). Weight normalization ensures totals sum to 1.0.
    - **R (Recursion)**: Two-pass scoring with prior alpha blending (80%/20%) and momentum adjustments (±3 max).
    - **G (Grading)**: Position-specific weights (WR: V=0.43, E=0.37, T=0.05, S=0.15), tier mapping (T1-T5).
    - **E (Engine)**: `forgeEngine.ts` - Fetches context from DB (role banks, team_offensive_context, sos_scores), builds metric lookup, computes 4 pillar scores (volume, efficiency, teamContext, stability).
    - **FORGE E+G Architecture (v2)**: Modular architecture separating Engine (data/metrics) from Grading (scoring/tiers).
        - **Endpoints**: `/api/forge/eg/batch?position=WR&mode=dynasty` and `/api/forge/eg/player/:playerId?position=WR&mode=bestball`
        - **Response includes**: alpha, tier, pillars, issues (from Football Lens), debug info
    - **FORGE Workbench** (`/forge-workbench`): Interactive player query tool for exploring FORGE engine internals.
        - **Endpoints**: `GET /api/forge/workbench/search?q=<name>` (player search), `GET /api/forge/workbench/player/:playerId?position=WR` (full engine query)
        - **Features**: Player search with autocomplete, full pillar breakdown (Volume, Efficiency, Team Context, Stability), adjustable weight sliders with live Alpha recalculation, mode toggle (Redraft/Dynasty/BestBall), expandable pillar metric details, QB Context card, Football Lens issues, raw metrics inspector
        - **Client-side**: Weight adjustments recalculate Alpha instantly without re-querying the API
    - **FORGE Data Pipeline**: Ingests data from Role Banks, Datadive (enriched metrics), and Legacy Tables. Uses a Context Fetcher, position-specific Feature Builders, and a Grading Engine (`alphaEngine.ts`) to calculate Alpha scores, sub-scores (Volume, Efficiency, Stability, Context), trajectory, and confidence. A Recursive Engine (`recursiveAlphaEngine.ts`) applies stability adjustments based on previous Alpha, surprise, volatility, and momentum.
    - **FORGE Output Contract**: Every FORGE evaluation provides `player_id`, `position`, `alpha`, `tiber_tier`, `trajectory`, `confidence`, `role_tag`, `last_updated_week`, `season`.
    - **Recursion v1**: Stateful two-pass scoring with formulas for `expected_alpha` and `surprise`.
    - **Tiber Tiers (v1.1)**: Position-specific tier thresholds recalibrated for cumulative season data:
        - QB: T1≥70, T2≥55, T3≥42, T4≥32
        - RB: T1≥78, T2≥68, T3≥55, T4≥42
        - WR: T1≥82, T2≥72, T3≥58, T4≥45
        - TE: T1≥82, T2≥70, T3≥55, T4≥42
    - **FORGE v1.1 Multi-Week Aggregation**: Context fetcher aggregates data across ALL official snapshots (weeks 1-N) instead of single-week snapshots, eliminating outlier amplification and ensuring season-grounded Alpha scores.
    - **Next Man Up**: Tracks opportunity shifts for players replacing injured starters.
    - **FORGE SoS**: Position-specific strength of schedule analysis.
    - **QB Context v1**: Team-to-QB mapping system providing QB-aware context for skill positions.
        - **Table**: `qb_context_2025` stores QB scores (skill, redraft, dynasty, stability, durability) per team.
        - **Population**: `POST /api/forge/admin/qb-context/populate` computes QB scores from `qb_role_bank` + `weekly_stats`.
        - **Blending Formulas**:
            - Redraft mode: `effectiveTeamContext = 0.60 * shortTermContext + 0.40 * qbRedraftScore`
            - Dynasty mode: `effectiveDynastyContext = 0.40 * dynastyContext + 0.60 * qbDynastyScore`
        - **Files**: `qbContextPopulator.ts` (scoring), `forgeEngine.ts` (fetch), `forgeGrading.ts` (blending).
- **Tiber Tiers Page** (`/tiers`): User-facing FORGE-powered fantasy rankings with:
    - Position filter (WR, RB, TE, QB)
    - User-adjustable weight sliders (Volume, Efficiency, Stability, Context) with live recalculation
    - Preset system: Balanced, Workhorse, Efficiency, High Floor, Upside
    - Season/Weekly toggle for different ranking views
    - **Week Range Filtering (v1.2)**: Filter rankings by specific weeks (Full Season, Last 4 Weeks, Last 6 Weeks, Weeks 1-6, Weeks 7-12, Weeks 13+). Database-level filtering using SQL WHERE clauses for performance. API accepts `startWeek` and `endWeek` query parameters.
    - **FORGE E+G v2 Integration**: Uses `/api/forge/eg/batch` with full E→F→O→G pipeline.
    - **Mode Toggle (v2)**: Redraft (balanced), Dynasty (+30% stability), BestBall (+20% efficiency) mode selection with real-time alpha recalculation.
    - **Football Lens Issue Badges**: Players flagged by Football Lens display alert badges with severity-coded colors (info=blue, warn=amber, block=red) and hover tooltips explaining detected issues.
    - Tier badges (T1-T5) with position-specific thresholds
    - Alpha scores recalculated in real-time based on user-selected weights and orientation mode
- **Tiber Data Lab (Operation DataDive)** (`/tiber-data-lab`): Snapshot-based NFL data spine for reproducible analytics, focused on NFL Mode (raw football metrics only). Fantasy analytics moved to Tiber Tiers page.
- **xFPTS v2 (Expected Fantasy Points v2)**: Context-aware expected fantasy points system.
- **Position-Aware Enrichment**: Full position-specific enrichment layer with 2025 NFL metrics.
- **EPA Analytics**: Advanced efficiency metrics from nfl-data-py.
- **Defense vs Position (DvP) Matchup System**: Calculates fantasy points allowed by defenses.
- **Data Integration & Sync**: Sleeper Sync, Canonical Player Pool, Roster Shift Listener, Roster Sync, and NFL Schedule Sync Infrastructure.
- **Live Data Processing**: Live Data Integration Pipeline with multi-source data capture and a Hot List Player Extraction System.
- **Strategy Tab**: Provides Start/Sit recommendations, Waiver Wire Targets, and SOS Rankings.
- **Weekly Takes System**: Quick matchup insights.
- **Role Banks (WR, RB, TE, QB)**: Season-level analytical classification systems.
- **DST Streamer**: Weekly defense/special teams streaming recommendations based on defense strength, opponent vulnerability, and matchup boost, with a transparent calculation breakdown.
- **Admin API Lexicon**: Developer tool for browsing and testing Forge/Tiber API endpoints.
- **TIBER Philosophy**: The tactical interface translating FORGE insights into actionable intelligence, identifying breakouts, measuring efficiency, and using recursion for evolving narratives.

**LLM Gateway (`server/llm/`)**:
- Provider-agnostic `callLLM()` entry point with automatic fallback across 4 providers.
- **Active Providers**: OpenRouter (Replit AI Integration), OpenAI (Replit AI Integration), Anthropic (Replit AI Integration), Google Gemini (own API key).
- **Task-Based Routing**: 9 task types (router_intent, code_patch, code_review, research, data_qa, player_analysis, summarize, general, x_intelligence) with 3 priority tiers (speed/balanced/accuracy).
- **X Intelligence Scanner** (`server/services/xIntelligenceScanner.ts`): Grok-powered X/Twitter scanning for fantasy football trends, injuries, breakouts, and consensus analysis. Uses `x_intelligence` task type routed to Grok models (grok-4.1-fast, grok-4-fast, grok-4, grok-3) via OpenRouter.
  - **Scan Types**: `trending`, `injuries`, `breakouts`, `consensus`, `full` (comprehensive).
  - **Endpoints**: `POST /api/intel/x-scan` (trigger scan), `GET /api/intel/x-feed` (read filtered intel), `DELETE /api/intel/x-feed` (clear Grok intel).
  - **Output**: Structured entries with player, position, team, category, signal strength, headline, detail, fantasy impact, and dynasty relevance.
- **Fallback Chain**: Tries models in tier order, skips unavailable providers, retries on timeout/rate-limit.
- **Structured Logging**: JSON logs with requestId, provider, model, latency, token counts.
- **Files**: `types.ts` (interfaces), `config.ts` (routing table + availability), `logger.ts`, `fallback.ts` (chain logic), `providers/` (openrouter, gemini, openai, anthropic wrappers), `index.ts` (entry point).

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