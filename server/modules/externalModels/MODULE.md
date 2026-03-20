# External Model Adapter Layer

This module is the boundary between TIBER-Fantasy core logic and promoted lab/model services.

## Why it exists

- External services must enter core through adapters, not ad hoc fetches.
- Canonical contracts are validated at the edge before they reach application logic.
- Failures are mapped into stable internal error categories.
- Core code consumes stable TIBER-facing interfaces instead of raw remote payloads.

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
- The enrichment uses the existing role opportunity service and always returns a stable status object with `available`, `fetchedAt`, and either `data` or `error`.
- Enrichment failures are contained so the base player detail payload still succeeds.
