/**
 * FORGE Strength of Schedule (SoS) Service v1
 * 
 * Provides team-level and player-level SoS calculations using internal FORGE data.
 * Uses schedule table for opponent matchups and forge_team_matchup_context for defense ratings.
 * 
 * SoS Scale: 0-100 where higher = easier remaining schedule (more favorable matchups)
 * 50 = neutral/average difficulty
 */

import { db } from '../../infra/db';
import { sql } from 'drizzle-orm';

export interface SoSMeta {
  season: number;
  team?: string;
  playerId?: string;
  displayName?: string;
  position: string;
  dataThroughWeek: number;
  remainingWeeks: number;
}

export interface SoSScores {
  ros: number | null;      // Rest of Season average
  next3: number | null;    // Next 3 weeks average
  playoffs: number | null; // Weeks 15-17 average
}

export interface TeamPositionSoS {
  meta: SoSMeta;
  sos: SoSScores;
  weeklyMatchups?: WeeklyMatchup[];
}

export interface WeeklyMatchup {
  week: number;
  opponent: string;
  matchupScore100: number | null;
  difficulty: 'EASY' | 'NEUTRAL' | 'HARD';
}

export interface PlayerSoS {
  meta: SoSMeta;
  sos: SoSScores;
}

/**
 * Get the current "data through week" - the max completed week in the season
 */
async function getDataThroughWeek(season: number): Promise<number> {
  const result = await db.execute(sql`
    SELECT COALESCE(MAX(data_through_week), 0) as max_week
    FROM forge_player_fantasy_summary
    WHERE season = ${season}
  `);
  
  const row = result.rows[0] as any;
  return Number(row?.max_week) || 0;
}

/**
 * Get future matchups for a team (weeks after dataThroughWeek)
 */
async function getTeamFutureMatchups(
  teamCode: string,
  season: number,
  dataThroughWeek: number
): Promise<{ week: number; opponent: string }[]> {
  const result = await db.execute(sql`
    SELECT 
      week,
      CASE 
        WHEN home = ${teamCode} THEN away
        ELSE home
      END as opponent
    FROM schedule
    WHERE season = ${season}
      AND week > ${dataThroughWeek}
      AND (home = ${teamCode} OR away = ${teamCode})
    ORDER BY week
  `);
  
  return (result.rows as any[]).map(row => ({
    week: Number(row.week),
    opponent: row.opponent,
  }));
}

/**
 * Get matchup score for a specific defense + position + week
 * Returns matchup_score_100 from forge_team_matchup_context
 */
async function getMatchupScore(
  defenseTeam: string,
  position: string,
  season: number,
  week: number
): Promise<number | null> {
  const result = await db.execute(sql`
    SELECT matchup_score_100
    FROM forge_team_matchup_context
    WHERE defense_team = ${defenseTeam}
      AND position = ${position}
      AND season = ${season}
      AND week = ${week}
    LIMIT 1
  `);
  
  if (result.rows.length === 0) {
    return null;
  }
  
  return Number((result.rows[0] as any).matchup_score_100);
}

/**
 * Get season-level matchup data for a defense + position (average across all available weeks)
 * Used as fallback when week-specific data is unavailable
 */
async function getSeasonAverageMatchupScore(
  defenseTeam: string,
  position: string,
  season: number
): Promise<number | null> {
  const result = await db.execute(sql`
    SELECT AVG(matchup_score_100)::numeric(5,2) as avg_score
    FROM forge_team_matchup_context
    WHERE defense_team = ${defenseTeam}
      AND position = ${position}
      AND season = ${season}
  `);
  
  if (result.rows.length === 0 || (result.rows[0] as any).avg_score === null) {
    return null;
  }
  
  return Number((result.rows[0] as any).avg_score);
}

/**
 * Calculate difficulty label based on matchup score
 */
function getDifficultyLabel(score: number | null): 'EASY' | 'NEUTRAL' | 'HARD' {
  if (score === null) return 'NEUTRAL';
  if (score >= 60) return 'EASY';
  if (score <= 40) return 'HARD';
  return 'NEUTRAL';
}

