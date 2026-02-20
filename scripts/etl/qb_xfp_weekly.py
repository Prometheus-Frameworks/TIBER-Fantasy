#!/usr/bin/env python3
"""
QB xFP weekly ETL (FIRE v1)

Builds smoothed bucket probability tables from bronze_nflfastr_plays and writes
season-week-player aggregates to qb_xfp_weekly.
"""

import argparse
import os
import psycopg2
from psycopg2.extras import execute_values

ALPHA = 1.0
BETA = 20.0


def ydstogo_bucket_expr(prefix: str = "") -> str:
    p = f"{prefix}." if prefix else ""
    return (
        f"CASE "
        f"WHEN COALESCE(({p}raw_data->>'ydstogo')::int,0) <= 1 THEN '1' "
        f"WHEN COALESCE(({p}raw_data->>'ydstogo')::int,0) BETWEEN 2 AND 3 THEN '2_3' "
        f"WHEN COALESCE(({p}raw_data->>'ydstogo')::int,0) BETWEEN 4 AND 6 THEN '4_6' "
        f"WHEN COALESCE(({p}raw_data->>'ydstogo')::int,0) BETWEEN 7 AND 10 THEN '7_10' "
        f"ELSE '11_plus' END"
    )


def yardline_bucket_expr(prefix: str = "") -> str:
    p = f"{prefix}." if prefix else ""
    return (
        f"CASE "
        f"WHEN COALESCE(({p}raw_data->>'yardline_100')::int,100) BETWEEN 1 AND 5 THEN '1_5' "
        f"WHEN COALESCE(({p}raw_data->>'yardline_100')::int,100) BETWEEN 6 AND 10 THEN '6_10' "
        f"WHEN COALESCE(({p}raw_data->>'yardline_100')::int,100) BETWEEN 11 AND 20 THEN '11_20' "
        f"WHEN COALESCE(({p}raw_data->>'yardline_100')::int,100) BETWEEN 21 AND 50 THEN '21_50' "
        f"ELSE '51_100' END"
    )


def air_bucket_expr(prefix: str = "") -> str:
    p = f"{prefix}." if prefix else ""
    return (
        f"CASE "
        f"WHEN {p}air_yards IS NULL THEN 'unknown' "
        f"WHEN {p}air_yards <= 0 THEN 'lte_0' "
        f"WHEN {p}air_yards BETWEEN 1 AND 10 THEN '1_10' "
        f"WHEN {p}air_yards BETWEEN 11 AND 20 THEN '11_20' "
        f"ELSE '21_plus' END"
    )


