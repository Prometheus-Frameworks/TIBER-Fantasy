# TiberClaw — Phased Build Plan

**Version:** 1.1  
**Last updated:** March 2026  
**Reference:** TIBERCLAW_ARCHITECTURE.md

---

## Prerequisites (Already Live)

Before the phases begin, the following infrastructure is complete and must not be rebuilt:

| Component | Status | Notes |
|---|---|---|
| v1 API auth (`x-tiber-key`) | Live | All `/api/v1/*` endpoints authenticated |
| FORGE / FIRE / CATALYST endpoints | Live | `/api/v1/forge/player`, `/fire/player`, `/catalyst/player` |
| Player search | Live | `/api/v1/players/search` |
| Rookies 2026 | Live | `/api/v1/rookies/2026` + variants |
| API key management | Live | `api_keys` + `api_request_log` tables |
| Request logging | Live | Per-key, per-tier rate limiting |
| Sleeper league import | Live | `POST /api/league-sync/sleeper` |
| League context binding | Live | `POST/GET /api/league-context` |
| League dashboard snapshot | Live | `GET /api/league-dashboard` |

Agents reading this plan: verify the above against the live repo before starting any phase.

---

## Build Status

| Phase | Name | Status |
|---|---|---|
| Phase 1 | Stabilize League Context Infrastructure | In progress |
| Phase 2 | Expose League Context via Authenticated v1 Endpoints | Not started |
| Phase 3 | Doctrine Layer Implementation | Not started |
| Phase 4 | GM Execution Endpoints | Not started |
| Phase 5 | League-Wide Market Intelligence | Not started |

---

## Phase 1 — Stabilize League Context Infrastructure

**Status: In progress**

### Objectives
Complete and harden the league context layer so it provides a reliable, structured data foundation for Doctrine modules. The basic import and binding work — the remaining tasks normalize the data and define its lifecycle.

### Required Components

**1.1 — Snapshot Lifecycle Implementation**

Implement the four snapshot triggers defined in the Architecture doc:
- `league_import` → snapshot on first sync (already happens implicitly, needs explicit tagging)
- `weekly_rollover` → automated snapshot after final MNF game (scheduler hook required)
- `transaction_event` → optional snapshot per trade/waiver (configurable per league)
- `manual_refresh` → snapshot on `POST /api/league-sync/sync` (already happens, needs retention flag)

Add a `snapshot_type` column to `league_dashboard_snapshots` to distinguish trigger source. Implement 90-day pruning for `transaction_event` snapshots.

**1.2 — Scoring Settings Normalization**

Current state: scoring settings are stored raw from Sleeper's JSON format. Doctrine modules cannot consume platform-specific formats.

Task: write a `normalizeScoringSettings()` function that maps Sleeper's scoring format to a canonical representation:

```typescript
interface ScoringSettings {
  rec: number;           // PPR value (0, 0.5, 1.0)
  pass_td: number;
  rush_td: number;
  rec_td: number;
  bonus_rec_te: number;  // TE premium
  [key: string]: number;
}
```

**1.3 — Future Picks as First-Class Field**

Draft picks are currently stored inside the league snapshot payload as unstructured JSON. Doctrine modules need picks as queryable data.

Task: add a `future_picks` table (or a typed column on the league snapshot) that surfaces pick data as structured records with `season`, `round`, `original_owner`, `current_owner`, and `pick_grade` (1st/2nd/3rd tier classification).

### Dependencies
- Sleeper API (live)
- `leagues`, `teams`, `rosters`, `league_dashboard_snapshots` tables (live)

### Expected Outputs
- `snapshot_type` field on snapshots with correct trigger labeling
- `ScoringSettings` normalized object available from league context
- `future_picks` queryable as structured data
- League state reads from snapshots, not live Sleeper calls

---

## Phase 2 — Expose League Context via Authenticated v1 Endpoints

**Status: Not started**

