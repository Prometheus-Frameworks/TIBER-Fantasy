import { Router } from 'express';
import { tiberService } from '../services/tiberService';
import { db } from '../db';
import { tiberScores, playerIdentityMap, players } from '../../shared/schema';
import { eq, and, desc, sql, ilike, inArray, isNotNull } from 'drizzle-orm';

const router = Router();

// Batch TIBER Rankings - Top WR/TE players with positional ranks
router.get('/rankings', async (req, res) => {
  try {
    const week = parseInt(req.query.week as string) || 8; // Default Week 8
    const season = parseInt(req.query.season as string) || 2025;
    const limit = parseInt(req.query.limit as string) || 150;

    console.log(`📊 [TIBER Rankings] Fetching top ${limit} WR/TE players for Week ${week}, ${season}`);

    // Query TIBER scores directly, sorted by score (highest first)
    // Join with player_identity_map to get player details
    const rankedPlayers = await db
      .select({
        nflfastrId: tiberScores.nflfastrId,
        tiberScore: tiberScores.tiberScore,
        tier: tiberScores.tier,
        name: playerIdentityMap.fullName,
        position: playerIdentityMap.position,
        team: playerIdentityMap.nflTeam,
        sleeperId: playerIdentityMap.sleeperId,
      })
      .from(tiberScores)
      .innerJoin(
        playerIdentityMap,
        eq(tiberScores.nflfastrId, playerIdentityMap.nflDataPyId)
      )
      .where(
        and(
          eq(tiberScores.week, week),
          eq(tiberScores.season, season),
          inArray(playerIdentityMap.position, ['WR', 'TE']),
          isNotNull(playerIdentityMap.nflTeam)
        )
      )
      .orderBy(desc(tiberScores.tiberScore))
      .limit(limit);

    console.log(`✅ Found ${rankedPlayers.length} players with TIBER scores for Week ${week}`);

    if (rankedPlayers.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No TIBER scores available for Week ' + week,
        details: 'No WR/TE players found with TIBER scores for this week. Scores must be pre-calculated.',
      });
    }

    // Convert to response format
    const playersWithScores = rankedPlayers.map(p => ({
      name: p.name,
      position: p.position,
      team: p.team,
      sleeperId: p.sleeperId,
      tiberScore: p.tiberScore,
      tier: p.tier,
      nflfastrId: p.nflfastrId,
    }));

    // Calculate positional ranks
    const wrRank = new Map<string, number>();
    const teRank = new Map<string, number>();
    let wrCount = 0;
    let teCount = 0;

    playersWithScores.forEach(player => {
      if (player.position === 'WR') {
        wrCount++;
        wrRank.set(player.nflfastrId, wrCount);
      } else if (player.position === 'TE') {
        teCount++;
        teRank.set(player.nflfastrId, teCount);
      }
    });

    // Add positional rank to each player
    const playersWithRanks = playersWithScores.map(player => ({
      ...player,
      positionalRank: player.position === 'WR' 
        ? wrRank.get(player.nflfastrId) || 0
        : teRank.get(player.nflfastrId) || 0,
      tiberRank: player.position === 'WR' 
        ? `WR${wrRank.get(player.nflfastrId) || 0}`
        : `TE${teRank.get(player.nflfastrId) || 0}`,
    }));

    console.log(`✅ [TIBER Rankings] Ranked ${playersWithRanks.length} players (${wrCount} WRs, ${teCount} TEs)`);

    res.json({
      success: true,
      data: {
        week,
        season,
        total: playersWithRanks.length,
        wrCount,
        teCount,
        players: playersWithRanks,
      },
      generated_at: new Date().toISOString(),
    });

  } catch (error) {
    console.error('❌ [TIBER Rankings] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate TIBER rankings',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Get TIBER score by player name (must come BEFORE /score/:playerId to avoid route conflict)
router.get('/by-name/:name', async (req, res) => {
  try {
    const playerName = req.params.name;
    const week = parseInt(req.query.week as string) || 6;
    const season = parseInt(req.query.season as string) || 2025;

    // Look up player by name in playerIdentityMap
    const player = await db
      .select({
        nflfastrId: playerIdentityMap.nflDataPyId,
        name: playerIdentityMap.fullName,
        position: playerIdentityMap.position,
      })
      .from(playerIdentityMap)
      .where(ilike(playerIdentityMap.fullName, playerName))
      .limit(1);

    if (!player || player.length === 0 || !player[0].nflfastrId) {
      return res.status(404).json({ 
        success: false, 
        error: 'Player not found or missing NFLfastR ID' 
      });
    }

    const nflfastrId = player[0].nflfastrId;

    // Check cache
    const cached = await db
      .select()
      .from(tiberScores)
      .where(
        and(
          eq(tiberScores.nflfastrId, nflfastrId),
          eq(tiberScores.week, week),
          eq(tiberScores.season, season)
        )
      )
      .limit(1);

    if (cached.length > 0) {
      return res.json({ 
        success: true, 
        data: cached[0],
        playerInfo: { name: player[0].name, position: player[0].position },
        source: 'cache' 
      });
    }

    // Calculate if not cached
    try {
      const score = await tiberService.calculateTiberScore(nflfastrId, week, season);
      
      // Save to cache
      await db.insert(tiberScores).values({
        playerId: null,
        nflfastrId,
        week,
        season,
        tiberScore: score.tiberScore,
        tier: score.tier,
        firstDownScore: score.breakdown.firstDownScore,
        epaScore: score.breakdown.epaScore,
        usageScore: score.breakdown.usageScore,
        tdScore: score.breakdown.tdScore,
        teamScore: score.breakdown.teamScore,
        firstDownRate: score.metrics.firstDownRate,
        totalFirstDowns: score.metrics.totalFirstDowns,
        epaPerPlay: score.metrics.epaPerPlay,
        snapPercentAvg: score.metrics.snapPercentAvg,
        snapPercentTrend: score.metrics.snapTrend,
        tdRate: score.metrics.tdRate,
        teamOffenseRank: score.metrics.teamOffenseRank,
      }).onConflictDoUpdate({
        target: [tiberScores.nflfastrId, tiberScores.week, tiberScores.season],
        set: {
          tiberScore: score.tiberScore,
          tier: score.tier,
          firstDownScore: score.breakdown.firstDownScore,
          epaScore: score.breakdown.epaScore,
          usageScore: score.breakdown.usageScore,
          tdScore: score.breakdown.tdScore,
          teamScore: score.breakdown.teamScore,
          firstDownRate: score.metrics.firstDownRate,
          totalFirstDowns: score.metrics.totalFirstDowns,
          epaPerPlay: score.metrics.epaPerPlay,
          snapPercentAvg: score.metrics.snapPercentAvg,
          snapPercentTrend: score.metrics.snapTrend,
          tdRate: score.metrics.tdRate,
          teamOffenseRank: score.metrics.teamOffenseRank,
          calculatedAt: new Date(),
        },
      });

      res.json({ 
        success: true, 
        data: {
          nflfastrId,
          week,
          season,
          ...score
        },
        playerInfo: { name: player[0].name, position: player[0].position },
        source: 'calculated' 
      });
    } catch (calcError) {
      // Player found but no stats available
      return res.status(404).json({ 
        success: false, 
        error: 'No stats available for this player',
        playerInfo: { name: player[0].name, position: player[0].position }
      });
    }
  } catch (error) {
    console.error('[TIBER] By-name lookup error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to look up player TIBER score' 
    });
  }
});

// Get TIBER score for a single player (via NFLfastR ID)
router.get('/score/:playerId', async (req, res) => {
  try {
    const nflfastrId = req.params.playerId; // NFLfastR ID like "00-0036322"
    const week = parseInt(req.query.week as string) || 6; // Current week
    const season = parseInt(req.query.season as string) || 2025;
    const forceRecalc = req.query.force === 'true'; // Force recalculation

    // Check cache first (unless force recalc)
    if (!forceRecalc) {
      const cached = await db
        .select()
        .from(tiberScores)
        .where(
          and(
            eq(tiberScores.nflfastrId, nflfastrId),
            eq(tiberScores.week, week),
            eq(tiberScores.season, season)
          )
        )
        .limit(1);

      if (cached.length > 0) {
        return res.json({ success: true, data: cached[0], source: 'cache' });
      }
    }

    // Calculate if not cached or force recalc
    const calculatedScore = await tiberService.calculateTiberScore(nflfastrId, week, season);
    
    // Save to cache (TIBER v1.5 with First Downs + Live Data)
    await db.insert(tiberScores).values({
      playerId: null,
      nflfastrId,
      week,
      season,
      tiberScore: calculatedScore.tiberScore,
      tier: calculatedScore.tier,
      firstDownScore: calculatedScore.breakdown.firstDownScore,
      epaScore: calculatedScore.breakdown.epaScore,
      usageScore: calculatedScore.breakdown.usageScore,
      tdScore: calculatedScore.breakdown.tdScore,
      teamScore: calculatedScore.breakdown.teamScore,
      firstDownRate: calculatedScore.metrics.firstDownRate,
      totalFirstDowns: calculatedScore.metrics.totalFirstDowns,
      epaPerPlay: calculatedScore.metrics.epaPerPlay,
      snapPercentAvg: calculatedScore.metrics.snapPercentAvg,
      snapPercentTrend: calculatedScore.metrics.snapTrend,
      tdRate: calculatedScore.metrics.tdRate,
      teamOffenseRank: calculatedScore.metrics.teamOffenseRank,
    }).onConflictDoUpdate({
      target: [tiberScores.nflfastrId, tiberScores.week, tiberScores.season],
      set: {
        tiberScore: calculatedScore.tiberScore,
        tier: calculatedScore.tier,
        firstDownScore: calculatedScore.breakdown.firstDownScore,
        epaScore: calculatedScore.breakdown.epaScore,
        usageScore: calculatedScore.breakdown.usageScore,
        tdScore: calculatedScore.breakdown.tdScore,
        teamScore: calculatedScore.breakdown.teamScore,
        firstDownRate: calculatedScore.metrics.firstDownRate,
        totalFirstDowns: calculatedScore.metrics.totalFirstDowns,
        epaPerPlay: calculatedScore.metrics.epaPerPlay,
        snapPercentAvg: calculatedScore.metrics.snapPercentAvg,
        snapPercentTrend: calculatedScore.metrics.snapTrend,
        tdRate: calculatedScore.metrics.tdRate,
        teamOffenseRank: calculatedScore.metrics.teamOffenseRank,
        calculatedAt: new Date(),
      },
    });

    // Return the freshly calculated score (not from DB)
    res.json({ 
      success: true, 
      data: {
        nflfastrId,
        week,
        season,
        ...calculatedScore
      }, 
      source: forceRecalc ? 'recalculated' : 'calculated' 
    });
  } catch (error) {
    console.error('[TIBER] Score calculation error:', error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to calculate TIBER score' 
    });
  }
});

