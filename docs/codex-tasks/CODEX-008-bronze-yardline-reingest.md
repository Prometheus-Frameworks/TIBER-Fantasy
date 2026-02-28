# CODEX-008: Bronze PBP Re-ingest — yardline_100 + Situational Fields

**Priority:** High  
**Scope:** Python backfill script + schema migration + Gold ETL query fix + full re-run  
**Blocking:** All red zone analytics in Data Lab (rz_snaps, rz_targets, rz_rush_tds, rz_rec_tds, rz_snap_rate, rz_td_rate for every player)

---

## Problem

The `bronze_nflfastr_plays` table stores 2025 play-by-play data but `raw_data` JSONB is **NULL for every row across all 18 weeks**. The Gold ETL computes red zone stats using:

```sql
WHERE (raw_data->>'yardline_100')::float <= 20
```

Since `raw_data` is NULL everywhere, this filter matches 0 plays. Every player's `rz_snaps`, `rz_rush_attempts`, `rz_rush_tds`, `rz_targets`, `rz_rec_tds` are all 0 in every snapshot. Confirmed via query:

```
total_player_weeks: 5,346 | weeks_with_rz_data: 0 | total_rz_rush_tds: 0
```

Chase Brown had 11 TDs (6 rush + 5 rec) in 2025 but shows "0 red zone use" in the Data Lab — a data artifact, not player reality.

---

## Current Table Schema (bronze_nflfastr_plays)

Direct columns that exist:

```
id, play_id, game_id, season, week, posteam, defteam, play_type,
passer_player_id, passer_player_name, receiver_player_id, receiver_player_name,
rusher_player_id, rusher_player_name,
epa, wpa, air_yards, yards_after_catch, yards_gained,
complete_pass, incomplete_pass, interception, touchdown,
raw_data (jsonb — NULL for all 2025),
first_down, first_down_rush, first_down_pass,
offense_personnel, defense_personnel, offense_formation,
wp, score_differential, air_epa, comp_air_epa
```

**Missing direct columns needed:**
- `yardline_100` — distance to opponent end zone (1=goal line, 100=own goal line)
- `down` — 1, 2, 3, or 4
- `ydstogo` — yards to gain for first down
- `goal_to_go` — boolean, true when ydstogo = yardline_100

---

## Tasks

### Step 1 — Add direct columns to bronze table

Run this SQL directly (do NOT use `db:push` — this is a raw schema change):

```sql
ALTER TABLE bronze_nflfastr_plays
  ADD COLUMN IF NOT EXISTS yardline_100 smallint,
  ADD COLUMN IF NOT EXISTS down smallint,
  ADD COLUMN IF NOT EXISTS ydstogo smallint,
  ADD COLUMN IF NOT EXISTS goal_to_go boolean;

CREATE INDEX IF NOT EXISTS idx_bronze_plays_yardline 
  ON bronze_nflfastr_plays(season, week, yardline_100) 
  WHERE yardline_100 IS NOT NULL;
```

### Step 2 — Write Python backfill script

Create `scripts/backfill_bronze_yardline_2025.py`:

