/**
 * OVR (Overall Rating) API Routes - Madden-style 1-99 Player Ratings
 * 
 * Provides unified player ratings that aggregate all ranking inputs:
 * - GET /api/ratings/ovr - Get OVR ratings by position and format
 * - GET /api/ratings/ovr/:player_id - Get single player OVR rating
 * - GET /api/ratings/ovr/batch - Batch OVR calculation
 */

import { Router, Request, Response } from 'express';
import { ovrService } from '../services/ovrService';
import { z } from 'zod';

const router = Router();

// Query schema for OVR ratings
const OVRQuerySchema = z.object({
  format: z.enum(['dynasty', 'redraft']).default('redraft'),
  position: z.enum(['QB', 'RB', 'WR', 'TE', 'ALL']).default('ALL'),
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
  min_ovr: z.coerce.number().min(1).max(99).optional(),
  max_ovr: z.coerce.number().min(1).max(99).optional()
});

// Single player schema
const SinglePlayerSchema = z.object({
  player_id: z.string(),
  name: z.string(),
  position: z.enum(['QB', 'RB', 'WR', 'TE']),
  team: z.string(),
  age: z.number().optional()
});

// Batch calculation schema
const BatchPlayerSchema = z.array(SinglePlayerSchema).max(50);

/**
 * GET /api/ovr/stats/distribution
 * Get OVR distribution statistics for a position/format
 */
router.get('/stats/distribution', async (req: Request, res: Response) => {
  try {
    const { format = 'redraft', position = 'QB' } = req.query;
    
    res.type('application/json');
    res.json({
      format,
      position,
      distribution: {
        mean: 72.3,
        median: 74.0,
        stddev: 12.1,
        percentiles: {
          p90: 87,
          p75: 81,
          p50: 74,
          p25: 67,
          p10: 58
        }
      },
      sample_size: 50,
      last_updated: new Date().toISOString()
    });
  } catch (error) {
    console.error('[OVR] Distribution error:', error);
    res.status(500).json({ error: 'Failed to get distribution stats' });
  }
});

/**
 * GET /api/ovr
 * Get OVR ratings with filtering and pagination
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const query = OVRQuerySchema.parse(req.query);
    
    // Mock player data for testing (replace with actual player pool)
    const mockPlayers = [
      { player_id: 'josh_allen', name: 'Josh Allen', position: 'QB' as const, team: 'BUF', age: 28 },
      { player_id: 'lamar_jackson', name: 'Lamar Jackson', position: 'QB' as const, team: 'BAL', age: 27 },
      { player_id: 'christian_mccaffrey', name: 'Christian McCaffrey', position: 'RB' as const, team: 'SF', age: 28 },
      { player_id: 'saquon_barkley', name: 'Saquon Barkley', position: 'RB' as const, team: 'PHI', age: 27 },
      { player_id: 'tyreek_hill', name: 'Tyreek Hill', position: 'WR' as const, team: 'MIA', age: 30 },
      { player_id: 'stefon_diggs', name: 'Stefon Diggs', position: 'WR' as const, team: 'HOU', age: 31 },
      { player_id: 'travis_kelce', name: 'Travis Kelce', position: 'TE' as const, team: 'KC', age: 35 },
      { player_id: 'sam_laporta', name: 'Sam LaPorta', position: 'TE' as const, team: 'DET', age: 25 }
    ];
    
    // Filter by position if specified
    let filteredPlayers = mockPlayers;
    if (query.position !== 'ALL') {
      filteredPlayers = mockPlayers.filter(p => p.position === query.position);
    }
    
    // Calculate OVR ratings
    const ovrResults = await ovrService.calculateBatchOVR(filteredPlayers, query.format);
    
    // Apply filters
    let filteredResults = ovrResults;
    if (query.min_ovr) {
      filteredResults = filteredResults.filter(r => r.ovr >= query.min_ovr!);
    }
    if (query.max_ovr) {
      filteredResults = filteredResults.filter(r => r.ovr <= query.max_ovr!);
    }
    
    // Sort by OVR descending
    filteredResults.sort((a, b) => b.ovr - a.ovr);
    
    // Apply pagination
    const paginatedResults = filteredResults.slice(query.offset, query.offset + query.limit);
    
    res.type('application/json');
    res.json({
      success: true,
      data: {
        format: query.format,
        position: query.position,
        total_players: filteredResults.length,
        showing: paginatedResults.length,
        offset: query.offset,
        limit: query.limit,
        players: paginatedResults
      },
      generated_at: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('[OVR API] Error getting OVR ratings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to calculate OVR ratings',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/ratings/ovr/:player_id
 * Get OVR rating for a single player
 */
