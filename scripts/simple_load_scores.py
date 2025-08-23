import pandas as pd
import os
from sqlalchemy import create_engine
import json

# Load computed scores
database_url = os.getenv('DATABASE_URL')
engine = create_engine(database_url)

scores = pd.read_csv('player_scores_2024.csv')
print(f"📊 Loading {len(scores)} scores...")

# Convert debug_components to JSON string
scores['debug_json'] = scores['debug_components'].apply(lambda x: json.dumps(eval(x)) if pd.notna(x) else '{}')
scores['weights_json'] = '{}'

# Select database columns
db_cols = ['player_id', 'season', 'week', 'format', 'position', 'score', 'vor', 'tier', 'weights_json', 'debug_json']
scores_db = scores[db_cols]

# Load to database
scores_db.to_sql('player_scores', engine, if_exists='replace', index=False)
print(f"✅ Loaded {len(scores_db)} scores to database")