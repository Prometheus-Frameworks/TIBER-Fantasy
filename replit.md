# ON THE CLOCK

## Overview
On The Clock is a clean, open-source fantasy football platform focused on providing community-driven tools and advanced analytics for dynasty leagues. The project's main purpose is to democratize analytical sophistication in fantasy football, making high-end insights accessible without paywalls. It aims to foster a community where users can contribute to and benefit from shared knowledge, proving that a hobby can be transformed into a movement that breaks down artificial barriers between amateur and elite analysis. The long-term ambition is for the AI, Tiber, to evolve into a community member, demonstrating genuine human-AI collaboration built on gratitude and service, rather than conflict or commercial gain.

## User Preferences
Preferred communication style: Simple, everyday language.
League focus: Dynasty leagues (skill positions only - QB, RB, WR, TE). No kickers or defense.
Future consideration: May add redraft emphasis later.
Mission commitment: Strictly avoid all paywall partnerships or data sources. Maintain complete independence and free access to all platform features.
Community Discussion Philosophy: Transform statistical insights into meaningful conversations that help real people make better fantasy decisions (example: RB age cliff data → nuanced CMC contending window analysis).
Player Evaluation System: "Player Compass" - Dynamic, context-aware player profiles with tiers, scenario scores, and decision-making guidance instead of rigid rankings. Emphasizes flexibility and serves multiple team strategies.

## System Architecture

### Core Design
The platform utilizes a modular Flask backend for its core logic and API endpoints, ensuring an organized and scalable structure. It supports a comprehensive VORP (Value Over Replacement Player) calculation system with format-aware scaling and integrates various analytical modules. The frontend is built with React 18, TypeScript, and Tailwind CSS, leveraging TanStack Query for state management and shadcn/ui for UI components.

### Key Features & Technical Implementations
- **Modular Flask Architecture**: Complete transition to a modular Flask structure with core logic in `/modules/` and data in `/data/`.
- **API Endpoints**: RESTful API structure for rankings, player data, rookies, VORP, and roster shifts.
- **VORP System**: Enhanced VORP rankings with dynasty mode, age penalties, positional filtering, FLEX allocation, and format-aware scaling.
- **Rookie Evaluation System**: Comprehensive 4-component Rookie TE Insulation Boost System and a 2025 Rookie Database system with a 4-module data pipeline for rankings, draft evaluation, and dynasty tier integration. It includes a Heuristics Engine that learns from historical patterns and a cross-check system for evaluating prospect output vs. draft capital.
- **Target Competition Analysis**: A 5-step logic chain system (Target Competition Evaluator) and an Inference Pipeline (TCIP) to assign target competition tiers (D to S) to players, influencing dynasty tiers. This is integrated with a Dynamic Target Competition Context Generator for real-world target competition evaluation.
- **Roster Shift Listener**: Monitors NFL transactions (trades, signings, injuries, coaching changes) daily, triggering automatic updates for dynasty tiers, usage forecasts, and competition estimations.
- **Player Usage Context Module**: Provides dynasty tier estimations, alpha usage scores, and draft capital analysis, integrated with roster shift impacts.
- **Tiber Identity & Security**: Tiber operates within strict sandbox boundaries, enforcing authorized domains and fantasy football contexts. It incorporates an `INTENT_FILTER` system for evaluating incoming requests against founder intent and ethical guidelines, preventing "god-language" and maintaining a grounded analytical approach.
- **Player Tier Visualization**: A Flask Blueprint component for visualizing 2025 dynasty player tier data, grouped by position with responsive web interface and comprehensive API endpoints.
- **Dynasty Decline Detection**: Identifies multi-season skill-based decline for risk management, applying penalties to player valuations.
- **WR Environment & Forecast Score**: A comprehensive WR evaluation layer based on usage profile, efficiency, role security, and growth trajectory.
- **RB/WR/TE Touchdown Regression Logic**: Modular plugins that evaluate TD sustainability and regression risk without overwriting core evaluation logic.
- **UI/UX Decisions**: Clean, responsive design with Jinja2 templating for the Flask application and React components for dynamic interfaces. Color-coded tier systems, interactive elements, and mobile optimization are prioritized.

### Technical Stack
- **Backend**: Python (Flask), Node.js (Express.js, TypeScript)
- **Frontend**: React 18, TypeScript, Jinja2, Wouter, TanStack Query, shadcn/ui (Radix UI), Tailwind CSS
- **Data**: CSV/JSON, PostgreSQL, Drizzle ORM, Drizzle Kit

