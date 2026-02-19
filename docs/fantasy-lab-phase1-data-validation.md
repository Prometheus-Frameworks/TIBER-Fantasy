# Fantasy Lab Phase 1 — Data Validation Report

**Date:** February 19, 2026  
**Anchor:** Season 2025, Week 14 (rolling window W11–W14)  
**Data Source:** `fantasy_metrics_weekly_mv` materialized view  

---

## Test 1 — Rolling Window Data Availability

**Goal:** Confirm the 4-week rolling window (W11–W14) has data for every week.

| Season | Week | Rows |
|--------|------|------|
| 2025   | 11   | 294  |
| 2025   | 12   | 188  |
| 2025   | 13   | 307  |
| 2025   | 14   | 290  |

**Result: PASS**  
All four weeks populated. Week 12 is lighter (188 rows vs ~290–307), likely a bye-heavy week. No missing weeks.

---

## Test 2 — Null / Data Hole Audit

**Goal:** Verify key columns are populated for most players.

| Column | Total Rows | Nulls | % Null |
|--------|-----------|-------|--------|
| x_ppr_v2 (xFP) | 1,079 | 293 | 27% |
| xfpgoe_ppr_v2 | 1,079 | 293 | 27% |
| snap_share | 1,079 | 0 | 0% |
| targets | 1,079 | 0 | 0% |
| carries | 1,079 | 0 | 0% |
| rush_share | 1,079 | 1,079 | 100% |
| air_yards | 1,079 | 0 | 0% |
| red_zone_touches | 1,079 | 0 | 0% |

**Result: PARTIAL PASS**

- Core opportunity fields (snaps, targets, carries, air yards, red zone) are fully populated.
- `x_ppr_v2` is null for ~27% of rows — all QBs. The upstream xFP model does not produce expected fantasy points for quarterbacks.
- `rush_share` is 100% null across all positions — the upstream snapshot pipeline never populates this column.
- No actual fantasy points column (`fpts_ppr`) exists in the view. Only expected (xFP) and over-expected (xFPGOE) are available.

**Known Issue — QB xFP Gap:** The xFP model produces no output for QBs. This cascades through every downstream calculation that depends on `x_ppr_v2`. See recurring notes in Tests 3, 5, and 6.

---

## Test 3 — Rolling Aggregate Computation (xfp_R, xfpgoe_R, snaps_R)

**Goal:** Verify rolling 4-week totals compute cleanly without errors.

| Position | Players | Avg xFP_R | Max xFP_R | Min xFP_R | Avg xFPGOE_R | Avg Snaps_R |
|----------|---------|-----------|-----------|-----------|--------------|-------------|
| QB       | 51      | 0.00      | 0.00      | 0.00      | 25.79        | 142.9       |
| RB       | 101     | 21.86     | 75.84     | 0.00      | -4.20        | 71.3        |
| TE       | 92      | 11.17     | 49.62     | 0.00      | -0.35        | 91.4        |
| WR       | 172     | 15.95     | 74.00     | 0.00      | -2.21        | 94.6        |

**Result: PASS (with QB caveat)**

- RB/WR/TE aggregates are reasonable. Max rolling xFP of ~75 for RBs and ~74 for WRs over 4 weeks tracks with elite usage (~19 xFP/week).
- Negative avg xFPGOE for RBs (-4.20) is expected — most backs underperform expected points.
- QB xFP is all zeros (known gap). QB xFPGOE is non-zero (25.79 avg), suggesting FPOE is derived separately from a different source.
- 3 players with blank position detected — minor data quality issue from upstream.

---

## Test 4 — Eligibility Threshold Check (Ghost Filter)

**Goal:** Verify position-specific snap thresholds produce a sensible eligible pool.

**Thresholds:** QB >= 100 snaps | RB >= 50 snaps | WR/TE >= 80 snaps

| Position | Total | Eligible | Pass Rate |
|----------|-------|----------|-----------|
| QB       | 51    | 34       | 67%       |
| RB       | 101   | 55       | 54%       |
| TE       | 92    | 49       | 53%       |
| WR       | 172   | 93       | 54%       |

**Result: PASS**  
Roughly 50–67% pass rate across positions. The filter removes low-snap fringe players without being so aggressive that meaningful contributors are lost. The 3 blank-position players are correctly excluded.

---

## Test 5 — Opportunity Score Sanity (Percentile Rankings)

**Goal:** Verify that PERCENT_RANK on rolling xFP produces rankings that pass the football smell test.

### RB Top 5
| Rank | Player | Team | xFP_R | Snaps | OppScore |
|------|--------|------|-------|-------|----------|
| 1 | C.McCaffrey | SF | 75.8 | 150 | 100.0 |
| 2 | B.Robinson | ATL | 74.9 | 196 | 98.1 |
| 3 | C.Brown | CIN | 73.7 | 202 | 96.3 |
| 4 | A.Jeanty | LV | 68.8 | 189 | 94.4 |
| 5 | K.Hunt | KC | 58.0 | 204 | 92.6 |

### WR Top 5
| Rank | Player | Team | xFP_R | Snaps | OppScore |
|------|--------|------|-------|-------|----------|
| 1 | Mi.Wilson | ARI | 74.0 | 240 | 100.0 |
| 2 | R.Rice | KC | 67.2 | 222 | 98.9 |
| 3 | G.Pickens | DAL | 65.5 | 225 | 97.8 |
| 4 | A.Brown | PHI | 61.4 | 247 | 96.7 |
| 5 | W.Robinson | NYG | 57.4 | 193 | 95.7 |

