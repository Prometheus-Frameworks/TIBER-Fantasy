# Personnel Module

## Purpose
Provide backend personnel grouping intelligence based on snap participation data from nflverse `pbp_participation`.

## Inputs
- `bronze_pbp_participation` — per-play player presence (GSIS ID on field per play).
- `bronze_nflfastr_plays` — offensive run/pass plays with `offense_personnel` strings.
- `player_identity_map` — GSIS identity resolution (name/position/team).

## Outputs
- Per-player snap-participation personnel profiles (`11`, `12`, `13`, `10`, `21`, `22`, `other`).
- Role dependency classification (`FULL_TIME`, `11_ONLY`, `HEAVY_ONLY`, `ROTATIONAL`, `LOW_SAMPLE`).

## Data Pipeline
1. `import_pbp_participation.py` downloads nflverse `pbp_participation` parquet and inserts normalized rows into `bronze_pbp_participation` (one row per play per offensive player).
2. `personnelService.ts` JOINs participation with `bronze_nflfastr_plays` (on game_id + play_id) to classify each snap by personnel grouping.

## Notes
- v2 is **participation-based** — counts every play a player was on the field for, not just plays where they were the primary actor (passer/rusher/receiver).
- Parsing extracts RB/TE counts from personnel strings to derive grouping codes.
- Null/invalid personnel values are grouped as `other`.
