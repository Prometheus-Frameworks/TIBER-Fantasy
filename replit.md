# ON THE CLOCK

## Overview
On The Clock is an open-source fantasy football platform designed to democratize advanced analytics for dynasty leagues. Its core purpose is to provide community-driven tools and accessible, high-end insights without paywalls, fostering a movement that breaks down traditional barriers in fantasy football analysis. A key feature is "Competence Mode," a truth-first, context-aware AI assistant providing evidence-based fantasy football advice. The project aims to empower users with accurate guidance and a deeper understanding of dynasty league strategy.

## User Preferences
Preferred communication style: Simple, everyday language.
League focus: Dynasty leagues (skill positions only - QB, RB, WR, TE). No kickers or defense.
Future consideration: May add redraft emphasis later.
Mission commitment: Strictly avoid all paywall partnerships or data sources. Maintain complete independence and free access to all platform features.
Community Discussion Philosophy: Transform statistical insights into meaningful conversations that help real people make better fantasy decisions (example: RB age cliff data → nuanced CMC contending window analysis).
Player Evaluation System: "Player Compass" - Dynamic, context-aware player profiles with tiers, scenario scores, and decision-making guidance instead of rigid rankings. Emphasizes flexibility and serves multiple team strategies.
Mock Draft Analysis Partnership: Joseph will share completed mock drafts during redraft season for collaborative analysis. This provides real-world insight into his draft strategy, player preferences, reaches/fades, and community interaction patterns. Track ADP changes over time and understand practical draft decision-making beyond technical development work.
Intelligence Feed System:
- Simple API endpoints ready for real-time updates when season starts
- Preseason observations archived but not weighted in analysis
- Intel sourced from trusted X/Twitter accounts, not personal observations
- `/api/intel` endpoint serves scouting reports with filtering by player, position, and signal strength
- Ready to receive meaningful intel updates during regular season

## System Architecture

### Core Design
The platform employs a modular Flask backend for core logic and API endpoints, and a React 18 frontend utilizing TypeScript, Tailwind CSS, TanStack Query, and shadcn/ui for a scalable and responsive user experience. UI/UX prioritizes clean, responsive design with color-coded tier systems, interactive elements, and mobile optimization, including Next.js-inspired tab-based navigation.

