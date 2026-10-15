# Private personal league connector

The owner's October 14–15 request to finish the connector authorizes this follow-up to
merged #418. The existing local proposal is historical; this implementation adds
a private Sites-hosted transport and a configured public Sleeper profile. It does
not activate Google sign-in, database account linking, roster writes, upstream
models or the separate Watson evidence adapter.

## Personal questions

- `tiber_get_my_leagues({season?})` uses the server profile's public Sleeper user
  ID. Missing season is resolved from a fresh Sleeper NFL state read.
- `tiber_get_lineup_context({leagueId?, season?, rosterId?, week?, candidates?})`
  uses the configured default league when omitted. It refreshes exact owner or
  co-owner membership, requires an explicit roster when ambiguous, and returns
  lineup slots, bench/IR/taxi, all scoring rules including TE premium, byes,
  selected candidate availability and existing waiver-budget context.
- Candidates: at most five full names or exact Sleeper IDs. Name matches must be
  unique in the directory. No fuzzy identity repair; ambiguity returns IDs for
  clarification. Other teams' player lists and owners are not returned.
- `unrostered` means complete observed league membership did not include the
  active skill-position player. It does not establish claim eligibility, locks,
  pending claims, timing or a successful transaction.

The original five tools and source-disabled stdio launcher remain available.
Personal defaults are runtime configuration, never inferred authentication.
A stale default league for a different season fails scope checks; use league
list/explicit selectors to select that season's league. Historical selections do
not inherit the live NFL week. These are observations, not usage metrics, model
projections or a recommendation.

## Shared services and sources

The directory cache was extracted without changing its public export/reset API.
The existing Team waiver candidate compiler and complete-membership reader were
extracted for reuse, preserving its contract. A single personal request shares
one league, roster and directory observation across membership, roster and waiver
checks. Sibling source reads settle before the busy slot is released.

Sleeper fixed origin: `https://api.sleeper.app/v1`. Redirects are rejected, decoded
bodies are bounded before JSON parsing (24 MiB NFL directory, 2 MiB other reads),
and the existing ten-second timeout covers the body. Error bodies are not echoed.
The directory remains cached up to 24 hours; membership is request-time.

Byes use nflverse's maintained `nfldata/data/games.csv` at the fixed raw GitHub
URL in `schedule.ts`, bounded to 4 MiB with a ten-second timeout and one-hour
cache. For seasons 2021 onward a bye is derived only after all 272 regular-season
games, all 32 recognized teams, 17 distinct team-weeks per team, unique game IDs,
valid dates/weeks, and no team-week conflict are verified. The explicit nflverse
LA → Sleeper LAR code mapping is included. Missing/partial/conflicting schedules
produce null byes, with a separate unavailable schedule observation. This source
is used only for schedule context, not promoted statistical/model evidence.
Retrieval timestamps are not source-update or atomic-snapshot claims.

## Hosted boundary

`server/mcp/leagueReaderWorker.ts` uses the SDK's Web Standards stateless
Streamable HTTP transport. `POST /mcp` supports initialize, list and calls; JSON
batches and bodies over 16 KiB are refused. Tool arguments stay limited to 2 KiB;
complete envelopes stay under 1 MB. A shared per-isolate busy slot permits one
active source read, with a 30-second response deadline; authenticated calls are
limited to 30/minute per isolate. These are per-isolate controls, not a claimed
global distributed quota. Origin checks and no-store responses are applied.

Deploy **only** as an owner-private Sites project with `capabilities: ["mcp"]`.
Sites owns admission, OAuth and the private plugin. Every tools/call also requires
the Sites-injected authenticated user ID. Service access without a visitor ID can
inspect data-free discovery but cannot read the configured personal profile.
This code must not be exposed behind a proxy that trusts caller-supplied identity
headers. The owner-private policy is the principal restriction; do not widen the
Site's audience without adding per-principal profile authorization.

Runtime values (names only):
- `TIBER_LEAGUE_SOURCE=public-sleeper` explicitly enables provider reads. Any other
  value is the kill switch; publish the changed environment revision.
- `TIBER_PROFILE_USER_ID` selects the public Sleeper account.
- `TIBER_DEFAULT_LEAGUE_ID` optionally selects the default league.
No Sleeper credential, model API key, database, tunnel client or custom OAuth
secret is required.

## Build, deployment and rollback

Run `node scripts/buildLeagueReaderWorker.mjs /absolute/site/worker/index.js`
from this repository with locked dependencies installed. The bundle audit rejects
DB, historical-evidence and broader draft compiler imports. Commit/publish the
core change through the normal PR path; Sites stores the generated exact bundle
with its own source revision and source provenance. The Worker deployment does
not redeploy the Railway application, database or upstream producers.

Use the Sites Worker ESM build/validation and private publication workflow. Its
hosting manifest contains the opaque project ID and MCP capability, not profile
values. Reuse that Site and its provisioned plugin on updates. Read `get_site`
with `include_mcp_connection: true`, offer that exact plugin for installation,
then verify a read-only call. Publication alone is not connection acceptance.
Rollback uses the prior saved Site version; for an immediate source kill switch,
change the source marker and publish with the new environment revision.

## Verification

- Native service, protocol, actual stdio process and hosted boundary tests.
- Existing Team, waiver candidates, unrostered TEs and historical catalog tests.
- Strict scoped TypeScript and Worker import isolation/build checks.
- Live read acceptance: the configured account/default league exact roster membership, PPR, starting TE,
  bench TE's verified bye, and Kyle Pitts' observed membership status.
- Final host/plugin status is reported from deployment and actual connection
  evidence separately; no iPhone acceptance or independent review is implied.
