# ADP Snapshots

Durable market-ADP artifacts fetched from Fantasy Football Calculator's free API
by `scripts/fetch_adp_snapshot.mjs`. This is currently the only ADP path in the
repo that persists real market data to disk (see field report
`TIBER-Ops/pilots/bounded-goal/draft-assist-pilot-2/field-report-2026-08-live-draft-harness-v0.md`,
findings F-009/F-010/F-020: the Sleeper-based sync services read an `adp` field
Sleeper does not serve, and ECR uploads are in-memory only).

## Files

- `adp_snapshot_{year}_{format}_{teams}tm_{date}.json` — immutable dated pulls
- `adp_snapshot_latest_{format}_{teams}tm.json` — overwritten copy of the newest pull

## Schema (`adp_snapshot_v0`)

Verbatim FFC `players` array wrapped with provenance: `source.url`,
`source.fetched_at`, request `params`, and `ffc_meta` (FFC's own draft-count and
date window). Player rows carry `name`, `position`, `team`, `adp`,
`adp_formatted`, `stdev`, `high`, `low`, `times_drafted`, `bye`.

Known source caveats: no stable cross-platform player id (join is name-based
until the identity crosswalk covers ADP names — field report F-012/F-021);
recently signed/moved players may lag; the `teams` param mainly affects
round.pick formatting rather than the underlying draft pool.

## Refresh

```
node scripts/fetch_adp_snapshot.mjs --format ppr --teams 12 --year 2026
```

Intended cadence: daily during draft season (a cron/scheduler hook is the
natural next step; the script is standalone and exits nonzero on any fetch or
shape failure, so it is safe to schedule).