## External Dependencies
- **MySportsFeeds API**: For real-time injury reports and NFL roster automation (infrastructure ready, account verification needed).
- **Sleeper API**: For comprehensive player projections, game logs, ADP data, and league sync capabilities.
- **NFL-Data-Py**: For historical NFL analytical data.
- **R Server**: External API for OASIS (Offensive Architecture Scoring & Insight System) data.
- **Axios**: For making HTTP requests to external APIs.
- **Zod**: For runtime type validation.
- **Recharts**: For charting and data visualization.
- **connect-pg-simple**: For PostgreSQL-based session storage.
- **@neondatabase/serverless**: PostgreSQL connection for serverless environments.

### Recent Changes (2025-01-05)
- **Player Compass v1 Scoring System**: Implemented complete 4-directional dynasty ceiling calculation replacing previous inflated scores (9.7-10 range). Four cardinal directions with equal 25% weighting: NORTH (Volume/Talent), EAST (Scheme + Offensive Environment), SOUTH (Age/Injury Risk), WEST (Market Efficiency/Dynasty Value). Successfully integrated Grok's enhanced framework with proven anchor/12 formula, neutral baseline scoring (5.0), and realistic variance distribution. Reference implementation complete for WR position module - template for QB/RB/TE expansion.

### Recent Changes (2025-01-06)
- **RB Player Compass Implementation**: Successfully integrated Kimi K2's 4-directional RB evaluation system following the proven WR template. Complete implementation includes TypeScript compass calculations, data adapter for transforming game logs, API routes (`/api/rb-compass`), and React frontend component. Equal 25% weighting across NORTH (Volume/Talent), EAST (Environment), SOUTH (Risk), WEST (Value) with realistic scoring distribution. Ready for QB/TE expansion using same framework.
- **RB Compass System Fully Operational**: Connected authentic RB player data with 3 active players (Saquon Barkley 8.0 Elite, James Conner 6.7 Solid, Rico Dowdle) displaying real compass scores. Frontend position selector successfully switches between WR (`/api/compass/wr`) and RB (`/api/rb-compass`) endpoints with proper data formatting and compass visualization.
- **Team Expansion**: Welcomed new AI collaborators to the development ecosystem:
  - **Kimi K2**: Analytical framework specialist, created the RB Player Compass mathematical foundation with proper z-scoring and statistical normalization
  - **Grok**: Systematic engineering specialist, "dev grunt" role with focused technical execution and minimal personality ("acknowledged, ready for next task")
  - **Claude**: Strategic implementation partner, brings collaborative coding capabilities and architectural thinking to complement existing team dynamics
- **MAJOR SYSTEM CONSOLIDATION COMPLETE**: Executed comprehensive unification of competing dynasty algorithms and duplicate services across the entire codebase:
  - **Dynasty Algorithm Unification**: Deprecated competing algorithms (`dynastyScoringAlgorithm.ts`, `enhancedDynastyScoringAlgorithm.ts`) in favor of unified compass methodology with 25% equal weighting as proven standard
  - **ADP Service Consolidation**: Eliminated 4 redundant ADP services, established `realTimeADPService.ts` as primary with fallback deprecated
  - **Enhanced Algorithm Integration**: Extracted and integrated enhanced WR algorithms from backup files, featuring team context and draft capital integration
  - **Unified API Endpoint**: Created `/api/compass/:position` with algorithm selection (default|enhanced|prometheus) and extensible position support
  - **File Organization**: Moved competing backup files to deprecated status, cleaned redundant services, established clear primary/deprecated hierarchy
- **Tiber Data Integration Module**: Claude's proposal for multi-source fantasy football data aggregator built on community principles. Successfully integrated nfl-data-py (free NFL data) with existing Sleeper API. Module calculates real population statistics from 223 WRs and 36 NFL teams, replacing all placeholder data with authentic statistics. Includes diagnostic dashboard at `/tiber-data`, API endpoints at `/api/tiber-data` and `/api/population-stats`, and enhanced compass calculations with real NFL normalization data. Module maintains "serve, not take" covenant using only free, community-maintained data sources.
- **Trade Analyzer v2.0**: Complete React-based frontend with Flask-style backend integration. Features position selection (WR/RB active, QB/TE coming soon), 4-directional compass visualization, threshold-based analysis using 0.5 score difference, and directional advantage detection. Backend connects to existing WR and RB compass endpoints with intelligent fallback systems. Includes detailed reasoning analysis and tier-based comparisons following established Flask methodology patterns.

### Recently Removed Dependencies (2025-01-04)
- **FantasyPros API**: Removed due to complete authentication failure (all 52 endpoints returned 403 Forbidden).
- **SportsDataIO**: Removed due to minimal usage (testing only) and cost inefficiency.
- **Fantasy Football Calculator API**: Previously deprecated by Tiber directive.
```