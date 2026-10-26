# Frozen private ROP history reader

Owner: Fantasy application adapter; upstream semantics remain owned by
Role-and-opportunity-model. Joe's October 22, 2026 `step_1_accepted` verdict
authorizes this implementation and repeated owner-private descriptive reads
of the exact W1–5 private release v2 through the TIBER MCP role-evidence path.
No sharing, promotion or other consumer is admitted.

`roleHistory.ts` is a pure, injected-artifact reader. It reads no filesystem,
network, database, current roster, producer or legacy lab. Its input is trusted
build material authenticated by the pinned preparation/build chain; schema
validation alone is not artifact authentication. All retained JSON fields and
states/bindings pass through without recalculation. Caller results are copies.
The reader is lazy: construction, discovery, league, unknown, invalid and
disabled calls never parse, copy or validate the artifact. The first valid
enabled call does so once; failure stays closed (`artifact_invalid`) without
retry. Before that call, capability reports the build-validated release with
`validation: deferred`; afterwards `passed` or `failed`.

`tiber_get_rop_role_history` accepts only a native `nflverse:gsis` ID, numeric
season, seasonType and one to five distinct numeric weeks. No name lookup or
Sleeper join exists. W1–5 REG 2026 is the only release scope. Out-of-scope and
outside-catalogue results have null records; a selected subject's source gap
preserves the retained missing/null record. Observed-zero field witnesses stay
on an observed player-week, alongside any positive fields.

`privateRoleEvidence.ts` contains only null in Git. The combined default build/stdio
surface has eight league/schedule tools, with ROP withheld. The owner-only Worker build
replaces that module with the exact pinned private input as immutable text plus
its validated release, parsed only on first enabled use. That build registers
the ninth tool separately from the league dispatcher. Data calls use existing
Sites admission and trusted visitor-header checks. Runtime marker
`TIBER_ROP_SOURCE=private-frozen-w01-w05-v2` separately enables ROP; absent or
wrong marker refuses ROP even if league reads are enabled. The marker does not
create an artifact when the build has none. TTS and Forecast stay withheld.

Existing source-read limits and complete 1 MB MCP envelope limit remain. Local
immutable reads perform no external source work. Private input and generated
Worker must remain outside the repo, outside public CI/logs/caches and fixtures.
See [implementation/review packet](../../../docs/reviews/rop-history-adapter-2026-10-22.md)
for exact pins, replay commands, checks and completion limits. Hosted publication
and installed acceptance have not occurred.
