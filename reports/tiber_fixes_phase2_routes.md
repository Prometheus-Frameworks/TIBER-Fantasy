# Tiber Fantasy — Phase 2 Fixes: Routes=0 Contamination Cleanup

**Date**: February 5, 2026
**Branch**: `fixes-opus-phase2-routes`
**Based on**: Phase 2 forensic investigation of routes=0 contamination

---

## (1) DATA CLEANUP — Keep only best snapshot per (season, week)

### Before: Contamination Metrics

**Snapshots per week** (season=2025):
| Week | Snapshots |
|------|-----------|
| 1 | 12 |
| 2 | 11 |
| 3-9 | 10 each |
| 10 | 11 |
| 11 | 12 |
| 12 | 10 |
| 13 | 11 |
| 14 | 11 |
| 15 | 10 |
| 16 | 11 |
| 17 | 2 |

**Routes=0 percentage** (WR/RB/TE only):
| Week | Total | Zero Routes | % Zero |
|------|-------|-------------|--------|
| 1 | 3,087 | 204 | 6.6% |
| 2 | 2,932 | 159 | 5.4% |
| 3-10 | ~2,260-2,574 | ~100-157 | 4.4-6.4% |
| **11** | **3,091** | **1,606** | **52.0%** |
| **12** | **2,406** | **1,371** | **57.0%** |
| **13** | **2,954** | **1,675** | **56.7%** |
| **14** | **2,816** | **1,213** | **43.1%** |
| **15** | **2,689** | **1,701** | **63.3%** |
| **16** | **2,839** | **1,766** | **62.2%** |
| 17 | 284 | 24 | 8.5% |

### SQL Executed

**Preview** — quality ranking of snapshots per week:
```sql
WITH snapshot_quality AS (
  SELECT week, snapshot_id,
    COUNT(*) as total_rows,
    SUM(CASE WHEN routes > 0 THEN 1 ELSE 0 END) as routes_populated,
    ROUND(100.0 * SUM(CASE WHEN routes > 0 THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 1) as route_pct
  FROM datadive_snapshot_player_week
  WHERE season = 2025
  GROUP BY week, snapshot_id
),
best_snapshots AS (
  SELECT DISTINCT ON (week) week, snapshot_id as keep_snapshot_id, route_pct, total_rows
  FROM snapshot_quality
  ORDER BY week, route_pct DESC, snapshot_id DESC
)
SELECT * FROM best_snapshots ORDER BY week;
```

Best snapshots selected: IDs 233-248 (Gold ETL snapshots) with 80-88% route population.

**Delete** — remove all non-best snapshots:
```sql
-- Same CTE as above, then:
DELETE FROM datadive_snapshot_player_week d
USING best_snapshots bs
WHERE d.season = 2025
  AND d.week = bs.week
  AND d.snapshot_id != bs.keep_snapshot_id;
```
**Result**: `DELETE 44000` — 44,000 stale rows removed.

### After: Validation

**Snapshots per week**: 1 for every week (1-17).

**Routes=0 percentage** (WR/RB/TE):
| Week | Total | Routes > 0 | Zero Routes | % Zero |
|------|-------|------------|-------------|--------|
| 1 | 279 | 271 | 8 | 2.9% |
| 2 | 267 | 262 | 5 | 1.9% |
| 3 | 271 | 268 | 3 | 1.1% |
| 4 | 268 | 266 | 2 | 0.7% |
| 5 | 247 | 244 | 3 | 1.2% |
| 6 | 247 | 241 | 6 | 2.4% |
| 7 | 258 | 252 | 6 | 2.3% |
| 8 | 232 | 228 | 4 | 1.7% |
| 9 | 240 | 234 | 6 | 2.5% |
| 10 | 242 | 235 | 7 | 2.9% |
| **11** | **258** | **250** | **8** | **3.1%** |
| **12** | **241** | **238** | **3** | **1.2%** |
| **13** | **269** | **263** | **6** | **2.2%** |
| **14** | **256** | **248** | **8** | **3.1%** |
| **15** | **269** | **257** | **12** | **4.5%** |
| **16** | **284** | **279** | **5** | **1.8%** |
| 17 | 284 | 260 | 24 | 8.5% |

