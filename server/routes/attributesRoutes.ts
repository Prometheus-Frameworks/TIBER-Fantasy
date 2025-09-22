import { Router } from 'express';
import { z } from 'zod';
import { attributesService } from '../services/AttributesService';
import { adminSecurity } from '../middleware/security';

const router = Router();

// Query schema for weekly attributes
const WeeklyAttributesQuerySchema = z.object({
  season: z.coerce.number().min(2020).max(2030).default(2025),
  week: z.coerce.number().min(1).max(18).default(3),
  position: z.enum(['QB', 'RB', 'WR', 'TE', 'ALL']).default('ALL'),
  team: z.string().optional(),
  limit: z.coerce.number().min(1).max(500).default(100)
});

// Player attributes query schema
const PlayerAttributesQuerySchema = z.object({
  season: z.coerce.number().min(2020).max(2030).default(2025),
  week: z.coerce.number().min(1).max(18).optional()
});

/**
 * GET /api/attributes/weekly
 * Get weekly attributes for all players in a specific week
 */
router.get('/weekly', async (req, res) => {
  try {
    const query = WeeklyAttributesQuerySchema.parse(req.query);
    
    const attributes = await attributesService.getWeeklyAttributes(
      query.season,
      query.week,
      query.position === 'ALL' ? undefined : query.position,
      query.team,
      query.limit
    );

    const stats = await attributesService.getProcessingStats(query.season, query.week);

    res.json({
      success: true,
      data: {
        season: query.season,
        week: query.week,
        position: query.position,
        team: query.team || 'ALL',
        attributes,
        stats,
        total_players: attributes.length,
        showing: attributes.length,
        limit: query.limit
      },
      generated_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('[AttributesRoutes] Error in /weekly:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch weekly attributes',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/attributes/player/:otc_id
 * Get attributes for a specific player
 */
router.get('/player/:otc_id', async (req, res) => {
  try {
    const { otc_id } = req.params;
    const query = PlayerAttributesQuerySchema.parse(req.query);

    if (query.week) {
      // Get specific week data
      const attributes = await attributesService.getPlayerWeeklyAttributes(
        otc_id,
        query.season,
        query.week
      );

      res.json({
        success: true,
        data: {
          player_id: otc_id,
          season: query.season,
          week: query.week,
          attributes
        },
        generated_at: new Date().toISOString()
      });
    } else {
      // Get season-long data
      const attributes = await attributesService.getPlayerSeasonAttributes(
        otc_id,
        query.season
      );

      res.json({
        success: true,
        data: {
          player_id: otc_id,
          season: query.season,
          attributes,
          total_weeks: attributes.length
        },
        generated_at: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error(`[AttributesRoutes] Error in /player/${req.params.otc_id}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch player attributes',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/attributes/collect/:season/:week
 * Trigger attribute collection for a specific week (admin endpoint)
 * SECURED: Requires admin authentication and rate limiting
 */
router.post('/collect/:season/:week', 
  ...adminSecurity({
    rateLimitWindow: 5 * 60 * 1000, // 5 minutes
    rateLimitMax: 3 // Maximum 3 collection requests per 5 minutes
  }),
  async (req, res) => {
  try {
    const season = parseInt(req.params.season);
    const week = parseInt(req.params.week);

    if (!season || !week || season < 2020 || season > 2030 || week < 1 || week > 18) {
      return res.status(400).json({
        success: false,
        error: 'Invalid season or week parameters'
      });
    }

    console.log(`[AttributesRoutes] Starting collection for ${season} Week ${week}`);
    
    const result = await attributesService.collectWeeklyAttributes(season, week);

    if (result.success) {
      res.json({
        success: true,
        data: {
          season,
          week,
          processed_players: result.processedPlayers,
          errors: result.errors,
          message: `Successfully collected attributes for ${result.processedPlayers} players`
        },
        generated_at: new Date().toISOString()
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Attribute collection completed with errors',
        data: {
          season,
          week,
          processed_players: result.processedPlayers,
          errors: result.errors
        }
      });
    }
  } catch (error) {
    console.error('[AttributesRoutes] Error in /collect:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start attribute collection',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/attributes/stats/:season/:week
 * Get processing statistics for a specific week
 */
router.get('/stats/:season/:week', async (req, res) => {
  try {
    const season = parseInt(req.params.season);
    const week = parseInt(req.params.week);

    if (!season || !week || season < 2020 || season > 2030 || week < 1 || week > 18) {
      return res.status(400).json({
        success: false,
        error: 'Invalid season or week parameters'
      });
    }

    const stats = await attributesService.getProcessingStats(season, week);

    res.json({
      success: true,
      data: {
        season,
        week,
        ...stats
      },
      generated_at: new Date().toISOString()
    });
  } catch (error) {
    console.error(`[AttributesRoutes] Error in /stats:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch processing stats',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;