# FORGE Externalization Transition Spec

## A. Executive Summary

FORGE currently lives inside TIBER-Fantasy core as a large in-repo grading system that computes player evaluations, rankings, tiers, transparency views, cached rankings snapshots, and related context for multiple product surfaces. The audited in-repo footprint includes offensive FORGE engine/grading paths, an IDP branch, Express routes under `/api/forge/*`, cached grade generation for `/tiers`, supporting SoS/environment/matchup enrichments, and several downstream consumers that either call FORGE routes or import FORGE services directly.

FORGE should move out of core because it behaves like a standalone model brain more than a thin product-shell concern. The repository already has an external-model adapter pattern proven by the role-opportunity integration, and the module classification audit already marks FORGE as `LEGACY_CORE_TEMP` rather than permanent expansion space. Keeping the core app responsible for transport, UI orchestration, response shaping, and failure handling is consistent with the current architecture doctrine; keeping the full scoring brain in-repo is not.

After externalization, TIBER-Fantasy should still own:

- adapter/client code for talking to the external FORGE service;
- route-level request validation and stable TIBER response envelopes;
- orchestration that combines FORGE with SoS, caching, player detail hydration, and future multi-model experiences;
- UI-facing integration and backwards-compatible route semantics where we choose to preserve them;
- non-fatal failure handling, observability, feature flags, and migration controls;
- any truly product-shell concerns that are not part of the standalone FORGE brain.

This PR does **not** extract code, rewrite runtime paths, or delete the in-repo FORGE implementation. It defines the target contract and staged migration plan so the future external FORGE repo has a concrete implementation target.

## B. Current State Inventory

### Major in-repo FORGE paths

Identified primary paths:

- `server/modules/forge/routes.ts` — main FORGE HTTP surface, including `/preview`, `/score/:playerId`, `/batch`, `/eg/*`, `/transparency/:playerId`, `/tiers`, `/compute-grades`, SoS/env/matchup endpoints, search, and player context.
- `server/modules/forge/forgeService.ts` — legacy service façade for single-player and batch scoring.
- `server/modules/forge/forgeGateway.ts` — internal non-HTTP gateway used by other modules.
- `server/modules/forge/context/contextFetcher.ts` — heavy context aggregation and DB reads.
- `server/modules/forge/forgeEngine.ts`, `forgeGrading.ts`, `forgeFootballLens.ts`, `recursiveAlphaEngine.ts`, `alphaEngine.ts` — core offensive engine/grading stack.
- `server/modules/forge/forgeGradeCache.ts` — precomputed grades backing `/api/forge/tiers`.
- `server/modules/forge/{sosService.ts, environmentService.ts, matchupService.ts, dvpMatchupService.ts, qbContextPopulator.ts}` — supporting context/enrichment services.
- `server/modules/forge/idp/*` — separate IDP FORGE branch and route tree mounted under `/api/forge/idp/*`.

### Identified consumers

Confirmed route/service consumers:

- `server/api/v1/routes.ts` proxies v1 FORGE player and batch requests to existing `/api/forge/eg/player/:playerId` and `/api/forge/batch` endpoints.
- `server/modules/ovr/ovrForgeAdapter.ts` imports the internal FORGE gateway for OVR calculations.
- `server/services/leagueDashboardService.ts` directly calls `forgeService.getForgeScoresForPlayers(...)` to backfill missing roster alpha values.
- `server/services/forgeContextLoader.ts` directly calls `forgeService` and SoS utilities to build ranking/player snapshots.

Identified frontend/API consumers:

- `client/src/api/forge.ts` wraps `/api/forge/batch`, `/api/forge/score/:playerId`, `/api/forge/search-players`, `/api/forge/player-context/:playerId`, and `/api/forge/snapshot`.
- User/admin pages calling FORGE routes include `ForgeLab`, `ForgeWorkbench`, `ForgeTransparency`, `TiberTiers`, `WRRankings`, `RBRankings`, `QBRankings`, `TERankings`, `SchedulePage`, `RankingsHub`, `TiberClawPage`, `MatchupsPage`, `IdpLab`, and several admin pages.
- `CompareDrawerContent` calls `/api/forge/eg/player/:playerId` for side-by-side player comparisons.
- `PlaybookTab` calls `/api/forge/score/:playerId`.

