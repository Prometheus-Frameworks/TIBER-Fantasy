#!/usr/bin/env python3
"""
Calculate Player Usage Metrics from nflfastR Play-by-Play Data

This script downloads 2025 play-by-play data directly from nflfastR's GitHub repository
and processes it to extract:
- WR alignment splits (outside/slot)
- Target share and snap share
- RB rushing concept splits (gap/zone)
"""

import pandas as pd
import psycopg2
from psycopg2.extras import execute_values
import os
import sys
import requests
from io import BytesIO

def get_db_connection():
    """Create PostgreSQL connection from DATABASE_URL"""
    return psycopg2.connect(os.getenv('DATABASE_URL'))

def build_player_name_mapping():
    """
    Build mapping from (name, team) to canonical player ID
    Returns dict: {(normalized_name, team): canonical_id}
    """
    print(f"🔗 Building player name mapping from database...", file=sys.stderr)
    
    conn = get_db_connection()
    cur = conn.cursor()
    
    try:
        cur.execute("""
            SELECT canonical_id, full_name, nfl_team, position
            FROM player_identity_map
            WHERE nfl_team IS NOT NULL
        """)
        
        name_to_canonical = {}
        
        for canonical_id, full_name, team, position in cur.fetchall():
            # Normalize name (lowercase, remove periods, extra spaces)
            normalized_name = full_name.lower().replace('.', '').replace('  ', ' ').strip()
            key = (normalized_name, team)
            name_to_canonical[key] = canonical_id
        
        print(f"✅ Loaded {len(name_to_canonical)} player name mappings", file=sys.stderr)
        
        return name_to_canonical
        
    except Exception as e:
        print(f"❌ Error building player mapping: {e}", file=sys.stderr)
        return {}
    finally:
        cur.close()
        conn.close()

def map_player_to_canonical(player_name, team, name_mapping):
    """Map nflfastR player name to canonical ID"""
    if not player_name or not team:
        return None
    
    # Normalize the name
    normalized = player_name.lower().replace('.', '').replace('  ', ' ').strip()
    key = (normalized, team)
    
    return name_mapping.get(key)

def download_pbp_data(season):
    """Download play-by-play data directly from nflfastR GitHub repository"""
    print(f"📥 Downloading {season} play-by-play data from nflfastR repository...", file=sys.stderr)
    
    # nflfastR data is hosted on GitHub releases
    url = f"https://github.com/nflverse/nflverse-data/releases/download/pbp/play_by_play_{season}.parquet"
    
    try:
        response = requests.get(url, timeout=60)
        response.raise_for_status()
        
        # Load parquet file from bytes
        pbp = pd.read_parquet(BytesIO(response.content))
        print(f"✅ Downloaded {len(pbp)} plays from {season} season", file=sys.stderr)
        return pbp
        
    except requests.exceptions.RequestException as e:
        print(f"❌ Error downloading data: {e}", file=sys.stderr)
        print(f"⚠️  URL attempted: {url}", file=sys.stderr)
        return None
    except Exception as e:
        print(f"❌ Error loading parquet file: {e}", file=sys.stderr)
        return None

