#!/usr/bin/env python3
"""
Import nflverse pbp_participation data into bronze_pbp_participation table.
Downloads parquet, unnests offense_players (semicolon-separated GSIS IDs),
and bulk inserts one row per play per offensive player.

Usage:
  python3 server/scripts/import_pbp_participation.py          # defaults to 2025
  python3 server/scripts/import_pbp_participation.py 2025
  python3 server/scripts/import_pbp_participation.py 2024,2025
"""

import pandas as pd
import psycopg2
from psycopg2.extras import execute_batch
import os
import sys

BATCH_SIZE = 5000

def import_participation(season: int):
    DATABASE_URL = os.getenv('DATABASE_URL')
    if not DATABASE_URL:
        raise ValueError("DATABASE_URL environment variable not set")

    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()

    url = f"https://github.com/nflverse/nflverse-data/releases/download/pbp_participation/pbp_participation_{season}.parquet"
    print(f"Downloading {season} pbp_participation parquet...")
    df = pd.read_parquet(url)
    print(f"Loaded {len(df):,} plays from {season}")

    # Filter to rows with offense_players data
    df = df[df['offense_players'].notna() & (df['offense_players'] != '')]
    print(f"Plays with offense_players data: {len(df):,}")

    # Clear existing data for this season
    cur.execute("DELETE FROM bronze_pbp_participation WHERE season = %s", (season,))
    deleted = cur.rowcount
    if deleted > 0:
        print(f"Cleared {deleted:,} existing rows for season {season}")

    # Unnest offense_players into individual rows
    records = []
    for _, row in df.iterrows():
        game_id = str(row['nflverse_game_id']) if pd.notna(row['nflverse_game_id']) else None
        play_id = str(row['play_id']) if pd.notna(row['play_id']) else None
        offense_players = str(row['offense_players']) if pd.notna(row['offense_players']) else ''

        if not game_id or not play_id or not offense_players:
            continue

        for gsis_id in offense_players.split(';'):
            gsis_id = gsis_id.strip()
            if gsis_id and gsis_id.startswith('00-'):
                records.append((game_id, play_id, season, gsis_id))

    print(f"Prepared {len(records):,} participation rows ({len(records) / max(len(df), 1):.1f} players/play avg)")

    # Bulk insert
    insert_sql = """
        INSERT INTO bronze_pbp_participation (game_id, play_id, season, gsis_id)
        VALUES (%s, %s, %s, %s)
        ON CONFLICT (game_id, play_id, gsis_id) DO NOTHING
    """

    total_inserted = 0
    for i in range(0, len(records), BATCH_SIZE):
        batch = records[i:i + BATCH_SIZE]
        execute_batch(cur, insert_sql, batch, page_size=1000)
        total_inserted += len(batch)
        if total_inserted % 50000 == 0 or total_inserted == len(records):
            print(f"  Inserted {total_inserted:,} / {len(records):,} rows...")

    conn.commit()

    # Verify
    cur.execute("SELECT COUNT(*) FROM bronze_pbp_participation WHERE season = %s", (season,))
    final_count = cur.fetchone()[0]
    print(f"Done. {final_count:,} participation rows for {season}")

    cur.close()
    conn.close()


def parse_seasons(arg: str) -> list:
    if not arg:
        return [2025]
    return [int(s.strip()) for s in arg.split(',') if s.strip().isdigit()]


if __name__ == '__main__':
    seasons = parse_seasons(sys.argv[1] if len(sys.argv) > 1 else '')
    for season in seasons:
        import_participation(season)
    print("All done.")
