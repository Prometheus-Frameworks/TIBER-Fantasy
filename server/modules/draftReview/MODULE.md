# Draft Review pilot

Read-only public context compiler for a Sleeper redraft roster.

## Inputs

- A public Sleeper roster URL in the form `https://sleeper.com/roster/{league_id}/{roster_id}`.
- Sleeper's public league, user, roster, player, and draft endpoints.

## Outputs

- Observed league settings and current roster membership.
- Observed draft picks when the league exposes a current draft ID.
- Deterministic position and lineup counts.
- Explicit Forecast readiness. The pilot does not create projections or player recommendations.

## Boundaries

- No database or shared `default_user` state.
- No FFC ADP or other market snapshot.
- No hidden roster grade, player ranking, waiver instruction, or transaction.
- Missing Forecast evidence remains unavailable.
