# Weekly consumer review R9 — 2026-09-15

Joe authorized the bounded repair/push/re-review loop, stopping before merge. Baseline: `2eba688049671b58790f82f4501bb830bbd77a73`.

Accepted P2 `4020574271`. Zod's offset-enabled datetime accepted syntactically shaped but impossible offsets such as `+24:00`; JavaScript then parsed them as `NaN`, causing every ordering comparison to evaluate false. Three schedule, candidate-compilation, and box-score-source mutations reproduced successful preview before repair.

The shared receipt-clock schema now also requires `Date.parse` to yield a finite instant before any ordering comparison. This covers every clock field that uses the schema while preserving valid offset-bearing timestamps and equivalent instants.

Validation: 106 decoder/route/public-profile tests pass. All three invalid-offset cases failed before repair. Existing candidate `5f86ec5d56d2965d17ac58e860f9f107c648d3d367adbf2c7a73c4f316dbc0db` remains `preview_not_admitted` with 332 players, 15/16 scheduled games, missing `2026_01_DEN_KC`, and unknown finality.

Paired Data #273 separately repairs schedule release ordering. Source observations, scoring policy, publication bytes, and runtime behavior remain unchanged. Fresh exact-head reviews are pending for both PRs. No source admission, acquisition, activation, UI, merge, or deployment.
