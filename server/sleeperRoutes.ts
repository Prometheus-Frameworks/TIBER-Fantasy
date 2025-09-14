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
    
    res.json({
      ok: true,
      meta: { source: 'sleeper' as const, generatedAt: new Date().toISOString() },
      data: leagues
    });
    logInfo('User leagues fetch successful', { userId, season, count: leagues.length, durationMs: Date.now() - t0 });
  } catch (e: any) {
    logError('User leagues fetch failed', e, { userId: req.params.userId, season: req.query.season, durationMs: Date.now() - t0 });
    const { code, message, details } = errFields(e);
    res.status(httpStatusFromError(e)).json(createErrorResponse(code, message || 'Failed to get user leagues', details));
  }
});

// Get direct league info from Sleeper API
router.get('/api/sleeper/league/:leagueId', async (req: Request, res: Response) => {
  const t0 = Date.now();
  try {
    const { leagueId } = req.params;
    if (!leagueId?.trim()) {
      return res.status(400).json(createErrorResponse('INVALID_LEAGUE_ID', 'League ID parameter is required'));
    }
    
    logInfo('Fetching league info', { leagueId });
    
    const { sleeperAPI } = await import('./sleeperAPI');
    const league = await sleeperAPI.getLeague(leagueId);
    
    res.json({
      ok: true,
      meta: { source: 'sleeper' as const, generatedAt: new Date().toISOString() },
      data: league
    });
    logInfo('League info fetch successful', { leagueId, durationMs: Date.now() - t0 });
  } catch (e: any) {
    logError('League info fetch failed', e, { leagueId: req.params.leagueId, durationMs: Date.now() - t0 });
    const { code, message, details } = errFields(e);
    res.status(httpStatusFromError(e)).json(createErrorResponse(code, message || 'Failed to get league info', details));
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

// Get player stats/usage data (for fetchSleeperUsage provider)
router.get('/api/sleeper/stats/:playerId', async (req: Request, res: Response) => {
  const t0 = Date.now();
  try {
    const { playerId } = req.params;
    const week = req.query.week as string | undefined;
    
    if (!playerId?.trim()) {
      return res.status(400).json(createErrorResponse('INVALID_PLAYER_ID', 'Player ID parameter is required'));
    }
    
    logInfo('Fetching player stats', { playerId, week });
    
    // Try to get real Sleeper stats first
    try {
      const { sleeperAPI } = await import('./sleeperAPI');
      
      // Get basic player info to validate ID exists
      const { sleeperSyncService } = await import('./services/sleeperSyncService');
      const players = await sleeperSyncService.getPlayers();
      const player = players.find((p: any) => p.player_id === playerId || p.sleeper_id === playerId);
      
      if (!player) {
        return res.status(404).json(createErrorResponse('PLAYER_NOT_FOUND', 'Player not found', { playerId }));
      }
      
      // Mock realistic usage stats based on position
      const position = player.position || 'WR';
      let usageStats;
      
      switch (position) {
        case 'WR':
          usageStats = {
            snapPct: Math.floor(Math.random() * 30) + 65, // 65-95%
            routeParticipation: Math.floor(Math.random() * 25) + 70, // 70-95%
            targetShare: Math.floor(Math.random() * 15) + 10, // 10-25%
            carries: Math.floor(Math.random() * 3), // 0-2 carries for WRs
            targets: Math.floor(Math.random() * 8) + 4, // 4-12 targets
            rzTouches: Math.floor(Math.random() * 3) + 1, // 1-3 RZ touches
            insideTenTouches: Math.floor(Math.random() * 2) // 0-1 inside 10
          };
          break;
        case 'RB':
          usageStats = {
            snapPct: Math.floor(Math.random() * 40) + 50, // 50-90%
            routeParticipation: Math.floor(Math.random() * 30) + 40, // 40-70%
            targetShare: Math.floor(Math.random() * 12) + 5, // 5-17%
            carries: Math.floor(Math.random() * 15) + 8, // 8-22 carries
            targets: Math.floor(Math.random() * 6) + 2, // 2-8 targets
            rzTouches: Math.floor(Math.random() * 4) + 2, // 2-5 RZ touches
            insideTenTouches: Math.floor(Math.random() * 3) + 1 // 1-3 inside 10
          };
          break;
        case 'TE':
          usageStats = {
            snapPct: Math.floor(Math.random() * 35) + 60, // 60-95%
            routeParticipation: Math.floor(Math.random() * 20) + 65, // 65-85%
            targetShare: Math.floor(Math.random() * 10) + 8, // 8-18%
            carries: 0, // TEs rarely carry
            targets: Math.floor(Math.random() * 6) + 3, // 3-9 targets
            rzTouches: Math.floor(Math.random() * 2) + 1, // 1-2 RZ touches
            insideTenTouches: Math.floor(Math.random() * 2) // 0-1 inside 10
          };
          break;
        case 'QB':
          usageStats = {
            snapPct: Math.floor(Math.random() * 15) + 85, // 85-100%
            routeParticipation: 0, // QBs don't run routes
            targetShare: 0, // QBs don't get targeted
            carries: Math.floor(Math.random() * 8) + 2, // 2-10 carries
            targets: 0,
            rzTouches: Math.floor(Math.random() * 3) + 1, // 1-3 RZ touches (rushing)
            insideTenTouches: Math.floor(Math.random() * 2) // 0-1 inside 10
          };
          break;
        default:
          usageStats = {
            snapPct: 70,
            routeParticipation: 75,
            targetShare: 12,
            carries: 0,
            targets: 5,
            rzTouches: 1,
            insideTenTouches: 0
          };
      }
      
      res.json({
        ...usageStats,
        player_id: playerId,
        player_name: player.full_name || `${player.first_name || ''} ${player.last_name || ''}`.trim(),
        position: player.position,
        team: player.team,
        week: week || 'current',
        metadata: {
          source: 'sleeper_api_simulation',
          generated: true,
          note: 'Position-based realistic usage simulation until real API integration'
        }
      });
      
      logInfo('Player stats fetch successful', { playerId, position, week, durationMs: Date.now() - t0 });
      
    } catch (apiError: any) {
      logError('Sleeper API error, using fallback', apiError, { playerId, week });
      
      // Fallback to reasonable defaults
      const fallbackStats = {
        snapPct: 75,
        routeParticipation: 80,
        targetShare: 15,
        carries: 0,
        targets: 6,
        rzTouches: 2,
        insideTenTouches: 1,
        player_id: playerId,
        week: week || 'current',
        metadata: {
          source: 'fallback',
          generated: true,
          note: 'API unavailable, using fallback stats'
        }
      };
      
      res.json(fallbackStats);
    }
    
  } catch (e: any) {
    logError('Player stats fetch failed', e, { playerId: req.params.playerId, week: req.query.week, durationMs: Date.now() - t0 });
    const { code, message, details } = errFields(e);
    res.status(httpStatusFromError(e)).json(createErrorResponse(code, message || 'Failed to get player stats', details));
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