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

TIBER-Fantasy also exposes a read-only consumer for the TIBER-Teamstate Team Environment Movement
artifact. It accepts both `team_environment_movement_v1` (the team-state-only successor) and
`team_environment_movement_v0` (legacy).

Configured with:

- `TEAM_ENVIRONMENT_MOVEMENT_ARTIFACT_PATH` — explicit override; always wins when set.
- Default (no override): resolves `../TIBER-Teamstate/output/team_environment_movement_v1.json` if it
  exists, otherwise falls back to `../TIBER-Teamstate/output/team_environment_movement_v0.json`.

Routes:

- `GET /api/data-lab/team-environment-movement`
- `GET /api/data-lab/team-environment-movement/:teamAbbr`

### v0 → v1 migration

`team_environment_movement_v1` is the team-state-only successor. It drops the legacy fantasy-point
fields (`fantasyPointsForQB/RB/WR/TE`) from window averages and deltas; movement directions and
verdicts are unchanged (they were always derived from team-state fields only). See TIBER-Teamstate
issue #34 and `docs/contracts/team-environment-movement-v1.md`.

This consumer never read the fantasy-point fields, so migrating is functionally a no-op for behavior.

**Transition compatibility (v0 retained):** v0 is still accepted because the v1 artifact is not yet
the committed representative fixture in TIBER-Teamstate. The default path prefers v1 when present and
falls back to v0, so fresh checkouts keep working today and automatically prefer v1 once Teamstate
commits it. Once that follow-up lands, v0 acceptance can be removed.

Safety constraints:

- The artifact literal must equal `team_environment_movement_v1` or `team_environment_movement_v0`;
  any other literal, or a malformed entry, fails closed.
- Missing artifacts return an explicit unavailable state and never fabricate movement context.
- The response echoes the actual artifact literal that was read.
- `metadata.provenanceStatus`, `metadata.inputSources`, metadata.coverage fields, warnings, weeksCovered, early/late windows, deltas, movement directions, and verdicts are preserved for inspection.
- Fixture/scaffold provenance is surfaced conservatively and is not used for FORGE scoring, rankings, projections, trade evaluation, or roster advice.
