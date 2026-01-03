# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Tiber Fantasy is a free, open-source NFL fantasy football analytics platform. It provides real-time player evaluations, FORGE-powered rankings, and decision support tools for dynasty/redraft/bestball leagues. Focus is on skill positions only (QB, RB, WR, TE) - no kickers or defense.

**Core Philosophy**: No paywalls. Information should be accessible.

## Commands

```bash
# Development
npm run dev                    # Start dev server (Vite + Express)
npm run build                  # Build for production (esbuild + Vite)
npm run start                  # Run production build

# Database (Drizzle ORM + PostgreSQL)
npm run db:push                # Push schema changes
npm run db:generate            # Generate migrations
npm run db:migrate             # Apply migrations
npm run db:studio              # Open Drizzle Studio UI

# Testing
npm run test                   # Run all Jest tests
npm run test:forge             # Run FORGE module tests only
npm run typecheck              # TypeScript type checking
```

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite, TanStack Query, Tailwind CSS, shadcn/ui, Wouter (routing)
- **Backend**: Express.js, Node.js, TypeScript
- **Database**: PostgreSQL with Drizzle ORM, pgvector extension
- **AI**: Google Gemini (embeddings/chat), Anthropic SDK
- **Python**: Flask secondary API for NFL data processing (nfl_data_py, pandas)

## Architecture

### 3-Tier ELT Pipeline
- **Bronze Layer**: Raw data ingestion from multiple sources
- **Silver Layer**: Data transformation & normalization
- **Gold Layer**: Aggregated facts & metrics for consumption

### Key Directories

```
/client/src/
  pages/              # Main routes (TiberTiers, PlayerPage, ForgeSimulation)
  components/         # UI components
  hooks/              # Custom React hooks
  lib/                # Utilities (queryClient)

/server/
  modules/            # Core business logic
    forge/            # FORGE grading engine (main feature)
    sos/              # Strength of schedule
    startSit/         # Start/sit recommendations
    metricMatrix/     # Metrics framework
  routes/             # API route handlers
  services/           # Business logic services
  infra/              # Infrastructure (DB, API registry)
  integrations/       # External API clients (Sleeper, ESPN)

/shared/
  schema.ts           # Complete Drizzle ORM schema
  types/              # Shared TypeScript types
```

### FORGE Engine (Football-Oriented Recursive Grading Engine)

The core player evaluation system providing Alpha scores (0-100) for skill positions:

- **F (Football Lens)**: `forgeFootballLens.ts` - Detects football-sense issues (TD spikes, volume/efficiency mismatches)
- **O (Orientation)**: ViewMode support for redraft, dynasty, bestball with different weight profiles
- **R (Recursion)**: Two-pass scoring with prior alpha blending (80%/20%) and momentum adjustments
- **G (Grading)**: Position-specific pillar weights (volume, efficiency, teamContext, stability)
- **E (Engine)**: `forgeEngine.ts` - Fetches context from DB, builds metrics, computes pillar scores

**Key Files**:
- `server/modules/forge/forgeEngine.ts` - Main scoring engine
- `server/modules/forge/forgeFootballLens.ts` - Football-sense validation
- `server/modules/forge/recursiveAlphaEngine.ts` - Recursive scoring with momentum

### Player Identity

Unified resolution across fantasy platforms (Sleeper, ESPN, Yahoo, MySportsFeeds):
- **GSIS ID**: Primary NFL player identifier (format: `00-XXXXXXX`)
- `player_identity_map` table with cross-platform reconciliation

## UI/UX Conventions

- Dark navy background (`bg-[#0a0e1a]`), slate cards (`bg-[#141824]`)
- Blue-purple gradient accents, white/light typography
- Wouter for client-side routing (ESLint enforces no `window.location` usage)
- TanStack Query for data fetching/caching
- shadcn/ui components with Tailwind

## External Data Sources

- **Sleeper API**: Player projections, ADP data, league sync
- **MySportsFeeds API**: Injury reports, NFL roster automation
- **NFLfastR/nflverse**: Play-by-play data, NFL schedules
- **NFL-Data-Py**: Weekly statistics, depth charts, snap counts

## Environment Variables

Required:
- `DATABASE_URL` - PostgreSQL connection string
- `NODE_ENV` - development|production

Optional API keys:
- `FANTASYPROS_API_KEY`
- `MSF_USERNAME`, `MSF_PASSWORD` (MySportsFeeds)
- `SPORTSDATA_API_KEY`
- `SESSION_SECRET`
