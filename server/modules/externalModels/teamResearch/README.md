# Team Research Workspace orchestrator

This module powers the read-only Team Research Workspace at:

- Route: `GET /api/data-lab/team-research[?season=<year>][&team=<abbr|name>]`
- Page: `/tiber-data-lab/team-research`
- Purpose: the team-level complement to Player Research, aggregating promoted read-only outputs for one offensive environment in one place.

## Trust posture

- Reuses existing promoted model services under `server/modules/externalModels/`
- Does **not** recompute breakout, role, ARC, or point-scenario logic
- Does **not** ingest raw upstream data directly
- Does **not** perform writes, rescoring, or database changes
- Preserves partial-data behavior so one missing module does not break the whole workspace

## Composition

The orchestrator currently composes these promoted services:

- `signalValidation/` for roster breakout signals
- `roleOpportunity/` for roster deployment/opportunity context
- `ageCurves/` for notable-player ARC snapshots
- `pointScenarios/` for scenario coverage across the roster

It builds a team search index, resolves a team by code or name, returns a team identity/header plus key-player summaries, and links each player back into the deeper Player Research workspace.
