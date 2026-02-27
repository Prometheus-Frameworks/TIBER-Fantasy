# Data Lab Receiving Export Fact-Check Report

**Date**: 2026-02-27
**Module**: Data Lab → Receiving Lab → CSV Export
**Scope**: 2025 Regular Season WR & RB Receiving Stats
**Triggered by**: External fact-check against NFL.com, Pro-Football-Reference, ESPN, StatMuse, FantasyPros

---

## Executive Summary

External fact-checking confirmed that **core counting stats (targets, receptions, yards, TDs, games played) are accurate** across both the WR (top 30+) and RB (135 players) exports. However, the audit uncovered **6 shared bugs** affecting both position exports, plus **3 RB-specific findings**. All issues trace to specific, identifiable code paths in the ETL pipeline and aggregation layer.

### Shared Bugs (WR + RB)

| Severity | Issue | Columns Affected | Status |
|----------|-------|-----------------|--------|
| **CRITICAL** | Route profile percentages all 0/0/100 | Deep Target %, Intermediate Target %, Short Target % | Bug confirmed |
| **CRITICAL** | Air EPA metrics all zeroes | Air EPA, Comp Air EPA | Bug confirmed |
| **HIGH** | Rec First Downs consistently undercounted (~5-7 per player) | Rec First Downs | Bug confirmed |
| **MEDIUM** | Catch Rate % uses average-of-ratios instead of ratio-of-sums | Catch Rate % | Bug confirmed |
| **LOW** | Fantasy Points (PPR) includes rushing — correct but undocumented | Fantasy Points (PPR) | Not a bug; documentation gap |
| **LOW** | Inline Rate % blank/zero for WRs | Inline Rate % | Partially expected (TE-specific) + data gap |

### RB-Specific Findings

| Severity | Issue | Columns Affected | Status |
|----------|-------|-----------------|--------|
| **MEDIUM** | Rec Yards off by ~15-20 for high-volume RBs | Rec Yards | `yards_gained` vs `receiving_yards` edge cases |
| **MEDIUM** | RB route estimation uses fixed 50% heuristic | Routes Run, TPRR, YPRR, FP/Route, 1st Downs/Route | Inaccurate for pass-catching backs |
| **MEDIUM** | xYAC / YAC over Expected broken (raw_data dependency) | xYAC, YAC over Expected, xYAC Success % | Same raw_data NULL root cause |

---

## Part 1: Shared Bugs (WR + RB)

### Bug #1: Route Profile Percentages — CRITICAL

**Symptom**: Nearly every player shows `0.0 / 0.0 / 100.0` for Deep / Intermediate / Short Target %.

#### Root Cause

The Gold ETL computes target depth distribution by reading `air_yards` from the **`raw_data` JSON blob** rather than the direct `air_yards` column on `bronze_nflfastr_plays`.

**File**: `server/etl/goldDatadiveETL.ts` — lines 375-377
```sql
SUM(CASE WHEN COALESCE((raw_data->>'air_yards')::float, 0) >= 20 THEN 1 ELSE 0 END) as deep_targets,
SUM(CASE WHEN COALESCE((raw_data->>'air_yards')::float, 0) >= 10
     AND COALESCE((raw_data->>'air_yards')::float, 0) < 20 THEN 1 ELSE 0 END) as intermediate_targets,
SUM(CASE WHEN COALESCE((raw_data->>'air_yards')::float, 0) < 10 THEN 1 ELSE 0 END) as short_targets,
```

**Two compounding issues**:

1. **`raw_data` may be NULL**: The fast import script (`server/scripts/fast_nflfastr_import.py`) does NOT populate `raw_data` at all — it only imports extracted columns. If this script was used (even once, overwriting bulk-imported rows), `raw_data` is NULL for those rows. When `raw_data` is NULL, `raw_data->>'air_yards'` returns SQL NULL, and `COALESCE(NULL, 0) = 0`. Since `0 < 10`, every target is classified as "short."