/**
 * Calculate average from an array of numbers, ignoring nulls
 */
function calculateAverage(scores: (number | null)[]): number | null {
  const validScores = scores.filter((s): s is number => s !== null);
  if (validScores.length === 0) return null;
  return Math.round((validScores.reduce((a, b) => a + b, 0) / validScores.length) * 10) / 10;
}

/**
 * Get team + position SoS data
 */
export async function getTeamPositionSoS(
  teamCode: string,
  position: string,
  season: number = 2025,
  includeWeeklyMatchups: boolean = false
): Promise<TeamPositionSoS | null> {
  try {
    const dataThroughWeek = await getDataThroughWeek(season);
    const futureMatchups = await getTeamFutureMatchups(teamCode, season, dataThroughWeek);
    
    if (futureMatchups.length === 0) {
      return {
        meta: {
          season,
          team: teamCode,
          position,
          dataThroughWeek,
          remainingWeeks: 0,
        },
        sos: {
          ros: null,
          next3: null,
          playoffs: null,
        },
      };
    }
    
    const weeklyScores: WeeklyMatchup[] = [];
    
    for (const matchup of futureMatchups) {
      let score = await getMatchupScore(matchup.opponent, position, season, matchup.week);
      
      if (score === null) {
        score = await getSeasonAverageMatchupScore(matchup.opponent, position, season);
      }
      
      weeklyScores.push({
        week: matchup.week,
        opponent: matchup.opponent,
        matchupScore100: score,
        difficulty: getDifficultyLabel(score),
      });
    }
    
    const allScores = weeklyScores.map(w => w.matchupScore100);
    const rosAvg = calculateAverage(allScores);
    
    const next3Weeks = weeklyScores.slice(0, 3).map(w => w.matchupScore100);
    const next3Avg = calculateAverage(next3Weeks);
    
    const playoffWeeks = weeklyScores
      .filter(w => w.week >= 15 && w.week <= 17)
      .map(w => w.matchupScore100);
    const playoffsAvg = calculateAverage(playoffWeeks);
    
    return {
      meta: {
        season,
        team: teamCode,
        position,
        dataThroughWeek,
        remainingWeeks: weeklyScores.filter(w => w.matchupScore100 !== null).length,
      },
      sos: {
        ros: rosAvg,
        next3: next3Avg,
        playoffs: playoffsAvg,
      },
      ...(includeWeeklyMatchups ? { weeklyMatchups: weeklyScores } : {}),
    };
  } catch (error) {
    console.error('[ForgeSoS] Error calculating team-position SoS:', error);
    return null;
  }
}

/**
 * Get player-level SoS data
 * Resolves player to team + position, then queries team-position SoS
 */
export async function getPlayerSoS(
  playerId: string,
  season: number = 2025
): Promise<PlayerSoS | null> {
  try {
    const playerResult = await db.execute(sql`
      SELECT 
        im.canonical_id,
        im.full_name,
        im.position,
        COALESCE(ct.current_team, im.nfl_team) AS current_team
      FROM player_identity_map im
      LEFT JOIN forge_player_current_team ct ON ct.player_id = im.canonical_id
      WHERE im.canonical_id = ${playerId}
      LIMIT 1
    `);
    
    if (playerResult.rows.length === 0) {
      return null;
    }
    
    const player = playerResult.rows[0] as any;
    const position = player.position;
    const team = player.current_team;
    
    if (!team) {
      return {
        meta: {
          season,
          playerId,
          displayName: player.full_name,
          position,
          dataThroughWeek: await getDataThroughWeek(season),
          remainingWeeks: 0,
        },
        sos: {
          ros: null,
          next3: null,
          playoffs: null,
        },
      };
    }
    
    const teamSoS = await getTeamPositionSoS(team, position, season);
    
    if (!teamSoS) {
      return null;
    }
    
    return {
      meta: {
        season,
        playerId,
        displayName: player.full_name,
        position,
        team,
        dataThroughWeek: teamSoS.meta.dataThroughWeek,
        remainingWeeks: teamSoS.meta.remainingWeeks,
      },
      sos: teamSoS.sos,
    };
  } catch (error) {
    console.error('[ForgeSoS] Error calculating player SoS:', error);
    return null;
  }
}