```python
#!/usr/bin/env python3
"""
Backfill yardline_100, down, ydstogo, goal_to_go for 2025 bronze PBP plays.

The 2025 bronze plays were imported with raw_data=NULL, missing field position data.
This script fetches the nflfastR PBP data for the 2024 NFL season (stored as 2025
per our convention) and backfills the direct columns by matching on game_id + play_id.

Usage: python scripts/backfill_bronze_yardline_2025.py
"""

import os
import pandas as pd
import psycopg2
from psycopg2.extras import execute_values

# nflfastR convention: 2024 season = 2025 in our DB (season-ending year)
NFL_SEASON_YEAR = 2024
DB_SEASON = 2025

def get_db():
    url = os.environ['DATABASE_URL']
    return psycopg2.connect(url)

def fetch_pbp():
    import nfl_data_py as nfl
    print(f"Fetching PBP data for {NFL_SEASON_YEAR} season...")
    df = nfl.import_pbp_data([NFL_SEASON_YEAR], columns=[
        'game_id', 'play_id', 'week',
        'yardline_100', 'down', 'ydstogo', 'goal_to_go'
    ])
    print(f"Loaded {len(df):,} plays from nfl_data_py")
    return df

def backfill(df: pd.DataFrame, conn):
    cur = conn.cursor()

    # Build lookup: (game_id, play_id) -> (yardline_100, down, ydstogo, goal_to_go)
    # nflfastR play_id is numeric; our DB stores as varchar — cast on match
    df = df.dropna(subset=['game_id', 'play_id'])
    df['play_id'] = df['play_id'].astype(str)
    df['yardline_100'] = pd.to_numeric(df['yardline_100'], errors='coerce')
    df['down'] = pd.to_numeric(df['down'], errors='coerce')
    df['ydstogo'] = pd.to_numeric(df['ydstogo'], errors='coerce')
    df['goal_to_go'] = df['goal_to_go'].map({1: True, 0: False, True: True, False: False})

    # Process week by week for progress visibility
    weeks = sorted(df['week'].dropna().unique().astype(int))
    total_updated = 0

    for week in weeks:
        week_df = df[df['week'] == week].copy()
        week_df = week_df.dropna(subset=['yardline_100'])  # only update rows with actual data

        if week_df.empty:
            print(f"  Week {week}: no yardline data, skipping")
            continue

        rows = [
            (
                row['game_id'],
                str(int(float(row['play_id']))),
                int(row['yardline_100']) if pd.notna(row['yardline_100']) else None,
                int(row['down']) if pd.notna(row['down']) else None,
                int(row['ydstogo']) if pd.notna(row['ydstogo']) else None,
                bool(row['goal_to_go']) if pd.notna(row['goal_to_go']) else None,
            )
            for _, row in week_df.iterrows()
        ]

        cur.execute("BEGIN")
        try:
            execute_values(cur, """
                UPDATE bronze_nflfastr_plays AS b
                SET 
                  yardline_100 = v.yardline_100,
                  down = v.down,
                  ydstogo = v.ydstogo,
                  goal_to_go = v.goal_to_go
                FROM (VALUES %s) AS v(game_id, play_id, yardline_100, down, ydstogo, goal_to_go)
                WHERE b.game_id = v.game_id
                  AND b.play_id = v.play_id
                  AND b.season = %s
                  AND b.week = %s
            """, rows, template="(%s, %s, %s::smallint, %s::smallint, %s::smallint, %s::boolean)",
            page_size=500)

            updated = cur.rowcount
            conn.commit()
            total_updated += updated
            print(f"  Week {week}: {len(rows):,} source plays → {updated:,} rows updated")
        except Exception as e:
            conn.rollback()
            print(f"  Week {week}: ERROR — {e}")

    cur.close()
    print(f"\nTotal updated: {total_updated:,} rows")
    return total_updated

def verify(conn):
    cur = conn.cursor()
    cur.execute("""
        SELECT 
            week,
            COUNT(*) as total,
            COUNT(yardline_100) as with_yardline,
            COUNT(CASE WHEN yardline_100 <= 20 THEN 1 END) as rz_plays
        FROM bronze_nflfastr_plays
        WHERE season = 2025
        GROUP BY week ORDER BY week
    """)
    print("\nVerification — yardline_100 coverage per week:")
    print(f"{'Week':<6} {'Total':<8} {'With YL':<10} {'RZ Plays':<10}")
    for row in cur.fetchall():
        print(f"  {row[0]:<6} {row[1]:<8} {row[2]:<10} {row[3]:<10}")
    cur.close()

if __name__ == "__main__":
    conn = get_db()
    df = fetch_pbp()
    total = backfill(df, conn)
    if total > 0:
        verify(conn)
    conn.close()
    print("\nDone. Run the Gold ETL re-run next (Step 3).")
```

