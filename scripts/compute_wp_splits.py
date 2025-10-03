#!/usr/bin/env python3
"""
Win-Probability Context ETL Pipeline
Computes weekly WP/WPA splits from nfl-data-py play-by-play data
Identifies clutch performance vs garbage-time production
"""

import nfl_data_py as nfl
import pandas as pd
import numpy as np
import psycopg2
from psycopg2.extras import execute_batch
import os
from datetime import datetime

# Database connection
def get_db_connection():
    """Get PostgreSQL connection from environment"""
    return psycopg2.connect(os.environ['DATABASE_URL'])

def compute_wp_splits(season=2024, weeks=None):
    """
    Compute Win-Probability splits for all players by week
    
    Args:
        season: NFL season year
        weeks: List of weeks to process (None = all available)
    
    Returns:
        DataFrame with WP metrics per player per week
    """
    print(f"📊 Loading play-by-play data for {season}...")
    pbp = nfl.import_pbp_data([season])
    
    # Filter to regular season only
    pbp = pbp[pbp['season_type'] == 'REG']
    
    # Filter to specific weeks if provided
    if weeks:
        pbp = pbp[pbp['week'].isin(weeks)]
    
    # Filter to plays with WP data and exclude kneeldowns
    pbp = pbp[pbp['wp'].notna()]
    pbp = pbp[pbp['play_type'] != 'qb_kneel']
    
    print(f"✅ Loaded {len(pbp):,} plays with WP data")
    
    # Define high-leverage and clutch situations
    pbp['high_leverage'] = ((pbp['wp'] >= 0.25) & (pbp['wp'] <= 0.75)).astype(int)
    pbp['q4_one_score'] = (
        (pbp['qtr'] >= 4) & 
        (abs(pbp['score_differential']) <= 8)  # Within one score
    ).astype(int)
    pbp['kneel_out'] = (pbp['play_type'] == 'qb_kneel').astype(int)
    
    results = []
    
    # === Process QB Stats ===
    print("\n🎯 Processing QB WP splits...")
    qb_pass = pbp[pbp['passer_player_id'].notna()].copy()
    
    if len(qb_pass) > 0:
        qb_stats = qb_pass.groupby(['week', 'passer_player_id']).agg({
            'play_id': 'count',  # plays
            'wp': 'mean',  # wp_avg
            'wpa': 'sum',  # wpa_sum
            'high_leverage': 'sum',  # high_leverage_plays
            'q4_one_score': 'sum',  # q4_one_score_plays
            'kneel_out': 'sum'  # kneel_out_plays
        }).reset_index()
        
        qb_stats.columns = ['week', 'player_id', 'plays', 'wp_avg', 'wpa_sum', 
                            'high_leverage_plays', 'q4_one_score_plays', 'kneel_out_plays']
        
        # Calculate Q4 clutch EPA
        qb_clutch = qb_pass[qb_pass['q4_one_score'] == 1].groupby(['week', 'passer_player_id'])['epa'].sum().reset_index()
        qb_clutch.columns = ['week', 'player_id', 'q4_one_score_epa']
        
        qb_stats = qb_stats.merge(qb_clutch, on=['week', 'player_id'], how='left')
        qb_stats['q4_one_score_epa'] = qb_stats['q4_one_score_epa'].fillna(0)
        qb_stats['season'] = season
        
        results.append(qb_stats)
        print(f"✅ Processed {len(qb_stats)} QB weekly records")
    
    # === Process RB Stats ===
    print("\n🏃 Processing RB WP splits...")
    
    # RB rushing plays
    rb_rush = pbp[pbp['rusher_player_id'].notna()].copy()
    rb_rush_stats = rb_rush.groupby(['week', 'rusher_player_id']).agg({
        'play_id': 'count',
        'wp': 'mean',
        'wpa': 'sum',
        'high_leverage': 'sum',
        'q4_one_score': 'sum',
        'kneel_out': 'sum'
    }).reset_index()
    rb_rush_stats.columns = ['week', 'player_id', 'plays', 'wp_avg', 'wpa_sum',
                              'high_leverage_plays', 'q4_one_score_plays', 'kneel_out_plays']
    
    # RB receiving plays
    rb_rec = pbp[pbp['receiver_player_id'].notna()].copy()
    rb_rec_stats = rb_rec.groupby(['week', 'receiver_player_id']).agg({
        'play_id': 'count',
        'wp': 'mean',
        'wpa': 'sum',
        'high_leverage': 'sum',
        'q4_one_score': 'sum'
    }).reset_index()
    rb_rec_stats.columns = ['week', 'player_id', 'rec_plays', 'rec_wp_avg', 'rec_wpa_sum',
                             'rec_high_leverage', 'rec_q4_one_score']
    
    # Combine RB stats (prioritizing rushing but including receiving)
    rb_stats = rb_rush_stats.merge(rb_rec_stats, on=['week', 'player_id'], how='outer', suffixes=('', '_rec'))
    
    # Aggregate totals
    rb_stats['plays'] = rb_stats['plays'].fillna(0) + rb_stats['rec_plays'].fillna(0)
    rb_stats['high_leverage_plays'] = rb_stats['high_leverage_plays'].fillna(0) + rb_stats['rec_high_leverage'].fillna(0)
    rb_stats['q4_one_score_plays'] = rb_stats['q4_one_score_plays'].fillna(0) + rb_stats['rec_q4_one_score'].fillna(0)
    
    # Weighted average WP
    rb_stats['wp_avg'] = np.where(
        rb_stats['plays'] > 0,
        (rb_stats['wp_avg'].fillna(0) * rb_stats['plays'].fillna(0) + 
         rb_stats['rec_wp_avg'].fillna(0) * rb_stats['rec_plays'].fillna(0)) / rb_stats['plays'],
        0
    )
    
    rb_stats['wpa_sum'] = rb_stats['wpa_sum'].fillna(0) + rb_stats['rec_wpa_sum'].fillna(0)
    rb_stats['kneel_out_plays'] = rb_stats['kneel_out_plays'].fillna(0)
    
    # Calculate Q4 clutch EPA for RBs
    rb_clutch_rush = rb_rush[rb_rush['q4_one_score'] == 1].groupby(['week', 'rusher_player_id'])['epa'].sum().reset_index()
    rb_clutch_rush.columns = ['week', 'player_id', 'q4_epa_rush']
    
    rb_clutch_rec = rb_rec[rb_rec['q4_one_score'] == 1].groupby(['week', 'receiver_player_id'])['epa'].sum().reset_index()
    rb_clutch_rec.columns = ['week', 'player_id', 'q4_epa_rec']
    
    rb_stats = rb_stats.merge(rb_clutch_rush, on=['week', 'player_id'], how='left')
    rb_stats = rb_stats.merge(rb_clutch_rec, on=['week', 'player_id'], how='left')
    rb_stats['q4_one_score_epa'] = rb_stats['q4_epa_rush'].fillna(0) + rb_stats['q4_epa_rec'].fillna(0)
    
    # Keep only needed columns
    rb_stats = rb_stats[['week', 'player_id', 'plays', 'wp_avg', 'wpa_sum', 
                         'high_leverage_plays', 'q4_one_score_plays', 'kneel_out_plays', 'q4_one_score_epa']]
    rb_stats['season'] = season
    
    results.append(rb_stats)
    print(f"✅ Processed {len(rb_stats)} RB weekly records")
    
    # === Process WR/TE Stats ===
    print("\n📡 Processing WR/TE WP splits...")
    rec = pbp[pbp['receiver_player_id'].notna()].copy()
    
    if len(rec) > 0:
        rec_stats = rec.groupby(['week', 'receiver_player_id']).agg({
            'play_id': 'count',
            'wp': 'mean',
            'wpa': 'sum',
            'high_leverage': 'sum',
            'q4_one_score': 'sum'
        }).reset_index()
        
        rec_stats.columns = ['week', 'player_id', 'plays', 'wp_avg', 'wpa_sum',
                             'high_leverage_plays', 'q4_one_score_plays']
        rec_stats['kneel_out_plays'] = 0  # WRs don't kneel
        
        # Calculate Q4 clutch EPA
        rec_clutch = rec[rec['q4_one_score'] == 1].groupby(['week', 'receiver_player_id'])['epa'].sum().reset_index()
        rec_clutch.columns = ['week', 'player_id', 'q4_one_score_epa']
        
        rec_stats = rec_stats.merge(rec_clutch, on=['week', 'player_id'], how='left')
        rec_stats['q4_one_score_epa'] = rec_stats['q4_one_score_epa'].fillna(0)
        rec_stats['season'] = season
        
        results.append(rec_stats)
        print(f"✅ Processed {len(rec_stats)} WR/TE weekly records")
    
    # Combine all results
    if results:
        final_df = pd.concat(results, ignore_index=True)
        
        # Round numeric columns
        final_df['wp_avg'] = final_df['wp_avg'].round(4)
        final_df['wpa_sum'] = final_df['wpa_sum'].round(4)
        final_df['q4_one_score_epa'] = final_df['q4_one_score_epa'].round(3)
        
        print(f"\n✅ Total: {len(final_df)} player-week WP records")
        return final_df
    
    return pd.DataFrame()

