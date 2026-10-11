# Weekly consumer review repair R3 — 2026-09-15

Bounded repair of #386 finding 4010982454, verified on 05c02e3febe3db10752be19b8bf8c790053cfd0d. The offline decoder accepted self-opponents and inconsistent matchups across distinct players in one game.

The decoder now requires distinct team/opponent values and a consistent unordered pair per game across all source positions before display filtering. Reciprocal rows are accepted, and different games may have independent pairs. No aliases, team identity crosswalks or current-team rewrites are introduced.

Touched: weeklyBoxscore.ts and matching tests, audit and agent logs. Both malformed cases failed against prior code. All 72 targeted tests across weekly adapter, routes and public profile pass. The unchanged TIBER-Data weekly_boxscore_publication_candidate_v0 revision 5f86ec5d56d2965d17ac58e860f9f107c648d3d367adbf2c7a73c4f316dbc0db still previews 332 players, 15/16 games, unknown finality. Artifact lives under exports/candidates/weekly_boxscore/revisions/2026_REG_w01 in TIBER-Data.

Fresh independent review pending. This checks internal consistency, not independent schedule matchup authentication. Runtime remains unavailable; no source admission, activation, acquisition, generated artifact changes, merge or deployment.
