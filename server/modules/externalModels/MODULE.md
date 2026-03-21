# External Model Adapter Layer

This module is the boundary between TIBER-Fantasy core logic and promoted lab/model services.

## Why it exists

- External services must enter core through adapters, not ad hoc fetches.
- Canonical contracts are validated at the edge before they reach application logic.
- Failures are mapped into stable internal error categories.
- Core code consumes stable TIBER-facing interfaces instead of raw remote payloads.
- TIBER-Fantasy is the shell/orchestration core; standalone model brains should live outside core when practical, and any in-repo legacy model logic should be treated as temporary unless explicitly justified.

## First integration

`roleOpportunity/` wraps the `Role-and-opportunity-model` service and exposes a stable `TiberRoleOpportunityInsight` shape.

## Next planned externalization target

- FORGE is the next major legacy in-repo model target. The transition contract and staged migration plan live in `docs/architecture/FORGE_EXTERNALIZATION_TRANSITION_SPEC.md`.
- `forge/` now contains the first migration-safe external FORGE adapter stack plus a dual-run compare service.
- This compare path is intentionally contained and does **not** replace existing `/api/forge/*` production behavior yet.
- The integration follows the same client -> adapter -> service pattern used by `roleOpportunity/`, while preserving TIBER-owned orchestration and route compatibility.

## Pattern for future promoted labs

1. Add a dedicated client for transport + timeout + config handling.
2. Add an adapter that validates and maps the canonical payload.
3. Add a service that exposes the stable internal TIBER interface.
4. Add one contained integration route or enrichment surface in `server/routes/`.
5. Add tests for happy path, malformed payloads, and explicit failure mapping.


## Current product integration

- `GET /api/player-identity/player/:id?includeRoleOpportunity=true&season=<year>&week=<week>` enriches a player-detail response with `roleOpportunityInsight`.
- Player detail enrichment now flows through `playerDetailEnrichment/playerDetailEnrichmentOrchestrator.ts`, which owns external insight assembly away from the route layer.
- The orchestrator currently supports role-opportunity as its first insight and returns a stable result object that can grow with future enrichments.
- The route still controls opt-in query params and keeps the same non-fatal response semantics.
- Enrichment failures are contained so the base player detail payload still succeeds.

## Current FORGE migration tooling

- `server/modules/externalModels/forge/forgeClient.ts` handles transport/config/timeout/error mapping for the standalone FORGE service.
- `server/modules/externalModels/forge/forgeAdapter.ts` validates the external contract and maps it into a stable TIBER-facing evaluation type.
- `server/modules/externalModels/forge/forgeCompareService.ts` dual-runs legacy and external FORGE side by side and computes stable diff metadata for migration analysis.
- `server/modules/externalModels/forge/fixtures/forgeParityFixtures.ts` provides a committed parity fixture pack with labeled request cases and migration notes.
- `server/modules/externalModels/forge/forgeParityHarness.ts` runs the compare service across that fixture pack and emits deterministic summary output suitable for tests or migration snapshots, including a stable per-fixture `results` array with delta/debug metadata.
- `server/modules/externalModels/forge/forgeParityReportService.ts` wraps the existing harness in a stable report contract with readiness/config metadata and safe skipped-report behavior when the external integration is disabled or unconfigured.
- `server/modules/externalModels/forge/runForgeParityHarness.ts` is the optional local runner (`npm run forge:parity` or `tsx ...`) for concise parity summaries during migration work.
- `server/modules/externalModels/forge/runForgeParityReport.ts` / `npm run forge:parity:report` export the stable parity report contract for local inspection or JSON snapshots.
- `POST /api/integrations/forge/compare` and `GET /api/integrations/forge/parity-report` are contained migration endpoints; neither is a production cutover path.
