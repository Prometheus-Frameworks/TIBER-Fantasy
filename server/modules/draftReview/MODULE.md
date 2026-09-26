# TIBER Team / Draft Review compiler

Read-only public context compiler for a Sleeper redraft roster.

## Team web entry (issue #371)

- `/team` and the preserved `/draft-review` alias render the same page. Both `sleeper_url` and legacy `sleeper_input` query parameters still resolve through the existing API. The public runtime's entry/logo goes to `/team`; full-profile Observatory and Management routes retain their existing behavior.
- Explicit roster refresh repeats the public roster read, preserving the existing 24-hour player-directory cache. Change roster opens the same league's selector; Change league clears the entry. URL navigation invalidates pending reads, and a successful read canonicalizes the current history entry.
- Current starter membership, bench, reserve and taxi are separate groups, including empty groups. Configured starting slots are not inferred player-to-slot assignments. Reserve settings display allowed/not allowed/unknown separately from unavailable current player eligibility. Missing NFL team remains unknown.
- Copy roster link produces an origin-local `/team?sleeper_url=…` locator. Opening it fetches current data and starts a new study; it contains no snapshot, preference, note or hypothetical roster. Copy agent context contains the current snapshot and matching local study through the unchanged packet contract. Clipboard failures remain visible. No durable notes, browser storage, account ownership or transaction authorization.
- Refresh/switch controls warn before discarding a preference, note or hypothetical roster. Pair changes, review loads, reloads and navigation clear local study state. A copied packet must be retained outside the page if the operator wants to keep it.
- The comparison keeps the bounded horizontal scroller, focus access, readable light controls, historical attribution and missing-value semantics. Original draft detail is secondary; unavailable Forecast evidence remains explicit.
- No runtime-profile name, dependency, database, artifact or provider change. The existing isolated Railway PR environment is the preview path, subject to verifying its base and inherited isolation before publication. Implementation approval does not authorize merge or production release.

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

Current branch preparation adds nineteen further profiles as documented below; the original #372 stage and its receipts remain archived unchanged.

Prior operator acceptance: TIBER-Data PR #264 comment 5574349251. The previous 72 identities retain that receipt and unchanged profiles. This consumer now pins Data PR #268's reviewed preparation commit `488220fa05c834aad3a4e2bea839a1843131053a`, adding exactly Parker Washington (9487), Drake London (8112), and Chris Rodriguez (10219). Separate Team admission receipt `exports/promoted/draft_review/team_identity_admission_v1.json` records the earlier branch-preparation authority (#268 comment 5627117154). Its `consumer_bundle_regeneration_authorized:false` remains a truthful historical stage; later explicit consumer integration/regeneration/isolated-preview authority is #372 comment 5627769635. Both travel separately in provenance. Neither grants merge or production release permission.

