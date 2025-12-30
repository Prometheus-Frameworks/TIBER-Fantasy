#!/usr/bin/env python3
"""
Backfill snap_share_pct in player_usage table using nfl_data_py snap counts.

Data sources:
- nfl.import_snap_counts([season]): Contains offense_pct (0-1 decimal) per player-week
- nfl.import_ids(): Maps GSIS IDs to PFR IDs

Computation:
- snap_share_pct stored as 0-100 (consistent with target_share_pct)
- offense_pct from source is 0-1, so multiply by 100

Usage:
  python server/scripts/backfillSnapSharePct.py <season>
  python server/scripts/backfillSnapSharePct.py <season> --week=<week>
  python server/scripts/backfillSnapSharePct.py <season> --dry-run

Examples:
  python server/scripts/backfillSnapSharePct.py 2024
  python server/scripts/backfillSnapSharePct.py 2024 --week=3
  python server/scripts/backfillSnapSharePct.py 2024 --dry-run
"""

import pandas as pd
import numpy as np
import psycopg2
import os
import sys
import argparse
import json

def get_db_connection():
    """Get PostgreSQL connection from environment"""
    return psycopg2.connect(os.getenv('DATABASE_URL'))

def convert_to_python_type(value):
    """Convert numpy/pandas types to native Python types for psycopg2"""
    if pd.isna(value) or value is None:
        return None
    if isinstance(value, (np.integer, np.int32, np.int64)):
        return int(value)
    if isinstance(value, (np.floating, np.float32, np.float64)):
        return float(value)
    if isinstance(value, np.bool_):
        return bool(value)
    return value

def load_snap_counts(season):
    """Load snap count data from nfl_data_py"""
    try:
        import nfl_data_py as nfl
        print(f"📥 Loading snap counts for {season}...", file=sys.stderr)
        snaps = nfl.import_snap_counts([season])
        
        # Filter to regular season only
        snaps = snaps[snaps['game_type'] == 'REG']
        
        print(f"✅ Loaded {len(snaps)} snap count records", file=sys.stderr)
        return snaps
    except Exception as e:
        print(f"❌ Failed to load snap counts: {e}", file=sys.stderr)
        return None

def load_id_mapping():
    """Load GSIS to PFR ID mapping from nfl_data_py"""
    try:
        import nfl_data_py as nfl
        print(f"📥 Loading player ID mappings...", file=sys.stderr)
        ids = nfl.import_ids()
        
        # Create mapping: pfr_id -> gsis_id (only where both exist)
        ids = ids[ids['gsis_id'].notna() & ids['pfr_id'].notna()]
        mapping = dict(zip(ids['pfr_id'], ids['gsis_id']))
        
        print(f"✅ Loaded {len(mapping)} PFR->GSIS mappings", file=sys.stderr)
        return mapping
    except Exception as e:
        print(f"❌ Failed to load ID mappings: {e}", file=sys.stderr)
        return None

def get_existing_player_usage_rows(season, week=None):
    """Get player_usage rows where snap_share_pct IS NULL"""
    conn = get_db_connection()
    cur = conn.cursor()
    
    try:
        query = """
            SELECT player_id, week, season
            FROM player_usage
            WHERE season = %s AND snap_share_pct IS NULL
        """
        params = [season]
        
        if week:
            query += " AND week = %s"
            params.append(week)
        
        cur.execute(query, params)
        rows = cur.fetchall()
        
        result = {}
        for player_id, w, s in rows:
            if player_id not in result:
                result[player_id] = []
            result[player_id].append(w)
        
        return result
    finally:
        cur.close()
        conn.close()