// Get all TIBER scores for a week
router.get('/week/:week', async (req, res) => {
  try {
    const week = parseInt(req.params.week);
    const season = parseInt(req.query.season as string) || 2025;
    const minScore = req.query.minScore ? parseInt(req.query.minScore as string) : undefined;
    const tier = req.query.tier as string | undefined;

    let query = db
      .select()
      .from(tiberScores)
      .where(
        and(
          eq(tiberScores.week, week),
          eq(tiberScores.season, season)
        )
      )
      .$dynamic();

    if (minScore !== undefined) {
      query = query.where(sql`${tiberScores.tiberScore} >= ${minScore}`);
    }

    if (tier) {
      query = query.where(eq(tiberScores.tier, tier as any));
    }

    const scores = await query.orderBy(desc(tiberScores.tiberScore));

    res.json({ success: true, count: scores.length, data: scores });
  } catch (error) {
    console.error('[TIBER] Week scores fetch error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch TIBER scores' 
    });
  }
});

// Compare two players (using NFLfastR IDs)
router.get('/compare', async (req, res) => {
  try {
    const playerAId = req.query.playerA as string;  // NFLfastR ID
    const playerBId = req.query.playerB as string;  // NFLfastR ID
    const week = parseInt(req.query.week as string) || 6;
    const season = parseInt(req.query.season as string) || 2025;

    if (!playerAId || !playerBId) {
      return res.status(400).json({ 
        success: false, 
        error: 'playerA and playerB query params required (NFLfastR IDs)' 
      });
    }

    // Fetch both scores in parallel
    const [scoresA, scoresB] = await Promise.all([
      db.select().from(tiberScores).where(
        and(
          eq(tiberScores.nflfastrId, playerAId),
          eq(tiberScores.week, week),
          eq(tiberScores.season, season)
        )
      ).limit(1),
      db.select().from(tiberScores).where(
        and(
          eq(tiberScores.nflfastrId, playerBId),
          eq(tiberScores.week, week),
          eq(tiberScores.season, season)
        )
      ).limit(1)
    ]);

    const scoreA = scoresA[0];
    const scoreB = scoresB[0];

    // Calculate if not cached
    if (!scoreA || !scoreB) {
      const [calcA, calcB] = await Promise.all([
        scoreA ? Promise.resolve(scoreA) : tiberService.calculateTiberScore(playerAId, week, season).catch(() => null),
        scoreB ? Promise.resolve(scoreB) : tiberService.calculateTiberScore(playerBId, week, season).catch(() => null)
      ]);

      return res.json({
        success: true,
        playerA: calcA,
        playerB: calcB,
        recommendation: calcA && calcB ? (calcA.tiberScore > calcB.tiberScore ? 'playerA' : 'playerB') : null,
        scoreDiff: calcA && calcB ? Math.abs(calcA.tiberScore - calcB.tiberScore) : null
      });
    }

    res.json({
      success: true,
      playerA: scoreA,
      playerB: scoreB,
      recommendation: scoreA.tiberScore > scoreB.tiberScore ? 'playerA' : 'playerB',
      scoreDiff: Math.abs(scoreA.tiberScore - scoreB.tiberScore)
    });
  } catch (error) {
    console.error('[TIBER] Compare error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to compare players' 
    });
  }
});

