import { Router } from 'express';
import { db } from '../db';
import { players, gameLogs } from '@shared/schema';
import { eq, and, sql, gte, lte } from 'drizzle-orm';

const router = Router();

interface PlayerStat {
  name: string;
  value: number;
  team: string;
}

interface AnalyticsData {
  players: PlayerStat[];
  week: string;
  season: number;
  position: string;
  stat: string;
}

router.get('/', async (req, res) => {
  try {
    const { position, stat } = req.query;

    if (!position || !stat) {
      return res.status(400).json({
        success: false,
        error: 'Both position and stat query parameters are required'
      });
    }

    const validPositions = ['QB', 'RB', 'WR', 'TE'];
    if (!validPositions.includes(position as string)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid position. Must be QB, RB, WR, or TE'
      });
    }

    // Map stat names to database columns
    const statMapping: Record<string, any> = {
      // QB stats
      pass_yards: sql<number>`SUM(${gameLogs.passYards})`,
      pass_td: sql<number>`SUM(${gameLogs.passTd})`,
      completions: sql<number>`SUM(${gameLogs.passCompletions})`,
      attempts: sql<number>`SUM(${gameLogs.passAttempts})`,
      completion_pct: sql<number>`CASE WHEN SUM(${gameLogs.passAttempts}) > 0 THEN (SUM(${gameLogs.passCompletions})::float / SUM(${gameLogs.passAttempts})::float * 100) ELSE 0 END`,
      
      // RB stats
      rush_yards: sql<number>`SUM(${gameLogs.rushYards})`,
      rush_td: sql<number>`SUM(${gameLogs.rushTd})`,
      rush_att: sql<number>`SUM(${gameLogs.rushAttempts})`,
      targets: sql<number>`SUM(${gameLogs.targets})`,
      receptions: sql<number>`SUM(${gameLogs.receptions})`,
      rec_yards: sql<number>`SUM(${gameLogs.recYards})`,
      rec_td: sql<number>`SUM(${gameLogs.recTd})`,
      
      // WR/TE stats
      ypr: sql<number>`CASE WHEN SUM(${gameLogs.receptions}) > 0 THEN (SUM(${gameLogs.recYards})::float / SUM(${gameLogs.receptions})::float) ELSE 0 END`,
    };

    const selectedStat = statMapping[stat as string];
    if (!selectedStat) {
      return res.status(400).json({
        success: false,
        error: 'Invalid stat parameter'
      });
    }

    // Try 2025 weeks 1-7 first, fallback to 2024 weeks 13-15
    // Build HAVING clause for minimum thresholds on percentage/average stats
    let havingClause = sql`1=1`; // Default: no filter
    if (stat === 'completion_pct') {
      // Minimum 50 attempts to qualify for completion % leaderboard (filters out backup QBs)
      havingClause = sql`SUM(${gameLogs.passAttempts}) >= 50`;
    } else if (stat === 'ypr') {
      // Minimum 10 receptions to qualify for yards per reception leaderboard
      havingClause = sql`SUM(${gameLogs.receptions}) >= 10`;
    }

    let playerStats = await db
      .select({
        sleeperId: gameLogs.sleeperId,
        firstName: players.firstName,
        lastName: players.lastName,
        team: players.team,
        value: selectedStat.as('stat_value'),
      })
      .from(gameLogs)
      .innerJoin(players, eq(gameLogs.playerId, players.id))
      .where(and(
        eq(gameLogs.season, 2025),
        gte(gameLogs.week, 1),
        lte(gameLogs.week, 7),
        eq(players.position, position as string)
      ))
      .groupBy(gameLogs.sleeperId, players.firstName, players.lastName, players.team)
      .having(havingClause)
      .orderBy(sql`stat_value DESC`)
      .limit(25); // Top 25 players

    let usedSeason = 2025;
    let usedWeeks = '1-7';

    // Fallback to 2024 data if no 2025 data available
    if (playerStats.length === 0) {
      playerStats = await db
        .select({
          sleeperId: gameLogs.sleeperId,
          firstName: players.firstName,
          lastName: players.lastName,
          team: players.team,
          value: selectedStat.as('stat_value'),
        })
        .from(gameLogs)
        .innerJoin(players, eq(gameLogs.playerId, players.id))
        .where(and(
          eq(gameLogs.season, 2024),
          sql`${gameLogs.week} IN (13, 14, 15)`,
          eq(players.position, position as string)
        ))
        .groupBy(gameLogs.sleeperId, players.firstName, players.lastName, players.team)
        .having(havingClause) // Apply same minimum thresholds to fallback query
        .orderBy(sql`stat_value DESC`)
        .limit(25);

      usedSeason = 2024;
      usedWeeks = '13-15';
    }

    const formattedPlayers: PlayerStat[] = playerStats.map(p => ({
      name: `${p.firstName ? p.firstName.charAt(0) + '.' : ''} ${p.lastName || 'Unknown'}`.trim(),
      value: Number(p.value) || 0,
      team: p.team || 'FA'
    }));

    const response: AnalyticsData = {
      players: formattedPlayers,
      week: usedWeeks,
      season: usedSeason,
      position: position as string,
      stat: stat as string
    };

    res.json({
      success: true,
      data: response
    });

  } catch (error) {
    console.error('Error in analytics endpoint:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch analytics data'
    });
  }
});

export default router;