**Week 11 WR spot check**: 96.6% routes > 0 (matches forensic report prediction).

---

## (2) CLEANUP META — Remove orphaned snapshot meta rows

**Before**: 245 meta rows, 17 referenced by weekly snapshots, 34 by season snapshots.

**SQL executed**:
```sql
DELETE FROM datadive_snapshot_meta
WHERE id NOT IN (
  SELECT DISTINCT snapshot_id FROM datadive_snapshot_player_week
)
AND id NOT IN (
  SELECT DISTINCT snapshot_id FROM datadive_snapshot_player_season
);
```
**Result**: `DELETE 195` — 195 orphaned meta rows removed.

**After**: 50 meta rows remaining. All referenced by either weekly or season snapshot tables.

Note: Initial attempt without the `datadive_snapshot_player_season` exclusion hit a FK constraint. Adjusted query to preserve meta rows referenced by the season table.

---

## (3) PREVENTION — Upsert guard in basic snapshot pipeline

**File**: `server/services/datadiveSnapshot.ts`
**Function**: `copyToSnapshotPlayerWeek()`

**Change**: Added delete-then-insert guard before the insert loop:
```typescript
// Upsert guard: remove existing rows for this season/week to prevent snapshot accumulation
const deleteResult = await db.execute(sql`
  DELETE FROM datadive_snapshot_player_week
  WHERE season = ${season} AND week = ${week}
`);
const deletedCount = (deleteResult as any).rowCount ?? 0;
if (deletedCount > 0) {
  console.log(`🧹 [DataDive Snapshot] Upsert guard: cleared ${deletedCount} existing rows for ${season} Week ${week}`);
}
```

This prevents multiple snapshots from accumulating for the same week, which was the root cause of the routes=0 contamination. Combined with the Phase 1 guard in `goldDatadiveETL.ts`, both ETL paths (basic snapshot + Gold ETL) are now protected.

---

## (4) OBSERVABILITY — Gold ETL failure logging

**File**: `server/services/datadiveSnapshot.ts`
**Function**: `runWeeklySnapshot()` catch block around `runGoldETLForWeek()`

**Before**:
```typescript
console.warn(`⚠️ [DataDive] Gold ETL failed (basic snapshot still valid):`, goldError);
```

**After**:
```typescript
const errMsg = goldError instanceof Error ? goldError.message : String(goldError);
const errStack = goldError instanceof Error ? goldError.stack : undefined;
console.error(`❌ [DataDive] Gold ETL FAILED for ${season} Week ${week}: ${errMsg}`);
if (errStack) console.error(`❌ [DataDive] Gold ETL stack trace:\n${errStack}`);
```

Still non-fatal (basic snapshot remains valid), but failures now log with `console.error`, include season/week context, and print the full stack trace.

---

## (5) FINAL VALIDATION

**Snapshots per week**: 1 for all 17 weeks (confirmed).

**Routes=0 for weeks 11-16**: 1.2-4.5% (down from 43-63%).

**Data Lab API** (`/api/data-lab/search?position=WR&season=2025&week=11`):
- Returns 200 with valid JSON
- 117 total WR results, 50 in first page
- 49/50 have routes > 0 (98%)
- Sample: Mi.Wilson routes=45, T.McMillan routes=48, G.Pickens routes=31

---

## Summary

| # | Task | Status | Impact |
|---|------|--------|--------|
| 1 | Snapshot cleanup | Done | 44,000 stale rows removed, 1 snapshot/week |
| 2 | Orphaned meta cleanup | Done | 195 orphaned meta rows removed |
| 3 | Basic snapshot upsert guard | Done | Prevents future accumulation |
| 4 | Gold ETL failure logging | Done | Failures now clearly visible |
| 5 | End-to-end validation | Done | All metrics nominal |

**Files modified**:
- `server/services/datadiveSnapshot.ts` (upsert guard + error logging)

**Blockers/Questions**: None. All five tasks completed and validated.
