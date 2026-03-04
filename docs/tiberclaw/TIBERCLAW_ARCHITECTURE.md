# TiberClaw — System Architecture

**Version:** 1.0  
**Last updated:** March 2026  
**Status:** Engine live. League context built. Doctrine + GM layers pending.

---

## 1. System Overview

TiberClaw is the intelligence platform that connects AI agents, personal assistants, and developer tools to the Tiber scoring engine. It is the name for the full stack — the scoring engines, data pipeline, v1 REST API, authentication layer, and (in development) the dynasty reasoning layer.

The web application at tiber-fantasy.replit.app is one client of TiberClaw. An AI agent using the REST API is another. Both are equal consumers.

### Layer Stack

```
┌─────────────────────────────────────────────┐
│              Agent Layer                     │
│  (Claude, GPT, Grok, OpenClaw shell, etc.)  │
└────────────────────┬────────────────────────┘
                     │  x-tiber-key auth
┌────────────────────▼────────────────────────┐
│          TiberClaw Connector (v1 API)        │
│  Auth · Rate limiting · Request logging      │
└────────────────────┬────────────────────────┘
                     │
┌────────────────────▼────────────────────────┐
│         League Context Engine               │
│  Sleeper sync · Roster mapping · Snapshots  │
└────────────────────┬────────────────────────┘
                     │
┌────────────────────▼────────────────────────┐
│       Dynasty Strategy Doctrine Layer       │
│  Window detection · Aging curves · Market   │
└────────────────────┬────────────────────────┘
                     │
┌────────────────────▼────────────────────────┐
│           Tiber Core Engine                 │
│  FORGE · FIRE · CATALYST · ELT pipeline    │
└─────────────────────────────────────────────┘
```

### Layer Responsibilities

**Agent Layer**  
External consumers — AI agents, shell scripts (OpenClaw), developer integrations, and the web UI. Agents authenticate with an `x-tiber-key` and query TiberClaw endpoints. They do not access Tiber internals directly.

**TiberClaw Connector (v1 API)**  
The public-facing REST interface. Handles authentication, rate limiting (per key, per tier), and request logging. All responses follow a consistent envelope. This layer is live.

**League Context Engine**  
Binds an agent session to a specific fantasy league. Imports rosters from Sleeper, maps players to Tiber IDs, stores snapshots, and provides the roster and standings data that the Doctrine layer needs to reason about.

**Dynasty Strategy Doctrine Layer**  
Interprets Tiber engine scores through the lens of a specific team and league. Applies dynasty-specific reasoning modules (window detection, aging curves, market modeling). Does not store raw metrics — it produces evaluations. This layer is the primary build target.

**Tiber Core Engine**  
The data and scoring foundation. Includes the Bronze → Silver → Gold ELT pipeline, FORGE (player evaluation), FIRE (in-season rolling opportunity), CATALYST (clutch EPA metric), player identity resolution, and 131 database tables. The core engine has no strategy logic — it only produces metrics.

---

## 2. Tiber Engine Integration

TiberClaw exposes the Tiber engine through authenticated v1 endpoints. All endpoints below require the `x-tiber-key` header. The base URL is `/api/v1`.

### Live Endpoints

**Player lookup**
```
GET /api/v1/players/search?q={name}&position={pos}&limit={n}
```
Returns canonical player records with `gsis_id`, name, team, position, and status.

**FORGE — individual player**
```
GET /api/v1/forge/player/:playerId?mode={redraft|dynasty|bestball}&week={n}&season={yyyy}
```
Returns FORGE Alpha score (0–100), pillar breakdown (volume, efficiency, team context, stability), Tiber Tier, and dynasty-specific adjustments.

**FORGE — batch**
```
POST /api/v1/forge/batch
Body: { player_ids: [...], mode: "dynasty" }
```
Scores multiple players in one call. Use this for roster-level evaluation.

**FIRE — individual player**
```
GET /api/v1/fire/player/:playerId
```
Returns rolling 4-week opportunity score, role score, and expected vs. actual FPTs delta.

**FIRE — batch**
```
GET /api/v1/fire/batch?position={pos}&week={n}
```
Returns FIRE scores for all players at a position for the current or specified week.

