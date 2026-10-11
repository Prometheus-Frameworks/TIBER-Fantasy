# Weekly consumer review repair R4 — 2026-09-15

Bounded repair of #386 findings 4011177267 and 4011177273, verified against f160fabf1d86b8d8a1989e4e79979ae7031d8830.

The offline decoder now requires agreement among known target/carry denominators per game/team/metric across all positions before display filtering. Null denominators stay unknown and are not replaced using another row. Opponents and different games remain independent. Receptions above non-null targets are rejected; nullable inputs remain unknown. These are internal consistency checks, not external box-score corroboration.

Both findings reproduced before repair: two denominator regressions and one reception regression failed. All 76 targeted adapter/route/public-profile tests now pass. The existing TD-scoring fixture had five receptions on four targets; its targets were corrected to five, preserving the expected score. No scoring policy changes.

Unchanged TIBER-Data weekly_boxscore_publication_candidate_v0 revision 5f86ec5d56d2965d17ac58e860f9f107c648d3d367adbf2c7a73c4f316dbc0db under exports/candidates/weekly_boxscore/revisions/2026_REG_w01 still previews 332 players, 15/16 games, unknown finality. No source facts or coverage were rewritten. Runtime remains unavailable. No admission, acquisition, activation, merge or deployment. Fresh independent review pending.
