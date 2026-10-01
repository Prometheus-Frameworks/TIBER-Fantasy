# #383 remote-beta implementation and activation packet — October 1, 2026

Design/preparation only. Reuse the reviewed offline adapter; no hosted code, credentials, account signup, consumer activation or spend in this task. Complements, rather than replaces, the adapter branch's `docs/mcp/weekly-evidence-personal-beta-proposal.md`.

## Exact dependency and scope

| Item | Exact head / condition |
| --- | --- |
| Fantasy main for this freshness task | `4204ddfc0fb0dd38da708e9aea3c4d01b77997ab` |
| #383 completed offline adapter | branch `codex/383-weekly-evidence-offline`, head `fa243d74ab8bf3fff5673571a49dbabf32183dbb`, tree `314def8e846639280e76d0051b1563ae0c358a84`; clean independent review with non-blocking notes |
| Inherited #411 Watson decoder | `67398ca651bb96d08798bc10f8134f5ec6c1ff6a`; unmerged dependency, not implicitly admitted to Team |
| Sole retained projection | Watson/GB, source GSIS `00-0038124`, 2026 REG W1→W2; 12,298 bytes, SHA-256 `06f7c33f9ca4ea7e3ce5b8a2b88891d3bb63e8a899294f66f8fff955fc658c2e` |

The adapter already provides native stdio describe/list/get tools, strict inputs, fixed path/catalog/hash/size bounds, busy/deadline handling and explicit unavailable lanes. Its reported checks are 13 native tests plus 16 inherited tests, targeted compilation and full build. Do not redo the offline implementation or substitute #406's older contracts. No HTTP/OAuth currently exists. `remote_consumer_enabled: false` is current behavior, not a toggle this task can enable.

This projection is a descriptive, source-native Watson/GB W1→W2 inspection sample, not full raw producer output, rankings, probabilities, a trade recommendation, routes, all players or current W3. Preserve decoder health, provenance, attribution, missing fields, cutoff/finality uncertainty and source-native identity. The source-native MCP beta does not require a Sleeper join; any later Team association is a separate #411 identity/consumer boundary. Adapter request/response clocks are execution clocks, not source update clocks.

## Implementation slices and dependency integration

1. Freeze the three exact heads and retained bytes in the remote branch's dependency manifest. Resolve #411 integration explicitly before release (reviewed merge or pinned vendored/extracted decoder with provenance and existing tests); do not blindly rebase onto a moving branch or merge on Joe's behalf. Reuse `catalog.ts`, `weeklyEvidenceService.ts`, `toolDefinitions.ts` and #411's decoder. Keep the stdio launcher and its environment sanitization unchanged.
2. Add a dedicated Node entry point using SDK Streamable HTTP at `/mcp`, separate from Fantasy's Express startup, DB and auth. Follow SDK 1.30.0's actual transport API, pinned dependency lock. Node 20.6+ minimum from the reviewed adapter; revalidate the selected supported Railway Node version and SDK support before release. Package only required adapter/decoder modules and exact immutable projection; use the approved repository build workflow, with no Docker/config changes bundled here.
3. Separate shared evidence construction from local/remote envelope policy. Do not simply flip the offline envelope's `remote_consumer_enabled` to true. A remote policy must require the exact qualified hash/purpose plus the release kill switch, and preserve the same evidence/provenance/missingness. Remote tool descriptions may change only to describe the approved purpose and auth boundary; tool names/input strictness and no-fallback behavior remain.
4. Add authentication middleware **before** tool discovery, listing or reads. Public routes are minimal health and OAuth discovery only. No public evidence route, debug output, request logging of tokens/model bytes, filesystem/path argument, write method or provider fallback. Proposed transport bounds: POST body 4 KiB, inherited tool input/result/file caps, one evidence read slot, inherited five-second read deadline; overall 10-second request deadline, bounded rate limiting and no infinite SSE subscription. Verify protocol initialization fits transport limit before freezing it.
5. Test exact authorization and containment, then obtain independent exact-head review. Fix confirmed in-scope P2s with review of resulting heads. Keep remote work assigned explicitly in #383; Claude-owned implementation and Dot's Research #25 continue unchanged.

## Private authentication proposal

Candidate: managed Auth0 OAuth, subject to account/plan/protocol compatibility proof. No homegrown passwords or issuing server. One scope `tiber:evidence:read`, one server-owned immutable issuer/subject pair for Joe, one exact HTTPS MCP resource/audience. A logged-in non-Joe user is forbidden. Every request checks signature/allowed algorithm/JWKS, exact issuer and audience, expiry/not-before, scope, principal allowlist and kill switch before touching evidence. No user_id/owner assertion accepted from tool input.

Provide protected-resource metadata and a 401 Bearer challenge identifying it; issuer discovery, authorization code with S256 PKCE, and exact `resource` binding through authorization/token exchange. Verify the provider supports the ChatGPT connection's actual CIMD/DCR or predefined-client registration, and that `resource` maps to the verified JWT audience. These are unresolved compatibility gates, not claimed Auth0 defaults. Copy exact client/callback details from Joe's ChatGPT connection management UI; do not guess a stable callback from examples. OAuth tokens cannot be replaced by an admin/provider API key.

