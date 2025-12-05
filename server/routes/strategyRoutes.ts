/**
 * Strategy API Routes
 * 
 * Start/Sit recommendations, waiver targets, and lineup optimization
 * Optimized with batch queries to avoid N+1 problems
 * 
 * v2.0 - Operation Start/Sit Upgrade:
 * - 75%+ roster ownership filter (via Sleeper)
 * - Exclude T1 auto-starts (90%+ ownership)  
 * - Target T2-T3 "decision zone" players
 * - player_live_status integration for IR/inactive filtering
 * 
 * v2.1 - DvP-Powered Matchups:
 * - Uses defense_vs_position_stats.avg_pts_per_game_ppr as primary signal
 * - Recency-weighted matchup scoring (last 4 weeks)
 * - matchupScore100 (0-100 scale) for precise matchup quality
 * - isSmashSpot / isToughSpot flags for quick decisions
 */

import { Router } from 'express';
import { db } from '../infra/db';
import { playerIdentityMap, defenseVsPositionStats, schedule, tiberScores, sleeperOwnership, playerLiveStatus } from '../../shared/schema';
import { eq, and, or, sql, desc, asc, inArray, gte, lt, isNull } from 'drizzle-orm';
import { getThisWeekMatchup, DvPMatchup, WeeklyDvPMatchup } from '../modules/forge/dvpMatchupService';

const router = Router();

// TIBER Score thresholds by position (TIBER uses 0-100 scale, different from FORGE alpha)
// T1 = elite (auto-start, excluded by ownership filter), T2 = solid, T3 = matchup-dependent
const TIBER_THRESHOLDS = {
  QB: { t1: 70, t2: 55, t3: 40 },
  RB: { t1: 65, t2: 50, t3: 35 },
  WR: { t1: 65, t2: 50, t3: 35 },
  TE: { t1: 60, t2: 45, t3: 30 },
} as const;

// Ownership thresholds
const OWNERSHIP_MIN = 75;  // Minimum ownership % to be "rosterable"
const OWNERSHIP_AUTO_START = 90;  // Above this = must-start (exclude from recommendations)

