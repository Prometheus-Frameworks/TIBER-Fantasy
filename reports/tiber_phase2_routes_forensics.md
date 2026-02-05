# Tiber Phase 2: Routes=0 Forensic Investigation

**Date**: February 5, 2026  
**Investigator**: Tiber Agent  
**Status**: ROOT CAUSE CONFIRMED  

---

## Executive Summary

The `datadive_snapshot_player_week` Gold layer table exhibits 60-77% zero-routes rates for NFL weeks 11-17 and 17x row duplication in week 17. Root cause is a **dual-path ETL architecture** where the basic snapshot pipeline (`datadiveSnapshot.ts`) **lacks an upsert guard**, allowing stale snapshot rows to accumulate across multiple ETL runs. Early runs (Jan 5-8, 2025) executed before `weekly_stats` had routes populated for weeks 11+, producing "bad" snapshots with `routes=0`. Later runs (Jan 26+) produced healthy snapshots, but the old bad data was never cleaned up, poisoning aggregate queries.

**The fix is surgical**: delete all but the latest snapshot per (season, week) and add upsert guard to `copyToSnapshotPlayerWeek()`.

---

## 1. Symptom Recap

### 1.1 Routes=0 Degradation by Week

```sql
SELECT week, 
  COUNT(*) as total,
  SUM(CASE WHEN routes = 0 THEN 1 ELSE 0 END) as zero_routes,
  ROUND(100.0 * SUM(CASE WHEN routes = 0 THEN 1 ELSE 0 END) / COUNT(*), 1) as pct_zero
FROM datadive_snapshot_player_week
WHERE season = 2025 AND position IN ('WR','RB','TE')
GROUP BY week ORDER BY week;
```

| Week | Total Rows | Zero Routes | % Zero |
|------|-----------|-------------|--------|
| 1    | 1,337     | 188         | 14.1%  |
| 7    | 1,171     | 170         | 14.5%  |
| 11   | 1,339     | 877         | 65.5%  |
| 13   | 1,377     | 851         | 61.8%  |
| 16   | 1,318     | 871         | 66.1%  |
| 17   | 284       | 29          | 10.2%  |

**Pattern**: Weeks 1-10 show healthy ~14% zero-routes (expected for low-usage players). Weeks 11-17 jump to 60-77%. Week 17 is anomalous (only 2 snapshots vs 10-12 for other weeks).

### 1.2 Snapshot Accumulation Evidence

```sql
SELECT week, COUNT(DISTINCT snapshot_id) as num_snapshots,
  MIN(snapshot_id) as earliest, MAX(snapshot_id) as latest
FROM datadive_snapshot_player_week
WHERE season = 2025
GROUP BY week ORDER BY week;
```

| Week | Snapshots | Earliest ID | Latest ID |
|------|-----------|-------------|-----------|
| 1    | 10        | 49          | 233       |
| 7    | 10        | 55          | 239       |
| 11   | 12        | 59          | 243       |
| 16   | 11        | 62          | 248       |
| 17   | 2         | 73          | 81        |

**10-12 snapshots per week** when there should be exactly 1. Each batch ETL run created a new snapshot without cleaning old ones.

### 1.3 Temporal Proof: Old Snapshots Are Bad, Latest Are Good

```sql
-- Routes populated rate by snapshot age for Week 11 (WR only)
SELECT snapshot_id,
  COUNT(*) as total,
  SUM(CASE WHEN routes > 0 THEN 1 ELSE 0 END) as has_routes,
  ROUND(100.0 * SUM(CASE WHEN routes > 0 THEN 1 ELSE 0 END) / COUNT(*), 1) as pct
FROM datadive_snapshot_player_week
WHERE season = 2025 AND week = 11 AND position = 'WR'
GROUP BY snapshot_id ORDER BY snapshot_id;
```

| Snapshot ID | Total WRs | Has Routes | % With Routes |
|-------------|-----------|------------|---------------|
| 59 (Jan 5)  | 99        | 0          | **0.0%**      |
| 96 (Jan 6)  | 99        | 0          | **0.0%**      |
| 114 (Jan 7) | 99        | 0          | **0.0%**      |
| 131 (Jan 8) | 99        | 0          | **0.0%**      |
| 151 (Jan 26)| 117       | 113        | **96.6%**     |
| 159 (Jan 26)| 117       | 113        | **96.6%**     |
| 243 (latest)| 117       | 113        | **96.6%**     |

