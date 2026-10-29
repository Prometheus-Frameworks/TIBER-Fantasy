# TIBER Public League Context — Slice 1

This module implements six anonymous, read-only **in-process** contracts with
explicitly injected synthetic/testable sources. It has no default live source,
transport registration, Worker, public endpoint, persistent cache or governor.
It does not establish production readiness or client compatibility.

`contracts.ts` owns the fixed names, strict schemas, bounded failure vocabulary,
public selection envelope and tool annotations. `tools.ts` dispatches only those
names and adapts the existing discovery, membership, roster and weekly readers.
`get_weekly_matchups` passes a string week to the existing parser.

`leagueMcp/lineupContext.ts` owns shared football composition. Both this adapter
and the preserved private `createPersonalReaders` wrapper call it. The public
module/core must not import the private profile wrapper, registry, Worker,
private evidence/artifacts or application/database startup. Existing shared
readers retain their legacy defaults, but public calls always inject sources.

Every public lineup invocation reads fresh NFL state, establishes current season,
and resolves exact owner/co-owner membership. An implicit week requires a regular
leg 1–18; otherwise `decision_week_required`. Explicit weeks are decision context:
starters remain currently observed and historical verification is false. Other
tools retain their existing historical scope. No account control is authenticated.

`draftReview/sourceObservations.ts` creates request-local lazy promises and retains
league/roster acquisition clocks through reuse. `draftReview/rosterCensus.ts`
validates complete roster coverage independently of the directory and refuses
cross-roster ownership conflicts. Exact numeric candidate IDs can retain selected,
elsewhere or census-absence evidence when enrichment fails. Name-only fallback is
unknown. Census absence alone never means unrostered or claim-eligible. The private
serialized candidate shape and legacy auxiliary-bucket/FAAB semantics are preserved.

`sources.ts` validates injected reference clocks and schedule coverage, with a
24-hour directory limit and one-hour schedule limit. It rechecks expiry at response
projection without refreshing clocks or retaining references between invocations.
All provider errors are mapped to bounded results. Transport/body/error-amplification
limits and global concurrency/rate controls remain Slice 2 work.

Validation and remaining limitations:
[`docs/reviews/public-mcp-slice-1-2026-10-28.md`](../../../docs/reviews/public-mcp-slice-1-2026-10-28.md).
