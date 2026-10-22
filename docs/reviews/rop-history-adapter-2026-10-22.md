# Frozen ROP history adapter — implementation and decision packet

Status: implementation candidate for a **draft PR stacked on #422**. Primary
author checks only; independent review has not been dispatched. No merge or
hosted publication is authorized by this packet.

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
| Private Worker (9,776,562 bytes; gzip 585,295) | `581dbdc6f6fb003cdc3fe3434dc423ff62c290fcc90d481c8348b3bdab09ed1a` |

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
node --import tsx scripts/checkPrivateRoleWorker.mts --owner-private /private/new/worker.mjs 581dbdc6f6fb003cdc3fe3434dc423ff62c290fcc90d481c8348b3bdab09ed1a
```

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
