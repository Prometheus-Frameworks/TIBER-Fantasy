# Weekly consumer review R6 — 2026-09-15

Joe authorized the bounded repair/push/re-review loop, stopping before merge. Baseline: c62dbb084b4df5a625c785a74671fc15032e41a5.

- Accepted 4011507026: nullable-aware completions + interceptions <= attempts, and passing TDs <= completions. Two malformed passing tests failed before repair.
- Accepted 4011507038: known numerator and positive denominator require available status and exact ratio. Both share families rejected falsely unavailable values after repair; positive and zero numerator cases covered. Two regression tests failed before repair.
- Disputed 4011507032: individual rushing TD <= carries and receiving TD <= receptions are not valid NFL invariants. The [NFL Guide for Statisticians (2025)](https://www.nflgsis.com/gsis/documentation/stadiumguides/guide_for_statisticians.pdf), Rushing page12 exampleV and Laterals page17, allows a lateral recipient to receive touchdown/yardage credit without the originating carry or reception. Two synthetic regression cases preserve those valid shapes, scoring 6.5 PPR for five yards plus one TD with zero credited touches. These tests are illustrative software fixtures, not new football evidence. Ask independent review to reconsider this finding; do not silently mark it resolved.

92 decoder/route/public-profile tests pass. Equality, null operands, and zero shares are covered. Corrected the existing synthetic QB scoring fixture to provide attempts/completions consistent with its passing TDs; scoring policy is unchanged. The existing candidate 5f86ec5d56d2965d17ac58e860f9f107c648d3d367adbf2c7a73c4f316dbc0db still previews 332 players, 15/16 scheduled games, missing DEN_KC, unknown finality. Source observations and publication bytes are unchanged. Runtime stays unavailable.

Files: weeklyBoxscore.ts, matching test file, this audit, agent logs. Fresh independent review pending. No source admission, new acquisition, runtime activation, UI, merge or deployment. This validation repair does not claim box scores can verify which play caused a touchdown/touch discrepancy.
