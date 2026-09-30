# Trade Study — isolated paper core

This is the first operator-requested implementation slice for the Team trading
build resumed on September 30, 2026. It exercises structural roster inspection
and two-sided package geometry using supplied synthetic snapshots only.

Basis: `main@4204ddfc0fb0dd38da708e9aea3c4d01b77997ab`; design constraints:
[TIBER-Fantasy #355](https://github.com/Prometheus-Frameworks/TIBER-Fantasy/issues/355),
accepted packet V0 plus R2–R6. This slice does **not** freeze that packet's
durable schemas or implement the whole negotiation design. Its `paper-*`
transport schemas are intentionally distinct from `TradeReferralSetV0` and
`TradeCounterfactualPacketV0`.

## Inputs and outputs

- `schemas.ts`: closed Zod paper input shapes. Every league, roster, and player
  identifier uses the reserved `fixture:` namespace. Skill positions only.
  Geometry requires at least one positive lineup count; omitted supported slot
  keys mean zero. Bounds are 128 players/roster, 16 assets/direction, and 32
  rosters/screen; exceeding bounds refuses the whole input.
- `screening.ts`: inspects every supplied peer roster against an explicit
  operator-authored position/count filter. Counts starter and bench players;
  excludes reserve/taxi. Unknown ordinary positions remain explicit. No ranking,
  package suggestion, surplus assertion, expendability or willingness inference.
- `geometry.ts`: exchanges non-empty player sets in both directions. Checks
  snapshot uniqueness, stated-side fixture membership, supported containers,
  complete paper capacities and valid baseline occupancy before returning
  geometry. Incoming players enter the ordinary bench; reserve/taxi stay put.
- `__tests__/`: synthetic positive and refusal cases for both entry points.

All output order is reproducible identity serialization, never priority. Inputs
are not mutated. Position-only lineup coverage uses maximum bipartite matching
for dedicated and flexible slots; it excludes performance, health and schedule.
An unknown ordinary position makes lineup coverage unavailable.

Geometry reports both before/after states, exchanged identities, removed
observed starters, positional counts, open slots and capacity excess. If either
side exceeds ordinary capacity, its status is `requires_operator_cut_choice`.
All exact-size ordinary-player cut combinations are enumerated without selecting
or applying one. Incoming players are included; reserve/taxi players are excluded.
If there are more than 128 combinations, the **whole** enumeration is unavailable
with `cut_variant_bound_exceeded`; no partial shortlist is emitted. These are
mechanical capacity alternatives, not legal or desirable drop recommendations.

Legality and feasibility remain `unknown`; plausibility is `unavailable` and
desirability is `not_evaluated`. Paper rules omit deadline, locks, pending
transactions, review/veto and reserve eligibility. Ordinary container capacity
does not establish full rules compliance. Every successful paper output carries
`execution: { performed: false, authorized: false }` and `durable_records: 0`.

## Production and authority boundary

Production entry points always return `production_contract_unavailable`, with
no geometry/roster views and zero durable records, including for valid fixtures.
Paper functions cannot admit live canonical/provider identities. No module
caller is added to Team, Management, routes or MCP. No network, clock, random,
environment, filesystem, database, provider, occupancy-store or CEM access exists.
Imports are restricted to Zod and this module. Legacy trade verdict/value/grade
surfaces and Hypothesis Core are not imported or modified.

No real league, roster, manager or negotiation data is checked into the repo.
No public roster selection establishes authenticated ownership. This slice
does not produce an intent, immutable package record, negotiation observation,
disposition, durable referral or activated comparison. It does not consume the
new Strategy research notes as executable thresholds or player predictions.

## Next integration gate

Before a live Team/agent consumer, establish versioned roster/rules snapshots,
canonical identity and provenance, binding and freshness requirements, applicable
pending/lock context, and exact-use activation classification. Reconcile #320
and #321 for the intended consumer rather than reusing Management's shared
`default_user` state. Public selected roster context may support transient
inspection only; durable evaluations need the accepted stronger binding.

The remaining #355 record/digest/referral/negotiation contracts need their own
bounded schema implementation and independent review. This core is a paper
testbed, not a shortcut past those gates. See the
[implementation audit](../../../docs/audits/team-trade-paper-core-2026-09-30.md).
