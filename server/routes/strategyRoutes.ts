/**
 * Strategy API Routes
 * 
 * Start/Sit recommendations, waiver targets, and lineup optimization
 */

import { Router } from 'express';
import { db } from '../db';
import { playerIdentityMap, defenseVsPositionStats, schedule, tiberScores } from '../../shared/schema';
import { eq, and, or, sql, desc, asc } from 'drizzle-orm';

const router = Router();

/**
 * GET /api/strategy/start-sit
 * Get context-aware start/sit recommendations for a week
 * 
 * Query params:
 * - week: number (required)
 * - position: 'QB' | 'RB' | 'WR' | 'TE' (optional)
 * - season: number (optional, defaults to 2025)
 */
router.get('/start-sit', async (req, res) => {
  try {
    const week = parseInt(req.query.week as string);
    const position = req.query.position as string;
    const season = req.query.season ? parseInt(req.query.season as string) : 2025;

    if (!week || isNaN(week)) {
      return res.status(400).json({
        success: false,
        error: 'Week parameter is required and must be a number'
      });
    }

    const positions = position ? [position] : ['QB', 'RB', 'WR', 'TE'];
    const recommendations: any[] = [];

    for (const pos of positions) {
      // Get all players at this position with their matchups
      const players = await db
        .select({
          canonicalId: playerIdentityMap.canonicalId,
          fullName: playerIdentityMap.fullName,
          position: playerIdentityMap.position,
          nflTeam: playerIdentityMap.nflTeam,
          nflfastrId: playerIdentityMap.nflDataPyId,
        })
        .from(playerIdentityMap)
        .where(
          and(
            eq(playerIdentityMap.position, pos),
            sql`${playerIdentityMap.nflTeam} IS NOT NULL`
          )
        );

      for (const player of players) {
        // Get player's matchup for this week
        const [game] = await db
          .select({
            week: schedule.week,
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
              eq(schedule.week, week),
              sql`(${schedule.home} = ${player.nflTeam} OR ${schedule.away} = ${player.nflTeam})`
            )
          )
          .limit(1);

        if (!game || !game.opponent) continue;

        // Get DvP rating for matchup
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

        // Get TIBER trend (last 3 weeks)
        const tiberHistory = await db
          .select({
            week: tiberScores.week,
            tiberScore: tiberScores.tiberScore,
            tier: tiberScores.tier,
          })
          .from(tiberScores)
          .where(
            and(
              eq(tiberScores.nflfastrId, player.nflfastrId || ''),
              eq(tiberScores.season, season),
              sql`${tiberScores.week} >= ${week - 3} AND ${tiberScores.week} < ${week}`
            )
          )
          .orderBy(desc(tiberScores.week))
          .limit(3);

        const avgTiberScore = tiberHistory.length > 0
          ? tiberHistory.reduce((sum, t) => sum + t.tiberScore, 0) / tiberHistory.length
          : 50;

        // Smart recommendation logic
        const isSuperstar = avgTiberScore >= 70; // High TIBER = superstar
        const isEliteMatchup = dvpStats?.dvpRating === 'elite-matchup';
        const isToughMatchup = dvpStats?.dvpRating === 'tough' || dvpStats?.dvpRating === 'avoid';
        const isBreakingOut = tiberHistory.length >= 2 && 
          tiberHistory[0].tier === 'breakout';

        let recommendation = 'start';
        let confidence = 'medium';
        let reasoning = '';

        if (isSuperstar) {
          recommendation = 'start';
          confidence = 'high';
          reasoning = `Elite player - start regardless of matchup (TIBER: ${avgTiberScore.toFixed(0)})`;
        } else if (isEliteMatchup) {
          recommendation = 'start';
          confidence = isBreakingOut ? 'high' : 'medium';
          reasoning = `Great matchup vs ${game.opponent} (Defense Rank: #${dvpStats?.rankVsPosition})`;
        } else if (isToughMatchup && !isSuperstar) {
          recommendation = 'sit';
          confidence = 'medium';
          reasoning = `Tough matchup vs ${game.opponent} (Defense Rank: #${dvpStats?.rankVsPosition})`;
        } else if (isBreakingOut) {
          recommendation = 'start';
          confidence = 'medium';
          reasoning = `Breakout trend - ride the hot hand`;
        } else {
          recommendation = 'start';
          confidence = 'low';
          reasoning = `Neutral matchup - standard lineup decision`;
        }

        recommendations.push({
          player: {
            canonicalId: player.canonicalId,
            fullName: player.fullName,
            position: player.position,
            team: player.nflTeam,
          },
          matchup: {
            week,
            opponent: game.opponent,
            isHome: game.isHome,
            dvpRating: dvpStats?.dvpRating || 'unknown',
            rankVsPosition: dvpStats?.rankVsPosition || null,
          },
          recommendation,
          confidence,
          reasoning,
          metrics: {
            avgTiberScore: Math.round(avgTiberScore),
            isSuperstar,
            recentTrend: tiberHistory.length >= 2 ? 
              (tiberHistory[0].tiberScore - tiberHistory[tiberHistory.length - 1].tiberScore > 0 ? 'up' : 'down') : 'stable',
          }
        });
      }
    }

    // Sort: Start (high confidence) > Start (medium) > Sit
    const sorted = recommendations.sort((a, b) => {
      if (a.recommendation !== b.recommendation) {
        return a.recommendation === 'start' ? -1 : 1;
      }
      const confidenceOrder: any = { high: 0, medium: 1, low: 2 };
      return confidenceOrder[a.confidence] - confidenceOrder[b.confidence];
    });

    res.json({
      success: true,
      week,
      season,
      position: position || 'ALL',
      recommendations: sorted.slice(0, 50), // Limit to top 50
      summary: {
        totalAnalyzed: sorted.length,
        startHighConfidence: sorted.filter(r => r.recommendation === 'start' && r.confidence === 'high').length,
        sitRecommendations: sorted.filter(r => r.recommendation === 'sit').length,
      }
    });
  } catch (error) {
    console.error('Error getting start/sit recommendations:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get start/sit recommendations'
    });
  }
});

