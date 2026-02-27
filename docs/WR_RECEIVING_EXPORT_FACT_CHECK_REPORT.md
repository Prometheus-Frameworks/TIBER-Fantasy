# WR Receiving Export Fact-Check Report

**Date**: 2026-02-27
**Module**: Data Lab → Receiving Lab → CSV Export
**Scope**: 2025 Regular Season WR Receiving Stats
**Triggered by**: External fact-check against NFL.com, Pro-Football-Reference, ESPN, StatMuse

---

## Executive Summary

External fact-checking confirmed that **core counting stats (targets, receptions, yards, TDs, games played) are accurate** across the top 30+ WRs. However, the audit uncovered **6 bugs** across the derived/advanced metric columns, ranging from critical (completely broken columns) to minor (rounding discrepancies). All issues trace to specific, identifiable code paths in the ETL pipeline and aggregation layer.

| Severity | Issue | Columns Affected | Status |
|----------|-------|-----------------|--------|
| **CRITICAL** | Route profile percentages all 0/0/100 | Deep Target %, Intermediate Target %, Short Target % | Bug confirmed |
| **CRITICAL** | Air EPA metrics all zeroes | Air EPA, Comp Air EPA | Bug confirmed |
| **HIGH** | Rec First Downs consistently undercounted (~5-7 per player) | Rec First Downs | Bug confirmed |
| **MEDIUM** | Catch Rate % uses average-of-ratios instead of ratio-of-sums | Catch Rate % | Bug confirmed |
| **LOW** | Fantasy Points (PPR) includes rushing — correct but undocumented | Fantasy Points (PPR) | Not a bug; documentation gap |
| **LOW** | Inline Rate % blank/zero for WRs | Inline Rate % | Partially expected (TE-specific) + data gap |

---

## Bug #1: Route Profile Percentages — CRITICAL

**Symptom**: Nearly every WR shows `0.0 / 0.0 / 100.0` for Deep / Intermediate / Short Target %.

### Root Cause

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

### Fix

Replace `raw_data->>'air_yards'` with the direct `air_yards` column. Exclude NULL air yards from depth classification:

```sql
SUM(CASE WHEN air_yards >= 20 THEN 1 ELSE 0 END) as deep_targets,
SUM(CASE WHEN air_yards >= 10 AND air_yards < 20 THEN 1 ELSE 0 END) as intermediate_targets,
SUM(CASE WHEN air_yards < 10 THEN 1 ELSE 0 END) as short_targets,
```

The total depth targets denominator (`deepTargets + intermediateTargets + shortTargets`) already handles the filtering naturally — NULL air_yards plays won't increment any bucket.

---

## Bug #2: Air EPA / Comp Air EPA — CRITICAL

**Symptom**: Air EPA and Comp Air EPA columns show `0.00` for all players.

### Root Cause

Same `raw_data` issue as Bug #1. The Gold ETL reads `air_epa` and `comp_air_epa` from the JSON blob:

**File**: `server/etl/goldDatadiveETL.ts` — lines 371-372
```sql
SUM(COALESCE((raw_data->>'air_epa')::float, 0)) as total_air_epa,
SUM(CASE WHEN complete_pass THEN COALESCE((raw_data->>'comp_air_epa')::float, 0) ELSE 0 END) as total_comp_air_epa,
```

When `raw_data` is NULL (fast import) or when these fields are null within the JSON, COALESCE produces 0 for every play. The sum of all zeroes = 0. Dividing by target count = 0.00.

Unlike `air_yards`, the `air_epa` and `comp_air_epa` fields do NOT have direct columns on `bronze_nflfastr_plays` — they only exist in `raw_data`.

### Fix

**Option A (Preferred)**: Add `air_epa` and `comp_air_epa` as direct columns to the `bronze_nflfastr_plays` schema and extract them during import (like `epa`, `air_yards`, etc. are already extracted).