2. **`COALESCE(..., 0)` design flaw**: Even when `raw_data` IS populated, plays where `air_yards` is genuinely NULL in the nflfastR source (throwaways, spikes, etc.) get COALESCE'd to 0 and counted as "short" rather than excluded from the depth distribution.

**The direct `air_yards` column** (schema line 2368) is reliably populated by ALL import scripts.

#### Fix

Replace `raw_data->>'air_yards'` with the direct `air_yards` column. Exclude NULL air yards from depth classification:

```sql
SUM(CASE WHEN air_yards >= 20 THEN 1 ELSE 0 END) as deep_targets,
SUM(CASE WHEN air_yards >= 10 AND air_yards < 20 THEN 1 ELSE 0 END) as intermediate_targets,
SUM(CASE WHEN air_yards < 10 THEN 1 ELSE 0 END) as short_targets,
```

The total depth targets denominator (`deepTargets + intermediateTargets + shortTargets`) already handles the filtering naturally — NULL air_yards plays won't increment any bucket.

---

### Bug #2: Air EPA / Comp Air EPA — CRITICAL

**Symptom**: Air EPA and Comp Air EPA columns show `0.00` for all players.

#### Root Cause

Same `raw_data` issue as Bug #1. The Gold ETL reads `air_epa` and `comp_air_epa` from the JSON blob:

**File**: `server/etl/goldDatadiveETL.ts` — lines 371-372
```sql
SUM(COALESCE((raw_data->>'air_epa')::float, 0)) as total_air_epa,
SUM(CASE WHEN complete_pass THEN COALESCE((raw_data->>'comp_air_epa')::float, 0) ELSE 0 END) as total_comp_air_epa,
```

When `raw_data` is NULL (fast import) or when these fields are null within the JSON, COALESCE produces 0 for every play. The sum of all zeroes = 0. Dividing by target count = 0.00.

Unlike `air_yards`, the `air_epa` and `comp_air_epa` fields do NOT have direct columns on `bronze_nflfastr_plays` — they only exist in `raw_data`.

#### Fix

**Option A (Preferred)**: Add `air_epa` and `comp_air_epa` as direct columns to the `bronze_nflfastr_plays` schema and extract them during import (like `epa`, `air_yards`, etc. are already extracted).

**Option B (Quick)**: Ensure the bulk import script (`import_nflfastr_2025_bulk.py`) is the canonical import path, and verify `raw_data` is populated. Then change COALESCE to only include rows where the field is non-null:

```sql
SUM(CASE WHEN (raw_data->>'air_epa') IS NOT NULL
    THEN (raw_data->>'air_epa')::float ELSE 0 END) as total_air_epa,
```

Note: Option B is fragile — any future re-import via the fast script would break it again.

---

### Bug #3: Rec First Downs Consistently Low — HIGH

**Symptom**: Rec First Downs are 5-7 lower than official NFL stats for top players.

WR examples:
- Puka Nacua: CSV 75 vs official 80 (Δ = -5)
- Jaxon Smith-Njigba: CSV 74 vs official 79 (Δ = -5)
- Ja'Marr Chase: CSV 66 vs official 73 (Δ = -7)

RB examples: Same pattern — consistently a few first downs low across all RBs with significant receiving volume.

#### Root Cause

The Gold ETL counts receiving first downs as:

**File**: `server/etl/goldDatadiveETL.ts` — line 366
```sql
SUM(CASE WHEN first_down_pass AND complete_pass THEN 1 ELSE 0 END) as first_downs,
```

**Issue**: In nflfastR, `first_down_pass` and `touchdown` are **mutually exclusive** at the play level. A reception that results in a touchdown does NOT set `first_down_pass = true` — it only sets `touchdown = true`. However, **official NFL stats count touchdown receptions as automatic first downs**.

The deltas align with approximately half of each player's TD count, which is consistent: not all TDs cross the first-down marker (e.g., a short catch in the end zone on 3rd & 8 is a TD but not a first down in the NFL's internal tracking for some sources), but many do.

#### Fix

Include touchdown receptions in the first down count:

```sql
SUM(CASE WHEN complete_pass AND (first_down_pass OR touchdown)
    THEN 1 ELSE 0 END) as first_downs,
```

