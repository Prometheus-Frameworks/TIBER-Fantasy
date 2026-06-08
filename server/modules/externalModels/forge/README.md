# External FORGE migration tooling

This folder includes deterministic migration-only review/parity tooling for the compare-only external FORGE rollout.

## What is here

- `fixtures/forgeParityFixtures.ts` — labeled migration fixtures with IDs, requests, and notes.
- `forgeParityHarness.ts` — runs the existing compare service across the fixture pack and aggregates a stable summary.
- `forgeParityReportService.ts` — wraps the harness in a stable report contract with generated-at and integration readiness metadata.
- `forgeMigrationReviewService.ts` — samples players from the existing legacy FORGE batch source, reuses the compare service for each player, and aggregates a stable operator review payload.
- `forgeSourceSelector.ts` — stable source-selection policy layer for contained cutover previews, with `legacy`, `external_preview`, and `auto_with_legacy_fallback` modes.
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

- `GET /api/player-identity/player/:id?includeExternalForge=true&season=<year>[&week=<week|season>][&externalForgeMode=redraft|dynasty|bestball]` preserves the original external-only preview behavior.
- `GET /api/player-identity/player/:id?includeSelectedForge=true&season=<year>[&week=<week|season>][&externalForgeMode=redraft|dynasty|bestball][&forgeSourceMode=legacy|external_preview|auto_with_legacy_fallback]` exposes the first contained source-selector cutover preview.
- `GET /api/player-identity/player/:id?includeForgeComparison=true&season=<year>[&week=<week|season>][&externalForgeMode=redraft|dynasty|bestball]` reuses the compare service on the same player-detail surface to return both legacy and external FORGE plus a stable `forgeComparison.comparison` parity block.
- This is preview-only migration behavior: legacy FORGE remains the default source of truth everywhere else, including existing rankings and `/api/forge/*` routes.
- `forgeSourceMode=legacy` forces legacy FORGE only.
- `forgeSourceMode=external_preview` attempts external FORGE only and returns an unavailable envelope if the selector preview flag is off or the external service fails.
- `forgeSourceMode=auto_with_legacy_fallback` attempts external FORGE first and automatically falls back to legacy FORGE on preview-flag disablement, config errors, timeouts, upstream unavailability, and other invalid external responses.
- The selector preview returns explicit `selection` metadata (`requestedMode`, `selectedSource`, `fallbackOccurred`, `fallbackReason`) alongside either the resulting data or a stable unavailable/error envelope.
- The player-detail route keeps failures non-fatal by returning a stable `externalForgeInsight` or `selectedForgeInsight` envelope with `available=false` and typed error metadata when external FORGE is disabled, unavailable, times out, or returns malformed data.
- The comparison preview keeps the same non-fatal behavior: `forgeComparison` still returns on partial failures, with per-side `available/error` status plus a `parityStatus` of `unavailable` when only one side responds.
- The route reuses the existing legacy FORGE evaluator, the external FORGE client -> adapter -> service stack, and the compare/parity semantics through the player-detail enrichment orchestrator; it does not call the remote service directly from the route.

## Feature flag

- `FORGE_SOURCE_SELECTOR_PREVIEW_ENABLED=1` enables external-backed selector modes for the contained `selectedForgeInsight` preview path.
- The default remains migration-safe: if the flag is unset, `external_preview` returns unavailable and `auto_with_legacy_fallback` stays on legacy FORGE.

## Management `FORGE_PLAYER_STATIC_V1` consumption

Management consumes the promoted static FORGE artifact through the local adapter stack in this folder:

- `forgePlayerStaticClient.ts` reads the JSON artifact from `FORGE_PLAYER_STATIC_V1_ARTIFACT_PATH`, `FORGE_PLAYER_STATIC_PROMOTED_PATH`, or the bundled deploy-safe snapshot at `server/artifacts/external/forge/forge_player_static_v1.json`. Env overrides remain the right way to point at a freshly promoted export.
- `server/artifacts/external/forge/forge_player_static_v1.json` is a pinned promoted TIBER-FORGE snapshot packaged for hosts such as Railway that do not deploy a sibling `TIBER-FORGE` checkout. It is not Fantasy-owned scoring logic and must be replaced only by copying the validated producer export from `TIBER-FORGE/exports/promoted/forge_player_static/forge_player_static_v1.json` without editing metadata, scores, tiers, confidence, provenance, or row structure. Current bundled SHA-256: `54fa916a93499d32d45bd759e77542ae514f5cfdbea6758541e282276838dfb9`.
- `forgePlayerStaticAdapter.ts` validates the downstream consumer contract at the adapter edge and fails closed for unsupported contracts, malformed rows, and duplicate canonical player IDs.
- `forgePlayerStaticService.ts` maps missing/disabled/malformed/unsupported artifacts into an unavailable lookup instead of producing scores.
- `server/modules/externalModels/identity/tiberIdentityCrosswalkClient.ts` reads the promoted TIBER-Data identity artifact from `TIBER_IDENTITY_CROSSWALK_V1_ARTIFACT_PATH`, `TIBER_IDENTITY_CROSSWALK_PROMOTED_PATH`, or the bundled deploy-safe snapshot at `server/artifacts/external/identity/tiber_identity_crosswalk_v1.json`. Env overrides remain the right way to point at a freshly promoted TIBER-Data export from `exports/promoted/identity_crosswalk/tiber_identity_crosswalk_v1.json`; the bundled file must remain an exact copy of that producer artifact shape (`records[]`, `schema_version`, `supported_providers`, `coverage`, `record_count`, and row provenance fields intact), not a Fantasy-local rewrite.
- `server/modules/externalModels/identity/tiberIdentityCrosswalkAdapter.ts` validates `TIBER_IDENTITY_CROSSWALK_V1` at the adapter edge and fails closed for unsupported contracts, malformed rows, and duplicate provider mappings. It supports both raw provider IDs and provider-prefixed IDs for Sleeper resolution (for example `6797` and `sleeper:6797`).
- Management no longer uses the former Fantasy-owned hardcoded Sleeper-to-FORGE bridge. Sleeper roster identities are resolved through `TIBER_IDENTITY_CROSSWALK_V1` to TIBER canonical player IDs, and those TIBER IDs are then used to match `FORGE_PLAYER_STATIC_V1` rows.

Management diagnostics report direct canonical matches separately from TIBER identity crosswalk matches and unmatched roster IDs, and include artifact state for both `FORGE_PLAYER_STATIC_V1` and `TIBER_IDENTITY_CROSSWALK_V1`. Management evidence semantics are intentionally strict: only rows where `row.provenance.score_source === "player_specific"` are true FORGE evidence. Rows with `generated_baseline` are visible only as baseline/lookup scaffolding and do not count toward Team Direction confidence, FORGE scoring coverage, roster strength, alpha totals, or player-specific evidence coverage. `fallback_default`, unknown score sources, missing artifacts, unsupported artifacts, malformed artifacts, duplicate FORGE IDs, and duplicate identity provider mappings fail closed or remain non-evidence.
