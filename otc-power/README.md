# OTC Power Rankings Service

Separate microservice for weekly Overall + Position Power Rankings with real-time event updates.

## Quick Start

```bash
# Install dependencies (if not already done)
npm install

# Development server
npm run dev

# Jobs
npm run recalc:nightly    # Nightly recalculation
npm run recalc:events     # Process event queue
npm run validate          # Validation analysis (Grok)
```

## API Endpoints

- `GET /api/power/OVERALL?season=2025&week=1` - Overall rankings
- `GET /api/power/QB|RB|WR|TE?season=2025&week=1` - Position rankings  
- `GET /api/power/player/{id}?season=2025` - Player history
- `POST /api/power/events` - Manual event injection
- `GET /api/power/health` - Service health check

## Environment Variables

Copy `.env.example` to `.env` and configure:

- `DATABASE_URL` - PostgreSQL connection
- `REDIS_URL` - Redis cache (optional)
- `DEEPSEEK_BASE` - DeepSeek API for talent scores
- `OASIS_BASE` - OASIS API for environment scores

## Architecture

**5-Component Scoring System:**
- usage_now (40%) - xFP EWMA + role shares
- talent (25%) - DeepSeek/Fusion North stabilized  
- environment (20%) - OASIS team context + QB stability
- availability (10%) - Practice status + expected snaps
- market_anchor (5%) - ECR/ADP drift anchor

**Event-Driven Updates:**
- Real-time recalculation on injuries, depth changes, QB swaps
- Smoothing bypass for verified football events
- 60-second event queue processing

## Database Schema

Run SQL migrations:
```bash
psql $DATABASE_URL < sql/001_schema.sql
psql $DATABASE_URL < sql/002_indexes.sql
```

## Status

✅ **Phase 1 Complete** - Service scaffold with mock data  
🔄 **Phase 2 Next** - Wire loaders to DeepSeek/OASIS APIs  
⏳ **Phase 3 Pending** - Event processing + validation