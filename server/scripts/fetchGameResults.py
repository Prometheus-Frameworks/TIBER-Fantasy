import nfl_data_py as nfl
import os
import psycopg2
from psycopg2.extras import execute_values

# Get database URL from environment
DATABASE_URL = os.environ.get('DATABASE_URL')

def fetch_and_update_game_results():
    """Fetch game results from nfl-data-py and update schedule table"""
    
    print("📥 Fetching 2024 game schedules from nfl-data-py...")
    
    # Fetch schedules for 2024
    schedules = nfl.import_schedules([2024])
    
    # Filter to weeks 1-4 that have been played (have scores)
    completed_games = schedules[
        (schedules['week'] <= 4) & 
        (schedules['home_score'].notna()) & 
        (schedules['away_score'].notna())
    ]
    
    print(f"✅ Found {len(completed_games)} completed games from weeks 1-4")
    
    # Connect to database
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()
    
    # Prepare update data
    updates = []
    for _, game in completed_games.iterrows():
        # Map team abbreviations
        home_team = game['home_team']
        away_team = game['away_team']
        week = int(game['week'])
        home_score = int(game['home_score'])
        away_score = int(game['away_score'])
        result = int(game['result'])  # positive = home win, negative = away win
        
        updates.append((
            home_score,
            away_score,
            result,
            2024,  # season
            week,
            home_team,
            away_team
        ))
    
    # Update schedule table
    update_query = """
        UPDATE schedule 
        SET home_score = %s, away_score = %s, result = %s
        WHERE season = %s AND week = %s AND home = %s AND away = %s
    """
    
    print(f"📝 Updating {len(updates)} games in schedule table...")
    cur.executemany(update_query, updates)
    conn.commit()
    
    print(f"✅ Successfully updated {cur.rowcount} games with scores and results")
    
    # Verify update
    cur.execute("""
        SELECT COUNT(*) FROM schedule 
        WHERE season = 2024 AND week <= 4 AND home_score IS NOT NULL
    """)
    count = cur.fetchone()[0]
    print(f"✅ Verification: {count} games now have scores in database")
    
    cur.close()
    conn.close()

if __name__ == "__main__":
    fetch_and_update_game_results()