def upsert_wp_splits(df):
    """
    Upsert WP splits data into PostgreSQL
    """
    if df.empty:
        print("⚠️ No data to insert")
        return
    
    conn = get_db_connection()
    cur = conn.cursor()
    
    # Prepare upsert query
    upsert_query = """
        INSERT INTO wp_splits_weekly (
            season, week, player_id, plays, wp_avg, wpa_sum,
            high_leverage_plays, q4_one_score_plays, q4_one_score_epa, kneel_out_plays
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (season, week, player_id) 
        DO UPDATE SET
            plays = EXCLUDED.plays,
            wp_avg = EXCLUDED.wp_avg,
            wpa_sum = EXCLUDED.wpa_sum,
            high_leverage_plays = EXCLUDED.high_leverage_plays,
            q4_one_score_plays = EXCLUDED.q4_one_score_plays,
            q4_one_score_epa = EXCLUDED.q4_one_score_epa,
            kneel_out_plays = EXCLUDED.kneel_out_plays,
            last_updated = NOW()
    """
    
    # Prepare batch data
    rows = []
    for _, row in df.iterrows():
        rows.append((
            int(row['season']),
            int(row['week']),
            str(row['player_id']),
            int(row['plays']),
            float(row['wp_avg']) if pd.notna(row['wp_avg']) else None,
            float(row['wpa_sum']) if pd.notna(row['wpa_sum']) else None,
            int(row['high_leverage_plays']),
            int(row['q4_one_score_plays']),
            float(row['q4_one_score_epa']) if pd.notna(row['q4_one_score_epa']) else None,
            int(row['kneel_out_plays'])
        ))
    
    # Execute batch upsert
    print(f"💾 Upserting {len(rows)} records...")
    execute_batch(cur, upsert_query, rows, page_size=500)
    
    conn.commit()
    cur.close()
    conn.close()
    
    print(f"✅ Successfully upserted {len(rows)} WP split records")

def main():
    """Main ETL execution"""
    import sys
    
    season = int(sys.argv[1]) if len(sys.argv) > 1 else 2024
    weeks = None
    if len(sys.argv) > 2:
        weeks = [int(w) for w in sys.argv[2].split(',')]
    
    print(f"🏈 Starting WP Splits ETL for {season}")
    if weeks:
        print(f"📅 Processing weeks: {weeks}")
    
    # Compute WP splits
    df = compute_wp_splits(season=season, weeks=weeks)
    
    # Upsert to database
    if not df.empty:
        upsert_wp_splits(df)
        
        # Show sample results
        print("\n📊 Sample WP splits (top clutch performers):")
        top_clutch = df.nlargest(10, 'q4_one_score_epa')[['player_id', 'week', 'plays', 'wp_avg', 'q4_one_score_plays', 'q4_one_score_epa']]
        print(top_clutch.to_string(index=False))
    
    print("\n✅ WP Splits ETL complete!")

if __name__ == "__main__":
    main()
