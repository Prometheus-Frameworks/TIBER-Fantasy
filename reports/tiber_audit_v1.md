# Tiber Fantasy System Audit v1
**Date**: February 5, 2026
**Scope**: Full-stack health check — Boot, Database, API, Data Lab, Data Quality

---

## 1. BOOT & INFRASTRUCTURE

**Status**: HEALTHY

- Server starts cleanly on port 5000 (Express + Vite)
- PostgreSQL connection established via `DATABASE_URL`
- 47 route groups mounted at boot (confirmed via boot log)
- FORGE scoring pipeline auto-fires on startup (scoring 20+ players per batch)
- No crash-level errors in boot log
- Vite HMR connects without issues
- One DOM nesting warning in browser console (`<a>` nested inside `<a>` in PlaybookTab.tsx:1096)

**Boot Route Mounts**:
```
/api/ownership/*          /api/tiber-memory
/api/data-lab/*           /api/forge/simulation/*
/api/predictions/*        /api/ecr/*
/api/ovr/*                /api/tiber/*
/api/game-logs/*          /api/consensus/*
/api/strategy/*           /api/matchup/*
/api/weekly-takes/*       /api/player-compare-pilot/*
/api/analytics/*          /api/team-reports/*
/api/players/*            /api/admin/player-mapping/*
/api/role-bank/*          /api/debug/week-summary
/api/dvp/*                /api/sync/sleeper-identity/*
/api/player-comparison/*  /api/waivers/*
/api/forge/*              /api/start-sit-live
/api/system/current-week  /api/system/feature-audit
```

---

## 2. DATABASE INVENTORY

**Total Tables**: 141
**Populated (>0 rows)**: 97
**Empty (0 rows)**: 44

### Core Pipeline Tables (by size)
| Table | Rows | Purpose |
|-------|------|---------|
| data_lineage | 238,339 | ETL provenance tracking |
| player_identity_map | 163,792 | Cross-platform player resolution |
| bronze_nflfastr_plays | 93,308 | Raw play-by-play (Bronze layer) |
| quality_gate_results | 83,136 | Data validation results |
| datadive_snapshot_player_week | 54,210 | Gold layer weekly snapshots |
| bronze_nflfastr_snap_counts | 23,919 | Raw snap count data |
| player_inputs | 16,932 | Player input data |
| datadive_snapshot_player_season | 15,744 | Gold layer season aggregates |
| weekly_stats | 10,357 | Weekly stat summaries |
| player_usage | 8,335 | Player usage tracking |
| silver_player_weekly_stats | 5,033 | Silver layer weekly stats |

### Key Supporting Tables
| Table | Rows | Purpose |
|-------|------|---------|
| wr_role_bank | 662 | WR analytical classifications |
| rb_role_bank | 290 | RB analytical classifications |
| te_role_bank | 165 | TE analytical classifications |
| qb_role_bank | 88 | QB analytical classifications |
| qb_context_2025 | 32 | QB context scores per team |
| schedule | 531 | NFL game schedule |
| defense_dvp | 3,726 | Defense vs Position data |
| forge_player_state | 169 | FORGE player states |

### Empty Tables of Note (0 rows)
These tables have schema defined but no data:
- `sos_scores` — Strength of Schedule (referenced by FORGE engine)
- `rookie_context_signals`, `rookie_riser_snapshots`, `rookie_weekly_usage` — Rookie pipeline
- `consensus_ranks`, `consensus_explanations` — TIBER Consensus v2
- `market_data`, `market_signals`, `market_rollups` — Market analytics
- `player_value_history` — Dynasty value tracking
- `trade_analysis`, `dynasty_trade_history` — Trade system

---

## 3. API SMOKE TEST RESULTS

