# TIBER Team / Draft Review compiler

Read-only public context compiler for a Sleeper redraft roster.

## Team web entry (issue #371)

- `/team` and the preserved `/draft-review` alias render the same page. Both `sleeper_url` and legacy `sleeper_input` query parameters still resolve through the existing API. The public runtime's entry/logo goes to `/team`; full-profile Observatory and Management routes retain their existing behavior.
- Explicit roster refresh repeats the public roster read, preserving the existing 24-hour player-directory cache. Change roster opens the same league's selector; Change league clears the entry. URL navigation invalidates pending reads, and a successful read canonicalizes the current history entry.
- Current starter membership, bench, reserve and taxi are separate groups, including empty groups. Configured starting slots are not inferred player-to-slot assignments. Reserve settings display allowed/not allowed/unknown separately from unavailable current player eligibility. Missing NFL team remains unknown.
- Copy roster link produces an origin-local `/team?sleeper_url=…` locator. Opening it fetches current data and starts a new study; it contains no snapshot, preference, note or hypothetical roster. Copy agent context contains the current snapshot and matching local study through the unchanged packet contract. Clipboard failures remain visible. No durable notes, browser storage, account ownership or transaction authorization.
- Refresh/switch controls warn before discarding a preference, note or hypothetical roster. Pair changes, review loads, reloads and navigation clear local study state. A copied packet must be retained outside the page if the operator wants to keep it.
- The comparison keeps the bounded horizontal scroller, focus access, readable light controls, historical attribution and missing-value semantics. Original draft detail is secondary; unavailable Forecast evidence remains explicit.
- No API, runtime-profile name, dependency, database, artifact or provider change. The existing isolated Railway PR environment is the preview path, subject to verifying its base and inherited isolation before publication. Implementation approval does not authorize merge or production release.

Replay Team interactions with `npm test -- --runTestsByPath client/src/__tests__/tiberTeam.test.ts --coverage=false`. Run the existing evidence-study, shared-study, Draft Review service/routes/history and public-profile suites as well. Build with `sh build.sh`. Repository typecheck is compared to unchanged main; a clean build is not a clean repository-wide typecheck. Automated DOM tests are separate from Joe's portrait-phone acceptance (390/430px target widths, comparison swipe, controls, roster refresh and handoff).

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

## Accepted historical evidence slice (issue #360)

Operator acceptance: TIBER-Data PR #264 comment 5574349251. The four proposed identity edges and bounded descriptive 2025 use are accepted. Mechanical Data PR #266 remains unmerged; this consumer pins its independently reviewed head `8b762650f4b933b6ce717c551993dcaaf92e1008`, not Data main. Neither this feature nor the receipt grants merge/deployment permission.

- `historicalEvidence.ts` adds optional `historical_evidence` to the existing v0_1 context without changing its observed/derived/forecast fields. The immutable public bundle is selected per roster, limited to 32 requested players; larger selections explicitly report unavailable.
- `GET /api/draft-review/evidence?player_ids=<one-or-two-exact-ids>` provides the same public evidence for a pair, including players outside the selected roster. Numeric Sleeper IDs and uppercase defense IDs are bounded; unmapped IDs return explicit player-level unavailability. No database, user identity, write route, upstream request, or new environment variable.
- The runtime verifies the complete 100,391-byte bundle SHA-256 before caching immutable bytes. Each request parses fresh data. Missing/changed artifacts fail closed without substituting fixture or live data. The runtime expects the tracked artifact at `server/modules/draftReview/artifacts/historical2025.json` beneath the existing repository working directory.
- `scripts/buildDraftReviewEvidenceBundle.py --data-repo <local-data-checkout> --check` replays the consumer transform from fixed Git objects and SHA-256 pins, entirely offline. Omit `--check` to regenerate the same committed consumer bundle. This does not refresh sources, promote new IDs or write to Data.
- Producer inputs: Data's admitted `exports/promoted/identity_crosswalk/tiber_identity_crosswalk_v2.json`, `exports/promoted/draft_review/evidence_admission_v1.json`, and the two accepted `data/processed/evidence/player_weekly_{usage,ppr_outcomes}_2025.source_backed.json` files. Exact paths, hashes, producer commit and acceptance link ship in the packet. The six-row promoted weekly fixtures are not consumed.
- Only 2025 weeks 1–18, ten approved raw outcome fields and two share fields are aggregated. Missing values stay missing. Totals require all recorded values; means disclose nonnull-week denominators. A mean weekly share is not a season share. Shares are not clamped to 0–1. Conflicting weekly team/opponent/position blocks joined usage, while independent outcome derivations remain available.
- Routes, snaps, red-zone usage, rush share, air-yards totals, league scoring totals/subtotals and regression probabilities remain unavailable. Original acquisition/update clocks, release hash and package version remain null. Neither materialization time nor the current roster clock makes the history fresh.
- Historical team/position and identity confidence are distinct from current Sleeper observations. No current workload, injury, bye, manager acceptance or replacement production is inferred.
- The UI compares any two roster/full-board candidates and attaches local manager preference/notes separately in the copied packet. Pair changes clear preference/notes; roster/review changes remount the study. Late requests cannot replace current-pair evidence. Operator notes and all display strings are untrusted data.
- `shared/draftReviewScenario.ts` derives before/after ordinary roster counts, capacity and position-only maximum matching for one/two departures and one arrival. Reserve/taxi players are excluded from ordinary depth. Removed observed starters are identified. Draft slot is never treated as current roster ownership. No transaction or value recommendation is produced.
- UI and copied packet attribute nflverse contributors, link the producer and CC BY 4.0, disclose TIBER filtering/aggregation and retain the scoped terms notice. This is the accepted historical-use exception, not blanket provider admission.

Validation: focused source-integrity/admission examples, missing/null/share/conflict tests, roster geometry and scoped export tests, UI stale-request/preference-reset/error tests, existing Draft Review routes/service and public-profile containment, plus the existing server/client build. Repository-wide typecheck has unrelated baseline failures; touched-file errors must be resolved and any new diagnostics compared with the unchanged base.

### Comparison refinement (2026-09-10, #372)
The Team UI uses neutral Compare players wording and position-relevant per-recorded-week means. Zero and missing evidence stay distinct. Totals, full metrics and source details are collapsed; sticky metric labels support horizontal comparison. One coverage explanation replaces repeated missing-player cells. Current roster metadata overrides draft descriptions; draft-only candidates are labeled at draft.
Discuss this comparison copies the existing packet fields with a comparison task instruction. The UI emits blank manager-judgment fields; preferences/hypotheses belong in the receiving agent conversation. No saved agent context is retrieved. Optional geometry remains collapsed, page-local, exported separately and cleared on roster refresh/navigation. Clipboard completion is invalidated on study changes. No Data admission or bundle changes are included.
