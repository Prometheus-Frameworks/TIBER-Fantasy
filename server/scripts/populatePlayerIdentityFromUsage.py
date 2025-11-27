#!/usr/bin/env python3
"""
Populate player_identity_map from player_usage data
Maps GSIS IDs from nflfastR to canonical player system
"""

import pandas as pd
import psycopg2
import os
import sys
import requests
from io import BytesIO

def get_db_connection():
    return psycopg2.connect(os.getenv('DATABASE_URL'))

def download_roster_data(season):
    """Download roster data with player names and GSIS IDs"""
    print(f"📥 Downloading {season} roster data from nflfastR...", file=sys.stderr)
    
    url = f"https://github.com/nflverse/nflverse-data/releases/download/rosters/roster_{season}.parquet"
    
    try:
        response = requests.get(url, timeout=60)
        response.raise_for_status()
        
        rosters = pd.read_parquet(BytesIO(response.content))
        print(f"✅ Downloaded {len(rosters)} players", file=sys.stderr)
        return rosters
        
    except Exception as e:
        print(f"❌ Error downloading roster: {e}", file=sys.stderr)
        return None

def populate_players(season=2024):
    """Populate player_identity_map from roster data"""
    
    # Download rosters for the specified season
    rosters = download_roster_data(season)
    if rosters is None:
        return
    
    # Filter to skill positions
    skill_positions = ['QB', 'RB', 'WR', 'TE']
    rosters = rosters[rosters['position'].isin(skill_positions)].copy()
    
    print(f"📊 Processing {len(rosters)} skill position players", file=sys.stderr)
    
    conn = get_db_connection()
    cur = conn.cursor()
    
    try:
        # Prepare batch insert data
        players_to_insert = []
        
        for _, player in rosters.iterrows():
            gsis_id = player.get('gsis_id')
            full_name = player.get('full_name')
            position = player.get('position')
            team = player.get('team')
            first_name = player.get('first_name', '')
            last_name = player.get('last_name', '')
            
            if not gsis_id or not full_name:
                continue
            
            # Create canonical_id from name (lowercase, hyphenated)
            canonical_id = full_name.lower().replace(' ', '-').replace('.', '').replace("'", '')
            
            players_to_insert.append((
                canonical_id, full_name, first_name, last_name, 
                position, team, gsis_id
            ))
        
        # Batch upsert using ON CONFLICT
        from psycopg2.extras import execute_values
        
        execute_values(cur, """
            INSERT INTO player_identity_map 
            (canonical_id, full_name, first_name, last_name, position, nfl_team, nfl_data_py_id, is_active)
            VALUES %s
            ON CONFLICT (canonical_id) DO UPDATE
            SET nfl_data_py_id = EXCLUDED.nfl_data_py_id,
                nfl_team = EXCLUDED.nfl_team,
                position = EXCLUDED.position,
                full_name = EXCLUDED.full_name,
                first_name = EXCLUDED.first_name,
                last_name = EXCLUDED.last_name
        """, [(p[0], p[1], p[2], p[3], p[4], p[5], p[6], True) for p in players_to_insert])
        
        conn.commit()
        print(f"✅ Populated player_identity_map: {len(players_to_insert)} players", file=sys.stderr)
        
    except Exception as e:
        conn.rollback()
        print(f"❌ Error populating players: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
    finally:
        cur.close()
        conn.close()

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description='Populate player identity map from roster data')
    parser.add_argument('season', type=int, nargs='?', default=2024, help='NFL season year (default: 2024)')
    args = parser.parse_args()
    populate_players(args.season)
