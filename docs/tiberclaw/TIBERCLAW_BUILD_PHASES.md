# TiberClaw — Phased Build Plan

**Version:** 1.0  
**Last updated:** March 2026  
**Reference:** TIBERCLAW_ARCHITECTURE.md

---

## Build Status Summary

| Phase | Name | Status |
|---|---|---|
| Phase 1 | League Context Infrastructure | Live (partially) |
| Phase 2 | Agent Connector | Live |
| Phase 3 | Dynasty Doctrine Layer | Not started |
| Phase 4 | GM Execution Engine | Partial (start-sit, targets) |
| Phase 5 | League Intelligence | Not started |

---

## Phase 1 — League Context Infrastructure

**Status: Live (partial)**

### Objectives
Provide the data foundation that allows agents to operate within a specific fantasy league environment. Without this layer, the agent has no roster awareness and no league-specific context.

### What Is Already Built
- `POST /api/league-sync/sleeper` — full Sleeper league import (rosters, teams, standings, picks)
- `GET /api/league-sync/leagues` — list leagues synced for a user
- `POST /api/league-context` — bind a session to a league and team
- `GET /api/league-context` — retrieve active context
- `GET /api/league-dashboard` — full dashboard snapshot with matchups and standings
- `league_context` table — vector-embedded context entries (trades, moves, roster snapshots)
- `league_dashboard_snapshots` table — point-in-time league state keyed by week/season

### What Remains
- Expose league sync via authenticated v1 endpoints (`/api/v1/league/*`) so agents can import and query leagues through the same auth layer as scoring endpoints
- Add `future_picks` to the league context schema (currently stored in league snapshot payload but not as a first-class queryable field)
- Add `scoring_settings` normalization — currently raw from Sleeper, needs a canonical representation so doctrine modules can use it without parsing platform-specific formats

### Dependencies
- Sleeper API (live)
- `leagues`, `teams`, `rosters` tables (live)
- Player Identity Bridge for roster-to-gsis_id mapping (live)

### Expected Outputs
- Agent can call `tiberclaw connect <league_id>` equivalent
- Roster, standings, picks, and scoring settings available as structured data
- League state queryable by week and season

---

## Phase 2 — Agent Connector

**Status: Live**

### Objectives
Provide a stable, authenticated REST interface that agents and developers can query without any knowledge of Tiber internals.

### What Is Built
- `x-tiber-key` authentication on all `/api/v1/*` endpoints
- Rate limiting per key, per tier
- Request logging to `api_request_log`
- Key management via `api_keys` table
- Full v1 endpoint surface:
  - `GET /api/v1/players/search`
  - `GET /api/v1/forge/player/:id`
  - `POST /api/v1/forge/batch`
  - `GET /api/v1/fire/player/:id`
  - `GET /api/v1/fire/batch`
  - `GET /api/v1/catalyst/player/:id`
  - `GET /api/v1/rookies/2026` (+ leaderboard, position, player name variants)
  - `GET /api/v1/health`
  - `GET /api/v1/diagnostic`

### What Remains
- Expose league endpoints under `/api/v1/league/*` (Phase 1 completion dependency)
- OpenClaw skill — the shell-level connector that wraps v1 calls for Claude agents. This is a skill file, not server code, but it needs to be kept in sync with the v1 surface.
- Version negotiation header (`x-tiber-version`) for future API versioning

### Dependencies
- `api_keys` and `api_request_log` tables (live as of March 2026)

### Expected Outputs
- Any OpenClaw-compatible agent can authenticate, search players, retrieve FORGE/FIRE/CATALYST scores, and query rookie data with no friction

---

## Phase 3 — Dynasty Doctrine Layer

**Status: Not started — primary build target**

### Objectives
Apply dynasty-specific reasoning to Tiber metrics and league context. This is what separates TiberClaw from a simple stats API — it produces evaluations, not just numbers.

### Required Components

**3.1 — Team Window Detection**