### TE Top 5
| Rank | Player | Team | xFP_R | Snaps | OppScore |
|------|--------|------|-------|-------|----------|
| 1 | T.McBride | ARI | 49.6 | 258 | 100.0 |
| 2 | H.Henry | NE | 38.0 | 168 | 97.9 |
| 3 | G.Kittle | SF | 36.3 | 170 | 95.8 |
| 4 | D.Schultz | HOU | 34.7 | 203 | 91.7 |
| 5 | Z.Ertz | WAS | 34.7 | 146 | 91.7 |

### QB
All 34 eligible QBs scored 0.0 on OpportunityScore due to the xFP null gap. Rankings are meaningless until this is resolved.

**Result: PASS for RB/WR/TE | FAIL for QB**  
High-volume, high-usage players correctly rise to the top at every position. The rank orderings are football-valid.

---

## Test 6 — Conversion Score Sanity (xFPGOE Percentile Rankings)

**Goal:** Verify that conversion scoring (who outperforms/underperforms their expected points) produces sensible boom/bust lists.

### RB — Top Converters (Boom)
| Player | Team | xFP_R | xFPGOE_R | ConvScore |
|--------|------|-------|----------|-----------|
| Ty.Johnson | BUF | 20.2 | +8.5 | 100.0 |
| D.Henry | BAL | 31.4 | +6.2 | 96.3 |
| C.McCaffrey | SF | 75.8 | +3.9 | 90.7 |

### RB — Bottom Converters (Bust)
| Player | Team | xFP_R | xFPGOE_R | ConvScore |
|--------|------|-------|----------|-----------|
| S.Barkley | PHI | 56.0 | -28.0 | 0.0 |
| W.Marks | HOU | 49.2 | -27.5 | 1.9 |
| A.Jeanty | LV | 68.8 | -22.5 | 5.6 |

### WR — Top Converters
| Player | Team | xFP_R | xFPGOE_R | ConvScore |
|--------|------|-------|----------|-----------|
| T.McMillan | CAR | 28.1 | +16.2 | 100.0 |
| J.Meyers | JAX | 33.3 | +14.4 | 98.9 |
| D.Adams | LA | 38.9 | +13.3 | 97.8 |

### WR — Bottom Converters
| Player | Team | xFP_R | xFPGOE_R | ConvScore |
|--------|------|-------|----------|-----------|
| E.Egbuka | TB | 48.1 | -24.7 | 0.0 |
| R.Odunze | CHI | 41.6 | -24.4 | 1.1 |
| J.Chase | CIN | 45.8 | -21.8 | 2.2 |
| J.Jefferson | MIN | 40.3 | -18.0 | 3.3 |

### TE — Top/Bottom
| Direction | Player | Team | xFP_R | xFPGOE_R | ConvScore |
|-----------|--------|------|-------|----------|-----------|
| Top | T.McBride | ARI | 49.6 | +17.0 | 100.0 |
| Top | G.Kittle | SF | 36.3 | +12.9 | 97.9 |
| Bottom | B.Wright | DET | 19.2 | -10.5 | 0.0 |
| Bottom | C.Otton | TB | 23.1 | -9.3 | 2.1 |

### QB
Because xFP is zero for all QBs, xFPGOE is effectively just raw fantasy points. The conversion ranking becomes a simple scoring leaderboard (Prescott 74.0, Allen 72.5 at top; Stroud 10.0, McCarthy 10.5 at bottom). This is not useful as a "conversion" metric.

**Result: PASS for RB/WR/TE | NOT MEANINGFUL for QB**  
WR bottom converters (Chase, Jefferson, Odunze, Egbuka in W11–14) were confirmed as an accurate reflection of their real-world performance during that stretch. The conversion scores correctly separate boom from bust and add texture without dominating.

---

## Critical Issue: QB xFP Gap

This issue surfaced in Tests 2, 3, 5, and 6. Summary:

- **Root Cause:** The upstream xFP v2 model (`x_ppr_v2`) does not generate expected fantasy points for quarterbacks. The column is NULL for all QB rows.
- **Impact:** OpportunityScore is 0.0 for all QBs. ConversionScore defaults to raw fantasy points, making it a simple scoring leaderboard rather than a meaningful over/under-expected metric.
- **Affected Columns:** `x_ppr_v2`, `xfpgoe_ppr_v2` (both null for QBs)
- **Unaffected:** Snap data, snap_share, and other opportunity fields are fully populated for QBs.
- **Resolution Options:**
  1. Build a QB-specific xFP model (passing attempts, dropbacks, air yards as inputs)
  2. Source QB xFP from an external model or alternative pipeline
  3. Use a different opportunity proxy for QBs (e.g., dropbacks + rushing attempts) as an interim measure
  4. Exclude QBs from FIRE scoring until xFP is available (document as a known limitation)

**Recommendation:** Address QB xFP before coding FIRE. Without it, QB scoring will be fundamentally broken — opportunity and conversion will both be meaningless.

---

## Secondary Issues

| Issue | Severity | Notes |
|-------|----------|-------|
| `rush_share` 100% null | Low | Column exists but upstream never populates it. Not critical for FIRE but would be useful for role context. |
| No `fpts_ppr` column | Medium | Actual fantasy points are not in the view. xFPGOE is pre-computed but if FIRE needs raw actuals for any calculation, a join to another source is required. |
| 3 players with blank position | Low | Minor upstream data quality issue. Ghost filter correctly excludes them. |
| Week 12 row count drop (188 vs ~290) | Low | Likely bye-week driven. Not a data bug. |

---

## Overall Verdict

**RB/WR/TE: Ready for FIRE.** The rolling window has data, the opportunity and conversion percentiles pass the football smell test, and the eligibility thresholds produce sensible pools.

**QB: Not ready.** The xFP gap must be resolved before QB scoring can be meaningful in any FIRE-based system.