- `historicalEvidence.ts` adds optional `historical_evidence` to the existing v0_1 context without changing its observed/derived/forecast fields. The immutable public bundle is selected per roster, limited to 32 requested players; larger selections explicitly report unavailable.
- `GET /api/draft-review/evidence?player_ids=<one-to-three-exact-ids>` provides the same public evidence for up to three players, including players outside the selected roster. Numeric Sleeper IDs and uppercase defense IDs are bounded; unmapped IDs return explicit player-level unavailability. No database, user identity, write route, upstream request, or new environment variable.
- The runtime verifies the complete 134,266-byte bundle SHA-256 before caching immutable bytes. Each request parses fresh data. Missing/changed artifacts fail closed without substituting fixture or live data. The runtime expects the tracked artifact at `server/modules/draftReview/artifacts/historical2025.json` beneath the existing repository working directory.
- `scripts/buildDraftReviewEvidenceBundle.py --data-repo <local-data-checkout> --check` replays the consumer transform from fixed Git objects and SHA-256 pins, entirely offline. Omit `--check` to regenerate the same committed consumer bundle. This does not refresh sources, promote new IDs or write to Data.
- Producer inputs: Data's admitted `exports/promoted/identity_crosswalk/tiber_identity_crosswalk_v2.json`, `exports/promoted/draft_review/evidence_admission_v1.json`, the separate Team admission receipt, and the two accepted `data/processed/evidence/player_weekly_{usage,ppr_outcomes}_2025.source_backed.json` files. Exact paths, hashes, producer commit and acceptance link ship in the packet. The six-row promoted weekly fixtures are not consumed.
- Only 2025 weeks 1–18, ten approved raw outcome fields and two share fields are aggregated. Missing values stay missing. Totals require all recorded values; means disclose nonnull-week denominators. A mean weekly share is not a season share. Shares are not clamped to 0–1. Conflicting weekly team/opponent/position blocks joined usage, while independent outcome derivations remain available.
- Routes, snaps, red-zone usage, rush share, air-yards totals, league scoring totals/subtotals and regression probabilities remain unavailable. Original acquisition/update clocks, release hash and package version remain null. Neither materialization time nor the current roster clock makes the history fresh.
- Historical team/position and identity confidence are distinct from current Sleeper observations. No current workload, injury, bye, manager acceptance or replacement production is inferred.
- The UI compares two or three current-roster candidates and attaches local manager preference/notes separately in the copied packet. Pair changes clear preference/notes; roster/review changes remount the study. Late requests cannot replace current-pair evidence. Operator notes and all display strings are untrusted data.
- `shared/draftReviewScenario.ts` derives before/after ordinary roster counts, capacity and position-only maximum matching for one/two departures and one arrival. Reserve/taxi players are excluded from ordinary depth. Removed observed starters are identified. Draft slot is never treated as current roster ownership. No transaction or value recommendation is produced.
- UI and copied packet attribute nflverse contributors, link the producer and CC BY 4.0, disclose TIBER filtering/aggregation and retain the scoped terms notice. This is the accepted historical-use exception, not blanket provider admission.

Validation: focused source-integrity/admission examples, missing/null/share/conflict tests, roster geometry and scoped export tests, UI stale-request/preference-reset/error tests, existing Draft Review routes/service and public-profile containment, plus the existing server/client build. Repository-wide typecheck has unrelated baseline failures; touched-file errors must be resolved and any new diagnostics compared with the unchanged base.

### Comparison refinement (2026-09-10, #372)
The Team UI uses neutral Compare players wording and position-relevant per-recorded-week means. Zero and missing evidence stay distinct. Totals, full metrics and source details are collapsed; sticky metric labels support horizontal comparison. One coverage explanation replaces repeated missing-player cells. Current roster metadata overrides draft descriptions; draft-only candidates are labeled at draft.
Discuss this comparison copies the existing packet fields with a comparison task instruction. The UI emits blank manager-judgment fields; preferences/hypotheses belong in the receiving agent conversation. No saved agent context is retrieved. Optional geometry remains collapsed, page-local, exported separately and cleared on roster refresh/navigation. Clipboard completion is invalidated on study changes. No Data admission or bundle changes are included.

### Three-player comparison (#372 follow-up)
Optional Add third player / Remove third player controls preserve the two-player default. Every selected ID must be nonempty and distinct before a comparison request or Discuss action. Adding/removing/changing selections immediately invalidates evidence and pending handoffs. One packet contains all selected IDs and the roster once. The read-only endpoint accepts one to three exact IDs with unchanged response fields; four IDs and malformed input are rejected. Existing duplicate request de-duplication remains compatible, while the UI rejects duplicate comparisons. Compact and detailed three-player tables keep fixed readable minimum widths inside the local horizontal scroller; controls and coverage cards stack on phones. Historical identity coverage remains unchanged.

### 2026-09-11 — Codex: Roster-only comparison selectors (#372)
- Compare players now lists only current roster members in all two/three selectors; selection validation requires roster membership. Draft-board candidates remain confined to optional incoming roster geometry.
- Validation: 18 focused Team/evidence UI tests passed, including all three selector option sets, stale responses, duplicate selection, mixed positions and incoming geometry. No API, identity or consumer bundle changes. Stop before merge/production release.

### Three additional historical profiles (#267/#268 → #372)
The offline builder verifies all fixed Data Git objects/hashes, the preparation receipt's exact three edges and full consumer scope, the proposal hash, and the receipt's audit source pins. The receipt's old crosswalk pin is explicitly checked at baseline Data commit `8b762650f4b933b6ce717c551993dcaaf92e1008`; the 75-row crosswalk has its own current pin. Every prior identity row must remain identical. Explicit exceptions keep gates active with Python optimization enabled. No data is downloaded, refreshed or inferred.

