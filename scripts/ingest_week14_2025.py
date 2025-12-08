#!/usr/bin/env python3
"""
Fetch Week 14 data from nfl-data-py (2024 NFL season) and store as season=2025.
This follows our season-ending year convention.
"""

import pandas as pd
import os
import psycopg2
from psycopg2.extras import execute_values

def get_db_connection():
    """Get database connection from environment."""
    database_url = os.environ.get('DATABASE_URL')
    if not database_url:
        raise ValueError("DATABASE_URL not found in environment")
    return psycopg2.connect(database_url)

def convert_to_python_type(value):
    """Convert pandas/numpy types to Python native types."""
    if pd.isna(value):
        return None
    if hasattr(value, 'item'):
        return value.item()
    return value

def fetch_and_ingest_week14():
    """Fetch Week 14 data and ingest into weekly_stats with season=2025."""
    
    import nfl_data_py as nfl
    
    print("📊 Fetching 2024 NFL season weekly stats (will store as season=2025)...")
    
    try:
        df = nfl.import_weekly_data([2024])
        print(f"✅ Loaded {len(df):,} total weekly stat records")
        
        week14_df = df[df['week'] == 14].copy()
        print(f"📅 Week 14 has {len(week14_df):,} player records")
        
        if week14_df.empty:
            print("❌ No Week 14 data available yet from nfl-data-py")
            return None
        
        column_map = {
            'player_id': 'player_id',
            'player_name': 'player_name',
            'recent_team': 'team',
            'position': 'position',
            'week': 'week',
            'completions': 'completions',
            'attempts': 'pass_attempts',
            'passing_yards': 'pass_yd',
            'passing_tds': 'pass_td',
            'interceptions': 'int',
            'sacks': 'sacks',
            'passing_air_yards': 'passing_air_yards',
            'passing_yards_after_catch': 'passing_yac',
            'passing_epa': 'passing_epa',
            'carries': 'rush_att',
            'rushing_yards': 'rush_yd',
            'rushing_tds': 'rush_td',
            'rushing_epa': 'rushing_epa',
            'receptions': 'rec',
            'targets': 'targets',
            'receiving_yards': 'rec_yd',
            'receiving_tds': 'rec_td',
            'receiving_epa': 'receiving_epa',
            'target_share': 'target_share',
            'air_yards_share': 'air_yards_share',
            'fantasy_points': 'fantasy_points_std',
            'fantasy_points_ppr': 'fantasy_points_ppr',
        }
        
        available_cols = [c for c in column_map.keys() if c in week14_df.columns]
        week14_df = week14_df[available_cols].rename(columns=column_map)
        
        week14_df['season'] = 2025
        
        week14_df['fantasy_points_half'] = (
            week14_df.get('fantasy_points_std', 0) + 
            (week14_df.get('rec', 0) * 0.5)
        )
        
        qb_df = week14_df[week14_df['position'] == 'QB'].copy()
        print(f"\n🏈 Found {len(qb_df)} QBs in Week 14")
        
        player_names = qb_df['player_name'].tolist()
        mccarthy_mask = [('mccarthy' in str(name).lower() if name else False) for name in player_names]
        mccarthy = qb_df[mccarthy_mask]
        
        if not mccarthy.empty:
            print("\n🎯 J.J. McCarthy Week 14 Stats Found:")
            m = mccarthy.iloc[0]
            print(f"   Player: {m.get('player_name', 'N/A')}")
            print(f"   Team: {m.get('team', 'N/A')}")
            print(f"   Completions: {m.get('completions', 'N/A')}")
            print(f"   Attempts: {m.get('pass_attempts', 'N/A')}")
            if pd.notna(m.get('completions')) and pd.notna(m.get('pass_attempts')) and m.get('pass_attempts', 0) > 0:
                comp_pct = (m['completions'] / m['pass_attempts']) * 100
                print(f"   Completion %: {comp_pct:.1f}%")
            print(f"   Pass Yards: {m.get('pass_yd', 'N/A')}")
            print(f"   Pass TDs: {m.get('pass_td', 'N/A')}")
            print(f"   INTs: {m.get('int', 'N/A')}")
            print(f"   Passing EPA: {m.get('passing_epa', 'N/A')}")
        else:
            print("\n⚠️  J.J. McCarthy not found in Week 14 data")
            print("   Available MIN QBs:")
            min_qbs = qb_df[qb_df['team'] == 'MIN']
            for _, qb in min_qbs.iterrows():
                print(f"   - {qb.get('player_name', 'Unknown')}")
        
        conn = get_db_connection()
        cur = conn.cursor()
        
        try:
            records = []
            for _, row in week14_df.iterrows():
                records.append((
                    convert_to_python_type(row.get('season', 2025)),
                    convert_to_python_type(row.get('week', 14)),
                    convert_to_python_type(row.get('player_id')),
                    convert_to_python_type(row.get('player_name')),
                    convert_to_python_type(row.get('team')),
                    convert_to_python_type(row.get('position')),
                    None,
                    None,
                    convert_to_python_type(row.get('targets')),
                    convert_to_python_type(row.get('rush_att')),
                    convert_to_python_type(row.get('rec')),
                    convert_to_python_type(row.get('rec_yd')),
                    convert_to_python_type(row.get('rec_td')),
                    convert_to_python_type(row.get('rush_yd')),
                    convert_to_python_type(row.get('rush_td')),
                    convert_to_python_type(row.get('pass_yd')),
                    convert_to_python_type(row.get('pass_td')),
                    convert_to_python_type(row.get('int')),
                    None,
                    None,
                    convert_to_python_type(row.get('fantasy_points_std')),
                    convert_to_python_type(row.get('fantasy_points_half')),
                    convert_to_python_type(row.get('fantasy_points_ppr')),
                    convert_to_python_type(row.get('player_id')),
                ))
            
            execute_values(cur, """
                INSERT INTO weekly_stats 
                (season, week, player_id, player_name, team, position, snaps, routes, targets, rush_att,
                 rec, rec_yd, rec_td, rush_yd, rush_td, pass_yd, pass_td, int, fumbles, two_pt,
                 fantasy_points_std, fantasy_points_half, fantasy_points_ppr, gsis_id)
                VALUES %s
                ON CONFLICT (season, week, player_id) DO UPDATE
                SET player_name = EXCLUDED.player_name,
                    team = EXCLUDED.team,
                    position = EXCLUDED.position,
                    targets = COALESCE(EXCLUDED.targets, weekly_stats.targets),
                    rush_att = COALESCE(EXCLUDED.rush_att, weekly_stats.rush_att),
                    rec = COALESCE(EXCLUDED.rec, weekly_stats.rec),
                    rec_yd = COALESCE(EXCLUDED.rec_yd, weekly_stats.rec_yd),
                    rec_td = COALESCE(EXCLUDED.rec_td, weekly_stats.rec_td),
                    rush_yd = COALESCE(EXCLUDED.rush_yd, weekly_stats.rush_yd),
                    rush_td = COALESCE(EXCLUDED.rush_td, weekly_stats.rush_td),
                    pass_yd = COALESCE(EXCLUDED.pass_yd, weekly_stats.pass_yd),
                    pass_td = COALESCE(EXCLUDED.pass_td, weekly_stats.pass_td),
                    int = COALESCE(EXCLUDED.int, weekly_stats.int),
                    fantasy_points_std = COALESCE(EXCLUDED.fantasy_points_std, weekly_stats.fantasy_points_std),
                    fantasy_points_half = COALESCE(EXCLUDED.fantasy_points_half, weekly_stats.fantasy_points_half),
                    fantasy_points_ppr = COALESCE(EXCLUDED.fantasy_points_ppr, weekly_stats.fantasy_points_ppr),
                    updated_at = CURRENT_TIMESTAMP
            """, records)
            
            conn.commit()
            print(f"\n✅ Ingested {len(records)} Week 14 records into weekly_stats (season=2025)")
            
        except Exception as e:
            conn.rollback()
            print(f"❌ Database error: {e}")
            raise
        finally:
            cur.close()
            conn.close()
        
        return week14_df
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return None

if __name__ == "__main__":
    fetch_and_ingest_week14()
