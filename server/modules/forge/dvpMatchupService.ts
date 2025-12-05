/**
 * DvP-Powered Matchup Service v2.0
 * 
 * Uses defense_vs_position_stats table for accurate matchup scoring.
 * Primary signal: avg_pts_per_game_ppr (fantasy points allowed per game)
 * 
 * Score Scale: 0-100 where higher = easier matchup (more FPTS allowed)
 * - 80-100: Elite matchup (smash spot)
 * - 60-79: Favorable matchup
 * - 40-59: Neutral matchup
 * - 20-39: Tough matchup
 * - 0-19: Very tough matchup (avoid)
 */

import { db } from '../../infra/db';
import { sql } from 'drizzle-orm';

export interface DvPMatchup {
  defenseTeam: string;
  position: string;
  season: number;
  week: number;
  avgFptsAllowed: number;
  rankVsPosition: number;  // 1-32 (1 = easiest matchup)
  dvpRating: string;       // elite-matchup, good, neutral, tough
  matchupScore100: number; // 0-100 normalized score
  isSmashSpot: boolean;    // Top 8 matchup
  isToughSpot: boolean;    // Bottom 8 matchup
}

export interface WeeklyDvPMatchup {
  week: number;
  opponent: string;
  isHome: boolean;
  matchupScore100: number;
  rankVsPosition: number;
  dvpRating: string;
  avgFptsAllowed: number;
  isSmashSpot: boolean;
  isToughSpot: boolean;
}

// Position-specific FPTS ranges for normalization (based on 2025 week 6 data)
// Higher FPTS allowed = easier matchup = higher score
const FPTS_RANGES = {
  QB: { min: 5, max: 28, avg: 16 },    // 2025 range: 2.7-31.2, avg 16.2
  RB: { min: 8, max: 35, avg: 21 },    // 2025 range: 6.4-46.6, avg 21.0
  WR: { min: 12, max: 45, avg: 30 },   // 2025 range: 9.8-53.0, avg 29.6
  TE: { min: 3, max: 22, avg: 14 },    // 2025 range: 1.2-26.6, avg 14.1
} as const;

/**
 * Convert FPTS allowed to 0-100 matchup score
 * Higher FPTS allowed = higher score (easier matchup)
 */
function fptsToMatchupScore(fpts: number, position: string): number {
  const range = FPTS_RANGES[position as keyof typeof FPTS_RANGES] || FPTS_RANGES.WR;
  
  // Normalize: 0 = tough (low fpts), 100 = easy (high fpts)
  const normalized = (fpts - range.min) / (range.max - range.min);
  const score = Math.round(normalized * 100);
  
  return Math.max(0, Math.min(100, score));
}

/**
 * Get latest DvP matchup data for a defense + position
 * Uses most recent week with data, with recency preference
 */
export async function getDvPMatchup(
  defenseTeam: string,
  position: string,
  season: number = 2025
): Promise<DvPMatchup | null> {
  try {
    // Get most recent week's data with recency-weighted average
    const result = await db.execute(sql`
      WITH recent_weeks AS (
        SELECT 
          defense_team,
          position,
          season,
          week,
          avg_pts_per_game_ppr,
          rank_vs_position,
          dvp_rating,
          ROW_NUMBER() OVER (ORDER BY week DESC) as recency_rank
        FROM defense_vs_position_stats
        WHERE defense_team = ${defenseTeam}
          AND position = ${position}
          AND season = ${season}
        ORDER BY week DESC
        LIMIT 4
      ),
      weighted AS (
        SELECT 
          defense_team,
          position,
          season,
          MAX(week) as latest_week,
          -- Recency weighted average: last week = 40%, prev = 30%, older = 20%, oldest = 10%
          SUM(
            avg_pts_per_game_ppr * 
            CASE recency_rank 
              WHEN 1 THEN 0.40 
              WHEN 2 THEN 0.30 
              WHEN 3 THEN 0.20 
              ELSE 0.10 
            END
          ) as weighted_fpts,
          -- Use latest rank and rating
          (ARRAY_AGG(rank_vs_position ORDER BY week DESC))[1] as rank_vs_position,
          (ARRAY_AGG(dvp_rating ORDER BY week DESC))[1] as dvp_rating
        FROM recent_weeks
        GROUP BY defense_team, position, season
      )
      SELECT * FROM weighted
    `);

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0] as any;
    const avgFpts = Number(row.weighted_fpts) || 0;
    const rank = Number(row.rank_vs_position) || 16;
    const matchupScore = fptsToMatchupScore(avgFpts, position);

    return {
      defenseTeam,
      position,
      season,
      week: Number(row.latest_week),
      avgFptsAllowed: Math.round(avgFpts * 10) / 10,
      rankVsPosition: rank,
      dvpRating: row.dvp_rating || 'neutral',
      matchupScore100: matchupScore,
      isSmashSpot: rank <= 8,
      isToughSpot: rank >= 25,
    };
  } catch (error) {
    console.error('[DvP] Error fetching matchup:', error);
    return null;
  }
}