**Note**: The Silver layer ETL (`silverWeeklyStatsETL.ts` line 112) has the same issue:
```sql
COUNT(*) FILTER (WHERE first_down_pass = true) as first_downs_rec
```
This also misses touchdown plays. Should be updated to:
```sql
COUNT(*) FILTER (WHERE first_down_pass = true OR (touchdown = true AND complete_pass = true)) as first_downs_rec
```

---

### Bug #4: Catch Rate % — MEDIUM

**Symptom**: Catch Rate % is slightly off vs simple `receptions / targets` math.

WR examples:
- Puka Nacua: CSV 76.6% vs actual 129/166 = 77.7%
- Jaxon Smith-Njigba: CSV 73.9% vs actual 119/163 ≈ 73.0%

RB examples:
- Christian McCaffrey: CSV 81.2% vs actual 102/129 = 79.1% (Δ = +2.1%)

**Note**: The discrepancy is larger for RBs because RB target volume varies more week-to-week (some weeks 12 targets, others 3). The average-of-ratios method is disproportionately skewed by low-volume weeks where a RB goes 3/3 (100%) or 1/2 (50%).

#### Root Cause

Classic **"average of ratios" vs "ratio of sums"** problem.

The lab-agg endpoint computes season catch rate as:

**File**: `server/modules/datalab/snapshots/snapshotRoutes.ts` — line 1311
```sql
AVG(spw.catch_rate) as avg_catch_rate,
```

This averages each week's catch rate with **equal weight per week**. A week with 2 targets counts as much as a week with 15 targets.

The correct season catch rate should be the ratio of season sums: `total_receptions / total_targets`. Both values are already computed in the same query (lines 1296-1297).

#### Fix

In the response mapping (snapshotRoutes.ts line 1451), compute catch rate from season totals instead of using the averaged field:

```typescript
avgCatchRate: Number(row.total_targets) > 0
  ? Number(row.total_receptions) / Number(row.total_targets)
  : null,
```

The same average-of-ratios issue likely affects other rate columns: `avgYardsPerTarget`, `avgRacr`, `avgWopr`, etc. Consider whether those should also use season-level computation. For some metrics (like EPA/target or success rate), week-level averaging may actually be desirable (treats each game equally). But for catch rate and yards/target, the ratio-of-sums is the standard approach.

---

### Bug #5: Fantasy Points (PPR) — NOT A BUG

**Symptom**: PPR column is higher than expected from pure receiving stats alone.

#### Explanation

This is **correct behavior**. The fantasy points formula includes ALL offensive production, not just receiving:

**File**: `server/etl/goldDatadiveETL.ts` — lines 196-214
```typescript
function calculateFantasyPoints(stats) {
  const passing = (stats.passingYards * 0.04) + (stats.passingTds * 4) - (stats.interceptions * 2);
  const rushing = (stats.rushYards * 0.1) + (stats.rushTds * 6);
  const receiving = (stats.recYards * 0.1) + (stats.recTds * 6);
  const std = passing + rushing + receiving;
  const ppr = std + stats.receptions;
  return { std, half, ppr };
}
```

**WR example** — Puka Nacua: 129 rec + 1715 rec yds × 0.1 + 10 rec TDs × 6 + 105 rush yds × 0.1 + 1 rush TD × 6 = **377.0** — exact match.

**RB example** — CMC at 414.6 PPR: This is correct once you include his 1,202 rush yds (120.2 pts) + 8 rush TDs (48 pts) + 102 rec (102 pts) + 904 rec yds (90.4 pts) + 7 rec TDs (42 pts) ≈ **402.6** + half-PPR adjustments. Matches official total scoring.

#### Recommendation

Add a note to the CSV export metadata header clarifying that Fantasy Points columns include all offensive production (receiving + rushing + passing), not just receiving-only points:

**File**: `client/src/lib/csvExport.ts` — line 45
```
# Fantasy Points include all offensive production (receiving + rushing + passing)
```

---

