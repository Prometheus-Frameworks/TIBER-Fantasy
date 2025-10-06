#!/usr/bin/env python3
"""
Populate 2025 schedule from nflfastR
"""

import pandas as pd
import psycopg2
from psycopg2.extras import execute_values
import os
import requests
from io import BytesIO

def get_db_connection():
    return psycopg2.connect(os.getenv('DATABASE_URL'))

def populate_schedule():
    print("📅 Downloading 2025 schedule from nflfastR...")
    
    url = "https://github.com/nflverse/nflverse-data/releases/download/schedules/schedules.parquet"
    
    try:
        response = requests.get(url, timeout=60)
        response.raise_for_status()
        
        schedules = pd.read_parquet(BytesIO(response.content))
        
        # Filter to 2025 season
        schedule_2025 = schedules[schedules['season'] == 2025].copy()
        
        print(f"✅ Downloaded {len(schedule_2025)} games for 2025 season")
        
        conn = get_db_connection()
        cur = conn.cursor()
        
        try:
            games_to_insert = []
            
            for _, game in schedule_2025.iterrows():
                games_to_insert.append((
                    game.get('game_id'),
                    game.get('season'),
                    game.get('week'),
                    game.get('home_team'),
                    game.get('away_team'),
                    game.get('home_score'),
                    game.get('away_score'),
                    None  # result will be computed later
                ))
            
            execute_values(cur, """
                INSERT INTO schedule 
                (game_id, season, week, home, away, home_score, away_score, result)
                VALUES %s
                ON CONFLICT (game_id) DO UPDATE
                SET home_score = EXCLUDED.home_score,
                    away_score = EXCLUDED.away_score
            """, games_to_insert)
            
            conn.commit()
            print(f"✅ Populated {len(games_to_insert)} games for 2025 schedule")
            
        except Exception as e:
            conn.rollback()
            print(f"❌ Error populating schedule: {e}")
            import traceback
            traceback.print_exc()
        finally:
            cur.close()
            conn.close()
            
    except Exception as e:
        print(f"❌ Error downloading schedule: {e}")

if __name__ == "__main__":
    populate_schedule()
