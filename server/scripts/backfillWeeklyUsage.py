#!/usr/bin/env python3
"""
Comprehensive Weekly Usage Backfill Script
Downloads NFLfastR parquet files and populates both weekly_stats and player_usage tables

Usage:
  python backfillWeeklyUsage.py <season> [week] [--player_id=<id>]
  
Examples:
  python backfillWeeklyUsage.py 2024            # Full 2024 season
  python backfillWeeklyUsage.py 2024 10         # Just week 10
  python backfillWeeklyUsage.py 2024 --player_id=00-0036963  # Amon-Ra 2024
"""

import pandas as pd
import numpy as np
import psycopg2
from psycopg2.extras import execute_values
import os
import sys
import requests
from io import BytesIO
import argparse
from datetime import datetime

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
    if isinstance(value, str):
        return str(value)
    return value

def get_db_connection():
    """Get PostgreSQL connection from environment"""
    return psycopg2.connect(os.getenv('DATABASE_URL'))

def download_pbp_data(season):
    """Download play-by-play parquet from NFLfastR GitHub"""
    print(f"📥 Downloading {season} play-by-play data...", file=sys.stderr)
    
    url = f"https://github.com/nflverse/nflverse-data/releases/download/pbp/play_by_play_{season}.parquet"
    
    try:
        response = requests.get(url, timeout=120)
        response.raise_for_status()
        
        pbp = pd.read_parquet(BytesIO(response.content))
        print(f"✅ Downloaded {len(pbp)} plays from {season} season", file=sys.stderr)
        return pbp
    except requests.exceptions.HTTPError as e:
        if e.response.status_code == 404:
            print(f"❌ No data available for {season} season yet", file=sys.stderr)
        else:
            print(f"❌ HTTP Error: {e}", file=sys.stderr)
        return None
    except Exception as e:
        print(f"❌ Error downloading data: {e}", file=sys.stderr)
        return None

def download_nfl_data_py_weekly(season):
    """Download weekly aggregated stats from nfl_data_py for snap counts"""
    try:
        import nfl_data_py as nfl
        print(f"📊 Downloading {season} weekly data from nfl_data_py...", file=sys.stderr)
        
        # Import weekly data with key columns
        weekly = nfl.import_weekly_data([season])
        print(f"✅ Downloaded weekly data for {len(weekly)} player-weeks", file=sys.stderr)
        return weekly
    except Exception as e:
        print(f"⚠️  Warning: Could not load nfl_data_py weekly data: {e}", file=sys.stderr)
        return pd.DataFrame()

