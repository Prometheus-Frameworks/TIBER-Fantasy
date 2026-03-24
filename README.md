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
ROLE_OPPORTUNITY_MODEL_LAB_ENDPOINT_PATH=/api/role-opportunity/lab
ROLE_OPPORTUNITY_EXPORTS_PATH=./data/role-opportunity/role_opportunity_lab.json
AGE_CURVE_MODEL_BASE_URL=
AGE_CURVE_MODEL_LAB_ENDPOINT_PATH=/api/age-curves/lab
AGE_CURVE_PROMOTED_HANDOFF_PATH=./data/age-curves/arc_promoted_handoff.json
AGE_CURVE_EXPORTS_PATH=./data/age-curves/age_curve_lab.json
POINT_SCENARIO_MODEL_BASE_URL=
POINT_SCENARIO_MODEL_LAB_ENDPOINT_PATH=/api/point-scenarios/lab
POINT_SCENARIO_MODEL_TIMEOUT_MS=5000
POINT_SCENARIO_EXPORTS_PATH=./data/point-scenarios/point_scenario_lab.json
POINT_SCENARIO_MODEL_ENABLED=1
AGE_CURVE_MODEL_ENABLED=1
ROLE_OPPORTUNITY_MODEL_ENABLED=1
FORGE_SERVICE_BASE_URL=
FORGE_SERVICE_ENDPOINT_PATH=/v1/forge/evaluations
FORGE_SERVICE_TIMEOUT_MS=5000
FORGE_SERVICE_ENABLED=1
SIGNAL_VALIDATION_EXPORTS_DIR=./data/signal-validation
SIGNAL_VALIDATION_EXPORTS_ENABLED=1
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

### Production routing behavior

- `GET /health` is the canonical machine-readable health endpoint (Railway probe target).
- In production, `GET /` serves the frontend SPA shell when `dist/public/index.html` exists.
- If static frontend assets are missing in production, `GET /` safely falls back to a small JSON status response.

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
- **Client** handles base URL config, timeout control, compatibility-endpoint reads, and artifact fallback.
- **Adapter** validates canonical payloads at the edge and maps them into stable TIBER-facing shapes.
- **Service** exposes stable internal interfaces for routes and future enrichments.
- **Integration routes** now provide both a single-player inspection surface at `GET /api/integrations/role-opportunity/:playerId?season=2025&week=17` and a promoted read-only lab surface at `GET /api/data-lab/role-opportunity[?season=2025][&week=17]`.

This prepares TIBER-Fantasy for future promoted labs without forcing a repo-wide rewrite. New model repos should plug into the same boundary instead of issuing ad hoc fetches from feature code.

Signal-Validation-Model is now the first promoted read-only Data Lab module. `server/modules/externalModels/signalValidation/` reads exported `wr_player_signal_cards_{season}.csv` plus `wr_best_recipe_summary.json`, validates them at the edge, and powers `GET /api/data-lab/breakout-signals` plus the user-facing `/tiber-data-lab/breakout-signals` page. TIBER-Fantasy does **not** recompute breakout scores here; it only consumes promoted outputs and renders them with client-side sort/search/filter polish, grouped read-only detail sections, best-recipe provenance context, and explicit empty/loading/error guards.
For explicit operator handoff steps (export command, copy path, season-token alignment, and readiness checks), use `docs/runbooks/WR_BREAKOUT_SIGNAL_VALIDATION_HANDOFF.md`.

Role & Opportunity Lab is now the second promoted read-only Data Lab sub-model. `server/modules/externalModels/roleOpportunity/` reads either a TIBER-Data compatibility endpoint or a stable exported artifact, normalizes player/role/usage fields into a frontend-safe contract, and powers `GET /api/data-lab/role-opportunity` plus the user-facing `/tiber-data-lab/role-opportunity` page. This module is intentionally complementary to WR Breakout Lab: it is a usage/deployment context surface, not a projection engine, and TIBER-Fantasy does **not** recompute role scoring logic locally.

Age Curve / ARC Lab is now the third promoted read-only Data Lab sub-model. `server/modules/externalModels/ageCurves/` reads either an ARC compatibility endpoint or a stable exported artifact, normalizes developmental-context fields like age, career year, peer bucket, expected-vs-actual PPG, delta, trajectory label, and provenance, and powers `GET /api/data-lab/age-curves` plus the user-facing `/tiber-data-lab/age-curves` page. This module complements Breakout Lab and Role & Opportunity Lab by framing development context only; TIBER-Fantasy does **not** recompute ARC logic locally.