### Known dependencies

Identified shared types / contracts:

- `server/modules/forge/types.ts` defines the legacy FORGE service types, score shape, and score options.
- `shared/types/intelligence.ts` contains canonical TIBER-facing intelligence primitives and canonical pillar names (`volume`, `efficiency`, `team_context`, `stability`) that future adapters should map to.

Identified database coupling and query patterns:

- `context/contextFetcher.ts` reads from identity, weekly stats, advanced metrics, Datadive snapshots, defensive context, team environment, DvP, injury/live status, QB context inputs, and xFPTS-related sources. The exact read mix varies by position and season, with fallback logic between Datadive and legacy tables.
- `forgeGradeCache.ts` writes and reads `forge_grade_cache`, and also reads `datadive_snapshot_player_week` when building tier cache rows.
- `forgePlayerContext.ts` queries `player_identity_map`, `forge_player_current_team`, `wr_advanced_stats_2025`, `rb_advanced_stats_2025`, and `forge_player_advanced_qb`.
- `shared/schema.ts` defines `forge_team_environment`, `forge_team_matchup_context`, `forge_player_state`, `forge_grade_cache`, `qb_context_2025`, and `player_live_status`, showing that FORGE currently owns both runtime scoring concerns and persistence/caching concerns.
- IDP FORGE uses raw SQL against `idp_player_season` and `idp_player_week` via `server/modules/forge/idp/idpForgeEngine.ts` and `idpForgeRoutes.ts`.

### Current output shapes / response patterns

Identified current route envelopes are inconsistent across endpoints:

- `/api/forge/score/:playerId` returns `{ success, score, _sentinel }`.
- `/api/forge/batch` returns `{ success, scores, meta, _sentinel }`.
- `/api/forge/eg/batch` returns `{ success, meta, scores }` where each score has `alpha`, `tier`, `pillars`, `issues`, and `debug`.
- `/api/forge/eg/player/:playerId` returns `{ success, meta, score }` with `rawMetrics` included.
- `/api/forge/transparency/:playerId` returns a custom object with `player`, `season`, `week`, `alphaFinal`, `alphaRaw`, `pillars`, `recursion`, `weeklyHistory`, `issues`, `summary`, and `debug`.
- `/api/forge/tiers` returns `{ season, asOfWeek, position, computedAt, version, count, fallback, players }`, without the `success` wrapper used elsewhere.
- `/api/forge/player-context/:playerId` returns the context object directly, while `/api/forge/search-players` returns a bare array.
- IDP routes under `/api/forge/idp/*` use still different envelopes.

Because the live runtime surfaces are inconsistent, the future external contract should be **cleaner than the current route set**, while TIBER adapters preserve or intentionally reshape the legacy route envelopes for existing consumers.

### Consumer confidence note

This inventory is based on repository inspection, route registration, direct imports, and obvious UI fetches. It should be treated as **identified consumer coverage**, not a claim that every runtime consumer has been fully proven. Unknown indirect callers, scripts, or off-repo clients may still exist.

## C. Proposed External FORGE Responsibility

The future external FORGE repo/service should own the standalone model brain responsibilities:

1. **Canonical FORGE evaluation logic**
   - offensive scoring logic for player evaluation and rankings;
   - scoring modes (`redraft`, `dynasty`, `best_ball` / `bestball`);
   - pillar computation;
   - alpha computation and calibration;
   - confidence scoring;
   - model metadata and versioning.

2. **Model-side explanation payloads**
   - component/pillar outputs;
   - warnings/issues generated by model rules;
   - optional debug metadata that is safe for adapter consumption;
   - source/input coverage metadata.

3. **Batch and ranking generation**
   - evaluate one or many explicit players;
   - generate ranked outputs for a requested position and scope;
   - return stable item-level evaluation shapes so TIBER can render rankings or player detail from the same core item contract.

4. **Model-side provenance metadata**
   - model version / ruleset version / calibration version;
   - source data window used;
   - any coverage/degradation flags needed to interpret results.

The external FORGE service should **not** own:

