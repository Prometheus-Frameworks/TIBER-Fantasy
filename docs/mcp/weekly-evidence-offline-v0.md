# Weekly evidence offline MCP v0

Status: implementation candidate for #383; offline inspection only. Not a
deployed connector or accepted ChatGPT/iOS beta. The user authorized branch
implementation, focused tests and a reviewable diff on September 30, 2026,
excluding deployment, consumer activation, merges, provider calls and producer
runs. The local protocol smoke invokes that authorized offline inspection only.

## Dependency and evidence pins

This is a stacked branch on draft #411 at
`67398ca651bb96d08798bc10f8134f5ec6c1ff6a`. It reuses #411's existing
`server/modules/draftReview/playerStateCardEvidence.ts` and its local model;
neither file changes. Current main inspected was
`4204ddfc0fb0dd38da708e9aea3c4d01b77997ab`; its only change from #411's base
`482736f33a34267ae6dc4e038c04872e8162abee` was CLAUDE.md documentation. No
implicit main update, cherry-pick, source admission or #411 merge is performed.
The stack must be reconciled explicitly before a later integration decision.

Exact 12,298-byte model SHA-256:
`06f7c33f9ca4ea7e3ce5b8a2b88891d3bb63e8a899294f66f8fff955fc658c2e`.
The model is a bounded presentation projection, not complete standalone ROP
and Teamstate producer packets. Its original composition/receipt/review pins,
player/team/game joins, all ten team fields, counts and share operands,
health notes, null cutoffs, unknown finality, open corrections, unavailable
advanced evidence, source-native identity, unresolved Sleeper edge and
nflverse/CC BY 4.0 attribution remain present. No external Case-01 context,
operator hypotheses, W3 hindsight, ranking, forecast or causal claim is added.

Runtime verifies the projection through the unchanged decoder; upstream ZIPs
were authenticated by the prior projection review, not rehashed by this server.
The old exact-head review is not independent review of this new MCP adapter.

## Local setup

Use the already installed repository dependencies: Node 20.6+ (the actual smoke
uses Node 24.19.0), SDK 1.30.0, Zod 3 and tsx. Runtime package acquisition is
never performed by the launcher. A missing dependency fails startup.

Run explicitly:

```sh
node /absolute/path/to/repo/scripts/runWeeklyEvidenceOffline.mjs --offline
```

For a supported local stdio client, use that same executable and absolute script
path with `--offline`. No server URL or account credential is needed. Do not
configure this stdio command as though it were a remote ChatGPT URL. No claim
of actual Claude Code or mobile installation is made by the SDK smoke.

The launcher sets cwd to its repository root and passes only PATH (Node's
directory), LANG, TZ and the offline marker to the child. DB/provider/admin
credentials, proxy overrides and NODE_OPTIONS are not forwarded. Use loader
mode rather than tsx CLI, avoiding its auxiliary IPC listener. The parent host
controls how Node launches the launcher itself: the launcher cannot undo a
preload already executed by its parent process. This is process hygiene, not
a hostile-host sandbox. Importing server/launcher definitions starts no listener.

## Tools

| Tool | Input | Result |
|---|---|---|
| `tiber_describe_capabilities` | `{}` | Offline contract, tools, bounds, unsupported operations |
| `tiber_list_evidence` | `{"season":2026,"season_type":"REG","subject_id":"00-0038124"}` | Exact retained projection and unavailable W3/Forecast/Sleeper lanes; byte integrity unchecked by listing |
| `tiber_get_evidence` | `{"evidence_id":"watson-gb-2026-reg-w01-w02-projection-v0"}` | Complete hash/semantic-checked model, available for offline inspection |

Selectors are strict and extras are rejected. A syntactically valid unknown ID
returns unavailable without reading any source. Unsupported subjects/seasons
fail invalid_input; callers cannot request broad catalogs. Human names are not
identity selectors. A bounded missing witness does not mean zero, bye or DNP.

Results include identical structured content and a JSON text block, verified
against the installed SDK client. No output schema is advertised for the
heterogeneous envelope. Transport success does not upgrade the original
private-preview eligibility. Remote consumer enabled remains false.

## Checks

```sh
node --import tsx --test tests/weeklyEvidenceOffline.test.ts tests/weeklyEvidenceProtocol.test.ts
node node_modules/typescript/bin/tsc --noEmit --strict --skipLibCheck --module ESNext --moduleResolution bundler --target ES2022 --types node server/modules/weeklyEvidence/catalog.ts server/modules/weeklyEvidence/weeklyEvidenceService.ts server/modules/weeklyEvidence/toolDefinitions.ts server/mcp/weeklyEvidenceServer.ts
npm run build
```

Tests use Node's native test runner plus the existing tsx loader; no Jest or
dependency configuration changes are required. Fixtures inject only local
bytes. The SDK in-memory test and actual stdio subprocess test exercise
initialize, discover/list/call, strict refusals and complete evidence retrieval.
Actual-client ChatGPT discovery, private auth, remote containment and iOS
acceptance remain separate gates. See
`docs/mcp/weekly-evidence-offline-validation-2026-09-30.md`.

If evidence is unavailable, inspect the fixed model's presence/hash and the
retained #411 dependency locally; do not substitute another source or edit the
pin to make it work. If startup fails, inspect installed SDK/tsx and launcher
mode. Sanitized stderr intentionally avoids raw evidence or credentials.
