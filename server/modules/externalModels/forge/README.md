# External FORGE migration tooling

This folder includes deterministic migration-only review/parity tooling for the compare-only external FORGE rollout.

## What is here

- `fixtures/forgeParityFixtures.ts` — labeled migration fixtures with IDs, requests, and notes.
- `forgeParityHarness.ts` — runs the existing compare service across the fixture pack and aggregates a stable summary.
- `forgeParityReportService.ts` — wraps the harness in a stable report contract with generated-at and integration readiness metadata.
- `forgeMigrationReviewService.ts` — samples players from the existing legacy FORGE batch source, reuses the compare service for each player, and aggregates a stable operator review payload.
- `forgeParityReportExporter.ts` — renders the report for stdout or writes JSON for local inspection.
- `runForgeParityHarness.ts` — optional dev entrypoint that prints deterministic harness snapshot output.
- `runForgeParityReport.ts` — optional dev entrypoint that prints or exports the stable parity report contract.

## Migration-only endpoint

- `GET /api/integrations/forge/parity-report`
- `GET /api/integrations/forge/review?position=WR&season=2025&week=17&limit=10&mode=redraft`

These routes are additive and migration-only. They do **not** replace legacy FORGE and do **not** change existing `/api/forge/*` production behavior.

Example response shape:

```json
{
  "success": true,
  "data": {
    "generatedAt": "2026-03-21T00:00:00.000Z",
    "integration": {
      "enabled": true,
      "baseUrlConfigured": true,
      "endpointPath": "/v1/forge/evaluations",
      "timeoutMs": 5000,
      "readiness": "ready",
      "startupConfigLogged": true,
      "harnessRan": true,
      "skippedReason": null
    },
    "summary": {
      "totalFixtures": 8,
      "comparableCount": 6,
      "closeCount": 4,
      "driftCount": 2,
      "unavailableCount": 1,
      "notComparableCount": 1,
      "averageAbsoluteScoreDelta": 2.417,
      "worstScoreDelta": {
        "fixtureId": "rb-christian-mccaffrey-bestball-ceiling",
        "fixtureName": "Christian McCaffrey best ball ceiling check",
        "delta": 6.5,
        "absoluteDelta": 6.5
      }
    },
    "results": []
  }
}
```

If external FORGE is disabled or `FORGE_SERVICE_BASE_URL` is missing, the report still returns a deterministic contract. In that case `integration.harnessRan` is `false`, `integration.skippedReason` explains why, and each fixture result is marked `unavailable` with `config_error` metadata.

### Review endpoint usage

This endpoint is intended for operators doing migration review, not for end-user product flows.

Query params:

- `position` — required; one of `QB`, `RB`, `WR`, `TE`.
- `season` — required numeric season.
- `week` — optional; either `season` or a week number.
- `limit` — optional; `1..25`, defaults to `10`.
- `mode` — optional; `redraft`, `dynasty`, or `bestball`.

Behavior:

- Sampling is intentionally conservative: it reuses the existing legacy FORGE batch source (`runForgeEngineBatch`) instead of inventing a new player list.
- Each sampled player reuses the existing compare service, so delta/parity logic stays centralized.
- Per-player failures are contained inside `results[]`; one bad comparison does not fail the whole review response.
- When external FORGE is disabled or missing config, the route returns a stable unavailable review contract with `integration.reviewRan=false` and `integration.skippedReason` populated.

Example call:

```bash
curl \"http://localhost:5000/api/integrations/forge/review?position=WR&season=2025&week=17&limit=10&mode=redraft\"
```

## How to run it

From the repo root:

```bash
npm run forge:parity
npm run forge:parity:report
npm run forge:parity:report -- --json --out tmp/forge-parity-report.json
```

- `forge:parity` prints the raw deterministic harness summary.
- `forge:parity:report` prints the stable report contract plus a short human-readable summary.
- `--json` prints machine-friendly JSON to stdout.
- `--out <path>` writes the report contract to JSON on disk for local inspection.

## How to interpret the report

- `close` — both legacy and external FORGE returned comparable results within the current migration tolerance.
- `drift` — both sides returned data, but alpha/tier/pillar deltas exceeded tolerance.
- `unavailable` — one side failed, or external FORGE was disabled/unconfigured.
- `not_comparable` — both sides responded, but the outputs should not be compared directly.

## Deterministic output

- `formatForgeParitySnapshot(summary)` keeps the raw harness summary stable.
- `formatForgeParityReportJson(report)` keeps the higher-level route/export contract stable.

## Product-facing preview adoption

- `GET /api/player-identity/player/:id?includeExternalForge=true&season=<year>[&week=<week|season>][&externalForgeMode=redraft|dynasty|bestball]` exposes the first narrow product-facing external FORGE adoption.
- `GET /api/player-identity/player/:id?includeForgeComparison=true&season=<year>[&week=<week|season>][&externalForgeMode=redraft|dynasty|bestball]` reuses the compare service on the same player-detail surface to return both legacy and external FORGE plus a stable `forgeComparison.comparison` parity block.
- This is preview-only migration behavior: legacy FORGE remains the default source of truth everywhere else, including existing rankings and `/api/forge/*` routes.
- The player-detail route keeps failures non-fatal by returning a stable `externalForgeInsight` envelope with `available=false` and typed error metadata when external FORGE is disabled, unavailable, times out, or returns malformed data.
- The comparison preview keeps the same non-fatal behavior: `forgeComparison` still returns on partial failures, with per-side `available/error` status plus a `parityStatus` of `unavailable` when only one side responds.
- The route reuses the existing external FORGE client -> adapter -> service stack and the existing compare/parity semantics through the player-detail enrichment orchestrator; it does not call the remote service directly from the route.
