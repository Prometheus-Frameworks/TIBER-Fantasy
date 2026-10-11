# Weekly consumer review R7 — 2026-09-15

Joe authorized the bounded repair/push/re-review loop, stopping before merge. Baseline: `c46c7ab42046b4f5a5e1e29585460ea9b028add1`.

Accepted P2 `4019849956`. Seven mutation cases reproduced acceptance of malformed, naive, reversed, or post-compilation receipt clocks. The decoder now requires offset-bearing RFC 3339 timestamps for schedule and box-score source receipts, retains `retrieval_started_at` instead of stripping it from the reviewed source receipt, requires retrieval start <= completion for all receipts, and requires box-score retrieval completion <= candidate compilation. Comparisons use instants, so equal instants with different offsets remain valid.

Validation: 100 decoder/route/public-profile tests pass. All seven malformed-clock cases failed before repair. The existing candidate `5f86ec5d56d2965d17ac58e860f9f107c648d3d367adbf2c7a73c4f316dbc0db` still previews 332 players, 15/16 scheduled games, missing `2026_01_DEN_KC`, and unknown finality.

Files: decoder, matching tests, this audit, and agent logs. Producer Data #273 is independently clean at `b26a0f8038e952d6eca360bae871583fcec22a9f`. Source observations, scoring policy, publication bytes, and runtime behavior are unchanged. Internal clock consistency does not independently authenticate provenance or certify finality. Fresh exact-head review pending. No admission, acquisition, activation, UI, merge, or deployment.
