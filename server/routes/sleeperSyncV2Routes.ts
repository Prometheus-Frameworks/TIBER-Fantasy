/**
 * Sleeper Sync V2 Routes
 * Manual endpoints for roster synchronization
 * 
 * POST /api/sleeper/sync/run - Run sync for a league
 * GET  /api/sleeper/sync/status - Get sync status for a league
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { syncLeague, getSyncStatus, getUnresolvedPlayerCount } from '../services/sleeperSyncV2';

const router = Router();

// Validation schemas
const syncRunSchema = z.object({
  leagueId: z.string().min(1, 'leagueId is required'),
  force: z.boolean().optional().default(false),
  week: z.number().int().positive().optional(),
  season: z.number().int().min(2020).max(2030).optional()
});

/**
 * POST /api/sleeper/sync/run
 * Run roster sync for a Sleeper league
 * 
 * Body:
 *   leagueId: string (required) - Sleeper league ID
 *   force: boolean (optional) - Force sync even if no changes detected
 *   week: number (optional) - Current week
 *   season: number (optional) - Current season
 */
router.post('/run', async (req: Request, res: Response) => {
  try {
    const parseResult = syncRunSchema.safeParse(req.body);
    
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: parseResult.error.errors
      });
    }
    
    const { leagueId, force, week, season } = parseResult.data;
    
    console.log(`[SleeperSyncV2Routes] Sync requested for league ${leagueId} (force=${force})`);
    
    const result = await syncLeague(leagueId, { force, week, season });
    
    return res.status(result.success ? 200 : 500).json({
      success: result.success,
      data: {
        leagueId: result.leagueId,
        eventsInserted: result.eventsInserted,
        shortCircuited: result.shortCircuited,
        durationMs: result.durationMs,
        hash: result.hash,
        resolverStats: result.resolverStats
      },
      error: result.error
    });
    
  } catch (error: any) {
    console.error('[SleeperSyncV2Routes] Sync run error:', error);
    return res.status(500).json({
      success: false,
      error: error?.message || 'Internal server error'
    });
  }
});

/**
 * GET /api/sleeper/sync/status
 * Get sync status for a Sleeper league
 * 
 * Query:
 *   leagueId: string (required) - Sleeper league ID
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    const leagueId = req.query.leagueId as string;
    
    if (!leagueId) {
      return res.status(400).json({
        success: false,
        error: 'leagueId query parameter is required'
      });
    }
    
    const status = await getSyncStatus(leagueId);
    
    if (!status) {
      return res.status(404).json({
        success: false,
        error: 'No sync state found for this league'
      });
    }
    
    // Also get unresolved player count
    const unresolvedCount = await getUnresolvedPlayerCount(leagueId);
    
    return res.json({
      success: true,
      data: {
        leagueId,
        status: status.status,
        lastSyncedAt: status.lastSyncedAt?.toISOString() ?? null,
        lastDurationMs: status.lastDurationMs,
        lastError: status.lastError,
        lastHash: status.lastHash,
        unresolvedPlayerCount: unresolvedCount
      }
    });
    
  } catch (error: any) {
    console.error('[SleeperSyncV2Routes] Status check error:', error);
    return res.status(500).json({
      success: false,
      error: error?.message || 'Internal server error'
    });
  }
});

export default router;