/**
 * Get all DvP matchups for a position (all 32 defenses)
 * Returns sorted by rank (easiest first)
 */
export async function getAllDvPByPosition(
  position: string,
  season: number = 2025
): Promise<DvPMatchup[]> {
  try {
    const result = await db.execute(sql`
      WITH latest_week AS (
        SELECT MAX(week) as max_week
        FROM defense_vs_position_stats
        WHERE position = ${position} AND season = ${season}
      ),
      recent_data AS (
        SELECT 
          d.defense_team,
          d.position,
          d.season,
          d.week,
          d.avg_pts_per_game_ppr,
          d.rank_vs_position,
          d.dvp_rating,
          ROW_NUMBER() OVER (PARTITION BY d.defense_team ORDER BY d.week DESC) as rn
        FROM defense_vs_position_stats d
        WHERE d.position = ${position} 
          AND d.season = ${season}
          AND d.week >= (SELECT max_week - 3 FROM latest_week)
      ),
      weighted AS (
        SELECT 
          defense_team,
          position,
          season,
          MAX(week) as latest_week,
          SUM(
            avg_pts_per_game_ppr * 
            CASE rn WHEN 1 THEN 0.40 WHEN 2 THEN 0.30 WHEN 3 THEN 0.20 ELSE 0.10 END
          ) as weighted_fpts,
          (ARRAY_AGG(rank_vs_position ORDER BY week DESC))[1] as rank_vs_position,
          (ARRAY_AGG(dvp_rating ORDER BY week DESC))[1] as dvp_rating
        FROM recent_data
        GROUP BY defense_team, position, season
      )
      SELECT * FROM weighted
      ORDER BY rank_vs_position ASC
    `);

    return (result.rows as any[]).map(row => {
      const avgFpts = Number(row.weighted_fpts) || 0;
      const rank = Number(row.rank_vs_position) || 16;
      
      return {
        defenseTeam: row.defense_team,
        position,
        season,
        week: Number(row.latest_week),
        avgFptsAllowed: Math.round(avgFpts * 10) / 10,
        rankVsPosition: rank,
        dvpRating: row.dvp_rating || 'neutral',
        matchupScore100: fptsToMatchupScore(avgFpts, position),
        isSmashSpot: rank <= 8,
        isToughSpot: rank >= 25,
      };
    });
  } catch (error) {
    console.error('[DvP] Error fetching all matchups:', error);
    return [];
  }
}

/**
 * Get weekly matchup schedule with DvP scores for a team + position
 * Returns future matchups with opponent DvP data
 */