Parker has 16 recorded weeks (week 19 excluded); London and Rodriguez each have 12. All three stay `name_exact` / medium confidence. Rodriguez's historical weekly team remains WAS; JAX in the dated identity candidate or current Sleeper observation never rewrites it. Separate admission provenance carries all limitations, including missing acquisition clocks and dated terms assessment. Existing 72 player profiles are unchanged. Watson, Lloyd, Dobbins and Gainwell remain unavailable. The additive optional provenance field preserves existing packet fields and the old acceptance link.

Validation: 11 Python semantic/admission tests pass in normal and optimized modes; deterministic offline `--check` passes; 54 tests across seven focused Jest suites pass. Original 72 profile objects compared exactly with the prior bundle; only the authorized three IDs were added. Build, exact-commit independent review and existing isolated preview receipts are recorded on #372. No Data edits, #269 work, merge or production release.

## Unrostered tight ends — #371 follow-up

`GET /api/draft-review/unrostered-tes?sleeper_url=<canonical roster URL>` is an independent, read-only observation with schema `tiber_team_unrostered_tes_v1`. It uses the existing strict URL parser, league/all-rosters reads and the same single-flight, 24-hour player-directory cache. No users, drafts, database, credentials, provider configuration, rankings, or historical-bundle refresh is required. Existing roster/comparison APIs and handoffs remain unchanged.

- Require matching league ID, valid season, expected roster count 1–64, exactly that many unique roster IDs and the selected roster. A contradictory per-roster league ID fails closed.
- Every roster must supply a `players` array (max 256). Null/missing primary membership is unavailable, never assumed empty. Optional/null starters/reserve/taxi contribute no extra exclusions; when provided they must be valid bounded arrays. Exclude the union of primary players, nonempty/nonzero starters, reserve and taxi across all rosters. No owner IDs or other teams' roster lists are returned.
- Include only the directory's reported primary `position: TE`, without filtering on historical coverage, active status or NFL team. This is not a fantasy-position eligibility claim. Preserve exact numeric IDs; contradictory directory identity fails. Missing names use an ID label; missing team/status/active stay unknown. Sanitize display strings and keep them untrusted in agent instructions.
- Check directory container/entry shapes (1–50,000 entries), candidate count (max 1,024) and response size (max 500,000 UTF-8 bytes). Unsupported/incomplete data is unavailable rather than truncated. Alphabetical ordering is not a recommendation.
- Separate league/roster receive clocks, directory acquisition clock and original displayed roster time. Directory source-update time is unknown. Count agreement is a structural completeness check, not proof of an atomic or still-current source snapshot. Label derived membership **Unrostered when checked**; claim eligibility/timing and Forecast remain unavailable/unknown.
- No-store applies before the new endpoint's existing rate limiter, including 429 responses. Source errors are sanitized; no partial candidate list is returned.

The page adds a collapsed `Explore unrostered TEs` panel after existing comparison. Expansion checks availability; closing unmounts it and reopening checks again. Name search is local; selecting one candidate uses the existing one-ID evidence endpoint. Missing history remains discussable. `Discuss this TE` copies a separate `tiber_team_te_candidate_handoff_v1` attachment with only the selected candidate, scope, observation clocks, historical provenance, unavailable Forecast and existing displayed roster context. No notes/preferences are invented and no private or saved context is retrieved. Existing copy actions do not acquire candidate state.

Refresh, roster/navigation changes and selection changes clear scoped results and invalidate pending evidence/clipboard completion. Failed refresh removes the prior availability assertion. Existing two/three roster-only comparison controls are untouched. New styles are scoped to `.drp-te-*`, with wrapping labels and touch-size controls.

Validation: synthetic complete/incomplete/null/oversized memberships, reserve/taxi/starter-only exclusions, exact identity, directory failures and cache TTL/single-flight; API input/headers/rate limit; independent export scope; UI lazy load, missing history, stale evidence/clipboard, failed refresh/retry, search, close/reopen and parent roster refresh; existing Team/comparison/public-containment regressions. Actual portrait phone acceptance and exact-head independent review remain separate from automated checks.