- TIBER-specific Express route envelopes and compatibility shims;
- TIBER UI formatting decisions;
- non-FORGE product orchestration;
- cross-model composition with Role Opportunity, FIRE, CATALYST, Doctrine, etc.;
- TIBER page-specific caching policy;
- TIBER feature flags, adapter fallback rules, or partial-failure semantics;
- TIBER-specific SoS overlay fields unless we deliberately move SoS into the external service in a later follow-up.

### Scope recommendation for v1 externalization

The identified high-value path is the **offensive FORGE contract** first. The repo also contains an IDP branch under `server/modules/forge/idp/*`, but the audited UI/runtime consumers in this PR are dominated by offensive FORGE surfaces. The safest v1 transition target is:

- **Required in external FORGE v1:** QB/RB/WR/TE player evaluation + rankings.
- **Explicitly deferred or versioned separately:** IDP FORGE unless a later implementation PR confirms that the same contract family should include `EDGE/DI/LB/CB/S` from day one.

That means the external contract defined below is offensive-first but leaves room for future position-family expansion.

## D. Proposed TIBER-Fantasy Responsibility After Migration

After migration, TIBER-Fantasy should still own:

### 1. Adapters / clients

- `server/modules/externalModels/forge/` (or equivalent) should contain:
  - a transport client;
  - request/response validation;
  - typed error mapping;
  - internal stable service functions consumed by routes and orchestrators.

### 2. Orchestration

TIBER should orchestrate how FORGE is used inside product flows:

- routing and request validation;
- joining FORGE outputs with SoS, player identity, or other product-side enrichments;
- preserving current route behavior where needed during transition;
- coordinating multi-model pages and player detail assembly.

### 3. Response shaping

TIBER should map the external FORGE contract into:

- existing `/api/forge/*` route envelopes during migration;
- canonical `shared/types/intelligence.ts` responses where appropriate;
- any legacy compatibility payloads still required by UI surfaces.

### 4. UI-facing integration

TIBER should continue to own:

- page-level query parameters;
- frontend fetch hooks and page semantics;
- compatibility for current rankings/transparency/workbench pages;
- any client-side sorting, filtering, and view composition that is product-specific.

### 5. Caching

If caching remains necessary, TIBER should own:

- route-side or adapter-side memoization;
- persisted cache tables or read models used by pages like `/tiers`;
- cache freshness policy and fallback behavior;
- optional dual-read comparisons during migration.

The future external FORGE service may also have its own internal cache, but TIBER should not depend on hidden upstream cache semantics.

### 6. Failure handling

TIBER should contain upstream failures and keep product behavior predictable:

- map transport/model failures into stable internal error codes;
- decide which endpoints are hard-fail versus non-fatal degrade;
- emit observability, metrics, and comparison logs;
- optionally fall back to in-repo FORGE during migration behind feature flags.

## E. Proposed Contract

This section defines the target contract for the future external FORGE service.

### Contract goals

The contract should:

- be explicit enough for a separate FORGE repo to implement;
- support both single-player detail and rankings use cases without TIBER scraping ad hoc fields;
- keep a stable item-level evaluation schema;
- expose model metadata, confidence, and source coverage;
- support batch use so TIBER does not make one HTTP request per player in ranking flows.

### Versioning and transport

- Base path: `/v1/forge`
- Content type: `application/json`
- IDs: canonical player IDs as used by TIBER (`player_id` string); adapters may accept aliases later, but the stable contract should target canonical IDs.
- Response timestamps: ISO 8601 UTC.
- Service-level version fields must be explicit so TIBER can log exact model/calibration versions.

### Supported contract modes

Use **one contract family with two explicit modes**:

1. **Evaluate mode** — for player detail and explicit batches.
2. **Rankings mode** — for position rankings generated by the external model.

Both modes return the **same item-level evaluation object** so rankings and player detail share the same core shape. They differ only in request semantics and ranking metadata.

### 1. Evaluate mode

#### Endpoint

`POST /v1/forge/evaluations`

#### Request

```json
{
  "season": 2025,
  "week": 17,
  "mode": "redraft",
  "players": [
    { "player_id": "00-0036442", "position": "WR" }
  ],
  "options": {
    "include_components": true,
    "include_inputs": false,
    "include_debug": false,
    "include_source_meta": true
  }
}
```

#### Request rules