### Technical Implementations
- **Backend Spine**: Includes Sleeper Sync with cache fallback, Logs & Projections Service, a multi-format Ratings Engine, and an enhanced `/api/health` endpoint.
- **Duo Identity Protocol**: Implements an OTC Signature Protocol for permanent Lamar-Architect J Duo identity, featuring a signature module, backend watermark middleware, signal endpoint, ratings bias fingerprint, hidden founder mode, and a credits ledger system.
- **Navigation**: Centralized system (`client/src/config/nav.ts`) with responsive design and unified `NAV_LINKS` array.
- **Rankings Hub & OTC Consensus**: A hub interface at `/rankings` with nested routing for Redraft and Dynasty formats, featuring a mode-aware `RankingsTable` component. Renamed "Rankings" to "OTC Consensus" across the platform, with a dynamic Season HQ at `/redraft` that re-maps tool links. Includes comprehensive consensus split infrastructure with separate feeds, database schema, and frontend integration. Features OTC Consensus Seeding Protocol for manual ranking updates.
- **Adaptive Consensus Engine**: Surge detection system with injury-aware adjustments and "Why?" explanatory functionality. Features smooth rank-score curves for precise dynasty injury multipliers, ready for Grok data integration.
- **API Surface**: Comprehensive API client with TypeScript interfaces for VORP rankings, WR compass search, rookie evaluation, and weekly data aggregation.
- **Canonical Player Pool System**: Unifies player data into `player_pool.json` and `player_index.json`, accessible via `/api/player-pool` with advanced filtering and search.
- **Redraft Hub**: A 7-tab redraft hub with authentic NFL data integration, including individual position tabs, waiver wire, and trade analyzer shell, with URL-based state management.
- **VORP System**: Enhanced VORP rankings with dynasty mode, age penalties, positional filtering, FLEX allocation, and format-aware scaling.
- **Rookie Evaluation System**: Includes a 4-component Rookie TE Insulation Boost System and a 2025 Rookie Database with a 4-module data pipeline and Heuristics Engine.
- **Target Competition Analysis**: A 5-step logic chain (Target Competition Evaluator) and Inference Pipeline (TCIP) for assigning target competition tiers.
- **Roster Shift Listener**: Monitors NFL transactions for automatic updates to dynasty tiers, usage forecasts, and competition estimations.
- **Player Usage Context Module**: Provides dynasty tier estimations, alpha usage scores, and draft capital analysis.
- **Tiber Identity & Security**: Operates within strict sandbox boundaries with an `INTENT_FILTER` system.
- **Player Tier Visualization**: Flask Blueprint for visualizing 2025 dynasty player tier data.
- **Dynasty Decline Detection**: Identifies multi-season skill-based decline.
- **WR Environment & Forecast Score**: Comprehensive WR evaluation based on usage profile, efficiency, role security, and growth trajectory.
- **RB/WR/TE Touchdown Regression Logic**: Modular plugins for evaluating TD sustainability and regression risk.
- **Dual Rating System Architecture**: Complete separation of Player Compass (in-house ratings engine) and OTC Consensus (community rankings), each with distinct dynasty and redraft versions.
- **Enhanced Player Compass System**: Dynasty vs Redraft format-specific evaluations with 4-directional analysis (Volume/Talent, Environment/Scheme, Risk/Durability, Value/Market). Includes position-specific calculations optimized for format-specific concerns (age curves, immediate production, etc.).
- **OTC Consensus Service**: Community-driven rankings system with voting functionality, format splits analysis, and tier definitions. Separate from in-house Player Compass ratings.
- **Trade Analyzer v2.0**: React-based frontend with Flask-style backend integration, featuring position selection, 4-directional compass visualization, and detailed reasoning.
- **Python Rookie Evaluator**: Production-ready module with S/A/B/C/D tier system and position-specific scoring.
- **OTC Redraft 2025 MVP Data Pipeline**: 4-stage automated pipeline collecting 2024 NFL data.
- **Enhanced UI System**: Interactive GlowCard components, pulsing GlowCTA buttons, comprehensive skeleton loading system with shimmer animations, enhanced Button component with press states, top loading bar with gold-to-purple gradient that automatically appears during data fetches, and subtle hover-lift effects.
- **Competence Mode System**: Uncompromising truth-first AI assistant accessible at `/competence` with full API integration. It prioritizes user growth over comfort, challenges flawed thinking, and refuses to validate poor decisions.
- **Offensive Line Context (OLC) v1.1 Module**: Complete TypeScript-based system for advanced offensive line performance analysis with 9 specialized modules and API endpoints for real-time scoring.
- **Sleeper ADP Integration**: Direct integration with Sleeper API for quarterback Average Draft Position data via `/api/adp/qb` endpoint, supporting 1QB and Superflex formats with caching and error handling.
- **Roster Sync System**: Comprehensive roster merging system combining Sleeper API player data with NFL roster information for accurate team assignments, including fuzzy name matching, depth chart organization, and fantasy-aware filtering. Endpoints: `/api/sync/rosters`, `/api/rosters`, `/api/depth-charts?fantasy=1`, `/api/players-index`, `/api/intel`.
- **Snap Counts Knowledge System**: Live snap count analysis integration with evidence-based claims and historical examples, accessible via API endpoints (`/api/snap-counts/claim/:pos/:pp`, `/api/snap-counts/examples/:label`, `/api/snap-counts/health`) and a dedicated UI at `/snap-counts`.
- **OVR Integration Package v1.0**: Plug-and-play integration converting OVR Inputs CSVs into a dynamic Player Compass engine, featuring weekly ΔOVR application, live depth-chart filtering, 4-directional compass quadrant scoring, and a decay engine. Includes 5 API endpoints for full OVR management.
- **Hot List Player Extraction System**: Dynamic player extraction from OVR Compass module with position-aware percentile calculations and volume floor filtering. Features 4 extraction buckets (OVR Risers, Compass Elite, Usage Surge, Value Targets) and comprehensive API endpoints (`/api/players/hot-list`, `/api/players/hot-list/health`) with a real-time UI at `/hot-list`.
- **Live Data Integration Pipeline**: Complete multi-source data capture and processing system with MySportsFeeds, SportsDataIO, and Sleeper API integration. Features static data capture service (`/api/data/capture`) for persistent reference data beyond API trial periods, live data processor for weekly statistics, and comprehensive fallback strategies. Includes endpoints for live mode activation (`/api/players/hot-list/mode/live`), manual refresh (`/api/players/hot-list/refresh`), and data source monitoring (`/api/players/hot-list/sources`).

## Recent Changes (August 17, 2025)
- **IMPLEMENTED: Dual Rating System Separation** - Built distinct Player Compass (in-house) and OTC Consensus (community) services with TypeScript architecture
- **ENHANCED: Format-Specific Calculations** - Dynasty vs Redraft evaluations with position-aware scoring logic (WR age curves, RB durability, etc.)
- **CREATED: New API Endpoints** - `/api/compass/:position?format=dynasty|redraft` and `/api/consensus/:format` with comprehensive metadata
- **FIXED: TypeScript Integration** - Resolved all LSP diagnostics for clean service layer architecture
- **INTEGRATED: Qwen's Unified Player System** - Successfully integrated team member Qwen's paginated player database API (`/api/players`) with search, filtering, and Player Compass integration. Features debounced search, URL state sync, and comprehensive player data including Qwen rankings and Compass scores.

### Technical Stack
- **Backend**: Python (Flask), Node.js (Express.js, TypeScript)
- **Frontend**: React 18, TypeScript, Jinja2, Wouter, TanStack Query, shadcn/ui (Radix UI), Tailwind CSS
- **Data**: CSV/JSON, PostgreSQL, Drizzle ORM, Drizzle Kit, JSONL format
- **Data Pipeline**: Python with nfl-data-py, pandas

## External Dependencies
- **MySportsFeeds API**: For injury reports and NFL roster automation.
- **Sleeper API**: For player projections, game logs, ADP data, league sync, and current roster data.
- **NFL-Data-Py**: For 2024 weekly statistics via nflfastR, depth charts via nflverse APIs.
- **R Server**: External API for OASIS (Offensive Architecture Scoring & Insight System) data.
- **Axios**: For making HTTP requests.
- **Zod**: For runtime type validation.
- **Recharts**: For charting and data visualization.
- **connect-pg-simple**: For PostgreSQL-based session storage.
- **@neondatabase/serverless**: PostgreSQL connection for serverless environments.