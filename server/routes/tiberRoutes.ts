import { Router } from 'express';
import { tiberService } from '../services/tiberService';
import { db } from '../db';
import { tiberScores } from '../../shared/schema';
import { eq, and, desc, sql } from 'drizzle-orm';

const router = Router();

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

// Health check
router.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'TIBER v1 MVP',
    description: 'Tactical Index for Breakout Efficiency and Regression'
  });
});

export default router;
