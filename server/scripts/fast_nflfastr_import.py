#!/usr/bin/env python3
"""
Fast NFLfastR import using COPY FROM
"""
import pandas as pd
import psycopg2
import os
import csv
from io import StringIO

DATABASE_URL = os.getenv('DATABASE_URL')
conn = psycopg2.connect(DATABASE_URL)
cur = conn.cursor()

# Download fresh data
from urllib.request import urlretrieve
url = "https://github.com/nflverse/nflverse-data/releases/download/pbp/play_by_play_2025.parquet"
local_file = "/tmp/nfl_2025_pbp.parquet"

print("📥 Downloading 2025 NFLfastR data...")
urlretrieve(url, local_file)

# Load and prepare
print("📊 Loading parquet...")
df = pd.read_parquet(local_file)
print(f"✅ Loaded {len(df):,} plays")

# Show week breakdown
print("\n📊 Week breakdown:")
for week in sorted(df['week'].unique()):
    count = len(df[df['week'] == week])
    print(f"   Week {week}: {count} plays")

# Prepare CSV
print("\n🔄 Preparing bulk insert...")
buffer = StringIO()
writer = csv.writer(buffer)

for _, row in df.iterrows():
    writer.writerow([
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
        '1' if row.get('complete_pass') == 1.0 else '0',
        '1' if row.get('incomplete_pass') == 1.0 else '0',
        '1' if row.get('interception') == 1.0 else '0',
        '1' if row.get('touchdown') == 1.0 else '0',
        '1' if pd.notna(row.get('first_down')) and row.get('first_down') == 1.0 else '0',
        '1' if pd.notna(row.get('first_down_rush')) and row.get('first_down_rush') == 1.0 else '0',
        '1' if pd.notna(row.get('first_down_pass')) and row.get('first_down_pass') == 1.0 else '0',
    ])

buffer.seek(0)

# COPY import (fast!)
print("🚀 Bulk loading via COPY...")
# Create temp table and load
cur.execute("CREATE TEMP TABLE temp_plays (LIKE bronze_nflfastr_plays INCLUDING DEFAULTS)")
cur.copy_expert("""
    COPY temp_plays (
        play_id, game_id, season, week, posteam, defteam, play_type,
        passer_player_id, passer_player_name,
        receiver_player_id, receiver_player_name,
        rusher_player_id, rusher_player_name,
        epa, wpa, air_yards, yards_after_catch, yards_gained,
        complete_pass, incomplete_pass, interception, touchdown,
        first_down, first_down_rush, first_down_pass
    ) FROM STDIN WITH CSV NULL ''
""", buffer)

# Insert from temp with conflict handling on composite key
cur.execute("""
    INSERT INTO bronze_nflfastr_plays 
    SELECT * FROM temp_plays 
    ON CONFLICT (game_id, play_id) DO NOTHING
""")

conn.commit()
cur.close()
conn.close()

print(f"\n✅ Import complete! {len(df):,} plays loaded")