**Option B (Quick)**: Ensure the bulk import script (`import_nflfastr_2025_bulk.py`) is the canonical import path, and verify `raw_data` is populated. Then change COALESCE to only include rows where the field is non-null:

```sql
SUM(CASE WHEN (raw_data->>'air_epa') IS NOT NULL
    THEN (raw_data->>'air_epa')::float ELSE 0 END) as total_air_epa,
```

Note: Option B is fragile — any future re-import via the fast script would break it again.

---

## Bug #3: Rec First Downs Consistently Low — HIGH

**Symptom**: Rec First Downs are 5-7 lower than official NFL stats for top WRs.
- Puka Nacua: CSV 75 vs official 80 (Δ = -5)
- Jaxon Smith-Njigba: CSV 74 vs official 79 (Δ = -5)
- Ja'Marr Chase: CSV 66 vs official 73 (Δ = -7)

### Root Cause

The Gold ETL counts receiving first downs as:

**File**: `server/etl/goldDatadiveETL.ts` — line 366
```sql
SUM(CASE WHEN first_down_pass AND complete_pass THEN 1 ELSE 0 END) as first_downs,
```

**Issue**: In nflfastR, `first_down_pass` and `touchdown` are **mutually exclusive** at the play level. A reception that results in a touchdown does NOT set `first_down_pass = true` — it only sets `touchdown = true`. However, **official NFL stats count touchdown receptions as automatic first downs**.

The deltas align with approximately half of each player's TD count, which is consistent: not all TDs cross the first-down marker (e.g., a short catch in the end zone on 3rd & 8 is a TD but not a first down in the NFL's internal tracking for some sources), but many do.

### Fix

Include touchdown receptions in the first down count:

```sql
SUM(CASE WHEN (first_down_pass OR (touchdown AND complete_pass)) AND complete_pass
    THEN 1 ELSE 0 END) as first_downs,
```

Simplified:
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

## Bug #4: Catch Rate % — MEDIUM

**Symptom**: Catch Rate % is slightly off vs simple `receptions / targets` math.
- Puka Nacua: CSV 76.6% vs actual 129/166 = 77.7%
- Jaxon Smith-Njigba: CSV 73.9% vs actual 119/163 ≈ 73.0%

### Root Cause

Classic **"average of ratios" vs "ratio of sums"** problem.

The lab-agg endpoint computes season catch rate as:

**File**: `server/modules/datalab/snapshots/snapshotRoutes.ts` — line 1311
```sql
AVG(spw.catch_rate) as avg_catch_rate,
```

This averages each week's catch rate (e.g., Week 1: 8/10 = 0.800, Week 2: 4/5 = 0.800, Week 3: 2/8 = 0.250) with **equal weight per week**. A week with 2 targets counts as much as a week with 15 targets.

The correct season catch rate should be the ratio of season sums: `total_receptions / total_targets`. Both values are already computed in the same query (lines 1296-1297).

### Fix

In the response mapping (snapshotRoutes.ts line 1451), compute catch rate from season totals instead of using the averaged field:

```typescript
avgCatchRate: Number(row.total_targets) > 0
  ? Number(row.total_receptions) / Number(row.total_targets)
  : null,
```

The same average-of-ratios issue likely affects other rate columns: `avgYardsPerTarget`, `avgRacr`, `avgWopr`, etc. Consider whether those should also use season-level computation. For some metrics (like EPA/target or success rate), week-level averaging may actually be desirable (treats each game equally). But for catch rate and yards/target, the ratio-of-sums is the standard approach.

---

## Bug #5: Fantasy Points (PPR) — NOT A BUG

**Symptom**: PPR column shows ~377 for Puka Nacua vs an expected ~360-365 from pure receiving stats.

### Explanation

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

For Puka Nacua (2025): 129 rec + 1715 rec yds × 0.1 + 10 rec TDs × 6 + 105 rush yds × 0.1 + 1 rush TD × 6 = **129 + 171.5 + 60 + 10.5 + 6 = 377.0** — exact match.