**CATALYST**
```
GET /api/v1/catalyst/player/:playerId
```
Returns clutch performance metric derived from EPA and game-situation context.

**Rookies 2026**
```
GET /api/v1/rookies/2026
GET /api/v1/rookies/2026/leaderboard
GET /api/v1/rookies/2026/position/:pos
GET /api/v1/rookies/2026/:playerName
```
Returns TIBER-RAS v1 (class-relative) and TIBER-RAS v2 (historical percentile) scores with combine measurables and college production metrics.

**Platform health**
```
GET /api/v1/health
GET /api/v1/diagnostic
```

### Boundary Rule

The core engine produces metrics. It does not produce strategy. An endpoint like `/forge/player/:id` returns a score and pillars. It does not tell the agent whether to trade that player. That reasoning lives in the Doctrine Layer above.

---

## 3. League Context Engine

### Purpose

Before an agent can give dynasty advice, it must know the specific league it is advising in. Scoring settings, roster construction limits, trade tendencies, and standings all change what optimal play looks like. The League Context Engine provides this grounding.

### Existing Infrastructure

The following are already built and live (internal API, no v1 auth required yet):

```
POST /api/league-sync/sleeper     — import a league from Sleeper by league ID
POST /api/league-sync/sync        — re-sync an existing league
GET  /api/league-sync/leagues     — list imported leagues for a user

GET  /api/league-context          — get the active league context for a session
POST /api/league-context          — bind a session to a league + team

GET  /api/league-dashboard        — get full dashboard snapshot (rosters, standings, matchups)
GET  /api/league-dashboard/forge-sanity — verify FORGE coverage for league rosters
```

### League Context Schema

The `league_context` table stores vector-embedded context entries tied to a league. Each entry represents a discrete piece of league intelligence — a trade, a roster move, a note, or a roster snapshot.

```
league_context
  id              serial PK
  league_id       varchar → leagues.id
  content         text              "User traded CMC for Evans + 2nd"
  embedding       vector(768)       Gemini Flash embedding for semantic search
  metadata
    type          string            'trade' | 'roster_move' | 'waiver' | 'note' | 'roster'
    week          number
    season        number
    players       string[]          gsis_ids involved
    playerName    string
    tags          string[]          [position, team]
    synced_at     string
  created_at      timestamp
```

The `league_dashboard_snapshots` table stores point-in-time snapshots of full league state (rosters, standings, matchups) keyed by `(league_id, week, season)`.

### Agent Session Binding

Before a GM Mode session begins, the agent binds to a league:

```
POST /api/league-context
{ "user_id": "...", "league_id": "...", "team_id": "..." }
```

All subsequent calls in that session operate within this context. The agent's roster is known. Player IDs are resolved. The Doctrine layer can be invoked.

---

## 4. Dynasty Strategy Doctrine

### Purpose

The Doctrine Layer applies dynasty-specific reasoning to Tiber metrics and league context. It answers questions that FORGE alone cannot: Is this team in a build or a contention window? Which assets should be insulated? What does the league market value relative to Tiber?

This layer does not exist yet. It is the primary Phase 3 build target.

### Doctrine Modules

**Team Window Detection**  
Classifies each team as Contend | Retool | Rebuild | Tear Down based on roster age curve, FORGE Alpha concentration, depth, and draft capital.

**Asset Insulation Model**  
Identifies which players on a roster are "core assets" that should not be traded — high FORGE floor, age-appropriate for the window, irreplaceable given roster construction.

**Positional Aging Curves**  
Dynasty-specific aging priors by position. RB peaks 22–25, declines sharply after 27. WR peaks 24–27, long tail. TE peaks 25–28. QB extends to 35+. Curves adjust FORGE projections for dynasty valuation.

**League Market Modeling**  
Builds a model of what the specific league values vs. what Tiber values. If a league chronically overvalues QBs, that affects trade strategy. Built from transaction history and ADP data.

**Roster Construction Heuristics**  
Position limits, taxi squad rules, and roster balance requirements vary per league. This module validates whether a proposed move is legal and evaluates its effect on roster construction quality.

### Output Contract

