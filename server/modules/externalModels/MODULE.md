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
