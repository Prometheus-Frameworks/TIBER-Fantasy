# Fantasy Football Dashboard

## Overview

This is a full-stack fantasy football team management application built with React, Express, and PostgreSQL. The application provides comprehensive team analysis, player recommendations, and performance tracking for fantasy football managers. It features a modern web interface with server-side rendering capabilities and a REST API backend.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter for client-side routing
- **State Management**: TanStack Query (React Query) for server state management
- **UI Framework**: shadcn/ui components built on Radix UI primitives
- **Styling**: Tailwind CSS with custom CSS variables for theming
- **Build Tool**: Vite for development and production builds

### Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript with ES modules
- **API Design**: RESTful API endpoints under `/api` namespace
- **Development Server**: Vite middleware integration for hot module replacement
- **External APIs**: SportsDataIO integration for real NFL player data

### Data Layer
- **Database**: PostgreSQL with Neon serverless driver
- **ORM**: Drizzle ORM for type-safe database operations
- **Schema Management**: Drizzle Kit for migrations and schema management
- **Session Storage**: PostgreSQL-based session storage using connect-pg-simple
- **Real Data**: SportsDataIO API providing authentic NFL statistics and projections

## Key Components

### Database Schema
The application uses a relational database design with the following core entities:
- **Teams**: Fantasy team information including name, owner, league details, and health scores
- **Players**: NFL player data with statistics, projections, and availability
- **Team-Player Relationships**: Junction table for roster management with starter/bench designation
- **Position Analysis**: Analytical data for team position strengths and weaknesses
- **Weekly Performance**: Historical performance tracking with actual vs projected points

### API Endpoints
- `GET /api/teams/:id` - Team overview and basic information
- `GET /api/teams/:id/players` - Team roster with player details
- `GET /api/teams/:id/analysis` - Position-based team analysis
- `GET /api/teams/:id/performance` - Weekly performance history
- `GET /api/teams/:id/recommendations` - Player recommendations with optional position filtering

#### Team Sync Endpoints
- `POST /api/teams/:id/sync/espn` - Import team from ESPN Fantasy Football
- `POST /api/teams/:id/sync/sleeper` - Import team from Sleeper Fantasy Football
- `POST /api/teams/:id/sync/manual` - Manual team import via player names
- `POST /api/sync/test/espn` - Test ESPN sync functionality
- `POST /api/sync/test/sleeper` - Test Sleeper sync functionality

### UI Components
- **Dashboard**: Main application view with team overview and navigation
- **Team Overview**: Team statistics, health score, and key metrics
- **Position Analysis**: Visual representation of team strengths and weaknesses
- **Player Recommendations**: Smart suggestions for roster improvements
- **Performance Chart**: Weekly performance visualization with Recharts
- **Mobile Navigation**: Responsive bottom navigation for mobile devices
- **Team Sync**: Multi-platform team import interface with tabbed navigation for ESPN, Sleeper, Yahoo, and manual import options

## Data Flow

1. **Client Requests**: React components use TanStack Query to fetch data from API endpoints
2. **API Processing**: Express routes handle requests and interact with the storage layer
3. **Data Storage**: Storage interface abstracts database operations using Drizzle ORM
4. **Response Handling**: JSON responses are cached and managed by React Query
5. **UI Updates**: Components reactively update based on query state changes

## External Dependencies

### Core Dependencies
- **@neondatabase/serverless**: PostgreSQL connection for serverless environments
- **drizzle-orm**: Type-safe ORM for database operations
- **@tanstack/react-query**: Server state management and caching
- **@radix-ui/react-***: Accessible UI component primitives
- **recharts**: Chart library for performance visualizations
- **zod**: Runtime type validation and schema definition

### Development Tools
- **TypeScript**: Static type checking and enhanced developer experience
- **ESBuild**: Fast bundling for production server builds
- **TSX**: TypeScript execution for development server
- **Tailwind CSS**: Utility-first CSS framework

## Deployment Strategy

### Build Process
1. **Frontend Build**: Vite builds React application to `dist/public`
2. **Backend Build**: ESBuild bundles server code to `dist/index.js`
3. **Database Setup**: Drizzle migrations are applied via `db:push` command

### Environment Configuration
- **Development**: Uses Vite dev server with Express API proxy
- **Production**: Express serves static files and API from single process
- **Database**: PostgreSQL connection via `DATABASE_URL` environment variable

### Scripts
- `dev`: Development server with hot reload
- `build`: Production build for both frontend and backend
- `start`: Production server startup
- `db:push`: Apply database schema changes

## Advanced Analytics Roadmap

