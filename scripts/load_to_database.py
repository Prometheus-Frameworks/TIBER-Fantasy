import pandas as pd
import psycopg2
import os
from sqlalchemy import create_engine, text
import argparse

def load_csvs_to_database(year=2024):
    """Load player profile and inputs CSVs into PostgreSQL database"""
    
    # Get database URL from environment
    database_url = os.getenv('DATABASE_URL')
    if not database_url:
        print("❌ DATABASE_URL environment variable not set")
        return
    
    print(f"🗃️  Loading CSV data for {year} into database...")
    
    try:
        # Create SQLAlchemy engine
        engine = create_engine(database_url)
        
        # Load player profiles
        profile_file = f'player_profile_{year}.csv'
        if os.path.exists(profile_file):
            profiles = pd.read_csv(profile_file)
            print(f"📊 Loading {len(profiles)} player profiles...")
            
            # Clear existing data for this year (optional)
            with engine.connect() as conn:
                conn.execute(text("DELETE FROM player_profile"))
                conn.commit()
            
            # Load new data
            profiles.to_sql('player_profile', engine, if_exists='append', index=False)
            print(f"✅ Loaded {len(profiles)} player profiles")
        else:
            print(f"⚠️  {profile_file} not found")
        
        # Load player inputs
        inputs_file = f'player_inputs_{year}.csv'
        if os.path.exists(inputs_file):
            inputs = pd.read_csv(inputs_file)
            print(f"📊 Loading {len(inputs)} player inputs...")
            
            # Clear existing data for this year/weeks
            weeks = inputs['week'].unique()
            with engine.connect() as conn:
                for week in weeks:
                    conn.execute(text("DELETE FROM player_inputs WHERE season = :year AND week = :week"), {"year": year, "week": week})
                conn.commit()
            
            # Load new data  
            inputs.to_sql('player_inputs', engine, if_exists='append', index=False)
            print(f"✅ Loaded {len(inputs)} player inputs")
        else:
            print(f"⚠️  {inputs_file} not found")
        
        print("🎯 Verifying database contents...")
        
        # Verify loaded data
        with engine.connect() as conn:
            profile_count = conn.execute(text("SELECT COUNT(*) FROM player_profile")).scalar()
            inputs_count = conn.execute(text("SELECT COUNT(*) FROM player_inputs WHERE season = :year"), {"year": year}).scalar()
            
            print(f"📊 Database verification:")
            print(f"   - Player profiles: {profile_count}")
            print(f"   - Player inputs ({year}): {inputs_count}")
            
            # Show position breakdown
            pos_breakdown = conn.execute(text("""
                SELECT position, COUNT(*) as count 
                FROM player_profile 
                GROUP BY position 
                ORDER BY position
            """)).fetchall()
            
            print(f"📊 Position breakdown:")
            for pos, count in pos_breakdown:
                print(f"   - {pos}: {count}")
        
        print("✅ Database loading completed successfully!")
        
    except Exception as e:
        print(f"❌ Database loading failed: {e}")
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--year', type=int, default=2024)
    args = parser.parse_args()
    load_csvs_to_database(args.year)