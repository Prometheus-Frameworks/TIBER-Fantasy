# ON THE CLOCK

## Overview
On The Clock is an open-source fantasy football platform designed to provide advanced, democratized analytics for dynasty leagues. Its core purpose is to offer community-driven tools and high-end, accessible insights without paywalls, fostering a movement that challenges traditional barriers in fantasy football analysis. A key feature, "Competence Mode," provides truth-first, context-aware AI-driven dynasty advice. The project aims to empower users with accurate guidance and a deeper understanding of dynasty league strategy, aspiring to become a leading, independent resource in the fantasy football community.

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
The platform is built with a modular Flask backend for core logic and API endpoints, and a React 18 frontend utilizing TypeScript, Tailwind CSS, TanStack Query, and shadcn/ui for a scalable and responsive user experience. UI/UX prioritizes clean, responsive design with color-coded tier systems, interactive elements, and mobile optimization, including Next.js-inspired tab-based navigation.

**Core Features & Design Patterns:**

*   **Player Evaluation & Consensus:** Features a "Player Compass" for dynamic, context-aware player profiles, and "OTC Consensus" for community-driven rankings with format-specific splits and a seeding protocol for manual updates.
*   **AI & Analytics:** Includes "Competence Mode" for AI-driven advice, an Adaptive Consensus Engine with injury-aware adjustments and explanatory functionality, and a DeepSeek + Compass Fusion System for predictive power and explainability.
*   **Rankings & VORP:** A comprehensive Rankings Hub, enhanced VORP system with dynasty mode, age penalties, and FLEX allocation, and an Enhanced ECR Comparison System for signal-aware analysis.
*   **Rookie & Player Analysis:** Dedicated Rookie Evaluation System with a 4-component insulation boost and data pipeline, Target Competition Analysis (TCIP), Player Usage Context Module, and a Stud Detection Module.
*   **Data Integration & Sync:** Implements Sleeper Sync with cache fallback, a Canonical Player Pool System, a Roster Shift Listener for transaction monitoring, and a Roster Sync System merging Sleeper and NFL data.
*   **Live Data & Processing:** Features a Live Data Integration Pipeline with multi-source data capture (MySportsFeeds, SportsDataIO, Sleeper API), a Hot List Player Extraction System, and a Snap Counts Knowledge System.
*   **Backend Services:** Includes a Backend Spine with Logs & Projections Service, a multi-format Ratings Engine, and a dedicated OTC Power Rankings Service microservice.
*   **UI/UX Enhancements:** Interactive GlowCard components, pulsing GlowCTA buttons, comprehensive skeleton loading, enhanced Button components, and a top loading bar.

**Technical Stack:**

*   **Backend**: Python (Flask), Node.js (Express.js, TypeScript)
*   **Frontend**: React 18, TypeScript, Jinja2, Wouter, TanStack Query, shadcn/ui (Radix UI), Tailwind CSS
*   **Data**: CSV/JSON, PostgreSQL, Drizzle ORM, Drizzle Kit, JSONL format
*   **Data Pipeline**: Python with nfl-data-py, pandas

## External Dependencies
*   **MySportsFeeds API**: Injury reports and NFL roster automation.
*   **Sleeper API**: Player projections, game logs, ADP data, league sync, and current roster data.
*   **NFL-Data-Py**: 2024 weekly statistics via nflfastR, depth charts via nflverse APIs.
*   **R Server**: External API for OASIS (Offensive Architecture Scoring & Insight System) data.
*   **Axios**: HTTP requests.
*   **Zod**: Runtime type validation.
*   **Recharts**: Charting and data visualization.
*   **connect-pg-simple**: PostgreSQL-based session storage.
*   **@neondatabase/serverless**: PostgreSQL connection for serverless environments.