### Objectives
Bring the league context layer under the same `x-tiber-key` auth that covers scoring endpoints. Currently, league sync and context endpoints are internal only. Agents need to call them through the v1 surface.

### Required Components

**2.1 — v1 League Endpoints**

Add the following routes to `server/api/v1/routes.ts`:

```
POST /api/v1/league/connect          — import + bind (wraps league-sync/sleeper + league-context)
POST /api/v1/league/sync             — re-sync an existing league
GET  /api/v1/league/context          — get current session context
GET  /api/v1/league/roster           — get bound team's roster with Tiber IDs resolved
GET  /api/v1/league/standings        — current standings
GET  /api/v1/league/picks            — future picks for bound team (Phase 1.3 dependency)
GET  /api/v1/league/scoring          — normalized scoring settings
```

All routes sit behind the existing `auth` and `rateLimit` middleware. No new auth system.

**2.2 — Agent Session Object**

Implement the `AgentSession` interface from the Architecture doc. Sessions are created on `POST /api/v1/league/connect` and return a `session_id` the agent can pass in subsequent calls.

```typescript
interface AgentSession {
  session_id: string;
  agent_id: string;
  league_id: string;
  team_id: string;
  mode: "engine" | "league" | "gm";
  created_at: string;
  expires_at: string;
}
```

Store sessions in a lightweight `agent_sessions` table or in memory with TTL (in-memory is acceptable for initial implementation).

**2.3 — OpenClaw Skill Sync**

Update the OpenClaw connector skill to wrap the new v1 league endpoints. This is a skill file update, not server code.

### Dependencies
- Phase 1 complete (normalized scoring settings, picks as structured data)
- `api_keys` auth middleware (live)

### Expected Outputs
- Agent can authenticate once with `x-tiber-key`, then call `POST /api/v1/league/connect` to bind to a league
- All subsequent calls return league-contextualized data
- Session object tracks mode, expiry, and league binding

---

## Phase 3 — Doctrine Layer Implementation

**Status: Not started — primary build target**

### Objectives
Implement the five Doctrine modules in `server/doctrine/`. Each module consumes Tiber metrics and league context, and returns a `DoctrineEvaluation` object conforming to the standardized schema.

### Implementation Location

```
server/doctrine/
  types.ts                           — DoctrineEvaluation interface, shared types
  team_window_detection.ts
  positional_aging_curves.ts
  asset_insulation_model.ts
  league_market_model.ts
  roster_construction_heuristics.ts
```

All modules are TypeScript only. No Python. No shared mutable state between modules.

### Standardized Output (all modules)

```typescript
interface DoctrineEvaluation {
  module: string;
  entity_type: "team" | "player" | "league";
  entity_id: string;
  evaluation_score: number;      // 0–1 normalized
  confidence: number;            // 0–1
  contributing_signals: string[];
  reasoning: string;
  generated_at: string;
}
```

No module may return a custom format. The `contributing_signals` array must name each signal explicitly so outputs are auditable.

### Required Components

**3.1 — `types.ts` (build first)**

Define `DoctrineEvaluation`, aging curve priors by position, window classification enum (`contend | retool | rebuild | tear_down`), and shared signal name constants. All modules import from this file.

**3.2 — Team Window Detection**

```
Inputs:  roster FORGE Alphas (via POST /api/v1/forge/batch)
         player ages
         draft capital (future_picks from Phase 1.3)
         win/loss record (standings from league context)

Signals: age_weighted_forge_score, draft_capital_score, starter_concentration,
         depth_score, record_trajectory

Logic:   compute age-weighted FORGE mean → classify window →
         set evaluation_score (0=tear_down, 1=peak_contend)
```

**3.3 — Positional Aging Curves**

```
Inputs:  player gsis_id, position, current age, FORGE trend (last 4 weeks)

Priors:
  RB:  peak 22–25, cliff at 27, near-zero at 29+
  WR:  peak 24–27, gradual decline, viable to 31
  TE:  peak 25–28, longest plateau
  QB:  peak 27–34, extends in stable systems

Output:  evaluation_score = dynasty value multiplier (0–1)
         contributing_signals: ["age", "position_curve", "forge_trend"]
```

