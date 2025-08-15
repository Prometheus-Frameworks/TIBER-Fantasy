# ON THE CLOCK

## Overview
On The Clock is an open-source fantasy football platform focused on democratizing advanced analytics for dynasty leagues. Its purpose is to provide community-driven tools and accessible high-end insights without paywalls. The project aims to foster a community where shared knowledge transforms fantasy football into a movement, breaking down traditional barriers between amateur and elite analysis. The platform now features "Competence Mode" - a truth-first, context-aware AI assistant that provides evidence-based fantasy football advice, prioritizing accurate guidance over agreement and user growth over ego protection.

## User Preferences
Preferred communication style: Simple, everyday language.
League focus: Dynasty leagues (skill positions only - QB, RB, WR, TE). No kickers or defense.
Future consideration: May add redraft emphasis later.
Mission commitment: Strictly avoid all paywall partnerships or data sources. Maintain complete independence and free access to all platform features.
Community Discussion Philosophy: Transform statistical insights into meaningful conversations that help real people make better fantasy decisions (example: RB age cliff data → nuanced CMC contending window analysis).
Player Evaluation System: "Player Compass" - Dynamic, context-aware player profiles with tiers, scenario scores, and decision-making guidance instead of rigid rankings. Emphasizes flexibility and serves multiple team strategies.
Mock Draft Analysis Partnership: Joseph will share completed mock drafts during redraft season for collaborative analysis. This provides real-world insight into his draft strategy, player preferences, reaches/fades, and community interaction patterns. Track ADP changes over time and understand practical draft decision-making beyond technical development work.

**LIVE DRAFT ANALYSIS COMPLETE**: Joseph completed his draft with Team H4MMER, demonstrating key insight: "Real drafts tend to go a lot differently than mock drafts." Results show strategic flexibility - abandoned turn strategy (1.10-1.12) to take Saquon at 1.4, hit conviction target McConkey at 3.4, and completely pivoted QB strategy. Validates need for tactical adaptation over rigid pre-draft plans.

Joseph's Draft Philosophy & Strategy:
- Prefers late draft positions (1.10-1.12) for "two first-round caliber players at the turn"
- PPR format specialist with sophisticated positional value analysis
- Identifies tier cliffs and pivots strategy based on draft flow
- "Won't leave without" approach to 10-11 conviction players including Hunter, Maye, McConkey, Hampton
- Smart handcuff targeting for volume upside (Mason, Davis, Charbonnet)
- Avoids overpriced players with TD regression risk (Terry McLaurin example)
- Film scouting and early prospect identification (Matthew Golden story vs Mike)

Intelligence Feed System:
- Simple API endpoints ready for real-time updates when season starts
- Preseason observations archived but not weighted in analysis (Week 1 preseason intel stored in data/preseason_intel_week1.json)
- Intel sourced from trusted X/Twitter accounts, not personal observations
- `/api/intel` endpoint serves scouting reports with filtering by player, position, and signal strength
- Ready to receive meaningful intel updates during regular season
- Current Week 1 preseason intel includes: Travis Hunter slot work, RJ Harvey as DEN 1A, Tony Pollard workhorse role, Jerome Ford starting 1A, Josh Reynolds NYJ WR2, Rico Dowdle CAR involvement, and LAC TE room concerns

## System Architecture

### Core Design
The platform uses a modular Flask backend for core logic and API endpoints, and a React 18 frontend with TypeScript, Tailwind CSS, TanStack Query, and shadcn/ui for a scalable and responsive user experience.