export async function getTeamWeeklyDvP(
  offenseTeam: string,
  position: string,
  season: number = 2025,
  fromWeek: number = 1
): Promise<WeeklyDvPMatchup[]> {
  try {
    // Get schedule + join with DvP data
    const result = await db.execute(sql`
      WITH schedule_opponents AS (
        SELECT 
          week,
          CASE WHEN home = ${offenseTeam} THEN away ELSE home END as opponent,
          CASE WHEN home = ${offenseTeam} THEN true ELSE false END as is_home
        FROM schedule
        WHERE season = ${season}
          AND week >= ${fromWeek}
          AND (home = ${offenseTeam} OR away = ${offenseTeam})
        ORDER BY week
      ),
      latest_dvp AS (
        SELECT DISTINCT ON (defense_team)
          defense_team,
          avg_pts_per_game_ppr,
          rank_vs_position,
          dvp_rating,
          week as data_week
        FROM defense_vs_position_stats
        WHERE position = ${position} AND season = ${season}
        ORDER BY defense_team, week DESC
      )
      SELECT 
        s.week,
        s.opponent,
        s.is_home,
        COALESCE(d.avg_pts_per_game_ppr, 15) as avg_fpts_allowed,
        COALESCE(d.rank_vs_position, 16) as rank_vs_position,
        COALESCE(d.dvp_rating, 'neutral') as dvp_rating
      FROM schedule_opponents s
      LEFT JOIN latest_dvp d ON d.defense_team = s.opponent
      ORDER BY s.week
    `);

    return (result.rows as any[]).map(row => {
      const avgFpts = Number(row.avg_fpts_allowed) || 15;
      const rank = Number(row.rank_vs_position) || 16;
      
      return {
        week: Number(row.week),
        opponent: row.opponent,
        isHome: row.is_home,
        matchupScore100: fptsToMatchupScore(avgFpts, position),
        rankVsPosition: rank,
        dvpRating: row.dvp_rating,
        avgFptsAllowed: Math.round(avgFpts * 10) / 10,
        isSmashSpot: rank <= 8,
        isToughSpot: rank >= 25,
      };
    });
  } catch (error) {
    console.error('[DvP] Error fetching weekly matchups:', error);
    return [];
  }
}

/**
 * Get this week's opponent + matchup for a player's team
 */
export async function getThisWeekMatchup(
  offenseTeam: string,
  position: string,
  week: number,
  season: number = 2025
): Promise<WeeklyDvPMatchup | null> {
  try {
    const result = await db.execute(sql`
      WITH game AS (
        SELECT 
          week,
          CASE WHEN home = ${offenseTeam} THEN away ELSE home END as opponent,
          CASE WHEN home = ${offenseTeam} THEN true ELSE false END as is_home
        FROM schedule
        WHERE season = ${season}
          AND week = ${week}
          AND (home = ${offenseTeam} OR away = ${offenseTeam})
        LIMIT 1
      ),
      dvp AS (
        SELECT 
          defense_team,
          avg_pts_per_game_ppr,
          rank_vs_position,
          dvp_rating
        FROM defense_vs_position_stats
        WHERE position = ${position} 
          AND season = ${season}
          AND defense_team = (SELECT opponent FROM game)
        ORDER BY week DESC
        LIMIT 1
      )
      SELECT 
        g.week,
        g.opponent,
        g.is_home,
        COALESCE(d.avg_pts_per_game_ppr, 15) as avg_fpts_allowed,
        COALESCE(d.rank_vs_position, 16) as rank_vs_position,
        COALESCE(d.dvp_rating, 'neutral') as dvp_rating
      FROM game g
      LEFT JOIN dvp d ON true
    `);

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0] as any;
    const avgFpts = Number(row.avg_fpts_allowed) || 15;
    const rank = Number(row.rank_vs_position) || 16;

    return {
      week: Number(row.week),
      opponent: row.opponent,
      isHome: row.is_home,
      matchupScore100: fptsToMatchupScore(avgFpts, position),
      rankVsPosition: rank,
      dvpRating: row.dvp_rating,
      avgFptsAllowed: Math.round(avgFpts * 10) / 10,
      isSmashSpot: rank <= 8,
      isToughSpot: rank >= 25,
    };
  } catch (error) {
    console.error('[DvP] Error fetching this week matchup:', error);
    return null;
  }
}

export default {
  getDvPMatchup,
  getAllDvPByPosition,
  getTeamWeeklyDvP,
  getThisWeekMatchup,
};