Propose 10-minute access tokens, refresh rotation/revocation at the IdP; Joe allowlist removal or service kill switch invalidates future requests independently of disconnect. Test config propagation and in-flight behavior. Define JWKS rotation/outage behavior and redacted operational logs. No credentials entered or consumer connected in this task.

## Exact evidence-purpose qualification receipt

Before remote get/list activation, the operator must explicitly qualify: the exact SHA-256/bytes above; source-native Watson/GB 2026 REG W1→W2; private, read-only descriptive inspection by Joe through his authenticated ChatGPT connection; processing of returned evidence by ChatGPT; complete limitations/attribution; no onward public distribution, Team/Forecast enablement or broader subject scope. Confirm retained-source rights permit this processing purpose; prior offline inspection does not imply remote permission. Record the receipt, immutable release head/build, Joe's issuer/subject reference (not secrets), kill-switch owner and expiry/revocation terms in #383. No default expiry is invented. No new acquisition or admission occurs to obtain that receipt here.

## Hosting compatibility and cost packet

Recommend a **new dedicated Railway project/service** as first candidate, isolated from full Fantasy and its database/provider/admin secrets. Static read-only bytes, no volume/DB, TLS HTTPS and a stable `/mcp` address. This avoids migrating Team. Railway's container/Node hosting and HTTPS make it plausible; exact Node build inclusion, streaming/proxy timeout, connection behavior, process memory, cold start and OAuth metadata reachability remain deployment-preflight acceptance tests. Do not create the service to test these without authorization.

Railway's documented container rates (checked October 1): RAM $10/GB-month, CPU $20/vCPU-month, egress $0.05/GB, volumes $0.15/GB-month. Hobby $5/month minimum including $5 usage; Pro $20 including $20 usage. These are listed dollar prices, not a quote or Joe's verified billing plan/remaining credits. Illustration only: continuously allocated 0.125 GB RAM plus average 0.01 vCPU would be about $1.45 usage/month before egress/tax/other services; actual Node memory and CPU must be measured and may be materially greater. Marginal cost depends on shared plan usage. No free-running service or spend approval is inferred from existing Railway access. Set a reviewed budget, alert and shutdown policy separately before deployment; no number in this packet is an authorized ceiling.

Auth0 advertises a $0 Free plan up to 25,000 active users. OAuth registration/resource features needed here and Joe's account eligibility are not established; prove those before selection. Avoid custom-domain or paid-plan assumptions. A different managed provider requires equivalent compatibility/cost review.

Sites supports hosted websites/MCP, but this is an existing Node/Express/Postgres project plus an isolated Node adapter. A Sites move would require a separate runtime/dependency/auth/storage compatibility investigation and is outside this task. An iPhone Home Screen bookmark is useful access now; it is not native App Store distribution. ChatGPT connection visibility/testing on Joe's actual web/iOS account is a final acceptance gate, not promised universal account availability.

## Release acceptance and operator decision

Required before deployment: dependency integration recorded and tests reproduced; HTTP/auth implementation reviewed at exact head; no inherited Fantasy secrets/startup/DB; immutable hash/size checked; qualified purpose receipt; service plan/region/runtime/streaming/cost reviewed; auto-deploy disabled or explicitly authorized; exact build/rollback and budget/kill-switch owner named. Merge/deployment authority is a separate explicit operator decision.

Required before consumer activation: private OAuth registration verified; Joe-only discovery/list/get, no-auth 401 and non-Joe 403, wrong-audience/issuer/expired/revoked/malformed token rejection, PKCE and resource binding, input/body/result/time/concurrency limits, unknown ID/W3/Forecast unavailable, corrupt/missing artifact fail closed, byte/hash parity, complete provenance/nulls/health output, no acquisition/network fallback, safe errors/logs, kill-switch and rollback checks. Then Joe tests the actual ChatGPT web and iOS connection and understands the precise evidence purpose. Native offline tests remain passing. Activation authority is separate from deployment authority.

Decision now: **offline adapter complete; remote beta prepared, not implementation/release ready**. Next authorized work can be an isolated HTTP/auth code slice after ownership and IdP compatibility choices; no cloud setup is implied. Joe should receive an exact reviewed release packet before any deployment, spend or activation.

Primary sources checked October 1: [OpenAI MCP server](https://developers.openai.com/plugins/build/mcp-server), [OpenAI authentication](https://developers.openai.com/plugins/build/auth), [Railway pricing](https://docs.railway.com/pricing/plans), [Railway public networking](https://docs.railway.com/networking/public-networking), [Auth0 pricing](https://auth0.com/pricing), [Sites](https://learn.chatgpt.com/docs/sites?surface=app). Repository authority: [Fantasy #383](https://github.com/Prometheus-Frameworks/TIBER-Fantasy/issues/383) and [#411](https://github.com/Prometheus-Frameworks/TIBER-Fantasy/pull/411).
