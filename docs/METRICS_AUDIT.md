# NFLfastR Metrics Audit
**Date**: 2026-01-05

## Available Data Sources

### 1. bronze_nflfastr_plays (Play-by-Play)
372 fields in raw_data JSONB. Key fields for fantasy:

#### Rushing Metrics
| Metric | Field | Status |
|--------|-------|--------|
| Rush attempts | `play_type = 'run'` | Available |
| Rush yards | `yards_gained` | Available |
| YPC | calculated | Available |
| Rush TDs | `touchdown` | Available |
| First downs | `first_down_rush` | Available |
| Stuffed (TFL) | `raw_data->>'tackled_for_loss'` | Available |
| Stuff rate | calculated | Can calculate |
| EPA per rush | `epa` | Available |
| Run gap | `raw_data->>'run_gap'` | Available (tackle/guard/end) |
| Run location | `raw_data->>'run_location'` | Available (left/middle/right) |
| Shotgun runs | `raw_data->>'shotgun'` | Available |
| QB scramble | `raw_data->>'qb_scramble'` | Available |
| Red zone rush | `raw_data->>'yardline_100' <= 20` | Available |
| Goal line rush | `raw_data->>'yardline_100' <= 5` | Available |

#### Receiving Metrics
| Metric | Field | Status |
|--------|-------|--------|
| Targets | target plays | Available |
| Receptions | `complete_pass` | Available |
| Rec yards | `yards_gained` | Available |
| Rec TDs | `touchdown` | Available |
| YAC | `yards_after_catch` | Available |
| YAC/rec | calculated | Can calculate |
| Air yards | `air_yards` | Available |
| ADOT | calculated | Can calculate |
| First downs (rec) | `first_down_pass` | Available |
| EPA per target | `epa` | Available |
| xyac_epa | `raw_data->>'xyac_epa'` | Available |
| xyac_fd | `raw_data->>'xyac_fd'` | Available |

### 2. bronze_nflfastr_snap_counts
| Field | Status |
|-------|--------|
| offense_snaps | Available |
| offense_pct | Available |
| defense_snaps | Available |
| st_snaps | Available |

### 3. player_usage (Weeks 1-11 populated)
| Metric | Field | Status |
|--------|-------|--------|
| Routes total | `routes_total` | Available |
| Routes outside | `routes_outside` | Available |
| Routes slot | `routes_slot` | Available |
| Routes inline | `routes_inline` | Available |
| Alignment outside % | `alignment_outside_pct` | Available |
| Alignment slot % | `alignment_slot_pct` | Available |
| Carries gap | `carries_gap` | Available |
| Carries zone | `carries_zone` | Available |
| Target share % | `target_share_pct` | Available |

## Metrics to Add to Silver/Gold Layer

### Priority 1: RB Rushing Efficiency
```sql
-- Stuffed rate (TFL%)
SUM(CASE WHEN tackled_for_loss THEN 1 ELSE 0 END) / rush_attempts

-- First down rate
SUM(CASE WHEN first_down_rush THEN 1 ELSE 0 END) / rush_attempts

-- Red zone rush share
rz_rushes / team_rz_rushes
```

### Priority 2: RB Receiving
```sql
-- YAC per reception
total_yac / receptions

-- First downs per route (1D/RR)
first_down_pass / routes

-- Fantasy points per route (FP/RR)
fantasy_points / routes
```

### Priority 3: Advanced Context
```sql
-- Run gap breakdown (gap%, zone%)
-- Shotgun vs under center efficiency
-- Red zone opportunity share
```

## NOT Available in NFLfastR

| Metric | Note |
|--------|------|
| Yards After Contact (YACO) | PFF proprietary |
| Missed Tackles Forced (MTF) | PFF proprietary |
| Broken Tackles | PFF proprietary |
| Elusive Rating | PFF proprietary |
| True Catch Rate | PFF/NextGen Stats |
| Separation | NextGen Stats |
| Cushion | NextGen Stats |

## Sample Aggregation Query

```sql
SELECT
  rusher_player_name,
  COUNT(*) as rush_att,
  SUM(yards_gained) as rush_yards,
  ROUND(SUM(yards_gained)::numeric / COUNT(*), 2) as ypc,
  SUM(CASE WHEN tackled_for_loss THEN 1 ELSE 0 END) as stuffed,
  ROUND(100.0 * SUM(CASE WHEN tackled_for_loss THEN 1 ELSE 0 END) / COUNT(*), 1) as stuff_pct,
  SUM(CASE WHEN first_down_rush THEN 1 ELSE 0 END) as first_downs,
  ROUND(100.0 * SUM(CASE WHEN first_down_rush THEN 1 ELSE 0 END) / COUNT(*), 1) as first_down_pct,
  SUM(CASE WHEN yardline_100 <= 20 THEN 1 ELSE 0 END) as rz_rush,
  ROUND(AVG(epa), 3) as epa_per_rush
FROM bronze_nflfastr_plays
WHERE play_type = 'run' AND rusher_player_id IS NOT NULL
GROUP BY rusher_player_name
```
