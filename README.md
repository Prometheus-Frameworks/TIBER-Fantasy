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

# Optional — promoted lab / external model adapters
ROLE_OPPORTUNITY_MODEL_BASE_URL=
ROLE_OPPORTUNITY_MODEL_ENDPOINT_PATH=/api/role-opportunity
ROLE_OPPORTUNITY_MODEL_TIMEOUT_MS=5000
ROLE_OPPORTUNITY_MODEL_ENABLED=1
FORGE_SERVICE_BASE_URL=
FORGE_SERVICE_ENDPOINT_PATH=/v1/forge/evaluations
FORGE_SERVICE_TIMEOUT_MS=5000
FORGE_SERVICE_ENABLED=1
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

### External Model Adapter Layer

TIBER-Fantasy now routes promoted lab/model integrations through a dedicated adapter boundary under `server/modules/externalModels/`. The first live adapter wraps `Role-and-opportunity-model` and exposes a stable `TiberRoleOpportunityInsight` interface instead of leaking raw upstream payloads into core logic.

The adapter pattern is intentionally small and repeatable:
- **Client** handles base URL config, timeout control, and HTTP-to-internal error mapping.
- **Adapter** validates the canonical payload at the edge and maps it into a TIBER-facing shape.
- **Service** exposes a stable internal interface for routes and future enrichments.
- **Integration route** provides one contained surface at `GET /api/integrations/role-opportunity/:playerId?season=2025&week=17`.

This prepares TIBER-Fantasy for future promoted labs without forcing a repo-wide rewrite. New model repos should plug into the same boundary instead of issuing ad hoc fetches from feature code.

FORGE now has its first migration-safe external adapter under `server/modules/externalModels/forge/`, but it is **compare-only** in this PR. Production FORGE routes still use the in-repo legacy implementation by default. The new migration surface is:
- `POST /api/integrations/forge/compare` — dual-runs legacy FORGE and external FORGE for the same single-player offensive E+G evaluation request.
- `GET /api/integrations/forge/health` — reports external FORGE config/readiness state.

The compare response keeps each side isolated (`legacy`, `external`) and adds stable diff metadata (`scoreDelta`, `componentDeltas`, `confidenceDelta`, `parityStatus`, `notes`) so migration analysis can happen without switching live product behavior.

**Doctrine note:** TIBER-Fantasy is the product shell and orchestration core. Standalone model brains should live outside this repo when practical and be consumed through adapters/orchestrators. Any in-repo legacy model stacks are temporary unless they have an explicit core justification. See `docs/architecture/TIBER_FANTASY_MODULE_CLASSIFICATION_AUDIT.md` for the current cleanup map.

### Player detail enrichment

`GET /api/player-identity/player/:id` now supports an explicit opt-in enrichment:

```http
GET /api/player-identity/player/00-0036322?includeRoleOpportunity=true&season=2025&week=17
```

Behavior:
- The base player detail payload is unchanged when `includeRoleOpportunity` is omitted.
- Role-opportunity insight is fetched only when `includeRoleOpportunity=true`.
- Player-detail external insights now flow through a reusable enrichment orchestrator under `server/modules/externalModels/playerDetailEnrichment/`, keeping the route thin and giving future enrichments a single plug-in point.
- Role-opportunity is the first supported external insight in that orchestrator.
- Enrichment is non-fatal: if the external model is disabled, times out, returns malformed data, or has no record, the player detail response still returns `200 OK` with the normal player payload.

Added response field when requested:

```json
{
  "success": true,
  "data": {
    "canonicalId": "00-0036322",
    "fullName": "Justin Jefferson",
    "roleOpportunityInsight": {
      "available": true,
      "fetchedAt": "2026-03-20T00:00:00.000Z",
      "data": {
        "playerId": "00-0036322",
        "season": 2025,
        "week": 17,
        "position": "WR",
        "team": "MIN",
        "primaryRole": "alpha_x",
        "roleTags": ["boundary", "downfield"],
        "usage": {
          "snapShare": 0.93,
          "routeShare": 0.96,
          "targetShare": 0.31,
          "usageRate": 0.28
        },
        "opportunity": {
          "tier": "featured",
          "weightedOpportunityIndex": 0.88,
          "insights": ["High route participation", "Target leader"]
        },
        "confidence": 0.91,
        "source": {
          "provider": "role-and-opportunity-model",
          "modelVersion": "role-opportunity-v1",
          "generatedAt": "2026-03-20T00:00:00.000Z"
        }
      }
    }
  }
}
```

Unavailable example:

```json
{
  "roleOpportunityInsight": {
    "available": false,
    "fetchedAt": "2026-03-20T00:00:00.000Z",
    "error": {
      "category": "upstream_timeout",
      "message": "Role-and-opportunity-model timed out after 5000ms."
    }
  }
}
```

---

## Philosophy

Fantasy analytics should be free. Every tool here is open-source and free to use, fork, and build on. If you find it useful, contribute back.

---

## Contributing

Issues and PRs welcome. See `manus/CONTRIBUTING.md` for guidelines.

## License

MIT
