/**
 * Player Identity Map API Routes
 * 
 * Provides endpoints for player identity resolution, migration, and management
 */

import { Router, Request, Response } from 'express';
import { requireAdminAuth } from '../middleware/adminAuth';
import { playerIdentityService } from '../services/PlayerIdentityService';
import { playerIdentityMigration } from '../services/PlayerIdentityMigration';
import { db } from '../infra/db';
import { eq, and, desc } from 'drizzle-orm';
import { datadiveSnapshotPlayerWeek, datadiveSnapshotMeta } from '@shared/schema';

const router = Router();

/**
 * GET /api/player-identity/resolve/:platform/:externalId
 * Resolve external ID to canonical player ID
 */
router.get('/resolve/:platform/:externalId', async (req: Request, res: Response) => {
  try {
    const { platform, externalId } = req.params;
    
    if (!platform || !externalId) {
      return res.status(400).json({
        success: false,
        message: 'Platform and external ID are required'
      });
    }

    const canonicalId = await playerIdentityService.getCanonicalId(
      externalId, 
      platform as any
    );

    if (!canonicalId) {
      return res.status(404).json({
        success: false,
        message: 'Player not found'
      });
    }

    res.json({
      success: true,
      data: {
        canonicalId,
        externalId,
        platform
      }
    });
  } catch (error) {
    console.error('[PlayerIdentityRoutes] Error resolving ID:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/player-identity/player/:id
 * Get complete player identity by any ID (canonical or external)
 */
router.get('/player/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'Player ID is required'
      });
    }

    const player = await playerIdentityService.getByAnyId(id);

    if (!player) {
      return res.status(404).json({
        success: false,
        message: 'Player not found'
      });
    }

    res.json({
      success: true,
      data: player
    });
  } catch (error) {
    console.error('[PlayerIdentityRoutes] Error getting player:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/player-identity/search
 * Search for players by name with optional position filter
 */
router.get('/search', async (req: Request, res: Response) => {
  try {
    const { name, position, limit = 10 } = req.query;
    
    if (!name || typeof name !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Name parameter is required'
      });
    }

    const results = await playerIdentityService.searchByName(
      name,
      position as string
    );

    // Apply limit
    const limitedResults = results.slice(0, parseInt(limit as string));

    res.json({
      success: true,
      data: {
        query: { name, position },
        results: limitedResults,
        totalFound: results.length,
        returned: limitedResults.length
      }
    });
  } catch (error) {
    console.error('[PlayerIdentityRoutes] Error searching players:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/player-identity/player/:id/weeks
 * Get available weeks with data for a player in a given season
 */
router.get('/player/:id/weeks', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const season = parseInt(req.query.season as string) || 2025;
    
    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'Player ID is required'
      });
    }

    // Import db and query weekly_stats for available weeks
    const { db } = await import('../infra/db');
    const { weeklyStats } = await import('@shared/schema');
    const { eq, and } = await import('drizzle-orm');

    // Query distinct weeks where this player has data
    const result = await db
      .select({ week: weeklyStats.week })
      .from(weeklyStats)
      .where(and(
        eq(weeklyStats.playerId, id),
        eq(weeklyStats.season, season)
      ))
      .orderBy(weeklyStats.week);

    const availableWeeks = result.map((r: { week: number }) => r.week);
    const latestWeek = availableWeeks.length > 0 ? Math.max(...availableWeeks) : null;

    res.json({
      success: true,
      data: {
        playerId: id,
        season,
        availableWeeks,
        latestWeek,
        totalWeeks: availableWeeks.length
      }
    });
  } catch (error) {
    console.error('[PlayerIdentityRoutes] Error getting available weeks:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/player-identity/stats
 * Get system statistics and health information
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const stats = await playerIdentityService.getSystemStats();
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('[PlayerIdentityRoutes] Error getting stats:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Admin-only routes
router.use('/admin', requireAdminAuth);

/**
 * POST /api/player-identity/admin/migrate
 * Trigger migration of Sleeper players to Identity Map
 */
router.post('/admin/migrate', async (req: Request, res: Response) => {
  const startTime = Date.now();

  try {
    const { force = false, dryRun = false } = req.body;
    
    console.log(`🔄 [PlayerIdentityRoutes] Migration triggered by admin from ${req.ip}`);
    console.log(`Options: force=${force}, dryRun=${dryRun}`);

    const result = await playerIdentityMigration.runMigration({
      force,
      dryRun
    });

    const duration = Date.now() - startTime;

    res.json({
      success: true,
      message: dryRun ? 'Migration dry run completed' : 'Migration completed successfully',
      data: {
        ...result,
        duration
      }
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('[PlayerIdentityRoutes] Migration failed:', error);
    
    res.status(500).json({
      success: false,
      message: 'Migration failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      duration
    });
  }
});

/**
 * GET /api/player-identity/admin/migration-status
 * Check migration status
 */
router.get('/admin/migration-status', async (req: Request, res: Response) => {
  try {
    const status = await playerIdentityMigration.getMigrationStatus();
    
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    console.error('[PlayerIdentityRoutes] Error getting migration status:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/player-identity/admin/add-mapping
 * Add external ID mapping for a player
 */
router.post('/admin/add-mapping', async (req: Request, res: Response) => {
  try {
    const { canonicalId, externalId, platform, confidence = 1.0, overwrite = false } = req.body;
    
    if (!canonicalId || !externalId || !platform) {
      return res.status(400).json({
        success: false,
        message: 'canonicalId, externalId, and platform are required'
      });
    }

    const success = await playerIdentityService.addIdentityMapping({
      canonicalId,
      externalId,
      platform,
      confidence,
      overwrite
    });

    if (success) {
      res.json({
        success: true,
        message: 'Identity mapping added successfully'
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Failed to add identity mapping'
      });
    }
  } catch (error) {
    console.error('[PlayerIdentityRoutes] Error adding mapping:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/player-identity/admin/create-player
 * Create a new player in the identity map
 */
router.post('/admin/create-player', async (req: Request, res: Response) => {
  try {
    const playerData = req.body;
    
    if (!playerData.canonicalId || !playerData.fullName || !playerData.position) {
      return res.status(400).json({
        success: false,
        message: 'canonicalId, fullName, and position are required'
      });
    }

    const success = await playerIdentityService.createPlayerIdentity(playerData);

    if (success) {
      res.json({
        success: true,
        message: 'Player created successfully',
        data: { canonicalId: playerData.canonicalId }
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Failed to create player'
      });
    }
  } catch (error) {
    console.error('[PlayerIdentityRoutes] Error creating player:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/player-identity/player/:playerKey/week-series
 * Returns gap-filled week-by-week usage metrics for a player
 * Missing weeks are included with missing=true and null metrics (NULL-honest)
 */
router.get('/player/:playerKey/week-series', async (req: Request, res: Response) => {
  try {
    const { playerKey } = req.params;
    const season = parseInt(req.query.season as string) || 2025;
    const metricSet = (req.query.metricSet as string) || 'usage';

    if (!playerKey) {
      return res.status(400).json({
        success: false,
        message: 'playerKey is required'
      });
    }

    const latestSnapshot = await db
      .select({ id: datadiveSnapshotMeta.id, week: datadiveSnapshotMeta.week })
      .from(datadiveSnapshotMeta)
      .where(and(
        eq(datadiveSnapshotMeta.season, season),
        eq(datadiveSnapshotMeta.isOfficial, true)
      ))
      .orderBy(desc(datadiveSnapshotMeta.week))
      .limit(1);

    const maxWeek = latestSnapshot[0]?.week || 18;

    const playerWeeks = await db
      .select({
        week: datadiveSnapshotPlayerWeek.week,
        snapShare: datadiveSnapshotPlayerWeek.snapShare,
        routes: datadiveSnapshotPlayerWeek.routes,
        targets: datadiveSnapshotPlayerWeek.targets,
        rushAttempts: datadiveSnapshotPlayerWeek.rushAttempts,
        airYards: datadiveSnapshotPlayerWeek.airYards,
        position: datadiveSnapshotPlayerWeek.position,
        playerName: datadiveSnapshotPlayerWeek.playerName,
        teamId: datadiveSnapshotPlayerWeek.teamId,
      })
      .from(datadiveSnapshotPlayerWeek)
      .where(and(
        eq(datadiveSnapshotPlayerWeek.playerId, playerKey),
        eq(datadiveSnapshotPlayerWeek.season, season)
      ))
      .orderBy(datadiveSnapshotPlayerWeek.week);

    const weekMap = new Map<number, typeof playerWeeks[0]>();
    for (const pw of playerWeeks) {
      weekMap.set(pw.week, pw);
    }

    const availableWeeks = playerWeeks.map(pw => pw.week);
    const position = playerWeeks[0]?.position || null;
    const playerName = playerWeeks[0]?.playerName || null;
    const teamId = playerWeeks[0]?.teamId || null;

    const weeks: Array<{
      week: number;
      missing: boolean;
      snapPct: number | null;
      routes: number | null;
      targets: number | null;
      carries: number | null;
      airYards: number | null;
    }> = [];

    for (let w = 1; w <= maxWeek; w++) {
      const data = weekMap.get(w);
      if (data) {
        weeks.push({
          week: w,
          missing: false,
          snapPct: data.snapShare !== null ? Math.round(data.snapShare * 100) : null,
          routes: data.routes,
          targets: data.targets,
          carries: data.rushAttempts,
          airYards: data.airYards,
        });
      } else {
        weeks.push({
          week: w,
          missing: true,
          snapPct: null,
          routes: null,
          targets: null,
          carries: null,
          airYards: null,
        });
      }
    }

    res.json({
      success: true,
      data: {
        playerKey,
        playerName,
        position,
        teamId,
        season,
        maxWeek,
        metricSet,
        weeks,
        availableWeeks,
      }
    });
  } catch (error) {
    console.error('[PlayerIdentityRoutes] Error fetching week series:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;