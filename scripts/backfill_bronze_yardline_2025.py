#!/usr/bin/env python3
"""
Backfill yardline_100, down, ydstogo, goal_to_go for 2025 bronze PBP plays.

The 2025 bronze plays were imported with raw_data=NULL, missing field position data.
This script fetches the nflfastR PBP data for the 2024 NFL season (stored as 2025
per our convention) and backfills the direct columns by matching on game_id + play_id.

Usage: python scripts/backfill_bronze_yardline_2025.py
"""

import os

import pandas as pd
import psycopg2
from psycopg2.extras import execute_values

# nflfastR convention: 2024 season = 2025 in our DB (season-ending year)
NFL_SEASON_YEAR = 2024
DB_SEASON = 2025


def get_db():
    url = os.environ["DATABASE_URL"]
    return psycopg2.connect(url)


def fetch_pbp():
    import nfl_data_py as nfl

    print(f"Fetching PBP data for {NFL_SEASON_YEAR} season...")
    df = nfl.import_pbp_data(
        [NFL_SEASON_YEAR],
        columns=["game_id", "play_id", "week", "yardline_100", "down", "ydstogo", "goal_to_go"],
    )
    print(f"Loaded {len(df):,} plays from nfl_data_py")
    return df


def backfill(df: pd.DataFrame, conn):
    cur = conn.cursor()

    # Build lookup: (game_id, play_id) -> (yardline_100, down, ydstogo, goal_to_go)
    # nflfastR play_id is numeric; our DB stores as varchar — cast on match
    df = df.dropna(subset=["game_id", "play_id"])
    df["play_id"] = df["play_id"].astype(str)
    df["yardline_100"] = pd.to_numeric(df["yardline_100"], errors="coerce")
    df["down"] = pd.to_numeric(df["down"], errors="coerce")
    df["ydstogo"] = pd.to_numeric(df["ydstogo"], errors="coerce")
    df["goal_to_go"] = df["goal_to_go"].map({1: True, 0: False, True: True, False: False})

    # Process week by week for progress visibility
    weeks = sorted(df["week"].dropna().unique().astype(int))
    total_updated = 0

    for week in weeks:
        week_df = df[df["week"] == week].copy()
        week_df = week_df.dropna(subset=["yardline_100"])  # only update rows with actual data

        if week_df.empty:
            print(f"  Week {week}: no yardline data, skipping")
            continue

        rows = [
            (
                row["game_id"],
                str(int(float(row["play_id"]))),
                int(row["yardline_100"]) if pd.notna(row["yardline_100"]) else None,
                int(row["down"]) if pd.notna(row["down"]) else None,
                int(row["ydstogo"]) if pd.notna(row["ydstogo"]) else None,
                bool(row["goal_to_go"]) if pd.notna(row["goal_to_go"]) else None,
            )
            for _, row in week_df.iterrows()
        ]

        cur.execute("BEGIN")
        try:
            execute_values(
                cur,
                """
                UPDATE bronze_nflfastr_plays AS b
                SET
                  yardline_100 = v.yardline_100,
                  down = v.down,
                  ydstogo = v.ydstogo,
                  goal_to_go = v.goal_to_go
                FROM (VALUES %s) AS v(game_id, play_id, yardline_100, down, ydstogo, goal_to_go)
                WHERE b.game_id = v.game_id
                  AND b.play_id = v.play_id
                  AND b.season = %s
                  AND b.week = %s
            """,
                rows,
                template="(%s, %s, %s::smallint, %s::smallint, %s::smallint, %s::boolean)",
                page_size=500,
            )

            updated = cur.rowcount
            conn.commit()
            total_updated += updated
            print(f"  Week {week}: {len(rows):,} source plays → {updated:,} rows updated")
        except Exception as e:
            conn.rollback()
            print(f"  Week {week}: ERROR — {e}")

    cur.close()
    print(f"\nTotal updated: {total_updated:,} rows")
    return total_updated


def verify(conn):
    cur = conn.cursor()
    cur.execute(
        """
        SELECT
            week,
            COUNT(*) as total,
            COUNT(yardline_100) as with_yardline,
            COUNT(CASE WHEN yardline_100 <= 20 THEN 1 END) as rz_plays
        FROM bronze_nflfastr_plays
        WHERE season = 2025
        GROUP BY week ORDER BY week
    """
    )
    print("\nVerification — yardline_100 coverage per week:")
    print(f"{'Week':<6} {'Total':<8} {'With YL':<10} {'RZ Plays':<10}")
    for row in cur.fetchall():
        print(f"  {row[0]:<6} {row[1]:<8} {row[2]:<10} {row[3]:<10}")
    cur.close()


if __name__ == "__main__":
    conn = get_db()
    df = fetch_pbp()
    total = backfill(df, conn)
    if total > 0:
        verify(conn)
    conn.close()
    print("\nDone. Run the Gold ETL re-run next (Step 3).")

