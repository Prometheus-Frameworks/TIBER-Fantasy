#!/usr/bin/env python3
"""
Aggregate 2025 Play-by-Play Data into Team Context Tables

Reads from bronze_nflfastr_plays and calculates:
- team_offensive_context: EPA metrics, run success, pressure rate allowed
- team_defensive_context: EPA allowed, pressure rate generated, YPA allowed

Uses cumulative season stats through specified week.
"""

import psycopg2
from psycopg2.extras import execute_values
import os
import sys

def aggregate_team_context(season: int = 2025, through_week: int = 12):
    """Aggregate play-by-play data into team offensive/defensive context tables."""
    
    DATABASE_URL = os.getenv('DATABASE_URL')
    if not DATABASE_URL:
        raise ValueError("DATABASE_URL environment variable not set")
    
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()
    
    print(f"📊 Aggregating team context for {season} through week {through_week}...")
    
    # Query to calculate offensive context metrics
    offensive_query = f"""
    WITH base_plays AS (
        SELECT * FROM bronze_nflfastr_plays
        WHERE season = {season} AND week <= {through_week}
    ),
    pass_plays AS (
        SELECT 
            posteam as team,
            COUNT(*) as pass_attempts,
            AVG(epa) as pass_epa,
            SUM(CASE WHEN yards_gained >= 20 THEN 1 ELSE 0 END) as explosive_pass,
            AVG(air_yards) as avg_air_yards,
            AVG(yards_gained) as avg_yards_gained,
            SUM(CASE WHEN complete_pass THEN 1 ELSE 0 END)::float / NULLIF(COUNT(*), 0) as completion_rate,
            SUM(CASE WHEN complete_pass THEN 1 ELSE 0 END)::float / NULLIF(COUNT(*), 0) - 0.63 as cpoe_estimate
        FROM base_plays
        WHERE play_type = 'pass'
          AND posteam IS NOT NULL
          AND epa IS NOT NULL
        GROUP BY posteam
    ),
    rush_plays AS (
        SELECT 
            posteam as team,
            COUNT(*) as rush_attempts,
            AVG(epa) as rush_epa,
            SUM(CASE WHEN yards_gained >= 20 THEN 1 ELSE 0 END) as explosive_rush,
            SUM(CASE WHEN yards_gained >= 4 THEN 1 ELSE 0 END)::float / NULLIF(COUNT(*), 0) as run_success_rate
        FROM base_plays
        WHERE play_type = 'run'
          AND posteam IS NOT NULL
          AND epa IS NOT NULL
        GROUP BY posteam
    ),
    sacks AS (
        SELECT 
            posteam as team,
            SUM(CASE WHEN (raw_data->>'sack')::text = '1' OR (raw_data->>'sack')::text = 'true' THEN 1 ELSE 0 END) as sacks_taken,
            COUNT(*) as dropbacks
        FROM base_plays
        WHERE play_type = 'pass'
          AND posteam IS NOT NULL
        GROUP BY posteam
    )
    SELECT 
        p.team,
        p.pass_epa,
        r.rush_epa,
        COALESCE(p.explosive_pass, 0) + COALESCE(r.explosive_rush, 0) as explosive_20_plus,
        p.avg_yards_gained as ypa,
        p.cpoe_estimate as cpoe,
        r.run_success_rate,
        s.sacks_taken::float / NULLIF(s.dropbacks, 0) as pressure_rate_allowed
    FROM pass_plays p
    LEFT JOIN rush_plays r ON p.team = r.team
    LEFT JOIN sacks s ON p.team = s.team
    WHERE p.team IS NOT NULL
    ORDER BY p.team
    """
    
    # Query to calculate defensive context metrics
    defensive_query = f"""
    WITH base_plays AS (
        SELECT * FROM bronze_nflfastr_plays
        WHERE season = {season} AND week <= {through_week}
    ),
    pass_plays AS (
        SELECT 
            defteam as team,
            COUNT(*) as pass_attempts,
            AVG(epa) as pass_epa_allowed,
            SUM(CASE WHEN yards_gained >= 20 THEN 1 ELSE 0 END) as explosive_pass_allowed,
            AVG(yards_gained) as ypa_allowed,
            SUM(CASE WHEN complete_pass THEN 1 ELSE 0 END)::float / NULLIF(COUNT(*), 0) - 0.63 as cpoe_allowed
        FROM base_plays
        WHERE play_type = 'pass'
          AND defteam IS NOT NULL
          AND epa IS NOT NULL
        GROUP BY defteam
    ),
    rush_plays AS (
        SELECT 
            defteam as team,
            COUNT(*) as rush_attempts,
            AVG(epa) as rush_epa_allowed,
            SUM(CASE WHEN yards_gained >= 20 THEN 1 ELSE 0 END) as explosive_rush_allowed,
            SUM(CASE WHEN yards_gained >= 4 THEN 1 ELSE 0 END)::float / NULLIF(COUNT(*), 0) as run_success_allowed
        FROM base_plays
        WHERE play_type = 'run'
          AND defteam IS NOT NULL
          AND epa IS NOT NULL
        GROUP BY defteam
    ),
    sacks AS (
        SELECT 
            defteam as team,
            SUM(CASE WHEN (raw_data->>'sack')::text = '1' OR (raw_data->>'sack')::text = 'true' THEN 1 ELSE 0 END) as sacks_generated,
            COUNT(*) as dropbacks_faced
        FROM base_plays
        WHERE play_type = 'pass'
          AND defteam IS NOT NULL
        GROUP BY defteam
    )
    SELECT 
        p.team,
        p.pass_epa_allowed,
        r.rush_epa_allowed,
        COALESCE(p.explosive_pass_allowed, 0) + COALESCE(r.explosive_rush_allowed, 0) as explosive_20_plus_allowed,
        p.ypa_allowed,
        p.cpoe_allowed,
        r.run_success_allowed as gap_run_success_rate,
        r.run_success_allowed as zone_run_success_rate,
        s.sacks_generated::float / NULLIF(s.dropbacks_faced, 0) as pressure_rate_generated
    FROM pass_plays p
    LEFT JOIN rush_plays r ON p.team = r.team
    LEFT JOIN sacks s ON p.team = s.team
    WHERE p.team IS NOT NULL
    ORDER BY p.team
    """
    
    # Execute offensive query
    print("🏈 Calculating offensive context...")
    cur.execute(offensive_query)
    offensive_rows = cur.fetchall()
    print(f"   Found {len(offensive_rows)} teams with offensive data")
    
    # Execute defensive query
    print("🛡️  Calculating defensive context...")
    cur.execute(defensive_query)
    defensive_rows = cur.fetchall()
    print(f"   Found {len(defensive_rows)} teams with defensive data")
    
    # Delete existing records for this season/week
    print(f"🗑️  Clearing existing {season} week {through_week} data...")
    cur.execute("DELETE FROM team_offensive_context WHERE season = %s AND week = %s", (season, through_week))
    print(f"   Deleted {cur.rowcount} offensive records")
    cur.execute("DELETE FROM team_defensive_context WHERE season = %s AND week = %s", (season, through_week))
    print(f"   Deleted {cur.rowcount} defensive records")
    
    # Insert offensive context
    print("📤 Inserting offensive context...")
    offensive_insert = """
    INSERT INTO team_offensive_context 
        (season, week, team, pass_epa, rush_epa, explosive_20_plus, ypa, cpoe, run_success_rate, pressure_rate_allowed)
    VALUES %s
    """
    offensive_values = [
        (season, through_week, row[0], row[1], row[2], row[3], row[4], row[5], row[6], row[7])
        for row in offensive_rows
    ]
    execute_values(cur, offensive_insert, offensive_values)
    print(f"   Inserted {len(offensive_values)} offensive records")
    
    # Insert defensive context
    print("📤 Inserting defensive context...")
    defensive_insert = """
    INSERT INTO team_defensive_context 
        (season, week, team, pass_epa_allowed, rush_epa_allowed, explosive_20_plus_allowed, ypa_allowed, cpoe_allowed, gap_run_success_rate, zone_run_success_rate, pressure_rate_generated)
    VALUES %s
    """
    defensive_values = [
        (season, through_week, row[0], row[1], row[2], row[3], row[4], row[5], row[6], row[7], row[8])
        for row in defensive_rows
    ]
    execute_values(cur, defensive_insert, defensive_values)
    print(f"   Inserted {len(defensive_values)} defensive records")
    
    conn.commit()
    
    # Verify the data
    print("\n📊 Verification - Sample offensive data:")
    cur.execute("""
        SELECT team, pass_epa, rush_epa, run_success_rate, pressure_rate_allowed 
        FROM team_offensive_context 
        WHERE season = %s AND week = %s 
        ORDER BY pass_epa DESC 
        LIMIT 5
    """, (season, through_week))
    for row in cur.fetchall():
        print(f"   {row[0]}: Pass EPA={row[1]:.3f}, Rush EPA={row[2]:.3f}, Run SR={row[3]:.1%}, Press={row[4]:.1%}")
    
    print("\n📊 Verification - Sample defensive data:")
    cur.execute("""
        SELECT team, pass_epa_allowed, rush_epa_allowed, pressure_rate_generated 
        FROM team_defensive_context 
        WHERE season = %s AND week = %s 
        ORDER BY pass_epa_allowed ASC 
        LIMIT 5
    """, (season, through_week))
    for row in cur.fetchall():
        print(f"   {row[0]}: Pass EPA Allowed={row[1]:.3f}, Rush EPA Allowed={row[2]:.3f}, Pressure={row[3]:.1%}")
    
    cur.close()
    conn.close()
    
    print(f"\n✅ Successfully aggregated team context for {season} week {through_week}")
    return True

if __name__ == "__main__":
    season = int(sys.argv[1]) if len(sys.argv) > 1 else 2025
    week = int(sys.argv[2]) if len(sys.argv) > 2 else 12
    aggregate_team_context(season, week)
