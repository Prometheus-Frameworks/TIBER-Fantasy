# MCP hosted qualification — October 28, 2026

## Current state and provenance

Fantasy `main` was checked at `912904d324626f8caf91a9b259c59dd16068c19a`
(tree `78f543b11af3cc33b453dc8191ac6bbbfe8934b0`), the merge of
[#422](https://github.com/Prometheus-Frameworks/TIBER-Fantasy/pull/422). The
PR records a clean Codex review of `6a9364e8463192a3047d3020fc6e7139f97910fe`,
whose tree equals the merge tree, and the post-merge
[Core Build](https://github.com/Prometheus-Frameworks/TIBER-Fantasy/actions/runs/40600121600)
passed. That is source evidence, not hosted acceptance of the new readers.

The existing Site is deployed at version 4 from Site-source commit
`56a3d6dd33002fed944ce567a1fc2292fc161a83`. Its owner-private policy has one
owner and no additional users, editors, groups or external visitors; runtime
environment and policy are both at revision 1. No access or configuration
change is proposed here. The Site source Worker SHA-256 is
`bb3175aaa734da21c50c9489256618f69e74ee1249840d23db85448b359bd847`.
This work independently reproduced those bytes from Fantasy `fdffe2ae` plus
the Site's retained #430 scoring patch with manifest/lock-matched dependencies.
The Site's saved version and [#430 acceptance receipt](https://github.com/Prometheus-Frameworks/TIBER-Fantasy/issues/430#issuecomment-6455996061)
establish provenance; a local rebuild does not directly inspect host memory.

On October 28 actual installed-connector calls succeeded for all seven listed
operations. Personal reads succeeded for FFA, GHFFL and MortsFF with 132, 148
and 128 finite scoring settings respectively, including zeroes. The configured
default lineup succeeded, and an invalid/nonmember roster selection was refused.
An observed current-week matchup remains pending and finality is not verified.
The lineup results reported verified nflverse schedule coverage for byes.
Public Sleeper membership is not proof of account control.

The installed capability report still lists seven tools and withholds ROP. It
has no ROS schedule-strength tool. TTS, Forecast, private account state,
transactions and the other capability-report exclusions remain withheld. This
observation concerns this installed connector, not all other possible surfaces.

## Smallest candidate

An isolated **default**, no-private-input Worker built from the merge commit
adds `tiber_get_ros_schedule_strength` to the seven existing tools. The same
build keeps `tiber_get_rop_role_history` absent even if the ROP runtime marker
is supplied. It needs no new source, access-policy or runtime-environment
setting for the existing configured public Sleeper source. It is a schedule-only
candidate, not a ROP publication candidate.

Locked install, Node 24.22.1: 236 isolated modules; 425,124 bytes, 120,655
gzip bytes; Worker SHA-256
`6bb0502b48a8d19152b09c00dcc33cf22dab4dd70186af548a0ad9382af8785d`.
A local Site candidate based on v4 preserves the manifest and build scripts;
its packaged `dist/server/index.js` matches the Worker hash. It remains local,
unpublished and unreviewed as a Site source change. The Site source and Fantasy
source commits belong to separate repositories. Version 4 is the rollback
target. Rebuild and verify hashes and remote source state immediately before any
authorized publication.

## Synthetic validation completed here

On the merged source, `npm ci` completed with the locked package files; Node
24.22.1 and Python 3.12 were used. The following are local synthetic results:

- Eight existing native MCP suites: 74 tests passed, including ROP's five
  coverage states and schedule/league interaction regressions.
- Five existing Team compatibility suites: 85 tests passed.
- Private preparation/build path guards: nine tests passed with synthetic
  fixtures. Scoped strict TypeScript passed.
- Default Worker build and isolation audit passed with `privateInput: false`.
  The new built-artifact test verifies the generated default bundle end to end
  with fake providers, including identity/origin refusals, strict fixed origins,
  next-three and explicit-final windows, an in-window bye, missing-final
  witness, null ratings, unknown locks, disabled league source and absent ROP
  even with a marker. This does not certify platform admission or live data.
- The local Site build produced a valid ESM Worker and identical source/dist
  hashes. The original v4 build was independently reproduced as above.

Run the new check with `node --test tests/leagueReaderBuiltArtifact.test.mjs`.
Existing broader replay commands are in
[`mcp-combined-integration-2026-10-26.md`](mcp-combined-integration-2026-10-26.md).
No retained private input, producer, live ROP/ROS reader, host resource test,
Site version save, access/environment change or deployment was used here.

## Conditions before hosted acceptance

1. Independently review the exact candidate build/provenance and this test;
   recheck the Site source, current main, existing owner-only policy, environment
   revision and v4 rollback target. Preserve Sites OAuth and trusted
   `oai-authenticated-user-id` admission; a service token alone is not a user.
2. Obtain the operator's explicit deployment authorization. Only then push the
   exact Site source, build/package that source, save and privately deploy it.
   Record source/Worker/archive hashes, Site version and deployment status.
3. After publication, use the installed owner-authorized connector to verify
   eight-tool discovery, the real schedule-only ROS tool, next-three and explicit
   ROS/playoff windows, verified bye and league context, absent final-week
   witnesses, schedule source/hash/clocks, null defense ratings and unknown
   locks. Recheck existing personal leagues/scoring and denied selectors. ROP
   must remain absent. Record actual results, source coverage and limitations;
   rollback to v4 on failed acceptance. Hosted startup/resource observations and
   an independent fresh-session replay are separate from the synthetic tests.
4. ROP needs its own controlled candidate: the previously accepted release is
   `TIBER-ROP-2026-W01-W05-Private-Release` v2, permitted for repeated
   owner-private descriptive reads through the role-evidence path only. Hosting
   and deployment are separate decisions. No other private input, sharing or
   promotion follows from that permission. Authenticate the exact archive,
   manifest and prepared-input pin in an authorized owner-controlled
   environment; build and replay from the final combined source, keeping private
   input and private Worker out of Git, public CI, logs and fixtures.
5. The current Site source tracks its generated Worker, whereas the private ROP
   build must stay out of Git. A source-bound private packaging and hosted-storage
   path that satisfies both restrictions is not established by this receipt.
   Resolve and independently review that path before requesting its deployment
   authorization; do not silently commit the private bundle or add a provider.
   A marker alone cannot create the private input. With an authorized private
   build, verify the independent ROP marker's disabled/enabled behavior and
   exact GSIS-only five-state semantics against the authenticated release;
   measure actual hosted startup, memory and size, and obtain a fresh-session
   installed read. Do not report historical local private-build hashes as proof
   of the final combined build.

Sites admission remains essential to the single-profile boundary; there is no
visitor-to-profile authorization map. Previous receipts do not independently
establish cross-account OAuth or platform header stripping, and per-isolate
limits are not global. Keep these limitations explicit. No Claude admission
implementation or decision is part of this qualification.
