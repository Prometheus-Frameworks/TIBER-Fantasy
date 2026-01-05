# Progress Checkpoint - Routes/Snaps Implementation
**Date**: 2026-01-05
**Session**: ETL Pipeline - Routes and Snaps Metrics (COMPLETE)

## Completed

### 1. Routes/Snaps Silver Layer (COMMITTED: 3a63248f)
- Added `snaps` and `routes` columns to `silver_player_weekly_stats` schema
- Implemented position-based routes calculation (WR/TE: 85%, RB: 50%, QB: 0%)
- Successfully processed 5,033 player-weeks

### 2. Gold ETL Bug Fix
- Fixed `goldDatadiveETL.ts` to read snaps/routes from Silver layer
- Previously was re-computing from bronze (name matching failed)
- Changed lines 180-196 to use `row.snaps` and `row.routes`

### 3. Gold Snapshot Deduplication
- Deleted 10,109 duplicate records from `datadive_snapshot_player_week`
- Final count: 10,214 unique player-weeks

### 4. Weeks 14-17 Fix
- Ran `ingest-week.ts` for weeks 14-17 to populate `weekly_stats` with routes
- Triggered DatadiveSnapshotService to create new official snapshots:
  - Week 14: Snapshot 70 (407 rows, 232 with routes)
  - Week 15: Snapshot 71 (307 rows, 239 with routes)
  - Week 16: Snapshot 72 (325 rows, 260 with routes)
  - Week 17: Snapshot 73 (323 rows, 260 with routes)

### 5. Official Snapshots Configured
All 17 weeks now have official snapshots with routes data:

| Week | Snapshot ID | Rows | With Routes |
|------|-------------|------|-------------|
| 1    | 15          | 313  | 274         |
| 2    | 16          | 308  | 264         |
| 3    | 17          | 312  | 268         |
| 4    | 18          | 307  | 266         |
| 5    | 19          | 281  | 246         |
| 6    | 20          | 280  | 246         |
| 7    | 21          | 299  | 256         |
| 8    | 28          | 266  | 230         |
| 9    | 22          | 272  | 237         |
| 10   | 23          | 274  | 236         |
| 11   | 25          | 296  | 252         |
| 12   | 26          | 272  | 226         |
| 13   | 27          | 306  | 247         |
| 14   | 70          | 407  | 232         |
| 15   | 71          | 307  | 239         |
| 16   | 72          | 325  | 260         |
| 17   | 73          | 323  | 260         |

## Data Lab API Status

All endpoints working with routes/TPRR/YPRR data:
- `/api/data-lab/player-week` - Weekly player stats with routes metrics
- Routes coverage: ~75-85% of skill position players per week

### Sample Output (Week 14)
```
Zay Flowers          snaps=74  routes=51  tgt=11  TPRR=0.216  YPRR=2.43
A.J. Brown           snaps=69  routes=48  tgt=13  TPRR=0.271  YPRR=2.08
Ja'Marr Chase        snaps=60  routes=42  tgt= 8  TPRR=0.190  YPRR=1.05
```

## Architecture Notes

### Data Flow for Routes
1. `server/scripts/ingest-week.ts` - Fetches weekly stats from NFLfastR
2. `server/ingest/fetch-weekly.py` - Python script that:
   - Loads player stats from nflreadpy
   - Loads snap counts from nflreadpy
   - Calculates routes using position-specific rates (WR: 70%, TE: 55%, RB: 40%)
3. Data stored in `weekly_stats` table
4. `DatadiveSnapshotService.runWeeklySnapshot()` creates Gold snapshots
5. API reads from official snapshots via `/api/data-lab/*` routes

### Key Files
- `server/scripts/ingest-week.ts` - Weekly data ingestion script
- `server/ingest/fetch-weekly.py` - NFLfastR Python fetcher with routes calc
- `server/services/datadiveSnapshot.ts` - Snapshot service (creates Gold data)
- `server/routes/dataLabRoutes.ts` - Data Lab API endpoints
- `server/etl/goldDatadiveETL.ts` - Alternative Gold ETL (uses Silver layer)

## RB Metrics Added to Gold Layer (2026-01-05)

### New Columns in datadive_snapshot_player_week

**RB Rushing Efficiency:**
- `stuffed` - TFL count
- `stuff_rate` - TFL / rush_attempts
- `rush_first_downs` - First down rushes
- `rush_first_down_rate` - First downs / rush_attempts
- `rz_rush_attempts` - Red zone rush attempts

**RB Receiving Efficiency:**
- `yac_per_rec` - YAC / receptions
- `rec_first_downs` - First down receptions
- `first_downs_per_route` - First downs / routes
- `fpts_per_route` - PPR points / routes

### Sample RB Season Data (2025)
| Player | Rush Att | Stuff Rate | 1D Rate | YAC/Rec | FP/Route |
|--------|----------|------------|---------|---------|----------|
| J.Cook | 401 | 3.8% | 20.7% | 9.6 | 1.15 |
| D.Henry | 402 | 7.7% | 26.1% | 9.3 | 1.09 |
| D.Achane | 297 | 8.6% | 23.4% | 8.4 | 1.42 |

### Files Modified
- `shared/schema.ts` - Added new columns to datadiveSnapshotPlayerWeek
- `server/etl/goldDatadiveETL.ts` - Added play-by-play aggregation for RB metrics

## Next Steps (Future)

1. **Add QB/WR/TE Position Metrics** (same pattern as RB):
   - QB: CPOE, pressure rate, scramble rate
   - WR: separation, cushion (if available), contested catch rate
   - TE: inline vs slot snap %

2. **Improve snap/route coverage** (currently ~50-90% by week):
   - Add PFR IDs to `player_identity_map`
   - Implement fuzzy name matching for better snap count joins

3. **Note:** YACO, MTF, broken tackles are PFF proprietary - not available in NFLfastR
