# Trade Compare private candidate — redirect-only repair

October 12, 2026 · Fantasy #416 / PR #421. Joe explicitly authorized the redirect-only fix and a private candidate deployment; no merge or public publication.

## Cause and change

Cloudflare Workers rejects `redirect: "error"` while initializing fetch. Replaying the saved v1 compiled handler with its compatibility date/flags reproduced the TypeError with **zero outbound source requests**. Live v1 reported retrieval start/failure in the same millisecond.

Changed only the outbound fetch redirect mode to `manual` in `lib/railway-read.ts`. All other production checks and options are unchanged. Redirects are still withheld: the existing `!response.ok` check rejects every 3xx response before reading/parsing it; no redirect is followed. Eight-second timeout, 192 KiB streamed limit, exact IDs, admission/identity/window/coverage/schema checks, null honesty and no-credential forwarding stay intact.

Updated the existing transport assertion and added a redirect-rejection regression. 34/34 focused tests and strict standalone TypeScript pass; the Sites Workers build passes. Fresh compiled-Worker replay passes the real retained 49,839-byte public source response with one outbound call. A 302 replay produces unavailable with one call and no redirected request.

## Private deployment and hosted proof

- Saved Site version **2**: `appgprj_6acd5dfd92108191a256cab7c8a1db66~appgver_8c3afcb1f65c8191ac188dcfe35a9cd8`.
- Site source: `d55f7d7c66bef6465d4249177b3f09c48e562287`.
- Archive SHA-256: `c80e9fedbe333879115a0b6e38c34541cc6ec999ffad8779ac635698b5c679c5`.
- Private deployment succeeded: `appgdep_6acd7cf62a0081918fb3300fb1dfde28`, October 12 **8:36:15 PM Toronto**.
- Audience read-back: custom, owner only, zero groups. No access-policy, Site secret/env, Railway endpoint, database, team-auth, frozen FORGE or league change.
- Hosted request: `GET https://tiber-trade-compare-416.jmas-tiber.chatgpt.site/api/compare?ids=8112%2C9487`.
- The actual hosted Site returned **HTTP 200**, **50,157 bytes**, `status: available`, `reason: null`.
- Its transport receipt identifies the fixed production source: `https://tiber-fantasy-production.up.railway.app/api/draft-review/evidence`.
- Retrieval clock: `2026-10-13T00:37:08.602Z` → `2026-10-13T00:37:08.853Z` (251 ms; **8:37:08 PM Toronto**).

| Player | Exact identity | Identity confidence | Recorded 2025 weeks | Mean targets / recorded week |
| --- | --- | --- | --- | --- |
| Drake London | Sleeper 8112 / GSIS 00-0037238 | medium | 12 | 9.333333333333334 |
| Parker Washington | Sleeper 9487 / GSIS 00-0038606 | medium | 16 | 5.9375 |

The hosted handler returns available only after its unchanged streamed response, schema and selection checks pass. This verifies actual Sites-to-Railway HTTPS for the selected pair, not just a Railway preview or local replay. Recorded weeks are not certified games played; these means do not claim current role or future production. ROP/TTS/xFP/forecast/schedule/roster sections remain unavailable.

## Screenshot acceptance limit

Sites produced a first-party screenshot for version 2, but its fixed viewport stops above the evidence table; it does not show the loaded metrics. An attempt to capture the table with Firecrawl was rejected by automatic approval review because it would disclose private Site contents to an external service without explicit disclosure authorization. No token or private page was sent to Firecrawl and no workaround was used.

Hosted API/data verification is complete. The requested screenshot of real values remains blocked pending an approved capture path. The earlier operator phone-render/selection observation remains separate from candidate phone/table acceptance. Ops #88 D3 stays open; PR #421 stays unmerged. The previous clean review covers the prior head, not this repair.
