/**
 * Strategy API Routes
 * 
 * Start/Sit recommendations, waiver targets, and lineup optimization
 * Optimized with batch queries to avoid N+1 problems
 */

import { Router } from 'express';
import { db } from '../infra/db';
import { playerIdentityMap, defenseVsPositionStats, schedule, tiberScores } from '../../shared/schema';
import { eq, and, or, sql, desc, asc, inArray } from 'drizzle-orm';

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

    // BATCH 1: Get all eligible players with their teams
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
          inArray(playerIdentityMap.position, positions),
          sql`${playerIdentityMap.nflTeam} IS NOT NULL`
        )
      );

    if (players.length === 0) {
      return res.json({
        success: true,
        week,
        season,
        position: position || 'ALL',
        recommendations: [],
        summary: { totalAnalyzed: 0, startHighConfidence: 0, sitRecommendations: 0 }
      });
    }

    // Extract unique teams for batch schedule query
    const teams = [...new Set(players.map(p => p.nflTeam).filter(Boolean))];

    // BATCH 2: Get all games for these teams in this week
    const games = teams.length > 0 ? await db
      .select({
        week: schedule.week,
        home: schedule.home,
        away: schedule.away,
      })
      .from(schedule)
      .where(
        and(
          eq(schedule.season, season),
          eq(schedule.week, week),
          or(
            inArray(schedule.home, teams),
            inArray(schedule.away, teams)
          )
        )
      ) : [];

    console.log(`[Strategy] Week ${week}: Found ${players.length} players, ${teams.length} teams, ${games.length} games`);

    // Early return if no games scheduled for this week
    if (games.length === 0) {
      return res.json({
        success: true,
        week,
        season,
        position: position || 'ALL',
        recommendations: [],
        summary: {
          totalAnalyzed: 0,
          startHighConfidence: 0,
          sitRecommendations: 0
        },
        message: `No games scheduled for week ${week}. Schedule data will be available closer to game week.`
      });
    }

    // Build team->opponent map
    const teamMatchups = new Map<string, { opponent: string; isHome: boolean }>();
    games.forEach(game => {
      teamMatchups.set(game.home, { opponent: game.away, isHome: true });
      teamMatchups.set(game.away, { opponent: game.home, isHome: false });
    });

    // Extract unique opponents and positions for batch DvP query
    const opponentPositionPairs: Array<{ opponent: string; position: string }> = [];
    players.forEach(player => {
      const matchup = teamMatchups.get(player.nflTeam || '');
      if (matchup) {
        opponentPositionPairs.push({
          opponent: matchup.opponent,
          position: player.position
        });
      }
    });

    // BATCH 3: Get all DvP ratings for relevant positions this season
    // Simpler query - fetch all data for these positions, filter in memory
    const dvpRatings = await db
      .select({
        defenseTeam: defenseVsPositionStats.defenseTeam,
        position: defenseVsPositionStats.position,
        rankVsPosition: defenseVsPositionStats.rankVsPosition,
        dvpRating: defenseVsPositionStats.dvpRating,
        avgPtsAllowed: defenseVsPositionStats.avgPtsPerGamePpr,
      })
      .from(defenseVsPositionStats)
      .where(
        and(
          eq(defenseVsPositionStats.season, season),
          inArray(defenseVsPositionStats.position, positions)
        )
      );

    // Build DvP lookup map
    const dvpMap = new Map<string, typeof dvpRatings[0]>();
    dvpRatings.forEach(dvp => {
      dvpMap.set(`${dvp.defenseTeam}_${dvp.position}`, dvp);
    });

    // Extract players with nflfastrIds for batch TIBER query
    const playersWithNflFastr = players.filter(p => p.nflfastrId);
    const nflfastrIds = playersWithNflFastr.map(p => p.nflfastrId!);

    // BATCH 4: Get all TIBER scores for last 3 weeks
    let tiberHistory: any[] = [];
    if (nflfastrIds.length > 0) {
      tiberHistory = await db
        .select({
          nflfastrId: tiberScores.nflfastrId,
          week: tiberScores.week,
          tiberScore: tiberScores.tiberScore,
          tier: tiberScores.tier,
        })
        .from(tiberScores)
        .where(
          and(
            inArray(tiberScores.nflfastrId, nflfastrIds),
            eq(tiberScores.season, season),
            sql`${tiberScores.week} >= ${week - 3} AND ${tiberScores.week} < ${week}`
          )
        )
        .orderBy(tiberScores.nflfastrId, desc(tiberScores.week));
    }

    // Build TIBER lookup map (player -> scores array)
    const tiberMap = new Map<string, typeof tiberHistory>();
    tiberHistory.forEach(t => {
      if (!tiberMap.has(t.nflfastrId)) {
        tiberMap.set(t.nflfastrId, []);
      }
      tiberMap.get(t.nflfastrId)!.push(t);
    });

    // BUILD RECOMMENDATIONS from batched data
    const recommendations: any[] = [];

    players.forEach(player => {
      const matchup = teamMatchups.get(player.nflTeam || '');
      if (!matchup) return; // No game this week

      const dvpKey = `${matchup.opponent}_${player.position}`;
      const dvpStats = dvpMap.get(dvpKey);

      const playerTiber = tiberMap.get(player.nflfastrId || '') || [];
      const avgTiberScore = playerTiber.length > 0
        ? playerTiber.reduce((sum, t) => sum + t.tiberScore, 0) / playerTiber.length
        : player.nflfastrId ? 50 : 40; // Lower confidence for players without TIBER data

      // Smart recommendation logic
      const isSuperstar = avgTiberScore >= 70;
      const isEliteMatchup = dvpStats?.dvpRating === 'elite-matchup';
      const isToughMatchup = dvpStats?.dvpRating === 'tough' || dvpStats?.dvpRating === 'avoid';
      const isBreakingOut = playerTiber.length >= 2 && playerTiber[0].tier === 'breakout';

      let recommendation = 'start';
      let confidence = 'medium';
      let reasoning = '';

      if (!player.nflfastrId) {
        // Fallback for players without TIBER data
        recommendation = 'start';
        confidence = 'low';
        reasoning = `Limited data available - proceed with caution`;
      } else if (isSuperstar) {
        recommendation = 'start';
        confidence = 'high';
        reasoning = `Elite player - start regardless of matchup (TIBER: ${avgTiberScore.toFixed(0)})`;
      } else if (isEliteMatchup) {
        recommendation = 'start';
        confidence = isBreakingOut ? 'high' : 'medium';
        reasoning = `Great matchup vs ${matchup.opponent}${dvpStats?.rankVsPosition ? ` (Defense Rank: #${dvpStats.rankVsPosition})` : ''}`;
      } else if (isToughMatchup && !isSuperstar) {
        recommendation = 'sit';
        confidence = 'medium';
        reasoning = `Tough matchup vs ${matchup.opponent}${dvpStats?.rankVsPosition ? ` (Defense Rank: #${dvpStats.rankVsPosition})` : ''}`;
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
          opponent: matchup.opponent,
          isHome: matchup.isHome,
          dvpRating: dvpStats?.dvpRating || 'unknown',
          rankVsPosition: dvpStats?.rankVsPosition || null,
        },
        recommendation,
        confidence,
        reasoning,
        metrics: {
          avgTiberScore: Math.round(avgTiberScore),
          isSuperstar,
          recentTrend: playerTiber.length >= 2 ? 
            (playerTiber[0].tiberScore - playerTiber[playerTiber.length - 1].tiberScore > 0 ? 'up' : 'down') : 'stable',
        }
      });
    });

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
 * Optimized with batch queries
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

    const positions = position ? [position] : ['QB', 'RB', 'WR', 'TE'];

    // BATCH 1: Get eligible players
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
          inArray(playerIdentityMap.position, positions),
          sql`${playerIdentityMap.nflTeam} IS NOT NULL`,
          sql`${playerIdentityMap.nflDataPyId} IS NOT NULL`
        )
      )
      .limit(200);

    if (players.length === 0) {
      return res.json({
        success: true,
        week,
        season,
        targets: []
      });
    }

    const nflfastrIds = players.map(p => p.nflfastrId!);

    // BATCH 2: Get latest TIBER scores for all players
    const tiberScoresData = await db
      .select({
        nflfastrId: tiberScores.nflfastrId,
        week: tiberScores.week,
        tiberScore: tiberScores.tiberScore,
        tier: tiberScores.tier,
      })
      .from(tiberScores)
      .where(
        and(
          inArray(tiberScores.nflfastrId, nflfastrIds),
          eq(tiberScores.season, season)
        )
      )
      .orderBy(tiberScores.nflfastrId, desc(tiberScores.week));

    // Build map of player -> latest TIBER score
    const latestTiberMap = new Map<string, typeof tiberScoresData[0]>();
    tiberScoresData.forEach(t => {
      if (!latestTiberMap.has(t.nflfastrId)) {
        latestTiberMap.set(t.nflfastrId, t);
      }
    });

    // Filter for breakout candidates
    const recommendations: any[] = [];
    players.forEach(player => {
      const latestTiber = latestTiberMap.get(player.nflfastrId || '');
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
    });

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