// Trigger batch calculation for a week
router.post('/calculate/:week', async (req, res) => {
  try {
    const week = parseInt(req.params.week);
    const season = parseInt(req.query.season as string) || 2025;

    // Return immediately and run in background
    res.json({ 
      success: true, 
      message: `TIBER calculation started for Week ${week}, ${season}` 
    });

    // Run in background
    tiberService.calculateAllScores(week, season).catch(err => {
      console.error('[TIBER] Batch calculation error:', err);
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: 'Failed to start TIBER calculation' 
    });
  }
});

// Get insights: breakouts, regressions, hidden gems
router.get('/insights', async (req, res) => {
  try {
    const week = parseInt(req.query.week as string) || 6;
    const season = parseInt(req.query.season as string) || 2025;

    // Get all TIBER scores for this week with player info
    const allScores = await db
      .select({
        nflfastrId: tiberScores.nflfastrId,
        name: playerIdentityMap.fullName,
        team: playerIdentityMap.nflTeam,
        position: playerIdentityMap.position,
        tiberScore: tiberScores.tiberScore,
        tier: tiberScores.tier,
        firstDownRate: tiberScores.firstDownRate,
      })
      .from(tiberScores)
      .innerJoin(
        playerIdentityMap, 
        eq(tiberScores.nflfastrId, playerIdentityMap.nflDataPyId)
      )
      .where(
        and(
          eq(tiberScores.week, week),
          eq(tiberScores.season, season)
        )
      )
      .orderBy(desc(tiberScores.tiberScore));

    // Categorize players
    const breakouts = allScores
      .filter(s => s.tier === 'breakout')
      .slice(0, 5);

    const regressions = allScores
      .filter(s => s.tier === 'regression')
      .sort((a, b) => a.tiberScore - b.tiberScore) // Lowest scores first
      .slice(0, 5);

    // Hidden Gems: Breakout tier + skill positions (WR, RB, TE only)
    const gems = allScores
      .filter(s => 
        s.tier === 'breakout' && 
        s.position && ['WR', 'RB', 'TE'].includes(s.position)
      )
      .slice(0, 5);

    res.json({
      success: true,
      week,
      season,
      breakouts,
      regressions,
      gems,
      totalPlayers: allScores.length,
      note: "Hidden Gems will include roster % filtering once Sleeper integration is complete"
    });

  } catch (error) {
    console.error('[TIBER] Insights error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch insights' 
    });
  }
});