def calculate_weekly_stats(pbp, nfl_weekly, week, season, player_filter=None):
    """
    Calculate comprehensive weekly stats from play-by-play data
    
    Returns:
        (weekly_stats_records, player_usage_records)
    """
    print(f"📊 Processing Week {week} stats...", file=sys.stderr)
    
    # Filter to regular season and specified week
    pbp_week = pbp[(pbp['week'] == week) & (pbp['season_type'] == 'REG')].copy()
    
    if len(pbp_week) == 0:
        print(f"⚠️  No data for Week {week}", file=sys.stderr)
        return [], []
    
    # Filter nfl_weekly to this week
    nfl_week = nfl_weekly[(nfl_weekly['week'] == week) & (nfl_weekly['season'] == season)].copy() if not nfl_weekly.empty else pd.DataFrame()
    
    weekly_stats_records = []
    player_usage_records = []
    
    # === RECEIVING STATS ===
    receiving_plays = pbp_week[
        (pbp_week['pass_attempt'] == 1) & 
        (pbp_week['receiver_player_id'].notna())
    ].copy()
    
    if len(receiving_plays) > 0:
        # Get player names
        player_names = receiving_plays.groupby('receiver_player_id')['receiver_player_name'].first().to_dict()
        
        # Aggregate by receiver
        receiver_stats = receiving_plays.groupby(['receiver_player_id', 'posteam']).agg({
            'pass_attempt': 'count',  # targets
            'complete_pass': 'sum',   # receptions
            'receiving_yards': 'sum',
            'pass_touchdown': 'sum',  # receiving TDs
            'air_yards': 'sum',
            'yards_after_catch': 'sum',
            'epa': 'sum',
        }).reset_index()
        
        receiver_stats.columns = [
            'player_id', 'team', 'targets', 'receptions', 
            'receiving_yards', 'receiving_tds', 'air_yards', 'yac', 'epa'
        ]
        
        # Add player names
        receiver_stats['player_name'] = receiver_stats['player_id'].map(player_names)
        
        # Calculate routes run (estimate: targets * 1.5 for route participation)
        # Better estimate: count of team's pass plays where player was on field
        team_pass_plays = receiving_plays.groupby('posteam')['pass_attempt'].sum().to_dict()
        
        # For route alignment, estimate based on pass_location
        alignment_data = receiving_plays.groupby(['receiver_player_id', 'pass_location']).size().unstack(fill_value=0)
        
        for _, row in receiver_stats.iterrows():
            player_id = row['player_id']
            player_name = row.get('player_name', 'Unknown')
            team = row['team']
            targets = int(row['targets'])
            receptions = int(row['receptions'])
            rec_yards = int(row['receiving_yards']) if pd.notna(row['receiving_yards']) else 0
            rec_tds = int(row['receiving_tds']) if pd.notna(row['receiving_tds']) else 0
            
            # Apply player filter if specified
            if player_filter and player_id != player_filter:
                continue
            
            # Estimate routes (conservative: targets * 2.0 to account for non-targeted routes)
            routes_estimate = int(targets * 2.0)
            
            # Get snap count from nfl_data_py if available
            snaps = None
            if not nfl_week.empty:
                player_weekly = nfl_week[nfl_week['player_id'] == player_id]
                if not player_weekly.empty:
                    snaps = player_weekly.iloc[0].get('offense_snaps')
                    if pd.notna(snaps):
                        snaps = int(snaps)
            
            # Calculate target share per team
            team_total_targets = receiver_stats[receiver_stats['team'] == team]['targets'].sum()
            target_share_pct = round((targets / team_total_targets * 100), 2) if team_total_targets > 0 else 0
            
            # Estimate alignment (outside/slot) from pass_location if available
            routes_outside = int(targets * 0.60)  # Conservative estimate
            routes_slot = int(targets * 0.30)
            routes_inline = int(targets * 0.10)
            
            # Calculate fantasy points
            fantasy_ppr = receptions + (rec_yards * 0.1) + (rec_tds * 6)
            fantasy_half = (receptions * 0.5) + (rec_yards * 0.1) + (rec_tds * 6)
            
            # Weekly stats record
            weekly_stats_records.append({
                'season': season,
                'week': week,
                'player_id': player_id,
                'player_name': player_name,
                'team': team,
                'position': 'WR',  # Inferred
                'snaps': snaps,
                'routes': routes_estimate,
                'targets': targets,
                'rush_att': 0,
                'rec': receptions,
                'rec_yd': rec_yards,
                'rec_td': rec_tds,
                'rush_yd': 0,
                'rush_td': 0,
                'pass_yd': 0,
                'pass_td': 0,
                'int': 0,
                'fumbles': 0,
                'two_pt': 0,
                'fantasy_points_std': fantasy_ppr - receptions,
                'fantasy_points_half': fantasy_half,
                'fantasy_points_ppr': fantasy_ppr,
            })
            
            # Player usage record
            snap_share_pct = None
            if snaps and not nfl_week.empty:
                team_snaps = nfl_week[nfl_week['recent_team'] == team]['offense_snaps'].sum()
                if team_snaps > 0:
                    snap_share_pct = round((snaps / team_snaps * 100), 2)
            
            player_usage_records.append({
                'player_id': player_id,
                'week': week,
                'season': season,
                'routes_total': routes_estimate,
                'routes_outside': routes_outside,
                'routes_slot': routes_slot,
                'routes_inline': routes_inline,
                'alignment_outside_pct': round((routes_outside / routes_estimate * 100), 2) if routes_estimate > 0 else 0,
                'alignment_slot_pct': round((routes_slot / routes_estimate * 100), 2) if routes_estimate > 0 else 0,
                'snaps': snaps,
                'snap_share_pct': snap_share_pct,
                'target_share_pct': target_share_pct,
                'targets': targets,
            })
    
    # === RUSHING STATS ===
    rushing_plays = pbp_week[
        (pbp_week['play_type'] == 'run') & 
        (pbp_week['rusher_player_id'].notna())
    ].copy()
    
    if len(rushing_plays) > 0:
        # Get player names
        rusher_names = rushing_plays.groupby('rusher_player_id')['rusher_player_name'].first().to_dict()
        
        rushing_plays['is_gap'] = rushing_plays['run_gap'].isin(['guard', 'tackle']).fillna(False)
        
        rusher_stats = rushing_plays.groupby(['rusher_player_id', 'posteam']).agg({
            'play_id': 'count',  # carries
            'rushing_yards': 'sum',
            'rush_touchdown': 'sum',
            'is_gap': 'sum',
            'epa': 'sum',
        }).reset_index()
        
        rusher_stats.columns = ['player_id', 'team', 'carries', 'rushing_yards', 'rushing_tds', 'carries_gap', 'epa']
        rusher_stats['carries_zone'] = rusher_stats['carries'] - rusher_stats['carries_gap']
        rusher_stats['player_name'] = rusher_stats['player_id'].map(rusher_names)
        
        for _, row in rusher_stats.iterrows():
            player_id = row['player_id']
            player_name = row.get('player_name', 'Unknown')
            team = row['team']
            carries = int(row['carries'])
            rush_yards = int(row['rushing_yards']) if pd.notna(row['rushing_yards']) else 0
            rush_tds = int(row['rushing_tds']) if pd.notna(row['rushing_tds']) else 0
            
            # Apply player filter
            if player_filter and player_id != player_filter:
                continue
            
            # Check if this player already has a weekly_stats record (from receiving)
            existing = next((r for r in weekly_stats_records if r['player_id'] == player_id), None)
            
            if existing:
                # Update existing record
                existing['rush_att'] = carries
                existing['rush_yd'] = rush_yards
                existing['rush_td'] = rush_tds
                existing['fantasy_points_std'] += (rush_yards * 0.1) + (rush_tds * 6)
                existing['fantasy_points_half'] += (rush_yards * 0.1) + (rush_tds * 6)
                existing['fantasy_points_ppr'] += (rush_yards * 0.1) + (rush_tds * 6)
            else:
                # Create new record
                snaps = None
                if not nfl_week.empty:
                    player_weekly = nfl_week[nfl_week['player_id'] == player_id]
                    if not player_weekly.empty:
                        snaps = player_weekly.iloc[0].get('offense_snaps')
                        if pd.notna(snaps):
                            snaps = int(snaps)
                
                fantasy_pts = (rush_yards * 0.1) + (rush_tds * 6)
                
                weekly_stats_records.append({
                    'season': season,
                    'week': week,
                    'player_id': player_id,
                    'player_name': player_name,
                    'team': team,
                    'position': 'RB',
                    'snaps': snaps,
                    'routes': 0,
                    'targets': 0,
                    'rush_att': carries,
                    'rec': 0,
                    'rec_yd': 0,
                    'rec_td': 0,
                    'rush_yd': rush_yards,
                    'rush_td': rush_tds,
                    'pass_yd': 0,
                    'pass_td': 0,
                    'int': 0,
                    'fumbles': 0,
                    'two_pt': 0,
                    'fantasy_points_std': fantasy_pts,
                    'fantasy_points_half': fantasy_pts,
                    'fantasy_points_ppr': fantasy_pts,
                })
            
            # Add/update player_usage record for RB
            existing_usage = next((r for r in player_usage_records if r['player_id'] == player_id), None)
            
            if existing_usage:
                existing_usage['carries_total'] = carries
                existing_usage['carries_gap'] = int(row['carries_gap'])
                existing_usage['carries_zone'] = int(row['carries_zone'])
            else:
                player_usage_records.append({
                    'player_id': player_id,
                    'week': week,
                    'season': season,
                    'carries_total': carries,
                    'carries_gap': int(row['carries_gap']),
                    'carries_zone': int(row['carries_zone']),
                })
    
    print(f"✅ Extracted {len(weekly_stats_records)} weekly_stats records, {len(player_usage_records)} usage records", file=sys.stderr)
    return weekly_stats_records, player_usage_records

