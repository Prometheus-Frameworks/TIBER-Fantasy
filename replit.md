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

### Data Layer
- **Database**: PostgreSQL with Neon serverless driver
- **ORM**: Drizzle ORM for type-safe database operations
- **Schema Management**: Drizzle Kit for migrations and schema management
- **Session Storage**: PostgreSQL-based session storage using connect-pg-simple

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

### UI Components
- **Dashboard**: Main application view with team overview and navigation
- **Team Overview**: Team statistics, health score, and key metrics
- **Position Analysis**: Visual representation of team strengths and weaknesses
- **Player Recommendations**: Smart suggestions for roster improvements
- **Performance Chart**: Weekly performance visualization with Recharts
- **Mobile Navigation**: Responsive bottom navigation for mobile devices

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

## Changelog

```
Changelog:
- July 03, 2025. Initial setup with in-memory storage
- July 03, 2025. Added PostgreSQL database integration with Drizzle ORM
```

## User Preferences

```
Preferred communication style: Simple, everyday language.
```