Point Scenario Lab is now the fourth promoted read-only Data Lab sub-model. `server/modules/externalModels/pointScenarios/` reads either a Point-prediction-Model compatibility endpoint or a stable exported artifact, normalizes scenario name/ID, player identity, baseline vs adjusted projections, delta, confidence, event type, explanation text, and provenance, and powers `GET /api/data-lab/point-scenarios` plus the user-facing `/tiber-data-lab/point-scenarios` page. This module is intentionally scenario-oriented and decision-supportive; TIBER-Fantasy does **not** author scenarios or recompute projection logic locally.

The four promoted Data Lab modules are now intended to operate as one product lane inside the hub: Breakout Lab for signal validation, Role & Opportunity Lab for deployment context, Age Curve / ARC Lab for developmental timing, and Point Scenario Lab for contingency-aware point outcomes. The hub and each promoted module now include stable promoted/read-only framing, concise "what this module is for" plus "when to use this" guidance, consistent loading/empty/error language, shared provenance wording, and cross-module navigation that can carry `playerId` / `playerName` / `team` plus season through deep links for faster operator workflows.

Player Research Workspace is now the first cross-model synthesis surface in that lane. `server/modules/externalModels/playerResearch/` orchestrates the four promoted read-only adapters without recomputing any model logic, powers `GET /api/data-lab/player-research`, and backs the user-facing `/tiber-data-lab/player-research` page with player search, `playerId` deep-linking, season carry-through, partial-data handling, and direct link-outs to the underlying lab pages.

Team Research Workspace is now the team-level complement to Player Research. `server/modules/externalModels/teamResearch/` orchestrates the same four promoted read-only adapters plus canonical team metadata without recomputing any model logic, powers `GET /api/data-lab/team-research`, and backs the user-facing `/tiber-data-lab/team-research` page with team search, `team` deep-linking, team identity/header context, high-level offensive summaries, key-player tables, partial-data handling, and direct player link-outs back into Player Research.

Data Lab Command Center is now the promoted lane's top-level front door. `server/modules/externalModels/dataLabCommandCenter/` orchestrates the same four promoted read-only adapters into a compact triage payload, powers `GET /api/data-lab/command-center`, and backs the user-facing `/tiber-data-lab/command-center` page with a lightweight module status strip, top-priority current signals, player/team quick links into deeper research surfaces, stable mixed available/unavailable section rendering, and explicit read-only / no-unified-score framing.

For operator readiness checks, `GET /api/data-lab/promoted-status` now returns explicit per-module diagnostics across all promoted surfaces (`ready`, `missing_export_artifact`, `upstream_unavailable`, `disabled_by_env_config`, `empty_dataset`) plus dependency checks like configured artifact paths and API base URL presence. The Data Lab hub and Command Center render this panel directly so production users can see what is truly wired and usable before trusting any promoted workflow.
Core product flows now surface lightweight Data Lab discovery hooks outside the lab itself: player-facing surfaces link into Player Research, player detail pages now carry a compact inline Research Summary block fed by promoted Player Research outputs, the Schedule / SoS team surface now includes a compact inline Team Research Summary block linked to the full Team Research Workspace, team labels can route into Team Research, and a compact read-only Command Center widget on the main dashboard gives users a low-friction way to enter the promoted research lane without turning core pages into Data Lab clones.

### Promoted lane operator verification (Breakout, Role & Opportunity, ARC)

Use this quick check to confirm the three promoted lanes are live before relying on them:

1. Configure the exact env vars + artifact contracts:
   - **Breakout (Signal Validation):** `SIGNAL_VALIDATION_EXPORTS_ENABLED=1`, `SIGNAL_VALIDATION_EXPORTS_DIR=<dir>` containing `wr_player_signal_cards_{season}.csv` and `wr_best_recipe_summary.json`.
   - **Role & Opportunity:** either `ROLE_OPPORTUNITY_MODEL_BASE_URL` (+ optional `ROLE_OPPORTUNITY_MODEL_LAB_ENDPOINT_PATH`) **or** `ROLE_OPPORTUNITY_EXPORTS_PATH=<file>` pointing to `role_opportunity_lab.json`.
   - **ARC:** either `AGE_CURVE_MODEL_BASE_URL` (+ optional `AGE_CURVE_MODEL_LAB_ENDPOINT_PATH`) **or** `AGE_CURVE_PROMOTED_HANDOFF_PATH=<file>` pointing to `arc_promoted_handoff.json` (legacy fallback: `AGE_CURVE_EXPORTS_PATH=.../age_curve_lab.json`).
