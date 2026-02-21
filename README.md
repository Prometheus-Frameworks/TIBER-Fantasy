# Tiber Fantasy

**Free, open-source NFL fantasy football analytics. No paywalls. No subscriptions.**

Tiber Fantasy provides real-time player evaluations, FORGE-powered rankings, and decision support tools for dynasty, redraft, and best ball leagues. Skill positions only — QB, RB, WR, TE.

---

## Features

### FORGE — Football-Oriented Recursive Grading Engine
The core player evaluation system. Produces Alpha scores (0–100) for every skill-position player across four weighted pillars:

- **Volume** — opportunity share, target/carry rates, snap counts
- **Efficiency** — Fantasy Points Over Expectation (FPOE), yards-per-route-run, EPA
- **Team Context** — scheme fit, depth chart stability, offensive line quality
- **Stability** — week-to-week consistency, injury history, role security

Alpha scores feed tiered rankings (Elite → Bust) and are recalculated recursively with momentum blending to reduce noise from outlier weeks.

### Fantasy Lab
Weekly analytics dashboard surfacing actionable insights:
- Efficiency vs. usage breakdowns
- Trust indicators and red flags (TD-spike detection, volume/efficiency mismatches)
- Player watchlist with custom tracking

### QB FIRE — Opportunity-Role Intelligence
Expected Fantasy Points (xFP) model for quarterbacks built on opportunity-role pipelines. Identifies QBs outperforming or underperforming their role-based ceiling.

### Sentinel
Automated data quality monitoring. Catches anomalies in the scoring pipeline before they surface in rankings.

### Start/Sit & Strength of Schedule
Position-specific matchup grades and SOS ratings to inform weekly lineup decisions.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui, TanStack Query |
| Routing | Wouter |
| Backend | Express.js, Node.js, TypeScript |
| Database | PostgreSQL, Drizzle ORM, pgvector |
| AI | Google Gemini (embeddings), Anthropic SDK |
| Data Processing | Python, Flask, nfl_data_py, pandas |

---

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL with pgvector extension
- Python 3.10+ (for NFL data processing scripts)

### Environment Variables

Create a `.env` file in the project root:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/tiber_fantasy
NODE_ENV=development
SESSION_SECRET=your_secret_here

# Optional — enables additional data sources
FANTASYPROS_API_KEY=
MSF_USERNAME=
MSF_PASSWORD=
SPORTSDATA_API_KEY=
```

### Install & Run

```bash
npm install
npm run db:push       # Apply schema to your database
npm run dev           # Start dev server (Vite + Express on port 5000)
```

### Database Migrations

```bash
npm run db:generate   # Generate migration files from schema changes
npm run db:migrate    # Apply pending migrations
npm run db:studio     # Open Drizzle Studio (visual DB browser)
```

---

## Development

```bash
npm run build         # Production build
npm run start         # Run production build
npm run test          # Run all Jest tests
npm run test:forge    # Run FORGE engine tests only
npm run typecheck     # TypeScript type checking
npm run lint          # ESLint
```

---

## Data Sources

| Source | Used For |
|---|---|
| Sleeper API | Player projections, ADP, league sync |
| MySportsFeeds | Injury reports, roster automation |
| nflverse / nflFastR | Play-by-play data, schedules |
| nfl_data_py | Weekly stats, depth charts, snap counts |

---

## Architecture

Tiber Fantasy uses a 3-tier ELT pipeline:

- **Bronze** — Raw data ingestion from external sources
- **Silver** — Transformation and normalization
- **Gold** — Aggregated metrics consumed by FORGE and the API layer

Player identity is unified across fantasy platforms via a `player_identity_map` table keyed on GSIS ID (`00-XXXXXXX` format).

---

## Philosophy

Fantasy analytics should be free. Every tool here is open-source and free to use, fork, and build on. If you find it useful, contribute back.

---

## Contributing

Issues and PRs welcome. See `manus/CONTRIBUTING.md` for guidelines.

## License

MIT
