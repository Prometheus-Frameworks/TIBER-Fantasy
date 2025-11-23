#!/usr/bin/env python3
"""
Compute QB EPA and CPOE metrics from bronze_nflfastr_plays
Populates qbEpaReference and qbContextMetrics tables
"""

import psycopg2
import os

def compute_qb_epa_cpoe():
    DATABASE_URL = os.getenv('DATABASE_URL')
    if not DATABASE_URL:
        raise ValueError("DATABASE_URL environment variable not set")
    
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()
    
    print("🔄 Computing QB EPA and CPOE metrics from bronze_nflfastr_plays...")
    
    # Get seasons available in bronze layer
    cur.execute("SELECT DISTINCT season FROM bronze_nflfastr_plays ORDER BY season DESC")
    seasons = [row[0] for row in cur.fetchall()]
    print(f"📊 Processing seasons: {seasons}")
    
    for season in seasons:
        print(f"\n🏈 Processing season {season}...")
        
        # Clear existing data for this season
        cur.execute("DELETE FROM qb_epa_reference WHERE season = %s", (season,))
        cur.execute("DELETE FROM qb_context_metrics WHERE season = %s", (season,))
        conn.commit()
        
        # Compute season-level EPA metrics for qbEpaReference
        print(f"   📈 Computing season-level EPA metrics...")
        cur.execute("""
            INSERT INTO qb_epa_reference (
                player_id, player_name, team, season, week,
                num_plays, raw_epa_per_play, adj_epa_per_play, epa_diff,
                source, data_date
            )
            SELECT 
                passer_player_id as player_id,
                passer_player_name as player_name,
                MAX(posteam) as team,
                season,
                NULL as week,
                COUNT(*) as num_plays,
                AVG(epa)::real as raw_epa_per_play,
                AVG(epa)::real as adj_epa_per_play,
                0::real as epa_diff,
                'nflfastr_computed' as source,
                NOW() as data_date
            FROM bronze_nflfastr_plays
            WHERE season = %s
            AND passer_player_id IS NOT NULL
            AND play_type IN ('pass', 'run')
            GROUP BY passer_player_id, passer_player_name, season
            HAVING COUNT(*) >= 50
        """, (season,))
        season_rows = cur.rowcount
        
        # Compute weekly EPA metrics for qbEpaReference
        print(f"   📅 Computing weekly EPA metrics...")
        cur.execute("""
            INSERT INTO qb_epa_reference (
                player_id, player_name, team, season, week,
                num_plays, raw_epa_per_play, adj_epa_per_play, epa_diff,
                source, data_date
            )
            SELECT 
                passer_player_id as player_id,
                passer_player_name as player_name,
                MAX(posteam) as team,
                season,
                week,
                COUNT(*) as num_plays,
                AVG(epa)::real as raw_epa_per_play,
                AVG(epa)::real as adj_epa_per_play,
                0::real as epa_diff,
                'nflfastr_computed' as source,
                NOW() as data_date
            FROM bronze_nflfastr_plays
            WHERE season = %s
            AND passer_player_id IS NOT NULL
            AND play_type IN ('pass', 'run')
            GROUP BY passer_player_id, passer_player_name, season, week
            HAVING COUNT(*) >= 5
        """, (season,))
        weekly_rows = cur.rowcount
        
        # Compute context metrics (CPOE, sacks, completions) for qbContextMetrics
        print(f"   🎯 Computing context metrics (CPOE, sacks, completions)...")
        cur.execute("""
            INSERT INTO qb_context_metrics (
                player_id, player_name, season, week,
                pass_attempts, completions, sacks, cpoe,
                created_at
            )
            SELECT 
                passer_player_id as player_id,
                passer_player_name as player_name,
                season,
                week,
                COUNT(CASE WHEN play_type = 'pass' THEN 1 END)::integer as pass_attempts,
                COUNT(CASE WHEN complete_pass = true THEN 1 END)::integer as completions,
                COUNT(CASE WHEN (raw_data->>'sack')::numeric = 1 THEN 1 END)::integer as sacks,
                AVG(CASE 
                    WHEN (raw_data->>'cpoe') IS NOT NULL AND play_type = 'pass'
                    THEN (raw_data->>'cpoe')::numeric 
                    ELSE NULL 
                END)::real as cpoe,
                NOW() as created_at
            FROM bronze_nflfastr_plays
            WHERE season = %s
            AND passer_player_id IS NOT NULL
            AND play_type IN ('pass', 'run')
            GROUP BY passer_player_id, passer_player_name, season, week
            HAVING COUNT(*) >= 5
        """, (season,))
        context_rows = cur.rowcount
        
        conn.commit()
        print(f"   ✅ Season {season}: {season_rows} season-level, {weekly_rows} weekly EPA rows, {context_rows} context rows")
    
    # Show summary statistics
    print("\n📊 Summary Statistics:")
    cur.execute("""
        SELECT season, COUNT(*) as total_rows, 
               COUNT(DISTINCT player_id) as unique_qbs,
               AVG(raw_epa_per_play)::numeric(10,4) as avg_epa,
               MIN(raw_epa_per_play)::numeric(10,4) as min_epa,
               MAX(raw_epa_per_play)::numeric(10,4) as max_epa
        FROM qb_epa_reference
        WHERE week IS NULL
        GROUP BY season
        ORDER BY season DESC
    """)
    
    print("\nqbEpaReference (season-level):")
    for season, total, qbs, avg_epa, min_epa, max_epa in cur.fetchall():
        print(f"   {season}: {qbs} QBs, {total} rows, EPA range: {min_epa} to {max_epa} (avg: {avg_epa})")
    
    cur.execute("""
        SELECT season, COUNT(*) as total_rows,
               COUNT(DISTINCT player_id) as unique_qbs,
               AVG(cpoe)::numeric(10,4) as avg_cpoe
        FROM qb_context_metrics
        GROUP BY season
        ORDER BY season DESC
    """)
    
    print("\nqbContextMetrics:")
    for season, total, qbs, avg_cpoe in cur.fetchall():
        print(f"   {season}: {qbs} QBs, {total} rows, avg CPOE: {avg_cpoe}")
    
    cur.close()
    conn.close()
    
    print(f"\n🎉 EPA/CPOE computation complete!")

if __name__ == "__main__":
    compute_qb_epa_cpoe()