/**
 * GET /api/strategy/targets
 * Get waiver wire targets based on matchups and trends
 * 
 * Query params:
 * - week: number (required) - week to target for
 * - position: 'QB' | 'RB' | 'WR' | 'TE' (optional)
 * - season: number (optional, defaults to 2025)
 */
router.get('/targets', async (req, res) => {
  try {
    const week = parseInt(req.query.week as string);
    const position = req.query.position as string;
    const season = req.query.season ? parseInt(req.query.season as string) : 2025;

    if (!week || isNaN(week)) {
      return res.status(400).json({
        success: false,
        error: 'Week parameter is required'
      });
    }

    // Find players with elite matchups and breakout trends
    const targets = await db
      .select({
        canonicalId: playerIdentityMap.canonicalId,
        fullName: playerIdentityMap.fullName,
        position: playerIdentityMap.position,
        nflTeam: playerIdentityMap.nflTeam,
        nflfastrId: playerIdentityMap.nflDataPyId,
      })
      .from(playerIdentityMap)
      .where(
        and(
          position ? eq(playerIdentityMap.position, position) : sql`1=1`,
          sql`${playerIdentityMap.nflTeam} IS NOT NULL`
        )
      )
      .limit(100);

    const recommendations: any[] = [];

    for (const player of targets) {
      // Get TIBER score
      const [latestTiber] = await db
        .select()
        .from(tiberScores)
        .where(
          and(
            eq(tiberScores.nflfastrId, player.nflfastrId || ''),
            eq(tiberScores.season, season)
          )
        )
        .orderBy(desc(tiberScores.week))
        .limit(1);

      if (latestTiber?.tier === 'breakout' && latestTiber.tiberScore >= 60) {
        recommendations.push({
          player: {
            canonicalId: player.canonicalId,
            fullName: player.fullName,
            position: player.position,
            team: player.nflTeam,
          },
          tiberScore: latestTiber.tiberScore,
          tier: latestTiber.tier,
          targetReason: 'Breakout candidate with favorable trend'
        });
      }
    }

    res.json({
      success: true,
      week,
      season,
      targets: recommendations.sort((a, b) => b.tiberScore - a.tiberScore).slice(0, 20)
    });
  } catch (error) {
    console.error('Error getting waiver targets:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get waiver targets'
    });
  }
});

export default router;
