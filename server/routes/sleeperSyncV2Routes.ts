/**
 * Sleeper Sync V2 Routes
 * Manual endpoints for roster synchronization and ownership analytics
 * 
 * POST /api/sleeper/sync/run - Run sync for a league
 * GET  /api/sleeper/sync/status - Get sync status for a league
 * GET  /api/sleeper/leagues - Discover all synced leagues
 * GET  /api/ownership/history - Get ownership event history for a player
 * GET  /api/ownership/churn - Get ownership churn analytics (most added/dropped/traded)
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { syncLeague, getSyncStatus, getUnresolvedPlayerCount } from '../services/sleeperSyncV2';
import { db } from '../infra/db';
import { ownershipEvents, sleeperSyncState } from '@shared/schema';
import { eq, and, gte, desc, sql } from 'drizzle-orm';

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

// ========================================
// OWNERSHIP ANALYTICS ROUTES
// ========================================

export const ownershipRouter = Router();

// Response types for type safety
interface OwnershipEvent {
  id: number;
  leagueId: string;
  playerKey: string;
  fromTeamId: string | null;
  toTeamId: string | null;
  eventType: string;
  eventAt: string;
  week: number | null;
  season: number | null;
  source: string | null;
}

interface ChurnEntry {
  playerKey: string;
  count: number;
}

interface ChurnResponse {
  mostAdded: ChurnEntry[];
  mostDropped: ChurnEntry[];
  mostTraded: ChurnEntry[];
  since: string;
  leagueId: string;
}

/**
 * GET /api/ownership/history
 * Get ownership event history for a player in a league
 * 
 * Query:
 *   leagueId: string (required) - League ID
 *   playerKey: string (required) - Player key (GSIS ID or sleeper:<id>)
 */
ownershipRouter.get('/history', async (req: Request, res: Response) => {
  try {
    const leagueId = req.query.leagueId as string;
    const playerKey = req.query.playerKey as string;
    
    if (!leagueId) {
      return res.status(400).json({
        success: false,
        error: 'leagueId query parameter is required'
      });
    }
    
    if (!playerKey) {
      return res.status(400).json({
        success: false,
        error: 'playerKey query parameter is required'
      });
    }
    
    const events = await db
      .select()
      .from(ownershipEvents)
      .where(
        and(
          eq(ownershipEvents.leagueId, leagueId),
          eq(ownershipEvents.playerKey, playerKey)
        )
      )
      .orderBy(desc(ownershipEvents.eventAt))
      .limit(50);
    
    const formatted: OwnershipEvent[] = events.map(e => ({
      id: e.id,
      leagueId: e.leagueId,
      playerKey: e.playerKey,
      fromTeamId: e.fromTeamId,
      toTeamId: e.toTeamId,
      eventType: e.eventType,
      eventAt: e.eventAt.toISOString(),
      week: e.week,
      season: e.season,
      source: e.source
    }));
    
    return res.json({
      success: true,
      data: {
        leagueId,
        playerKey,
        events: formatted,
        count: formatted.length
      }
    });
    
  } catch (error: any) {
    console.error('[OwnershipRoutes] History error:', error);
    return res.status(500).json({
      success: false,
      error: error?.message || 'Internal server error'
    });
  }
});

/**
 * GET /api/ownership/churn
 * Get ownership churn analytics (most added/dropped/traded players)
 * 
 * Query:
 *   leagueId: string (required) - League ID
 *   since: string (required) - ISO timestamp to filter events from
 */
ownershipRouter.get('/churn', async (req: Request, res: Response) => {
  try {
    const leagueId = req.query.leagueId as string;
    const since = req.query.since as string;
    
    if (!leagueId) {
      return res.status(400).json({
        success: false,
        error: 'leagueId query parameter is required'
      });
    }
    
    if (!since) {
      return res.status(400).json({
        success: false,
        error: 'since query parameter is required (ISO timestamp)'
      });
    }
    
    const sinceDate = new Date(since);
    if (isNaN(sinceDate.getTime())) {
      return res.status(400).json({
        success: false,
        error: 'Invalid since timestamp format. Use ISO 8601 format.'
      });
    }
    
    // Query for most added players
    const addedResult = await db.execute(sql`
      SELECT player_key, COUNT(*) as count
      FROM ownership_events
      WHERE league_id = ${leagueId}
        AND event_at >= ${sinceDate}
        AND event_type = 'ADD'
      GROUP BY player_key
      ORDER BY count DESC
      LIMIT 20
    `);
    
    // Query for most dropped players
    const droppedResult = await db.execute(sql`
      SELECT player_key, COUNT(*) as count
      FROM ownership_events
      WHERE league_id = ${leagueId}
        AND event_at >= ${sinceDate}
        AND event_type = 'DROP'
      GROUP BY player_key
      ORDER BY count DESC
      LIMIT 20
    `);
    
    // Query for most traded players
    const tradedResult = await db.execute(sql`
      SELECT player_key, COUNT(*) as count
      FROM ownership_events
      WHERE league_id = ${leagueId}
        AND event_at >= ${sinceDate}
        AND event_type = 'TRADE'
      GROUP BY player_key
      ORDER BY count DESC
      LIMIT 20
    `);
    
    const formatEntries = (rows: any[]): ChurnEntry[] => 
      rows.map(r => ({
        playerKey: r.player_key,
        count: parseInt(r.count) || 0
      }));
    
    const response: ChurnResponse = {
      leagueId,
      since: sinceDate.toISOString(),
      mostAdded: formatEntries(addedResult.rows as any[]),
      mostDropped: formatEntries(droppedResult.rows as any[]),
      mostTraded: formatEntries(tradedResult.rows as any[])
    };
    
    return res.json({
      success: true,
      data: response
    });
    
  } catch (error: any) {
    console.error('[OwnershipRoutes] Churn error:', error);
    return res.status(500).json({
      success: false,
      error: error?.message || 'Internal server error'
    });
  }
});

// Separate leagues discovery router (mounted at /api/sleeper)
export const leaguesRouter = Router();

/**
 * GET /api/sleeper/leagues
 * Discover all leagues that have been synced/configured
 * Source: sleeper_sync_state table
 */
leaguesRouter.get('/leagues', async (req: Request, res: Response) => {
  try {
    const leagues = await db
      .select({
        leagueId: sleeperSyncState.leagueId,
        status: sleeperSyncState.status,
        lastSyncedAt: sleeperSyncState.lastSyncedAt,
        changeSeq: sleeperSyncState.changeSeq,
      })
      .from(sleeperSyncState)
      .orderBy(desc(sleeperSyncState.lastSyncedAt));
    
    const formatted = leagues.map(l => ({
      leagueId: l.leagueId,
      status: l.status,
      lastSyncedAt: l.lastSyncedAt?.toISOString() ?? null,
      changeSeq: l.changeSeq,
    }));
    
    return res.json({
      success: true,
      data: {
        leagues: formatted,
        count: formatted.length
      }
    });
    
  } catch (error: any) {
    console.error('[SleeperSyncV2Routes] Leagues discovery error:', error);
    return res.status(500).json({
      success: false,
      error: error?.message || 'Internal server error'
    });
  }
});

// Export sync router as default, ownership router and leagues router as named exports
export default router;
