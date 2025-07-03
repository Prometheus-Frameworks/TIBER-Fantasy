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
```

## User Preferences

```
Preferred communication style: Simple, everyday language.
```