def backfill_snap_share(season, week=None, dry_run=False):
    """
    Backfill snap_share_pct in player_usage table.
    
    Returns dict with stats about the operation.
    """
    # Load data
    snaps_df = load_snap_counts(season)
    if snaps_df is None:
        return {"success": False, "error": "Failed to load snap counts"}
    
    id_mapping = load_id_mapping()
    if id_mapping is None:
        return {"success": False, "error": "Failed to load ID mappings"}
    
    # Get rows needing update
    null_rows = get_existing_player_usage_rows(season, week)
    print(f"📊 Found {sum(len(weeks) for weeks in null_rows.values())} player_usage rows with NULL snap_share_pct", file=sys.stderr)
    
    if not null_rows:
        return {
            "success": True,
            "season": season,
            "week": week,
            "rows_updated": 0,
            "rows_skipped": 0,
            "message": "No rows to update"
        }
    
    # Map PFR IDs in snap data to GSIS IDs
    snaps_df['gsis_id'] = snaps_df['pfr_player_id'].map(id_mapping)
    snaps_with_gsis = snaps_df[snaps_df['gsis_id'].notna()].copy()
    
    print(f"📊 {len(snaps_with_gsis)} snap records have valid GSIS ID mappings", file=sys.stderr)
    
    # Build update records
    updates = []
    skipped = 0
    
    for player_id, weeks in null_rows.items():
        for w in weeks:
            # Find snap data for this player-week
            player_snaps = snaps_with_gsis[
                (snaps_with_gsis['gsis_id'] == player_id) & 
                (snaps_with_gsis['week'] == w)
            ]
            
            if player_snaps.empty:
                skipped += 1
                continue
            
            # Get offense_pct (0-1 decimal) and convert to 0-100 scale
            offense_pct = player_snaps.iloc[0]['offense_pct']
            offense_snaps = player_snaps.iloc[0]['offense_snaps']
            
            if pd.isna(offense_pct):
                skipped += 1
                continue
            
            # Convert to 0-100 scale and round to 2 decimals
            snap_share_pct = round(float(offense_pct) * 100, 2)
            snaps_val = int(offense_snaps) if pd.notna(offense_snaps) else None
            
            updates.append({
                'player_id': player_id,
                'week': w,
                'season': season,
                'snap_share_pct': snap_share_pct,
                'snaps': snaps_val
            })
    
    print(f"📊 Prepared {len(updates)} updates, {skipped} skipped (no snap data)", file=sys.stderr)
    
    if dry_run:
        # Show sample updates
        print("\n🔍 DRY RUN - Sample updates:", file=sys.stderr)
        for update in updates[:5]:
            print(f"  {update['player_id']} week {update['week']}: snap_share_pct={update['snap_share_pct']}, snaps={update['snaps']}", file=sys.stderr)
        return {
            "success": True,
            "season": season,
            "week": week,
            "rows_to_update": len(updates),
            "rows_skipped": skipped,
            "dry_run": True
        }
    
    # Execute updates using batch approach with temp table
    if updates:
        conn = get_db_connection()
        cur = conn.cursor()
        
        try:
            # Create temp table for bulk update
            cur.execute("""
                CREATE TEMP TABLE snap_updates (
                    player_id TEXT,
                    week INTEGER,
                    season INTEGER,
                    snap_share_pct REAL,
                    snaps INTEGER
                )
            """)
            
            # Batch insert into temp table
            from psycopg2.extras import execute_values
            values = [
                (
                    update['player_id'],
                    update['week'],
                    update['season'],
                    convert_to_python_type(update['snap_share_pct']),
                    convert_to_python_type(update['snaps'])
                )
                for update in updates
            ]
            
            execute_values(cur, """
                INSERT INTO snap_updates (player_id, week, season, snap_share_pct, snaps)
                VALUES %s
            """, values)
            
            print(f"📤 Inserted {len(values)} rows into temp table", file=sys.stderr)
            
            # Bulk update using join
            cur.execute("""
                UPDATE player_usage pu
                SET 
                    snap_share_pct = su.snap_share_pct,
                    snaps = COALESCE(su.snaps, pu.snaps)
                FROM snap_updates su
                WHERE pu.player_id = su.player_id 
                  AND pu.week = su.week 
                  AND pu.season = su.season
                  AND pu.snap_share_pct IS NULL
            """)
            updated_count = cur.rowcount
            
            conn.commit()
            print(f"✅ Updated {updated_count} rows", file=sys.stderr)
            
            return {
                "success": True,
                "season": season,
                "week": week,
                "rows_updated": updated_count,
                "rows_skipped": skipped
            }
        except Exception as e:
            conn.rollback()
            print(f"❌ Update failed: {e}", file=sys.stderr)
            return {"success": False, "error": str(e)}
        finally:
            cur.close()
            conn.close()
    
    return {
        "success": True,
        "season": season,
        "week": week,
        "rows_updated": 0,
        "rows_skipped": skipped
    }

def main():
    parser = argparse.ArgumentParser(description='Backfill snap_share_pct in player_usage')
    parser.add_argument('season', type=int, help='NFL season year')
    parser.add_argument('--week', type=int, help='Specific week to backfill (optional)')
    parser.add_argument('--dry-run', action='store_true', help='Preview changes without applying')
    
    args = parser.parse_args()
    
    if args.season < 2020 or args.season > 2030:
        print("❌ Invalid season. Must be between 2020 and 2030.", file=sys.stderr)
        sys.exit(1)
    
    print(f"\n🏈 Backfilling snap_share_pct for {args.season}" + (f" week {args.week}" if args.week else "") + "\n", file=sys.stderr)
    
    result = backfill_snap_share(args.season, args.week, args.dry_run)
    
    # Output JSON result for TypeScript wrapper
    print(json.dumps(result))
    
    if result.get('success'):
        sys.exit(0)
    else:
        sys.exit(1)

if __name__ == '__main__':
    main()
