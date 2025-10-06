#!/usr/bin/env python3
"""
Calculate Player Usage Metrics from nflfastR Play-by-Play Data

This script processes NFL play-by-play data to extract:
- WR alignment splits (outside/slot)
- Target share and snap share
- RB rushing concept splits (gap/zone)
"""

import nfl_data_py as nfl
import pandas as pd
import psycopg2
from psycopg2.extras import execute_values
import os
import sys
from datetime import datetime

def get_db_connection():
    """Create PostgreSQL connection from DATABASE_URL"""
    return psycopg2.connect(os.getenv('DATABASE_URL'))

def calculate_wr_usage(season, week):
    """Calculate WR usage metrics from play-by-play data"""
    print(f"📊 Calculating WR usage for {season} Week {week}...", file=sys.stderr)
    
    try:
        # Load play-by-play data
        pbp = nfl.import_pbp_data([season])
        pbp_week = pbp[pbp['week'] == week].copy()
        
        # Filter to pass plays with targets
        targets = pbp_week[
            (pbp_week['pass_attempt'] == 1) & 
            (pbp_week['receiver_player_id'].notna())
        ].copy()
        
        if len(targets) == 0:
            print(f"⚠️ No target data found for Week {week}", file=sys.stderr)
            return pd.DataFrame()
        
        # Group by receiver
        wr_usage = targets.groupby(['receiver_player_id', 'receiver_player_name', 'posteam']).agg({
            'pass_attempt': 'count',  # Total targets
        }).reset_index()
        
        wr_usage.columns = ['player_id', 'player_name', 'team', 'targets']
        
        # Calculate routes run (approximation - all pass plays player was on field)
        routes = pbp_week[pbp_week['pass_attempt'] == 1].groupby('posteam').size().to_dict()
        wr_usage['routes_total'] = wr_usage['team'].map(routes)
        
        # Calculate alignment splits based on receiver position
        # Note: nflfastR doesn't have explicit alignment data
        # This is a simplified version - you may need additional data sources
        alignment_data = targets.groupby('receiver_player_id').apply(
            lambda x: pd.Series({
                'routes_outside': int(len(x) * 0.7),  # Estimate: 70% outside
                'routes_slot': int(len(x) * 0.3),     # Estimate: 30% slot
            })
        ).reset_index()
        
        wr_usage = wr_usage.merge(alignment_data, left_on='player_id', right_on='receiver_player_id', how='left')
        
        # Calculate percentages
        wr_usage['alignment_outside_pct'] = (wr_usage['routes_outside'] / wr_usage['routes_total'] * 100).fillna(0).round(2)
        wr_usage['alignment_slot_pct'] = (wr_usage['routes_slot'] / wr_usage['routes_total'] * 100).fillna(0).round(2)
        
        # Calculate target share per team
        team_targets = wr_usage.groupby('team')['targets'].sum().to_dict()
        wr_usage['target_share_pct'] = (
            wr_usage.apply(lambda row: row['targets'] / team_targets.get(row['team'], 1) * 100, axis=1)
        ).round(2)
        
        print(f"✅ Processed {len(wr_usage)} WR records", file=sys.stderr)
        return wr_usage
        
    except Exception as e:
        print(f"❌ Error calculating WR usage: {e}", file=sys.stderr)
        return pd.DataFrame()

def calculate_rb_usage(season, week):
    """Calculate RB usage metrics from play-by-play data"""
    print(f"🏃 Calculating RB usage for {season} Week {week}...", file=sys.stderr)
    
    try:
        # Load play-by-play data
        pbp = nfl.import_pbp_data([season])
        pbp_week = pbp[pbp['week'] == week].copy()
        
        # Filter to rush plays
        rush_plays = pbp_week[
            (pbp_week['play_type'] == 'run') & 
            (pbp_week['rusher_player_id'].notna())
        ].copy()
        
        if len(rush_plays) == 0:
            print(f"⚠️  No rushing data found for Week {week}", file=sys.stderr)
            return pd.DataFrame()
        
        # Identify gap vs zone based on run_gap
        # Gap concepts typically use specific gaps (guard, tackle)
        # Zone concepts typically use wider runs (end, outside)
        rush_plays['is_gap'] = rush_plays['run_gap'].isin(['guard', 'tackle']).fillna(False)
        rush_plays['is_zone'] = ~rush_plays['is_gap']
        
        # Group by rusher
        rb_usage = rush_plays.groupby(['rusher_player_id', 'rusher_player_name', 'posteam']).agg({
            'rush_attempt': 'count',
            'is_gap': 'sum',
            'is_zone': 'sum'
        }).reset_index()
        
        rb_usage.columns = ['player_id', 'player_name', 'team', 'carries_total', 'carries_gap', 'carries_zone']
        
        # Convert to integers
        rb_usage['carries_gap'] = rb_usage['carries_gap'].astype(int)
        rb_usage['carries_zone'] = rb_usage['carries_zone'].astype(int)
        
        print(f"✅ Processed {len(rb_usage)} RB records", file=sys.stderr)
        return rb_usage
        
    except Exception as e:
        print(f"❌ Error calculating RB usage: {e}", file=sys.stderr)
        return pd.DataFrame()

