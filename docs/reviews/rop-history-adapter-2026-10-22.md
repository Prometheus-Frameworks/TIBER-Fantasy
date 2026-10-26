# Frozen ROP history adapter — implementation and decision packet

Status: implementation candidate for **draft PR #424, stacked on #422**.
Current path-guard repair evidence is below; earlier implementation/replay
receipts remain historical and bound to their original heads. The latest
GitHub review receipt identifies the exact reviewed commit. No merge or hosted
publication is authorized by this packet.

## Path-guard repair — October 26, 2026

Joe authorized repairing review finding
[#424 discussion_r4365444018](https://github.com/Prometheus-Frameworks/TIBER-Fantasy/pull/424#discussion_r4365444018)
and reviewing the changed version. The starting head was
`98f0d50a77436ece6db948ceabc62199a4072640`; #422's base remains
`fdffe2aeb4f1760f3f08f86d7c42f413762e19d3`.

`owner_paths` now rejects an existing output entry, including a dangling
symlink, and dangling symlink ancestors **before resolving the output path**.
The canonical outside-repository check, owner/CI refusal, exclusive 0600 write,
archive authentication, prepared-input pins and sanitized CLI failure remain.

Synthetic CLI regressions cover a dangling output, direct and deeper dangling
ancestors, preserved existing files/directories/symlinks, a canonical path back
into the repository, and a successful fresh nested output with restrictive
permissions. Rejected paths are refused before archive preparation and create
no destination directories. The two dangling-link regression methods produced
three failing cases on the old helper, then passed with the repair.

Validation in an isolated worktree using Python 3.12.14, Node 24.22.1 and
existing dependencies whose package/lock files match this head:

- Nine synthetic Python preparation/build tests pass.
- 45 native MCP/ROP reader, protocol, personal-context and hardening tests pass.
- `git diff --check` passes.

This bounded repair changes the Python preparation helper and its synthetic
tests, plus this packet and the required agent logs. TypeScript/runtime code,
dependencies and archive transformation are unchanged. No retained private
input, producer, source acquisition, private Worker build/replay or hosted
acceptance was exercised. Earlier private hashes are not a fresh certification
of this revision. Independent review is recorded separately on the published
head; keep #424 draft and unmerged.

## Problem and resulting behavior

The working personal MCP supplies league context but cannot read the retained
ROP release. This candidate adds one separate read-only operation:
`tiber_get_rop_role_history`. An explicit native GSIS subject and at most five
distinct weeks return the exact frozen rows, States, bindings, source clocks,
share operands/definitions and original limitations. It does not run a producer,
fetch new inputs, join Sleeper IDs or recalculate football evidence.

Joe accepted Draft 2's connected architecture on October 22 and granted repeated
owner-private descriptive reads of `TIBER-ROP-2026-W01-W05-Private-Release` v2
through the TIBER MCP role-evidence path: no sharing, promotion or other consumer.
GitHub remains the research home. The separate #67 successor is approved future
documentation and does not block this adapter; #67 itself is unchanged.

## Base and Site relationship

- Branched from exact #422 head `fdffe2aeb4f1760f3f08f86d7c42f413762e19d3`,
  branch `codex/mcp-personal-context-20261014`. This PR targets that branch,
  so the review delta contains the adapter rather than the unmerged connector.
  Main/base remained `c4adf6effdeff0c6a68f92aece759b03fe575b29` at inspection.
- Site source `b8e210a987665757a55f8220b5b66f1dec14bc3b` belongs to the separate
  Sites source repository. It is not a Fantasy commit or a base to branch from.
- [#422's version-3 receipt](https://github.com/Prometheus-Frameworks/TIBER-Fantasy/pull/422#pullrequestreview-5536568114)
  states it was rebuilt from the reviewed Fantasy head and records Worker hash
  `cd2c5f51b6c493cdc4a51f974f8489b1cc46678b7a09b41087e70d3085ebe572`.
  This task independently rebuilt the untouched #422 head with locked dependencies:
  **the Worker bytes reproduce that exact hash**. This verifies the build/receipt
  relationship, not a fresh inspection of the deployed Site's current bytes.
- Corrected #422's stale PR-body instruction from “Keep draft” to its actual
  non-draft state, preserving the instruction to keep it unmerged. Its head,
  draft state and merge state were not changed; historical review receipts stay
  historical. #422 is not merged by this work.

## Delta and boundaries

- New pure `server/modules/roleEvidence/` reader, strict GSIS-only request and
  explicit per-week coverage. No names, fuzzy matching or identity crosswalk.
- Separate MCP registration and response-size envelope. League dispatch now
  rejects non-owned names before schema selection and invokes matchups only for
  the explicit matchup name; no fall-through remains.
- The default/public build retains a null private input and seven tools.
  A private build registers ROP; its independent runtime kill switch is
  `TIBER_ROP_SOURCE=private-frozen-w01-w05-v2`. Disabled ROP stays withheld in
  capability metadata. Existing league source mode is not relabelled as ROP.
- Owner-only Python preparation authenticates the exact archive, all 1,216
  manifest members, population, output and retained clean review; it preserves
  all 1,045 rows and 939 State objects/bindings. It executes no package code.
- Private build requires explicit owner mode, no CI marker, paths outside the
  repo, an independent fixed prepared-input pin, isolated imports and a new
  output path. Private output is restrictive (0600); the helpers print only
  hashes/counts/check results and sanitize private comparison/build failures.
  CI/public builds receive no populated artifact. Synthetic test fixtures only.
- No source, producer, upstream contract, database, dependency/lockfile, research
  issue, #67 record, Site, access policy or environment configuration changed.

Producer repository: `Prometheus-Frameworks/Role-and-opportunity-model`.
Producer revision: `de9e540178cd8d45c8cbea5837a1ba7d0eaa020c` (packaged private
successor, not assumed fetchable on public main).
Consumer contract: `tiber_rop_role_history_v1` wrapping unchanged retained rows
and `weekly_role_state_v1` States. Input path: private release
`outputs/player-weeks.json`, `population.json`, `outputs/states/` and the exact
retained `review/output-review.json`; preparation verifies all other members too.

## Validation results

| Check | Result |
| --- | --- |
| Native reader/protocol/process/hosted regressions | 42 pass: 34 inherited + 8 new |
| Existing Team/waiver/catalog tests | 85 pass in five suites |
| Synthetic Python preparation/build guards | 4 pass |
| Scoped strict TypeScript | Pass (`tsconfig.league-check.json`) |
| Server build | Pass; inherited duplicate `applyAdjusters` warning |
| Public/default Worker build | Pass; 232 modules; private input absent |
| Private Worker build | Pass; 232 modules; isolation audit retained |
| Retained-byte comparisons | All 1,045 rows and 939 State objects/bindings equal |
| Actual adapter comparisons | 1,045 rows: 939 observed, 106 missing; 1,672 zero-field witnesses |
| Largest complete five-week MCP envelope | 135,228 bytes, under 1,000,000 |
| Local built-Worker HTTP/MCP | Pass: identity/origin refusal, no-store, independent kill switch, capability status, Noel W1–5; zero network calls |
| Local Worker initialization | 303 ms in this runtime; not a hosted startup acceptance |
| Whitespace and public-diff inspection | Pass |

Five distinctions were checked against the actual retained release locally:

1. **Observed:** Jaylin Noel, `00-0040138`, W1–5.
2. **Observed zero:** Noel W1 carries, retained `observed_zero_fields` witness.
   The player-week stays observed; a zero field does not replace its other fields.
3. **Missing-source evidence:** Case Keenum, `00-0028986`, W1; nulls/unverified
   nonparticipation remain unchanged.
4. **Outside catalogue:** Travis Hunter, `00-0040718`, absent from the selected
   population. His GSIS ID was checked in the retained source candidates; no
   name/identity resolver was added. No data is manufactured for him.
5. **Outside release scope:** W6; mixed requests preserve covered weeks.

Public test data is entirely synthetic. Actual returned private values are not
committed. Retained-output equality and comparison hashes below are the public
receipt. No original producer/reviewer tests are claimed as newly executed.

## Exact pins and measured private build

| Item | SHA-256 / result |
| --- | --- |
| Archive v2 (24,420,710 bytes) | `d2bb08b185c7ec73d80480ccc7cbc234ce02d89ac6d57308f6bcfa34ff69af13` |
| Retained output (8,766,751 bytes) | `7cdfdb96fa5bbb1f6703698b83fe0f142c7498f74043be7bad72d6f5f3e91c49` |
| Retained clean review | `3b39f6abb7710aa155e19b0217f56b08d00c13691cc1e67f5f7322d0789b79fd` |
| Prepared private input (9,366,038 bytes) | `d5d4cb469fc0bed4b5df1576a424c21b102844a7d9bd7b937e240e53666c1083` |
| Aggregate of 209 fixed-clock reader results | `83fc3029180035744819221f5875838213714c7534a2e12572b2d9e4d5170382` |
| Private Worker (9,776,562 bytes; gzip 585,295) | `581dbdc6f6fb003cdc3fe3434dc423ff62c290fcc90d481c8348b3bdab09ed1a` (historical, head `b30d9a61`) |
| Private Worker after revision (9,778,109 bytes; gzip 586,027) | `13ddba1fac66e3de8be7d3089d4e5b2ac7f562300f5d1d6005fbd5f1dff950a1` |

Archive and prepared input remained unchanged after comparison. Full private
source/bundle bytes stay in the owner's local environment, outside Git/CI.

## Replay

From repo root after locked dependency installation; these run only synthetic
tests/public builds and require no private source:

```sh
node --import tsx --test tests/roleHistory.test.ts tests/leagueReader.test.ts tests/leagueReaderProtocol.test.ts tests/personalLeagueContext.test.ts tests/leagueReaderHardening.test.ts
python3 -m unittest discover -s tests -p 'test_private_role_preparation.py'
node_modules/.bin/tsc -p tsconfig.league-check.json --noEmit
npm test -- --runTestsByPath server/modules/draftReview/__tests__/teamLeagues.test.ts server/modules/draftReview/__tests__/draftReviewService.test.ts server/modules/draftReview/__tests__/historicalCatalog.test.ts server/modules/draftReview/__tests__/unrosteredTes.test.ts server/modules/draftReview/__tests__/waiverCandidates.test.ts --coverage=false
npm run build
node scripts/buildLeagueReaderWorker.mjs /absolute/public-output/worker.mjs
git diff --check
```

Owner-controlled local environment only; never run these in public CI, retain
populated fixtures in Git, upload private bundles as CI artifacts, or log
returned data. Use fresh paths outside the repository. Replace the placeholder
paths below with the already-retained archive and private local destinations:

```sh
python3 scripts/preparePrivateRoleEvidence.py --owner-private --archive /private/retained-release.zip --output /private/new/prepared.json
node --import tsx scripts/checkPrivateRoleEvidence.mts --owner-private /private/new/prepared.json d5d4cb469fc0bed4b5df1576a424c21b102844a7d9bd7b937e240e53666c1083
node --import tsx scripts/buildLeagueReaderWorker.mjs /private/new/worker.mjs --owner-private --role-evidence /private/new/prepared.json --sha256 d5d4cb469fc0bed4b5df1576a424c21b102844a7d9bd7b937e240e53666c1083
node --import tsx scripts/checkPrivateRoleWorker.mts --owner-private /private/new/worker.mjs 13ddba1fac66e3de8be7d3089d4e5b2ac7f562300f5d1d6005fbd5f1dff950a1
```

## Post-replay revision, 2026-10-23

Authorized by the [post-replay revision grant](https://github.com/Prometheus-Frameworks/TIBER-Fantasy/pull/424#issuecomment-6353890275)
after Joe accepted the independent private-binding replay of `b30d9a61`. That
replay's receipt stays bound to `b30d9a61`; it is not a review of this revision.
The revision's author is the same Claude session that ran that replay, so this
section is primary-author evidence only.

- **Lazy reader.** `createRoleTools` does no artifact work at construction. Module
  load, discovery, league, unknown, invalid-input and disabled/wrong-marker calls
  never parse, copy or validate. The first valid enabled call copies, validates
  and indexes once and is reused; failure stays closed without retry. The
  independent disabled reader still refuses after initialization.
- **Truthful capability.** Before first use the enabled capability reports the
  build-validated release with `validation: deferred`; afterwards `passed`, or
  `unavailable`/`artifact_invalid` with `validation: failed`. A loaded release
  differing from the build binding fails closed.
- **Deferred parse.** The private build now emits the pinned input as immutable
  text plus its validated release; `JSON.parse` runs on first enabled use. The
  text itself still costs import time and heap (measured below, not zero).
- **Output path before creation.** The private build resolves the future output
  through its nearest existing ancestor, rejects lexical and symlink-resolved
  repository paths and dangling links, and checks the input pin and artifact
  before creating any directory; the post-creation realpath check remains.
- Prepared-input generator, retained bytes and pin unchanged.

Runtime: official Node `v20.20.2` linux-x64 (SHASUMS256-verified standalone,
command-scoped PATH), npm 10.8.2, Python 3.12.3, WSL2 Ubuntu, locked `npm ci`.
The unchanged `b30d9a61` private Worker was rebuilt under this runtime first and
reproduced `581dbdc6…ed1a` exactly.

| Check (Node 20.20.2) | Result |
| --- | --- |
| Native reader/protocol/process/hosted regressions | 45 pass: 42 previous + 3 new lazy-initialization cases |
| Existing Team/waiver/catalog tests | 85 pass in five suites |
| Synthetic Python preparation/build guards | 5 pass: 4 previous + rejected-path/no-directory case (fails against the old builder) |
| Scoped strict TypeScript / server build | Pass / pass; inherited duplicate `applyAdjusters` warning |
| Public/private Worker builds and isolation audit | Pass; 232 modules each; public `privateInput: false` |
| Short replay: private build + `checkPrivateRoleWorker.mts` with the new full hash | Pass: identity/origin refusal, no-store, kill switch, Noel W1–5, 0 network calls, 99,566 response bytes |
| Prepared input before/after | `d5d4cb46…1083` unchanged |

Local observations only — not hosted measurements. Same machine, runtime and
harness; seven fresh processes per scenario, `--expose-gc`; median [range].
Retained heap is `heapUsed` after forced GC minus the pre-import baseline.

| Built Worker | Import | Uncollected after import | Retained after GC | Peak RSS | First enabled ROP call | Retained after enabled call |
| --- | --- | --- | --- | --- | --- | --- |
| Before, `581dbdc6` | 461 ms [432–618] | 63.1 MB | 36.0 MB | 155 MB | 96 ms [86–104] | 38.5 MB |
| After, `13ddba1f` | 220 ms [186–283] | 26.2 MB | 22.8 MB | 97 MB | 248 ms [206–345] | 38.5 MB |
| Public, no private input | 74–77 ms | 9.0 MB | 4.9 MB | 51 MB | n/a | n/a |

Disabled-path heap after a disabled ROP call, discovery and an unknown name:
38.5 MB before, 25.4 MB after (public: 7.5 MB). The remaining disabled import
cost (~18 MB retained, ~145 ms over public) is the embedded private text. The
first enabled call now carries the deferred parse/validation; second calls stay
~5–6 ms.

## Risk, limitation and the one judgment

The 9.78 MB raw / 585 KB gzipped private bundle is feasible locally, but actual
Sites size/startup acceptance is **unverified**. This chooses immutable private
build injection to avoid a new storage service. Local 303 ms initialization is
not a hosted CPU/memory measurement. Broader access remains unsafe under the
inherited single-owner topology; no multi-user authorization is added.

**One judgment needed:** whether to advance this exact immutable-build candidate
to independent code/private-binding review, or revise the packaging approach
first. Recommendation: advance to review; evaluate actual host constraints
before any later publication authorization. Repeated private consumer eligibility
is already granted and is not being requested again.

The PR stays draft. No reviewer was dispatched; no ready/merge, #422 merge,
hosted publication or Site/environment/access update occurred. Full-repository
test/typecheck, a new installed plugin call and fresh-conversation acceptance
are not claimed. An unchanged hosted connector cannot yet return this new tool.
