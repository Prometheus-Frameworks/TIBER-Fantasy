import { Router } from 'express';
import { tiberService } from '../services/tiberService';
import { db } from '../infra/db';
import { tiberScores, playerIdentityMap, players, injuries, gameLogs } from '../../shared/schema';
import { eq, and, desc, sql, ilike, inArray, isNotNull } from 'drizzle-orm';
import { injurySyncService } from '../services/injurySyncService';

const router = Router();

// Helper function to transform flat DB record to nested structure
function transformCachedScore(cachedRecord: any) {
  return {
    nflfastrId: cachedRecord.nflfastrId,
    week: cachedRecord.week,
    season: cachedRecord.season,
    tiberScore: cachedRecord.tiberScore,
    tier: cachedRecord.tier,
    breakdown: {
      firstDownScore: cachedRecord.firstDownScore || 0,
      epaScore: cachedRecord.epaScore || 0,
      usageScore: cachedRecord.usageScore || 0,
      tdScore: cachedRecord.tdScore || 0,
      teamScore: cachedRecord.teamScore || 0,
    },
    metrics: {
      firstDownRate: cachedRecord.firstDownRate || 0,
      totalFirstDowns: cachedRecord.totalFirstDowns || 0,
      epaPerPlay: cachedRecord.epaPerPlay || 0,
      snapPercentAvg: cachedRecord.snapPercentAvg || 0,
      snapTrend: cachedRecord.snapPercentTrend || 'stable',
      tdRate: cachedRecord.tdRate || 0,
      teamOffenseRank: cachedRecord.teamOffenseRank || 0,
    }
  };
}

// Helper function to fetch game log data for a player
async function fetchGameLog(nflfastrId: string, week: number, season: number, mode: 'weekly' | 'season') {
  try {
    // Get sleeperId from player_identity_map
    const playerMapping = await db
      .select({ sleeperId: playerIdentityMap.sleeperId })
      .from(playerIdentityMap)
      .where(eq(playerIdentityMap.nflDataPyId, nflfastrId))
      .limit(1);

    if (playerMapping.length === 0 || !playerMapping[0].sleeperId) {
      return null;
    }

    const sleeperId = playerMapping[0].sleeperId;

    // For weekly mode, get single week's game log
    if (mode === 'weekly') {
      const gameLog = await db
        .select()
        .from(gameLogs)
        .where(
          and(
            eq(gameLogs.sleeperId, sleeperId),
            eq(gameLogs.season, season),
            eq(gameLogs.week, week),
            sql`UPPER(${gameLogs.seasonType}) = 'REG'`
          )
        )
        .limit(1);

      if (gameLog.length === 0) return null;

      const log = gameLog[0];
      return {
        opponent: log.opponent,
        gameDate: log.gameDate,
        fantasyPoints: log.fantasyPointsPpr,
        passing: {
          attempts: log.passAttempts,
          completions: log.passCompletions,
          yards: log.passYards,
          touchdowns: log.passTd,
          interceptions: log.passInt,
        },
        rushing: {
          attempts: log.rushAttempts,
          yards: log.rushYards,
          touchdowns: log.rushTd,
        },
        receiving: {
          receptions: log.receptions,
          targets: log.targets,
          yards: log.recYards,
          touchdowns: log.recTd,
        },
      };
    }

    // For season mode, aggregate stats across all weeks up to current week
    const gameLogs_data = await db
      .select()
      .from(gameLogs)
      .where(
        and(
          eq(gameLogs.sleeperId, sleeperId),
          eq(gameLogs.season, season),
          sql`${gameLogs.week} <= ${week}`,
          sql`UPPER(${gameLogs.seasonType}) = 'REG'`
        )
      );

    if (gameLogs_data.length === 0) return null;

    // Aggregate all stats
    const totals = gameLogs_data.reduce((acc, log) => ({
      fantasyPoints: (acc.fantasyPoints || 0) + (log.fantasyPointsPpr || 0),
      passing: {
        attempts: (acc.passing.attempts || 0) + (log.passAttempts || 0),
        completions: (acc.passing.completions || 0) + (log.passCompletions || 0),
        yards: (acc.passing.yards || 0) + (log.passYards || 0),
        touchdowns: (acc.passing.touchdowns || 0) + (log.passTd || 0),
        interceptions: (acc.passing.interceptions || 0) + (log.passInt || 0),
      },
      rushing: {
        attempts: (acc.rushing.attempts || 0) + (log.rushAttempts || 0),
        yards: (acc.rushing.yards || 0) + (log.rushYards || 0),
        touchdowns: (acc.rushing.touchdowns || 0) + (log.rushTd || 0),
      },
      receiving: {
        receptions: (acc.receiving.receptions || 0) + (log.receptions || 0),
        targets: (acc.receiving.targets || 0) + (log.targets || 0),
        yards: (acc.receiving.yards || 0) + (log.recYards || 0),
        touchdowns: (acc.receiving.touchdowns || 0) + (log.recTd || 0),
      },
    }), {
      fantasyPoints: 0,
      passing: { attempts: 0, completions: 0, yards: 0, touchdowns: 0, interceptions: 0 },
      rushing: { attempts: 0, yards: 0, touchdowns: 0 },
      receiving: { receptions: 0, targets: 0, yards: 0, touchdowns: 0 },
    });

    return {
      opponent: null, // Season mode doesn't have single opponent
      gameDate: null,
      gamesPlayed: gameLogs_data.length,
      ...totals,
    };
  } catch (error) {
    console.error('[TIBER] Error fetching game log:', error);
    return null;
  }
}