2. Call status endpoint for your target season:
   - `curl -sS "http://localhost:5000/api/data-lab/promoted-status?season=2025" | jq`
3. Confirm each module row reports `status: "ready"`:
   - `moduleId: "breakout-signals"`
   - `moduleId: "role-opportunity"`
   - `moduleId: "age-curves"`
4. If any module is not ready, use that module’s `checks` + `detail` fields from the same response. They now report exact env var names, expected artifact filenames, and missing-artifact guidance.

FORGE now has its first migration-safe external adapter under `server/modules/externalModels/forge/`, but it is **compare-only** in this PR. Production FORGE routes still use the in-repo legacy implementation by default. The new migration surface is:
- `POST /api/integrations/forge/compare` — dual-runs legacy FORGE and external FORGE for the same single-player offensive E+G evaluation request.
- `GET /api/integrations/forge/health` — reports external FORGE config/readiness state.
- `GET /api/integrations/forge/parity-report` — returns a stable migration-only parity summary contract built from the committed fixture pack and existing parity harness.
- `GET /api/integrations/forge/review?position=WR&season=2025&week=17&limit=10&mode=redraft` — samples 1-25 players from the existing legacy FORGE batch source, reuses the compare service for each player, and returns one migration-only review payload with stable summary metrics plus per-player parity results.
- `npm run forge:parity` (or `tsx server/modules/externalModels/forge/runForgeParityHarness.ts`) — runs the raw labeled parity harness through the compare service and prints deterministic snapshot-style output for migration tracking.
- `npm run forge:parity:report` (or `tsx server/modules/externalModels/forge/runForgeParityReport.ts --json --out tmp/forge-parity-report.json`) — exports the stable parity report contract for local inspection or JSON snapshots.

The compare response keeps each side isolated (`legacy`, `external`) and adds stable diff metadata (`scoreDelta`, `componentDeltas`, `confidenceDelta`, `parityStatus`, `notes`) so migration analysis can happen without switching live product behavior.

The FORGE migration tooling now also includes a committed fixture pack plus a repeatable parity harness/report layer under `server/modules/externalModels/forge/`. Use it to re-run the same compact corpus of compare requests over time and track close/drift/unavailable outcomes without relying on ad hoc one-off checks. The stable parity report returns integration readiness metadata, aggregate summary counts, and a deterministic `results` array with per-fixture delta metadata for migration debugging and reporting.

The migration review endpoint is meant for operator review only. It does **not** switch defaults, does **not** replace rankings, does **not** persist history, and does **not** add any frontend UI. Use it when you want to quickly inspect drift patterns for a small sampled cohort (for example 10-25 WRs in a given season/week) without clicking through player detail one player at a time.

Recommended review workflow:
- Choose one offensive position (`QB`, `RB`, `WR`, or `TE`).
- Pass `season`, optional `week` (`season` or a week number), and `limit` between `1` and `25`.
- Keep `mode` aligned with the migration question you are inspecting (`redraft`, `dynasty`, or `bestball`).
- Treat `summary` as the top-level scan, then inspect `results[*].comparison.notes`, `scoreDelta`, and `componentDeltas` for the worst offenders.
- If external FORGE is disabled or unconfigured, the route still returns a stable unavailable review contract instead of crashing so operators can see why the batch was skipped.

Parity interpretation guide:
- `close` — both legacy and external FORGE returned comparable results within the current migration tolerance.
- `drift` — both sides returned data, but alpha/tier/pillar deltas exceeded the migration tolerance and deserve inspection.
- `unavailable` — at least one side could not return a usable evaluation, or the external integration is disabled/not configured.
- `not_comparable` — both sides returned data, but the outputs cannot be compared safely (for example, mismatched positions).

