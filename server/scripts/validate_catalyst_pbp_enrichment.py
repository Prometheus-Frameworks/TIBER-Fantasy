#!/usr/bin/env python3
"""Validate Phase 0 CATALYST enrichment on bronze_nflfastr_plays.

Checks:
1) raw_data has wp/score_differential coverage
2) materialized columns coverage + ranges
3) sample rows for manual spot-checking
"""
import os
import psycopg2


def run_query(cur, label, sql):
    cur.execute(sql)
    row = cur.fetchone()
    print(f"\n{label}")
    print(row)


def main():
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        raise SystemExit("DATABASE_URL is required")

    conn = psycopg2.connect(db_url)
    cur = conn.cursor()

    run_query(
        cur,
        "Raw JSON coverage (2024-2025):",
        """
        SELECT
          COUNT(*) AS plays,
          ROUND(100.0 * AVG(CASE WHEN NULLIF(raw_data->>'wp', '') IS NOT NULL THEN 1 ELSE 0 END), 2) AS raw_wp_pct,
          ROUND(100.0 * AVG(CASE WHEN NULLIF(raw_data->>'score_differential', '') IS NOT NULL THEN 1 ELSE 0 END), 2) AS raw_score_diff_pct
        FROM bronze_nflfastr_plays
        WHERE season IN (2024, 2025)
        """,
    )

    run_query(
        cur,
        "Column coverage + sanity ranges (2024-2025):",
        """
        SELECT
          COUNT(*) AS plays,
          ROUND(100.0 * AVG(CASE WHEN wp IS NOT NULL THEN 1 ELSE 0 END), 2) AS wp_pct,
          ROUND(100.0 * AVG(CASE WHEN score_differential IS NOT NULL THEN 1 ELSE 0 END), 2) AS score_diff_pct,
          MIN(wp) AS wp_min,
          MAX(wp) AS wp_max,
          MIN(score_differential) AS score_diff_min,
          MAX(score_differential) AS score_diff_max
        FROM bronze_nflfastr_plays
        WHERE season IN (2024, 2025)
        """,
    )

    print("\nSpot-check sample (100 plays, 2024 W1):")
    cur.execute(
        """
        SELECT game_id, play_id, week, posteam, defteam, wp, score_differential,
               raw_data->>'wp' AS raw_wp,
               raw_data->>'score_differential' AS raw_score_diff
        FROM bronze_nflfastr_plays
        WHERE season = 2024 AND week = 1
        ORDER BY game_id, play_id
        LIMIT 100
        """
    )
    for row in cur.fetchall():
        print(row)

    cur.close()
    conn.close()


if __name__ == "__main__":
    main()