// Batch TIBER Rankings - Top WR/TE players with positional ranks
router.get('/rankings', async (req, res) => {
  try {
    const week = parseInt(req.query.week as string) || 8; // Default Week 8
    const season = parseInt(req.query.season as string) || 2025;
    const limit = parseInt(req.query.limit as string) || 150;

    console.log(`📊 [TIBER Rankings] Fetching top ${limit} WR/TE players for Week ${week}, ${season}`);

    // Query TIBER scores for all positions (QB, RB, WR, TE)
    // Exclude injured/inactive players and filter for meaningful participation
    const rankedPlayers = await db
      .select({
        nflfastrId: tiberScores.nflfastrId,
        tiberScore: tiberScores.tiberScore,
        tier: tiberScores.tier,
        name: playerIdentityMap.fullName,
        position: playerIdentityMap.position,
        team: playerIdentityMap.nflTeam,
        sleeperId: playerIdentityMap.sleeperId,
        snapPercentAvg: tiberScores.snapPercentAvg,
        totalFirstDowns: tiberScores.totalFirstDowns,
        injuryStatus: injuries.status,
      })
      .from(tiberScores)
      .innerJoin(
        playerIdentityMap,
        eq(tiberScores.nflfastrId, playerIdentityMap.nflDataPyId)
      )
      .leftJoin(
        injuries,
        and(
          eq(injuries.canonicalPlayerId, playerIdentityMap.canonicalId),
          eq(injuries.isResolved, false),
          eq(injuries.season, season)
        )
      )
      .where(
        and(
          eq(tiberScores.week, week),
          eq(tiberScores.season, season),
          inArray(playerIdentityMap.position, ['QB', 'RB', 'WR', 'TE']),
          isNotNull(playerIdentityMap.nflTeam),
          // Minimum participation filter: at least 2 first downs OR 30% snap share
          // This ensures players actually played meaningful snaps
          sql`(${tiberScores.totalFirstDowns} >= 2 OR ${tiberScores.snapPercentAvg} >= 30)`,
          // Exclude currently injured players (out, IR, doubtful)
          // If no injury record exists (NULL), player is considered healthy
          sql`(${injuries.status} IS NULL OR ${injuries.status} NOT IN ('out', 'ir', 'doubtful'))`
        )
      )
      .orderBy(desc(tiberScores.tiberScore))
      .limit(limit);

    console.log(`✅ Found ${rankedPlayers.length} players with TIBER scores for Week ${week}`);

    // Add sample QB and RB players if none exist in database (temporary for UI development)
    const sampleQBs = [
      { name: 'Josh Allen', position: 'QB', team: 'BUF', tiberScore: 92, tier: 'breakout' as const, nflfastrId: 'sample-qb-1', sleeperId: null },
      { name: 'Patrick Mahomes', position: 'QB', team: 'KC', tiberScore: 88, tier: 'breakout' as const, nflfastrId: 'sample-qb-2', sleeperId: null },
      { name: 'Lamar Jackson', position: 'QB', team: 'BAL', tiberScore: 85, tier: 'stable' as const, nflfastrId: 'sample-qb-3', sleeperId: null },
      { name: 'Jalen Hurts', position: 'QB', team: 'PHI', tiberScore: 82, tier: 'stable' as const, nflfastrId: 'sample-qb-4', sleeperId: null },
      { name: 'Joe Burrow', position: 'QB', team: 'CIN', tiberScore: 79, tier: 'stable' as const, nflfastrId: 'sample-qb-5', sleeperId: null },
    ];
    
    const sampleRBs = [
      { name: 'Christian McCaffrey', position: 'RB', team: 'SF', tiberScore: 90, tier: 'breakout' as const, nflfastrId: 'sample-rb-1', sleeperId: null },
      { name: 'Bijan Robinson', position: 'RB', team: 'ATL', tiberScore: 86, tier: 'stable' as const, nflfastrId: 'sample-rb-2', sleeperId: null },
      { name: 'Saquon Barkley', position: 'RB', team: 'PHI', tiberScore: 83, tier: 'stable' as const, nflfastrId: 'sample-rb-3', sleeperId: null },
      { name: 'Breece Hall', position: 'RB', team: 'NYJ', tiberScore: 80, tier: 'stable' as const, nflfastrId: 'sample-rb-4', sleeperId: null },
      { name: 'Jahmyr Gibbs', position: 'RB', team: 'DET', tiberScore: 77, tier: 'regression' as const, nflfastrId: 'sample-rb-5', sleeperId: null },
    ];

    // Convert to response format
    let playersWithScores = rankedPlayers.map(p => ({
      name: p.name,
      position: p.position,
      team: p.team,
      sleeperId: p.sleeperId,
      tiberScore: p.tiberScore,
      tier: p.tier as 'breakout' | 'stable' | 'regression',
      nflfastrId: p.nflfastrId,
    }));

    // Add sample QB and RB players (temporary until algorithms are built)
    const hasQBs = playersWithScores.some(p => p.position === 'QB');
    const hasRBs = playersWithScores.some(p => p.position === 'RB');
    
    if (!hasQBs) {
      playersWithScores = [...sampleQBs, ...playersWithScores];
    }
    if (!hasRBs) {
      playersWithScores = [...sampleRBs, ...playersWithScores];
    }

    // Sort by TIBER score descending
    playersWithScores.sort((a, b) => b.tiberScore - a.tiberScore);

    // Calculate positional ranks
    const qbRank = new Map<string, number>();
    const rbRank = new Map<string, number>();
    const wrRank = new Map<string, number>();
    const teRank = new Map<string, number>();
    let qbCount = 0;
    let rbCount = 0;
    let wrCount = 0;
    let teCount = 0;

    playersWithScores.forEach(player => {
      if (player.position === 'QB') {
        qbCount++;
        qbRank.set(player.nflfastrId, qbCount);
      } else if (player.position === 'RB') {
        rbCount++;
        rbRank.set(player.nflfastrId, rbCount);
      } else if (player.position === 'WR') {
        wrCount++;
        wrRank.set(player.nflfastrId, wrCount);
      } else if (player.position === 'TE') {
        teCount++;
        teRank.set(player.nflfastrId, teCount);
      }
    });

    // Add positional rank to each player
    const playersWithRanks = playersWithScores.map(player => {
      let positionalRank = 0;
      let tiberRank = '';
      
      if (player.position === 'QB') {
        positionalRank = qbRank.get(player.nflfastrId) || 0;
        tiberRank = `QB${positionalRank}`;
      } else if (player.position === 'RB') {
        positionalRank = rbRank.get(player.nflfastrId) || 0;
        tiberRank = `RB${positionalRank}`;
      } else if (player.position === 'WR') {
        positionalRank = wrRank.get(player.nflfastrId) || 0;
        tiberRank = `WR${positionalRank}`;
      } else if (player.position === 'TE') {
        positionalRank = teRank.get(player.nflfastrId) || 0;
        tiberRank = `TE${positionalRank}`;
      }
      
      return {
        ...player,
        positionalRank,
        tiberRank,
      };
    });

    console.log(`✅ [TIBER Rankings] Ranked ${playersWithRanks.length} players (${qbCount} QBs, ${rbCount} RBs, ${wrCount} WRs, ${teCount} TEs)`);

    res.json({
      success: true,
      data: {
        week,
        season,
        total: playersWithRanks.length,
        qbCount,
        rbCount,
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
      // Transform flat DB record to nested structure to match calculated response
      return res.json({ 
        success: true, 
        data: transformCachedScore(cached[0]),
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
    const mode = (req.query.mode as 'weekly' | 'season') || 'season'; // Data aggregation mode
    const forceRecalc = req.query.force === 'true'; // Force recalculation

    // Check cache first (only for season mode and unless force recalc)
    // Weekly mode always calculates fresh since it's single-week data
    if (!forceRecalc && mode === 'season') {
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
        // Transform flat DB record to nested structure to match calculated response
        const gameLog = await fetchGameLog(nflfastrId, week, season, mode);
        return res.json({ 
          success: true, 
          data: {
            ...transformCachedScore(cached[0]),
            gameLog
          }, 
          source: 'cache',
          mode
        });
      }
    }

    // Calculate if not cached or force recalc or weekly mode
    const calculatedScore = await tiberService.calculateTiberScore(nflfastrId, week, season, mode);
    
    // Save to cache (only for season mode - weekly data is dynamic)
    if (mode === 'season') {
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
    }

    // Fetch game log data
    const gameLog = await fetchGameLog(nflfastrId, week, season, mode);

    // Return the freshly calculated score (not from DB)
    res.json({ 
      success: true, 
      data: {
        nflfastrId,
        week,
        season,
        ...calculatedScore,
        gameLog
      }, 
      source: forceRecalc ? 'recalculated' : (mode === 'weekly' ? 'weekly_calculated' : 'calculated'),
      mode
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

    // Transform cached scores or calculate if not cached
    const [calcA, calcB] = await Promise.all([
      scoreA 
        ? Promise.resolve(transformCachedScore(scoreA)) 
        : tiberService.calculateTiberScore(playerAId, week, season)
            .then(score => ({ nflfastrId: playerAId, week, season, ...score }))
            .catch(() => null),
      scoreB 
        ? Promise.resolve(transformCachedScore(scoreB)) 
        : tiberService.calculateTiberScore(playerBId, week, season)
            .then(score => ({ nflfastrId: playerBId, week, season, ...score }))
            .catch(() => null)
    ]);

    res.json({
      success: true,
      playerA: calcA,
      playerB: calcB,
      recommendation: calcA && calcB ? (calcA.tiberScore > calcB.tiberScore ? 'playerA' : 'playerB') : null,
      scoreDiff: calcA && calcB ? Math.abs(calcA.tiberScore - calcB.tiberScore) : null
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

// Trigger season ratings calculation (calculates averages from weekly scores)
router.post('/calculate-season-ratings', async (req, res) => {
  try {
    const season = parseInt(req.query.season as string) || 2025;

    // Return immediately and run in background
    res.json({ 
      success: true, 
      message: `Season ratings calculation started for ${season}` 
    });

    // Run in background
    tiberService.calculateAllSeasonRatings(season).catch(err => {
      console.error('[TIBER] Season ratings calculation error:', err);
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: 'Failed to start season ratings calculation' 
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

// Sync injury data from SportsDataIO
router.post('/admin/sync-injuries', async (req, res) => {
  try {
    const season = parseInt(req.query.season as string) || 2025;
    const clearFirst = req.query.clearFirst === 'true';

    console.log(`🏥 [Admin] Injury sync requested for ${season} season (clearFirst: ${clearFirst})`);

    // Optionally clear existing injuries first
    if (clearFirst) {
      await injurySyncService.clearSeasonInjuries(season);
    }

    // Sync current injuries
    const result = await injurySyncService.syncCurrentInjuries(season);

    res.json({
      success: true,
      season,
      clearFirst,
      result: {
        synced: result.synced,
        skipped: result.skipped,
        errorCount: result.errors.length,
        errors: result.errors.length > 0 ? result.errors.slice(0, 5) : []
      }
    });

  } catch (error) {
    console.error('❌ [Admin] Injury sync failed:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to sync injuries'
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
