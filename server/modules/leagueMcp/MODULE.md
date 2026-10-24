# Read-only league MCP adapter — #383

Local implementation candidate authorized by Joe on October 11, 2026. This is a
separate public Sleeper observation surface. Remote connection, auth, hosting,
consumer activation, saved classifications and evidence expansion remain pending.

The service calls existing Team league discovery/membership and the extracted
#387 Manager result service. The roster-only compiler uses the existing Sleeper
transport and cached player-directory reader, with strict complete roster and
scope checks; it never calls the broader draft/history compiler. Display strings
are untrusted data; public membership is not account-control authentication.

Five MCP tools: capabilities, league list, exact league membership, one roster
context, and one league/week matchup result. No bulk all-league roster fan-out,
private account lookup, database, writes, schedules, model/API calls, arbitrary
URLs, credentials, ROP/TTS/Forecast delivery or saved contender/rebuilder labels.
Keep player IDs source-native; no name-based GSIS or provider joins.

Roster arrays are observed separately, with null reserve/taxi/starter collections
preserved. Directory failure does not erase known membership: player attributes
stay null. Directory caching is inherited (24 hours); clocks are retrieval clocks,
not source updates or atomic snapshot witnesses. Matchups preserve commissioner
zero overrides and unknown scores. Current/future weeks stay pending; prior-week
W/L/T is score-derived and provisional, finality not_verified. League median,
best ball and playoff outcomes are excluded by the inherited result contract.

Strict tool schemas, 2 KiB inputs, 1 MB complete MCP envelopes, one active source
read, 30-second response deadline. A timed-out underlying read keeps the busy
slot until settlement; inherited fetches time out at ten seconds. Existing
Sleeper fetches parse JSON before schema limits: upstream byte-level transport
containment is not newly certified by this slice. Do not expose remotely until
that transport/resource boundary and HTTP/auth controls are accepted.

Run `node /absolute/repo/scripts/runLeagueReader.mjs --source-disabled` to test
protocol discovery/refusal with no provider calls. `--public-sleeper` is an
explicit local source opt-in, not used in this implementation's validation and
not remote activation authority. The launcher requires installed dependencies,
fixes cwd and forwards only PATH/LANG/TZ plus its source-mode marker. No HTTP
listener is supplied. The parent runtime is trusted, not a hostile-host sandbox.

## October 15 personal hosted follow-up

The preceding text describes #418's original local release boundary. The owner has now
asked to finish the connection. See `docs/mcp/league-reader-hosted-v1.md` for the
implemented owner-private Sites transport, managed OAuth, two personal-context
tools, shared waiver compiler, complete-schedule bye derivation, streamed upstream
limits and runtime kill switch. The stdio default remains source-disabled. Hosted
publication and an actual ChatGPT tool call are distinct acceptance checkpoints.

## October 22 frozen ROP adapter candidate

The separately scoped `server/modules/roleEvidence/` candidate composes a
private frozen ROP reader with this transport; it does not add ROP to the league
dispatcher. League dispatch explicitly refuses non-owned names and calls the
matchup reader only for its own exact tool name. The default public build stays
source-disabled for ROP with no populated input. See that module's documentation
and the October 22 review packet; the candidate has not been hosted or merged.
