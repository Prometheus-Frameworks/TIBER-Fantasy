/**
 * Rookie API Routes
 * RESTful endpoints for position-based rookie data access
 */

import { Router } from 'express';
import { rookieStorageService } from '../services/rookieStorageService';

const router = Router();

/**
 * GET /api/rookies
 * Get all rookies across all positions
 */
router.get('/', async (req, res) => {
  try {
    console.log('🏈 Fetching all rookie players...');
    
    const allRookies = rookieStorageService.getAllRookies();
    const stats = rookieStorageService.getStorageStats();
    
    res.json({
      success: true,
      rookies: allRookies,
      total_count: allRookies.length,
      position_breakdown: stats,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Error fetching all rookies:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch rookie data',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/rookies/position/:position
 * Get rookies by specific position (QB, RB, WR, TE)
 */
router.get('/position/:position', async (req, res) => {
  try {
    const position = req.params.position.toUpperCase() as 'QB' | 'RB' | 'WR' | 'TE';
    
    if (!['QB', 'RB', 'WR', 'TE'].includes(position)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid position',
        valid_positions: ['QB', 'RB', 'WR', 'TE']
      });
    }
    
    console.log(`🏈 Fetching ${position} rookies...`);
    
    const rookies = rookieStorageService.getRookiesByPosition(position);
    const topRookies = rookieStorageService.getTopRookiesByPosition(position, 20);
    
    res.json({
      success: true,
      position,
      rookies: rookies,
      top_rookies: topRookies,
      count: rookies.length,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error(`❌ Error fetching ${req.params.position} rookies:`, error);
    res.status(500).json({
      success: false,
      error: `Failed to fetch ${req.params.position} rookie data`,
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/rookies/:position
 * Get rookies by specific position (QB, RB, WR, TE)
 */
router.get('/:position', async (req, res) => {
  try {
    const position = req.params.position.toUpperCase() as 'QB' | 'RB' | 'WR' | 'TE';
    
    if (!['QB', 'RB', 'WR', 'TE'].includes(position)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid position',
        valid_positions: ['QB', 'RB', 'WR', 'TE']
      });
    }
    
    console.log(`🏈 Fetching ${position} rookies...`);
    
    const rookies = rookieStorageService.getRookiesByPosition(position);
    const topRookies = rookieStorageService.getTopRookiesByPosition(position, 20);
    
    res.json({
      success: true,
      position,
      rookies: rookies,
      top_rookies: topRookies,
      count: rookies.length,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error(`❌ Error fetching ${req.params.position} rookies:`, error);
    res.status(500).json({
      success: false,
      error: `Failed to fetch ${req.params.position} rookie data`,
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/rookies/:position/top/:limit
 * Get top N rookies by position (sorted by ADP)
 */
router.get('/:position/top/:limit', async (req, res) => {
  try {
    const position = req.params.position.toUpperCase() as 'QB' | 'RB' | 'WR' | 'TE';
    const limit = parseInt(req.params.limit);
    
    if (!['QB', 'RB', 'WR', 'TE'].includes(position)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid position',
        valid_positions: ['QB', 'RB', 'WR', 'TE']
      });
    }
    
    if (isNaN(limit) || limit < 1 || limit > 50) {
      return res.status(400).json({
        success: false,
        error: 'Invalid limit. Must be between 1 and 50.'
      });
    }
    
    console.log(`🏈 Fetching top ${limit} ${position} rookies...`);
    
    const topRookies = rookieStorageService.getTopRookiesByPosition(position, limit);
    
    res.json({
      success: true,
      position,
      limit,
      rookies: topRookies,
      count: topRookies.length,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error(`❌ Error fetching top ${req.params.position} rookies:`, error);
    res.status(500).json({
      success: false,
      error: `Failed to fetch top ${req.params.position} rookie data`,
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/rookies/draft-capital/:position?
 * Get rookies with draft capital analysis
 */
router.get('/draft-capital/:position?', async (req, res) => {
  try {
    const position = req.params.position?.toUpperCase() as 'QB' | 'RB' | 'WR' | 'TE' | undefined;
    
    if (position && !['QB', 'RB', 'WR', 'TE'].includes(position)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid position',
        valid_positions: ['QB', 'RB', 'WR', 'TE']
      });
    }
    
    console.log(`🏈 Fetching rookies with draft capital ${position ? `for ${position}` : 'across all positions'}...`);
    
    const rookiesWithDraftCapital = rookieStorageService.getRookiesWithDraftCapital(position);
    
    // Group by draft capital tier
    const byTier = rookiesWithDraftCapital.reduce((acc, rookie) => {
      const tier = rookie.draft_capital_tier || 'UDFA';
      if (!acc[tier]) acc[tier] = [];
      acc[tier].push(rookie);
      return acc;
    }, {} as Record<string, any[]>);
    
    res.json({
      success: true,
      position: position || 'ALL',
      rookies: rookiesWithDraftCapital,
      by_draft_tier: byTier,
      count: rookiesWithDraftCapital.length,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Error fetching rookies with draft capital:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch rookie draft capital data',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/rookies/stats/summary
 * Get rookie storage statistics
 */
router.get('/stats/summary', async (req, res) => {
  try {
    console.log('📊 Fetching rookie storage statistics...');
    
    const stats = rookieStorageService.getStorageStats();
    const allRookies = rookieStorageService.getAllRookies();
    
    // Calculate additional statistics
    const totalWithADP = allRookies.filter(r => r.adp).length;
    const avgADPAll = allRookies
      .filter(r => r.adp)
      .reduce((sum, r) => sum + r.adp!, 0) / totalWithADP;
    
    res.json({
      success: true,
      summary: {
        total_rookies: allRookies.length,
        rookies_with_adp: totalWithADP,
        average_adp_overall: Math.round(avgADPAll * 10) / 10,
        position_breakdown: stats
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Error fetching rookie statistics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch rookie statistics',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;