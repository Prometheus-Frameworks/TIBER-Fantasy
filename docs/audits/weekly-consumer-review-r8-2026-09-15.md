# Weekly consumer review R8 — 2026-09-15

Joe authorized the bounded repair/push/re-review loop, stopping before merge. Baseline: `bbece87d134f35455ffdbf6f58e87b3d40cafa27`.

Accepted P2 `4020244693`. Three mutation cases reproduced acceptance of schedule, player, and team receipts whose `release_asset_updated_at` was later than `retrieval_completed_at`. The decoder now requires each asset update instant <= that receipt's retrieval completion, in addition to R7 timestamp shape and retrieval ordering. Equal instants and equivalent offsets remain valid.

Validation: 103 decoder/route/public-profile tests pass. All three new mutation cases failed before repair. Existing candidate `5f86ec5d56d2965d17ac58e860f9f107c648d3d367adbf2c7a73c4f316dbc0db` remains accepted as `preview_not_admitted` with 332 players, 15/16 scheduled games, missing `2026_01_DEN_KC`, and unknown finality.

Producer alignment: Data #273 receives the same invariant rather than leaving Fantasy to compensate for malformed upstream provenance. Source observations, scoring policy, publication bytes, and runtime behavior remain unchanged. Fresh exact-head reviews are pending for both PRs. No source admission, acquisition, activation, UI, merge, or deployment.