- `season`: required integer.
- `week`: optional integer or the string `"season"`; TIBER can continue to expose its own defaults.
- `mode`: required enum: `redraft | dynasty | best_ball`.
- `players`: required array, minimum 1, maximum recommended 250 for one request.
- `position`: required enum for v1: `QB | RB | WR | TE`.
- `include_components`: whether pillar/component details are returned.
- `include_inputs`: optional, for raw-ish source metrics/coverage summaries safe for adapter consumption.
- `include_debug`: optional, disabled by default.
- `include_source_meta`: optional, enabled by default for observability.

#### Response

```json
{
  "request": {
    "season": 2025,
    "week": 17,
    "mode": "redraft",
    "player_count": 1
  },
  "service_meta": {
    "service": "forge",
    "contract_version": "1.0.0",
    "model_version": "2026.03.0",
    "calibration_version": "alpha-redraft-2025-v1",
    "generated_at": "2026-03-21T00:00:00.000Z"
  },
  "results": [
    {
      "player_id": "00-0036442",
      "player_name": "Example Player",
      "position": "WR",
      "team": "SEA",
      "season": 2025,
      "week": 17,
      "mode": "redraft",
      "score": {
        "alpha": 78.4,
        "tier": "T2",
        "tier_rank": 11,
        "confidence": 0.82
      },
      "components": {
        "volume": 81.2,
        "efficiency": 74.5,
        "team_context": 68.9,
        "stability": 79.3
      },
      "metadata": {
        "games_sampled": 16,
        "position_rank": 11,
        "status": "ok",
        "issues": [
          {
            "code": "TD_OVER_INDEX",
            "severity": "warn",
            "message": "Touchdown rate is materially above baseline"
          }
        ]
      },
      "source_meta": {
        "data_window": {
          "season": 2025,
          "through_week": 17
        },
        "coverage": {
          "advanced_metrics": true,
          "snap_data": true,
          "team_context": true,
          "matchup_context": true
        },
        "inputs_used": {
          "profile": "wr_redraft_v1",
          "source_count": 6
        }
      }
    }
  ],
  "errors": []
}
```

### 2. Rankings mode

#### Endpoint

`POST /v1/forge/rankings`

#### Request

```json
{
  "season": 2025,
  "week": 17,
  "mode": "redraft",
  "position": "WR",
  "limit": 100,
  "filters": {
    "min_games": 1,
    "player_ids": null
  },
  "options": {
    "include_components": true,
    "include_source_meta": true
  }
}
```

#### Response

```json
{
  "request": {
    "season": 2025,
    "week": 17,
    "mode": "redraft",
    "position": "WR",
    "limit": 100
  },
  "service_meta": {
    "service": "forge",
    "contract_version": "1.0.0",
    "model_version": "2026.03.0",
    "calibration_version": "alpha-redraft-2025-v1",
    "generated_at": "2026-03-21T00:00:00.000Z"
  },
  "rankings": {
    "position": "WR",
    "count": 100,
    "returned": 100
  },
  "results": [
    {
      "player_id": "00-0036442",
      "player_name": "Example Player",
      "position": "WR",
      "team": "SEA",
      "season": 2025,
      "week": 17,
      "mode": "redraft",
      "score": {
        "alpha": 78.4,
        "tier": "T2",
        "tier_rank": 11,
        "confidence": 0.82
      },
      "components": {
        "volume": 81.2,
        "efficiency": 74.5,
        "team_context": 68.9,
        "stability": 79.3
      },
      "metadata": {
        "games_sampled": 16,
        "position_rank": 11,
        "status": "ok",
        "issues": []
      },
      "source_meta": {
        "data_window": {
          "season": 2025,
          "through_week": 17
        },
        "coverage": {
          "advanced_metrics": true,
          "snap_data": true,
          "team_context": true,
          "matchup_context": true
        },
        "inputs_used": {
          "profile": "wr_redraft_v1",
          "source_count": 6
        }
      }
    }
  ],
  "errors": []
}
```

### Shared item-level schema

Each evaluation result should expose the following fields at minimum.

#### Identity / scope

- `player_id: string`
- `player_name: string`
- `position: "QB" | "RB" | "WR" | "TE"`
- `team?: string | null`
- `season: number`
- `week: number | "season"`
- `mode: "redraft" | "dynasty" | "best_ball"`