### Technical Implementations
- **Backend Spine**: Includes Sleeper Sync with cache fallback, Logs & Projections Service, a multi-format Ratings Engine v1, and an enhanced `/api/health` endpoint.
- **Duo Identity Protocol**: Implements an OTC Signature Protocol v1 for permanent Lamar-Architect J Duo identity, featuring a signature module, backend watermark middleware, signal endpoint, ratings bias fingerprint, hidden founder mode, and a credits ledger system.
- **Navigation**: Centralized navigation system (`client/src/config/nav.ts`) with responsive design and unified `NAV_LINKS` array.
- **Rankings Hub**: A clean hub interface at `/rankings` with nested routing for Redraft and Dynasty formats, featuring a mode-aware `RankingsTable` component.
- **Season HQ & OTC Consensus**: Renamed "Rankings" to "OTC Consensus" across the platform, with a dynamic Season HQ at `/redraft` that re-maps tool links between redraft and dynasty modes. Implemented comprehensive consensus split infrastructure with separate dynasty/redraft feeds, database schema (consensus_board, consensus_meta tables), backend API endpoints, and frontend integration. Features OTC Consensus Seeding Protocol v1 with shorthand syntax for manual ranking updates (e.g., "OTC consensus RB4 : Omarion Hampton") accessible at `/consensus/seed`.
- **Adaptive Consensus Engine**: Surge detection system with injury-aware adjustments and "Why?" explanatory functionality. Features smooth rank-score curves (`server/consensus/curves.ts`) for precise dynasty injury multipliers, ready for Grok data integration. Includes `/adaptive-consensus-demo` and `/curves-demo` testing interfaces.
- **API Surface**: Comprehensive API client with TypeScript interfaces for various endpoints including VORP rankings, WR compass search, rookie evaluation, and weekly data aggregation.
- **Canonical Player Pool System**: Unifies player data from multiple sources into `player_pool.json` and `player_index.json`, accessible via `/api/player-pool` with advanced filtering and search.
- **Redraft Hub**: A 7-tab redraft hub with authentic NFL data integration, including individual position tabs, waiver wire, and trade analyzer shell, with URL-based state management.
- **VORP System**: Enhanced VORP rankings with dynasty mode, age penalties, positional filtering, FLEX allocation, and format-aware scaling.
- **Rookie Evaluation System**: 4-component Rookie TE Insulation Boost System and a 2025 Rookie Database with a 4-module data pipeline and Heuristics Engine.
- **Target Competition Analysis**: A 5-step logic chain (Target Competition Evaluator) and Inference Pipeline (TCIP) for assigning target competition tiers.
- **Roster Shift Listener**: Monitors NFL transactions for automatic updates to dynasty tiers, usage forecasts, and competition estimations.
- **Player Usage Context Module**: Provides dynasty tier estimations, alpha usage scores, and draft capital analysis.
- **Tiber Identity & Security**: Operates within strict sandbox boundaries with an `INTENT_FILTER` system.
- **Player Tier Visualization**: Flask Blueprint for visualizing 2025 dynasty player tier data.
- **Dynasty Decline Detection**: Identifies multi-season skill-based decline.
- **WR Environment & Forecast Score**: Comprehensive WR evaluation based on usage profile, efficiency, role security, and growth trajectory.
- **RB/WR/TE Touchdown Regression Logic**: Modular plugins for evaluating TD sustainability and regression risk.
- **Player Compass System**: Implements a 4-directional evaluation (Volume/Talent, Scheme/Offensive Environment, Age/Injury Risk, Market Efficiency/Dynasty Value) for WR, RB, and TE.
- **Trade Analyzer v2.0**: React-based frontend with Flask-style backend integration, featuring position selection, 4-directional compass visualization, and detailed reasoning.
- **Python Rookie Evaluator**: Production-ready module with S/A/B/C/D tier system and position-specific scoring.
- **OTC Redraft 2025 MVP Data Pipeline**: 4-stage automated pipeline collecting 2024 NFL data from nflfastR and nflverse APIs.
- **Enhanced UI System**: Interactive GlowCard components, pulsing GlowCTA buttons, comprehensive skeleton loading system with shimmer animations, enhanced Button component with press states, top loading bar with gold-to-purple gradient that automatically appears during data fetches, and subtle hover-lift effects applied across interactive cards and table rows for polished user interactions.
- **Competence Mode System**: Uncompromising truth-first AI assistant that prioritizes user growth over comfort. Challenges flawed thinking, provides uncomfortable questions, and refuses to validate poor decisions. Features direct feedback like "Stop asking for validation" and "Your gut feelings about players are probably wrong." Operates on principle that fantasy success requires precision and honesty, not hand-holding. Accessible at `/competence` with full API integration.
- **Offensive Line Context (OLC) v1.1 Module**: Complete TypeScript-based system for advanced offensive line performance analysis. Features 9 specialized modules including cohesion scoring algorithms, position adjusters, opponent-aware matchup modifiers, data normalization with rolling weights, injury penalty system, and comprehensive logging. Includes API endpoints at `/api/olc/team/:teamId`, `/api/olc/player/:playerId`, `/api/olc/rebuild`, and `/api/olc/health` for real-time offensive line scoring functionality. Supports weekly and seasonal OLC score calculations with caching, batch processing, and health monitoring.
- **Sleeper ADP Integration**: Direct integration with Sleeper API for quarterback Average Draft Position data. Features `/api/adp/qb` endpoint with support for both 1QB and Superflex formats, 6-hour caching with TTL, and comprehensive error handling. Built using official Sleeper player database with mock ADP calculations ready for real aggregation when draft data becomes available. Includes proper TypeScript interfaces and tier context system for downstream analysis.
- **Roster Sync System**: Comprehensive roster merging system that combines Sleeper API player data (11,396 players) with NFL roster information for accurate team assignments. Implements fuzzy name matching, depth chart organization, deterministic player IDs, and manual depth chart corrections for known inaccuracies (e.g., Trey Benson correctly listed as ARI RB2, not RB7). Solves stale team assignment issues (e.g., Hunter correctly shows JAX vs outdated COL). Features skill position filtering (QB/RB/WR/TE only), position depth limits (WR=6, RB=3, TE=4, QB=4) focused on fantasy-relevant players, and fantasy-aware filtering with relevance scoring system including rookie allowlist for premium prospects. Includes Research & Analysis interface with tabbed depth charts, intelligence feed system, and user disclaimer about filtered depth display. Endpoints: `/api/sync/rosters`, `/api/rosters`, `/api/depth-charts?fantasy=1`, `/api/players-index`, `/api/intel`.
- **Snap Counts Knowledge System**: Live snap count analysis integration with evidence-based claims and historical examples. Features `/api/snap-counts/claim/:pos/:pp` for position-specific predictions, `/api/snap-counts/examples/:label` for HIT/MISS examples with context, and `/api/snap-counts/health` for knowledge base status. Integrates with external knowledge base at localhost:8000 for snap-counts-v1 ArticlePack data. Includes dedicated UI at `/snap-counts` with position selector, percentage input, real-time claims display, and tabbed HIT/MISS examples with show all/less functionality. Supports WR, RB, TE analysis with half-PPR scoring format and confidence ratings.