### Working Endpoints (200 + JSON)
| Endpoint | Response Shape |
|----------|---------------|
| `/api/data-lab/meta/current` | `{snapshotId, season, week, availableWeeks}` |
| `/api/data-lab/search?position=WR&season=2025&week=7` | `{snapshotId, total, data[]}` |
| `/api/data-lab/player-week?position=WR&week=7&season=2025` | `{count, data[], season, week}` |
| `/api/forge/batch?position=ALL&limit=5` | `{success, scores[], meta}` |
| `/api/forge/eg/batch?position=WR&mode=redraft` | `{success, scores[], meta}` |
| `/api/forge/opportunity-shifts` | `{success, shifts[]}` |
| `/api/system/current-week` | `{currentWeek, season, weekStatus, ...}` |
| `/api/system/feature-audit` | `{success, data}` |
| `/api/ovr` | `{success, data[], meta}` |
| `/api/role-bank/wr/2025` | `{count, results[], position, season}` |
| `/api/role-bank/rb/2025` | `{count, results[], position, season}` |
| `/api/role-bank/qb/2025` | `{count, results[], position, season}` |
| `/api/role-bank/te/2025` | `{count, results[], position, season}` |
| `/api/weekly-takes` | `{success, data[]}` |
| `/api/waivers/recommendations` | `{success, data[], week, season}` |
| `/api/ecr/weekly` | `{count, rows[], week}` |
| `/api/ecr/dynasty` | `{count, rows[], snapshot}` |
| `/api/ecr/enhanced/weekly` | `{success, count, features}` |
| `/api/predictions/latest/players` | `{success, count, data[]}` |
| `/api/playbook` | `{success, count, entries[]}` |

### Error Responses (Expected — need params)
| Endpoint | Status | Error |
|----------|--------|-------|
| `/api/data-lab/player-season` | 400 | Missing `player_id` and `season` |
| `/api/data-lab/team-week` | 400 | Missing required params |
| `/api/strategy/start-sit` | 400 | `Week parameter required` |
| `/api/consensus/board` | 400 | `invalid kind` (needs `?format=dynasty`) |
| `/api/debug/week-summary` | 400 | Missing `season, week, pos` |

### Broken Endpoints
| Endpoint | Status | Issue |
|----------|--------|-------|
| `/api/ovr/tiers` | 500 | `Failed to fetch player OVR` — server-side error |
| `/api/predictions/latest/summary` | 404 | No prediction summary found |

### HTML Fallthrough Endpoints (Route Mismatch — Return SPA HTML Instead of JSON)
These return 200 with HTML because Express doesn't match the route, so Vite's SPA fallback serves the React app.

| Attempted Path | Actual Route | Fix |
|----------------|-------------|-----|
| `/api/dvp/rankings` | `/api/dvp` (GET) | Remove `/rankings` suffix |
| `/api/tiber/scores` | `/api/tiber/week/:week` (GET) | Need week param |
| `/api/game-logs/search` | `/api/game-logs/:playerId/latest` | Use playerId path param |
| `/api/analytics/health` | `/api/analytics/` (GET) | Route exists at root |
| `/api/matchup/matchup` | `/api/matchup/player/:playerId` | Use correct path with playerId |
| `/api/player-comparison/compare/x/y` | POST `/api/player-comparison/compare` | Wrong HTTP method (POST not GET) |
| `/api/start-sit-live` | Dynamically loaded | May have failed to load module |
| `/api/ownership/stats` | No stats sub-route | Only root ownership endpoint |
| `/api/tiber-memory` | Mounted at `/api/tiber-memory` as page | Route may be page-only |

---

## 4. DATA LAB PAGE DIAGNOSTICS

### Frontend API Calls (TiberDataLab.tsx)
The Data Lab page makes 3 API calls:
1. **`/api/data-lab/meta/current`** — Gets current snapshot metadata (week, season, available weeks)
2. **`/api/data-lab/search`** — Fetches player-week data with filters (position, week, search query, min routes)
3. **`/api/data-lab/usage-agg`** — Aggregated usage data with week range support

### API Health
| Call | Status | Notes |
|------|--------|-------|
| meta/current | WORKING | Returns snapshot metadata correctly |
| search | WORKING | Returns player data with 120 WR results for week 7 |
| usage-agg | PARTIALLY BROKEN | Requires `week` param even for `viewMode=season`, confusing API contract |

