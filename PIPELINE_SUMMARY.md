# OTC Redraft 2025 MVP Data Pipeline

## Overview
Complete data collection and processing pipeline for fantasy football analytics, built with Python and NFL data sources.

## Pipeline Architecture

### Raw Data Collection
- **Weekly Stats**: `scripts/collect_weekly_core.py`
  - Source: nflfastR via nfl-data-py
  - Output: `raw/2024/stats_weekly.jsonl` (5,597 records)
  - Fields: player_id, fantasy_ppr, rushing_yards, receiving_yards, etc.

- **Depth Charts**: `scripts/collect_depth.py` 
  - Source: nflverse depth charts
  - Output: `raw/2024/depth_weekly.jsonl` (37,312 records)
  - Fields: player_id, depth_rank, formation, position

### Data Processing Pipeline
1. **Staging**: `scripts/stage_and_merge.py`
   - Normalizes column names (club_code → team)
   - Standardizes team names (JAX → JAC)
   - Output: `staging/weekly_staging.jsonl` (5,597 records)

2. **Warehouse Merge**: Same script continues
   - Merges stats with depth charts on player_id, season, week, team
   - Output: `warehouse/2024_weekly.jsonl` (7,027 records)

3. **Position Filtering**: `scripts/filter_positions.py`
   - Separates fantasy vs IDP positions
   - Output: `depth_charts_fantasy.jsonl` (12,384 records)
   - Output: `depth_charts_idp.jsonl` (8,404 records)

## Usage

### Quick Start
```bash
bash scripts/run_pipeline.sh
```

### Individual Steps
```bash
python scripts/collect_weekly_core.py
python scripts/collect_depth.py
python scripts/stage_and_merge.py
python scripts/filter_positions.py
```

## Data Schema

### Warehouse Records (Final Output)
```json
{
  "player_id": "00-0023459",
  "season": 2024,
  "week": 1,
  "team": "NYJ", 
  "position": "QB",
  "routes": null,
  "targets": 0,
  "air_yards": null,
  "receptions": 0,
  "receiving_yards": 0.0,
  "receiving_tds": 0,
  "rushing_att": 1,
  "rushing_yards": -1.0,
  "rushing_tds": 0,
  "fantasy_ppr": 8.58,
  "depth_rank": "1",
  "formation": "Offense"
}
```

## File Structure
```
raw/2024/
├── stats_weekly.jsonl      # 5,597 weekly stat records
└── depth_weekly.jsonl      # 37,312 depth chart records

staging/
└── weekly_staging.jsonl    # 5,597 normalized records

warehouse/
└── 2024_weekly.jsonl       # 7,027 merged records (MAIN OUTPUT)

# Position-filtered outputs
depth_charts_fantasy.jsonl  # 12,384 QB/RB/WR/TE/K/DST
depth_charts_idp.jsonl      # 8,404 LB/CB/S/DL/DE/DT/EDGE
```

## Key Features
- ✅ **Multi-source integration**: nflfastR stats + nflverse depth charts
- ✅ **Data normalization**: Consistent team names and column structure  
- ✅ **Error handling**: Graceful handling of missing data
- ✅ **Position filtering**: Fantasy vs IDP player separation
- ✅ **JSONL format**: Streaming-friendly line-delimited JSON
- ✅ **Modular design**: Individual scripts can be run independently

## Dependencies
- `nfl-data-py`: NFL statistics and depth charts
- `pandas`: Data processing and merging
- `json`: JSONL file handling

## Next Steps
- Frontend integration for displaying warehouse data
- Add player name/team lookup functionality
- Implement weekly data refresh automation
- Add data validation and quality checks