router.get('/:player_id', async (req: Request, res: Response) => {
  try {
    const { player_id } = req.params;
    const query = z.object({
      format: z.enum(['dynasty', 'redraft']).default('redraft'),
      include_breakdown: z.enum(['true', 'false']).default('false')
    }).parse(req.query);
    
    // Mock single player lookup (replace with actual player service)
    const mockPlayer = {
      player_id,
      name: 'Mock Player',
      position: 'WR' as const,
      team: 'SF',
      age: 26
    };
    
    const ovrResult = await ovrService.calculateOVR(mockPlayer, query.format);
    
    // Optionally include detailed breakdown
    const response: any = {
      success: true,
      data: ovrResult,
      generated_at: new Date().toISOString()
    };
    
    if (query.include_breakdown === 'true') {
      response.data.breakdown = {
        input_sources: Object.keys(ovrResult.inputs).filter(key => ovrResult.inputs[key as keyof typeof ovrResult.inputs] != null),
        confidence_factors: ovrResult.confidence,
        weight_distribution: ovrResult.weights,
        percentile_context: `${ovrResult.percentile.toFixed(1)}th percentile among ${ovrResult.position}s`
      };
    }
    
    res.json(response);
    
  } catch (error) {
    console.error(`[OVR API] Error getting OVR for player ${req.params.player_id}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to calculate player OVR',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/ratings/ovr/batch
 * Calculate OVR ratings for multiple players
 */
router.post('/batch', async (req: Request, res: Response) => {
  try {
    const { players, format = 'redraft' } = req.body;
    
    // Validate input
    const validatedPlayers = BatchPlayerSchema.parse(players);
    const validatedFormat = z.enum(['dynasty', 'redraft']).parse(format);
    
    // Calculate batch OVR ratings
    const ovrResults = await ovrService.calculateBatchOVR(validatedPlayers, validatedFormat);
    
    res.json({
      success: true,
      data: {
        format: validatedFormat,
        total_players: ovrResults.length,
        players: ovrResults,
        summary: {
          average_ovr: Math.round(ovrResults.reduce((sum, r) => sum + r.ovr, 0) / ovrResults.length),
          tier_distribution: ovrResults.reduce((dist, r) => {
            dist[r.tier] = (dist[r.tier] || 0) + 1;
            return dist;
          }, {} as Record<string, number>),
          confidence_stats: {
            average: Math.round(ovrResults.reduce((sum, r) => sum + r.confidence.overall, 0) / ovrResults.length * 100) / 100,
            high_confidence: ovrResults.filter(r => r.confidence.overall >= 0.8).length,
            low_confidence: ovrResults.filter(r => r.confidence.overall < 0.5).length
          }
        }
      },
      generated_at: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('[OVR API] Error in batch calculation:', error);
    res.status(400).json({
      success: false,
      error: 'Invalid request for batch OVR calculation',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/ratings/ovr/stats/distribution
 * Get OVR distribution statistics by position and format
 */
router.get('/stats/distribution', async (req: Request, res: Response) => {
  try {
    const query = z.object({
      format: z.enum(['dynasty', 'redraft']).default('redraft'),
      position: z.enum(['QB', 'RB', 'WR', 'TE']).optional()
    }).parse(req.query);
    
    // Mock distribution data (replace with actual calculations)
    const mockDistribution = {
      format: query.format,
      position: query.position || 'ALL',
      total_players: 250,
      ovr_ranges: {
        '90-99 (Elite)': 12,
        '80-89 (Star)': 35,
        '70-79 (Starter)': 78,
        '60-69 (Backup)': 85,
        '50-59 (Bench)': 40
      },
      percentiles: {
        p99: 95,
        p95: 88,
        p90: 84,
        p75: 78,
        p50: 72,
        p25: 66,
        p10: 60
      },
      confidence_metrics: {
        average_confidence: 0.76,
        sources_distribution: {
          fusion: 0.85,
          ratings_engine: 0.72,
          compass: 0.68,
          oasis_environment: 0.91
        }
      }
    };
    
    res.json({
      success: true,
      data: mockDistribution,
      generated_at: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('[OVR API] Error getting distribution stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get OVR distribution statistics',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;