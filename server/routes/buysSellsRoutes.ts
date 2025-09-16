import { Router } from 'express';
import { z } from 'zod';
import { eq, and, desc } from 'drizzle-orm';
import { db } from '../db';
import { buysSells, playerWeekFacts } from '@shared/schema';
import { 
  computeBuysSellsForWeek, 
  computeBuysSellsForAllPositions,
  SCORE_CONFIG
} from '../compute';
import { requireAdminAuth } from '../middleware/adminAuth';
import { getCurrentNFLWeek } from '../cron/weeklyUpdate';

const router = Router();

// Get buys/sells recommendations with filters
router.get('/recommendations', async (req, res) => {
  try {
    const querySchema = z.object({
      season: z.coerce.number().default(2025),
      week: z.coerce.number().min(1).max(18).optional(),
      position: z.string().optional(),
      format: z.enum(['redraft', 'dynasty']).default('redraft'),
      ppr: z.enum(['ppr', 'half', 'standard']).default('half'),
      verdict: z.enum(['BUY_HARD', 'BUY', 'WATCH_BUY', 'HOLD', 'WATCH_SELL', 'SELL', 'SELL_HARD']).optional(),
      limit: z.coerce.number().min(1).max(200).default(50),
    });

    const filters = querySchema.parse(req.query);

    // Default to current NFL week if not specified
    const defaultWeek = filters.week || parseInt(getCurrentNFLWeek());
    
    // Normalize position to uppercase for database query
    const normalizedPosition = filters.position?.toUpperCase();

    // Build conditions array, filtering out undefined values
    const conditions = [
      eq(buysSells.season, filters.season),
      eq(buysSells.format, filters.format),
      eq(buysSells.ppr, filters.ppr),
      eq(buysSells.week, defaultWeek),
      normalizedPosition && normalizedPosition.length > 0 && eq(buysSells.position, normalizedPosition),
      filters.verdict && eq(buysSells.verdict, filters.verdict)
    ].filter(Boolean);

    let query = db
      .select()
      .from(buysSells)
      .where(and(...conditions))
      .orderBy(desc(buysSells.verdictScore))
      .limit(filters.limit);

    const recommendations = await query;

    res.json({
      ok: true,
      data: recommendations,
      meta: {
        count: recommendations.length,
        filters: {
          ...filters,
          week: defaultWeek,
          position: normalizedPosition
        }
      }
    });
  } catch (error) {
    console.error('Error fetching buys/sells recommendations:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to fetch recommendations'
    });
  }
});

// Get specific player's trade advice
router.get('/player/:playerId', async (req, res) => {
  try {
    const querySchema = z.object({
      season: z.coerce.number().default(2025),
      week: z.coerce.number().min(1).max(18).optional(),
      format: z.enum(['redraft', 'dynasty']).default('redraft'),
      ppr: z.enum(['ppr', 'half', 'standard']).default('half'),
    });

    const filters = querySchema.parse(req.query);
    const { playerId } = req.params;
    
    // Default to current NFL week if not specified
    const defaultWeek = filters.week || parseInt(getCurrentNFLWeek());

    // Build conditions array, filtering out undefined values
    const conditions = [
      eq(buysSells.playerId, playerId),
      eq(buysSells.season, filters.season),
      eq(buysSells.format, filters.format),
      eq(buysSells.ppr, filters.ppr),
      eq(buysSells.week, defaultWeek)
    ].filter(Boolean);

    const playerAdvice = await db
      .select()
      .from(buysSells)
      .where(and(...conditions))
      .orderBy(desc(buysSells.week))
      .limit(10);

    if (playerAdvice.length === 0) {
      return res.status(404).json({
        ok: false,
        error: 'No trade advice found for this player'
      });
    }

    res.json({
      ok: true,
      data: playerAdvice,
      meta: {
        playerId,
        latestAdvice: playerAdvice[0],
        historyCount: playerAdvice.length
      }
    });
  } catch (error) {
    console.error('Error fetching player trade advice:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to fetch player advice'
    });
  }
});