## PR #373 phone-test refinement — 2026-09-11
Joe reported that the default 792-entry historical TE directory was unsuitable for in-season waiver exploration. The UI now defaults to active=true plus a recognized NFL team, with an explicit broader-directory checkbox; no named-player exclusions or health/role inference. Dark compact cards preserve the surrounding Team surface.

The existing endpoint adds optional `trends`: Sleeper public /players/nfl/trending/add?lookback_hours=24&limit=1000, validated exact IDs/nonnegative safe integer counts/unique rows, five-minute single-flight cache, independent receive clock. No environment variables required. Malformed/outage trends yield unavailable while valid league membership results remain usable. Global add counts sort the shortlist; absent bounded-sample counts remain unknown. The selected-only handoff retains its activity clock/source/window separately. No projection or transaction authority is introduced. Source documentation: https://docs.sleeper.com/#trending-players . Existing raw candidate pool and v1 response remain compatible; default presentation supersedes the prior all-directory UI.

Validation: 64 tests across six affected service/shared/UI/Team/routes/containment suites pass. Full build passed; repository typecheck comparison recorded in PR receipt. No live roster fixtures or screenshots committed. Draft-only change; no merge/production or independent-review claim.

## Nineteen additional historical profiles — 2026-09-13 preparation

This branch pins published Data preparation commit
`5c683e26a843b98358292f0d34a97a98762a96f0` (draft Data PR #271) and the separate
`exports/promoted/draft_review/team_roster_identity_admission_v1.json` receipt.
It adds exactly nineteen reviewed identities, taking the immutable bundle from
75 to 94 profiles. Every old profile and the old three-edge provenance object
remains identical. The new optional `team_roster_identity_admission` provenance
carries exact IDs, hashes, source baseline, limitations, conversation acceptance
and the earlier proposal-review reference separately. No GitHub operator receipt
URL is invented; no independent implementation review is claimed.

Fourteen additions retain name_exact/medium confidence; three gsis_direct and two
espn_bridge additions remain high confidence. Historical teams remain weekly
source teams: Montgomery DET and Pittman IND. Current Sleeper metadata does not
rewrite them. Antonio Williams / 13301 remains outside the admitted 2025 cohort.
No missing history, missing weeks, unsupported metrics or Forecast is populated
with substitute values. Candidate generation clocks never become provider
freshness clocks. Existing attribution and null provenance clocks are retained.

The offline builder now checks the original 72→75 stage and the new 75→94 stage,
requires each exact receipt, rejects changed prior rows or expanded windows,
and validates all pinned source objects. Lazy Git fetching is disabled explicitly;
missing objects fail closed. The runtime content pin is
`24015b41becb5bcbb87bea7e4c5d8443c3e1254a4ceea9c624a023263b021ea1`.
Bundle size is 134266 bytes; the 250000-byte runtime cap is unchanged.

Validation: 15 Python tests in normal and optimized modes, deterministic replay,
exact old-profile/provenance comparison, 60 Jest tests across seven relevant
history/service/routes/UI/shared/containment suites, full sh build.sh, and a built
public-profile /evidence HTTP smoke all pass. Typecheck has the same 506 baseline
diagnostics with identical file/error-code counts and no touched-file errors.
No new dependencies, environment variables, routes, DB or UI behavior.

The operator explicitly authorized publication of both prepared branches and draft
PRs after the initial automatic approval rejection. Command-line Git lacked write
credentials, so Data was published through the authenticated GitHub connection;
its tree exactly matches local preparation commit 790c04f. The consumer source pin
and content hash were updated accordingly, with all profile data unchanged.
Independent implementation review remains pending, followed by separate
merge/deployment decisions. The unrelated #375 and #377 branches are unchanged.


## 2026-09-13 — Accepted P2: preparation is not runtime admission

Operator accepted discussion_r3999768958 and authorized the bounded repair and
next review. The integrity-checked decoder now withholds all nineteen identities
from the preparation-only receipt in every runtime profile, including preview.
It returns unavailable with an explicit promotion/admission reason and null
identity/observations plus empty derived metrics. The runtime caches only this
filtered evidence; direct decoding and cached selections cannot expose the
prepared profiles as available. All 75 prior profile objects and attribution
remain unchanged. The 94-record offline bundle and its source/hash pins remain
unchanged and inspectable for review. Its availability fields describe prepared
source records, not permission to serve the new cohort.

No runtime switch, receipt-stage string or PR merge activates these profiles. A
later separately authorized change must pin accepted promotion evidence and
review the consumer admission policy. This repair does not invent that receipt
or grant promotion. Data #271's accompanying repair changes only its inventory
and handoff, so the existing immutable source pin remains valid.

Regression coverage checks all nineteen withheld identities, exact preservation
of the prior 75, decoder and cache behavior, response mutation isolation, and a
mixed public HTTP comparison. Fresh independent review remains pending; merge
and promotion/release decisions remain separate. This section supersedes the
earlier preparation-stage runtime availability and pending-publication wording.

P2 repair validation: all 62 tests in seven focused suites and the full build passed.


## 2026-09-13 — Separate nineteen-player historical promotion

The current operator grant approves the nineteen-player historical promotion receipt and matching consumer activation implementation, tests, paired PRs and independent review. It explicitly withholds merge and any deployment. Data PR #272 publishes `team_roster_identity_promotion_v1.json` at producer commit `f12234d909adc82e79ca463e76b994c8dd24bdb9`, receipt SHA-256 `215d2b47edb204a138d30725b4e2e3974993f105271667d665c651b825408c85`.

The consumer now validates and embeds that separate receipt, with no edits to the earlier preparation receipts. Its exact whole-bundle pin admits the nineteen historical profiles; runtime flags, stage strings, current roster notes, missing flags or PR merges cannot grant admission. Missing or modified artifact bytes fail closed. All 94 profile objects—including the original 75—and original source limitations, attribution, unknown clocks, historical teams, confidence and unavailable forecasts remain identical. Antonio Williams / 13301 remains unavailable. Historical figures are descriptive 2025 observations, never current-season projections or regression predictions.

The prepared code changes runtime policy only in this proposed revision. Current production still withholds the nineteen until a separately authorized release. This section supersedes the previous unconditional preparation-only gate for the proposed revision; it does not retroactively expand earlier authorizations. No new source acquisition, terms assessment, lineup or ownership inference, transaction, merge or deployment occurred.

Validation: 17 Python tests pass normally and under `-O`; 63 tests pass across seven Jest suites; full build passes. Typecheck retains exactly the baseline 506 diagnostics with no added per-file/error-code counts. Deterministic replay and full equality of all 94 prior historical profile objects are verified. Independent review is recorded separately.

Publication boundary: Fantasy draft PRs previously triggered automatic Railway previews. The consumer PR must not be opened until deployment suppression is verified or the operator separately authorizes that infrastructure change. Draft status alone is insufficient. Do not merge or deploy these activation changes.

## 2026-09-14 — Weekly consumer preparation

An additive `/api/draft-review/weekly` endpoint accepts explicit season/week and returns unavailable until separately admitted. Offline preview/policy lives in `externalModels/weeklyBoxscore`; no weekly artifact is embedded or served, and no environment toggle grants admission. Historical evidence and existing Team packets remain unchanged. See that module and the weekly-consumer preparation audit for validation and release boundaries.

## 2026-09-16 — Waiver context and selected shortlist (#371 follow-up)

Operator requested the smallest useful waiver-handoff improvement after league-by-league use: waiver settings, budget/priority and timestamped candidate membership. Additive `waiver_context` on the roster response retains raw numeric Sleeper settings separately from the interpreted system (0 rolling / 1 reverse standings / 2 FAAB; other codes unknown) and calculated FAAB remaining. Missing/invalid values never default to zero or $100. Remaining = current configured league budget minus reported roster usage; signed usage is retained because adjustments can produce credits. Unsafe or negative results are unknown. This is not a pending-bid-adjusted balance or a reconstructed original budget; no adjustment ledger is reconciled.

`GET /api/draft-review/waiver-candidates?sleeper_url=…` uses the existing strict complete-membership validator and 24-hour directory cache. All primary, starter, reserve and taxi memberships are excluded across every league roster. Scope/count/identity conflicts fail closed. The bounded pool includes only active directory QB/RB/WR/TE entries with recognized NFL teams; that filter does not establish health, playing time or fantasy eligibility. Alphabetical order is not a recommendation. No new provider, env var, DB, authentication or transaction path is introduced.

The new Team panel checks on explicit action, searches locally, displays up to 50 matches, and allows at most five exact selections. Copy agent context and Discuss comparison carry only that shortlist, fresh settings and separate league/roster/directory clocks. The original roster snapshot remains separately timestamped. Refresh clears prior results/selections immediately, errors stay visible, and navigation/unmount invalidate pending responses. Roster refresh clears the attachment even when fixture timestamps coincide. No selection or check is silently treated as manager intent to add a player. Pending claims/results, claim locks/eligibility, processing times and minimum bid remain unavailable. The draft board never establishes present ownership.

Existing TE exploration and history remain unchanged. New packets add `waiver_exploration` (explicit unavailable when no matching check exists); no existing field is removed. Source references: https://docs.sleeper.com/ , https://support.sleeper.com/en/articles/9656662-what-types-of-waivers-do-you-support , https://support.sleeper.com/en/articles/1876040-how-does-faab-bidding-work . The roster API code mapping is an adapter interpretation, not a claim the help articles document numeric enum values.

## 2026-09-19 — Pairwise waiver comparison (#404)

The checked shortlist offers “Compare [player] with another waiver player.” Keep the first candidate while searching/selecting a second, then choose that second candidate from the other shortlist entries. The existing admitted historical endpoint and comparison table supply 2025 weeks 1–18 evidence, denominators and explicit missing coverage. Current directory metadata remains separate from historical teams. No new endpoint, provider, environment variable or evidence admission.

“Discuss this waiver comparison” copies normal roster context, exactly two selected waiver candidates, independent check clocks, validated historical evidence/provenance and explicit Forecast unavailability. It does not copy the full candidate pool or unrelated shortlist entries. An additive `waiver_comparison` v1 field leaves existing packet contracts intact. Pair/shortlist changes remount evidence and invalidate clipboard completions; refresh and review scope changes clear comparison state. This is read-only decision support without rankings, claims or inferred manager intent. Forecast projection and postgame scoring are separate work.

### Team historical Data workspace (v0)
- `GET /api/draft-review/data` returns only the integrity-pinned 2025 admitted cohort (currently 94 profiles), with existing cached Sleeper name labels and a separate directory acquisition clock. Directory failure preserves historical evidence with ID labels. No new source or identity admission.
- `DraftReviewData` loads on demand in Team; search by name/ID, historical-position filter, selectable raw metrics, totals/means sorting and up to four explicitly selected comparisons. Missing values sort last in both directions. Share totals stay unavailable.
- `shared/teamHistoricalData.ts` validates the catalog and builds a selected-only historical investigation attachment while retaining the base roster snapshot. No preference, player ranking, ownership, current role, claim eligibility or transaction is inferred.
- 2026 Weekly Pulse, forecasts and historical weekly-series charts are outside this slice. Actual phone acceptance remains a separate gate.

### Prototype-aligned presentation (visual only)
The standalone Team prototype was used as a visual reference only. It was not code, data, or evidence. Adopted changes are CSS plus class names: roster groups render as divided lists with sentence-case headings; missing team is dimmed but still reads "Unknown"; roster flags read as an attention callout in place; Forecast/draft-unavailable panels, the comparison unavailable message and empty groups are dashed; "Not recorded" is a dashed chip distinct from zero; the no-history column has a dashed divider; comparison selects, headers and values are restyled; decorative `aria-hidden` skeletons accompany the unchanged loading text; phone hero spacing is tighter. No copy, order, control, request sequencing, study invalidation, clipboard flow, metric-row rule or packet field changed. Proposed interaction changes (tap-to-compare tray, actions sheet, compact tabbed header, top attention card, evidence-only metric rows, evidence retry, reordered League section, new fonts) await operator decision.
