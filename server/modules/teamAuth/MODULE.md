# Team Auth v0 server foundation

Tracking issue: [#374](https://github.com/Prometheus-Frameworks/TIBER-Fantasy/issues/374).
This includes the server foundation and Account UI for Google sign-in, TIBER sessions and explicitly confirmed Sleeper links, plus league navigation. Real login is not activated. Public Team and request-time public league discovery remain available independently.

## Reviewed scope

The [audit packet](https://github.com/Prometheus-Frameworks/TIBER-Fantasy/issues/374#issuecomment-5645459874) was prepared against main `e4931017d56e468dd153bc13d327ae3c25d7c691`. Its SHA-256 is `2fdd8f741abddbc52d9a8a0652118ec424fbf3c4dd80e9d54d5c12cbc1055bda`. Joe subsequently authorized independent review and building the draft PR. The [review/scope receipt](https://github.com/Prometheus-Frameworks/TIBER-Fantasy/issues/374#issuecomment-5646217347) accepts four bounded repairs:

1. Define the four tables in `shared/teamAuth.ts`, outside the legacy Drizzle input. This narrows the original 17-path packet to 16 paths; `shared/schema.ts` stays unchanged.
2. Install private no-store/error containment before parsing and session loads; sanitize pool/store/prune errors and log only fixed route labels.
3. Await session regeneration and saves before success; persist server activity and cap idle/absolute expiry without automatic response-end renewal.
4. Wrap Google's actual verifier with strict claim/time/nonce checks and abortable certificate transport; test it with synthetic signed tokens and injected certificates.

## Runtime boundary

`TIBER_RUNTIME_PROFILE=team-auth` explicitly selects this foundation. The default remains `full`. Auth routes are not mounted by `full` or `public-draft-review`.

`server/index.ts` mounts the public runtime-profile/compiler routes first, then synchronously installs the private API gate. Pending, failed or missing auth configuration produces `503 AUTH_UNAVAILABLE`; unknown API methods/paths produce generic 404. Only the narrow auth router is dynamically loaded. The full router, v1 router, legacy database, migrator, schedulers, cron and model/LLM initialization are excluded from this startup branch in both development and built startup. Health only proves the process is responding.

Public `/team`, `/draft-review` and their compiler/evidence APIs do not run session middleware, query the auth store or set an auth cookie. Public responses and handoffs contain no private account/link context. The client recognizes `team-auth` and enables Account within the same restricted Team shell. Unknown profiles still fall back to the public-only shell.

## Files and ownership

| File | Responsibility |
| --- | --- |
| `shared/teamAuth.ts` | Isolated Drizzle table declarations, strict request schemas, policy and types |
| `config.ts` | Required private config; no legacy fallback |
| `googleIdentity.ts` | Google verifier, nonce hash, fixed issuer canonicalization, bounded cert request |
| `session.ts` | Dedicated pool/store, cookie policy, explicit save/destroy, readiness shape probes |
| `teamAuthService.ts` | Parameterized transaction repository and public identity resolution |
| `server/routes/teamAuthRoutes.ts` | Route allowlist, origin/CSRF/body/rate gates, private response mapping |
| `server/runtimeProfile.ts`, `server/index.ts` | Synchronous containment and isolated startup |

The original foundation packet also included this MODULE, three auth test files, the public-profile test and agent/product logs. The follow-on scope below adds Account and league navigation code and tests under Joe’s takeover request. Dependencies, package scripts, migration/config files, legacy schemas and promoted artifacts remain unchanged.

## API contract

All private routes send `Cache-Control: private, no-store`. Query parameters are rejected. Mutation bodies must be strict JSON objects at most 16 KB, with exact configured `Origin` and `X-CSRF-Token` from the current bootstrap/login session. A foreign Origin or `Sec-Fetch-Site: cross-site` is rejected on reads too. Caller user/owner IDs are never accepted. Errors carry fixed codes and suppress automatic session saves. Identity loss or unavailability clears the response cookie; rejected origin/CSRF, input, conflict and rate errors preserve login without renewing activity. The client must rebootstrap/recheck on identity loss instead of displaying stale private state.

| Method/path | Input and behavior |
| --- | --- |
| `GET /api/auth/bootstrap` | Signed out: regenerate pre-auth session; return CSRF, public Google client ID, challenge ID, nonce and expiry. Signed in: validate the user/session version, return status and CSRF. |
| `POST /api/auth/google` | `{challengeId, credential}`; validate Google token against the session-bound challenge, atomically consume it and upsert stable identity, regenerate session/CSRF, save before success. Already signed in returns conflict. |
| `GET /api/auth/session` | Validate status, stored version and server lifetime; return minimal TIBER ID or signed-out 401. |
| `POST /api/auth/logout` | `{}`; increment user session version, invalidate user challenges, destroy current session/cookie. Response explicitly says `scope: all_tiber_sessions`. |
| `GET /api/team-private/sleeper-link` | Return only session owner's link, current link version and `sleeperAccountControlVerified: false`. |
| `POST /api/team-private/sleeper-link/resolve` | `{usernameOrUserId}`; authenticate before source work, resolve either input through Sleeper, validate response, save a five-minute preview challenge with observed source/time and expected version. No active link yet. |
| `POST /api/team-private/sleeper-link` | `{challengeId, expectedLinkVersion, confirm: true}`; atomically consume owner/session-bound preview and create link. |
| `DELETE /api/team-private/sleeper-link` | `{expectedLinkVersion}`; delete owner's link, increment link version and invalidate pending confirmations. |

Google GIS should later use an explicit button and JS credential callback POST to the same fixed origin. No One Tap, redirect URL tokens, refresh/access token storage, passwords, email recovery, or automatic linking by email. Store only the canonical Google issuer and subject as the stable provider identity; email/name/picture claims are not persisted.

Sleeper lookup proves only that a public account resolved. A link is `operator_assertion`, never verified account control. User ID strings remain strings; numeric input must exactly match the resolved ID. Username/display name are optional untrusted display fields, with source URL and received time retained. A username change does not change the stored ID. A user must unlink before choosing another account. Different TIBER users may independently assert the same Sleeper ID. The follow-on adds request-time league retrieval and My Leagues; league sync, saved decisions, notes, notifications, MCP, models and fantasy actions remain outside this slice.

## Persistence and lifecycle

| Table | Constraints and use |
| --- | --- |
| `tiber_users` | UUID PK, unique `(issuer, subject)`, active/disabled status, monotonic session and link versions |
| `tiber_auth_sessions` | `sid`, `sess` JSONB, `expire`; compatible with connect-pg-simple; expiry index |
| `tiber_auth_challenges` | Google/link kind, hashed session binding, optional owner, payload, timestamps and consumed marker; kind/owner constraint |
| `tiber_sleeper_links` | User PK/FK; one active link per TIBER user; no global unique constraint on Sleeper ID |

All user operations lock the TIBER user row and recheck active status, session version and lifetime. Link mutation and challenge consumption share the same transaction. Login rechecks challenge expiry and strict token expiry after acquiring the identity row lock. Stable-identity conflict handling prevents duplicate users. Logout advances a server-authoritative version: a stale in-flight session save cannot restore revoked authority, even though old session rows remain until expiry/pruning. Reads admitted before a concurrent logout may finish; later authorization checks fail.

Pre-auth/challenges last five minutes; authenticated idle lifetime is 24 hours and absolute lifetime seven days. Last activity is explicitly saved in JSON on successful private responses. Cookie expiry is capped by absolute lifetime; both response-end touch and store touch are inert. Every required session save completes before success headers. Store failure yields unavailable, with no usable new cookie. A domain transaction may have committed before a subsequent session save fails; clients must reauthenticate and reread state rather than assume a mutation was undone.

The HTTPS cookie is host-only `__Host-tiber_session`, Secure, HttpOnly, SameSite=Lax, Path=/; no Domain. Only explicit development on HTTP localhost/127.0.0.1 with a local database permits `tiber_local_session` without Secure. Trust proxy remains the existing one-hop deployment assumption and must be confirmed for the staging topology.

Per-process limits are 60/IP/minute, 40/session/minute and 40/authenticated user/minute with at most 10,000 limiter keys. These are abuse bounds for the planned single replica, not distributed enforcement. Cert retrieval and existing Sleeper retrieval are bounded at 10 seconds; Google retries are disabled. Pool size is four with connection/query/statement/lock timeouts. Expired challenges are pruned in batches of 100 on new challenges, skipping locked rows to avoid reversing the login/link lock order, and expired sessions are periodically pruned. User/link records persist until a separately reviewed deletion workflow; raw Google tokens, cookies, nonce values, query/body data and user-selected display fields are not logged.

## Configuration and activation gates

Required server configuration names: `TEAM_AUTH_ORIGIN`, `TEAM_AUTH_GOOGLE_CLIENT_ID`, `TEAM_AUTH_DATABASE_URL`, `TEAM_AUTH_SESSION_SECRET`. Optional `TEAM_AUTH_DATABASE_CA` contains a trusted PEM CA when required. There is no fallback to `DATABASE_URL`, `SESSION_SECRET`, legacy identity, a default user, or in-memory production storage. HTTPS is mandatory outside the narrow local exception. Database URLs reject query parameters that could override TLS settings; remote TLS verifies certificates and optional explicit CA trust. The session secret must be newly generated high-entropy base64url-compatible material, 43–512 characters; syntax validation cannot prove entropy.

No credentials are committed or provisioned. This PR contains table declarations only: it does not generate/apply migrations or connect to a live database. Existing `drizzle.config.ts` continues to target the legacy schema. `createTableIfMissing` is false. Startup's four read-only shape probes cannot establish grants, constraints or operational readiness.

Before activation, separately authorize and review an auth-only Drizzle config and generated migration limited to these four tables, a dedicated database/runtime role without legacy access, separate migration privileges, TLS trust and cross-role denial, actual PostgreSQL concurrent login/link/logout/restart/expiry tests, backup/restore and retention/deletion operations. Do not use existing legacy `db:push`/migrate commands for these auth tables. Test only an explicitly authorized disposable/staging database first.

Then separately configure the exact Google web client and fixed staging origin, build the Account UI, and verify real sign-in/cancel/error, origin/CSRF/cookie behavior, explicit Sleeper preview/confirmation, logout across tabs/devices and account switching. Check iPhone Safari at 390/430 px and desktop; clear private UI/cache on loss of identity and recheck on focus/pageshow. Public preview inheritance must remain free of auth credentials. Production activation and merge/release remain separate decisions.

## Verification

Offline checks use existing installed dependencies and synthetic data only. The three auth suites cover the actual Google cryptographic verifier, strict nonce/time/audience/issuer checks, bounded transport, transaction authorization/expiry and sanitized failures; HTTP session rotation, two-user ownership, explicit link confirmation, replay, all-session revocation, persisted idle/absolute lifetime, malformed input and delayed save failures; and real bootstrap import exclusion/pending/failure/public compatibility. Memory-backed HTTP fixtures are test-only and do not establish PostgreSQL race/constraint behavior.

Run the three new suites plus public-profile, Draft Review route, Team/evidence UI and production-root regressions with `npm test -- --runTestsByPath ... --coverage=false`. Run `sh build.sh`, `node node_modules/typescript/bin/tsc -p . --incremental false` against both exact base and candidate, and `git diff --check`. Record exact results, diff/tree identity and independent implementation review on the PR. Built and development local smoke checks must use no auth/provider/database configuration: public evidence remains 200, private auth remains 503/no-store, and legacy APIs remain 404. Neither those smoke checks nor health 200 claim real-auth readiness.

## 2026-09-13 — #375 takeover: Account and league navigation

Joe asked to take over #375 so he can toggle through leagues more seamlessly. This authorizes the bounded repair and interface/API work here, including updating the existing isolated PR preview. It does not activate private persistence or Google sign-in in that public preview. Main was integrated at `a6840e5041905899a75c1c6ea424f45062492024`; both append-only agent logs were retained when resolving merge conflicts. #377 remains a separate branch.

- Fixed review `discussion_r3996655067`: all certificate retrieval failures are classified at the retrieval boundary with a stable error type. Timeout, abort, DNS, TLS, HTTP and decode failures return `503 AUTH_IDENTITY_UNAVAILABLE`; invalid signatures/claims remain `401`. The real installed Google verifier is tested with synthetic credentials and injected transport failures.
- `TeamAccount.tsx` adds explicit Google button login, a Sleeper link preview/confirmation, unlink and all-session logout. Google's script loads only after explicit sign-in intent; nonce and credentials stay in memory, credentials use the fixed same-origin POST, and neither browser storage nor URL tokens are used. No One Tap or automatic provider sign-in.
- Identity/session checks run on entry, focus and back-forward restoration. Logout/unlink/start of a recheck immediately removes private account/list state and invalidates pending responses. A metadata-only BroadcastChannel asks other tabs to recheck after account changes; focus remains the fallback. Failed private discovery stops for an explicit recheck, without retry loops. Store failure may follow a committed mutation, so the UI asks the user to recheck authoritative state.
- Link previews now include the persisted challenge's exact `expiresAt` as an additive response field. The server remains authoritative about expiry; the UI also removes expired previews.
- The `team-auth` client keeps the restricted public Team shell and enables Account. It never falls into legacy authenticated/default-user UI. Public profiles do not mount Account or call private endpoints.
- `POST /api/team-private/leagues` accepts only `{season}`. `POST /api/team-private/league-rosters` accepts only `{season, leagueId}`. Both are read-only operations protected by existing origin/CSRF/session rules. The Sleeper ID is derived exclusively from the session owner's saved link. Authentication and link version are checked before and after upstream retrieval, so a concurrent logout/unlink cannot return the old linked context. Source failures are sanitized 502 responses; no mutation or claimed ownership is inferred.
- The same public compiler powers explicit username lookup in the public preview; it does not read private state. `GET /api/draft-review/leagues?account=…&season=…` and `GET /api/draft-review/league-rosters?userId=…&leagueId=…&season=…` are strict, rate-limited, no-store public reads. Requests retain the existing ten-second per-source timeout. Listing admits at most 128 complete, unique league summaries for the chosen season; roster discovery fetches only the selected league and validates its complete roster count, identity and season. Account/list/roster observations have separate clocks.
- The phone-sized picker keeps the list in React state while switching and supports search across league name, ID and format. It does not persist visited/active league state. A single observed owner/co-owner membership opens its exact roster; multiple memberships require an explicit choice; absent membership remains visible. Choosing a league reuses Team's existing study-discard check and fresh roster loader. Private link/list context is never added to public URLs, compiler responses or copied agent packets.

Provider references checked 2026-09-13: [Sleeper public API](https://docs.sleeper.com/#get-all-leagues-for-user), [Google GIS button](https://developers.google.com/identity/gsi/web/guides/display-button), [Google JS configuration](https://developers.google.com/identity/gsi/web/reference/js-reference). No Sleeper writes exist in these APIs.

### Remaining activation work

The existing #375 preview has no auth database, Google client ID, session secret or origin variables. Its public runtime can exercise league switching immediately. Real login requires the previously documented isolated database/migration/role/TLS checks and Google origin/client setup, then real browser/device lifecycle acceptance. The Account UI is now implemented; it is tested with synthetic identities and does not establish live-auth readiness. No database/provider settings or production deployment were changed in this follow-on.

### Follow-on validation receipt (2026-09-13)
- 144 tests passed across 11 focused suites, run in isolated groups: source/auth services (59), UI/public/private routes and compatibility (81), isolated auth bootstrap (4). JSON result totals were checked; an earlier combined runner stopped before producing a complete summary and is not the basis for this count.
- Full `sh build.sh` passed. `node node_modules/typescript/bin/tsc -p . --incremental false` reports the same 506 diagnostics and identical per-file/error-code counts as main `a6840e50`; no touched-file errors.
- Sixteen actual built HTTP checks passed across public and unconfigured team-auth profiles: Team/alias/evidence, invalid league input, auth session, both private league endpoints and legacy denial. No provider/database configuration; no new auth cookies.
- Browser binary acquisition timed out. DOM tests and successful HTTP/build checks do not claim rendered-browser or phone acceptance. Existing isolated Railway preview identity and publication/deployment results are recorded on PR #375.
- The prior independent review covered foundation head `133aa003`, not this larger follow-on. Its certificate finding is repaired with regressions; fresh review and live-auth acceptance remain pending.