### Step 3 — Update Gold ETL RZ query

In `server/etl/goldDatadiveETL.ts`, the RZ query at the `getRedZoneStats` function uses:

```sql
WHERE (raw_data->>'yardline_100')::float <= 20
```

Replace with the direct column:

```sql
WHERE yardline_100 <= 20
```

Also update any other references to `raw_data->>'yardline_100'` in the same file (check for `yardline_100` in the down-distance and two-minute drill queries as well — they likely have the same pattern).

File: `server/etl/goldDatadiveETL.ts`  
Search pattern: `raw_data->>'yardline_100'`  
Replace with: `yardline_100`

Note: Also check `raw_data->>'ydstogo'`, `raw_data->>'down'`, and `raw_data->>'goal_to_go'` — update all to use direct columns.

### Step 4 — Re-run Gold ETL for all 18 weeks

After the backfill is verified, trigger the Gold ETL for each week:

```bash
for WEEK in $(seq 1 18); do
  npx tsx -e "
    import { runGoldETLForWeek } from './server/etl/goldDatadiveETL';
    runGoldETLForWeek(2025, $WEEK).then(r => console.log('Week $WEEK:', r));
  " 2>&1
  sleep 2
done
```

Or via the admin API endpoint one week at a time:
```bash
for week in $(seq 1 18); do
  curl -X POST http://localhost:5000/api/data-lab/admin/run \
    -H "Content-Type: application/json" \
    -d "{\"season\": 2025, \"week\": $week, \"triggeredBy\": \"yardline-backfill-v1\"}"
  sleep 3
done
```

### Step 5 — Validate

After re-run, confirm RZ stats are populated:

```sql
SELECT 
  week,
  COUNT(*) as players,
  COUNT(CASE WHEN rz_snaps > 0 THEN 1 END) as with_rz,
  SUM(rz_rush_tds) as total_rz_rush_tds,
  SUM(rz_rec_tds) as total_rz_rec_tds
FROM datadive_snapshot_player_week spw
JOIN datadive_snapshot_meta sm ON sm.id = spw.snapshot_id
WHERE sm.season = 2025 AND sm.is_official = true
GROUP BY week ORDER BY week;
```

Expected: `with_rz > 0` for all weeks, `total_rz_rush_tds` in the 10-20 range per week.

Spot check Chase Brown (player_id `00-0038597`):
```sql
SELECT week, rz_snaps, rz_rush_attempts, rz_rush_tds, rz_rec_tds
FROM datadive_snapshot_player_week spw
JOIN datadive_snapshot_meta sm ON sm.id = spw.snapshot_id
WHERE sm.season = 2025 AND sm.is_official = true
  AND spw.player_id = '00-0038597'
ORDER BY week;
```

Expected: weeks with TDs (1, 8, 14, 16, 17) should show `rz_snaps > 0`.

---

## Known Context

- Our DB season convention: nflfastR 2024 season data → stored as `season = 2025`
- `play_id` in bronze is stored as `character varying` — nflfastR returns it as float (e.g., `1.0`). Must cast to int then string when matching: `str(int(float(play_id)))`
- `game_id` format example: `"2024_01_BAL_KC"` — same in both nflfastR and our bronze table
- The `nfl_data_py.import_pbp_data()` function accepts a `columns` parameter to avoid loading all 372 nflfastR fields — use it to keep memory low
- `raw_data->>'xyac_success'` already has a `NULLIF` guard added in a previous fix — don't remove it

---

## Files to Modify

| File | Change |
|------|--------|
| `scripts/backfill_bronze_yardline_2025.py` | Create new |
| `server/etl/goldDatadiveETL.ts` | Replace `raw_data->>'yardline_100'` → `yardline_100`, and `raw_data->>'down'`, `raw_data->>'ydstogo'`, `raw_data->>'goal_to_go'` → direct columns |
| Database | `ALTER TABLE` to add 4 columns + index |

Do NOT modify `drizzle.config.ts`, `package.json`, or run `db:push`.
