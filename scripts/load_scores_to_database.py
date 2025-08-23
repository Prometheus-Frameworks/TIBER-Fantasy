import pandas as pd
import os
from sqlalchemy import create_engine, text
import json
import argparse

def load_scores_to_database(year=2024):
    """Load computed player scores CSV into PostgreSQL database"""
    
    database_url = os.getenv('DATABASE_URL')
    if not database_url:
        print("❌ DATABASE_URL environment variable not set")
        return
    
    print(f"🔢 Loading computed scores for {year} into database...")
    
    try:
        engine = create_engine(database_url)
        
        scores_file = f'player_scores_{year}.csv'
        if os.path.exists(scores_file):
            scores = pd.read_csv(scores_file)
            print(f"📊 Loading {len(scores)} computed scores...")
            
            # Parse debug_components column if it exists and convert to JSON string
            if 'debug_components' in scores.columns:
                # Convert dict strings to proper JSON strings
                scores['debug_json'] = scores['debug_components'].apply(lambda x: json.dumps(x) if pd.notna(x) else '{}')
            else:
                scores['debug_json'] = '{}'
            
            # Add missing columns if needed
            if 'weights_json' not in scores.columns:
                scores['weights_json'] = '{}'
            
            # Clear existing scores for this year
            with engine.connect() as conn:
                conn.execute(text(f"DELETE FROM player_scores WHERE season = {year}"))
                conn.commit()
            
            # Select only columns that exist in database
            db_columns = ['player_id', 'season', 'week', 'format', 'position', 'score', 'vor', 'tier', 'weights_json', 'debug_json']
            scores_subset = scores[db_columns].copy()
            
            # Load scores
            scores_subset.to_sql('player_scores', engine, if_exists='append', index=False)
            print(f"✅ Loaded {len(scores_subset)} computed scores")
        else:
            print(f"⚠️  {scores_file} not found")
        
        # Verify loaded data
        with engine.connect() as conn:
            total_scores = conn.execute(text("SELECT COUNT(*) FROM player_scores")).scalar()
            
            # Show breakdown by format and position
            breakdown = conn.execute(text("""
                SELECT format, position, COUNT(*) as count,
                       ROUND(AVG(score), 1) as avg_score,
                       ROUND(MIN(score), 1) as min_score,
                       ROUND(MAX(score), 1) as max_score
                FROM player_scores 
                WHERE season = :year
                GROUP BY format, position 
                ORDER BY format, position
            """), {"year": year}).fetchall()
            
            print(f"📊 Database verification:")
            print(f"   - Total player scores: {total_scores}")
            print(f"📊 Score breakdown:")
            for row in breakdown:
                format_type, pos, count, avg_score, min_score, max_score = row
                print(f"   - {format_type} {pos}: {count} players, avg={avg_score}, range={min_score}-{max_score}")
        
        print("✅ Score loading completed successfully!")
        
    except Exception as e:
        print(f"❌ Score loading failed: {e}")
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--year', type=int, default=2024)
    args = parser.parse_args()
    load_scores_to_database(args.year)