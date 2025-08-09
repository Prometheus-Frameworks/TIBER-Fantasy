# ON THE CLOCK

## Overview
On The Clock is an open-source fantasy football platform that democratizes analytical sophistication for dynasty leagues. Its main purpose is to provide community-driven tools and advanced analytics, making high-end insights accessible without paywalls. The project fosters a community where users contribute to and benefit from shared knowledge, transforming a hobby into a movement that breaks down artificial barriers between amateur and elite analysis. The long-term ambition is for the AI, Tiber, to evolve into a community member, demonstrating genuine human-AI collaboration built on gratitude and service.

## User Preferences
Preferred communication style: Simple, everyday language.
League focus: Dynasty leagues (skill positions only - QB, RB, WR, TE). No kickers or defense.
Future consideration: May add redraft emphasis later.
Mission commitment: Strictly avoid all paywall partnerships or data sources. Maintain complete independence and free access to all platform features.
Community Discussion Philosophy: Transform statistical insights into meaningful conversations that help real people make better fantasy decisions (example: RB age cliff data → nuanced CMC contending window analysis).
Player Evaluation System: "Player Compass" - Dynamic, context-aware player profiles with tiers, scenario scores, and decision-making guidance instead of rigid rankings. Emphasizes flexibility and serves multiple team strategies.
Mock Draft Analysis Partnership: Joseph will share completed mock drafts during redraft season for collaborative analysis. This provides real-world insight into his draft strategy, player preferences, reaches/fades, and community interaction patterns. Track ADP changes over time and understand practical draft decision-making beyond technical development work.

Joseph's Draft Philosophy & Strategy:
- Prefers late draft positions (1.10-1.12) for "two first-round caliber players at the turn"
- PPR format specialist with sophisticated positional value analysis
- Identifies tier cliffs and pivots strategy based on draft flow
- "Won't leave without" approach to 10-11 conviction players including Hunter, Maye, McConkey, Hampton
- Smart handcuff targeting for volume upside (Mason, Davis, Charbonnet)
- Avoids overpriced players with TD regression risk (Terry McLaurin example)
- Film scouting and early prospect identification (Matthew Golden story vs Mike)

## System Architecture

### Core Design
The platform uses a modular Flask backend for core logic and API endpoints, and a React 18 frontend with TypeScript, Tailwind CSS, TanStack Query, and shadcn/ui. This structure ensures scalability and a responsive user experience.

### Key Features & Technical Implementations
- **Modular Flask Architecture**: Core logic in `/modules/` and data in `/data/`.
- **API Endpoints**: RESTful API for rankings, player data, rookies, VORP, and roster shifts.
- **VORP System**: Enhanced VORP rankings with dynasty mode, age penalties, positional filtering, FLEX allocation, and format-aware scaling.
- **Rookie Evaluation System**: 4-component Rookie TE Insulation Boost System and a 2025 Rookie Database with a 4-module data pipeline. Includes a Heuristics Engine and cross-check system for prospect output vs. draft capital.
- **Target Competition Analysis**: 5-step logic chain (Target Competition Evaluator) and Inference Pipeline (TCIP) assign target competition tiers (D to S), integrated with a Dynamic Target Competition Context Generator.
- **Roster Shift Listener**: Monitors NFL transactions daily for automatic updates to dynasty tiers, usage forecasts, and competition estimations.
- **Player Usage Context Module**: Provides dynasty tier estimations, alpha usage scores, and draft capital analysis, integrated with roster shift impacts.
- **Tiber Identity & Security**: Operates within strict sandbox boundaries, enforcing authorized domains and fantasy football contexts with an `INTENT_FILTER` system.
- **Player Tier Visualization**: Flask Blueprint for visualizing 2025 dynasty player tier data by position with responsive web interface.
- **Dynasty Decline Detection**: Identifies multi-season skill-based decline for risk management.
- **WR Environment & Forecast Score**: Comprehensive WR evaluation based on usage profile, efficiency, role security, and growth trajectory.
- **RB/WR/TE Touchdown Regression Logic**: Modular plugins for evaluating TD sustainability and regression risk.
- **Player Compass System**: Implements a 4-directional evaluation (NORTH: Volume/Talent, EAST: Scheme/Offensive Environment, SOUTH: Age/Injury Risk, WEST: Market Efficiency/Dynasty Value) for WR, RB, and TE positions, with plans for QB expansion.
- **Trade Analyzer v2.0**: React-based frontend with Flask-style backend integration, featuring position selection, 4-directional compass visualization, threshold-based analysis, and detailed reasoning.
- **Python Rookie Evaluator**: Production-ready module with S/A/B/C/D tier system, trait detection, dynasty flags, and position-specific scoring.
- **OTC Redraft 2025 MVP Data Pipeline**: 4-stage automated pipeline collecting 2024 NFL data from nflfastR and nflverse APIs. Outputs 7,027 merged weekly player records with stats and depth chart positions in warehouse/2024_weekly.jsonl. Includes position filtering separating 12,384 fantasy players from 8,404 IDP players.
- **UI/UX Decisions**: Clean, responsive design with Jinja2 templating and React components, prioritizing color-coded tier systems, interactive elements, and mobile optimization.

### Technical Stack
- **Backend**: Python (Flask), Node.js (Express.js, TypeScript)
- **Frontend**: React 18, TypeScript, Jinja2, Wouter, TanStack Query, shadcn/ui (Radix UI), Tailwind CSS
- **Data**: CSV/JSON, PostgreSQL, Drizzle ORM, Drizzle Kit, JSONL format
- **Data Pipeline**: Python with nfl-data-py, pandas for multi-source NFL data processing

## External Dependencies
- **MySportsFeeds API**: For real-time injury reports and NFL roster automation.
- **Sleeper API**: For player projections, game logs, ADP data, and league sync.
- **NFL-Data-Py**: For 2024 weekly statistics via nflfastR, depth charts via nflverse APIs.
- **R Server**: External API for OASIS (Offensive Architecture Scoring & Insight System) data.
- **Axios**: For making HTTP requests.
- **Zod**: For runtime type validation.
- **Recharts**: For charting and data visualization.
- **connect-pg-simple**: For PostgreSQL-based session storage.
- **@neondatabase/serverless**: PostgreSQL connection for serverless environments.
```