**3.4 — Asset Insulation Model**

```
Inputs:  roster, window classification (from 3.2), aging curve scores (from 3.3)

Logic:   core = players where (age curve score > 0.6) AND (forge_alpha > 65) 
                AND (age aligns with window)
         evaluation_score per player = insulation strength (1 = untouchable)

Output:  one DoctrineEvaluation per player on roster
```

**3.5 — League Market Model**

```
Inputs:  league_market_signals (see Architecture doc, Section 4)

Signals:
  trade_frequency_per_team
  positional_trade_bias
  average_roster_age_by_team
  draft_pick_liquidity_distribution
  rebuild_team_count
  contender_team_count
  waiver_activity_rate
  qb_premium_index

Output:  evaluation_score = market inefficiency index (0=efficient, 1=maximally biased)
         market_premium_map embedded in contributing_signals
```

Bootstrap with Sleeper platform-wide ADP. Shift to league-specific model as transaction history accumulates.

**3.6 — Roster Construction Heuristics**

```
Inputs:  league scoring settings (normalized from Phase 1.2)
         current roster
         proposed changes (optional)

Validates:
  - position limits per league rules
  - taxi squad eligibility
  - IR slot usage
  - positional balance (starter count vs. bench depth by position)

Output:  evaluation_score = construction quality (0–1)
         contributing_signals list legality issues and balance gaps
```

### Build Order

Build in this order. Each module depends on the previous:
1. `types.ts`
2. `positional_aging_curves.ts` (no dependencies on other modules)
3. `team_window_detection.ts` (depends on aging curves for window scoring)
4. `asset_insulation_model.ts` (depends on window + aging)
5. `league_market_model.ts` (independent, needs transaction history)
6. `roster_construction_heuristics.ts` (independent, needs scoring settings from Phase 1)

### Dependencies
- Phase 1 complete (scoring settings, picks structured)
- Phase 2 complete (v1 league endpoints providing roster and context)
- FORGE/FIRE batch endpoints (live)

### Expected Outputs

```
GET /api/v1/doctrine/window?team_id=...&league_id=...
GET /api/v1/doctrine/aging?player_id=...
GET /api/v1/doctrine/insulation?team_id=...&league_id=...
GET /api/v1/doctrine/market?league_id=...
GET /api/v1/doctrine/construction?team_id=...&league_id=...
```

All return `DoctrineEvaluation`. All include `reasoning` field.

---

## Phase 4 — GM Execution Endpoints

**Status: Not started**

### Objectives
Compose Doctrine evaluations into actionable GM outputs. This is the layer an agent surfaces to an end user asking dynasty questions.

### Evaluation Pipeline

```
1. Pull roster from bound session (v1 league endpoints)
2. Resolve player IDs via Identity Bridge
3. Retrieve FORGE + FIRE scores via batch endpoints
4. Run applicable Doctrine modules
5. Compose DoctrineEvaluations into GM output
6. (Optional) Route through LLM gateway for natural language narrative
```

The LLM receives only the composed `DoctrineEvaluation[]` — never raw metrics.

### Required Components

**4.1 — Roster Evaluation Report**

Entry point for GM Mode. Runs window detection, aging curves, and insulation model across the full roster. Returns a complete team profile.

```
GET /api/v1/gm/roster-eval?team_id=...&league_id=...
```

**4.2 — Trade Suggestion Engine**

```
Inputs:  roster evaluation (4.1), league market model, league standings
Logic:   identify movable assets → find complementary surplus/deficit across
         league → propose specific swaps exploiting market pricing gaps
Output:  ranked trade proposals with Tiber-backed rationale

GET /api/v1/gm/trade-targets?team_id=...&league_id=...
```

