#!/usr/bin/env python3
"""
Bulletproof NFL Schedule Sync from NFLfastR/nflverse
Pulls schedule data and upserts into PostgreSQL schedule table.
"""

import os
import sys
import argparse
import nfl_data_py as nfl
import psycopg2
from psycopg2.extras import execute_values

def get_db_connection():
    """Get PostgreSQL connection from DATABASE_URL"""
    database_url = os.environ.get('DATABASE_URL')
    if not database_url:
        raise ValueError("DATABASE_URL environment variable not set")
    return psycopg2.connect(database_url)

def fetch_schedule_from_nflverse(season: int):
    """Fetch schedule data from NFLfastR/nflverse"""
    print(f"[NFLverse] Fetching schedule for {season}...")
    
    try:
        schedule_df = nfl.import_schedules([season])
        
        # Filter to regular season games only
        schedule_df = schedule_df[schedule_df['game_type'] == 'REG']
        
        # Select relevant columns
        result = schedule_df[['season', 'week', 'home_team', 'away_team', 'home_score', 'away_score']].copy()
        result = result.rename(columns={
            'home_team': 'home',
            'away_team': 'away',
            'home_score': 'home_score',
            'away_score': 'away_score'
        })
        
        # Calculate result (positive = home win, negative = away win, 0 = tie)
        def calc_result(row):
            if row['home_score'] is None or row['away_score'] is None:
                return None
            home = int(row['home_score']) if not (row['home_score'] != row['home_score']) else None
            away = int(row['away_score']) if not (row['away_score'] != row['away_score']) else None
            if home is None or away is None:
                return None
            return home - away
        
        result['result'] = result.apply(calc_result, axis=1)
        
        # Convert NaN to None for database
        result = result.where(result.notna(), None)
        
        print(f"[NFLverse] Found {len(result)} regular season games for {season}")
        return result
        
    except Exception as e:
        print(f"[NFLverse] Error fetching schedule: {e}")
        raise

def upsert_schedule(conn, schedule_df, week_filter=None):
    """Upsert schedule data into PostgreSQL"""
    
    if week_filter:
        schedule_df = schedule_df[schedule_df['week'] == week_filter]
    
    if len(schedule_df) == 0:
        print("[DB] No games to upsert")
        return 0
    
    cursor = conn.cursor()
    
    # Prepare data for upsert
    records = []
    for _, row in schedule_df.iterrows():
        records.append((
            int(row['season']),
            int(row['week']),
            str(row['home']),
            str(row['away']),
            int(row['home_score']) if row['home_score'] is not None and row['home_score'] == row['home_score'] else None,
            int(row['away_score']) if row['away_score'] is not None and row['away_score'] == row['away_score'] else None,
            int(row['result']) if row['result'] is not None and row['result'] == row['result'] else None
        ))
    
    # Upsert query with ON CONFLICT
    upsert_sql = """
        INSERT INTO schedule (season, week, home, away, home_score, away_score, result)
        VALUES %s
        ON CONFLICT ON CONSTRAINT schedule_season_week_home_away_key
        DO UPDATE SET
            home_score = EXCLUDED.home_score,
            away_score = EXCLUDED.away_score,
            result = EXCLUDED.result
    """
    
    try:
        execute_values(cursor, upsert_sql, records)
        conn.commit()
        print(f"[DB] Upserted {len(records)} games")
        return len(records)
    except Exception as e:
        conn.rollback()
        print(f"[DB] Error upserting: {e}")
        raise
    finally:
        cursor.close()

def sync_schedule(season: int, week: int = None):
    """Main sync function - fetch from NFLverse and upsert to DB"""
    
    # Fetch from NFLverse
    schedule_df = fetch_schedule_from_nflverse(season)
    
    # Connect to database
    conn = get_db_connection()
    
    try:
        count = upsert_schedule(conn, schedule_df, week_filter=week)
        print(f"[Sync] Complete - {count} games synced for season {season}" + 
              (f" week {week}" if week else ""))
        return count
    finally:
        conn.close()

def verify_schedule(season: int, week: int = None):
    """Verify schedule data in database"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        if week:
            cursor.execute(
                "SELECT home, away, home_score, away_score FROM schedule WHERE season = %s AND week = %s ORDER BY home",
                (season, week)
            )
        else:
            cursor.execute(
                "SELECT week, COUNT(*) as games FROM schedule WHERE season = %s GROUP BY week ORDER BY week",
                (season,)
            )
        
        rows = cursor.fetchall()
        
        if week:
            print(f"\n[Verify] Week {week} schedule ({len(rows)} games):")
            for row in rows:
                score = f"{row[2]}-{row[3]}" if row[2] is not None else "TBD"
                print(f"  {row[1]} @ {row[0]}: {score}")
        else:
            print(f"\n[Verify] Season {season} schedule:")
            total = 0
            for row in rows:
                print(f"  Week {row[0]}: {row[1]} games")
                total += row[1]
            print(f"  Total: {total} games")
        
        return rows
        
    finally:
        cursor.close()
        conn.close()

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Sync NFL schedule from NFLverse to database')
    parser.add_argument('--season', type=int, default=2025, help='Season year (default: 2025)')
    parser.add_argument('--week', type=int, help='Specific week to sync (optional)')
    parser.add_argument('--verify', action='store_true', help='Verify database data after sync')
    parser.add_argument('--verify-only', action='store_true', help='Only verify, do not sync')
    
    args = parser.parse_args()
    
    if args.verify_only:
        verify_schedule(args.season, args.week)
    else:
        sync_schedule(args.season, args.week)
        if args.verify:
            verify_schedule(args.season, args.week)
