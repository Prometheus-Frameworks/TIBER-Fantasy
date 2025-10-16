/**
 * EPA Sanity Check API Routes
 * Endpoints for validating our EPA calculations against external benchmarks
 */

import { Router } from 'express';
import { epaSanityCheckService } from '../services/epaSanityCheck';

const router = Router();

/**
 * Admin: Seed Ben Baldwin's reference data
 * POST /api/sanity-check/seed-baldwin
 */
router.post('/seed-baldwin', async (req, res) => {
  try {
    await epaSanityCheckService.seedBaldwinReferenceData();
    
    res.json({
      success: true,
      message: 'Ben Baldwin reference data seeded successfully',
      count: 34,
    });
  } catch (error) {
    console.error('❌ [EPA Sanity] Seed failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to seed reference data',
    });
  }
});

/**
 * Get Ben Baldwin's reference data for all QBs
 * GET /api/sanity-check/baldwin-reference
 */
router.get('/baldwin-reference', async (req, res) => {
  try {
    const season = parseInt(req.query.season as string) || 2025;
    const data = await epaSanityCheckService.getAllBaldwinReference(season);
    
    res.json({
      success: true,
      data,
      meta: {
        season,
        count: data.length,
        source: 'ben_baldwin',
      },
    });
  } catch (error) {
    console.error('❌ [EPA Sanity] Get reference failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve reference data',
    });
  }
});

/**
 * Compare specific QBs: Our data vs Baldwin
 * GET /api/sanity-check/compare
 * Query params: players (comma-separated names)
 */
router.get('/compare', async (req, res) => {
  try {
    const playerNames = (req.query.players as string)?.split(',') || [];
    
    if (playerNames.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Please provide player names via ?players=J.Allen,J.Flacco',
      });
    }
    
    // For now, just return the Baldwin reference data
    // We'll add our calculations in the next task
    const allReference = await epaSanityCheckService.getAllBaldwinReference();
    const filtered = allReference.filter((qb: any) =>
      playerNames.some(name => 
        qb.playerName.toLowerCase().includes(name.toLowerCase()) ||
        qb.playerId?.toLowerCase().includes(name.toLowerCase())
      )
    );
    
    res.json({
      success: true,
      data: {
        players: filtered,
        comparison: {
          message: 'Full comparison with Tiber adjusted EPA coming soon',
        },
      },
      meta: {
        requested: playerNames,
        found: filtered.length,
      },
    });
  } catch (error) {
    console.error('❌ [EPA Sanity] Compare failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to compare QB data',
    });
  }
});

/**
 * POST /api/sanity-check/calculate-context
 * Calculate QB context metrics from NFLfastR play-by-play data
 */
router.post('/calculate-context', async (req, res) => {
  try {
    const { season = 2025 } = req.body;
    
    console.log(`🔬 [API] Calculating QB context metrics for ${season}...`);
    
    // Call Python EPA processor
    const result = await epaSanityCheckService.calculateQbContextMetrics(season);
    
    if (result.error) {
      return res.status(500).json({ 
        success: false, 
        error: result.error 
      });
    }
    
    // Store in database
    await epaSanityCheckService.storeQbContextMetrics(result.qb_context);
    
    res.json({
      success: true,
      data: {
        season: result.season,
        qbCount: result.qb_context.length,
        generatedAt: result.generated_at,
      },
    });
  } catch (error: any) {
    console.error('❌ [API] Context calculation failed:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * POST /api/sanity-check/calculate-tiber-epa
 * Calculate Tiber's adjusted EPA using context metrics
 */
router.post('/calculate-tiber-epa', async (req, res) => {
  try {
    const { season = 2025 } = req.body;
    
    console.log(`📊 [API] Calculating Tiber adjusted EPA for ${season}...`);
    
    await epaSanityCheckService.calculateTiberAdjustedEpa(season);
    
    res.json({
      success: true,
      message: `Calculated Tiber adjusted EPA for ${season}`,
    });
  } catch (error: any) {
    console.error('❌ [API] Tiber EPA calculation failed:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * GET /api/sanity-check/compare-epa
 * Compare Tiber's adjusted EPA with Ben Baldwin's reference
 */
router.get('/compare-epa', async (req, res) => {
  try {
    const season = parseInt(req.query.season as string) || 2025;
    
    console.log(`🔬 [API] Comparing Tiber vs Baldwin for ${season}...`);
    
    const result = await epaSanityCheckService.compareWithBaldwin(season);
    const { comparisons, metadata } = result;
    
    const withDifference = comparisons.filter(c => c.difference !== null);
    const avgDifference = withDifference.length > 0
      ? withDifference.reduce((sum, c) => sum + Math.abs(c.difference!), 0) / withDifference.length
      : 0;
    
    res.json({
      success: true,
      data: {
        season,
        comparisons,
        summary: {
          total: comparisons.length,
          withTiberData: comparisons.filter(c => c.tiber !== null).length,
          avgDifference,
        },
        dataQuality: {
          tiberLastCalculated: metadata.tiberLastCalculated,
          contextLastCalculated: metadata.contextLastCalculated,
          hasDuplicates: metadata.hasDuplicates,
          isStale: metadata.tiberLastCalculated 
            ? (Date.now() - metadata.tiberLastCalculated.getTime()) > 24 * 60 * 60 * 1000 
            : true,
        },
      },
    });
  } catch (error: any) {
    console.error('❌ [API] EPA comparison failed:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

export default router;
