import pandas as pd
import psycopg2
import os
from sqlalchemy import create_engine

def main():
    # Get database URL from environment
    db_url = os.getenv('DATABASE_URL')
    if not db_url:
        print("Error: DATABASE_URL environment variable not set")
        return
    
    # Create engine and load data
    engine = create_engine(db_url)
    
    # Read CSV data
    df = pd.read_csv('data/player_vs_defense_2024.csv')
    print(f"Loading {len(df)} rows into player_vs_defense table...")
    
    # Load into database
    df.to_sql('player_vs_defense', engine, if_exists='append', index=False, method='multi')
    print("✅ Data loaded successfully!")
    
    # Verify the data
    with engine.connect() as conn:
        result = conn.execute("SELECT COUNT(*) FROM player_vs_defense").fetchone()
        print(f"Total rows in player_vs_defense: {result[0]}")

if __name__ == "__main__":
    main()