**Smoking gun**: Snapshots 49-131 (Jan 5-8) have **0% routes** for weeks 11+. Snapshots 151+ (Jan 26+) have **96-99% routes**. The `weekly_stats.routes` column was populated between Jan 8 and Jan 26.

---

## 2. Architecture Trace: Two ETL Code Paths

### 2.1 Path A: Basic Snapshot Pipeline (NO upsert guard)

**File**: `server/services/datadiveSnapshot.ts`  
**Entry point**: `DatadiveSnapshotService.runWeeklySnapshot()`  
**Triggered by**: Admin API `POST /api/datalab/admin/run`

```
weekly_stats → populateWeeklyStaging() → staging table
  → copyToSnapshotPlayerWeek() → datadive_snapshot_player_week
```

**Critical defect at line 537-598**: `copyToSnapshotPlayerWeek()` performs raw `INSERT` into `datadive_snapshot_player_week` with NO preceding `DELETE` for the same (season, week). Each invocation creates a new `snapshot_id` and appends rows.

```typescript
// server/services/datadiveSnapshot.ts:589-594
if (snapshotRows.length > 0) {
  const chunkSize = 100;
  for (let i = 0; i < snapshotRows.length; i += chunkSize) {
    const chunk = snapshotRows.slice(i, i + chunkSize);
    await db.insert(datadiveSnapshotPlayerWeek).values(chunk);  // NO DELETE BEFORE INSERT
  }
}
```

**Route sourcing (line 322)**:
```typescript
const routes = row.routes || 0;  // From weekly_stats.routes
```

Routes come directly from `weekly_stats.routes`. When this field was NULL/0 in early January for weeks 11+, all staging rows got `routes=0`.

### 2.2 Path B: Gold ETL Pipeline (HAS upsert guard)

**File**: `server/etl/goldDatadiveETL.ts`  
**Entry point**: `runGoldETLForWeek()` (line 1360)  
**Also triggered within** `runWeeklySnapshot()` at line 111

```
silver_player_weekly_stats + weekly_stats + bronze_nflfastr_plays
  → transformWeek() → DELETE WHERE season/week → INSERT → datadive_snapshot_player_week
```

**Upsert guard at line 1376-1384**:
```typescript
// Upsert guard: remove existing rows for this season/week to prevent duplicates
const deleteResult = await db.execute(sql`
  DELETE FROM datadive_snapshot_player_week
  WHERE season = ${season} AND week = ${week}
`);
```

This properly cleans up ALL prior rows for the target (season, week) before inserting.

### 2.3 Interaction Between Paths

When `runWeeklySnapshot()` is called (the admin route):
1. **Step 1**: Basic snapshot created via `copyToSnapshotPlayerWeek()` (no cleanup)
2. **Step 2**: `runGoldETLForWeek()` called (line 107-118) — DELETEs ALL rows for that (season, week) including the basic snapshot just created, then INSERTs enriched rows

**If Gold ETL succeeds**: Only Gold enriched snapshot survives (upsert guard cleaned everything).  
**If Gold ETL fails** (caught silently at line 115-117): Basic snapshot persists with potentially stale routes data.

**Historical accumulation**: Before the Gold ETL integration was added to `runWeeklySnapshot()`, each call to the admin route only ran the basic pipeline (Path A), accumulating snapshots without cleanup.

---

## 3. Upstream Data Integrity Verification

### 3.1 Silver Layer: HEALTHY

```sql
SELECT week, COUNT(*) as total,
  SUM(CASE WHEN routes > 0 THEN 1 ELSE 0 END) as has_routes,
  ROUND(100.0 * SUM(CASE WHEN routes > 0 THEN 1 ELSE 0 END) / COUNT(*), 1) as pct
FROM silver_player_weekly_stats
WHERE season = 2025 AND position IN ('WR','RB','TE')
GROUP BY week ORDER BY week;
```

All weeks 1-17 show **86-89% routes populated** in the silver layer. The silver data is clean.

### 3.2 weekly_stats: HEALTHY (current state)