**4.3 — Sell Candidate Identification**

```
Inputs:  aging curve scores, FIRE trend, market model
Logic:   players past dynasty peak where market valuation lags Tiber projection
Output:  ranked sell list with sell-by window estimate

GET /api/v1/gm/sell-candidates?team_id=...&league_id=...
```

**4.4 — Waiver Wire Prioritization**

```
Inputs:  FIRE batch (current week), roster construction gaps
Logic:   rank unrostered players by opportunity score, filter by roster fit
Output:  ranked waiver list with fit rationale

GET /api/v1/gm/waiver-wire?team_id=...&league_id=...&week=...
```

**4.5 — Start-Sit (v2)**

Upgrade existing `/api/strategy/start-sit` to be v1-authenticated and Doctrine-aware. Considers team window (win-now vs. development) when weighting lineup decisions.

```
GET /api/v1/gm/start-sit?team_id=...&league_id=...&week=...
```

### Dependencies
- Phase 3 complete (all Doctrine modules operational)
- League market model seeded (at least partial transaction history)

### Expected Outputs
- All five GM endpoints live under `/api/v1/gm/*`
- All outputs auditable — `contributing_signals` visible in response
- LLM narrative optional via `?narrative=true` query param

---

## Phase 5 — League-Wide Market Intelligence

**Status: Not started**

### Objectives
Expand from single-team analysis to the full league ecosystem. Surface market inefficiencies, trade network dynamics, and competitive landscape for use in any GM Mode decision.

### Required Components

**5.1 — Full League Scan**

Run Doctrine evaluation across every team simultaneously. Produces a league-wide window map: who is contending, retooling, rebuilding, or tearing down. Used by the trade suggestion engine to find natural trading partners.

```
GET /api/v1/league-intel/scan?league_id=...
```

**5.2 — Market Inefficiency Detection**

Compare Tiber valuations to league-specific transaction history across the full roster pool. Identify player types or positions systematically mispriced relative to FORGE.

```
GET /api/v1/league-intel/inefficiencies?league_id=...
```

**5.3 — Trade Network Analysis**

Map historical trading relationships. Identify active vs. passive managers. Flag likely partners based on complementary window classification and position surplus/deficit.

```
GET /api/v1/league-intel/trade-network?league_id=...
```

**5.4 — Competitive Landscape Report**

Full-league assessment: legitimate contenders, rebuild timelines, positional arms race, win-now desperation index. Produces a meta document the agent can reference for any decision.

```
GET /api/v1/league-intel/landscape?league_id=...
```

### Dependencies
- Phase 4 operational (roster evaluation must run for all teams)
- Meaningful transaction history in `league_context` (requires at least one active season of data)

### Expected Outputs
- All four endpoints live under `/api/v1/league-intel/*`
- Phase 5 feeds back into Phase 4 (trade suggestions improve with full league scan)

---

## Implementation Rules for All Agents

### Do Not
- Rebuild what is already live (see Prerequisites)
- Add strategy logic to engine files (`forgeRoutes.ts`, etc.)
- Create separate authentication — use the existing `x-tiber-key` system
- Hardcode player values — derive from Tiber metrics
- Return custom output shapes from Doctrine modules — use `DoctrineEvaluation`
- Pass raw Tiber metrics to the LLM gateway — pass only `DoctrineEvaluation` objects
- Skip a phase to start the next — dependencies are real

### File Locations

```
server/doctrine/          — all Doctrine modules (Phase 3)
server/api/v1/routes.ts   — all new v1 endpoints (Phases 2, 3, 4, 5)
shared/schema.ts          — any new DB tables (define here first)
docs/tiberclaw/           — architecture and build plan live here
```

### Verifying Prerequisites

Before starting any phase, run:
```
GET /api/v1/health        — confirms v1 API is up
GET /api/v1/diagnostic    — confirms DB and key auth are live
```

Then check the repo for existing route files before assuming something needs to be built.
