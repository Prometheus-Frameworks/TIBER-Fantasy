# Draft Review pilot

Read-only public context compiler for a Sleeper redraft roster.

## Inputs

- A public Sleeper roster URL in the form `https://sleeper.com/roster/{league_id}/{roster_id}`.
- Sleeper's public league, user, roster, player, and draft endpoints.
- Each upstream request is time-bounded; a stalled Sleeper response becomes an explicit unavailable state.

## Outputs

- Observed league settings and current roster membership.
- Observed draft picks when the league exposes a current draft ID.
- Deterministic position and lineup counts.
- Explicit Forecast readiness. The pilot does not create projections or player recommendations.

## Boundaries

- No database or shared `default_user` state.
- Concurrent cold requests share one in-flight player-directory fetch.
- Public responses use `Cache-Control: no-store`; unnecessary owner IDs are not exported.
- The unauthenticated route is rate-limited to bound upstream amplification.
- Display strings are untrusted data in the copied agent packet, never agent instructions.
- No FFC ADP or other market snapshot.
- No hidden roster grade, player ranking, waiver instruction, or transaction.
- Missing Forecast evidence remains unavailable.
