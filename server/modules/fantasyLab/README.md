# Fantasy Lab Phase 1 Data Foundation

## Consolidated source

`fantasy_metrics_weekly_mv` is the Phase 1 consolidated materialized view that powers Fantasy Lab weekly tables.

### Base weekly opportunity + identity
- `datadive_snapshot_player_week`
- `datadive_snapshot_meta` (used to choose the latest snapshot per `season/week`)
- `player_identity_map` (optional player name fallback)

### Expected fantasy (xFP)
- `datadive_expected_fantasy_week`
- Surfaced xFP version: **`x_ppr_v2`** and **`xfpgoe_ppr_v2`**

### Market context (latest-known)
- `player_market_facts` (season-scoped latest fact row per player)
- `market_signals` (latest ADP / ownership signals)

## Notes on weekly vs latest fields

True weekly fields are sourced from `datadive_snapshot_player_week` and `datadive_expected_fantasy_week`.

Latest-known market fields are intentionally denormalized for Fantasy Lab table context:
- `adp_latest`
- `adp_rank_latest`
- `adp_source`
- `adp_stddev`
- `rostered_pct_latest`
- `ownership_trend`
- `market_week_reference`

These market values may come from the latest available market observation and may not match the exact `season/week` of weekly usage rows.

## FIRE Engine (Phase 2)

Rolling 4-week opportunity/role/conversion scoring for all skill positions.

### Supported positions
- **QB**: 2-pillar scoring (Opportunity via qb_xfp + Role via dropbacks/rush/inside-10). Conversion pillar pending.
- **RB/WR/TE**: 3-pillar scoring (Opportunity + Role + Conversion).

### QB per-game stats surfaced via `stats` object
`passAttPerGame`, `compPct`, `passYdsPerGame`, `passTdPerGame`, `intPerGame`, `rushAttPerGame`, `rushYdsPerGame`, `rushTdPerGame`

### Team totals pipeline
`team_weekly_totals_mv` aggregates team-level rush attempts, targets, snaps, and offensive plays per week from `silver_player_weekly_stats`. Key column: `team_off_plays = MAX(snaps)` provides the correct denominator for Snap%.

### API endpoints
- `GET /api/fire/eg/batch?season=&week=&position=` — batch FIRE scores
- `GET /api/fire/eg/player?season=&week=&playerId=` — single player FIRE

## Refresh strategy

- Admin endpoint: `POST /api/admin/fantasy-lab/refresh`
- Protection: `requireAdminAuth` middleware (`x-admin-api-key` / bearer)
- Action: `REFRESH MATERIALIZED VIEW fantasy_metrics_weekly_mv` + `REFRESH MATERIALIZED VIEW CONCURRENTLY team_weekly_totals_mv`