### Data Lab Backend Routes (dataLabRoutes.ts)
14 routes registered:
- `GET /meta/current` — Snapshot metadata
- `GET /player-week` — Individual player weekly data
- `GET /player-season` — Player season data (needs player_id)
- `GET /team-week` — Team weekly data
- `GET /search` — Full-text player search with filters
- `GET /usage-agg` — Aggregated usage data
- `GET /health` — Health check
- `GET /fantasy-logs` — Fantasy log data
- `GET /dst-streamer` — DST streaming recommendations
- `GET /xfpts/player` — Expected fantasy points
- `POST /admin/run` — Manual ETL trigger
- `POST /admin/auto-run` — Auto ETL trigger
- `GET /admin/auto-status` — Auto ETL status
- `POST /admin/xfpts-run` — xFPTS ETL trigger

### Frontend Column Display
The Data Lab table view displays ~14 columns from the 113-column `datadive_snapshot_player_week` table. The full schema contains extensive metrics including:
- Core stats: passing, rushing, receiving yards/TDs
- Advanced: target_share, air_yards_share, red_zone_targets
- QB-specific: sack_yards, dropbacks, any_a, fp_per_dropback
- Efficiency: yards_per_route_run, EPA metrics
- Position context: snap_share, route_participation

---

## 5. DATA QUALITY CRITICAL ISSUES

### Issue 1: Weeks 11-17 Massive Routes=0 Problem
Skill position players (WR, RB, TE) have severely degraded data from week 11 onward.

| Week | Total Players | Zero Routes | % Zero |
|------|--------------|-------------|--------|
| 1 | 3,087 | 221 | 7.2% |
| 2 | 2,932 | 175 | 6.0% |
| 3-10 | ~2,400-2,700 | ~130-170 | 5-7% |
| **11** | **3,091** | **1,859** | **60.1%** |
| **12** | **2,406** | **1,591** | **66.1%** |
| **13** | **2,954** | **1,939** | **65.6%** |
| **14** | **2,816** | **1,213** | **43.1%** |
| **15** | **2,689** | **1,701** | **63.3%** |
| **16** | **2,839** | **1,766** | **62.2%** |
| **17** | **4,828** | **3,754** | **77.8%** |

**Root Cause Hypothesis**: The NFLfastR → Silver → Gold ETL pipeline stopped properly ingesting route participation data after week 10. The `routes` column is populated from snap count / play-by-play data. Either the source parquet files changed format, or the ETL join logic broke.

**Impact**: FORGE grading relies on route participation for WR/TE context scores. Any player with routes=0 gets incorrect FORGE evaluations for weeks 11-17.

### Issue 2: Week 17 Massive Duplication (17x per player)
Week 17 has 17 copies of every player row in `datadive_snapshot_player_week`.

| Week | Player ID | Copies |
|------|-----------|--------|
| 17 | 00-0038544 | 17 |
| 17 | 00-0040078 | 17 |
| 17 | 00-0032464 | 17 |
| 17 | 00-0040782 | 17 |
| 17 | 00-0040184 | 17 |

**Root Cause**: The Gold ETL (goldDatadiveETL.ts) was likely run 17 times for week 17 without proper upsert/dedup logic. Each run inserted new rows instead of replacing existing ones.

**Impact**: Week 17 shows 4,828 total player rows (expected ~284). This inflates any aggregation or season-level stat that includes week 17 by ~17x.

### Issue 3: FORGE Alpha Score Compression
Multiple QBs (Drake Maye, Matthew Stafford, Patrick Mahomes, Dak Prescott) are hitting the alpha calibration ceiling:
```
⚠️ Very high alpha for QB: raw=65.6 > p90=48, calibrated=100.0
```

Nearly all top-10 RBs also max out at Alpha=100. This means the grading system lacks differentiation among elite players. The p90 thresholds appear too low for season-cumulative data.

