#!/usr/bin/env python3
"""
Update Player Usage Data for Any Week
Usage: python server/scripts/updatePlayerUsage.py [season] [week]
Example: python server/scripts/updatePlayerUsage.py 2025 4
"""

import pandas as pd
import psycopg2
from psycopg2.extras import execute_values
import os
import sys
import requests
from io import BytesIO

def get_db_connection():
    return psycopg2.connect(os.getenv('DATABASE_URL'))

def download_pbp_data(season):
    """Download play-by-play data from nflfastR GitHub releases"""
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

def calculate_week_usage(pbp, week, season):
    """Calculate usage metrics for a specific week"""
    print(f"📊 Processing Week {week} usage...", file=sys.stderr)
    
    pbp_week = pbp[pbp['week'] == week].copy()
    
    if len(pbp_week) == 0:
        print(f"⚠️  No data for Week {week}", file=sys.stderr)
        return []
    
    usage_records = []
    
    # WR/TE Targets
    targets = pbp_week[
        (pbp_week['pass_attempt'] == 1) & 
        (pbp_week['receiver_player_id'].notna())
    ].copy()
    
    if len(targets) > 0:
        # Group by receiver
        receiver_stats = targets.groupby(['receiver_player_id', 'posteam']).agg({
            'pass_attempt': 'count',
        }).reset_index()
        receiver_stats.columns = ['player_id', 'team', 'targets']
        
        # Calculate team routes (all pass plays)
        team_routes = pbp_week[pbp_week['pass_attempt'] == 1].groupby('posteam').size().to_dict()
        receiver_stats['routes_total'] = receiver_stats['team'].map(team_routes)
        
        # Estimate alignment (65% outside, 35% slot for now)
        receiver_stats['routes_outside'] = (receiver_stats['targets'] * 0.65).astype(int)
        receiver_stats['routes_slot'] = (receiver_stats['targets'] * 0.35).astype(int)
        receiver_stats['alignment_outside_pct'] = (receiver_stats['routes_outside'] / receiver_stats['routes_total'] * 100).round(2)
        receiver_stats['alignment_slot_pct'] = (receiver_stats['routes_slot'] / receiver_stats['routes_total'] * 100).round(2)
        
        # Target share per team
        team_targets = receiver_stats.groupby('team')['targets'].sum().to_dict()
        receiver_stats['target_share_pct'] = (
            receiver_stats.apply(lambda row: row['targets'] / team_targets.get(row['team'], 1) * 100, axis=1)
        ).round(2)
        
        for _, row in receiver_stats.iterrows():
            usage_records.append({
                'player_id': row['player_id'],
                'week': week,
                'season': season,
                'targets': int(row['targets']),
                'routes_total': int(row['routes_total']),
                'routes_outside': int(row['routes_outside']),
                'routes_slot': int(row['routes_slot']),
                'alignment_outside_pct': float(row['alignment_outside_pct']),
                'alignment_slot_pct': float(row['alignment_slot_pct']),
                'target_share_pct': float(row['target_share_pct']),
            })
    
    # RB Carries
    rushes = pbp_week[
        (pbp_week['play_type'] == 'run') & 
        (pbp_week['rusher_player_id'].notna())
    ].copy()
    
    if len(rushes) > 0:
        rushes['is_gap'] = rushes['run_gap'].isin(['guard', 'tackle']).fillna(False)
        
        rusher_stats = rushes.groupby(['rusher_player_id', 'posteam']).agg({
            'play_id': 'count',
            'is_gap': 'sum',
        }).reset_index()
        rusher_stats.columns = ['player_id', 'team', 'carries_total', 'carries_gap']
        rusher_stats['carries_zone'] = rusher_stats['carries_total'] - rusher_stats['carries_gap']
        
        for _, row in rusher_stats.iterrows():
            usage_records.append({
                'player_id': row['player_id'],
                'week': week,
                'season': season,
                'carries_total': int(row['carries_total']),
                'carries_gap': int(row['carries_gap']),
                'carries_zone': int(row['carries_zone']),
            })
    
    print(f"✅ Extracted {len(usage_records)} usage records", file=sys.stderr)
    return usage_records

def save_usage_data(usage_records):
    """Save usage records to database with upsert"""
    if not usage_records:
        print("⚠️  No records to save", file=sys.stderr)
        return
    
    conn = get_db_connection()
    cur = conn.cursor()
    
    try:
        values = []
        for record in usage_records:
            values.append((
                record.get('player_id'),
                None,  # sleeper_id (populated separately)
                record.get('week'),
                record.get('season'),
                record.get('routes_total'),
                record.get('routes_outside'),
                record.get('routes_slot'),
                None,  # routes_inline
                record.get('alignment_outside_pct'),
                record.get('alignment_slot_pct'),
                None,  # snaps
                None,  # snap_share_pct
                record.get('target_share_pct'),
                record.get('targets'),
                record.get('carries_gap'),
                record.get('carries_zone'),
                record.get('carries_total'),
            ))
        
        execute_values(cur, """
            INSERT INTO player_usage 
            (player_id, sleeper_id, week, season, routes_total, routes_outside, routes_slot, routes_inline,
             alignment_outside_pct, alignment_slot_pct, snaps, snap_share_pct, target_share_pct, targets,
             carries_gap, carries_zone, carries_total)
            VALUES %s
            ON CONFLICT (player_id, week, season) DO UPDATE
            SET routes_total = EXCLUDED.routes_total,
                routes_outside = EXCLUDED.routes_outside,
                routes_slot = EXCLUDED.routes_slot,
                alignment_outside_pct = EXCLUDED.alignment_outside_pct,
                alignment_slot_pct = EXCLUDED.alignment_slot_pct,
                target_share_pct = EXCLUDED.target_share_pct,
                targets = EXCLUDED.targets,
                carries_gap = EXCLUDED.carries_gap,
                carries_zone = EXCLUDED.carries_zone,
                carries_total = EXCLUDED.carries_total,
                updated_at = CURRENT_TIMESTAMP
        """, values)
        
        conn.commit()
        print(f"✅ Saved {len(values)} usage records to database", file=sys.stderr)
        
    except Exception as e:
        conn.rollback()
        print(f"❌ Error saving data: {e}", file=sys.stderr)
        raise
    finally:
        cur.close()
        conn.close()

def main():
    """Main execution"""
    if len(sys.argv) < 3:
        print("Usage: python updatePlayerUsage.py [season] [week]", file=sys.stderr)
        print("Example: python updatePlayerUsage.py 2025 4", file=sys.stderr)
        sys.exit(1)
    
    season = int(sys.argv[1])
    week = int(sys.argv[2])
    
    print(f"🏈 Updating player usage for {season} Week {week}", file=sys.stderr)
    
    # Download play-by-play data
    pbp = download_pbp_data(season)
    
    if pbp is None:
        print(f"❌ Failed to download data. Exiting.", file=sys.stderr)
        sys.exit(1)
    
    # Calculate usage for specified week
    usage_records = calculate_week_usage(pbp, week, season)
    
    # Save to database
    save_usage_data(usage_records)
    
    print(f"✅ Player usage update complete!", file=sys.stderr)
    print(f'{{"success": true, "season": {season}, "week": {week}, "records": {len(usage_records)}}}')

if __name__ == "__main__":
    main()
