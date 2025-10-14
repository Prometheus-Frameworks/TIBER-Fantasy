/**
 * Game Log Routes
 * Aggregates NFLfastR play-by-play data into game logs for individual players
 */

import { Router, Request, Response } from 'express';
import { db } from '../db';
import { bronzeNflfastrPlays, playerIdentityMap } from '@shared/schema';
import { sql, and, eq, desc, or } from 'drizzle-orm';

const router = Router();

interface GameLogStats {
  season: number;
  week: number;
  opponent: string;
  passing: {
    attempts: number;
    completions: number;
    yards: number;
    touchdowns: number;
    interceptions: number;
  };
  rushing: {
    attempts: number;
    yards: number;
    touchdowns: number;
  };
  receiving: {
    targets: number;
    receptions: number;
    yards: number;
    touchdowns: number;
  };
  fantasyPoints: {
    standard: number;
    halfPPR: number;
    ppr: number;
  };
}

/**
 * GET /api/game-logs/:playerId/latest
 * Get a player's most recent game log aggregated from NFLfastR data
 */
router.get('/:playerId/latest', async (req: Request, res: Response) => {
  try {
    const { playerId } = req.params;
    
    if (!playerId) {
      return res.status(400).json({
        success: false,
        message: 'Player ID is required'
      });
    }

    // First, find the player's most recent game (week/season combo)
    const mostRecentGame = await db
      .select({
        season: bronzeNflfastrPlays.season,
        week: bronzeNflfastrPlays.week,
        team: bronzeNflfastrPlays.posteam,
        opponent: bronzeNflfastrPlays.defteam,
      })
      .from(bronzeNflfastrPlays)
      .where(
        or(
          eq(bronzeNflfastrPlays.passerPlayerId, playerId),
          eq(bronzeNflfastrPlays.rusherPlayerId, playerId),
          eq(bronzeNflfastrPlays.receiverPlayerId, playerId)
        )
      )
      .orderBy(desc(bronzeNflfastrPlays.season), desc(bronzeNflfastrPlays.week))
      .limit(1);

    if (!mostRecentGame || mostRecentGame.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No game data found for this player'
      });
    }

    const { season, week, team, opponent } = mostRecentGame[0];

    // Aggregate passing stats
    const passingStats = await db
      .select({
        attempts: sql<number>`COUNT(CASE WHEN ${bronzeNflfastrPlays.playType} = 'pass' THEN 1 END)`,
        completions: sql<number>`SUM(CASE WHEN ${bronzeNflfastrPlays.completePass} = true THEN 1 ELSE 0 END)`,
        yards: sql<number>`SUM(CASE WHEN ${bronzeNflfastrPlays.playType} = 'pass' AND ${bronzeNflfastrPlays.completePass} = true THEN ${bronzeNflfastrPlays.yardsGained} ELSE 0 END)`,
        touchdowns: sql<number>`SUM(CASE WHEN ${bronzeNflfastrPlays.playType} = 'pass' AND ${bronzeNflfastrPlays.touchdown} = true THEN 1 ELSE 0 END)`,
        interceptions: sql<number>`SUM(CASE WHEN ${bronzeNflfastrPlays.interception} = true THEN 1 ELSE 0 END)`,
      })
      .from(bronzeNflfastrPlays)
      .where(
        and(
          eq(bronzeNflfastrPlays.passerPlayerId, playerId),
          eq(bronzeNflfastrPlays.season, season),
          eq(bronzeNflfastrPlays.week, week)
        )
      );

    // Aggregate rushing stats
    const rushingStats = await db
      .select({
        attempts: sql<number>`COUNT(*)`,
        yards: sql<number>`COALESCE(SUM(${bronzeNflfastrPlays.yardsGained}), 0)`,
        touchdowns: sql<number>`SUM(CASE WHEN ${bronzeNflfastrPlays.touchdown} = true THEN 1 ELSE 0 END)`,
      })
      .from(bronzeNflfastrPlays)
      .where(
        and(
          eq(bronzeNflfastrPlays.rusherPlayerId, playerId),
          eq(bronzeNflfastrPlays.season, season),
          eq(bronzeNflfastrPlays.week, week),
          eq(bronzeNflfastrPlays.playType, 'run')
        )
      );

    // Aggregate receiving stats
    const receivingStats = await db
      .select({
        targets: sql<number>`COUNT(*)`,
        receptions: sql<number>`SUM(CASE WHEN ${bronzeNflfastrPlays.completePass} = true THEN 1 ELSE 0 END)`,
        yards: sql<number>`COALESCE(SUM(CASE WHEN ${bronzeNflfastrPlays.completePass} = true THEN ${bronzeNflfastrPlays.yardsGained} ELSE 0 END), 0)`,
        touchdowns: sql<number>`SUM(CASE WHEN ${bronzeNflfastrPlays.completePass} = true AND ${bronzeNflfastrPlays.touchdown} = true THEN 1 ELSE 0 END)`,
      })
      .from(bronzeNflfastrPlays)
      .where(
        and(
          eq(bronzeNflfastrPlays.receiverPlayerId, playerId),
          eq(bronzeNflfastrPlays.season, season),
          eq(bronzeNflfastrPlays.week, week),
          eq(bronzeNflfastrPlays.playType, 'pass')
        )
      );

    const pass = passingStats[0] || { attempts: 0, completions: 0, yards: 0, touchdowns: 0, interceptions: 0 };
    const rush = rushingStats[0] || { attempts: 0, yards: 0, touchdowns: 0 };
    const rec = receivingStats[0] || { targets: 0, receptions: 0, yards: 0, touchdowns: 0 };

    // Calculate fantasy points
    const passYardsPts = (pass.yards || 0) / 25;
    const passTDPts = (pass.touchdowns || 0) * 4;
    const passIntPts = (pass.interceptions || 0) * -2;
    
    const rushYardsPts = (rush.yards || 0) / 10;
    const rushTDPts = (rush.touchdowns || 0) * 6;
    
    const recYardsPts = (rec.yards || 0) / 10;
    const recTDPts = (rec.touchdowns || 0) * 6;
    const recPts = rec.receptions || 0;

    const standardPts = passYardsPts + passTDPts + passIntPts + rushYardsPts + rushTDPts + recYardsPts + recTDPts;
    const halfPPR = standardPts + (recPts * 0.5);
    const ppr = standardPts + recPts;

    const gameLog: GameLogStats = {
      season,
      week,
      opponent: opponent || 'Unknown',
      passing: {
        attempts: pass.attempts || 0,
        completions: pass.completions || 0,
        yards: pass.yards || 0,
        touchdowns: pass.touchdowns || 0,
        interceptions: pass.interceptions || 0,
      },
      rushing: {
        attempts: rush.attempts || 0,
        yards: rush.yards || 0,
        touchdowns: rush.touchdowns || 0,
      },
      receiving: {
        targets: rec.targets || 0,
        receptions: rec.receptions || 0,
        yards: rec.yards || 0,
        touchdowns: rec.touchdowns || 0,
      },
      fantasyPoints: {
        standard: Number(standardPts.toFixed(2)),
        halfPPR: Number(halfPPR.toFixed(2)),
        ppr: Number(ppr.toFixed(2)),
      }
    };

    res.json({
      success: true,
      data: gameLog
    });

  } catch (error) {
    console.error('[GameLogRoutes] Error fetching latest game:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
