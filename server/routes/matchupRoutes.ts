/**
 * Matchup Intelligence API Routes
 * 
 * Endpoints for player matchup analysis and weekly exploit recommendations
 */

import { Router } from 'express';
import { analyzePlayerMatchup, getWeeklyExploits } from '../services/matchupAnalyzer';

const router = Router();

/**
 * GET /api/matchup/player/:playerId
 * Analyze a specific player's matchup for a given week
 * 
 * Query params:
 * - week: number (required)
 * - season: number (optional, defaults to 2025)
 */
router.get('/player/:playerId', async (req, res) => {
  try {
    const { playerId } = req.params;
    const week = parseInt(req.query.week as string);
    const season = req.query.season ? parseInt(req.query.season as string) : 2025;
    
    if (!week || isNaN(week)) {
      return res.status(400).json({ 
        error: 'Week parameter is required and must be a number' 
      });
    }
    
    const analysis = await analyzePlayerMatchup(playerId, week, season);
    
    if (!analysis) {
      return res.status(404).json({ 
        error: 'No matchup analysis available for this player' 
      });
    }
    
    res.json(analysis);
  } catch (error) {
    console.error('Error analyzing player matchup:', error);
    res.status(500).json({ 
      error: 'Failed to analyze player matchup' 
    });
  }
});

/**
 * GET /api/matchup/exploits
 * Get top weekly matchup exploits by position
 * 
 * Query params:
 * - week: number (required)
 * - position: 'WR' | 'RB' | 'TE' (required)
 * - season: number (optional, defaults to 2025)
 * - limit: number (optional, defaults to 10)
 */
router.get('/exploits', async (req, res) => {
  try {
    const week = parseInt(req.query.week as string);
    const position = (req.query.position as string || 'WR').toUpperCase();
    const season = req.query.season ? parseInt(req.query.season as string) : 2025;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
    
    if (!week || isNaN(week)) {
      return res.status(400).json({ 
        error: 'Week parameter is required and must be a number' 
      });
    }
    
    if (!['WR', 'RB', 'TE'].includes(position)) {
      return res.status(400).json({ 
        error: 'Position must be WR, RB, or TE' 
      });
    }
    
    const exploits = await getWeeklyExploits(
      week, 
      season, 
      position as 'WR' | 'RB' | 'TE', 
      limit
    );
    
    res.json({
      week,
      season,
      position,
      exploits,
      count: exploits.length
    });
  } catch (error) {
    console.error('Error getting weekly exploits:', error);
    res.status(500).json({ 
      error: 'Failed to get weekly exploits' 
    });
  }
});

/**
 * GET /api/matchup/ros/:canonicalId
 * Get Rest of Season matchup schedule (weeks 7-18)
 * 
 * Query params:
 * - season: number (optional, defaults to 2025)
 * - startWeek: number (optional, defaults to 7)
 * - endWeek: number (optional, defaults to 18)
 */
router.get('/ros/:canonicalId', async (req, res) => {
  try {
    const { canonicalId } = req.params;
    const season = req.query.season ? parseInt(req.query.season as string) : 2025;
    const startWeek = req.query.startWeek ? parseInt(req.query.startWeek as string) : 7;
    const endWeek = req.query.endWeek ? parseInt(req.query.endWeek as string) : 18;

    const { db } = await import('../db');
    const { playerIdentityMap, schedule, defenseVsPositionStats } = await import('../../shared/schema');
    const { eq, and, or, sql } = await import('drizzle-orm');

    // Get player info (team, position)
    const [player] = await db
      .select({
        canonicalId: playerIdentityMap.canonicalId,
        fullName: playerIdentityMap.fullName,
        position: playerIdentityMap.position,
        nflTeam: playerIdentityMap.nflTeam,
      })
      .from(playerIdentityMap)
      .where(eq(playerIdentityMap.canonicalId, canonicalId))
      .limit(1);

    if (!player || !player.nflTeam) {
      return res.status(404).json({
        success: false,
        error: 'Player not found or team unknown'
      });
    }

    // Get ROS schedule
    const games = await db
      .select({
        week: schedule.week,
        home: schedule.home,
        away: schedule.away,
        opponent: sql<string>`CASE 
          WHEN ${schedule.home} = ${player.nflTeam} THEN ${schedule.away}
          WHEN ${schedule.away} = ${player.nflTeam} THEN ${schedule.home}
          ELSE NULL
        END`,
        isHome: sql<boolean>`${schedule.home} = ${player.nflTeam}`,
      })
      .from(schedule)
      .where(
        and(
          eq(schedule.season, season),
          sql`${schedule.week} >= ${startWeek} AND ${schedule.week} <= ${endWeek}`,
          or(
            eq(schedule.home, player.nflTeam),
            eq(schedule.away, player.nflTeam)
          )
        )
      )
      .orderBy(schedule.week);

    // Get DvP ratings for each opponent
    const matchups = await Promise.all(
      games.map(async (game) => {
        if (!game.opponent) return null;

        const [dvpStats] = await db
          .select({
            rankVsPosition: defenseVsPositionStats.rankVsPosition,
            dvpRating: defenseVsPositionStats.dvpRating,
            avgPtsAllowed: defenseVsPositionStats.avgPtsPerGamePpr,
          })
          .from(defenseVsPositionStats)
          .where(
            and(
              eq(defenseVsPositionStats.defenseTeam, game.opponent),
              eq(defenseVsPositionStats.position, player.position),
              eq(defenseVsPositionStats.season, season)
            )
          )
          .limit(1);

        return {
          week: game.week,
          opponent: game.opponent,
          isHome: game.isHome,
          dvpRating: dvpStats?.dvpRating || 'unknown',
          rankVsPosition: dvpStats?.rankVsPosition || null,
          avgPtsAllowed: dvpStats?.avgPtsAllowed || null,
        };
      })
    );

    const validMatchups = matchups.filter(m => m !== null);

    res.json({
      success: true,
      data: {
        player: {
          canonicalId: player.canonicalId,
          fullName: player.fullName,
          position: player.position,
          team: player.nflTeam,
        },
        season,
        matchups: validMatchups,
        summary: {
          totalGames: validMatchups.length,
          eliteMatchups: validMatchups.filter(m => m.dvpRating === 'elite-matchup').length,
          goodMatchups: validMatchups.filter(m => m.dvpRating === 'good').length,
          toughMatchups: validMatchups.filter(m => m.dvpRating === 'tough' || m.dvpRating === 'avoid').length,
        }
      }
    });
  } catch (error) {
    console.error('Error getting ROS matchups:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get ROS matchups'
    });
  }
});

/**
 * GET /api/matchup/health
 * Health check endpoint
 */
router.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'matchup-analyzer',
    timestamp: new Date().toISOString()
  });
});

export default router;