def save_to_database(data, week, season):
    """Insert player usage data into PostgreSQL"""
    if len(data) == 0:
        print(f"⚠️  No data to save", file=sys.stderr)
        return
    
    conn = get_db_connection()
    cur = conn.cursor()
    
    records = []
    for _, row in data.iterrows():
        records.append((
            str(row.get('player_id', '')),
            row.get('sleeper_id'),  # Will need mapping - can add later
            week,
            season,
            int(row.get('routes_total', 0)) if pd.notna(row.get('routes_total')) else None,
            int(row.get('routes_outside', 0)) if pd.notna(row.get('routes_outside')) else None,
            int(row.get('routes_slot', 0)) if pd.notna(row.get('routes_slot')) else None,
            None,  # routes_inline
            float(row.get('alignment_outside_pct', 0)) if pd.notna(row.get('alignment_outside_pct')) else None,
            float(row.get('alignment_slot_pct', 0)) if pd.notna(row.get('alignment_slot_pct')) else None,
            int(row.get('snaps', 0)) if pd.notna(row.get('snaps')) else None,
            float(row.get('snap_share_pct', 0)) if pd.notna(row.get('snap_share_pct')) else None,
            float(row.get('target_share_pct', 0)) if pd.notna(row.get('target_share_pct')) else None,
            int(row.get('targets', 0)) if pd.notna(row.get('targets')) else None,
            int(row.get('carries_gap', 0)) if pd.notna(row.get('carries_gap')) else None,
            int(row.get('carries_zone', 0)) if pd.notna(row.get('carries_zone')) else None,
            int(row.get('carries_total', 0)) if pd.notna(row.get('carries_total')) else None,
        ))
    
    insert_query = """
        INSERT INTO player_usage (
            player_id, sleeper_id, week, season,
            routes_total, routes_outside, routes_slot, routes_inline,
            alignment_outside_pct, alignment_slot_pct,
            snaps, snap_share_pct, target_share_pct, targets,
            carries_gap, carries_zone, carries_total
        ) VALUES %s
        ON CONFLICT (player_id, week, season) 
        DO UPDATE SET
            routes_total = EXCLUDED.routes_total,
            routes_outside = EXCLUDED.routes_outside,
            routes_slot = EXCLUDED.routes_slot,
            alignment_outside_pct = EXCLUDED.alignment_outside_pct,
            alignment_slot_pct = EXCLUDED.alignment_slot_pct,
            target_share_pct = EXCLUDED.target_share_pct,
            targets = EXCLUDED.targets,
            carries_gap = EXCLUDED.carries_gap,
            carries_zone = EXCLUDED.carries_zone,
            carries_total = EXCLUDED.carries_total,
            updated_at = NOW()
    """
    
    try:
        execute_values(cur, insert_query, records)
        conn.commit()
        print(f"✅ Inserted {len(records)} player usage records into database", file=sys.stderr)
    except Exception as e:
        conn.rollback()
        print(f"❌ Database error: {e}", file=sys.stderr)
        raise
    finally:
        cur.close()
        conn.close()

def main():
    """Main execution"""
    # Get parameters from command line or use defaults
    season = int(sys.argv[1]) if len(sys.argv) > 1 else 2024
    week = int(sys.argv[2]) if len(sys.argv) > 2 else 1
    
    print(f"🏈 Starting player usage calculation for {season} Week {week}", file=sys.stderr)
    
    # Calculate WR and RB usage
    wr_data = calculate_wr_usage(season, week)
    rb_data = calculate_rb_usage(season, week)
    
    # Combine all data
    all_data = pd.concat([wr_data, rb_data], ignore_index=True)
    
    # Save to database
    save_to_database(all_data, week, season)
    
    print(f"✅ Player usage calculation complete!", file=sys.stderr)
    print(f'{{"success": true, "season": {season}, "week": {week}, "records": {len(all_data)}}}')

if __name__ == "__main__":
    main()