```sql
SELECT week, COUNT(*) as total,
  SUM(CASE WHEN routes > 0 THEN 1 ELSE 0 END) as has_routes
FROM weekly_stats
WHERE season = 2025 AND position IN ('WR','RB','TE')
GROUP BY week ORDER BY week;
```

All weeks show healthy routes data. The `weekly_stats` table was backfilled between Jan 8-26 with routes data for weeks 11+.

### 3.3 Player ID Join: 100% Match

```sql
SELECT COUNT(*) as total_silver,
  SUM(CASE WHEN ws.player_id IS NOT NULL THEN 1 ELSE 0 END) as matched
FROM silver_player_weekly_stats s
LEFT JOIN weekly_stats ws ON s.player_id = ws.player_id 
  AND ws.season = 2025 AND ws.week = 11
WHERE s.season = 2025 AND s.week = 11;
-- Result: 294 total, 294 matched, 0 unmatched
```

GSIS ID-based joins are 100% successful. No identity resolution issues.

### 3.4 Latest Snapshots: ALL HEALTHY

```sql
WITH latest AS (
  SELECT week, MAX(snapshot_id) as sid
  FROM datadive_snapshot_player_week WHERE season = 2025
  GROUP BY week
)
SELECT d.week, ls.sid,
  COUNT(*) as total_wr,
  ROUND(100.0 * SUM(CASE WHEN d.routes > 0 THEN 1 ELSE 0 END) / COUNT(*), 1) as pct
FROM datadive_snapshot_player_week d
JOIN latest ls ON d.week = ls.week AND d.snapshot_id = ls.sid
WHERE d.season = 2025 AND d.position = 'WR'
GROUP BY d.week, ls.sid ORDER BY d.week;
```

| Week | Latest Snapshot | WR Count | % With Routes |
|------|----------------|----------|---------------|
| 1    | 233            | 128      | 97.7%         |
| 7    | 239            | 120      | 97.5%         |
| 11   | 243            | 117      | 96.6%         |
| 13   | 245            | 126      | 97.6%         |
| 16   | 248            | 128      | 98.4%         |

**All weeks 96-99% routes populated** in the latest snapshot. The surviving data after cleanup will be healthy.

---

## 4. Root Cause Summary

### Primary Cause: Snapshot Accumulation Without Cleanup

The `copyToSnapshotPlayerWeek()` function in `server/services/datadiveSnapshot.ts` (line 537) performs raw `INSERT` without first deleting existing rows for the same (season, week). Each ETL batch run (10+ runs between Jan 5 and late January) appended ~300 new rows per week, creating 10-12 overlapping snapshots.

### Secondary Cause: Temporal Data Gap

The `weekly_stats.routes` column was not populated for weeks 11-17 during the Jan 5-8 ETL runs. Routes data was backfilled between Jan 8 and Jan 26. The early snapshots captured `routes=0` for these weeks, and those stale rows were never cleaned up.

### Why Weeks 1-10 Are Healthy

The `weekly_stats` table had routes data for weeks 1-10 from the start. All 10-12 snapshots for these weeks contain valid routes, so even the aggregate (multi-snapshot) view shows ~14% zero rates (expected baseline for low-usage players).

### Why Week 17 Is Different

Week 17 has only 2 snapshots (IDs 73 and 81) compared to 10-12 for other weeks. This suggests week 17 data arrived later, after most batch runs had already completed for weeks 1-16.

---

## 5. Fix Plan

### Fix 1: Data Cleanup (Immediate)

Delete all but the best-quality snapshot per (season, week). Use route coverage as the quality criterion rather than purely MAX(snapshot_id), to guard against a scenario where the latest run was partial or failed.

```sql
-- Step 1: Find the best snapshot per week (highest route coverage, break ties by latest ID)
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
-- Step 2: Delete non-best rows
DELETE FROM datadive_snapshot_player_week d
USING best_snapshots bs
WHERE d.season = 2025 
  AND d.week = bs.week 
  AND d.snapshot_id != bs.keep_snapshot_id;
```

**Expected impact**: ~85% row reduction. Surviving rows will have 96-99% routes populated.

**Note**: In this case, MAX(snapshot_id) and best route coverage converge to the same snapshots (verified above), but the quality-based approach is safer for production.

### Fix 2: Add Upsert Guard to Basic Snapshot Pipeline (Prevention)