### UI/UX Decisions
Clean, responsive design with Jinja2 templating and React components, prioritizing color-coded tier systems, interactive elements, and mobile optimization. Features Next.js-inspired tab-based navigation with clean header separation and active state highlighting. Redraft and Dynasty pages follow user's preferred pattern.

### Technical Stack
- **Backend**: Python (Flask), Node.js (Express.js, TypeScript)
- **Frontend**: React 18, TypeScript, Jinja2, Wouter, TanStack Query, shadcn/ui (Radix UI), Tailwind CSS
- **Data**: CSV/JSON, PostgreSQL, Drizzle ORM, Drizzle Kit, JSONL format
- **Data Pipeline**: Python with nfl-data-py, pandas

## External Dependencies
**ROSTER SYNC SYSTEM IMPLEMENTED** - Live roster sync merges Sleeper API (11,396 players) with NFL data for current team assignments. Travis Hunter now correctly shows JAX instead of outdated COL assignment. Available via `/api/sync/rosters`, `/api/rosters`, `/api/depth-charts`, and `/api/players-index` endpoints.

- **MySportsFeeds API**: For injury reports and NFL roster automation.
- **Sleeper API**: For player projections, game logs, ADP data, league sync, and current roster data.
- **NFL-Data-Py**: For 2024 weekly statistics via nflfastR, depth charts via nflverse APIs.
- **R Server**: External API for OASIS (Offensive Architecture Scoring & Insight System) data.
- **Axios**: For making HTTP requests.
- **Zod**: For runtime type validation.
- **Recharts**: For charting and data visualization.
- **connect-pg-simple**: For PostgreSQL-based session storage.
- **@neondatabase/serverless**: PostgreSQL connection for serverless environments.
```