/**
 * Get SoS rankings for all teams by position (OPTIMIZED batch version)
 * Returns teams sorted by RoS SoS (easiest schedule first)
 */
export async function getAllTeamSoSByPosition(
  position: string,
  season: number = 2025
): Promise<TeamPositionSoS[]> {
  try {
    const dataThroughWeek = await getDataThroughWeek(season);
    
    // Batch fetch: All future matchups for all teams
    const allMatchupsResult = await db.execute(sql`
      WITH team_matchups AS (
        SELECT 
          CASE WHEN home = t.team THEN home ELSE away END as offense_team,
          CASE WHEN home = t.team THEN away ELSE home END as opponent,
          s.week
        FROM schedule s
        CROSS JOIN (
          SELECT DISTINCT home as team FROM schedule WHERE season = ${season}
          UNION
          SELECT DISTINCT away as team FROM schedule WHERE season = ${season}
        ) t
        WHERE s.season = ${season}
          AND s.week > ${dataThroughWeek}
          AND (s.home = t.team OR s.away = t.team)
      )
      SELECT 
        tm.offense_team,
        tm.opponent,
        tm.week,
        mc.matchup_score_100
      FROM team_matchups tm
      LEFT JOIN forge_team_matchup_context mc 
        ON mc.defense_team = tm.opponent
        AND mc.position = ${position}
        AND mc.season = ${season}
        AND mc.week = tm.week
      ORDER BY tm.offense_team, tm.week
    `);
    
    // Get season-average fallback scores for all teams
    const seasonAvgResult = await db.execute(sql`
      SELECT 
        defense_team,
        AVG(matchup_score_100)::numeric(5,2) as avg_score
      FROM forge_team_matchup_context
      WHERE position = ${position} AND season = ${season}
      GROUP BY defense_team
    `);
    
    const seasonAvgMap = new Map<string, number>();
    (seasonAvgResult.rows as any[]).forEach(row => {
      seasonAvgMap.set(row.defense_team, Number(row.avg_score));
    });
    
    // Group by team and calculate SoS
    const teamData = new Map<string, { matchups: { week: number; opponent: string; score: number | null }[] }>();
    
    (allMatchupsResult.rows as any[]).forEach(row => {
      const team = row.offense_team;
      if (!teamData.has(team)) {
        teamData.set(team, { matchups: [] });
      }
      
      let score = row.matchup_score_100 !== null ? Number(row.matchup_score_100) : null;
      if (score === null) {
        score = seasonAvgMap.get(row.opponent) ?? null;
      }
      
      teamData.get(team)!.matchups.push({
        week: Number(row.week),
        opponent: row.opponent,
        score,
      });
    });
    
    // Calculate SoS for each team
    const results: TeamPositionSoS[] = [];
    
    teamData.forEach((data, team) => {
      const allScores = data.matchups.map(m => m.score);
      const validScores = allScores.filter((s): s is number => s !== null);
      
      const next3Scores = data.matchups.slice(0, 3).map(m => m.score);
      const playoffScores = data.matchups
        .filter(m => m.week >= 15 && m.week <= 17)
        .map(m => m.score);
      
      results.push({
        meta: {
          season,
          team,
          position,
          dataThroughWeek,
          remainingWeeks: validScores.length,
        },
        sos: {
          ros: calculateAverage(allScores),
          next3: calculateAverage(next3Scores),
          playoffs: calculateAverage(playoffScores),
        },
      });
    });
    
    return results.sort((a, b) => {
      const aScore = a.sos.ros ?? 50;
      const bScore = b.sos.ros ?? 50;
      return bScore - aScore;
    });
  } catch (error) {
    console.error('[ForgeSoS] Error getting all team SoS:', error);
    return [];
  }
}

/**
 * Get weekly SoS breakdown for a team (with opponent details)
 */
export async function getTeamWeeklySoS(
  teamCode: string,
  position: string,
  season: number = 2025
): Promise<TeamPositionSoS | null> {
  return getTeamPositionSoS(teamCode, position, season, true);
}
