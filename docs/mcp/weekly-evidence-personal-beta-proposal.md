# Personal ChatGPT beta — auth and hosting proposal

Prepared September 30, 2026 for Joe and #383. Design only: no account signup,
credentials, paid service, hosting configuration, deployment or activation
performed. No price or account-availability claim. The offline implementation
does not already implement OAuth or HTTP transport.

## Recommended delivery boundary

Deploy a dedicated Node MCP service with Streamable HTTP at a stable HTTPS
`/mcp` URL, isolated from the existing full Fantasy application. Prefer a new,
dedicated Railway project/service as a hosting candidate because TIBER already
operates there; recheck runtime/streaming support, cost and deployment effects
before selecting it. Do not reuse the current production shell, admin API,
database variables, provider keys, or shared application startup. The first
image/build contains only the three-tool adapter, SDK dependencies and the
exact approved projection. Static immutable bytes, no data-store attachment
and no provider acquisition are required. No Docker or host changes are made
in this task; packaging will follow the repository's approved release workflow.

OAuth metadata endpoints and a minimal health response may be publicly
reachable, but tool discovery/catalog/evidence calls require Joe's authenticated
principal. Deployment of bytes or merging code is not evidence-use admission.
Carry a separate receipt accepting this exact hash/purpose/private ChatGPT
processing boundary before enabling retrieval.

## Authentication and authorization

Use an established managed OAuth 2.1 identity provider, rather than writing
token issuance, password storage or a fake login in TIBER. Auth0 is a concrete
candidate linked by OpenAI's current guidance; no existing account or eligible
plan is established here. Select/configure it only in the later authorized
auth slice. This does not require activating Fantasy's Google/database auth.

One scope: `tiber:evidence:read`. One server-derived subject: Joe's immutable
issuer/subject pair, allowlisted in server-owned configuration. No tool accepts
user_id, workspace_id, identity assertions or access flags. A successful login
does not authorize every principal. Every request checks signature, allowed
issuer, exact MCP resource/audience, expiry and scope, then principal allowlist
before catalog or file lookup. Reject tokens minted for a different service.
All three hosted tool definitions declare their OAuth security scheme.

Required integration details:

- HTTPS protected-resource metadata, including the canonical MCP resource,
  issuer and read scope; unauthenticated requests return an appropriate Bearer
  challenge referring to that metadata.
- Authorization-server discovery and authorization-code flow with S256 PKCE.
  Bind the `resource` parameter through authorization and token exchange so
  the access token has the exact expected audience.
- Prefer supported Client ID Metadata Documents (CIMD), or DCR/predefined
  clients when supported by the selected provider. Copy the exact client and
  callback URLs from this connection's ChatGPT management page. Do not assume
  a callback URL from documentation is Joe's final registration.
- Short access tokens (proposed 10 minutes), refresh rotation/revocation at the
  provider, and a server-side kill switch/allowlist removal checked on each
  call. Disconnect alone must not be assumed to invalidate issued tokens.
  Remove Joe's allowlist entry to revoke access immediately; disabling the
  service is the emergency stop. Document how changes propagate before release.
- Never pass `ADMIN_API_KEY` or a general provider key to the client. OpenAI's
  docs say ChatGPT cannot present custom API keys for this integration. Client
  mTLS, if enabled at a supported edge, identifies ChatGPT, not Joe; it does
  not replace user OAuth or authorization.

These are proposed controls, not tested hosted behavior. Authentication
failure must reveal neither catalog contents nor whether an evidence ID exists.

## Hosting controls and acceptance

Start with fail-closed remote retrieval disabled. Require a separately reviewed
source/use binding and an explicit operator activation decision. Pin the
application revision and model digest together; no `latest` pointer, fallback
source, cohort expansion or scheduled refresh. Missing/tampered bytes disable
retrieval while health reports a sanitized unavailable state.

HTTP needs additional framing/origin/session controls beyond the stdio pilot:
reject oversized bodies before JSON parsing, validate origin/host per the MCP
transport guidance, bounded concurrency and rates per authenticated principal,
request deadlines, private/no-store responses, and no evidence/token bodies in
logs. Budget proposal: 10 calls/minute with a burst of 3 for Joe, five-second
local read deadline, 64 KiB complete tool result, and a small explicit HTTP
framing ceiling accommodating initialize/tool requests. Measure actual client
traffic and review limits rather than silently widening them. Store only
sanitized operation/status/latency, bounded diagnostic retention and no raw
player packets. No arbitrary egress except authorization metadata/key handling
and hosting necessities; constrain issuer URLs in server config.

Before activation, independently review the exact HTTP/auth implementation and
test unauthenticated, wrong issuer/audience/scope/principal, expired/revoked
credentials, origin failures, body limits, hash tamper and unavailable IDs.
Confirm every private Fantasy operation is unreachable from this service.

Then Joe creates a personal developer-mode plugin connection on a supported
ChatGPT surface, completes OAuth, and opens a fresh Work conversation. Test
discovery, Watson W1→W2 retrieval, W3/Forecast unavailability and disconnect/
revocation. Test iOS independently; successful web setup does not establish
iOS support. No public plugin listing, Events subscriptions or custom UI is
needed for this first beta.

Rollback: disable the new service/allowlist, revoke refresh credentials, and
retain the prior exact build and receipt. Never roll back to the full Fantasy
runtime or an unauthenticated endpoint. This proposal commits no spend.

## Current official references

Fetched September 30, 2026:
- [OpenAI authentication guidance](https://developers.openai.com/plugins/build/auth)
- [OpenAI MCP server/transport guidance](https://developers.openai.com/plugins/build/mcp-server)

These support OAuth/PKCE/resource binding, client metadata and transport
requirements. They do not prove Joe's account/client availability, Railway
configuration, a specific provider plan, source admission or beta readiness.
