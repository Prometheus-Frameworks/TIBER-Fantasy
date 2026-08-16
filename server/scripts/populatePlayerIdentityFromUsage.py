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

def refuse_if_canonical_identity_contract_present(cur):
    """Fantasy #327/#329 retirement guard — do not remove.

    Once the registry carries the canonical `tiber_player_id` contract
    (migration 0014), every insert path must mint the canonical identity at
    birth through the single governed TypeScript mint
    (server/services/identity/tiberPlayerId.ts). This script predates that
    contract, inserts rows without a canonical identity, and mints name-slug
    canonical_ids — so it is retired: it hard-fails rather than reopening
    the active-null population behind the backfill.
    """
    cur.execute(
        """
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'player_identity_map'
          AND column_name = 'tiber_player_id'
        """
    )
    if cur.fetchone() is not None:
        print(
            "❌ RETIRED: player_identity_map now carries the canonical "
            "tiber_player_id contract (Fantasy #327). This script cannot mint "
            "canonical identities and would create active rows with NULL "
            "tiber_player_id. Use the governed registry paths instead "
            "(PlayerIdentityService / PlayersDimProcessor), then verify with "
            "censusTiberPlayerIds().",
            file=sys.stderr,
        )
        sys.exit(1)


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
    refuse_if_canonical_identity_contract_present(cur)
    
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
            (canonical_id, full_name, first_name, last_name, position, nfl_team, nfl_data_py_id, gsis_id, is_active)
            VALUES %s
            ON CONFLICT (canonical_id) DO UPDATE
            SET nfl_data_py_id = EXCLUDED.nfl_data_py_id,
                gsis_id = COALESCE(player_identity_map.gsis_id, EXCLUDED.gsis_id),
                nfl_team = EXCLUDED.nfl_team,
                position = EXCLUDED.position,
                full_name = EXCLUDED.full_name,
                first_name = EXCLUDED.first_name,
                last_name = EXCLUDED.last_name
        """, [(p[0], p[1], p[2], p[3], p[4], p[5], p[6], p[6], True) for p in players_to_insert])
        
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
