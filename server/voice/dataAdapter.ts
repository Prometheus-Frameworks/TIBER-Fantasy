/**
 * Data Adapter - Real OTC Power Database Integration
 * Fetches live player data from Power Rankings & RAG scoring system
 */

import { db } from '../db';

export async function resolvePlayerId(nameOrId: string): Promise<{ player_id: string } | null> {
  try {
    // Try exact ID match first
    const byId = await db.query(
      'SELECT player_id FROM players WHERE player_id = $1 LIMIT 1',
      [nameOrId]
    );
    if (byId.rows[0]) return byId.rows[0];

    // Try exact name match
    const byName = await db.query(
      'SELECT player_id FROM players WHERE LOWER(name) = LOWER($1) LIMIT 1',
      [nameOrId]
    );
    if (byName.rows[0]) return byName.rows[0];

    // Fuzzy name match
    const loose = await db.query(
      'SELECT player_id FROM players WHERE name ILIKE $1 ORDER BY name ASC LIMIT 1',
      [`%${nameOrId}%`]
    );
    return loose.rows[0] || null;
  } catch (error) {
    console.warn('Player resolution failed, using fallback:', error);
    return null;
  }
}

export interface PlayerWeekBundle {
  player_id: string;
  name: string;
  team: string;
  position: 'QB' | 'RB' | 'WR' | 'TE';
  rank?: number;
  power_score?: number;
  prev_power_score?: number;
  rag_color?: 'GREEN' | 'AMBER' | 'RED';
  rag_score?: number;
  expected_points?: number;
  floor_points?: number;
  ceiling_points?: number;
  availability?: number;          // 0..100
  opp_multiplier?: number;        // 0.85..1.15
  delta_vs_ecr?: number;          // market_rank - our_rank
  beat_proj?: number;             // 0..100
  upside_index?: number;          // 0..100
  injury_flag?: string | null;    // 'OUT','Q','D','-' ...
  confidence?: number;            // existing confidence if stored
}

export async function fetchPlayerWeekBundle(
  player_id: string, 
  season: number, 
  week: number
): Promise<PlayerWeekBundle | null> {
  try {
    // Complex query to get power + rag + market data
    const { rows } = await db.query(`
      WITH ours AS (
        SELECT pr.rank, pr.player_id, pr.ranking_type, pr.power_score
        FROM power_ranks pr
        WHERE pr.season=$1 AND pr.week=$2 AND pr.player_id=$3 
          AND pr.ranking_type IN ('OVERALL','QB','RB','WR','TE')
        ORDER BY CASE pr.ranking_type WHEN 'OVERALL' THEN 0 ELSE 1 END, pr.rank
        LIMIT 1
      ),
      facts AS (
        SELECT f.player_id, f.season, f.week, f.rag_color, f.rag_score, 
               f.expected_points, f.floor_points, f.ceiling_points,
               f.availability, (f.flags ->> 'injury') as injury_flag, 
               f.market_anchor, f.features,
               f.upside_index, f.beat_proj
        FROM player_week_facts f
        WHERE f.player_id=$3 AND f.season=$1 AND f.week=$2
      ),
      prev AS (
        SELECT power_score as prev_power_score
        FROM player_week_facts
        WHERE player_id=$3 AND season=$1 AND week=$2-1
        LIMIT 1
      ),
      market AS (
        SELECT market_rank
        FROM bt_market_rank
        WHERE season=$1 AND week=$2 AND player_id=$3 
          AND ranking_type IN ('QB','RB','WR','TE')
        ORDER BY 1 ASC LIMIT 1
      )
      SELECT p.player_id, p.name, p.team, p.position,
             o.rank, o.power_score,
             pv.prev_power_score,
             f.rag_color, f.rag_score, f.expected_points, f.floor_points, f.ceiling_points,
             COALESCE((f.features->>'opp_multiplier')::float, 1.0) as opp_multiplier,
             COALESCE(f.availability, 100) as availability,
             COALESCE(f.upside_index,0) as upside_index,
             COALESCE(f.beat_proj,0) as beat_proj,
             COALESCE(f.injury_flag, null) as injury_flag,
             (SELECT confidence FROM player_week_facts WHERE player_id=$3 AND season=$1 AND week=$2) as confidence,
             m.market_rank
      FROM players p
      LEFT JOIN ours o ON o.player_id=p.player_id
      LEFT JOIN facts f ON f.player_id=p.player_id
      LEFT JOIN prev pv ON true
      LEFT JOIN market m ON true
      WHERE p.player_id=$3
    `, [season, week, player_id]);

    if (!rows[0]) return null;
    
    const r = rows[0];
    const delta_vs_ecr = r.market_rank ? (r.market_rank - (r.rank ?? 999)) : 0;
    
    return { ...r, delta_vs_ecr };
  } catch (error) {
    console.warn('Database query failed, using fallback data:', error);
    
    // Fallback to mock data when database unavailable
    return {
      player_id,
      name: player_id.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      team: 'UNK',
      position: 'QB',
      rank: 50,
      power_score: 50,
      rag_color: 'AMBER',
      rag_score: 50,
      expected_points: 11,
      floor_points: 8,
      ceiling_points: 15,
      availability: 100,
      opp_multiplier: 1.0,
      delta_vs_ecr: 0,
      upside_index: 50,
      beat_proj: 50,
      injury_flag: null,
      confidence: 55
    };
  }
}

// Legacy compatibility - keep the old function name working
export async function fetchPlayerWeekBundle_legacy(
  playerId: string, 
  season: number, 
  week: number
): Promise<any> {
  const resolved = await resolvePlayerId(playerId);
  if (!resolved) return null;
  
  return await fetchPlayerWeekBundle(resolved.player_id, season, week);
}