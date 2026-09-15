# Weekly consumer review R5 — 2026-09-15

Verified P2s 4011400250, 4011400254, 4011400257 on 013e9b0bb909e521db33e9c4ae42c5291bf6ef2e. Four regression cases reproduced acceptance of summed targets/carries above team totals, completions above attempts, and reused CSV rows across distinct players.

The offline decoder now checks sums of known numerators against known team/game/metric denominators after collecting all rows, independently of input order. Null numerators are not asserted as zero observations; null denominators are not imputed. Equality and incomplete sums remain allowed. Checks cover hidden positions. Source CSV indices must be unique across the candidate player source. Completions/attempts validation is nullable-aware.

81 adapter/route/public-profile tests pass, including null-denominator row order and exact-total acceptance. Old multirow synthetic fixtures now use distinct source-row indices; no source data or scoring policy was changed. Unchanged TIBER-Data weekly_boxscore_publication_candidate_v0 revision 5f86ec5d56d2965d17ac58e860f9f107c648d3d367adbf2c7a73c4f316dbc0db under exports/candidates/weekly_boxscore/revisions/2026_REG_w01 still previews 332 players, 15/16 games, unknown finality.

Touched: decoder, matching tests, audit and agent logs. Fresh independent review pending. Internal consistency is not independent source corroboration. Runtime remains unavailable. No admission, acquisition, activation, merge or deployment.
