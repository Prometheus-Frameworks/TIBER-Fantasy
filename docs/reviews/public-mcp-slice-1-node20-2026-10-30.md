# Public League Context Slice 1 — Node 20 qualification

Joe requested Node 20 compatibility qualification of draft PR #433 before
considering Slice 2. Keep the PR draft, unmerged and unactivated. This receipt
qualifies the in-process library and its focused private-reader regressions;
it is not public hosting, provider or client acceptance.

## Candidate and environment

- Inspected PR head: `2496f6bb32438f90bcc60435835ab7759c6fb8ee`.
- Inspected tree: `7c0e52f48a90b45c2c78527f4096fd629d0c75fa`.
- Current main/base: `912904d324626f8caf91a9b259c59dd16068c19a`, unchanged
  from the original audited design reference.
- Isolated local branch: `codex/public-mcp-node20-qualification`; qualification
  changes are limited to CI, documentation and required append-only agent logs.
  Application code, tests, manifests and lockfile are unchanged from the candidate.
- Declared runtime: `.node-version` is `20`; Core Build selects Node `20`.
- Executed runtime: official Linux x64 Node `v20.20.2`, npm `10.8.2`, selected
  through a command-scoped PATH, including child processes and npm scripts.
- Official distribution archive SHA-256, checked against its published SHASUMS256:
  `df770b2a6f130ed8627c9782c988fda9669fa23898329a61a871e32f965e007d`.
  Extracted executable SHA-256:
  `6295488653f0d93b0a157841746fef7e72cc4328cfb60c4bbe0ca2668a836ffd`.
- Initial tests reused dependencies only after manifest/lock byte equality.
  Then a fresh, isolated `npm ci` under Node 20 installed 1,184 packages; the
  complete checks below passed again against that clean installation.
- Package manifest SHA-256:
  `6465e7936e11e92b7f3cc27cd5f3893b045970f6777e00092615167262427dd5`.
  Lockfile SHA-256:
  `200d6a2faf2484883a3b9694f45aca9ff580530adc2dfaa15041bacba1a6cbbc`.

An initial local extraction produced an incomplete executable and failed before
JavaScript/test startup. Re-extraction restored the full 98,932,688-byte binary;
the checksum-verified executable then ran normally. This was a setup failure,
not a passing test or an application compatibility finding.

## Results and comparison

| Check | Node 24.22.1 implementation record | Node 20.20.2 qualification |
| --- | --- | --- |
| Focused Node suite | 107 pass | 107 pass; zero failed, skipped or cancelled |
| Shared discovery/waiver Jest suites | 60 pass / 3 suites | 60 pass / 3 suites |
| Scoped TypeScript | Pass; public modules included | Pass; `--listFiles` includes contracts, sources and tools |
| Runtime import-graph isolation | Pass within Node suite | Pass within Node suite |
| Application build | Pass with inherited warnings | Pass with the same warning categories |
| Full-repository TypeScript | 507 diagnostics, unchanged from base | Not rerun; no claim of repository-wide typecheck health |

A same-session Node 24.22.1 replay also passed all 107 Node tests. Its test names
and order match the Node 20 run exactly. The Node 24 Jest/build/full-typecheck
column above remains attributed to the original implementation receipt.

No Node 20 application incompatibility was found and no runtime correction or
weakened assertion was needed. The seven regression tests for the original review
findings all execute in the 107-test Node 20 suite:

| Repaired boundary | Observed Node 20 behavior |
| --- | --- |
| Missing/null/incomplete injected sources | All five source-reading public tools fail closed with zero intercepted global fetches and zero fixture source calls; capabilities remain source-free. |
| Contradictory username | Missing, malformed or different raw usernames fail before league expansion; ASCII case variants of the same username succeed. |
| Synchronous source failures | Four public operations wait for a pending league read when the roster source throws synchronously; weekly matchups also drain pending scores when NFL state throws. |

The suite also retains interleaved account/league isolation, invocation-local
observations, strict zero-read input/name refusals, reference expiry, census
uncertainty and unchanged private wrapper defaults/historical/null-week behavior.
The public import graph excludes the private wrapper/registry/Worker, private
artifacts and application/database startup. Synthetic Worker/protocol checks
remain local tests; their names do not imply hosted acceptance.

## Reproduction

Use Node 20 on PATH for every command, including spawned processes. The dependency
and validation sequence uses the existing repository workflow:

```sh
node --version
npm --version
npm ci
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
node_modules/.bin/tsc -p tsconfig.league-check.json --noEmit --listFiles
sh build.sh
git diff --check
```

The application build retains duplicate `applyAdjusters`, stale Browserslist and
large-client-chunk warnings. Its success is separate from executing runtime tests.
The earlier Core Build run `40813772505` installed and built only; it cannot be
used as evidence that the 107 focused Node tests ran under Node 20.

## Continuing CI and independent review

`.github/workflows/core-build.yml` adds a separate **Public MCP runtime (Node 20)**
job alongside the unchanged application-build job. It checks out the exact PR
head (or event commit for push/manual runs), prints the commit and Node/npm versions,
asserts Node major 20, runs locked `npm ci`, the 107-test Node command, the 60-test
Jest command, and scoped TypeScript with the included-file list.

The job runs for every PR and main push under the existing workflow triggers,
including draft PRs, without path filters that could miss transitive changes.
It has read-only repository permissions, no provider credentials or activation,
and no deployment step. Branch-protection settings were not changed. Its run steps
were executed locally with the clean Node 20 installation; YAML/shell syntax and
the exact-head selection were checked.

A separate reviewer independently reran all 107 Node tests and scoped TypeScript
at original head `2496f6bb32438f90bcc60435835ab7759c6fb8ee` on Node 20.20.2.
Additional scratch probes covered 70 malformed-source-bag refusals, removing a
source after adapter creation, seven malformed/contradictory usernames, ASCII-case
acceptance, numeric-ID mismatch, and reversed synchronous-failure directions for
four league/roster pairs plus the matchup/state pair. All passed with zero global
fetch calls. No blocker was identified. These probes complement the committed
regressions; final qualification-head review is recorded separately below.

Final published head/tree, independent reviewer results and GitHub job outcomes
are recorded on [PR #433](https://github.com/Prometheus-Frameworks/TIBER-Fantasy/pull/433)
after they occur, without changing the reviewed commit merely to insert its own
hash. The original Node 24 review remains bound to `2496f6b`; it is not substituted
for independent Node 20 verification.

## Remaining Slice 2 prerequisites

This closes the focused Node 20 runtime-compatibility gap, subject to the separately
recorded final-head independent review. It does not authorize Slice 2 or release.
Slice 2 still needs a bounded implementation/acceptance plan for:

1. Public transport/SDK registration, exact tool allowlisting and isolation/build
   qualification that excludes the private reader and private artifacts.
2. Governed production source adapters, shared concurrency/rate budgets and
   persistent reference caches with preserved acquisition/freshness semantics.
3. Request/body/response/error limits, deadlines, cancellation/settlement behavior
   and containment of upstream payload/resource amplification.
4. Separately authorized hosting/access configuration, real-provider tests and
   hosted/client acceptance before any activation or public access.

No endpoint, hosting, access policy, production source, credential, database,
private artifact, account selection or roster action changed. Full-repository
Jest, real-provider, deployed-Worker and physical-client acceptance remain outside
this qualification.