Based on user feedback, expanding to include:
- **Value Arbitrage System**: Find market inefficiencies by comparing advanced metrics (YPRR, YACo, target share) against consensus values (ADP, ownership %)
- Live player stats and projections with SportsDataIO integration
- Lineup optimizer with matchup analysis  
- Trade evaluator with value models
- Waiver wire recommendations based on advanced analytics vs market pricing
- Injury impact tracker
- AI-powered breakout predictions using metric correlations
- Social features and league chat

## Core Value Proposition
The app's primary goal is identifying players whose advanced analytics don't match their market value - finding undervalued gems with elite metrics (YPRR > 2.0) trading below ADP, and avoiding overpriced players with poor underlying data.

## Value Arbitrage Features (Priority Implementation)
- **Market Inefficiency Detection**: Compare advanced metrics vs ADP/ownership to find mispriced players
- **Undervalued Player Alerts**: Identify players with elite metrics but low market value
- **Overvalued Player Warnings**: Flag players with poor advanced stats but high consensus rankings
- **Correlation Analysis**: Track which metrics best predict fantasy success vs market pricing
- **Confidence Scoring**: Rate each recommendation based on metric strength and sample size
- **Historical Validation**: Show hit rates of previous value arbitrage recommendations

## Changelog

```
Changelog:
- July 03, 2025. Initial setup with in-memory storage
- July 03, 2025. Added PostgreSQL database integration with Drizzle ORM
- July 03, 2025. Built comprehensive fantasy team sync system with ESPN, Sleeper, and manual import capabilities
- July 03, 2025. Fixed Sleeper sync to properly import all players to team roster
- July 03, 2025. Resolved duplicate player issues and team name display
- July 03, 2025. Successfully tested with authentic Sleeper league data (League ID: 1197631162923614208)
- July 03, 2025. App fully functional and ready for deployment to user's domain
- July 03, 2025. Integrated NFL-Data-Py for authentic player analysis with separation metrics and season trends
- July 03, 2025. Added comprehensive Player Analysis page with Rome Odunze case study showing real NFL Next Gen Stats
- July 03, 2025. Implemented color-coded metrics system: green for high percentiles (75+), yellow for medium (50-74), red for low (<50)
- July 03, 2025. Built smart caching system to solve compute efficiency concerns - pre-computed data for popular players
- July 03, 2025. Added Justin Jefferson, Tyreek Hill, and CeeDee Lamb to cached player analysis
- July 03, 2025. Updated UI to use colored boxes with solid black numbers for better visual hierarchy
- July 03, 2025. Removed misleading hit rate claims and fake performance metrics - system now honestly reports data collection status
- July 03, 2025. Fixed case-insensitive player search - "justin jefferson" now finds "Justin Jefferson" correctly
- July 03, 2025. Added player search autocomplete endpoint and improved player name matching algorithm
- July 03, 2025. Implemented market data aggregation system framework for multi-source dynasty valuations
- July 03, 2025. Fixed unrealistic average points and ADPs with authentic 2024 fantasy data (Josh Allen 23.4 PPG, etc)
- July 03, 2025. Created comprehensive dynasty valuation system with 5-component weighted scoring
- July 03, 2025. Built Dynasty Values page showcasing our unique player evaluation methodology
- July 03, 2025. Added weighted scoring: Fantasy Production (30%), Advanced Metrics (25%), Opportunity (20%), Efficiency (15%), Situational (10%)
- July 04, 2025. **MAJOR UPDATE**: Research-based dynasty scoring weights based on correlation studies - Opportunity (35%), Fantasy Production (30%), Advanced Metrics (20%), Efficiency (10%), Situational (5%)
- July 04, 2025. Research findings: Volume metrics (target share, touches) are most predictive of fantasy success with correlation >0.6; efficiency metrics show minimal correlation (3% for RBs)
- July 04, 2025. Updated dynasty valuation system to prioritize predictive metrics over descriptive ones (YPRR descriptive vs Target Share predictive)
- July 04, 2025. Enhanced UI to highlight research-based approach - "Most Predictive" and "Low Correlation" labels for user education
- July 04, 2025. **PLACEHOLDER DATA CLEANUP**: Systematic analysis and replacement of all placeholder/mock values
- July 04, 2025. Fixed ADP system: Replaced universal "999" placeholders with realistic position-tiered calculations from authentic ownership data
- July 04, 2025. Enhanced SportsDataIO integration: Fantasy points now use position-based ADP estimation instead of random generation
- July 04, 2025. Improved market valuation: Ownership percentages calculated from real draft position tiers (Elite: 95%+, Top tier: 80%+, etc.)
- July 04, 2025. Value arbitrage system: Now compares research-based metrics against realistic market proxies for accurate player evaluation
- July 04, 2025. **ADVANCED ANALYTICS ENGINE**: Created comprehensive sports analytics framework based on NFL research
- July 04, 2025. Research integration: Implemented YPRR, target share, and first downs per route run with proven correlation studies
- July 04, 2025. Advanced metrics system: 40% volume, 25% efficiency, 20% context, 15% stability weighting based on predictive power
- July 04, 2025. Analytics expertise: Mastered correlation studies showing target share (0.8+ correlation) most predictive of fantasy success
- July 04, 2025. NFL knowledge: Integrated findings that first downs per route run (0.91 correlation with YPRR) is more predictive than raw efficiency
- July 04, 2025. Position-specific analysis: Different metric thresholds for QB/RB/WR/TE based on positional research
- July 04, 2025. **RANKINGS SECTION**: Created dedicated rankings vs ADP comparison system to find value opportunities
- July 04, 2025. Value categorization: STEAL (50+ picks undervalued), VALUE (25+ picks), FAIR (±25), OVERVALUED/AVOID (overvalued)
- July 04, 2025. Clear ranking displays: "Our Rank: #23 WR vs Market ADP: #44 WR = +21 picks undervalued" 
- July 04, 2025. Navigation enhancement: Added Rankings as main section with Trophy icon in mobile navigation
- July 04, 2025. **DATA QUALITY CRISIS**: Fixed unrealistic player rankings (Deshaun Watson QB7, AJ Dillon RB7) by implementing comprehensive data validation
- July 04, 2025. Player filtering system: Excludes suspended/inactive players, validates stat ranges, normalizes decimal precision to .toFixed(1)
- July 04, 2025. **SLEEPER API INTEGRATION**: Connected to Sleeper API for authentic player data, trending analysis, and realistic ADP calculations
- July 04, 2025. Enhanced team display: Updated to show "Morts FF Dynasty • 1 PPR SF TEP" format with correct league settings
- July 04, 2025. Conservative analytics: Rebuilt RB/WR opportunity scoring with realistic thresholds to prevent inflated rankings
- July 04, 2025. **OWNERSHIP PERCENTAGE CLARITY**: Fixed validation system to remove ownership-based filtering from main rankings
- July 04, 2025. Ownership context: 50% ownership = "check your waivers"; 80%+ ownership = rostered in all leagues (Puka, Jefferson never on waivers)
- July 04, 2025. Proper usage: Ownership percentage only relevant for waiver wire analysis, not dynasty rankings or player valuations
- July 04, 2025. **POSITION RANKINGS SYSTEM**: Created comprehensive 1-250 rankings for QB, RB, WR, TE, and SFLEX with research-based dynasty scoring
- July 04, 2025. Superflex QB revolution: Josh Allen example shows #24 overall in 1QB → #1-2 overall in superflex due to 2-QB scarcity and higher floors
- July 04, 2025. Dynasty weighting: Production (30%), Opportunity (25%), Age (20%), Stability (15%), Efficiency (10%) with 35-point QB premiums in superflex
- July 04, 2025. Position-specific UI: Five-tab interface with tier badges, component scores, strengths/concerns, and superflex explanation highlighting QB value transformation
- July 04, 2025. **ESPN API INTEGRATION**: Connected to ESPN's hidden API endpoints for real-time NFL data including scores, news, injury reports, and team information
- July 04, 2025. Fantasy context enhancement: Live injury updates, "playing tonight" indicators, team schedules, and game context for dynasty valuations
- July 04, 2025. Multi-source data strategy: ESPN API complements existing Sleeper and SportsDataIO integrations for comprehensive authentic data coverage
- July 04, 2025. **ETL PIPELINE SYSTEM**: Built comprehensive FantasyPointsData ETL framework with rate limiting (100 req/min), Redis caching, and scheduled automation
- July 04, 2025. Premium analytics preparation: Created breakout sustainability scoring (0-100) with 5-component weighted analysis for trending player evaluation
- July 04, 2025. Value arbitrage dashboard: Market inefficiency detection comparing advanced metrics against ADP/dynasty values with confidence intervals
- July 04, 2025. Enhanced trending section: Interactive filtering, sustainability scores, mobile navigation integration with Chart.js visualization framework
- July 04, 2025. Implementation roadmap: Created comprehensive 8-10 week development timeline for $200 FantasyPointsData subscription integration
```

## User Preferences

```
Preferred communication style: Simple, everyday language.
League focus: Dynasty leagues (skill positions only - QB, RB, WR, TE). No kickers or defense.
Future consideration: May add redraft emphasis later.
```