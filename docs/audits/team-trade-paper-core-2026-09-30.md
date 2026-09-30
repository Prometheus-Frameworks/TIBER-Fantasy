# Team trading build: first paper core

Date: September 30, 2026. Repository basis:
`4204ddfc0fb0dd38da708e9aea3c4d01b77997ab`.

The operator requested resuming the Team trading build after TIBER-Strategy
PR #11 merged. The immediate product goal is to inspect league roster structure
and discuss a multi-player package when a starter is lost. The Strategy research
notes guide investigations; they are not operational ROP thresholds or market
signals and are not consumed by this implementation.

## Reconciliation

The present Team scenario function (`shared/draftReviewScenario.ts`) supports
one/two departures and one arrival on one public selected roster. It does not
scan a league or model both sides of a two-for-one exchange. #355's accepted
V0/R2–R6 design separates structural comparison, mechanical consequences,
legality, feasibility, plausibility and operator desirability, with no manager
profiling, ranking or automatic action.

The accepted design's original basis is older than current main. Its live
roster/rules snapshot contracts remain unavailable; #320 is open. The current
stateless Team flow does not authenticate ownership. Consequently this first
slice exercises supplied synthetic input in an isolated module and adds no
runtime consumer, provider adapter or durable schema. It is a bounded prototype
of mechanical portions of S1–S3, not a claim of completing those plan steps.

## Implemented surface

- Explicit position/count filter over all supplied peer rosters, with an
  unordered set of structural views and unknown positions preserved.
- Non-empty multi-player exchange in both directions, snapshot membership
  validation, ordinary capacity and positional coverage before/after both sides.
- Forced-cut alternatives enumerated without selection. Complete enumeration
  unavailable over the 128-variant bound; no truncated shortlist.
- Strict rejection of additional manager/ranking/score/conditional/third-party
  fields, unsupported assets and real identifiers.
- Production functions refuse every input with zero durable records.

All fixture identifiers are generic. No user league or real player example is
embedded in source, tests, docs or copied negotiation state. No package value,
performance, market reaction, manager willingness, legal/feasible state or
recommended transaction is inferred. No existing Team, Management, Hypothesis
Core, trade-verdict, Strategy adapter, database or activation source is modified.

## Validation

48 tests pass across two focused suites using the repository Jest configuration.
They cover one-for-two and multi-player packages, both sides' forced cuts,
dedicated/flex coverage, reserve/taxi exclusion, missing positions, input
immutability, byte stability under permutations, closed input rejection,
duplicate and wrong-side identity refusal, invalid baseline capacity, bounded
cut enumeration, explicit structural filters and production refusal.

Targeted strict TypeScript compilation covers all five source/test files.
The dependency tree used is the existing local repository installation; no
dependency or package script changes were made. Whole-application build/tests
are not claimed: this new module has no application import or route and the
local verification workspace contains only the pinned necessary files.

## Publication and remaining acceptance

September 30 read-only Railway inspection confirms production auto-deploy is
disabled and the source is `main`. The connector does not expose project PR
environment enablement; existing old PR environments are not current proof.
Under the existing Team publication rule, prepare a branch for inspection but
hold PR creation until PR deployment suppression can be verified. No merge,
deployment, consumer activation, live league query or transaction occurs here.

Independent exact-head review remains pending. A future Team roster/rules
adapter and transient consumer need a separate concrete contract and tests for
identity, provenance, binding, stale responses and exact-use activation. Full
#355 durable records, package digests and negotiation are still unimplemented.
