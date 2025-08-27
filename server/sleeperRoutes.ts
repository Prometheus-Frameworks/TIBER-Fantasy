import express from 'express';
import type { Request, Response } from 'express';

// Helper functions for structured logging
function logInfo(msg: string, meta?: Record<string, any>) {
  console.log(JSON.stringify({ level: 'info', src: 'SleeperRoutes', msg, ...(meta || {}) }));
}

function logError(msg: string, e: any, meta?: Record<string, any>) {
  console.error(JSON.stringify({ level: 'error', src: 'SleeperRoutes', msg, error: e?.message || String(e), stack: e?.stack, ...(meta || {}) }));
}

// Helper functions for consistent responses and error handling
function createResponse(data: any) {
  return {
    ok: true,
    meta: { source: 'sleeper' as const, generatedAt: new Date().toISOString() },
    ...data
  };
}

function createErrorResponse(code: string, message: string, details?: any, metaOverride?: Record<string, any>) {
  return {
    ok: false,
    code,
    message,
    details: details || null,
    meta: { source: 'sleeper' as const, generatedAt: new Date().toISOString(), ...metaOverride }
  };
}

function httpStatusFromError(e: any, fallback: number = 500): number {
  const errorCode = e?.code || e?.message;
  if (typeof errorCode === 'string') {
    if (['INVALID_USERNAME', 'INVALID_USER_ID', 'INVALID_LEAGUE_ID'].includes(errorCode)) return 400;
    if (errorCode === 'INVALID_SEASON') return 422;
    if (['USER_NOT_FOUND', 'LEAGUE_NOT_FOUND', 'NOT_FOUND'].includes(errorCode)) return 404;
    if (errorCode === 'PARTIAL_UPSTREAM') return 206;
    if (errorCode === 'API_ERROR') return 502;
  }
  return fallback;
}

function errFields(e: any) {
  return {
    code: e?.code || 'UNKNOWN_ERROR',
    message: e?.message || 'An unknown error occurred',
    details: e?.details || null
  };
}

function isValidSeason(season: string): boolean {
  if (!/^\d{4}$/.test(season)) return false;
  const year = parseInt(season, 10);
  const currentYear = new Date().getFullYear();
  return year >= 2018 && year <= currentYear + 1;
}

const router = express.Router();

// Get user by username (Batch #2 refinement)
router.get('/api/sleeper/user/:username', async (req: Request, res: Response) => {
  const t0 = Date.now();
  try {
    const { username } = req.params;
    if (!username?.trim()) {
      return res.status(400).json(createErrorResponse('INVALID_USERNAME', 'Username parameter is required'));
    }
    
    logInfo('Looking up user', { username });
    
    const { sleeperAPI } = await import('./sleeperAPI');
    const user = await sleeperAPI.getUser(username);
    
    res.json(createResponse({ data: { user_id: user.user_id } }));
    logInfo('User lookup successful', { username, user_id: user.user_id, durationMs: Date.now() - t0 });
  } catch (e: any) {
    logError('User lookup failed', e, { username: req.params.username, durationMs: Date.now() - t0 });
    const { code, message, details } = errFields(e);
    res.status(httpStatusFromError(e, code === 'USER_NOT_FOUND' ? 404 : 500)).json(createErrorResponse(code, message || 'User not found', details));
  }
});

// Get leagues for user (Batch #2 refinement)
router.get('/api/sleeper/leagues/:userId', async (req: Request, res: Response) => {
  const t0 = Date.now();
  try {
    const { userId } = req.params;
    const season = (req.query.season as string) || String(new Date().getFullYear());
    
    if (!userId?.trim()) {
      return res.status(400).json(createErrorResponse('INVALID_USER_ID', 'User ID parameter is required'));
    }
    if (!isValidSeason(season)) {
      return res.status(422).json(createErrorResponse('INVALID_SEASON', 'Season must be YYYY (2018..next year)', { season }));
    }
    
    logInfo('Fetching user leagues', { userId, season });
    
    const { sleeperAPI } = await import('./sleeperAPI');
    const leagues = await sleeperAPI.getUserLeagues(userId, season);
    
    res.json(createResponse(leagues));
    logInfo('User leagues fetch successful', { userId, season, count: leagues.length, durationMs: Date.now() - t0 });
  } catch (e: any) {
    logError('User leagues fetch failed', e, { userId: req.params.userId, season: req.query.season, durationMs: Date.now() - t0 });
    const { code, message, details } = errFields(e);
    res.status(httpStatusFromError(e)).json(createErrorResponse(code, message || 'Failed to get user leagues', details));
  }
});

// Get league context (Batch #2 refinement)
router.get('/api/sleeper/league/:leagueId/context', async (req: Request, res: Response) => {
  const t0 = Date.now();
  try {
    const { leagueId } = req.params;
    if (!leagueId?.trim()) {
      return res.status(400).json(createErrorResponse('INVALID_LEAGUE_ID', 'League ID parameter is required'));
    }
    
    logInfo('Fetching league context', { leagueId });
    
    const { sleeperSyncService } = await import('./services/sleeperSyncService');
    const context = await sleeperSyncService.materializeLeagueContext(leagueId);
    
    res.json(createResponse(context));
    logInfo('League context fetch successful', { leagueId, durationMs: Date.now() - t0 });
  } catch (e: any) {
    if (httpStatusFromError(e) === 206 && e?.details?.context) {
      // Handle partial upstream failure (206 response)
      const miss = e?.details?.missing || e?.missing || [];
      const ctx = e?.details?.context || e?.context;
      logError('Partial league context', e, { leagueId: req.params.leagueId, missing: miss, durationMs: Date.now() - t0 });
      return res.status(206).json({
        ok: false,
        missing: miss,
        meta: { source: 'sleeper' as const, generatedAt: new Date().toISOString() },
        data: ctx
      });
    }
    logError('League context fetch failed', e, { leagueId: req.params.leagueId, durationMs: Date.now() - t0 });
    const { code, message, details } = errFields(e);
    res.status(httpStatusFromError(e)).json(createErrorResponse(code, message || 'Failed to get league context', details));
  }
});