#### Core score fields

- `score.alpha: number` — final 0..100 FORGE alpha.
- `score.tier: string` — e.g. `T1`..`T5`.
- `score.tier_rank?: number | null` — ordinal rank within returned ranking scope if applicable.
- `score.confidence: number` — normalized 0..1 confidence.

#### Component fields

For v1 the component contract should be explicit and fixed:

- `components.volume: number`
- `components.efficiency: number`
- `components.team_context: number`
- `components.stability: number`

Optional future extension fields may exist, but the four canonical pillars above should remain required for offensive FORGE.

#### Confidence / metadata

- `metadata.games_sampled: number`
- `metadata.position_rank?: number | null`
- `metadata.status: "ok" | "partial" | "not_found" | "unsupported_position" | "error"`
- `metadata.issues: Array<{ code: string; severity: "info" | "warn" | "block"; message: string }>`

#### Source metadata

- `source_meta.data_window.season: number`
- `source_meta.data_window.through_week: number | "season"`
- `source_meta.coverage.advanced_metrics: boolean`
- `source_meta.coverage.snap_data: boolean`
- `source_meta.coverage.team_context: boolean`
- `source_meta.coverage.matchup_context: boolean`
- `source_meta.inputs_used.profile: string`
- `source_meta.inputs_used.source_count: number`

TIBER may later ignore some of these fields in user-facing responses, but they should exist in the external contract for debugging, migration comparison, and observability.

### Error categories

The external FORGE service should return stable machine-readable error categories.

Top-level request errors:

- `INVALID_REQUEST`
- `UNSUPPORTED_MODE`
- `UNSUPPORTED_POSITION`
- `TOO_MANY_PLAYERS`
- `UPSTREAM_DATA_UNAVAILABLE`
- `INTERNAL_ERROR`

Per-player / per-item errors inside `errors[]` or item `metadata.status`:

- `PLAYER_NOT_FOUND`
- `POSITION_MISMATCH`
- `INSUFFICIENT_DATA`
- `SOURCE_COVERAGE_GAP`
- `COMPUTATION_FAILED`

TIBER should map these to stable internal adapter errors rather than leak raw upstream stack traces.

### Batch support

**Yes, batch support should exist.** It is required.

Reasons:

- current rankings and cache-generation flows are batch-oriented;
- forcing TIBER to fan out per-player requests would add unnecessary latency and operational complexity;
- the current repo already uses batch semantics heavily (`/batch`, `/eg/batch`, `/tiers`, cache generation, direct service loops).

### Should player detail and rankings use the same or different contract modes?

They should use the **same core item schema** with **different request modes**:

- `POST /v1/forge/evaluations` for single-player detail or explicit player batches.
- `POST /v1/forge/rankings` for ranked position lists.

This is more concrete than “one endpoint for everything,” but it still prevents divergence between player-detail and rankings payload shapes.

### Explicit non-goals for v1 contract

The v1 external contract should **not** directly encode:

- TIBER SoS-enriched `alphaBase` / `sosMultiplier` compatibility fields;
- TIBER `_sentinel` envelopes;
- TIBER transparency page’s exact recursive/debug response format;
- TIBER `/tiers` cache/read-model format;
- bare-array search endpoints or player-context admin helpers.

Those remain adapter/core concerns unless a later follow-up intentionally standardizes them.

## F. Migration Plan

### Stage 0: Freeze in-repo FORGE

- Keep the current FORGE module operational.
- Do not add net-new standalone model logic unless it is required for bugs, compatibility, calibration hardening, or migration support.
- Keep local module docs pointing contributors to the externalization target.

### Stage 1: Define contract

- Land this transition spec.
- Align stakeholders on the external service contract and migration scope.
- Decide whether offensive-only v1 is the approved cutover target, with IDP deferred.

### Stage 2: Build external FORGE repo/service

- Implement the `/v1/forge/evaluations` and `/v1/forge/rankings` contract in the new external repo.
- Expose explicit model/calibration metadata.
- Add tests proving stable responses for happy path, partial coverage, player-not-found, and invalid requests.

### Stage 3: Add FORGE adapter in TIBER-Fantasy