Doctrine modules produce evaluations, not raw metrics. Example:

```json
{
  "team_id": "...",
  "window": "contend",
  "window_confidence": 0.82,
  "core_assets": ["justin-jefferson", "saquon-barkley"],
  "sell_candidates": ["mike-evans"],
  "reasoning": "Team is in a 2–3 year contention window. Evans is 31 and on a declining usage curve..."
}
```

---

## 5. GM Execution Layer

### Purpose

The GM Layer takes Doctrine evaluations and generates concrete, actionable outputs. It is the agent's interface for dynasty team management.

This layer partially exists (start-sit, targets endpoints). Full GM reasoning is a Phase 4 build target.

### Existing Endpoints

```
GET /api/strategy/start-sit?league_id=...&team_id=...&week=...
GET /api/strategy/targets?league_id=...&position=...
```

### Planned Output Types

- **Team archetype** — contend / retool / rebuild classification with reasoning
- **Trade suggestions** — specific player-for-player proposals with Tiber-backed valuations
- **Sell candidates** — players past their dynasty peak to move before market corrects
- **Buy candidates** — undervalued players relative to league market
- **Waiver targets** — FIRE-based opportunity leaders not yet rostered
- **Lineup recommendations** — start-sit with matchup and FIRE context

### Evaluation Pipeline

```
1. Pull roster from league_context (bound session)
2. Map players to Tiber gsis_ids (Identity Bridge)
3. Retrieve FORGE + FIRE metrics via batch endpoints
4. Apply Doctrine modules (window, aging curves, market model)
5. Generate strategic outputs
6. (Optional) Pass through LLM gateway for natural language explanation
```

### LLM Gateway Integration

Tiber includes a provider-agnostic LLM gateway (`server/llm/`) with fallback across OpenRouter, OpenAI, Anthropic, and Gemini. The GM Layer can route Doctrine outputs through this gateway to produce human-readable explanations. The LLM does not generate the analysis — it narrates it.

---

## 6. TiberClaw Operating Modes

### Engine Mode

Direct queries to Tiber metrics. No league context required. Agent authenticates with `x-tiber-key` and queries scoring endpoints directly.

```
Use case: "What is Justin Jefferson's FORGE score in dynasty mode?"
Endpoints: /api/v1/forge/player/:id, /api/v1/fire/player/:id
```

### League Mode

Agent is bound to a specific league. Roster data, standings, and league settings are available. Analysis is contextualized to the agent's team and league environment.

```
Use case: "Who on my roster should I be looking to sell?"
Requires: POST /api/league-context to bind session first
Endpoints: /api/league-dashboard, /api/strategy/*
```

### GM Mode

Full dynasty reasoning. Agent applies Doctrine modules to produce strategic evaluations and actionable trade/roster decisions for a specific team in a specific league.

```
Use case: "Evaluate my entire roster and tell me how I should be playing this offseason."
Requires: League context bound + Doctrine layer operational (Phase 3+)
Endpoints: GM endpoints (Phase 4 build target)
```

---

## 7. Authentication

All v1 endpoints require `x-tiber-key` in the request header.

```
x-tiber-key: tiber_sk_...
```

Keys are generated internally via `scripts/generate-api-key.ts`. Each key has a tier (`internal`, `standard`, `premium`) and a rate limit in requests per minute. All requests are logged to `api_request_log`.

Key management:
```
api_keys         — key hash, owner label, tier, rate limit, timestamps
api_request_log  — method, route, status, duration, request ID per call
```

---

## 8. Infrastructure Notes

- **Runtime**: Node.js / TypeScript (Express) + Python (Flask for ETL scripts)
- **Frontend**: React 18, Tailwind, shadcn/ui (one client among many)
- **Database**: PostgreSQL via Neon (serverless), Drizzle ORM, pgvector for embeddings
- **Deployment**: Replit autoscale (Cloud Run), bootstrap at `dist/index.mjs`
- **LLM Gateway**: OpenRouter → OpenAI → Anthropic → Gemini fallback chain
- **Player Identity**: `gsis_id` as canonical ID, Identity Bridge for cross-source resolution
- **League Sync**: Sleeper API is the primary platform integration