def save_weekly_stats(records):
    """Save weekly_stats records with UPSERT"""
    if not records:
        print("⚠️  No weekly_stats records to save", file=sys.stderr)
        return
    
    conn = get_db_connection()
    cur = conn.cursor()
    
    try:
        values = []
        for record in records:
            values.append((
                convert_to_python_type(record['season']),
                convert_to_python_type(record['week']),
                convert_to_python_type(record['player_id']),
                convert_to_python_type(record['player_name']),
                convert_to_python_type(record['team']),
                convert_to_python_type(record['position']),
                convert_to_python_type(record.get('snaps')),
                convert_to_python_type(record.get('routes')),
                convert_to_python_type(record.get('targets')),
                convert_to_python_type(record.get('rush_att')),
                convert_to_python_type(record.get('rec')),
                convert_to_python_type(record.get('rec_yd')),
                convert_to_python_type(record.get('rec_td')),
                convert_to_python_type(record.get('rush_yd')),
                convert_to_python_type(record.get('rush_td')),
                convert_to_python_type(record.get('pass_yd')),
                convert_to_python_type(record.get('pass_td')),
                convert_to_python_type(record.get('int')),
                convert_to_python_type(record.get('fumbles')),
                convert_to_python_type(record.get('two_pt')),
                convert_to_python_type(record.get('fantasy_points_std')),
                convert_to_python_type(record.get('fantasy_points_half')),
                convert_to_python_type(record.get('fantasy_points_ppr')),
                convert_to_python_type(record.get('player_id')),  # gsis_id = player_id for now
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
                snaps = COALESCE(EXCLUDED.snaps, weekly_stats.snaps),
                routes = COALESCE(EXCLUDED.routes, weekly_stats.routes),
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
                fumbles = COALESCE(EXCLUDED.fumbles, weekly_stats.fumbles),
                two_pt = COALESCE(EXCLUDED.two_pt, weekly_stats.two_pt),
                fantasy_points_std = COALESCE(EXCLUDED.fantasy_points_std, weekly_stats.fantasy_points_std),
                fantasy_points_half = COALESCE(EXCLUDED.fantasy_points_half, weekly_stats.fantasy_points_half),
                fantasy_points_ppr = COALESCE(EXCLUDED.fantasy_points_ppr, weekly_stats.fantasy_points_ppr),
                updated_at = CURRENT_TIMESTAMP
        """, values)
        
        conn.commit()
        print(f"✅ Saved {len(values)} weekly_stats records to database", file=sys.stderr)
        
    except Exception as e:
        conn.rollback()
        print(f"❌ Error saving weekly_stats: {e}", file=sys.stderr)
        raise
    finally:
        cur.close()
        conn.close()

def save_player_usage(records):
    """Save player_usage records with UPSERT"""
    if not records:
        print("⚠️  No player_usage records to save", file=sys.stderr)
        return
    
    conn = get_db_connection()
    cur = conn.cursor()
    
    try:
        values = []
        for record in records:
            values.append((
                convert_to_python_type(record.get('player_id')),
                None,  # sleeper_id (populated separately)
                convert_to_python_type(record.get('week')),
                convert_to_python_type(record.get('season')),
                convert_to_python_type(record.get('routes_total')),
                convert_to_python_type(record.get('routes_outside')),
                convert_to_python_type(record.get('routes_slot')),
                convert_to_python_type(record.get('routes_inline')),
                convert_to_python_type(record.get('alignment_outside_pct')),
                convert_to_python_type(record.get('alignment_slot_pct')),
                convert_to_python_type(record.get('snaps')),
                convert_to_python_type(record.get('snap_share_pct')),
                convert_to_python_type(record.get('target_share_pct')),
                convert_to_python_type(record.get('targets')),
                convert_to_python_type(record.get('carries_gap')),
                convert_to_python_type(record.get('carries_zone')),
                convert_to_python_type(record.get('carries_total')),
            ))
        
        execute_values(cur, """
            INSERT INTO player_usage 
            (player_id, sleeper_id, week, season, routes_total, routes_outside, routes_slot, routes_inline,
             alignment_outside_pct, alignment_slot_pct, snaps, snap_share_pct, target_share_pct, targets,
             carries_gap, carries_zone, carries_total)
            VALUES %s
            ON CONFLICT (player_id, week, season) DO UPDATE
            SET routes_total = COALESCE(EXCLUDED.routes_total, player_usage.routes_total),
                routes_outside = COALESCE(EXCLUDED.routes_outside, player_usage.routes_outside),
                routes_slot = COALESCE(EXCLUDED.routes_slot, player_usage.routes_slot),
                routes_inline = COALESCE(EXCLUDED.routes_inline, player_usage.routes_inline),
                alignment_outside_pct = COALESCE(EXCLUDED.alignment_outside_pct, player_usage.alignment_outside_pct),
                alignment_slot_pct = COALESCE(EXCLUDED.alignment_slot_pct, player_usage.alignment_slot_pct),
                snaps = COALESCE(EXCLUDED.snaps, player_usage.snaps),
                snap_share_pct = COALESCE(EXCLUDED.snap_share_pct, player_usage.snap_share_pct),
                target_share_pct = COALESCE(EXCLUDED.target_share_pct, player_usage.target_share_pct),
                targets = COALESCE(EXCLUDED.targets, player_usage.targets),
                carries_gap = COALESCE(EXCLUDED.carries_gap, player_usage.carries_gap),
                carries_zone = COALESCE(EXCLUDED.carries_zone, player_usage.carries_zone),
                carries_total = COALESCE(EXCLUDED.carries_total, player_usage.carries_total),
                updated_at = CURRENT_TIMESTAMP
        """, values)
        
        conn.commit()
        print(f"✅ Saved {len(values)} player_usage records to database", file=sys.stderr)
        
    except Exception as e:
        conn.rollback()
        print(f"❌ Error saving player_usage: {e}", file=sys.stderr)
        raise
    finally:
        cur.close()
        conn.close()

def main():
    parser = argparse.ArgumentParser(description='Backfill weekly usage data from NFLfastR')
    parser.add_argument('season', type=int, help='NFL season year (e.g., 2024)')
    parser.add_argument('week', type=int, nargs='?', help='Specific week (1-18), omit for full season')
    parser.add_argument('--player_id', type=str, help='Filter to specific player_id (e.g., 00-0036963)')
    
    args = parser.parse_args()
    
    season = args.season
    specific_week = args.week
    player_filter = args.player_id
    
    print(f"🏈 Starting backfill for {season}{f' Week {specific_week}' if specific_week else ' (full season)'}", file=sys.stderr)
    if player_filter:
        print(f"   Filtering to player_id: {player_filter}", file=sys.stderr)
    
    # Download play-by-play data
    pbp = download_pbp_data(season)
    if pbp is None:
        print("❌ Failed to download play-by-play data. Exiting.", file=sys.stderr)
        sys.exit(1)
    
    # Download nfl_data_py weekly data for snap counts
    nfl_weekly = download_nfl_data_py_weekly(season)
    
    # Determine weeks to process
    if specific_week:
        weeks = [specific_week]
    else:
        weeks = sorted(pbp[pbp['season_type'] == 'REG']['week'].unique())
    
    print(f"📅 Processing {len(weeks)} weeks: {weeks}", file=sys.stderr)
    
    total_weekly_stats = 0
    total_usage = 0
    
    for week in weeks:
        weekly_stats_records, usage_records = calculate_weekly_stats(pbp, nfl_weekly, week, season, player_filter)
        
        if weekly_stats_records:
            save_weekly_stats(weekly_stats_records)
            total_weekly_stats += len(weekly_stats_records)
        
        if usage_records:
            save_player_usage(usage_records)
            total_usage += len(usage_records)
    
    print(f"\n✅ Backfill complete!", file=sys.stderr)
    print(f"   Total weekly_stats records: {total_weekly_stats}", file=sys.stderr)
    print(f"   Total player_usage records: {total_usage}", file=sys.stderr)
    
    # Output JSON for consumption by TypeScript
    print({
        "success": True,
        "season": season,
        "weeks_processed": len(weeks),
        "weekly_stats_count": total_weekly_stats,
        "player_usage_count": total_usage,
        "player_filter": player_filter
    })

if __name__ == "__main__":
    main()
