#!/usr/bin/env python3
"""
Backfill bronze_nflfastr_plays with QB/formation columns for 2025 season.

New columns added to schema (none existed before):
  sack                boolean   -- sack indicator
  qb_hit              boolean   -- QB was hit on the play
  cpoe                real      -- completion percentage over expected
  shotgun             boolean   -- QB lined up in shotgun
  no_huddle           boolean   -- no-huddle / hurry-up offense
  scramble            boolean   -- QB scramble (qb_scramble in nflfastR)
  game_seconds_remaining real   -- seconds left in the game

Source: nflverse play_by_play_2025.parquet
Match key: play_id + game_id (unique in bronze via bronze_nflfastr_game_play_unique)
"""

import pandas as pd
import psycopg2
from psycopg2.extras import execute_batch
import os
from urllib.request import urlretrieve

PARQUET_URL = "https://github.com/nflverse/nflverse-data/releases/download/pbp/play_by_play_2025.parquet"
LOCAL_FILE = "/tmp/nfl_2025_pbp_qb_backfill.parquet"

COLS_NEEDED = [
    "play_id", "game_id",
    "sack", "qb_hit", "cpoe", "shotgun", "no_huddle",
    "qb_scramble", "game_seconds_remaining",
]


def safe_bool(val):
    if pd.isna(val):
        return None
    return bool(val == 1 or val is True)


def safe_float(val):
    if pd.isna(val):
        return None
    return float(val)


def main():
    DATABASE_URL = os.getenv("DATABASE_URL")
    if not DATABASE_URL:
        raise ValueError("DATABASE_URL not set")

    print("📥 Downloading 2025 play-by-play parquet...")
    urlretrieve(PARQUET_URL, LOCAL_FILE)
    print("   Done.")

    print("📊 Loading parquet (selected columns only)...")
    df = pd.read_parquet(LOCAL_FILE, columns=COLS_NEEDED)
    print(f"   {len(df):,} plays loaded")

    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()

    print("🔄 Building update records...")
    records = []
    for _, row in df.iterrows():
        play_id = str(row["play_id"]) if pd.notna(row.get("play_id")) else None
        game_id = str(row["game_id"]) if pd.notna(row.get("game_id")) else None
        if not play_id or not game_id:
            continue

        records.append((
            safe_bool(row.get("sack")),
            safe_bool(row.get("qb_hit")),
            safe_float(row.get("cpoe")),
            safe_bool(row.get("shotgun")),
            safe_bool(row.get("no_huddle")),
            safe_bool(row.get("qb_scramble")),
            safe_float(row.get("game_seconds_remaining")),
            play_id,
            game_id,
        ))

    print(f"   {len(records):,} records to update")

    print("🚀 Applying updates to bronze table...")
    execute_batch(cur, """
        UPDATE bronze_nflfastr_plays SET
            sack = %s,
            qb_hit = %s,
            cpoe = %s,
            shotgun = %s,
            no_huddle = %s,
            scramble = %s,
            game_seconds_remaining = %s
        WHERE play_id = %s AND game_id = %s
    """, records, page_size=1000)

    conn.commit()
    print(f"   Updated {cur.rowcount} rows (last batch)")

    cur.execute("""
        SELECT
            COUNT(*) as total,
            COUNT(sack) as has_sack,
            COUNT(cpoe) as has_cpoe,
            COUNT(shotgun) as has_shotgun,
            COUNT(game_seconds_remaining) as has_gsr
        FROM bronze_nflfastr_plays
        WHERE season = 2025
    """)
    row = cur.fetchone()
    print(f"\n✅ Verification (2025 plays):")
    print(f"   Total plays:              {row[0]:,}")
    print(f"   Rows with sack filled:    {row[1]:,}")
    print(f"   Rows with cpoe filled:    {row[2]:,}")
    print(f"   Rows with shotgun filled: {row[3]:,}")
    print(f"   Rows with game_secs:      {row[4]:,}")

    cur.close()
    conn.close()


if __name__ == "__main__":
    main()