// Get TIBER history for trend charts (weeks 1-6)
router.get('/history/:nflfastrId', async (req, res) => {
  try {
    const { nflfastrId } = req.params;
    const season = parseInt(req.query.season as string) || 2025;
    const startWeek = parseInt(req.query.startWeek as string) || 1;
    const endWeek = parseInt(req.query.endWeek as string) || 6;

    const history = await db
      .select({
        week: tiberScores.week,
        tiberScore: tiberScores.tiberScore,
        tier: tiberScores.tier,
        firstDownRate: tiberScores.firstDownRate,
        epaPerPlay: tiberScores.epaPerPlay,
        snapPercentAvg: tiberScores.snapPercentAvg,
        snapPercentTrend: tiberScores.snapPercentTrend,
        calculatedAt: tiberScores.calculatedAt,
      })
      .from(tiberScores)
      .where(
        and(
          eq(tiberScores.nflfastrId, nflfastrId),
          eq(tiberScores.season, season),
          sql`${tiberScores.week} >= ${startWeek} AND ${tiberScores.week} <= ${endWeek}`
        )
      )
      .orderBy(tiberScores.week);

    if (history.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No TIBER history found for this player'
      });
    }

    const lastThreeWeeks = history.slice(-3);
    const trend = lastThreeWeeks.length >= 2
      ? lastThreeWeeks[lastThreeWeeks.length - 1].tiberScore - lastThreeWeeks[0].tiberScore
      : 0;

    res.json({
      success: true,
      data: {
        nflfastrId,
        season,
        history,
        summary: {
          totalWeeks: history.length,
          currentScore: history[history.length - 1]?.tiberScore || 0,
          currentTier: history[history.length - 1]?.tier || 'neutral',
          trend: trend > 0 ? 'up' : trend < 0 ? 'down' : 'stable',
          trendValue: trend,
          lastThreeWeeks: lastThreeWeeks.map(w => ({
            week: w.week,
            score: w.tiberScore,
            tier: w.tier
          }))
        }
      }
    });
  } catch (error) {
    console.error('[TIBER] History error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch TIBER history'
    });
  }
});

// Health check
router.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'TIBER v1 MVP',
    description: 'Tactical Index for Breakout Efficiency and Regression'
  });
});

export default router;
