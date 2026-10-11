# Team waiver comparison — 2026-09-19

Implements issue #404 on `codex/404-waiver-comparison`, stacked on #396 / `codex/team-waiver-context` at `0b0b0308e7abc3a73dbd6f831bcd6e6cca67d693`. Operator authorized a separate draft PR and independent review, leaving #396 and its preview unchanged.

## Behavior

Select a checked waiver candidate, start comparison from its shortlist entry, search/add another candidate and select it in the second-player control. Display identity/current directory metadata separately from the admitted 2025 weeks 1–18 historical evidence. Reuse the existing comparison table, including totals and nonmissing-week denominators. Zero remains zero; missing evidence remains unknown. An unavailable player can still be discussed.

The dedicated action copies the existing roster context with exactly two candidates, league/roster/directory observation clocks and historical evidence provenance. The additive `waiver_comparison` packet is separately scoped; no unrelated shortlist/pool is copied. Forecast is explicitly unavailable. No transactions, winner selection, claim eligibility, injury or playing-time inference is added.

Comparison changes cancel old evidence and invalidate pending clipboard success. Shortlist mutation remounts the comparison; check refresh, roster scope change and incomplete membership remove it. Malformed, duplicate or foreign historical IDs are rejected. Existing complete-membership checks remain authoritative.

## Validation

- 75 tests pass across nine focused suites: teamWaiverComparison, draftReviewStudy, draftReviewWaivers, draftReviewWaiverContext, draftReviewEvidenceStudy, draftReviewTeExplorer, tiberTeam, waiverCandidates and historicalEvidence.
- DOM interaction tests cover searching while preserving the first player, missing history, actual zero, pair-only packet, observation clocks, membership failure, refresh, late response/copy completion and scope changes.
- `sh build.sh` passes; existing large-bundle warning remains.
- `npm run typecheck` retains 507 diagnostics on both exact base and implementation, with no added per-file/error-code counts. Repository typecheck is not globally clean.
- Portrait-phone visual acceptance remains pending; no new preview was deployed for this change.

## Publication boundary

Immediately before draft publication, Railway project Settings > Environments displayed **Enable PR Environments**, confirming automatic PR environments were disabled. This was a read-only check; no settings were changed. #396 remained open/draft at the exact base above. Publish this as a stacked draft and request independent review. Do not merge or deploy. Refreshing the dedicated preview requires separate operator authorization. Trending sort/position filters and Forecast-based projection/final scoring are deferred.
