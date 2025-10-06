#!/usr/bin/env python3
"""
Import nflfastR roster data for player name mapping
"""
import os
import nfl_data_py as nfl
from sqlalchemy import create_engine, text

def import_rosters(season=2025):
    """Import nflfastR roster data and store in database"""
    
    # Get database connection
    database_url = os.environ.get('DATABASE_URL')
    if not database_url:
        raise ValueError("DATABASE_URL environment variable not set")
    
    engine = create_engine(database_url)
    
    # Create table for nflfastR rosters
    create_table_query = """
    CREATE TABLE IF NOT EXISTS nflfastr_rosters (
        id SERIAL PRIMARY KEY,
        player_id VARCHAR(50) NOT NULL,
        player_name VARCHAR(255),
        first_name VARCHAR(100),
        last_name VARCHAR(100),
        position VARCHAR(10),
        team VARCHAR(10),
        jersey_number INT,
        season INT NOT NULL,
        height VARCHAR(10),
        weight INT,
        college VARCHAR(255),
        birth_date DATE,
        years_exp INT,
        sleeper_id VARCHAR(50),
        espn_id VARCHAR(50),
        yahoo_id VARCHAR(50),
        rotowire_id VARCHAR(50),
        fantasy_data_id VARCHAR(50),
        headshot_url TEXT,
        last_updated TIMESTAMP DEFAULT NOW(),
        
        UNIQUE(player_id, season)
    );
    
    CREATE INDEX IF NOT EXISTS idx_nflfastr_rosters_player_id ON nflfastr_rosters(player_id);
    CREATE INDEX IF NOT EXISTS idx_nflfastr_rosters_season ON nflfastr_rosters(season);
    """
    
    with engine.connect() as conn:
        conn.execute(text(create_table_query))
        conn.commit()
    
    print(f"📥 Importing {season} season rosters from nflfastR...")
    
    # Import roster data
    rosters_df = nfl.import_seasonal_rosters([season])
    
    print(f"✅ Fetched {len(rosters_df)} roster records")
    
    # Filter to relevant columns and clean data
    rosters_clean = rosters_df[[
        'player_id', 'player_name', 'first_name', 'last_name', 
        'position', 'team', 'jersey_number', 'season',
        'height', 'weight', 'college', 'birth_date', 'years_exp',
        'sleeper_id', 'espn_id', 'yahoo_id', 'rotowire_id', 
        'fantasy_data_id', 'headshot_url'
    ]].copy()
    
    # Convert birth_date to proper format
    rosters_clean['birth_date'] = rosters_clean['birth_date'].astype(str).replace('NaT', None)
    
    # Insert into database (replace existing records for this season)
    with engine.connect() as conn:
        # Delete existing records for this season
        conn.execute(text("DELETE FROM nflfastr_rosters WHERE season = :season"), {"season": season})
        conn.commit()
    
    # Use pandas to_sql for fast bulk insert
    rosters_clean.to_sql(
        'nflfastr_rosters',
        engine,
        if_exists='append',
        index=False,
        method='multi',
        chunksize=1000
    )
    
    print(f"✅ Imported {len(rosters_clean)} players to nflfastr_rosters table")
    
    # Show sample data
    with engine.connect() as conn:
        result = conn.execute(text("""
            SELECT player_id, player_name, position, team
            FROM nflfastr_rosters
            WHERE season = :season
            ORDER BY player_name
            LIMIT 10
        """), {"season": season})
        
        print(f"\n📊 Sample roster data:")
        print("-" * 80)
        print(f"{'Player ID':<15} {'Name':<30} {'Pos':<5} {'Team':<5}")
        print("-" * 80)
        for row in result:
            print(f"{row.player_id:<15} {row.player_name:<30} {row.position:<5} {row.team:<5}")
    
    print(f"\n✅ Roster import complete!")

if __name__ == "__main__":
    import_rosters(2025)
