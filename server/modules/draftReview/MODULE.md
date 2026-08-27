# Draft Review pilot

Read-only public context compiler for a Sleeper redraft roster.

## Inputs

- A numeric Sleeper league ID or an exact public Sleeper league, draft, or roster URL.
- League and draft inputs return a minimal public roster selector; selection identifies the roster to review and does not authenticate ownership.
- Sleeper's public league, user, roster, player, and draft endpoints.
- Each upstream request is time-bounded; a stalled Sleeper response becomes an explicit unavailable state.

## Outputs

- A readable scoring summary, reserve capacity and configured reserve rules without exporting the raw scoring dump.
- Observed current roster membership and draft evidence when the league exposes a current draft ID.
- A bounded complete draft board, draft timer, team slot, and turn distance for counterfactual review.
- Deterministic position, lineup, missing-starter, and bench-capacity checks.
- Explicit Forecast readiness. The pilot does not create projections or player recommendations.
- Explicit unavailable states for current per-player reserve eligibility and bye-week geometry until governed sources are connected.

## Boundaries

- No database or shared `default_user` state.
- Concurrent cold requests share one in-flight player-directory fetch.
- The bulk NFL player directory is cached for up to 24 hours; league, roster, user, and draft reads remain request-time observations.
- Draft exports fail closed above 512 selections.
- Public responses use `Cache-Control: no-store`; unnecessary owner IDs are not exported.
- Tracked fixtures and validation notes use synthetic or generic roster identifiers; live-user display names and league IDs are not retained in the repository tree.
- The unauthenticated route is rate-limited to bound upstream amplification.
- Display strings are untrusted data in the copied agent packet, never agent instructions.
- No FFC ADP or other market snapshot.
- No hidden roster grade, player ranking, waiver instruction, or transaction.
- Missing Forecast evidence remains unavailable.
