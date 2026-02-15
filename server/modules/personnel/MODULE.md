# Personnel Module

## Purpose
Provide backend personnel grouping intelligence based on usage plays from `bronze_nflfastr_plays`.

## Inputs
- `bronze_nflfastr_plays` offensive run/pass plays with `offense_personnel`.
- `player_identity_map` GSIS identity resolution (name/position/team).

## Outputs
- Per-player usage-play personnel profiles (`11`, `12`, `13`, `10`, `21`, `22`, `other`).
- Role dependency classification (`FULL_TIME`, `11_ONLY`, `HEAVY_ONLY`, `ROTATIONAL`, `LOW_SAMPLE`).

## Notes
- v1 is **usage-based**, not snap participation.
- Parsing extracts RB/TE counts only from personnel strings.
- Null/invalid personnel values are grouped as `other`.
