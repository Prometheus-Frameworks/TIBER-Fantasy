# Combined MCP integration validation — October 26, 2026

## Scope and exact starting state

Joe authorized inspection, necessary repairs, compatibility validation and an
independent exact-head review of PR #422 before a separate main-merge decision.
Main merge, hosted access, credentials, provider integrations and deployments
remain outside this task.

Starting integration head: `cfdba53c2cee077cf78332b834d286d37e34e3d3`;
tree: `5854491e25b67ce2a92e7893da18c282ddd4fac7`.
It includes #424 via `aba1147ee07c4cc512c805f0d75b163069ed826e` and #425 via
the starting head above. Their individual reviews do not certify this integration.

Current main inspected: `d9792924012ab89f54c47d23f86804f19c05309e`;
common ancestor: `c4adf6effdeff0c6a68f92aece759b03fe575b29`.
`git merge-tree --write-tree` and a local `git merge --no-commit --no-ff`
both reproduced exactly two content conflicts: `.claude/context-log.md` and
`.claude/agents/codex.md`. Application code merged without conflict. Main's
research-first README and both parents' complete appended log histories are
preserved; assertions compared each log suffix to both exact parent versions.
This merges main **into the integration branch**, not #422 into main.

## Resulting changes

- Reconcile the two append-only log conflicts and retain main's README.
- Add four combined regressions in `tests/combinedLeagueReader.test.ts`.
- Correct eight default tools/ninth optional ROP tool and current child-PR
  status in the module/developer documentation. Earlier dated receipts remain
  historical. No production runtime, source, dependency, contract or access
  control implementation is changed by this validation repair.

## Interaction review

The personal lineup and schedule-only ROS readers reuse exact directory
matching and the validated schedule/cache. Integration tests compare the same
native Sleeper player ID, current team, decision week, scoring, schedule content
hash and verified bye through the actual MCP server. League ownership and
nonmember-roster refusal remain enforced. Invalid account overrides fail the
strict schema.

ROS retains explicit calendar windows, unknown locks, missing-final witnesses,
separate clocks and null defensive ratings. It imports no legacy SOS rating,
database, private ROP input or statistical producer. The independently scoped
ROP reader accepts GSIS IDs only and returns frozen W1–5 rows/states without a
Sleeper join, current-team inference, projection or history extension. Discovery,
lineup and ROS calls leave its artifact loader untouched; the first valid ROP
read initializes once. Covered weeks and an out-of-scope W7 remain distinct.

Lineup and ROS share one source-read busy slot. A concurrent ROS call is refused
while lineup source work remains active, while immutable ROP remains readable
without provider work. Existing deadline, bounded-body, redirect and slot-release
regressions also pass. Unknown and ROP names cannot fall into league dispatch.

A synthetic built-Worker harness tests all three readers together behind the
unchanged identity/origin checks, no-store responses and strict profile selectors.
It toggles the league and ROP source markers independently: disabling league
sources preserves local ROP, and disabling ROP preserves league/ROS reads. The
default Worker still contains null private input; a runtime marker cannot add
the ninth tool or populate an artifact. This is synthetic composition validation,
not authentication of a retained release or an alternate private build workflow.

Owner-private Sites admission and the trusted injected visitor header remain
essential: this is a single configured profile, not multi-user authorization.
No access check was relaxed. Per-isolate controls remain per-isolate limits.

## Verification

Node `24.22.1`, Python `3.12.14`. An offline dependency installation could not
finish because one npm tarball was absent from cache. Validation reused an
existing dependency installation whose `package.json` and `package-lock.json`
match this candidate byte-for-byte; neither file was changed. The published
Core Build workflow uses Node 20; its result must be checked separately.

| Check | Result |
| --- | --- |
| Seven native MCP suites, including four new combined checks | 67 pass |
| Existing Team discovery/directory/history/waiver compatibility | 85 pass in five suites |
| Synthetic Python preparation/build/path guards | 9 pass |
| Strict scoped TypeScript | Pass |
| Full application build, `sh build.sh` | Pass |
| Public Worker bundle and import isolation | Pass; 236 modules; no private input |
| Local HTTP/curl against built, source-disabled Worker | 7 pass; zero provider calls |
| Parent log-history preservation and diff whitespace | Pass |

Public Worker: 425,118 bytes (120,648 gzip), SHA-256
`a3217ab12fecc498cb57ca3a7b5de297f3cbe27da7795065230d1b3e6c0ec9fc`.
The existing builder's isolation audit passes; manual import inspection also
checks for legacy SOS/database/producer imports. The application build retains
the inherited duplicate `applyAdjusters`, old Browserslist data and large client
chunk warnings. No dependency or bundler configuration repair was made.

Replay from repository root with locked dependencies available:

```sh
node --import tsx --test tests/leagueReader.test.ts tests/leagueReaderProtocol.test.ts tests/personalLeagueContext.test.ts tests/leagueReaderHardening.test.ts tests/roleHistory.test.ts tests/scheduleStrength.test.ts tests/combinedLeagueReader.test.ts
python3 -m unittest discover -s tests -p 'test_private_role_preparation.py'
node_modules/.bin/tsc -p tsconfig.league-check.json --noEmit
npm test -- --runTestsByPath server/modules/draftReview/__tests__/teamLeagues.test.ts server/modules/draftReview/__tests__/draftReviewService.test.ts server/modules/draftReview/__tests__/historicalCatalog.test.ts server/modules/draftReview/__tests__/unrosteredTes.test.ts server/modules/draftReview/__tests__/waiverCandidates.test.ts --coverage=false
sh build.sh
node scripts/buildLeagueReaderWorker.mjs /absolute/public-output/worker.mjs
git diff --check
```

## Review and acceptance boundary

The author found no runtime blocker in this combined validation. Independent
inspection is requested for the final reconciled commit; its exact SHA, base,
tree, findings and disposition belong in a separate receipt on PR #422 so
recording a review does not change the reviewed head. Recheck GitHub mergeability
and CI on that head before the operator considers a main merge. Do not transfer
the old #422 or individual child reviews to this candidate.

No actual retained private input was acquired, parsed or rebuilt here. Earlier
private release equality/build/replay receipts remain bound to their own heads.
Full-repository Jest/typecheck, physical iPhone acceptance, second-user OAuth,
platform header stripping, hosted Worker size/startup and installed-connector
acceptance of the combined readers are not established by these checks.

Hosted version 3's historical acceptance belongs to
`fdffe2aeb4f1760f3f08f86d7c42f413762e19d3`. No Site, credentials, audience,
environment, provider, database, upstream producer or deployment was changed.
**Keep #422 open and unmerged; source readiness is separate from deployment.**
