# Public League Context Slice 1 — implementation receipt

Joe authorized library implementation, focused checks, independent review and a
draft PR. Keep it draft, unmerged, unhosted and unactivated.

October 30 follow-up: the [Node 20 qualification receipt](public-mcp-slice-1-node20-2026-10-30.md)
records fresh runtime tests and CI coverage. The Node 24 results and unperformed
checks below describe the original implementation run, not the later qualification.

## Base and implementation

Actual base: `912904d324626f8caf91a9b259c59dd16068c19a`.
Base tree: `78f543b11af3cc33b453dc8191ac6bbbfe8934b0`.
GitHub main was read before implementation and matched the audited design reference;
there is no relevant drift. Work is isolated on `feat/public-mcp-slice-1`.
The PR receipt records the resulting candidate head/tree and exact independent review.

- `leagueMcp/lineupContext.ts`: neutral explicit-selection compiler, required
  injected sources, shared identity, slots/buckets, byes and waiver composition.
- `leagueMcp/personalContext.ts`: preserved profile/default/selection wrapper;
  `myLeagues` and `scheduleStrength` remain siblings. Historical seasons, null-week
  behavior, schemas, partial failures and private candidate shapes are retained.
- `publicLeagueMcp/{contracts,tools,sources}.ts`: strict fixed six-tool contracts,
  public selection/metadata, fresh season/week gates, injected-reference validation
  and public evidence projection. No private dispatcher or implicit live default.
- `draftReview/{sourceObservations,rosterCensus}.ts`: invocation-local observation
  reuse and independent complete-census membership with cross-roster conflicts.
- `draftReview/{teamLeagues,leagueAvailability}.ts` and `leagueMcp/rosterContext.ts`:
  shared observation clocks and factored legacy coverage validation. Raw league and
  roster settings still reach the waiver compiler; private census semantics do not change.
- `tsconfig.league-check.json`: explicitly includes `server/modules/publicLeagueMcp/**/*.ts`.
- Four new test/support files, module documentation, this receipt, developer note and
  required append-only agent logs.

## Public behavior

Exactly six names: `tiber_public_capabilities`, `tiber_public_list_leagues`,
`tiber_public_list_league_rosters`, `tiber_public_get_roster_context`,
`tiber_public_get_lineup_context`, `tiber_public_get_weekly_matchups`.
Unknown names and malformed inputs cause zero source reads. Account, source IDs,
season, integer roster ID, string week, trimmed candidates and strict objects use
the handoff bounds. Sources must be explicitly injected.

Contextual results identify `public_explicit_selection`, supplied/resolved selectors
and `accountControlVerified:false`. Successful lineup selection has
`basis:explicit_account_and_league`. Capabilities identify in-process implementation
only; no endpoint, activated source, global budget, cache or client acceptance is claimed.

Public-only differences: fresh current-season NFL-state gate even for explicit
weeks; omitted week requires a regular leg 1–18; no silent roster choice; current
starters are never historical verified. Exact numeric IDs can expose independent
membership (`on_selected_roster`, `rostered_elsewhere`,
`not_observed_in_complete_census`, `unknown`). Incomplete/conflicting census yields
unknown membership for every candidate. Ordinary unrostered classification still
requires exact directory identity, active-pool evidence and complete census.
Claims remain unknown. Stale/invalid reference evidence withholds enrichment/byes;
source clocks are never restamped, including expiry during compilation.

## Validation

Runtime: Node 24.22.1, Python 3.12.14. Existing installed dependencies were reused
only after package.json and package-lock.json byte equality with their source
checkout. No dependency versions were changed or provider sources activated.

```sh
node --import tsx --test \
  tests/leagueReader.test.ts tests/personalLeagueContext.test.ts \
  tests/leagueScoringSettings.test.ts tests/scheduleStrength.test.ts \
  tests/combinedLeagueReader.test.ts tests/leagueReaderHardening.test.ts \
  tests/leagueReaderProtocol.test.ts tests/publicLeagueContracts.test.ts \
  tests/publicLeagueLineup.test.ts tests/publicRosterCensus.test.ts

npm test -- --runTestsByPath \
  server/modules/draftReview/__tests__/teamLeagues.test.ts \
  server/modules/draftReview/__tests__/waiverCandidates.test.ts \
  server/modules/draftReview/__tests__/unrosteredTes.test.ts --coverage=false

node_modules/.bin/tsc -p tsconfig.league-check.json --noEmit
node_modules/.bin/tsc -p tsconfig.league-check.json --noEmit --listFiles
sh build.sh
npm run typecheck
git diff --check
```

Results after review repairs: 107 Node tests (63 existing, 44 new) and 60
Jest tests/3 suites pass. Scoped typecheck and import-graph assertions pass. The
module graph includes the neutral compiler and excludes private profile/registry,
ROS reader, private evidence/artifacts and app/database startup. This is not a
hosted bundle acceptance claim.

The application build passes with existing duplicate `applyAdjusters`, stale
Browserslist and large-client-chunk warnings. Repository-wide typecheck fails with
507 diagnostics. The same command on an isolated, unchanged base produces exactly
the same 507 diagnostic lines: zero added or removed. No unrelated cleanup or
assertion weakening was performed. Full-repository Jest, Node 20 runtime testing,
physical-phone/client acceptance and real source tests were not run.

Acceptance covers all six in-process tools; strict zero-read refusals; interleaved
accounts/leagues; source reuse/settlement; exact/co-owner/ambiguous membership;
current-season/explicit-week gating; invalid implicit weeks; numeric census fallback,
conflicts and incomplete coverage; identity/active-pool/ambiguity; independent clocks
and stale/invalid references; 128/132/148/256 scoring and zeroes; raw FAAB; private
historical/unknown-week behavior, private ROS sibling and existing protocol/Worker
regressions. All new fixtures are synthetic.

## Review and boundaries

Independent review of initial head `6d320e52da44a7f9bd461275e8c517ad03b8de0f`
found three blockers beyond the initial passing tests:

1. P1: an omitted runtime source bag could reach inherited live-reader defaults.
   Public dispatch now checks all required dependencies at runtime after syntax
   validation; absent/null/incomplete bags produce bounded failures and zero reads.
2. P2: a nonnumeric account lookup could accept a contradictory returned username.
   Public discovery now verifies the raw ASCII username, case-insensitively, before
   reading that account's leagues. Missing or malformed usernames fail closed;
   display sanitization cannot repair identity. Private discovery is unchanged.
3. P2: a synchronously throwing injected method could bypass an inherited sibling
   settlement barrier. Public methods now normalize synchronous throws into promise
   rejections, preserving settlement of pending league/roster and matchup/state reads.

Seven new tests cover the repairs, including intercepted global fetch and deferred
siblings. A fresh exact-head review is required and recorded in draft PR #433;
this receipt does not imply that review passed before it occurred.

No HTTP/SDK registration, public Worker, Cloudflare resources, Durable Objects, R2,
persistent caching, provider governor, credentials, access-policy changes or source
activation. No ROP, Teamstate, Forecast, ROS ratings, recommendations, transactions
or saved personal preferences were added. Existing private hosting and connector
configuration are unchanged.

Slice 2 still needs the public transport and registration, governed production
source adapter and global budgets, persistent reference caches, isolation/build
qualification, request/body/response/error controls, and separately authorized
hosted deployment and client acceptance. The library does not enforce those controls.