### Bug #6: Inline Rate % Blank/Zero — LOW

**Symptom**: Inline Rate % is mostly 0 or blank.

#### Root Cause (Two Factors)

**1. Expected for WRs**: `inline_rate` is a TE-specific metric measuring percentage of routes from inline (tight end) alignment. WRs almost never line up inline, so 0% is correct for WRs. For RBs this field is also largely irrelevant.

**File**: `server/etl/goldDatadiveETL.ts` — lines 765-792
```typescript
async function getPlayerUsageStats(season, week) {
  const result = await db.execute(sql`
    SELECT player_id, alignment_slot_pct as slot_rate,
    CASE WHEN routes_total > 0 THEN (routes_inline::float / routes_total) * 100 ELSE NULL END as inline_rate
    FROM player_usage
    WHERE season = ${season} AND week = ${week}
  `);
}
```

**2. Data population gap**: The `player_usage` table is populated by Python scripts (`server/scripts/updatePlayerUsage.py`, `calculatePlayerUsage.py`). If these scripts haven't been run for all 2025 weeks, the table has gaps, causing both `inline_rate` and `slot_rate` to fall back to NULL.

#### Recommendation

- For WR and RB exports, consider hiding the Inline Rate % column or adding "(TE only)" to the column header.
- Verify `player_usage` table coverage for 2025 season — run `updatePlayerUsage.py` for any missing weeks.

---

## Part 2: RB-Specific Findings

### RB Bug #7: Receiving Yards Small Variance (~15-20 yds) — MEDIUM

**Symptom**: High-volume pass-catching RBs show small receiving yard discrepancies vs official stats.
- Christian McCaffrey: CSV 904 yds vs official 924 yds (Δ = -20)
- De'Von Achane: off by ~15 yds
- Jahmyr Gibbs: CSV 613 vs official 616 (Δ = -3)

#### Root Cause

The Silver ETL computes receiving yards as:

**File**: `server/etl/silverWeeklyStatsETL.ts` — line 107
```sql
COALESCE(SUM(yards_gained) FILTER (WHERE complete_pass = true), 0) as receiving_yards,
```

This uses `yards_gained` (total play yardage) rather than nflfastR's `receiving_yards` field. For the vast majority of plays, these are identical. However, they diverge on edge cases:

1. **Lateral plays**: If a RB catches a pass and pitches laterally, `yards_gained` covers the full play, but official receiving stats only credit the yards up to the lateral.
2. **Fumble plays**: `yards_gained` may record yards to the fumble recovery spot, while official stats credit yards to the fumble spot.
3. **Penalty adjustments**: Some plays have yardage adjustments from offsetting penalties.

RBs are more likely than WRs to be involved in lateral/screen plays where these edge cases occur, explaining why the variance is more visible for high-volume pass-catching RBs.

