# #383 league reader: local implementation and release proposal

## Trigger and scope
Joe authorized the proposed bounded implementation on October 11, 2026, after
asking how an agent could access H4MMER's leagues. This receipt records authority
for preparation, adapter implementation, synthetic validation and independent
review; it is not a standing release, deployment, credential or merge grant.

Base: reviewed #375 head `2c4878b9c4dc6614dcbc0d3c07876c41407bf48b`, with main
`0d2d803bbe5f4eaa75f145bd7b771f3f4a86bb4d` retained in its ancestry. #375 remains
unmerged. This slice does not edit that branch or carry Google/database activation.

The exact #387 `teamManager.ts` and `shared/teamManager.ts` were initially extracted unchanged
from `354cfe2b7264ff49167daa3cd50229aba1e273d7`, plus its two read-only transport
methods. This is explicit dependency integration into this candidate, not an
assertion that #387 merged or its review transfers. No Manager UI/routes copied.
Independent review identified fail-fast parallel-read lifetime leakage; the new shared settleSourceReads helper now drains sibling reads in the extracted Manager service and existing membership service before releasing the MCP slot. Their facts/contracts are otherwise unchanged.

Existing #406 source-disabled adapter and reviewed #383 offline Watson adapter
remain untouched on their existing branches. No competing owner was recorded in
inspected #383 comments; PRs #375/#387 are read dependencies, not transferred tasks.

## Contract
| Tool | Required selectors | Result |
|---|---|---|
| tiber_league_capabilities | none | source mode, tools, limitations |
| tiber_list_leagues | account, season | public account ID and bounded leagues |
| tiber_list_league_rosters | userId, leagueId, season | exact owner/co-owner roster IDs |
| tiber_get_roster_context | userId, leagueId, season, rosterId | one roster/settings context |
| tiber_get_weekly_matchups | userId, leagueId, season, week | account memberships and provisional scores |

All IDs remain source-native strings; rosterId is a scoped integer, and week is
an explicit string `1`–`18`. Never select an ambiguous membership on the user's
behalf. Extra properties/URL overrides are rejected. Tools advertise readOnlyHint.
Structured content and JSON text match. Source/default startup is disabled and
there is no fixture fallback in the executable. Selected roster output excludes
other owners and other teams' player lists. Known zero scores/scoring and missing
values remain distinct. No season record, remaining-player count, probability,
classification, historical evidence or producer output is fabricated.

Source semantics and runtime limits are in `server/modules/leagueMcp/MODULE.md`.
The inherited cached directory reader imports the historical decoder module;
this slice does not invoke historicalEvidenceFor or export that history. The
bundle import audit must be interpreted as isolation from DB/private startup,
not a claim that no historical module appears in the graph.

## Local setup and validation
Use existing locked dependencies; no package or lockfile change. Node 20.6+,
installed tsx and MCP SDK. In a compatible stdio client, configure Node with the
absolute `scripts/runLeagueReader.mjs` and `--source-disabled`. This starts only
the dedicated process. Actual live provider smoke, named external host, ChatGPT
installation and iPhone acceptance are not claimed.

Checks:
- `node --import tsx --test tests/leagueReader.test.ts tests/leagueReaderProtocol.test.ts`
- `node node_modules/typescript/bin/tsc -p tsconfig.league-check.json`
- `npm run test -- --runTestsByPath server/modules/draftReview/__tests__/teamLeagues.test.ts server/modules/draftReview/__tests__/draftReviewService.test.ts --coverage=false`
- isolated esbuild entry/metafile audit and `git diff --check`

Independent review and final counts are recorded separately after execution;
this document does not self-certify its implementation.

## Connection/release proposal
First candidate: dedicated continuously hosted Node Streamable HTTP service,
with OAuth 2.1 through a managed identity provider and a Joe-only principal policy.
Reuse this adapter, after source rights/use and upstream resource containment are
qualified. Preserve source-native identity and the original evidence separation.
No Fantasy full-runtime startup, DB, provider/admin keys or committed API keys.

Current official OpenAI docs also permit Secure MCP Tunnel to private stdio/HTTP
servers. This is a viable alternative to the older public-endpoint-only plan;
it needs an always-running host/client, runtime credential, organization/workspace
association and actual account permissions. Availability and cost are unverified.
Do not create a tunnel or account as part of this local implementation.

Before release: reconcile #375 and #387 integration; bounded streamed upstream
bytes and source rights/agent-processing scope; HTTP/OAuth discovery, token issuer,
audience/scope/principal enforcement, request/rate/concurrency limits, revocation
and kill switch; independent exact-head review; hosting cost/budget/rollback;
then an explicit deployment and connection activation decision. No broad schema,
Google sign-in or model key is required for the local public observation reader.

Acceptance target: a fresh supported ChatGPT Work conversation lists one account's
season leagues, selects exact membership and retrieves one roster/week without
manual packet copying. Use synthetic identities first, followed by a separately
scoped real-account read test. Verify web setup and Joe's iPhone, not universal
client support. A plugin can pair these tools with skills; UI is optional.

Official sources checked October 11:
- https://developers.openai.com/plugins/quickstart
- https://developers.openai.com/api/docs/guides/custom-mcp-server
- https://developers.openai.com/plugins/build/auth
- https://developers.openai.com/api/docs/guides/secure-mcp-tunnels

Repository sources: Fantasy #383/#406/#375/#387 and their exact inspected heads.
The local implementation finishes at a reviewed candidate. No deployment, public
plugin, auth change, saved state, upstream producer execution or merge is performed.

## Implementer validation and publication boundary
Final repair checks: 12 native tests (service, real MCP and source-disabled process),
26 existing Team tests, strict scoped TypeScript, server build, isolated import
audit and whitespace check pass. The server build retains the inherited duplicate
applyAdjusters warning. Full repository typecheck was not rerun. No live provider
read was performed through this adapter.

The independent reviewer found two P2s on initial commit 4faf4d23: inconsistent
selected roster collections and early concurrency release after source failure.
Both were repaired with synthetic reproductions/regressions; final repair review
is recorded separately and not inferred from the initial review.

GitHub branch publication was blocked by automatic approval review because the
operator grant covered local implementation/review rather than external
publication. No alternate publication path was attempted. The candidate remains
local until Joe explicitly authorizes its exact reviewed branch publication.
Draft PR/preview effects remain a separate publication preflight; hosting, auth,
deployment and activation are not included.