---

## 6. TOP 10 BREAKPOINTS (Priority Order)

### Critical (Blocks Analytics Accuracy)
1. **Week 17 Duplicates** — 17x row inflation. Fix: Deduplicate with `DELETE FROM datadive_snapshot_player_week WHERE id NOT IN (SELECT MIN(id) FROM datadive_snapshot_player_week WHERE season=2025 AND week=17 GROUP BY player_id)`
2. **Weeks 11-17 Routes=0** — 60-77% zero routes. Fix: Re-run ETL for weeks 11-17 with proper snap count joins, or audit the silver layer source data for those weeks.
3. **FORGE Alpha Ceiling Compression** — No differentiation at top. Fix: Raise p90 thresholds or apply position-specific ceiling curves.

### High (Broken Features)
4. **`/api/ovr/tiers` 500 Error** — Server crash when fetching OVR tiers. Needs debugging in OVR route handler.
5. **10 HTML Fallthrough Routes** — API calls returning HTML instead of JSON because route paths don't match registered handlers. See Section 3 table for fixes.
6. **`usage-agg` Confusing API Contract** — Requires `week` param even in `viewMode=season`. Frontend must send week even when user wants season-wide aggregation.

### Medium (Technical Debt)
7. **44 Empty Tables** — Tables like `sos_scores`, `consensus_ranks`, `market_data` have schema but zero data. Either populate or remove to reduce schema bloat.
8. **Gold ETL Hanging on Large Queries** — `goldDatadiveETL.ts` hangs on QB play-by-play aggregation. Needs query optimization or chunking.
9. **DOM Nesting Warning** — `<a>` nested inside `<a>` in PlaybookTab.tsx:1096. Minor but causes React warnings in console.
10. **Data Lab Shows 14 of 113 Columns** — The Gold layer has rich data but the UI only surfaces a fraction. Future enhancement to add column picker or expandable detail view.

---

## 7. RECOMMENDED MINIMAL PATCHES

### Patch 1: Deduplicate Week 17 (SQL-only, ~1 min)
```sql
-- Remove duplicate rows, keeping the first inserted row per player per week
DELETE FROM datadive_snapshot_player_week
WHERE id NOT IN (
  SELECT MIN(id) 
  FROM datadive_snapshot_player_week 
  WHERE season = 2025 AND week = 17
  GROUP BY player_id
)
AND season = 2025 AND week = 17;
```

### Patch 2: Add Upsert Guard to Gold ETL (Code change)
In `goldDatadiveETL.ts`, before inserting new rows, add a check:
```typescript
// Before batch insert, delete existing rows for this week
await db.delete(datadiveSnapshotPlayerWeek)
  .where(and(
    eq(datadiveSnapshotPlayerWeek.season, season),
    eq(datadiveSnapshotPlayerWeek.week, week)
  ));
```
This prevents future duplicate insertions.

### Patch 3: Fix /api/ovr/tiers 500 Error (Code change)
Locate the error handler in the OVR tiers endpoint and add proper error logging + graceful fallback. The 500 suggests an unhandled null reference or missing data dependency.

---

## 8. SYSTEM HEALTH SUMMARY

| Category | Status | Score |
|----------|--------|-------|
| Boot/Infrastructure | Healthy | 9/10 |
| Database Schema | Good (but 44 empty tables) | 7/10 |
| API Endpoints | Partially Broken (10 HTML fallthroughs, 2 errors) | 6/10 |
| Data Lab Feature | Working (3/3 frontend calls succeed) | 8/10 |
| Data Quality | Critical Issues (weeks 11-17) | 3/10 |
| FORGE Scoring | Working but compressed | 6/10 |

**Overall System Health: 6.5/10**

The platform boots and runs, the Data Lab works for weeks 1-10, FORGE scores players, and the core API is functional. However, the data quality issues in weeks 11-17 significantly undermine analytics accuracy, and the route mismatches prevent several features from being API-accessible.

---

*End of Audit v1*
