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

export default router;