/**
 * GET /api/strategy/start-sit
 * Get context-aware start/sit recommendations for a week
 * 
 * v2.0 Filters:
 * - 75%+ roster ownership (from Sleeper)
 * - Exclude 90%+ ownership (obvious starters)
 * - Exclude IR/inactive players
 * - Focus on T2-T3 Tiber Tier players with matchup context
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

    // Whitelist valid positions to prevent SQL injection
    const VALID_POSITIONS = ['QB', 'RB', 'WR', 'TE'] as const;
    const requestedPosition = position?.toUpperCase();
    
    if (requestedPosition && !VALID_POSITIONS.includes(requestedPosition as any)) {
      return res.status(400).json({
        success: false,
        error: `Invalid position. Must be one of: ${VALID_POSITIONS.join(', ')}`
      });
    }
    
    const positions = requestedPosition ? [requestedPosition] : [...VALID_POSITIONS];

    // Get latest ownership week
    const latestOwnershipWeek = await db
      .select({ maxWeek: sql<number>`MAX(${sleeperOwnership.week})` })
      .from(sleeperOwnership)
      .where(eq(sleeperOwnership.season, season));
    
    const ownershipWeek = latestOwnershipWeek[0]?.maxWeek || week;

    // BATCH 1: Get eligible players with ownership + live status filtering
    // - 75%+ ownership
    // - Less than 90% (exclude auto-starts)
    // - Not IR/inactive
    const players = await db
      .select({
        canonicalId: playerIdentityMap.canonicalId,
        fullName: playerIdentityMap.fullName,
        position: playerIdentityMap.position,
        nflTeam: sql<string>`COALESCE(${playerLiveStatus.currentTeam}, ${playerIdentityMap.nflTeam})`.as('nfl_team'),
        nflfastrId: playerIdentityMap.nflDataPyId,
        sleeperId: playerIdentityMap.sleeperId,
        ownershipPct: sleeperOwnership.ownershipPercentage,
        isEligible: playerLiveStatus.isEligibleForForge,
        liveStatus: playerLiveStatus.status,
        injuryStatus: playerLiveStatus.injuryStatus,
      })
      .from(playerIdentityMap)
      .leftJoin(sleeperOwnership, and(
        eq(sleeperOwnership.playerId, playerIdentityMap.sleeperId),
        eq(sleeperOwnership.season, season),
        eq(sleeperOwnership.week, ownershipWeek)
      ))
      .leftJoin(playerLiveStatus, eq(playerLiveStatus.canonicalId, playerIdentityMap.canonicalId))
      .where(
        and(
          inArray(playerIdentityMap.position, positions),
          sql`${playerIdentityMap.nflTeam} IS NOT NULL`,
          // Ownership filters: 75% <= ownership < 90%
          gte(sleeperOwnership.ownershipPercentage, OWNERSHIP_MIN),
          lt(sleeperOwnership.ownershipPercentage, OWNERSHIP_AUTO_START),
          // Live status: either eligible or no status record (assume eligible)
          or(
            eq(playerLiveStatus.isEligibleForForge, true),
            isNull(playerLiveStatus.isEligibleForForge)
          )
        )
      );

    console.log(`[Strategy v2] Week ${week}: Found ${players.length} decision-zone players (${OWNERSHIP_MIN}%-${OWNERSHIP_AUTO_START}% owned)`);

    if (players.length === 0) {
      return res.json({
        success: true,
        week,
        season,
        position: position || 'ALL',
        recommendations: [],
        summary: { totalAnalyzed: 0, startHighConfidence: 0, sitRecommendations: 0 },
        filters: {
          ownershipMin: OWNERSHIP_MIN,
          ownershipMax: OWNERSHIP_AUTO_START,
          excludedIR: true,
          message: 'No players found in decision zone. Try adjusting filters or check ownership data.'
        }
      });
    }

    // Extract unique teams for batch schedule query
    const teams = Array.from(new Set(players.map(p => p.nflTeam).filter(Boolean)));

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
            inArray(schedule.home, teams as string[]),
            inArray(schedule.away, teams as string[])
          )
        )
      ) : [];

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

    // BATCH 3: Get DvP ratings with recency-weighted FPTS allowed
    // Uses last 4 weeks with weights: 40% latest, 30% prev, 20% older, 10% oldest
    // Note: positions are already validated/whitelisted above
    const dvpRatings = await db
      .select({
        defenseTeam: defenseVsPositionStats.defenseTeam,
        position: defenseVsPositionStats.position,
        season: defenseVsPositionStats.season,
        week: defenseVsPositionStats.week,
        avgPtsAllowed: defenseVsPositionStats.avgPtsPerGamePpr,
        rankVsPosition: defenseVsPositionStats.rankVsPosition,
        dvpRating: defenseVsPositionStats.dvpRating,
      })
      .from(defenseVsPositionStats)
      .where(
        and(
          eq(defenseVsPositionStats.season, season),
          inArray(defenseVsPositionStats.position, positions)
        )
      )
      .orderBy(desc(defenseVsPositionStats.week));

    // Apply recency weighting: 40% latest, 30% prev, 20% older, 10% oldest
    const teamPositionData = new Map<string, {
      weeks: { week: number; fpts: number; rank: number; rating: string }[];
    }>();

    dvpRatings.forEach(row => {
      const key = `${row.defenseTeam}_${row.position}`;
      if (!teamPositionData.has(key)) {
        teamPositionData.set(key, { weeks: [] });
      }
      const data = teamPositionData.get(key)!;
      if (data.weeks.length < 4 && row.week !== null) {
        data.weeks.push({
          week: row.week,
          fpts: Number(row.avgPtsAllowed) || 0,
          rank: Number(row.rankVsPosition) || 16,
          rating: row.dvpRating || 'neutral',
        });
      }
    });

    // Calculate weighted FPTS for each team-position
    const RECENCY_WEIGHTS = [0.40, 0.30, 0.20, 0.10];
    const weightedDvpData = new Map<string, {
      defenseTeam: string;
      position: string;
      weightedFpts: number;
      latestRank: number;
      latestRating: string;
    }>();

    teamPositionData.forEach((data, key) => {
      const [defenseTeam, position] = key.split('_');
      let weightedFpts = 0;
      let totalWeight = 0;
      
      data.weeks.forEach((weekData, idx) => {
        const weight = RECENCY_WEIGHTS[idx] || 0.10;
        weightedFpts += weekData.fpts * weight;
        totalWeight += weight;
      });
      
      // Normalize if we don't have all 4 weeks
      if (totalWeight > 0 && totalWeight < 1) {
        weightedFpts = weightedFpts / totalWeight;
      }
      
      weightedDvpData.set(key, {
        defenseTeam,
        position,
        weightedFpts,
        latestRank: data.weeks[0]?.rank || 16,
        latestRating: data.weeks[0]?.rating || 'neutral',
      });
    });

    // Position-specific FPTS ranges for 0-100 normalization (based on actual 2025 data)
    // Higher FPTS allowed = easier matchup = higher score
    const FPTS_RANGES: Record<string, { min: number; max: number }> = {
      QB: { min: 5, max: 28 },   // 2025 range: 2.7-31.2, avg 16.2
      RB: { min: 8, max: 35 },   // 2025 range: 6.4-46.6, avg 21.0
      WR: { min: 12, max: 45 },  // 2025 range: 9.8-53.0, avg 29.6
      TE: { min: 3, max: 22 },   // 2025 range: 1.2-26.6, avg 14.1
    };

    // Build DvP lookup map with matchup score calculation from weighted data
    const dvpMap = new Map<string, {
      defenseTeam: string;
      position: string;
      rankVsPosition: number;
      dvpRating: string;
      avgFptsAllowed: number;
      matchupScore100: number;
      isSmashSpot: boolean;
      isToughSpot: boolean;
    }>();

    weightedDvpData.forEach((data, key) => {
      const fpts = data.weightedFpts;
      const range = FPTS_RANGES[data.position] || FPTS_RANGES.WR;
      const normalized = (fpts - range.min) / (range.max - range.min);
      const matchupScore = Math.max(0, Math.min(100, Math.round(normalized * 100)));
      const rank = data.latestRank;

      dvpMap.set(key, {
        defenseTeam: data.defenseTeam,
        position: data.position,
        rankVsPosition: rank,
        dvpRating: data.latestRating,
        avgFptsAllowed: Math.round(fpts * 10) / 10,
        matchupScore100: matchupScore,
        isSmashSpot: rank <= 8,
        isToughSpot: rank >= 25,
      });
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
        : 50; // Default for players without TIBER data

      // Get position-specific tier thresholds
      const thresholds = TIBER_THRESHOLDS[player.position as keyof typeof TIBER_THRESHOLDS] || TIBER_THRESHOLDS.WR;
      
      // Determine player tier based on avg score (using TIBER score as proxy for now)
      const isT1 = avgTiberScore >= thresholds.t1;
      const isT2 = avgTiberScore >= thresholds.t2 && avgTiberScore < thresholds.t1;
      const isT3 = avgTiberScore >= thresholds.t3 && avgTiberScore < thresholds.t2;

      // Skip T1 players (auto-starts already filtered by ownership, but double-check)
      if (isT1) return;

      // Matchup quality assessment using new matchupScore100 (0-100 scale)
      const matchupScore = dvpStats?.matchupScore100 ?? 50;
      const isSmashSpot = dvpStats?.isSmashSpot || matchupScore >= 70;
      const isEliteMatchup = matchupScore >= 60 || (dvpStats?.rankVsPosition && dvpStats.rankVsPosition <= 8);
      const isFavorableMatchup = matchupScore >= 50 || (dvpStats?.rankVsPosition && dvpStats.rankVsPosition <= 12);
      const isToughMatchup = matchupScore <= 35 || (dvpStats?.rankVsPosition && dvpStats.rankVsPosition >= 25);
      const isBreakingOut = playerTiber.length >= 2 && playerTiber[0].tier === 'breakout';

      let recommendation = 'start';
      let confidence = 'medium';
      let reasoning = '';

      // Decision logic based on tier + matchup combination
      // matchupScore: 0-100 (higher = easier), rank: 1-32 (lower = easier)
      const matchupLabel = isSmashSpot ? '🔥 SMASH SPOT' : 
                          isEliteMatchup ? 'Elite' : 
                          isFavorableMatchup ? 'Favorable' : 
                          isToughMatchup ? 'Tough' : 'Neutral';

      if (isT2) {
        // T2 players: Good but not elite
        if (isSmashSpot) {
          recommendation = 'start';
          confidence = 'high';
          reasoning = `${matchupLabel}: T2 player vs ${matchup.opponent} (#${dvpStats?.rankVsPosition || '?'} vs ${player.position}, ${dvpStats?.avgFptsAllowed || '?'} FPTS/gm allowed)`;
        } else if (isEliteMatchup) {
          recommendation = 'start';
          confidence = 'high';
          reasoning = `Strong T2 player with elite matchup vs ${matchup.opponent} (Matchup Score: ${matchupScore}/100)`;
        } else if (isToughMatchup) {
          recommendation = 'sit';
          confidence = 'medium';
          reasoning = `T2 player facing tough ${matchup.opponent} defense (#${dvpStats?.rankVsPosition || '?'} vs ${player.position}) - consider alternatives`;
        } else if (isFavorableMatchup) {
          recommendation = 'start';
          confidence = 'medium';
          reasoning = `Solid T2 option with favorable matchup vs ${matchup.opponent} (Score: ${matchupScore}/100)`;
        } else {
          recommendation = 'start';
          confidence = 'low';
          reasoning = `T2 player, neutral matchup vs ${matchup.opponent} - check your other options`;
        }
      } else if (isT3) {
        // T3 players: Matchup-dependent
        if (isSmashSpot) {
          recommendation = 'start';
          confidence = 'high';
          reasoning = `${matchupLabel}: Matchup unlocks T3 upside vs ${matchup.opponent} (#${dvpStats?.rankVsPosition || '?'}, ${dvpStats?.avgFptsAllowed || '?'} FPTS/gm)`;
        } else if (isEliteMatchup) {
          recommendation = 'start';
          confidence = 'medium';
          reasoning = `T3 player boosted by elite matchup vs ${matchup.opponent} (Score: ${matchupScore}/100)`;
        } else if (isToughMatchup) {
          recommendation = 'sit';
          confidence = 'high';
          reasoning = `T3 player in brutal matchup vs ${matchup.opponent} (#${dvpStats?.rankVsPosition || '?'} defense) - avoid`;
        } else if (isFavorableMatchup && isBreakingOut) {
          recommendation = 'start';
          confidence = 'medium';
          reasoning = `Breakout T3 candidate with favorable ${matchup.opponent} matchup - upside play`;
        } else {
          recommendation = 'sit';
          confidence = 'low';
          reasoning = `T3 player in neutral matchup vs ${matchup.opponent} - likely better options`;
        }
      } else {
        // Below T3: Not recommended
        if (isSmashSpot) {
          recommendation = 'start';
          confidence = 'medium';
          reasoning = `${matchupLabel}: Elite matchup vs ${matchup.opponent} could elevate this deep league flex`;
        } else if (isEliteMatchup) {
          recommendation = 'start';
          confidence = 'low';
          reasoning = `Deep league play: elite ${matchup.opponent} matchup (Score: ${matchupScore}/100)`;
        } else {
          recommendation = 'sit';
          confidence = 'medium';
          reasoning = `Below T3 tier vs ${matchup.opponent} - limited upside this week`;
        }
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
          matchupScore100: matchupScore,
          avgFptsAllowed: dvpStats?.avgFptsAllowed || null,
          isSmashSpot,
          isToughSpot: isToughMatchup,
        },
        recommendation,
        confidence,
        reasoning,
        metrics: {
          ownershipPct: player.ownershipPct ? Math.round(player.ownershipPct * 10) / 10 : null,
          avgTiberScore: Math.round(avgTiberScore),
          tier: isT2 ? 'T2' : isT3 ? 'T3' : 'T4',
          recentTrend: playerTiber.length >= 2 ? 
            (playerTiber[0].tiberScore - playerTiber[playerTiber.length - 1].tiberScore > 0 ? 'up' : 'down') : 'stable',
        }
      });
    });

    // Sort: Start (high confidence) > Start (medium) > Sit (medium) > Sit (high)
    const sorted = recommendations.sort((a, b) => {
      // Starts first, then sits
      if (a.recommendation !== b.recommendation) {
        return a.recommendation === 'start' ? -1 : 1;
      }
      // Within same recommendation, sort by confidence
      const confidenceOrder: any = { high: 0, medium: 1, low: 2 };
      const confDiff = confidenceOrder[a.confidence] - confidenceOrder[b.confidence];
      if (confDiff !== 0) return confDiff;
      // Then by ownership (higher = more relevant)
      return (b.metrics.ownershipPct || 0) - (a.metrics.ownershipPct || 0);
    });

    res.json({
      success: true,
      week,
      season,
      position: position || 'ALL',
      recommendations: sorted.slice(0, 50),
      summary: {
        totalAnalyzed: sorted.length,
        startHighConfidence: sorted.filter(r => r.recommendation === 'start' && r.confidence === 'high').length,
        startMediumConfidence: sorted.filter(r => r.recommendation === 'start' && r.confidence === 'medium').length,
        sitRecommendations: sorted.filter(r => r.recommendation === 'sit').length,
      },
      filters: {
        ownershipMin: OWNERSHIP_MIN,
        ownershipMax: OWNERSHIP_AUTO_START,
        ownershipWeek,
        excludedAutoStarts: true,
        excludedIR: true,
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