// Get players list (Batch #2 refinement) 
router.get('/api/sleeper/players', async (req: Request, res: Response) => {
  const t0 = Date.now();
  try {
    const position = req.query.position as string | undefined;
    const search = req.query.search as string | undefined;
    const limit = req.query.limit as string | undefined;
    
    logInfo('Fetching players', { position, search, limit });
    
    const { sleeperSyncService } = await import('./services/sleeperSyncService');
    let players = await sleeperSyncService.getPlayers();
    
    // Apply filters to players array
    if (position) {
      players = await sleeperSyncService.getPlayersByPosition(position as string);
    }
    if (search) {
      players = await sleeperSyncService.searchPlayers(search as string);
    }
    if (limit) {
      const limitNum = parseInt(limit as string);
      if (limitNum > 0) {
        players = players.slice(0, limitNum);
      }
    }

    const cacheInfo = sleeperSyncService.getCacheMetadata();
    
    res.json(createResponse({
      data: players,
      cache_metadata: cacheInfo,
      filters: { position, search, limit },
      count: players.length,
      updatedAt: cacheInfo.updatedAt || new Date().toISOString()
    }));
    
    logInfo('Players fetch successful', { count: players.length, position, search, limit, durationMs: Date.now() - t0 });
  } catch (e: any) {
    logError('Players fetch failed', e, { position: req.query.position, search: req.query.search, durationMs: Date.now() - t0 });
    const { code, message, details } = errFields(e);
    res.status(httpStatusFromError(e)).json(createErrorResponse(code, message || 'Failed to retrieve players', details));
  }
});

// Sync players endpoint (Batch #2 refinement)
router.post('/api/sleeper/sync', async (req: Request, res: Response) => {
  const t0 = Date.now();
  try {
    logInfo('Starting player sync');
    
    const { sleeperSyncService } = await import('./services/sleeperSyncService');
    const result = await sleeperSyncService.syncPlayers();
    
    res.json(createResponse(result));
    logInfo('Player sync completed', { players_synced: result.players_count, durationMs: Date.now() - t0 });
  } catch (e: any) {
    logError('Player sync failed', e, { durationMs: Date.now() - t0 });
    const { code, message, details } = errFields(e);
    res.status(httpStatusFromError(e)).json(createErrorResponse(code, message || 'Sync failed', details));
  }
});

// Get sync status endpoint (Batch #2 refinement)
router.get('/api/sleeper/status', async (req: Request, res: Response) => {
  const t0 = Date.now();
  try {
    logInfo('Checking sync status');
    
    const { sleeperSyncService } = await import('./services/sleeperSyncService');
    const status = await sleeperSyncService.getSyncStatus();
    
    res.json(createResponse(status));
    logInfo('Sync status check successful', { cache_exists: status.cache_exists || false, durationMs: Date.now() - t0 });
  } catch (e: any) {
    logError('Sync status check failed', e, { durationMs: Date.now() - t0 });
    const { code, message, details } = errFields(e);
    res.status(httpStatusFromError(e)).json(createErrorResponse(code, message || 'Failed to get sync status', details));
  }
});

// Clear cache endpoint (Batch #2 refinement)
router.post('/api/sleeper/clear-cache', async (_req: Request, res: Response) => {
  const t0 = Date.now();
  try {
    logInfo('Clearing Sleeper cache');
    
    const { sleeperSyncService } = await import('./services/sleeperSyncService');
    const result = await sleeperSyncService.forceRefresh();
    
    res.json(createResponse({ message: 'Cache cleared successfully', sync_result: result }));
    logInfo('Cache cleared successfully', { durationMs: Date.now() - t0 });
  } catch (e: any) {
    logError('Cache clear failed', e, { durationMs: Date.now() - t0 });
    res.status(500).json(createErrorResponse('CACHE_ERROR', 'Failed to clear cache', e?.message));
  }
});

// Health check endpoint for Sleeper integration (Batch #2 refinement)
router.get('/api/sleeper/health', async (_req: Request, res: Response) => {
  try {
    const { sleeperSyncService } = await import('./services/sleeperSyncService');
    const cacheInfo = sleeperSyncService.getCacheMetadata();
    
    res.json(createResponse({
      status: 'healthy',
      cache: {
        hasData: cacheInfo.count > 0,
        lastUpdated: cacheInfo.updatedAt,
        count: cacheInfo.count
      },
      timestamp: new Date().toISOString()
    }));
  } catch (e: any) {
    logError('Sleeper health check failed', e);
    res.status(500).json(createErrorResponse('HEALTH_CHECK_ERROR', 'Health check failed', e?.message));
  }
});

export default router;