# QB FIRE v1 — Data Availability Audit

## Source tables audited

- `bronze_nflfastr_plays` (primary PBP source)
- `datadive_snapshot_player_week` (weekly player facts; used downstream by `fantasy_metrics_weekly_mv`)

## Required field coverage

| Required field | Found? | Table/column | Notes / substitution |
|---|---:|---|---|
| `season`, `week`, `play_id` | ✅ | `bronze_nflfastr_plays.season`, `.week`, `.play_id` | Native columns.
| `passer_player_id`, `rusher_player_id` | ✅ | `bronze_nflfastr_plays.passer_player_id`, `.rusher_player_id` | Native columns.
| `qb_dropback` | ✅ | `bronze_nflfastr_plays.raw_data->>'qb_dropback'` | Fallback used: `play_type in ('pass','sack')` if null.
| `pass_attempt` | ✅ | `bronze_nflfastr_plays.raw_data->>'pass_attempt'` | Fallback used: `play_type='pass'` if null.
| `sack` | ✅ | `bronze_nflfastr_plays.raw_data->>'sack'` | Fallback used: `play_type='sack'` if null.
| `scramble` | ✅ (optional) | `bronze_nflfastr_plays.raw_data->>'qb_scramble'` | If null, treated as 0.
| `qb_spike`, `qb_kneel` | ✅ | `bronze_nflfastr_plays.raw_data->>'qb_spike'`, `raw_data->>'qb_kneel'` | Fallback play-type checks (`qb_spike`, `qb_kneel`) included.
| `yardline_100` | ✅ | `bronze_nflfastr_plays.raw_data->>'yardline_100'` | Present via raw nflverse payload in `raw_data`.
| `down`, `ydstogo` | ✅ | `bronze_nflfastr_plays.raw_data->>'down'`, `raw_data->>'ydstogo'` | Used for buckets.
| `air_yards` | ✅ (optional) | `bronze_nflfastr_plays.air_yards` | Native typed column.
| `pass_td`, `interception`, `qb rush_td` outcomes | ✅ | `raw_data->>'pass_touchdown'`, `raw_data->>'interception'`, `raw_data->>'rush_touchdown'`; plus table booleans `touchdown`, `interception` | ETL applies raw flag first, then boolean fallback.
| `pass_yards`, `rush_yards` | ✅ | `bronze_nflfastr_plays.yards_gained` | Split by play type + actor (QB rusher) in ETL.

## Missing fields / substitutions

No hard blockers for v1 were found.

- `qb_dropback`, `pass_attempt`, `sack`, `qb_spike`, `qb_kneel`, `yardline_100`, `down`, `ydstogo` are consumed from `raw_data` with deterministic fallbacks.
- Scrambles are optional for v1 and default to `0` if missing.

## Can we build QB FIRE v1 with current data?

**Yes.** Current bronze PBP schema + raw nflverse payload coverage are sufficient to compute explainable QB xFP (opportunity) and role features for FIRE v1.