def run_etl(conn, target_season: int, train_start: int, train_end: int):
    yc = ydstogo_bucket_expr("p")
    yd = yardline_bucket_expr("p")
    ac = air_bucket_expr("p")

    with conn.cursor() as cur:
        cur.execute(
            f"""
            CREATE TEMP TABLE qb_xfp_train_base AS
            SELECT
              p.season,
              p.week,
              p.play_id,
              p.posteam,
              p.passer_player_id,
              p.rusher_player_id,
              p.play_type,
              p.yards_gained,
              p.air_yards,
              COALESCE((p.raw_data->>'down')::int, 0) AS down,
              COALESCE((p.raw_data->>'ydstogo')::int, 0) AS ydstogo,
              COALESCE((p.raw_data->>'yardline_100')::int, 100) AS yardline_100,
              COALESCE((p.raw_data->>'pass_attempt')::int, CASE WHEN p.play_type = 'pass' THEN 1 ELSE 0 END) AS pass_attempt,
              COALESCE((p.raw_data->>'qb_dropback')::int, CASE WHEN p.play_type IN ('pass','sack') THEN 1 ELSE 0 END) AS qb_dropback,
              COALESCE((p.raw_data->>'sack')::int, CASE WHEN p.play_type = 'sack' THEN 1 ELSE 0 END) AS sack,
              COALESCE((p.raw_data->>'qb_scramble')::int, 0) AS scramble,
              COALESCE((p.raw_data->>'qb_kneel')::int, CASE WHEN p.play_type = 'qb_kneel' THEN 1 ELSE 0 END) AS qb_kneel,
              COALESCE((p.raw_data->>'qb_spike')::int, CASE WHEN p.play_type = 'qb_spike' THEN 1 ELSE 0 END) AS qb_spike,
              COALESCE((p.raw_data->>'interception')::int, CASE WHEN p.interception THEN 1 ELSE 0 END) AS interception,
              COALESCE((p.raw_data->>'pass_touchdown')::int, CASE WHEN p.touchdown AND p.play_type = 'pass' THEN 1 ELSE 0 END) AS pass_touchdown,
              COALESCE((p.raw_data->>'rush_touchdown')::int, CASE WHEN p.touchdown AND p.play_type = 'run' THEN 1 ELSE 0 END) AS rush_touchdown,
              {yd} AS yardline_bucket,
              {yc} AS ydstogo_bucket,
              {ac} AS air_bucket
            FROM bronze_nflfastr_plays p
            WHERE p.season BETWEEN %s AND %s
              AND p.week BETWEEN 1 AND 18
            """,
            (train_start, train_end),
        )

        cur.execute(
            """
            DELETE FROM qb_xfp_train_base
            WHERE qb_kneel = 1 OR qb_spike = 1
            """
        )

        cur.execute(
            f"""
            CREATE TEMP TABLE qb_pass_td_bucket AS
            SELECT
              yardline_bucket,
              down,
              ydstogo_bucket,
              air_bucket,
              COUNT(*)::float AS n,
              SUM(pass_touchdown)::float AS td,
              (SUM(pass_touchdown)::float + %s) / (COUNT(*)::float + %s + %s) AS p_pass_td
            FROM qb_xfp_train_base
            WHERE qb_dropback = 1 AND passer_player_id IS NOT NULL
            GROUP BY 1,2,3,4
            """,
            (ALPHA, ALPHA, BETA),
        )

        cur.execute(
            f"""
            CREATE TEMP TABLE qb_int_bucket AS
            SELECT
              down,
              ydstogo_bucket,
              air_bucket,
              COUNT(*)::float AS n,
              SUM(interception)::float AS ints,
              (SUM(interception)::float + %s) / (COUNT(*)::float + %s + %s) AS p_int
            FROM qb_xfp_train_base
            WHERE pass_attempt = 1 AND passer_player_id IS NOT NULL
            GROUP BY 1,2,3
            """,
            (ALPHA, ALPHA, BETA),
        )

        cur.execute(
            f"""
            CREATE TEMP TABLE qb_rush_td_bucket AS
            SELECT
              yardline_bucket,
              down,
              ydstogo_bucket,
              COUNT(*)::float AS n,
              SUM(rush_touchdown)::float AS td,
              (SUM(rush_touchdown)::float + %s) / (COUNT(*)::float + %s + %s) AS p_rush_td
            FROM qb_xfp_train_base
            WHERE play_type = 'run'
              AND rusher_player_id IS NOT NULL
              AND rusher_player_id = passer_player_id
            GROUP BY 1,2,3
            """,
            (ALPHA, ALPHA, BETA),
        )

        cur.execute(
            """
            CREATE TEMP TABLE qb_ypa_bucket AS
            SELECT
              air_bucket,
              AVG(COALESCE(yards_gained, 0))::float AS ypa_bucket
            FROM qb_xfp_train_base
            WHERE pass_attempt = 1
              AND passer_player_id IS NOT NULL
            GROUP BY 1
            """
        )

        cur.execute(
            """
            CREATE TEMP TABLE qb_ypc_league AS
            SELECT AVG(COALESCE(yards_gained,0))::float AS qb_ypc
            FROM qb_xfp_train_base
            WHERE play_type = 'run'
              AND rusher_player_id IS NOT NULL
              AND rusher_player_id = passer_player_id
            """
        )

        cur.execute(
            f"""
            CREATE TEMP TABLE qb_target_plays AS
            SELECT
              p.season,
              p.week,
              p.posteam,
              p.passer_player_id AS player_id,
              p.rusher_player_id,
              p.play_type,
              p.yards_gained,
              COALESCE((p.raw_data->>'down')::int, 0) AS down,
              COALESCE((p.raw_data->>'ydstogo')::int, 0) AS ydstogo,
              COALESCE((p.raw_data->>'yardline_100')::int, 100) AS yardline_100,
              COALESCE((p.raw_data->>'pass_attempt')::int, CASE WHEN p.play_type = 'pass' THEN 1 ELSE 0 END) AS pass_attempt,
              COALESCE((p.raw_data->>'qb_dropback')::int, CASE WHEN p.play_type IN ('pass','sack') THEN 1 ELSE 0 END) AS qb_dropback,
              COALESCE((p.raw_data->>'sack')::int, CASE WHEN p.play_type = 'sack' THEN 1 ELSE 0 END) AS sack,
              COALESCE((p.raw_data->>'qb_scramble')::int, 0) AS scramble,
              COALESCE((p.raw_data->>'qb_kneel')::int, CASE WHEN p.play_type = 'qb_kneel' THEN 1 ELSE 0 END) AS qb_kneel,
              COALESCE((p.raw_data->>'qb_spike')::int, CASE WHEN p.play_type = 'qb_spike' THEN 1 ELSE 0 END) AS qb_spike,
              {yd.replace('p.','')} AS yardline_bucket,
              {yc.replace('p.','')} AS ydstogo_bucket,
              {ac.replace('p.','')} AS air_bucket
            FROM bronze_nflfastr_plays p
            WHERE p.season = %s
              AND p.week BETWEEN 1 AND 18
              AND p.passer_player_id IS NOT NULL
            """,
            (target_season,),
        )

        cur.execute("DELETE FROM qb_target_plays WHERE qb_kneel = 1 OR qb_spike = 1")

        cur.execute(
            """
            CREATE TEMP TABLE qb_weekly_staging AS
            WITH ypc AS (
              SELECT COALESCE((SELECT qb_ypc FROM qb_ypc_league LIMIT 1), 0.0) AS qb_ypc
            ),
            play_enriched AS (
              SELECT
                t.season,
                t.week,
                t.player_id,
                t.posteam AS team,
                t.qb_dropback,
                t.pass_attempt,
                t.sack,
                t.scramble,
                CASE WHEN t.play_type = 'run' AND t.rusher_player_id = t.player_id THEN 1 ELSE 0 END AS qb_rush_attempt,
                CASE WHEN t.qb_dropback = 1 AND t.yardline_100 <= 20 THEN 1 ELSE 0 END AS inside20_dropback,
                CASE WHEN t.qb_dropback = 1 AND t.yardline_100 <= 10 THEN 1 ELSE 0 END AS inside10_dropback,
                CASE WHEN t.qb_dropback = 1 AND t.yardline_100 <= 5 THEN 1 ELSE 0 END AS inside5_dropback,
                COALESCE(ptd.p_pass_td, (SELECT AVG(p_pass_td)::float FROM qb_pass_td_bucket)) AS p_pass_td,
                COALESCE(i.p_int, (SELECT AVG(p_int)::float FROM qb_int_bucket)) AS p_int,
                COALESCE(rtd.p_rush_td, (SELECT AVG(p_rush_td)::float FROM qb_rush_td_bucket)) AS p_rush_td,
                COALESCE(ypa.ypa_bucket, (SELECT AVG(ypa_bucket)::float FROM qb_ypa_bucket)) AS ypa_est,
                (SELECT qb_ypc FROM ypc) AS ypc_est
              FROM qb_target_plays t
              LEFT JOIN qb_pass_td_bucket ptd
                ON ptd.yardline_bucket = t.yardline_bucket
                AND ptd.down = t.down
                AND ptd.ydstogo_bucket = t.ydstogo_bucket
                AND ptd.air_bucket = t.air_bucket
              LEFT JOIN qb_int_bucket i
                ON i.down = t.down
                AND i.ydstogo_bucket = t.ydstogo_bucket
                AND i.air_bucket = t.air_bucket
              LEFT JOIN qb_rush_td_bucket rtd
                ON rtd.yardline_bucket = t.yardline_bucket
                AND rtd.down = t.down
                AND rtd.ydstogo_bucket = t.ydstogo_bucket
              LEFT JOIN qb_ypa_bucket ypa
                ON ypa.air_bucket = t.air_bucket
            )
            SELECT
              season,
              week,
              player_id,
              MAX(team) AS team,
              SUM(qb_dropback)::int AS dropbacks,
              SUM(pass_attempt)::int AS pass_attempts,
              SUM(sack)::int AS sacks,
              SUM(scramble)::int AS scrambles,
              SUM(qb_rush_attempt)::int AS qb_rush_attempts,
              SUM(inside20_dropback)::int AS inside20_dropbacks,
              SUM(inside10_dropback)::int AS inside10_dropbacks,
              SUM(inside5_dropback)::int AS inside5_dropbacks,
              SUM(CASE WHEN pass_attempt = 1 THEN ypa_est ELSE 0 END)::float AS exp_pass_yards,
              SUM(CASE WHEN qb_dropback = 1 THEN p_pass_td ELSE 0 END)::float AS exp_pass_td,
              SUM(CASE WHEN pass_attempt = 1 THEN p_int ELSE 0 END)::float AS exp_int,
              SUM(CASE WHEN qb_rush_attempt = 1 THEN ypc_est ELSE 0 END)::float AS exp_rush_yards,
              SUM(CASE WHEN qb_rush_attempt = 1 THEN p_rush_td ELSE 0 END)::float AS exp_rush_td
            FROM play_enriched
            GROUP BY season, week, player_id
            """
        )

        cur.execute(
            """
            INSERT INTO qb_xfp_weekly (
              season, week, player_id, team,
              dropbacks, pass_attempts, sacks, scrambles, qb_rush_attempts,
              inside20_dropbacks, inside10_dropbacks, inside5_dropbacks,
              exp_pass_yards, exp_pass_td, exp_int, exp_rush_yards, exp_rush_td,
              xfp_redraft, xfp_dynasty
            )
            SELECT
              season,
              week,
              player_id,
              team,
              dropbacks,
              pass_attempts,
              sacks,
              scrambles,
              qb_rush_attempts,
              inside20_dropbacks,
              inside10_dropbacks,
              inside5_dropbacks,
              exp_pass_yards,
              exp_pass_td,
              exp_int,
              exp_rush_yards,
              exp_rush_td,
              (exp_pass_yards/25.0) + (exp_pass_td*4.0) + (exp_int*-2.0) + (exp_rush_yards/10.0) + (exp_rush_td*6.0) AS xfp_redraft,
              (exp_pass_yards/25.0) + (exp_pass_td*6.0) + (exp_int*-2.0) + (exp_rush_yards/10.0) + (exp_rush_td*6.0) AS xfp_dynasty
            FROM qb_weekly_staging
            ON CONFLICT (season, week, player_id) DO UPDATE
            SET
              team = EXCLUDED.team,
              dropbacks = EXCLUDED.dropbacks,
              pass_attempts = EXCLUDED.pass_attempts,
              sacks = EXCLUDED.sacks,
              scrambles = EXCLUDED.scrambles,
              qb_rush_attempts = EXCLUDED.qb_rush_attempts,
              inside20_dropbacks = EXCLUDED.inside20_dropbacks,
              inside10_dropbacks = EXCLUDED.inside10_dropbacks,
              inside5_dropbacks = EXCLUDED.inside5_dropbacks,
              exp_pass_yards = EXCLUDED.exp_pass_yards,
              exp_pass_td = EXCLUDED.exp_pass_td,
              exp_int = EXCLUDED.exp_int,
              exp_rush_yards = EXCLUDED.exp_rush_yards,
              exp_rush_td = EXCLUDED.exp_rush_td,
              xfp_redraft = EXCLUDED.xfp_redraft,
              xfp_dynasty = EXCLUDED.xfp_dynasty,
              created_at = now()
            """
        )


def main():
    parser = argparse.ArgumentParser(description="Build QB xFP weekly table")
    parser.add_argument("--season", type=int, default=2025)
    parser.add_argument("--train-start", type=int, default=2021)
    parser.add_argument("--train-end", type=int, default=2024)
    args = parser.parse_args()

    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        raise RuntimeError("DATABASE_URL is required")

    conn = psycopg2.connect(db_url)
    try:
        run_etl(conn, args.season, args.train_start, args.train_end)
        conn.commit()
        print(f"✅ qb_xfp_weekly refreshed for season={args.season} using train={args.train_start}-{args.train_end}")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
