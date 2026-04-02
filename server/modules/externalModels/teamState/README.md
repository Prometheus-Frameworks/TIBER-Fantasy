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
