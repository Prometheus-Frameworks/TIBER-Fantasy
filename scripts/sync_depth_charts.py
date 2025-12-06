#!/usr/bin/env python3
"""
Sync depth chart data from nflverse to the depth_charts table.
Maps player names to canonical IDs using player_identity_map.
"""

import os
from datetime import date
import pandas as pd
import nfl_data_py as nfl
import psycopg2
from psycopg2.extras import execute_values

DATABASE_URL = os.environ.get('DATABASE_URL')

def get_db_connection():
    return psycopg2.connect(DATABASE_URL)

def get_canonical_id_map(conn):
    """Build a mapping from (full_name, team) -> canonical_id"""
    cursor = conn.cursor()
    cursor.execute("""
        SELECT canonical_id, full_name, nfl_team, nflfastr_gsis_id, position
        FROM player_identity_map
        WHERE position IN ('QB', 'RB', 'WR', 'TE')
    """)
    
    name_map = {}
    gsis_map = {}
    for row in cursor.fetchall():
        canonical_id, full_name, team, gsis_id, position = row
        if full_name and team:
            key = (full_name.lower().strip(), team.upper())
            name_map[key] = canonical_id
        if gsis_id:
            gsis_map[gsis_id] = canonical_id
    
    cursor.close()
    return name_map, gsis_map

def sync_depth_charts(season=2024):
    """Sync depth charts from nflverse to database."""
    
    print(f"📈 Fetching {season} depth charts from nflverse...")
    
    df = nfl.import_depth_charts([season])
    print(f"✅ Loaded {len(df):,} depth chart records")
    
    # Filter to skill positions only
    skill_positions = ['QB', 'RB', 'WR', 'TE']
    df = df[df['position'].isin(skill_positions)]
    print(f"📋 Filtered to {len(df):,} skill position records")
    
    # Get the latest week for each player/team/position
    df = df.sort_values('week', ascending=False)
    df_latest = df.groupby(['full_name', 'club_code', 'position']).first().reset_index()
    print(f"📊 Latest depth chart: {len(df_latest):,} unique player/team/position entries")
    
    conn = get_db_connection()
    name_map, gsis_map = get_canonical_id_map(conn)
    
    # Clear existing depth charts for this season
    cursor = conn.cursor()
    cursor.execute("DELETE FROM depth_charts WHERE season = %s", (season,))
    print(f"🗑️ Cleared existing depth charts for season {season}")
    
    # Insert new records
    inserts = []
    matched = 0
    unmatched = []
    
    for _, row in df_latest.iterrows():
        full_name = row.get('full_name', '')
        team = row.get('club_code', '')
        position = row.get('position', '')
        depth_order = int(row.get('depth_team', 1))
        gsis_id = row.get('gsis_id', '')
        week = int(row.get('week', 0)) if pd.notna(row.get('week')) else None
        
        # Try to match by gsis_id first, then by name+team
        canonical_id = None
        if gsis_id and gsis_id in gsis_map:
            canonical_id = gsis_map[gsis_id]
        else:
            name_key = (full_name.lower().strip(), team.upper())
            canonical_id = name_map.get(name_key)
        
        if canonical_id:
            inserts.append((
                canonical_id,
                team,
                position,
                position,  # position_group
                depth_order,
                season,
                week,
                'starter' if depth_order == 1 else 'backup' if depth_order == 2 else 'depth',
                'nfl_data_py',  # source
                date.today().isoformat()  # effective_date
            ))
            matched += 1
        else:
            if depth_order <= 2:  # Only log top-2 depth players
                unmatched.append(f"{full_name} ({team} {position})")
    
    if inserts:
        execute_values(cursor, """
            INSERT INTO depth_charts 
            (canonical_player_id, team_code, position, position_group, depth_order, season, week, role, source, effective_date)
            VALUES %s
            ON CONFLICT DO NOTHING
        """, inserts)
    
    conn.commit()
    cursor.close()
    conn.close()
    
    print(f"✅ Inserted {matched} depth chart records")
    if unmatched[:10]:
        print(f"⚠️ Unmatched top-2 depth players: {unmatched[:10]}")
    
    return matched

if __name__ == "__main__":
    sync_depth_charts(2024)