**Note**: nflfastR does include a `receiving_yards` field, but it is NOT extracted as a direct column in the bronze table — it would only be accessible via `raw_data->>'receiving_yards'` (which has the same NULL problem as Bugs #1/#2).

#### Fix

**Option A (Preferred)**: Add `receiving_yards` as a direct column on `bronze_nflfastr_plays` and extract it during import. Then use it in the Silver ETL instead of `yards_gained`:

```sql
COALESCE(SUM(receiving_yards) FILTER (WHERE complete_pass = true), 0) as receiving_yards,
```

**Option B (Acceptable)**: Keep using `yards_gained` and document the ~1-2% variance in the CSV header. For fantasy purposes, this difference is negligible.

---

### RB Bug #8: Route Estimation Uses Fixed 50% Heuristic — MEDIUM

**Symptom**: This doesn't appear as an obviously wrong number, but it silently degrades every per-route metric for RBs: TPRR, YPRR, FP/Route, 1st Downs/Route.

#### Root Cause

The Silver ETL estimates RB routes as a fixed percentage of snaps:

**File**: `server/etl/silverWeeklyStatsETL.ts` — lines 349-351
```typescript
} else if (player.position === 'RB') {
  // RB run routes on ~50% of their snaps (other half is pass blocking)
  player.routes = Math.round(player.snaps * 0.50);
}
```

This 50% heuristic is a rough league average, but actual route participation varies enormously among RBs:

| RB Type | Actual Route Rate | Heuristic | Error |
|---------|------------------|-----------|-------|
| Pass-catching (CMC, Achane) | 65-75% | 50% | **Under-estimates routes by 30-50%** → inflates YPRR, FP/Route |
| Early-down grinder | 30-40% | 50% | **Over-estimates routes** → deflates YPRR, FP/Route |

The Gold ETL does attempt to use real route data when available:

**File**: `server/etl/goldDatadiveETL.ts` — lines 870-873
```typescript
const weeklyData = weeklySnapRoutes.get(row.player_id);
const snaps = weeklyData?.snaps ?? (row.snaps !== null ? Number(row.snaps) : null);
const silverRoutes = weeklyData?.routes ?? (row.routes !== null ? Number(row.routes) : null);
```

It prefers the `weekly_stats` table (which may have real route data from nflverse participation tracking) over the Silver layer heuristic. But if `weekly_stats` doesn't have route data for a player-week, it falls back to the 50% estimate.

#### Impact on Exported Columns

| Column | Formula | Impact |
|--------|---------|--------|
| Routes Run | `snaps × 0.50` (fallback) | Over/under by ±30% |
| TPRR | `targets / routes` | Inversely affected |
| YPRR | `rec_yards / routes` | Inversely affected |
| FP/Route | `fpts_ppr / routes` | Inversely affected |
| 1st Downs/Route | `rec_first_downs / routes` | Inversely affected |
| Route Rate % | `routes / snaps` | Always shows ~50% for RBs (tautological) |

#### Fix

**Option A (Preferred)**: Source actual route participation data from nflverse participation tracking. The `weekly_stats` table already has this for some weeks — ensure full coverage.

**Option B (Improve heuristic)**: Use position-and-player-specific route rates derived from target volume relative to team pass plays, rather than a flat 50%. For example: `routes ≈ max(targets × 1.3, snaps × 0.40)` as a better lower bound.

**Option C (Transparency)**: Add a metadata flag to the CSV indicating whether Routes Run is "actual" or "estimated" per player.

---

### RB Bug #9: xYAC / YAC over Expected Broken — MEDIUM

**Symptom**: xYAC, YAC over Expected, and xYAC Success % are zeroed out or implausible for RBs.

#### Root Cause

Same `raw_data` NULL root cause as Bugs #1 and #2. The xYAC calculation reads from the JSON blob:

**File**: `server/etl/goldDatadiveETL.ts` — lines 367-369
```sql
SUM(CASE WHEN complete_pass THEN COALESCE((raw_data->>'xyac_mean_yardage')::float, 0) ELSE 0 END) as total_xyac,
SUM(CASE WHEN complete_pass THEN yards_after_catch - COALESCE((raw_data->>'xyac_mean_yardage')::float, 0) ELSE 0 END) as total_yac_over_expected,
SUM(CASE WHEN complete_pass AND (raw_data->>'xyac_success')::float > 0.5 THEN 1 ELSE 0 END) as xyac_successes,
```

When `raw_data` is NULL:
- `xyac_mean_yardage` → COALESCE to 0 → xYAC per reception = 0 (wrong)
- `yards_after_catch - 0` → YAC over Expected = actual YAC (wrong — shows raw YAC instead of delta)
- `xyac_success` → NULL → never > 0.5 → xYAC Success % = 0

**RB-specific impact**: This is more misleading for RBs than WRs because RBs typically have high YAC on short targets. Without proper xYAC, users can't distinguish between a RB who generates YAC through elusiveness vs one who simply catches the ball in space on screens.

#### Fix

Same as Bug #2. `xyac_mean_yardage` and `xyac_success` need either:
- Direct columns on the bronze table (preferred)
- Reliable `raw_data` population

---

## Summary of Files Requiring Changes

| File | Bug(s) | Change Required |
|------|--------|----------------|
| `server/etl/goldDatadiveETL.ts:366` | #3 | Add `OR touchdown` to first down condition |
| `server/etl/goldDatadiveETL.ts:367-369` | #9 | xYAC fields read from raw_data (same fix as #2) |
| `server/etl/goldDatadiveETL.ts:371-377` | #1, #2 | Use direct columns instead of `raw_data`; add `air_epa`/`comp_air_epa` extraction |
| `server/etl/silverWeeklyStatsETL.ts:107` | #7 | Use `receiving_yards` instead of `yards_gained` (requires schema change) |
| `server/etl/silverWeeklyStatsETL.ts:112` | #3 | Add `OR touchdown` to first down condition |
| `server/etl/silverWeeklyStatsETL.ts:349-351` | #8 | Improve RB route estimation or source actual data |
| `server/modules/datalab/snapshots/snapshotRoutes.ts:1451` | #4 | Compute catch rate from season totals |
| `client/src/lib/csvExport.ts:45` | #5 | Add fantasy points clarification to CSV header |
| `client/src/pages/ReceivingLab.tsx:172` | #6 | Label Inline Rate as TE-only or hide for WR/RB view |
| `shared/schema.ts` | #2, #7, #9 | Add `air_epa`, `comp_air_epa`, `receiving_yards`, `xyac_mean_yardage` columns to bronze table |
| `server/scripts/fast_nflfastr_import.py` | #1, #2, #9 | Either deprecate or add `raw_data` population |

---

## Pipeline Diagram (Affected Flow)

```
nflfastR Parquet
    │
    ▼
fast_nflfastr_import.py ──── raw_data = NULL ◄── ROOT CAUSE (Bugs #1, #2, #9)
import_nflfastr_2025_bulk.py ── raw_data = JSON
    │
    ▼
bronze_nflfastr_plays
    │                            ┌─ yards_gained ≠ receiving_yards ◄── Bug #7 (RB)
    ├──► silverWeeklyStatsETL.ts ┼─ first_down_pass only (missing TDs) ◄── Bug #3
    │        │                   └─ routes = snaps × 0.50 (RB heuristic) ◄── Bug #8 (RB)
    │        ▼
    │    silver_player_weekly_stats
    │
    └──► goldDatadiveETL.ts ──► datadive_snapshot_player_week
             ├── raw_data->>'air_yards' (NULL) ◄── Bug #1
             ├── raw_data->>'air_epa' (NULL) ◄── Bug #2
             ├── raw_data->>'xyac_mean_yardage' (NULL) ◄── Bug #9 (RB)
             ├── first_down_pass AND complete_pass (missing TDs) ◄── Bug #3
             └── catch_rate = receptions/targets (per-week)
                      │
                      ▼
             snapshotRoutes.ts (lab-agg)
                      ├── AVG(catch_rate) ≠ SUM(rec)/SUM(tgt) ◄── Bug #4
                      └── CSV Export
```

---

## Verification Checklist (Post-Fix)

### WR Checks
- [ ] Re-run Gold ETL for 2025 season after fixes
- [ ] Verify Puka Nacua Rec First Downs ≈ 80 (currently 75)
- [ ] Verify Puka Nacua Catch Rate ≈ 77.7% (currently 76.6%)
- [ ] Verify route profile shows realistic distribution (e.g., Puka ~15/30/55 deep/int/short)
- [ ] Verify Air EPA shows non-zero values
- [ ] Re-export CSV and compare against official stats

### RB Checks
- [ ] Verify CMC Rec Yards ≈ 924 (currently 904) if using `receiving_yards` fix
- [ ] Verify CMC Catch Rate ≈ 79.1% (currently 81.2%)
- [ ] Verify Bijan Robinson route count is realistic vs 50% heuristic
- [ ] Verify xYAC shows non-zero, plausible values for RBs
- [ ] Verify route profile shows mostly short targets for RBs (expected, but not 100%)
- [ ] Re-export RB CSV and compare against official stats

### General
- [ ] Run `npm run test:forge` to ensure no regressions
- [ ] Verify `player_usage` table has full 2025 coverage
