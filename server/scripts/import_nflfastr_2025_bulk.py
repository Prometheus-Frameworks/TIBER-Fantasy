#!/usr/bin/env python3
"""
Import NFLfastR 2025 play-by-play data to Bronze layer (BULK INSERT optimized)
Downloads parquet file and loads into PostgreSQL using bulk inserts
"""

import pandas as pd
import psycopg2
from psycopg2.extras import execute_batch, Json
import os
from urllib.request import urlretrieve

def import_nflfastr_2025_bulk():
    # Database connection
    DATABASE_URL = os.getenv('DATABASE_URL')
    if not DATABASE_URL:
        raise ValueError("DATABASE_URL environment variable not set")
    
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()
    
    # Download 2025 NFLfastR data
    url = "https://github.com/nflverse/nflverse-data/releases/download/pbp/play_by_play_2025.parquet"
    local_file = "/tmp/nfl_2025_pbp.parquet"
    
    print("📥 Downloading 2025 NFL play-by-play data from NFLfastR...")
    urlretrieve(url, local_file)
    
    # Load parquet
    print("📊 Loading parquet file...")
    df = pd.read_parquet(local_file)
    print(f"✅ Loaded {len(df):,} plays from 2025 NFL season")
    
    # Show week breakdown
    print("\n📊 Week breakdown:")
    week_counts = df.groupby('week').size().reset_index(name='count')
    for _, row in week_counts.iterrows():
        print(f"   Week {row['week']}: {row['count']} plays")
    
    # Prepare data for bulk insert
    print("\n🔄 Preparing data for bulk insert...")
    records = []
    
    for _, row in df.iterrows():
        # Convert first down floats (1.0/0.0) to booleans
        first_down_pass = bool(row.get('first_down_pass')) if pd.notna(row.get('first_down_pass')) and row.get('first_down_pass') == 1.0 else False
        first_down_rush = bool(row.get('first_down_rush')) if pd.notna(row.get('first_down_rush')) and row.get('first_down_rush') == 1.0 else False
        
        record = (
            str(row.get('play_id')) if pd.notna(row.get('play_id')) else None,
            str(row.get('game_id')) if pd.notna(row.get('game_id')) else None,
            int(row.get('season')) if pd.notna(row.get('season')) else None,
            int(row.get('week')) if pd.notna(row.get('week')) else None,
            str(row.get('posteam')) if pd.notna(row.get('posteam')) else None,
            str(row.get('defteam')) if pd.notna(row.get('defteam')) else None,
            str(row.get('play_type')) if pd.notna(row.get('play_type')) else None,
            str(row.get('passer_player_id')) if pd.notna(row.get('passer_player_id')) else None,
            str(row.get('passer_player_name')) if pd.notna(row.get('passer_player_name')) else None,
            str(row.get('receiver_player_id')) if pd.notna(row.get('receiver_player_id')) else None,
            str(row.get('receiver_player_name')) if pd.notna(row.get('receiver_player_name')) else None,
            str(row.get('rusher_player_id')) if pd.notna(row.get('rusher_player_id')) else None,
            str(row.get('rusher_player_name')) if pd.notna(row.get('rusher_player_name')) else None,
            float(row.get('epa')) if pd.notna(row.get('epa')) else None,
            float(row.get('wpa')) if pd.notna(row.get('wpa')) else None,
            int(row.get('air_yards')) if pd.notna(row.get('air_yards')) else None,
            int(row.get('yards_after_catch')) if pd.notna(row.get('yards_after_catch')) else None,
            int(row.get('yards_gained')) if pd.notna(row.get('yards_gained')) else None,
            bool(row.get('complete_pass')) if pd.notna(row.get('complete_pass')) else False,
            bool(row.get('incomplete_pass')) if pd.notna(row.get('incomplete_pass')) else False,
            bool(row.get('interception')) if pd.notna(row.get('interception')) else False,
            bool(row.get('touchdown')) if pd.notna(row.get('touchdown')) else False,
            first_down_pass,  # Added first down pass
            first_down_rush,  # Added first down rush
            Json({k: (None if pd.isna(v) else v) for k, v in row.to_dict().items()})
        )
        records.append(record)
    
    # Delete existing 2025 data first to avoid conflicts
    print("🗑️  Deleting existing 2025 data...")
    cur.execute("DELETE FROM bronze_nflfastr_plays WHERE season = 2025")
    conn.commit()
    print(f"   Deleted {cur.rowcount} existing plays")
    
    # Bulk insert using execute_batch (much faster)
    print(f"🚀 Bulk inserting {len(records):,} plays...")
    
    execute_batch(cur, """
        INSERT INTO bronze_nflfastr_plays (
            play_id, game_id, season, week, posteam, defteam, play_type,
            passer_player_id, passer_player_name,
            receiver_player_id, receiver_player_name,
            rusher_player_id, rusher_player_name,
            epa, wpa, air_yards, yards_after_catch, yards_gained,
            complete_pass, incomplete_pass, interception, touchdown,
            first_down_pass, first_down_rush,
            raw_data
        ) VALUES (
            %s, %s, %s, %s, %s, %s, %s,
            %s, %s, %s, %s, %s, %s,
            %s, %s, %s, %s, %s,
            %s, %s, %s, %s,
            %s, %s, %s
        )
    """, records, page_size=500)
    
    conn.commit()
    
    # Verify import
    cur.execute("""
        SELECT week, COUNT(*) as count 
        FROM bronze_nflfastr_plays 
        WHERE season = 2025 
        GROUP BY week 
        ORDER BY week
    """)
    results = cur.fetchall()
    
    print("\n✅ Import complete! Week breakdown in database:")
    for week, count in results:
        print(f"   Week {week}: {count} plays")
    
    cur.close()
    conn.close()
    
    print(f"\n🎉 Successfully loaded 2025 NFLfastR data into bronze_nflfastr_plays")

if __name__ == "__main__":
    import_nflfastr_2025_bulk()