Inputs: roster FORGE Alphas, player ages, draft capital (picks + grade), win/loss record  
Output: `{ window: "contend" | "retool" | "rebuild" | "tear_down", confidence: float, reasoning: string }`

Logic: Calculate roster age-weighted FORGE score. High score + low average age + picks = build. High score + aging starters + few picks = sell window. Low score + youth = rebuild.

**3.2 — Positional Aging Curves**

Inputs: player position, current age, FORGE trend (last 4 weeks vs. prior season)  
Output: dynasty value adjustment multiplier, years-of-peak-value estimate

Priors by position:
- RB: peak 22–25, sharp decline after 27, near-zero dynasty value at 29+
- WR: peak 24–27, gradual decline, usable to 31 with right role
- TE: peak 25–28, longest plateau of any skill position
- QB: peak 27–34, extends further in stable systems

**3.3 — Asset Insulation Model**

Inputs: roster, window classification, aging curve adjustments  
Output: list of `core_assets` (do not trade) and `movable_assets` (can be included in proposals)

Logic: Core = top FORGE players whose ages align with the team's window. Movable = high ADP but declining curve, or players the team has depth behind.

**3.4 — League Market Modeling**

Inputs: league transaction history, Sleeper ADP for the league's scoring format  
Output: `market_premium_map` — which positions/player types the league systematically overvalues vs. Tiber

Initially can use Sleeper's platform-wide ADP as a proxy. As transaction history accumulates, shift to league-specific model.

**3.5 — Roster Construction Heuristics**

Inputs: league roster settings (from league context), current roster, proposed changes  
Output: construction score, legality check, balance assessment

Validates: position limits, taxi eligibility, IR slot usage, positional balance (starter count vs. bench depth by position).

### Dependencies
- Phase 1 complete (league context available)
- Phase 2 live (FORGE/FIRE batch endpoints)
- `rookie_profiles` table (for rookie-specific aging curve seeding)

### Build Notes
- Doctrine modules are server-side only — no DB tables required for the initial implementation (stateless computation on top of existing data)
- Results can be cached in a new `doctrine_snapshots` table if latency becomes a concern
- Do not hardcode dynasty values — derive from Tiber metrics to stay engine-aligned

### Expected Outputs
- `GET /api/v1/dynasty/window?team_id=...` — team window classification
- `GET /api/v1/dynasty/core-assets?team_id=...` — insulation recommendations
- `GET /api/v1/dynasty/aging?player_id=...` — curve-adjusted value
- All outputs include a `reasoning` field for agent consumption

---

## Phase 4 — GM Execution Engine

**Status: Partial (start-sit and targets exist at internal endpoints)**

### Objectives
Generate concrete, actionable outputs for dynasty team management. This is the layer an agent surfaces to the end user.

### Existing Endpoints
```
GET /api/strategy/start-sit   — weekly start/sit with FIRE context
GET /api/strategy/targets     — waiver and buy targets by position
```
These are functional but not authenticated via v1 and not Doctrine-aware.

### Required Components

**4.1 — Roster Evaluation Report**

Full evaluation of a team's roster through FORGE, FIRE, aging curves, and window classification. The entry point for GM Mode.

Output: complete team evaluation with tier per player, window classification, core vs. movable list, key vulnerabilities.

**4.2 — Trade Suggestion Engine**

Inputs: roster evaluation, league market model, available trade partners  
Logic: identify movable assets → identify likely trade partners (who needs your surplus) → propose deals that improve both sides according to Tiber valuation → apply market model to find exploitable pricing gaps  
Output: specific trade proposals with Tiber-backed rationale

**4.3 — Sell Candidate Identification**

Inputs: aging curve output, FIRE trend (declining opportunity), market model  
Logic: players approaching or past dynasty peak where market valuation lags Tiber's forward projection  
Output: ranked sell list with sell-by window estimate

**4.4 — Waiver Wire Prioritization**

Inputs: FIRE batch for current week, roster construction gaps  
Logic: rank unrostered players by opportunity score, filter by roster fit  
Output: ranked waiver list with fit rationale