- Create `server/modules/externalModels/forge/` following the existing client/adapter/service pattern.
- Add typed request/response validation and stable internal error mapping.
- Keep runtime routes using the current in-repo FORGE until comparison plumbing is ready.

### Stage 4: Dual-run / compare

- Add a feature-flagged comparison path where TIBER can call both in-repo FORGE and external FORGE for the same requests.
- Log score deltas, missing players, rank shifts, and metadata mismatches.
- Compare on at least:
  - single player detail;
  - rankings batches;
  - tier cache generation candidates;
  - representative pages with real UI consumers.

### Stage 5: Switch routes to adapter-backed external FORGE

- Move selected routes/services to consume the external adapter while preserving current route contracts where needed.
- Likely migration order:
  1. contained integration route for direct external FORGE smoke-testing;
  2. internal gateway consumers;
  3. `/api/forge/eg/player` and `/api/forge/eg/batch`;
  4. `/api/forge/batch` and `/api/forge/score/:playerId`;
  5. `/api/forge/tiers` cache generation;
  6. remaining supporting surfaces.
- Keep a rollback flag to temporarily route traffic back to the in-repo implementation if needed.

### Stage 6: Delete legacy in-repo FORGE once safe

Only after adapter-backed external FORGE is proven stable:

- remove direct runtime dependencies on in-repo FORGE engine code;
- delete or archive the legacy implementation;
- keep only any core-side contracts, adapters, and product orchestration needed by TIBER.

No deletion should happen until:

- identified route consumers are migrated;
- ranking parity is acceptable;
- cache/tier flows are replaced or retired;
- fallback/rollback strategy is no longer needed.

## G. Risks / Open Questions

### 1. Unknown consumers

Identified consumers exist, but the full runtime consumer graph is not guaranteed complete. There may be:

- internal scripts not surfaced in this audit;
- off-repo clients calling current `/api/forge/*` endpoints;
- page paths that depend on undocumented fields.

### 2. DB coupling is still heavy

The current in-repo FORGE implementation reads many local tables and derived views. Externalizing FORGE cleanly requires either:

- moving the necessary data-access layer into the external repo/service; or
- defining a separate data-feed contract for the external FORGE service.

This PR does **not** resolve that data-sourcing decision; it only defines the service contract TIBER should consume.

### 3. Performance risk

Current flows include batch rankings, cache generation, and UI surfaces that expect reasonably fast ranked outputs. An external service that only supports slow per-player calls would be a regression. Batch support and request-size limits need to be designed for these existing workloads.

### 4. Mismatched output expectations

Current TIBER routes return inconsistent response envelopes and several TIBER-specific fields (`_sentinel`, SoS-adjusted alpha overlays, transparency-specific recursion payloads, tier-cache fantasy fields). If migration work assumes the external service should reproduce every current route envelope exactly, the service boundary will become messy.

### 5. Where rankings and player detail logic should live

This spec recommends shared item schema plus separate request modes. That is concrete enough to implement, but one open question remains: should ranking-specific ordering/tie-break rules be wholly model-owned, or should TIBER apply final product-side sorting rules in some views?

### 6. Where batch logic should live

This spec assumes rankings and explicit multi-player evaluation both belong in the external FORGE service. If that assumption changes, TIBER would need to orchestrate batches itself, which is likely worse for latency and complexity.

### 7. IDP scope

The repo contains an IDP FORGE branch, but this PR does not claim that offensive and IDP externalization must share the same first-cut service rollout. That remains an open implementation decision. Offensive FORGE is the clearest v1 target based on the identified consumer surface.

### 8. Transparency / debug parity

The current transparency route is rich and custom. It is still open whether the future external FORGE service should:

- expose enough structured explanation data for TIBER to rebuild transparency; or
- expose a dedicated transparency/debug contract later.

This spec only requires enough structured component/source metadata for the first migration phases.

## Implementation guidance for the next PR

The next implementation PR should:

1. create the external FORGE adapter boundary under `server/modules/externalModels/forge/`;
2. codify request/response schemas matching Section E;
3. add a contained integration route for the external FORGE service;
4. add comparison logging against the legacy in-repo implementation;
5. avoid deleting or rewriting the existing runtime until comparison data says the cutover is safe.
