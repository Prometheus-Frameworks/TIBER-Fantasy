# Personal league MCP: independent inspection and hardening

Joe authorized this bounded inspection, repairs, regression coverage and an
independent exact-head review before merge consideration. PR #422 remains the
integration vehicle. Merge and broader activation remain the operator's choice.

## Source and live-path evidence

- Inspected starting head: `4ddcf688afd993740bcb01404c893c844ea06925`,
  base `c4adf6effdeff0c6a68f92aece759b03fe575b29`. PR was open, draft,
  unmerged, with no existing independent review or review threads.
- Independently called the installed plugin's `tiber_get_my_leagues({})` and
  `tiber_get_lineup_context({candidates:["Kyle Pitts"]})`. Both succeeded at
  approximately 2026-10-15 16:13:57 UTC with current-season/week observations,
  exact configured-account membership, default-league selection, scoring,
  roster/lineup, byes and candidate membership. Personal output is not committed.
- Sites reports version 2 successfully deployed, environment revision 1,
  MCP enabled, and a custom policy containing only the owner: no other users,
  groups, external visitors or editors. The existing plugin is provisioned.
- Version 2's separate Site source commit is
  `163ef6bc64635104acb761d3191fb7decb138a51`. Opened that exact source,
  rebuilt the Fantasy starting head with locked dependencies and compared bytes.
  Both Worker files have SHA-256
  `5336e78e64732e87d8285f47b3cddfece35791f093c8f2d69bd2d800ea2262ee`.
  This binds the successful plugin implementation to inspected code; the
  documentation's provenance assertion was not accepted on its own.
- Worker logs independently show corresponding POST /mcp invocations, trusted
  identity header presence (values redacted), HTTP 200 data responses and the
  same Worker script version. Request bodies are not logged, so the native
  tool results establish which calls succeeded; logs corroborate transport.

## Confirmed defects and bounded repairs

1. **P2: stalled inbound body could hold a request indefinitely.** The 30-second
   tool deadline starts after body parsing; the old bounded reader had a byte
   limit but no body deadline. Reproduced a pending read against the original
   Git object. It also awaited cancellation hooks, which need not settle.
   Added a ten-second decoded-body deadline and nonblocking best-effort
   cancellation. The Worker returns HTTP 408/no-store for this failure.
   Existing ten-second outbound fetch timeouts still cover provider requests.
2. **P2: impossible calendar dates could qualify a complete schedule.** The old
   validator accepted `2026-99-99` and `2026-02-30` in otherwise complete
   synthetic schedules and emitted byes. Reproduced against the original Git
   object. Validate finite UTC parsing and an exact date round trip before
   accepting coverage. No evidence of corrupt live schedule data is claimed.
3. **P2: source error/redirect cancellation could pin the busy slot.** The
   independent reviewer of the first repaired candidate reproduced non-OK
   Sleeper and schedule responses whose cancellation never settled even after
   their abort timers fired. Those branches bypassed the repaired decoded-body
   helper. Made both cancellation paths best-effort/nonblocking, and added a
   regression proving repeated failures release the MCP and schedule slots.

No authentication bypass was established in the current single-owner topology.
The repairs do not change tool schemas, profile values, access policy,
provider origins, roster capabilities or the accepted MCP protocol path.

## Boundary checks

| Boundary | Evidence and result |
| --- | --- |
| Authentication | Worker rejects absent/blank visitor ID, service-token-only and email-only calls with 403/no-store before provider reads. Sites admission is verified separately from application identity presence. |
| Profile isolation | Personal schemas reject account/user/profile/URL overrides. Sequential profile configuration changes in one isolate select the correct account without reusing the previous profile. This is a single configured profile behind a single-owner policy, not application-level multi-user isolation. |
| League/roster scope | Exact league/season, complete unique roster set, selected owner/co-owner membership and starter/reserve/taxi consistency are validated. Foreign roster and mismatched league/season/coverage fail before directory reads. Ambiguous selection remains unavailable. |
| Source failures | Disabled or malformed source configuration makes no provider reads. Provider error bodies remain withheld. Directory/schedule outages preserve known roster membership with unknown dependent facts. Failed sibling reads retain the busy slot until settlement. |
| Request limits | 16 KiB streamed inbound limit; ten-second decoded-body deadline; 2 KiB tool inputs; 1 MB complete envelope including duplicate text/structured payloads. Exactly 30 authenticated calls per isolate/minute, then 429; next window recovers. One source read at a time with a 30-second response deadline; timed-out work retains its slot until settlement. |
| Redirects and outbound bounds | Fixed Sleeper/nflverse origins, manual mode, all tested 301/302/303/307/308 rejected without follow-up. Declared/chunked decoded byte limits, UTF-8 byte counts and invalid encoding tested. Sleeper directory 24 MiB, other Sleeper 2 MiB, schedule 4 MiB. |
| Protocol and source fallback | Installed SDK discovery fallback, MCP 2025-11-25 initialize/list/call, strict read-only tool discovery and actual source-disabled stdio process pass. Modern 2026-07-28 discovery is unsupported; no new protocol support is claimed. |

## Validation

On the repaired candidate:

- 34 native tests pass, including 13 focused hardening regressions.
- 85 existing Team/directory/league/waiver/catalog tests pass in five suites.
- Scoped strict TypeScript passes. Server build passes with the inherited
  duplicate `applyAdjusters` warning. Worker bundle passes the import-isolation
  audit (230 modules). `git diff --check` passes.
- Full repository test/typecheck and physical iPhone acceptance were not run.
  These results do not transfer an earlier full-repository or device receipt.

Replay from the repository root with locked dependencies installed:

```sh
node --import tsx --test tests/leagueReader.test.ts tests/leagueReaderProtocol.test.ts tests/personalLeagueContext.test.ts tests/leagueReaderHardening.test.ts
npx tsc -p tsconfig.league-check.json --noEmit
npm test -- --runTestsByPath server/modules/draftReview/__tests__/teamLeagues.test.ts server/modules/draftReview/__tests__/draftReviewService.test.ts server/modules/draftReview/__tests__/historicalCatalog.test.ts server/modules/draftReview/__tests__/unrosteredTes.test.ts server/modules/draftReview/__tests__/waiverCandidates.test.ts --coverage=false
npm run build
node scripts/buildLeagueReaderWorker.mjs /absolute/output/index.js
```

## Review and release limits

The independent exact-head reviewer receipt belongs on PR #422 after the final
repair commit. This document records primary inspection and reproducible
validation; it does not itself certify a second review or repaired deployment.
Read the PR's final SHA-bound review and private deployment receipt together.

- Owner-private Sites admission and trusted header injection are essential.
  Any admitted trusted visitor would use the configured personal profile. Do
  not widen access without explicit per-principal profile authorization.
- Anonymous and fabricated-identity requests from this shell were denied by
  the Cloudflare edge (403/1010), before a Worker-level identity test could be
  established. That is not proof of header stripping or a second-user OAuth
  test. Local negative tests and the platform identity contract cover different
  parts of the boundary; the latter was not independently penetration-tested.
- Rate limits are per isolate, not a distributed quota. Clocks remain retrieval
  clocks, directory/schedule caching stays explicit, and unrostered remains
  distinct from claim eligibility.
- No merge, roster transaction, broader sharing, Railway/database deployment,
  model activation or additional service is part of this work.
