#!/usr/bin/env python3
"""
Import NFLfastR 2025 play-by-play data to Bronze layer
Downloads parquet file and loads into PostgreSQL
"""

import pandas as pd
import psycopg2
from psycopg2.extras import Json
import os
from urllib.request import urlretrieve

def import_nflfastr_2025():
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
    
    # Insert in batches
    batch_size = 1000
    total_inserted = 0
    total_skipped = 0
    
    for i in range(0, len(df), batch_size):
        batch = df.iloc[i:i+batch_size]
        
        for _, row in batch.iterrows():
            try:
                cur.execute("""
                    INSERT INTO bronze_nflfastr_plays (
                        play_id, game_id, season, week, posteam, defteam, play_type,
                        passer_player_id, passer_player_name,
                        receiver_player_id, receiver_player_name,
                        rusher_player_id, rusher_player_name,
                        epa, air_epa, comp_air_epa, wpa, air_yards, yards_after_catch, yards_gained,
                        complete_pass, incomplete_pass, interception, touchdown,
                        raw_data
                    ) VALUES (
                        %s, %s, %s, %s, %s, %s, %s,
                        %s, %s, %s, %s, %s, %s,
                        %s, %s, %s, %s, %s, %s,
                        %s, %s, %s, %s, %s
                    )
                    ON CONFLICT (play_id) DO NOTHING
                """, (
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
                    float(row.get('air_epa')) if pd.notna(row.get('air_epa')) else None,
                    float(row.get('comp_air_epa')) if pd.notna(row.get('comp_air_epa')) else None,
                    float(row.get('wpa')) if pd.notna(row.get('wpa')) else None,
                    int(row.get('air_yards')) if pd.notna(row.get('air_yards')) else None,
                    int(row.get('yards_after_catch')) if pd.notna(row.get('yards_after_catch')) else None,
                    int(row.get('yards_gained')) if pd.notna(row.get('yards_gained')) else None,
                    bool(row.get('complete_pass')) if pd.notna(row.get('complete_pass')) else False,
                    bool(row.get('incomplete_pass')) if pd.notna(row.get('incomplete_pass')) else False,
                    bool(row.get('interception')) if pd.notna(row.get('interception')) else False,
                    bool(row.get('touchdown')) if pd.notna(row.get('touchdown')) else False,
                    Json({k: (None if pd.isna(v) else v) for k, v in row.to_dict().items()})
                ))
                total_inserted += 1
            except Exception as e:
                total_skipped += 1
                if total_skipped < 10:  # Only print first 10 errors
                    print(f"⚠️  Error inserting play {row.get('play_id')}: {e}")
                continue
        
        conn.commit()
        print(f"✅ Inserted batch {i//batch_size + 1} ({total_inserted} total, {total_skipped} skipped)")
    
    cur.close()
    conn.close()
    
    print(f"\n🎉 Import complete! {total_inserted} plays loaded into bronze_nflfastr_plays")
    print(f"📊 Skipped {total_skipped} plays (likely duplicates or invalid data)")

if __name__ == "__main__":
    import_nflfastr_2025()