**Doctrine note:** TIBER-Fantasy is the product shell and orchestration core. Standalone model brains should live outside this repo when practical and be consumed through adapters/orchestrators. Any in-repo legacy model stacks are temporary unless they have an explicit core justification. See `docs/architecture/TIBER_FANTASY_MODULE_CLASSIFICATION_AUDIT.md` for the current cleanup map.

### Player detail enrichment

`GET /api/player-identity/player/:id` now supports explicit opt-in external enrichments:

```http
GET /api/player-identity/player/00-0036322?includeRoleOpportunity=true&season=2025&week=17
GET /api/player-identity/player/00-0036322?includeExternalForge=true&season=2025&week=season&externalForgeMode=redraft
GET /api/player-identity/player/00-0036322?includeForgeComparison=true&season=2025&week=season&externalForgeMode=redraft
```

Behavior:
- The base player detail payload is unchanged when both opt-ins are omitted.
- Role-opportunity insight is fetched only when `includeRoleOpportunity=true`.
- External FORGE preview is fetched only when `includeExternalForge=true`.
- Comparison preview is fetched only when `includeForgeComparison=true`, and it explicitly dual-runs legacy plus external FORGE for the same player detail request.
- Legacy FORGE remains the default source of truth; `externalForgeInsight` is additive migration/preview behavior only.
- `forgeComparison` is also migration-only preview behavior; it does not switch defaults, remove legacy FORGE, or change existing `/api/forge/*` behavior.
- Player-detail external insights flow through a reusable enrichment orchestrator under `server/modules/externalModels/playerDetailEnrichment/`, keeping the route thin and giving future enrichments a single plug-in point.
- External FORGE preview currently supports only QB/RB/WR/TE player detail, defaults `week` to `season`, and defaults `externalForgeMode` to `redraft`.
- Enrichment is non-fatal: if an external model is disabled, times out, returns malformed data, or has no record, the player detail response still returns `200 OK` with the normal player payload.

Added response fields when requested:

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
    },
    "externalForgeInsight": {
      "available": true,
      "fetchedAt": "2026-03-21T00:00:00.000Z",
      "data": {
        "playerId": "00-0036322",
        "playerName": "Justin Jefferson",
        "position": "WR",
        "team": "MIN",
        "season": 2025,
        "week": "season",
        "mode": "redraft",
        "score": {
          "alpha": 81.5,
          "tier": "T2",
          "tierRank": 2
        },
        "components": {
          "volume": 84,
          "efficiency": 78,
          "teamContext": 72,
          "stability": 80
        },
        "confidence": 0.82,
        "metadata": {
          "gamesSampled": 15,
          "positionRank": 2,
          "status": "ok",
          "issues": []
        },
        "source": {
          "provider": "external-forge",
          "contractVersion": "1.0.0",
          "modelVersion": "2026.03.0",
          "calibrationVersion": "alpha-redraft-2025-v1",
          "generatedAt": "2026-03-21T00:00:00.000Z"
        }
      }
    },
    "forgeComparison": {
      "available": true,
      "fetchedAt": "2026-03-21T00:00:00.000Z",
      "legacy": {
        "available": true,
        "data": {
          "score": {
            "alpha": 80,
            "tier": "T2",
            "tierRank": 2
          }
        }
      },
      "external": {
        "available": true,
        "data": {
          "score": {
            "alpha": 81.5,
            "tier": "T2",
            "tierRank": 2
          }
        }
      },
      "comparison": {
        "scoreDelta": 1.5,
        "componentDeltas": {
          "volume": 2,
          "efficiency": 1,
          "teamContext": 2,
          "stability": 1
        },
        "confidenceDelta": 0.02,
        "parityStatus": "close",
        "notes": [
          "Alpha delta stayed within migration tolerance at 1.5 points."
        ]
      }
    }
  }
}
```

`forgeComparison.parityStatus` uses the same migration semantics as the compare/parity tooling:
- `close` — both sides returned comparable results within the current tolerance.
- `drift` — both sides returned data, but score/tier/pillar deltas deserve inspection.
- `unavailable` — at least one side failed, so TIBER returns partial preview data without breaking player detail.
- `not_comparable` — both sides returned data, but the outputs should not be compared directly.

Unavailable preview example:

```json
{
  "externalForgeInsight": {
    "available": false,
    "fetchedAt": "2026-03-21T00:00:00.000Z",
    "error": {
      "category": "config_error",
      "message": "External FORGE integration is disabled by configuration."
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
