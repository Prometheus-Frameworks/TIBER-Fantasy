# Data Lab / DataDive

Snapshot-based NFL data spine for reproducible analytics. Creates validated snapshots of player/team stats that FORGE and other systems consume. Each snapshot goes through staging → validation → promotion before becoming the official data source.

## Files

| File | Purpose |
|------|---------|
| `server/services/datadiveSnapshot.ts` | Core snapshot service. Creates/manages snapshots: staging population, validation (row counts ≥200, team counts ≥24, null checks, route coverage ≥80%), promotion to official. Calls `goldDatadiveETL` for enriched snapshots |
| `server/services/datadiveContext.ts` | Bridge between DataDive snapshots and FORGE. Key exports: `getCurrentSnapshot()`, `mapSnapshotRowToForgeInput()`, `getEnrichedPlayerWeek()`, `getDatadiveEligiblePlayers()`. Feature flag: `USE_DATADIVE_FORGE` |
| `server/services/datadiveAuto.ts` | Automated snapshot scheduling (cron-based) |
| `server/routes/dataLabRoutes.ts` | API routes mounted at `/api/data-lab/*` |
| `client/src/pages/TiberDataLab.tsx` | Frontend page at `/tiber-data-lab` |

## DB Tables

| Table | Purpose |
|-------|---------|
| `datadive_snapshot_meta` | Snapshot metadata: season, week, row/team counts, validation status, `is_official` flag |
| `datadive_snapshot_player_week` | Frozen weekly player stats per snapshot |
| `datadive_snapshot_player_season` | Aggregated season stats per snapshot |
| `datadive_player_week_staging` | Staging area cleared and repopulated before each snapshot |
| `datadive_player_season_staging` | Season aggregate staging |

## Data Flow

```
weekly_stats + silver_player_weekly_stats + bronze_nflfastr_snap_counts
        ↓
  [1] Clear staging for season/week
        ↓
  [2] Populate staging (merge weekly stats + snap counts + PBP advanced metrics + identity map)
        ↓
  [3] Validate staging (row count, team count, null checks)
        ↓
  [4] Create snapshot meta (mark existing official → non-official)
        ↓
  [5] Copy staging → datadive_snapshot_player_week
        ↓
  [6] Validate core metrics + route coverage (≥80% or demote)
        ↓
  [7] Build season aggregates → datadive_snapshot_player_season
        ↓
  [8] Run Gold ETL for enriched snapshot (optional, non-blocking)
        ↓
  [9] FORGE reads via datadiveContext.ts → getCurrentSnapshot() → getEnrichedPlayerWeek()
```

## API Endpoints

Routes at `/api/data-lab/*` — see `server/routes/dataLabRoutes.ts` for full list.

## Used By

| Consumer | How |
|----------|-----|
| FORGE | `datadiveContext.ts` → `getEnrichedPlayerWeek()`, `getDatadiveEligiblePlayers()` |
| ETL Gold Layer | `goldDatadiveETL` called during snapshot creation |
| Enrichment Boxes | Position-specific enrichment applied via `enrichByPosition()` |