**4.5 — Start-Sit Upgrade (v2)**

Upgrade existing `/api/strategy/start-sit` to be v1-authenticated, Doctrine-aware (considers whether the team is in a win-now or development mode), and FIRE-weighted for current-week context.

### Dependencies
- Phase 2 live
- Phase 3 complete (Doctrine layer needed for trade and sell logic)
- League market model seeded with transaction history

### Expected Outputs
- `GET /api/v1/gm/roster-eval?team_id=...&league_id=...`
- `GET /api/v1/gm/trade-targets?team_id=...&league_id=...`
- `GET /api/v1/gm/sell-candidates?team_id=...&league_id=...`
- `GET /api/v1/gm/waiver-wire?team_id=...&league_id=...&week=...`
- `GET /api/v1/gm/start-sit?team_id=...&league_id=...&week=...`

---

## Phase 5 — League Intelligence

**Status: Not started**

### Objectives
Shift the analysis scope from a single team to the full league ecosystem. Identify market inefficiencies, model trade network dynamics, and surface meta-level insights about league tendencies.

### Required Components

**5.1 — Full League Scan**

Run Doctrine evaluation across every team in a league simultaneously. Classify each team's window and asset structure. Produces a league-wide map of who is building, contending, or tanking.

Use: find which rebuilding teams hold assets you need. Find which contending teams are desperate for your surplus.

**5.2 — Market Inefficiency Detection**

Compare Tiber valuations to league-specific transaction history across the full roster pool. Identify player types or positions systematically mispriced in this league.

Use: buy undervalued positions before the league corrects. Avoid overpaying for positions the league overvalues.

**5.3 — Trade Network Analysis**

Map which teams historically trade with each other. Identify which team managers are active vs. passive. Flag likely trading partners based on complementary window and position surplus/deficit.

**5.4 — Competitive Landscape Report**

Full-league assessment: who are the legitimate threats to win this season, who is on a 3-year rebuild, what the positional arms race looks like at WR vs. TE vs. QB. Produces a league meta document an agent can reference when advising on any decision.

### Dependencies
- Phase 4 operational (roster evaluation must run for all teams)
- Meaningful transaction history in `league_context` (requires at least one active season)

### Expected Outputs
- `GET /api/v1/league-intel/scan?league_id=...` — full league window map
- `GET /api/v1/league-intel/inefficiencies?league_id=...` — market pricing gaps
- `GET /api/v1/league-intel/trade-network?league_id=...` — partner analysis
- `GET /api/v1/league-intel/landscape?league_id=...` — competitive report

---

## Implementation Notes for Agents

### Reading This Document

This document is a contract, not a wishlist. Phases 1 and 2 are done — do not rebuild what exists. Verify against the live repo before starting any phase.

### Where to Start Phase 3

Begin with Team Window Detection (3.1) and Positional Aging Curves (3.2). These are the foundation that all other Doctrine modules depend on. They can be built as stateless TypeScript functions in `server/services/doctrine/` before being exposed through routes.

### Tiber Boundary Rule

Never move scoring logic into the Doctrine layer. If you find yourself querying play-by-play data or computing EPA inside a Doctrine module, stop. That belongs in Tiber Core. The Doctrine layer consumes FORGE/FIRE/CATALYST outputs via the v1 API.

### File Locations

```
server/services/doctrine/        — Doctrine module implementations
server/api/v1/routes.ts          — add new v1 endpoints here (dynasty/*, gm/*, league-intel/*)
docs/tiberclaw/                  — this document lives here
shared/schema.ts                 — add any new tables here first
```

### Do Not

- Add strategy logic to `server/routes/forgeRoutes.ts` or any engine file
- Create separate authentication for TiberClaw — it uses the existing `x-tiber-key` system
- Hardcode player values — always derive from Tiber metrics
- Skip Phase 3 to build Phase 4 — GM outputs are only as good as the Doctrine beneath them