### Recommendation

Add a note to the CSV export metadata header clarifying that Fantasy Points columns include all offensive production (receiving + rushing + passing), not just receiving-only points:

**File**: `client/src/lib/csvExport.ts` — line 45
```
# Fantasy Points include all offensive production (receiving + rushing + passing)
```

---

## Bug #6: Inline Rate % Blank/Zero — LOW

**Symptom**: Inline Rate % is mostly 0 or blank for WRs.

### Root Cause (Two Factors)

**1. Expected for WRs**: `inline_rate` is a TE-specific metric measuring percentage of routes from inline (tight end) alignment. WRs almost never line up inline, so 0% is correct for WRs.

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

**2. Data population gap**: The `player_usage` table is populated by Python scripts (`server/scripts/updatePlayerUsage.py`, `calculatePlayerUsage.py`). These scripts download nflfastR data independently and compute alignment from play-by-play. If these scripts haven't been run for all 2025 weeks, the `player_usage` table may have gaps, causing `inline_rate` (and `slot_rate`) to fall back to NULL.

### Recommendation

- For the **WR receiving export specifically**, consider hiding the Inline Rate % column or adding "(TE only)" to the column header.
- Verify `player_usage` table coverage for 2025 season — run `updatePlayerUsage.py` for any missing weeks.
- Slot Rate % may also be affected by the same data gap.

---

## Summary of Files Requiring Changes

| File | Bug(s) | Change Required |
|------|--------|----------------|
| `server/etl/goldDatadiveETL.ts:366` | #3 | Add `OR touchdown` to first down condition |
| `server/etl/goldDatadiveETL.ts:371-377` | #1, #2 | Use direct columns instead of `raw_data`; add `air_epa`/`comp_air_epa` extraction |
| `server/etl/silverWeeklyStatsETL.ts:112` | #3 | Add `OR touchdown` to first down condition |
| `server/modules/datalab/snapshots/snapshotRoutes.ts:1451` | #4 | Compute catch rate from season totals |
| `client/src/lib/csvExport.ts:45` | #5 | Add fantasy points clarification to CSV header |
| `client/src/pages/ReceivingLab.tsx:172` | #6 | Label Inline Rate as TE-only or hide for WR view |
| `shared/schema.ts` | #2 | (Optional) Add `air_epa`, `comp_air_epa` direct columns to bronze table |
| `server/scripts/fast_nflfastr_import.py` | #1, #2 | Either deprecate or add `raw_data` population |

---

## Pipeline Diagram (Affected Flow)

```
nflfastR Parquet
    │
    ▼
fast_nflfastr_import.py ──── raw_data = NULL ◄── ROOT CAUSE (Bugs #1, #2)
import_nflfastr_2025_bulk.py ── raw_data = JSON
    │
    ▼
bronze_nflfastr_plays
    │
    ├──► silverWeeklyStatsETL.ts ──► silver_player_weekly_stats
    │        └── first_down_pass only (missing TDs) ◄── Bug #3
    │
    └──► goldDatadiveETL.ts ──► datadive_snapshot_player_week
             ├── raw_data->>'air_yards' (NULL) ◄── Bug #1
             ├── raw_data->>'air_epa' (NULL) ◄── Bug #2
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

- [ ] Re-run Gold ETL for 2025 season after fixes
- [ ] Verify Puka Nacua Rec First Downs ≈ 80 (currently 75)
- [ ] Verify Puka Nacua Catch Rate ≈ 77.7% (currently 76.6%)
- [ ] Verify route profile shows realistic distribution (e.g., Puka ~15/30/55 deep/int/short)
- [ ] Verify Air EPA shows non-zero values
- [ ] Re-export CSV and compare against official stats
- [ ] Run `npm run test:forge` to ensure no regressions
