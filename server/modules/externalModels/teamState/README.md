# Team State external artifact adapter

Read-only consumer boundary for `tiber_team_state_v0_1` artifacts produced in TIBER-Data.

## Purpose

- Keep Team State computation out of TIBER-Fantasy.
- Load promoted upstream artifact JSON for inspection and downstream consumers.
- Expose stable success/error behavior for route callers.

## Artifact resolution

Configured with:

- `TEAM_STATE_EXPORTS_DIR` (default: `data/team-state`)
- `TEAM_STATE_EXPORTS_ENABLED` (`0` disables)

Supported filename conventions per season:

- `tiber_team_state_v0_1_{season}.json`
- `tiber_team_state_v0_1_{season}_full.json`
- `tiber_team_state_v0_1_{season}_through_week_{week}.json`
- `tiber_team_state_v0_1_{season}_week_{week}.json`
- `tiber_team_state_v0_1_{season}_w{week}.json`

If `throughWeek` is not provided and a season-level file is missing, the client will use the latest week-specific artifact found for that season.

## Non-goals

- No Team State metric computation here.
- No score recomputation, ranking redesign, caching layer, or UI coupling.

## Team Environment Movement artifact

TIBER-Fantasy also exposes a read-only consumer for the TIBER-Teamstate `team_environment_movement_v0` artifact.

Configured with:

- `TEAM_ENVIRONMENT_MOVEMENT_ARTIFACT_PATH` (default: `../TIBER-Teamstate/output/team_environment_movement_v0.json`)

Routes:

- `GET /api/data-lab/team-environment-movement`
- `GET /api/data-lab/team-environment-movement/:teamAbbr`

Safety constraints:

- The artifact literal must equal `team_environment_movement_v0`; wrong or malformed artifacts fail closed.
- Missing artifacts return an explicit unavailable state and never fabricate movement context.
- `metadata.provenanceStatus`, `metadata.inputSources`, metadata.coverage fields, warnings, weeksCovered, early/late windows, deltas, movement directions, and verdicts are preserved for inspection.
- Fixture/scaffold provenance is surfaced conservatively and is not used for FORGE scoring, rankings, projections, trade evaluation, or roster advice.
