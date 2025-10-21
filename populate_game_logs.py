#!/usr/bin/env python3
"""
Quick script to populate game_logs table with 2024 data for Weekly Takes
Fetches data from Sleeper API and inserts into PostgreSQL
"""

import os
import requests
import psycopg2
from psycopg2.extras import execute_values
from datetime import datetime

# Database connection
DATABASE_URL = os.environ.get('DATABASE_URL')
if not DATABASE_URL:
    print("❌ DATABASE_URL environment variable not set")
    exit(1)

print("🏈 Starting game logs population...")
print(f"📊 Target: game_logs table with 2025 weeks 1-7 data")

# Fetch Sleeper players database
print("\n📡 Fetching Sleeper players database...")
players_response = requests.get('https://api.sleeper.app/v1/players/nfl')
all_players = players_response.json()
print(f"✅ Loaded {len(all_players)} players from Sleeper")

# Create player_id mapping (sleeper_id -> internal player ID will be generated)
# For now, we'll use sleeper_id as the lookup key

# Fetch stats for weeks 1-6 of 2025
print("\n📊 Fetching 2025 weekly stats...")

# We'll collect game logs for QB, RB, WR, TE positions
game_logs_data = []
player_cache = {}  # Cache to avoid duplicate player lookups

# Connect to database
conn = psycopg2.connect(DATABASE_URL)
cur = conn.cursor()

print("🔍 Checking for existing players in database...")
cur.execute("SELECT id, sleeper_id FROM players WHERE sleeper_id IS NOT NULL")
player_db_mapping = {row[1]: row[0] for row in cur.fetchall()}
print(f"✅ Found {len(player_db_mapping)} players with Sleeper IDs in database")

# Fetch weekly stats for weeks 1-7 (2025 season)
target_weeks = [1, 2, 3, 4, 5, 6, 7]
print(f"\n🔄 Fetching stats for weeks {target_weeks} of 2025 season...")

for week in target_weeks:
    print(f"  Week {week}...", end=" ")
    try:
        stats_response = requests.get(f'https://api.sleeper.app/v1/stats/nfl/regular/2025/{week}')
        week_stats = stats_response.json()
        
        logs_this_week = 0
        for player_id, stats in week_stats.items():
            if player_id not in all_players:
                continue
            
            player_info = all_players[player_id]
            position = player_info.get('position')
            
            # Only process QB, RB, WR, TE
            if position not in ['QB', 'RB', 'WR', 'TE']:
                continue
            
            # Check if player exists in our database
            if player_id not in player_db_mapping:
                continue
            
            db_player_id = player_db_mapping[player_id]
            
            # Extract relevant stats for all positions
            targets = stats.get('rec_tgt', 0) or 0
            receptions = stats.get('rec_rec', 0) or 0
            rec_yards = stats.get('rec_yd', 0) or 0
            rec_tds = stats.get('rec_td', 0) or 0
            
            rush_att = stats.get('rush_att', 0) or 0
            rush_yards = stats.get('rush_yd', 0) or 0
            rush_tds = stats.get('rush_td', 0) or 0
            
            # QB-specific stats
            pass_att = stats.get('pass_att', 0) or 0
            pass_cmp = stats.get('pass_cmp', 0) or 0
            pass_yards = stats.get('pass_yd', 0) or 0
            pass_tds = stats.get('pass_td', 0) or 0
            pass_int = stats.get('pass_int', 0) or 0
            
            # Calculate PPR fantasy points
            fantasy_points_ppr = (
                receptions * 1.0 +  # 1 point per reception
                rec_yards * 0.1 +   # 0.1 per receiving yard
                rec_tds * 6.0 +     # 6 points per receiving TD
                rush_yards * 0.1 +  # 0.1 per rushing yard
                rush_tds * 6.0 +    # 6 points per rushing TD
                pass_yards * 0.04 + # 0.04 per passing yard (1 pt per 25 yds)
                pass_tds * 4.0 -    # 4 points per passing TD
                pass_int * 2.0      # -2 points per interception
            )
            
            # Only include if player had some activity
            if targets > 0 or rush_att > 0 or pass_att > 0:
                game_logs_data.append((
                    db_player_id,
                    player_id,  # sleeper_id
                    2025,       # season
                    week,       # week
                    'REG',      # season_type
                    None,       # opponent (we don't have this easily)
                    pass_att,
                    pass_cmp,
                    pass_yards,
                    pass_tds,
                    pass_int,
                    rush_att,
                    rush_yards,
                    rush_tds,
                    targets,
                    receptions,
                    rec_yards,
                    rec_tds,
                    fantasy_points_ppr
                ))
                logs_this_week += 1
        
        print(f"{logs_this_week} logs")
    except Exception as e:
        print(f"❌ Error: {e}")

print(f"\n📊 Collected {len(game_logs_data)} total game logs")

# Update player names in players table
print("\n👤 Updating player names...")
player_names_to_update = []
unique_sleeper_ids = set(log[1] for log in game_logs_data)

for sleeper_id in unique_sleeper_ids:
    if sleeper_id in all_players:
        player_data = all_players[sleeper_id]
        first_name = player_data.get('first_name', '')
        last_name = player_data.get('last_name', '')
        full_name = player_data.get('full_name', f"{first_name} {last_name}".strip())
        
        if first_name or last_name:
            player_names_to_update.append((
                first_name,
                last_name,
                full_name,
                sleeper_id
            ))

if player_names_to_update:
    update_query = """
        UPDATE players 
        SET first_name = %s,
            last_name = %s,
            full_name = %s
        WHERE sleeper_id = %s
    """
    cur.executemany(update_query, player_names_to_update)
    conn.commit()
    print(f"✅ Updated names for {len(player_names_to_update)} players")

if len(game_logs_data) > 0:
    print("\n💾 Inserting into database...")
    
    # Clear existing data for these weeks
    cur.execute("""
        DELETE FROM game_logs 
        WHERE season = 2025 AND week IN (1, 2, 3, 4, 5, 6, 7)
    """)
    deleted = cur.rowcount
    print(f"🗑️  Cleared {deleted} existing records for 2025 weeks 1-7")
    
    # Insert new data
    insert_query = """
        INSERT INTO game_logs (
            player_id, sleeper_id, season, week, season_type, opponent,
            pass_attempts, pass_completions, pass_yards, pass_td, pass_int,
            rush_attempts, rush_yards, rush_td,
            targets, receptions, rec_yards, rec_td,
            fantasy_points_ppr
        ) VALUES %s
    """
    
    execute_values(cur, insert_query, game_logs_data)
    conn.commit()
    
    print(f"✅ Inserted {len(game_logs_data)} game logs successfully!")
    
    # Show sample data
    print("\n📋 Sample game logs inserted:")
    cur.execute("""
        SELECT p.full_name, p.position, gl.week, gl.targets, gl.receptions, 
               gl.rec_yards, gl.fantasy_points_ppr
        FROM game_logs gl
        JOIN players p ON gl.player_id = p.id
        WHERE gl.season = 2025 AND gl.week IN (1, 2, 3, 4, 5, 6, 7)
        ORDER BY gl.fantasy_points_ppr DESC
        LIMIT 10
    """)
    
    for row in cur.fetchall():
        print(f"  {row[0]} ({row[1]}) - Week {row[2]}: {row[3]} tgt, {row[4]} rec, {row[5]} yds, {row[6]:.1f} PPR")

else:
    print("❌ No game logs to insert")

cur.close()
conn.close()

print("\n✅ Game logs population complete!")
