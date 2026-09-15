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

Prior operator acceptance: TIBER-Data PR #264 comment 5574349251. The previous 72 identities retain that receipt and unchanged profiles. This consumer now pins Data PR #268's reviewed preparation commit `488220fa05c834aad3a4e2bea839a1843131053a`, adding exactly Parker Washington (9487), Drake London (8112), and Chris Rodriguez (10219). Separate Team admission receipt `exports/promoted/draft_review/team_identity_admission_v1.json` records the earlier branch-preparation authority (#268 comment 5627117154). Its `consumer_bundle_regeneration_authorized:false` remains a truthful historical stage; later explicit consumer integration/regeneration/isolated-preview authority is #372 comment 5627769635. Both travel separately in provenance. Neither grants merge or production release permission.

- `historicalEvidence.ts` adds optional `historical_evidence` to the existing v0_1 context without changing its observed/derived/forecast fields. The immutable public bundle is selected per roster, limited to 32 requested players; larger selections explicitly report unavailable.
- `GET /api/draft-review/evidence?player_ids=<one-to-three-exact-ids>` provides the same public evidence for up to three players, including players outside the selected roster. Numeric Sleeper IDs and uppercase defense IDs are bounded; unmapped IDs return explicit player-level unavailability. No database, user identity, write route, upstream request, or new environment variable.
- The runtime verifies the complete 106,062-byte bundle SHA-256 before caching immutable bytes. Each request parses fresh data. Missing/changed artifacts fail closed without substituting fixture or live data. The runtime expects the tracked artifact at `server/modules/draftReview/artifacts/historical2025.json` beneath the existing repository working directory.
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

### League navigation (#375, 2026-09-13)
`teamLeagues.ts` provides request-time public account/season league discovery and on-selection roster membership. Strict input and source schemas preserve numeric IDs as strings, unknown scoring as null and zero reception scoring as zero. Lists above 128, duplicate IDs, mismatched seasons, incomplete selected-league rosters and conflicting memberships fail unavailable without returning partial selectable data. No player-directory or all-league roster fan-out. Separate response clocks identify account, league-list and selected league/roster retrieval.

The collapsible phone picker retains the public list in page memory while navigating existing Team URLs; it does not add browser persistence or authenticated ownership. Name/format search, empty/error states, explicit season selection and multiple-roster choice are included. URL navigation and rapid switching invalidate late membership responses. Existing study confirmation and handoff isolation remain in place. A `team-auth` profile also exposes the owner-scoped linked-account path documented in `../teamAuth/MODULE.md`; no private link or My Leagues state is attached to public packets.

## Manager weekly results v0 (2026-09-15)
The additive public `/api/draft-review/manager-week` and Team Manager view reuse public league discovery from #375. Explicit account/season/league selections and one week produce source-attributed score cards and provisional head-to-head-only counts. Selection stays in page memory. Current membership is not historical ownership or authenticated control. Strict scope/coverage checks, commissioner override precedence, prior same-season regular-leg gating and pending/unavailable states are documented in `docs/reviews/team-manager-weekly-results-v0.md`. No private account reuse, standings, saved profiles, season totals, schedule/finality claim, median record, auth activation, DB, new env vars or fantasy writes.


Manager weekly-results review repair (2026-09-15, PR #387): the client retains a 30-start/61-second request budget across explicit refreshes, with abortable capacity waits and one bounded 429 retry; server limits are unchanged. Missing/invalid NFL state retains scores as unavailable W/L/T with an explicit state failure, while valid non-prior state remains pending. See `docs/reviews/team-manager-weekly-results-v0.md`.