Add a `DELETE WHERE season AND week` before the `INSERT` in `copyToSnapshotPlayerWeek()`:

```typescript
// server/services/datadiveSnapshot.ts, before line 589
// Upsert guard: remove existing basic snapshot rows for this season/week
await db.execute(sql`
  DELETE FROM datadive_snapshot_player_week
  WHERE season = ${season} AND week = ${week}
`);
```

This mirrors the existing guard in `runGoldETLForWeek()` (goldDatadiveETL.ts line 1376).

### Fix 3: Surface Gold ETL Failures (Observability)

The current `runWeeklySnapshot()` silently catches Gold ETL failures (line 115-117), allowing bad basic snapshots to persist. Upgrade the error handling to log warnings and include failure status in the snapshot response:

```typescript
// server/services/datadiveSnapshot.ts, lines 115-117
} catch (goldError) {
  console.error(`🚨 [DataDive] Gold ETL FAILED for ${season} Week ${week}:`, goldError);
  // TODO: Add alerting/monitoring hook here
}
```

### Fix 4: Clean Up Orphaned Snapshot Meta Records

After deleting stale snapshot data rows, clean up the corresponding `datadive_snapshot_meta` records that no longer have any data rows.

```sql
DELETE FROM datadive_snapshot_meta
WHERE id NOT IN (
  SELECT DISTINCT snapshot_id FROM datadive_snapshot_player_week
);
```

### Fix 5: Verify Week 17 Data Completeness and Re-Run if Needed

Week 17 has only 2 snapshots and 284 total rows vs 1,300+ for other weeks. Verify whether a full Gold ETL re-run is needed:

```sql
SELECT position, COUNT(*) 
FROM datadive_snapshot_player_week 
WHERE season = 2025 AND week = 17 
  AND snapshot_id = (SELECT MAX(snapshot_id) FROM datadive_snapshot_player_week WHERE season = 2025 AND week = 17)
GROUP BY position;
```

If row counts are significantly lower than other weeks, re-run `runGoldETLForWeek(2025, 17)` to regenerate from current healthy source data.

---

## 6. Hypothesis Ranking (Investigated)

| # | Hypothesis | Status | Evidence |
|---|-----------|--------|----------|
| 1 | Snapshot accumulation without cleanup | **CONFIRMED** | 10-12 snapshots/week, `copyToSnapshotPlayerWeek()` has no DELETE |
| 2 | Temporal routes data gap in weekly_stats | **CONFIRMED** | Jan 5-8 snapshots have 0% routes for weeks 11+; Jan 26+ have 96%+ |
| 3 | Player ID join failure | **RULED OUT** | 100% match rate between silver and weekly_stats |
| 4 | Silver layer data corruption | **RULED OUT** | 86-89% routes populated across all weeks |
| 5 | Bronze/play-by-play data gap | **RULED OUT** | Gold ETL uses silver+PBP, latest snapshots are healthy |

---

## 7. Files Referenced

| File | Relevance |
|------|-----------|
| `server/services/datadiveSnapshot.ts` | Basic snapshot pipeline; `copyToSnapshotPlayerWeek()` lacks upsert guard (line 537) |
| `server/etl/goldDatadiveETL.ts` | Gold ETL pipeline; `runGoldETLForWeek()` HAS upsert guard (line 1376) |
| `server/services/datadiveAuto.ts` | Auto-run orchestration; calls `runWeeklySnapshot()` |
| `server/routes/dataLabRoutes.ts` | Admin API routes; `/admin/run` triggers basic pipeline |
| `shared/schema.ts` | Table definitions for `datadive_snapshot_player_week` and related |

---

## Appendix: Data Quality After Proposed Cleanup

After executing Fix 1, the expected state per week:

| Week | Snapshot | WRs | RBs | TEs | Routes Coverage |
|------|----------|-----|-----|-----|-----------------|
| 1    | 233      | 128 | ~70 | ~40 | 97-98%          |
| 7    | 239      | 120 | ~65 | ~38 | 97-98%          |
| 11   | 243      | 117 | ~65 | ~35 | 96-97%          |
| 13   | 245      | 126 | ~68 | ~38 | 97-98%          |
| 16   | 248      | 128 | ~70 | ~40 | 98%             |

All weeks will show consistent 96-99% routes coverage, eliminating the current degradation.
