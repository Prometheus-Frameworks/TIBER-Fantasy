# ETL Pipeline

Multi-layer data pipeline that ingests raw NFL data, cleans it, and enriches it for downstream analytics. Follows a Bronze → Silver → Gold medallion architecture.

## Architecture

```
External Sources (nflfastR, Sleeper, ECR)
        ↓
  [Bronze Layer] - Raw ingestion, minimal transformation
        ↓
  [Silver Layer] - Cleaned, standardized, joined
        ↓
  [Gold Layer]   - Enriched with derived metrics, fantasy scores
```

## Files

| File | Layer | Purpose |
|------|-------|---------|
| `CoreWeekIngest.ts` | Bronze→DB | Weekly data ingestion from NFL-Data-Py, ECR, Sleeper. Fetches stats via Python script, merges sources, computes advanced metrics, upserts to `player_week_facts` |
| `silverWeeklyStatsETL.ts` | Bronze→Silver | Transforms raw play-by-play and snap count data into `silver_player_weekly_stats`. Joins, dedupes, standardizes |
| `goldDatadiveETL.ts` | Silver→Gold | Enriches silver stats with position-specific metrics, fantasy points, derived analytics. Writes to `weekly_stats` |
| `nightlyBuysSellsUpdate.ts` | Gold | Nightly job computing market movement signals (buys/sells/holds) from trend data |

## Pipeline Flow

### CoreWeekIngest (primary weekly pipeline)
1. Fetch NFL stats via Python script (`server/scripts/fetchWeeklyStats.py`)
2. Fetch ECR rankings from `ecrService`
3. Fetch ADP data from Sleeper
4. Cross-reference and merge by name/position/team
5. Apply quality filters (active players, ≥50% rostered, valid team)
6. Compute advanced metrics (usage, talent, environment, market anchor, power score)
7. Upsert to `player_week_facts` with composite PK (playerId, season, week)

### Silver ETL
- Reads from `bronze_nflfastr_plays` and `bronze_nflfastr_snap_counts`
- Outputs to `silver_player_weekly_stats`

### Gold ETL
- Reads from `silver_player_weekly_stats`
- Applies enrichment boxes (`server/enrichment/`)
- Outputs to `weekly_stats`

## DB Tables

| Table | Layer | Description |
|-------|-------|-------------|
| `bronze_nflfastr_plays` | Bronze | Raw play-by-play data from nflfastR |
| `bronze_nflfastr_snap_counts` | Bronze | Raw snap count data |
| `silver_player_weekly_stats` | Silver | Cleaned weekly player stats |
| `weekly_stats` | Gold | Enriched stats with fantasy points and derived metrics |
| `player_week_facts` | Gold | Weekly player facts with power scores and market data |

## Common Tasks

- **Ingest a new week**: Call `CoreWeekIngestETL.ingestWeeklyData(week, season)`
- **Re-run silver transform**: Execute `silverWeeklyStatsETL` for target season/week range
- **Add a new data source**: Add fetch method to `CoreWeekIngest`, merge into `mergeDataSources()`
- **Modify quality filters**: Update `applyQualityFilters()` thresholds in `CoreWeekIngest.ts`
