/**
 * Team Reports API Routes
 * 
 * Weekly team rankings showing top 32 NFL teams by offensive and defensive performance
 */

import { Router } from 'express';
import { db } from '../db';
import { gameLogs, playerIdentityMap } from '../../shared/schema';
import { sql, eq, and, inArray } from 'drizzle-orm';

const router = Router();

interface TeamStats {
  team: string;
  gamesPlayed: number;
  // Offensive stats
  totalYards: number;
  passYards: number;
  rushYards: number;
  totalTDs: number;
  passTDs: number;
  rushTDs: number;
  recTDs: number;
  pointsScored: number;
  // Per game averages
  yardsPerGame: number;
  pointsPerGame: number;
  passingYPG: number;
  rushingYPG: number;
}

/**
 * GET /api/team-reports
 * Get weekly team offensive and defensive rankings
 * 
 * Query params:
 * - season: number (optional, defaults to 2025)
 * - week: string (optional, defaults to "1-7" for current week range)
 */
router.get('/', async (req, res) => {
  try {
    const season = req.query.season ? parseInt(req.query.season as string) : 2025;
    const weekRange = (req.query.week as string) || "1-7";
    
    // Parse week range (e.g., "1-7" or single week "7")
    const [startWeek, endWeek] = weekRange.includes('-') 
      ? weekRange.split('-').map(Number)
      : [parseInt(weekRange), parseInt(weekRange)];

    console.log(`[TeamReports] Fetching team stats for ${season} weeks ${startWeek}-${endWeek}`);

    // Query to aggregate team offensive stats
    const teamOffenseQuery = await db
      .select({
        team: playerIdentityMap.nflTeam,
        gamesPlayed: sql<number>`COUNT(DISTINCT ${gameLogs.week})`.as('games_played'),
        totalYards: sql<number>`SUM(COALESCE(${gameLogs.passYards}, 0) + COALESCE(${gameLogs.rushYards}, 0) + COALESCE(${gameLogs.recYards}, 0))`.as('total_yards'),
        passYards: sql<number>`SUM(COALESCE(${gameLogs.passYards}, 0))`.as('pass_yards'),
        rushYards: sql<number>`SUM(COALESCE(${gameLogs.rushYards}, 0))`.as('rush_yards'),
        totalTDs: sql<number>`SUM(COALESCE(${gameLogs.passTd}, 0) + COALESCE(${gameLogs.rushTd}, 0) + COALESCE(${gameLogs.recTd}, 0))`.as('total_tds'),
        passTDs: sql<number>`SUM(COALESCE(${gameLogs.passTd}, 0))`.as('pass_tds'),
        rushTDs: sql<number>`SUM(COALESCE(${gameLogs.rushTd}, 0))`.as('rush_tds'),
        recTDs: sql<number>`SUM(COALESCE(${gameLogs.recTd}, 0))`.as('rec_tds'),
        fantasyPoints: sql<number>`SUM(COALESCE(${gameLogs.fantasyPointsPpr}, 0))`.as('fantasy_points'),
      })
      .from(gameLogs)
      .innerJoin(playerIdentityMap, eq(gameLogs.sleeperId, playerIdentityMap.sleeperId))
      .where(
        and(
          eq(gameLogs.season, season),
          sql`${gameLogs.week} >= ${startWeek}`,
          sql`${gameLogs.week} <= ${endWeek}`,
          eq(gameLogs.seasonType, 'REG'),
          sql`${playerIdentityMap.nflTeam} IS NOT NULL`
        )
      )
      .groupBy(playerIdentityMap.nflTeam);

    // Calculate per-game averages and format stats
    const teamStats: TeamStats[] = teamOffenseQuery.map(team => {
      const gamesPlayed = Number(team.gamesPlayed) || 1; // Avoid division by zero
      const totalYards = Number(team.totalYards) || 0;
      const passYards = Number(team.passYards) || 0;
      const rushYards = Number(team.rushYards) || 0;
      const fantasyPoints = Number(team.fantasyPoints) || 0;

      return {
        team: team.team!,
        gamesPlayed,
        totalYards,
        passYards,
        rushYards,
        totalTDs: Number(team.totalTDs) || 0,
        passTDs: Number(team.passTDs) || 0,
        rushTDs: Number(team.rushTDs) || 0,
        recTDs: Number(team.recTDs) || 0,
        pointsScored: fantasyPoints, // Using fantasy points as proxy for points scored
        yardsPerGame: totalYards / gamesPlayed,
        pointsPerGame: fantasyPoints / gamesPlayed,
        passingYPG: passYards / gamesPlayed,
        rushingYPG: rushYards / gamesPlayed,
      };
    });

    // Sort by total yards per game (primary offensive metric)
    const offensiveRankings = teamStats
      .sort((a, b) => b.yardsPerGame - a.yardsPerGame)
      .map((team, index) => ({
        rank: index + 1,
        ...team,
      }));

    // Defensive rankings (simplified approach)
    // Note: True defensive rankings would require opponent data
    // This shows teams ranked by lowest offensive production as a proxy
    const defensiveRankings = teamStats
      .sort((a, b) => a.yardsPerGame - b.yardsPerGame)
      .map((team, index) => ({
        rank: index + 1,
        ...team,
      }));

    console.log(`[TeamReports] Processed ${teamStats.length} teams for ${season} weeks ${startWeek}-${endWeek}`);

    return res.json({
      success: true,
      data: {
        season,
        weekRange: `${startWeek}-${endWeek}`,
        offensive: offensiveRankings,
        defensive: defensiveRankings,
        totalTeams: teamStats.length,
      }
    });

  } catch (error) {
    console.error('[TeamReports] Error fetching team stats:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch team reports',
    });
  }
});

export default router;