// Compute buys/sells for a specific week/position (admin/debug endpoint)
router.post('/compute', requireAdminAuth, async (req, res) => {
  try {
    const bodySchema = z.object({
      week: z.number().min(1).max(18).optional(),
      position: z.string().optional(),
      format: z.enum(['redraft', 'dynasty']).default('redraft'),
      ppr: z.enum(['ppr', 'half', 'standard']).default('half'),
      season: z.number().default(2025),
    });

    const { week, position, format, ppr, season } = bodySchema.parse(req.body);
    
    // Default to current NFL week if not specified
    const targetWeek = week || parseInt(getCurrentNFLWeek());
    
    // Normalize position to uppercase for consistency
    const normalizedPosition = position?.toUpperCase();

    if (normalizedPosition && normalizedPosition.length > 0) {
      // Compute for specific position
      const results = await computeBuysSellsForWeek(targetWeek, normalizedPosition, format, ppr, season);
      res.json({
        ok: true,
        message: `Computed buys/sells for ${normalizedPosition} Week ${targetWeek}`,
        data: results,
        meta: {
          week: targetWeek,
          position: normalizedPosition,
          format,
          ppr,
          season,
          resultsCount: results?.length || 0
        }
      });
    } else {
      // Compute for all positions
      await computeBuysSellsForAllPositions(targetWeek, season);
      res.json({
        ok: true,
        message: `Computed buys/sells for all positions Week ${targetWeek}`,
        meta: {
          week: targetWeek,
          season,
          allPositions: true
        }
      });
    }
  } catch (error) {
    console.error('Error computing buys/sells:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to compute recommendations'
    });
  }
});

// Get top buys and sells for quick overview
router.get('/top-picks', async (req, res) => {
  try {
    const querySchema = z.object({
      season: z.coerce.number().default(2025),
      week: z.coerce.number().min(1).max(18).optional(),
      format: z.enum(['redraft', 'dynasty']).default('redraft'),
      ppr: z.enum(['ppr', 'half', 'standard']).default('half'),
      limit: z.coerce.number().min(1).max(50).default(10),
    });

    const filters = querySchema.parse(req.query);
    
    // Default to current NFL week if not specified
    const defaultWeek = filters.week || parseInt(getCurrentNFLWeek());

    // Build conditions array, filtering out undefined values
    const conditions = [
      eq(buysSells.season, filters.season),
      eq(buysSells.format, filters.format),
      eq(buysSells.ppr, filters.ppr),
      eq(buysSells.week, defaultWeek)
    ].filter(Boolean);

    const [topBuys, topSells] = await Promise.all([
      // Top buys (highest verdict scores)
      db.select()
        .from(buysSells)
        .where(and(...conditions))
        .orderBy(desc(buysSells.verdictScore))
        .limit(filters.limit),
      
      // Top sells (lowest verdict scores)
      db.select()
        .from(buysSells)
        .where(and(...conditions))
        .orderBy(buysSells.verdictScore)
        .limit(filters.limit)
    ]);

    res.json({
      ok: true,
      data: {
        topBuys: topBuys.filter(rec => rec.verdict.includes('BUY')),
        topSells: topSells.filter(rec => rec.verdict.includes('SELL')),
      },
      meta: {
        filters: {
          ...filters,
          week: defaultWeek
        },
        buyCount: topBuys.length,
        sellCount: topSells.length
      }
    });
  } catch (error) {
    console.error('Error fetching top picks:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to fetch top picks'
    });
  }
});

// Get configuration and algorithm info
router.get('/config', (req, res) => {
  res.json({
    ok: true,
    data: {
      algorithm: 'Buys/Sells Trade Advice Model v1.1',
      scoreConfig: SCORE_CONFIG,
      supportedFormats: ['redraft', 'dynasty'],
      supportedPpr: ['ppr', 'half', 'standard'],
      verdictLevels: ['BUY_HARD', 'BUY', 'WATCH_BUY', 'HOLD', 'WATCH_SELL', 'SELL', 'SELL_HARD'],
      description: 'Generates trade recommendations based on ECR gaps, player signals, momentum, and risk factors'
    }
  });
});

export default router;