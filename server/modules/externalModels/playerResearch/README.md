# Player Research Workspace orchestrator

This module powers the read-only Player Research Workspace at:

- Route: `GET /api/data-lab/player-research[?season=<year>][&playerId=<gsis>][&playerName=<name>]`
- Page: `/tiber-data-lab/player-research`
- Purpose: the first cross-model synthesis surface in TIBER Data Lab, aggregating promoted read-only outputs for one player in one place.

## Trust posture

- Reuses existing promoted model services under `server/modules/externalModels/`
- Does **not** recompute breakout, role, ARC, or point-scenario logic
- Does **not** ingest raw upstream data directly
- Does **not** perform writes or rescoring
- Preserves partial-data behavior so one missing module does not break the whole workspace

## Composition

The orchestrator currently composes these promoted services:

- `signalValidation/` for Breakout Signals
- `roleOpportunity/` for Role & Opportunity
- `ageCurves/` for Age Curve / ARC
- `pointScenarios/` for Point Scenarios

It builds a union search index, resolves a player by `playerId` or `playerName`, and returns player-centric summary cards plus link-outs to the deeper lab pages.