def calculate_wr_usage(pbp, week, name_mapping):
    """Calculate WR usage metrics from play-by-play data"""
    print(f"📊 Calculating WR usage for Week {week}...", file=sys.stderr)
    
    try:
        # Filter to specific week
        pbp_week = pbp[pbp['week'] == week].copy()
        
        if len(pbp_week) == 0:
            print(f"⚠️  No data found for Week {week}", file=sys.stderr)
            return pd.DataFrame()
        
        # Filter to pass plays with targets
        targets = pbp_week[
            (pbp_week['pass_attempt'] == 1) & 
            (pbp_week['receiver_player_id'].notna())
        ].copy()
        
        if len(targets) == 0:
            print(f"⚠️  No target data found for Week {week}", file=sys.stderr)
            return pd.DataFrame()
        
        # Group by receiver
        wr_usage = targets.groupby(['receiver_player_id', 'receiver_player_name', 'posteam']).agg({
            'pass_attempt': 'count',  # Total targets
        }).reset_index()
        
        wr_usage.columns = ['player_id', 'player_name', 'team', 'targets']
        
        # Calculate routes run (approximation - all pass plays player was on field)
        routes = pbp_week[pbp_week['pass_attempt'] == 1].groupby('posteam').size().to_dict()
        wr_usage['routes_total'] = wr_usage['team'].map(routes)
        
        # Calculate alignment splits from receiver_alignment column if available
        # Otherwise use approximation based on targets
        if 'receiver_alignment' in targets.columns:
            # Use actual alignment data
            alignment_data = targets.groupby('receiver_player_id').apply(
                lambda x: pd.Series({
                    'routes_outside': len(x[x['receiver_alignment'].isin(['left', 'right'])]),
                    'routes_slot': len(x[x['receiver_alignment'] == 'slot']),
                })
            ).reset_index()
        else:
            # Estimate alignment based on target distribution
            alignment_data = targets.groupby('receiver_player_id').apply(
                lambda x: pd.Series({
                    'routes_outside': int(len(x) * 0.65),  # Estimate: 65% outside
                    'routes_slot': int(len(x) * 0.35),     # Estimate: 35% slot
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
        
        # Map to canonical player IDs
        wr_usage['canonical_id'] = wr_usage.apply(
            lambda row: map_player_to_canonical(row['player_name'], row['team'], name_mapping),
            axis=1
        )
        
        # Filter out players we couldn't map
        mapped_count = wr_usage['canonical_id'].notna().sum()
        wr_usage = wr_usage[wr_usage['canonical_id'].notna()].copy()
        
        print(f"✅ Processed {len(wr_usage)} WR records ({mapped_count} mapped to canonical IDs)", file=sys.stderr)
        return wr_usage
        
    except Exception as e:
        print(f"❌ Error calculating WR usage: {e}", file=sys.stderr)
        return pd.DataFrame()

def calculate_rb_usage(pbp, week, name_mapping):
    """Calculate RB usage metrics from play-by-play data"""
    print(f"🏃 Calculating RB usage for Week {week}...", file=sys.stderr)
    
    try:
        # Filter to specific week
        pbp_week = pbp[pbp['week'] == week].copy()
        
        # Filter to rush plays
        rush_plays = pbp_week[
            (pbp_week['play_type'] == 'run') & 
            (pbp_week['rusher_player_id'].notna())
        ].copy()
        
        if len(rush_plays) == 0:
            print(f"⚠️  No rushing data found for Week {week}", file=sys.stderr)
            return pd.DataFrame()
        
        # Identify gap vs zone based on run_gap and run_location
        # Gap concepts: guard, tackle (between gaps)
        # Zone concepts: end, outside (wider runs)
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
        
        # Add receiving targets for RBs
        targets = pbp_week[
            (pbp_week['pass_attempt'] == 1) & 
            (pbp_week['receiver_player_id'].notna())
        ]
        
        rb_targets = targets.groupby(['receiver_player_id', 'posteam']).size().reset_index(name='targets')
        rb_usage = rb_usage.merge(
            rb_targets, 
            left_on=['player_id', 'team'], 
            right_on=['receiver_player_id', 'posteam'],
            how='left'
        )
        rb_usage['targets'] = rb_usage['targets'].fillna(0).astype(int)
        
        # Calculate target share for pass-catching RBs
        team_targets = targets.groupby('posteam').size().to_dict()
        rb_usage['target_share_pct'] = rb_usage.apply(
            lambda row: (row['targets'] / team_targets.get(row['team'], 1) * 100) if row['targets'] > 0 else 0, 
            axis=1
        ).round(2)
        
        # Map to canonical player IDs
        rb_usage['canonical_id'] = rb_usage.apply(
            lambda row: map_player_to_canonical(row['player_name'], row['team'], name_mapping),
            axis=1
        )
        
        # Filter out players we couldn't map
        mapped_count = rb_usage['canonical_id'].notna().sum()
        rb_usage = rb_usage[rb_usage['canonical_id'].notna()].copy()
        
        print(f"✅ Processed {len(rb_usage)} RB records ({mapped_count} mapped to canonical IDs)", file=sys.stderr)
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
            str(row.get('canonical_id', '')),  # Use canonical_id instead of GSIS player_id
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
    season = int(sys.argv[1]) if len(sys.argv) > 1 else 2025
    week = int(sys.argv[2]) if len(sys.argv) > 2 else 1
    
    print(f"🏈 Starting player usage calculation for {season} Week {week}", file=sys.stderr)
    
    # Build player name mapping
    name_mapping = build_player_name_mapping()
    
    # Download play-by-play data
    pbp = download_pbp_data(season)
    
    if pbp is None:
        print(f"❌ Failed to download data. Exiting.", file=sys.stderr)
        sys.exit(1)
    
    # Calculate WR and RB usage
    wr_data = calculate_wr_usage(pbp, week, name_mapping)
    rb_data = calculate_rb_usage(pbp, week, name_mapping)
    
    # Combine all data
    all_data = pd.concat([wr_data, rb_data], ignore_index=True)
    
    # Save to database
    save_to_database(all_data, week, season)
    
    print(f"✅ Player usage calculation complete!", file=sys.stderr)
    print(f'{{"success": true, "season": {season}, "week": {week}, "records": {len(all_data)}}}')

if __name__ == "__main__":
    main()
