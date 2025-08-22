import pandas as pd
import psycopg2
import os
from sqlalchemy import create_engine

# Read the CSV
df = pd.read_csv('data/player_season_2024.csv')

print(f"🏈 Loading {len(df)} players into database...")

# Get database URL from environment
database_url = os.environ.get('DATABASE_URL')
if not database_url:
    print("❌ DATABASE_URL not found")
    exit(1)

# Create engine and load data
engine = create_engine(database_url)

# Insert data into the table
df.to_sql('player_season_2024', engine, if_exists='append', index=False, method='multi')

print(f"✅ Successfully loaded {len(df)} players into player_season_2024 table")

# Show some sample data
print(f"\n🏆 Top 5 players by position (PPR points):")
for pos in ['QB', 'RB', 'WR', 'TE']:
    pos_data = df[df['position'] == pos].nlargest(3, 'fpts_ppr')
    print(f"\n{pos}:")
    for _, row in pos_data.iterrows():
        name = row['player_name']
        team = row['team'] 
        pts = row['fpts_ppr']
        if pd.notna(pts):
            print(f"  {name} ({team}) - {pts:.1f} pts")