import nfl_data_py as nfl
import pandas as pd
import os
from sqlalchemy import create_engine, text
from datetime import datetime, timedelta
import logging

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def get_latest_week_in_db(engine, season):
    """Get the latest week we have data for in the database"""
    try:
        query = text("SELECT MAX(week) FROM player_vs_defense WHERE season = :season")
        result = engine.execute(query, season=season).fetchone()
        return result[0] if result[0] is not None else 0
    except:
        return 0

def get_current_nfl_week(season=2025):
    """Get the current NFL week based on available data"""
    try:
        # Get schedule data to determine current week
        schedule = nfl.import_schedules([season])
        current_date = datetime.now()
        
        # Find the most recent completed week
        completed_weeks = []
        for week in range(1, 19):
            week_games = schedule[(schedule['season'] == season) & (schedule['week'] == week)]
            if not week_games.empty:
                # Check if week has games and if they're likely completed
                # (This is a simple heuristic - games are usually on weekends)
                latest_game_date = pd.to_datetime(week_games['gameday']).max()
                if latest_game_date < current_date - timedelta(days=1):
                    completed_weeks.append(week)
        
        return max(completed_weeks) if completed_weeks else 0
    except Exception as e:
        logger.error(f"Error determining current NFL week: {e}")
        return 0

def update_player_vs_defense_data(season=2025):
    """Update player vs defense data for new weeks"""
    logger.info(f"Starting player vs defense update for season {season}")
    
    # Get database connection
    db_url = os.getenv('DATABASE_URL')
    if not db_url:
        logger.error("DATABASE_URL environment variable not set")
        return False
    
    engine = create_engine(db_url)
    
    try:
        # Determine what weeks to update
        latest_week_in_db = get_latest_week_in_db(engine, season)
        current_week = get_current_nfl_week(season)
        
        logger.info(f"Latest week in DB: {latest_week_in_db}, Current NFL week: {current_week}")
        
        if current_week <= latest_week_in_db:
            logger.info("Database is already up to date")
            return True
        
        # Get weeks to update
        weeks_to_update = list(range(latest_week_in_db + 1, current_week + 1))
        logger.info(f"Updating weeks: {weeks_to_update}")
        
        positions = ["QB", "RB", "WR", "TE"]
        total_new_rows = 0
        
        for week in weeks_to_update:
            logger.info(f"Processing week {week}...")
            
            try:
                # Fetch weekly data
                df = nfl.import_weekly_data([season])
                df = df[(df["season"] == season) & (df["season_type"] == "REG") & (df["week"] == week)]
                df = df[df["position"].isin(positions)]
                
                if df.empty:
                    logger.warning(f"No data available for week {week} yet")
                    continue
                
                # Prepare data for database
                keep = df[[
                    "season", "week", "opponent_team", "position", "player_name", "recent_team", "fantasy_points_ppr", "player_id"
                ]].rename(columns={
                    "opponent_team": "def_team",
                    "recent_team": "player_team",
                    "fantasy_points_ppr": "fpts"
                })
                
                # Drop rows with missing data
                keep = keep[keep["player_name"].notna() & keep["fpts"].notna()]
                
                if not keep.empty:
                    # Insert into database
                    keep.to_sql('player_vs_defense', engine, if_exists='append', index=False, method='multi')
                    total_new_rows += len(keep)
                    logger.info(f"Added {len(keep)} records for week {week}")
                else:
                    logger.warning(f"No valid records for week {week}")
                    
            except Exception as e:
                logger.error(f"Error processing week {week}: {e}")
                continue
        
        logger.info(f"Update complete! Added {total_new_rows} new records")
        return True
        
    except Exception as e:
        logger.error(f"Error during update: {e}")
        return False
    
    finally:
        engine.dispose()

def main():
    """Main function for running the update"""
    season = 2025  # Update for current season
    success = update_player_vs_defense_data(season)
    
    if success:
        logger.info("Player vs defense data update completed successfully")
    else:
        logger.error("Player vs defense data update failed")
        exit(1)

if __name__ == "__main__":
    main()