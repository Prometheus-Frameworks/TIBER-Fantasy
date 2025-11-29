/**
 * FORGE Admin Routes
 * 
 * Secured admin endpoints for triggering FORGE rebuilds.
 * Protected by X-FORGE-ADMIN-KEY header authentication.
 */

import { Router, Request, Response } from 'express';
import { rebuildForgeContext } from '../services/forgeRebuildService';

const router = Router();

/**
 * Simple shared-secret header authentication
 */
function isAuthorized(req: Request): boolean {
  const header = req.headers['x-forge-admin-key'];
  const adminKey = process.env.FORGE_ADMIN_KEY;
  
  if (!adminKey) {
    console.warn('[FORGE Admin] FORGE_ADMIN_KEY not set - all requests will be rejected');
    return false;
  }
  
  return header === adminKey;
}

/**
 * POST /api/admin/forge/rebuild
 * 
 * Triggers a full FORGE rebuild:
 * 1. Aggregates PBP data → team_offensive_context / team_defensive_context
 * 2. Refreshes forge_team_environment and forge_team_matchup_context
 * 
 * Request body (optional):
 * - season: number (defaults to current season from config)
 * - week: number (defaults to latest week with PBP data)
 * 
 * Headers:
 * - X-FORGE-ADMIN-KEY: shared secret for authentication
 * 
 * Example:
 * curl -X POST "http://localhost:5000/api/admin/forge/rebuild" \
 *   -H "Content-Type: application/json" \
 *   -H "X-FORGE-ADMIN-KEY: your-secret-key" \
 *   -d '{"season": 2025, "week": 12}'
 */
router.post('/api/admin/forge/rebuild', async (req: Request, res: Response) => {
  if (!isAuthorized(req)) {
    console.log('[FORGE Admin] Unauthorized rebuild attempt');
    return res.status(401).json({ 
      ok: false, 
      error: 'Unauthorized - invalid or missing X-FORGE-ADMIN-KEY header' 
    });
  }

  const { season, week } = req.body || {};

  console.log(`[FORGE Admin] Authorized rebuild request: season=${season ?? 'default'}, week=${week ?? 'latest'}`);

  try {
    const result = await rebuildForgeContext({
      season: season ? Number(season) : undefined,
      week: week ? Number(week) : undefined,
    });

    return res.json({
      ok: true,
      ...result,
      message: `FORGE rebuild completed for ${result.season} week ${result.week}`,
    });
  } catch (err) {
    console.error('[FORGE Admin] Rebuild failed:', err);
    return res.status(500).json({ 
      ok: false, 
      error: 'FORGE rebuild failed',
      details: err instanceof Error ? err.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/admin/forge/status
 * 
 * Returns current FORGE data status (no auth required for status check).
 */
router.get('/api/admin/forge/status', async (req: Request, res: Response) => {
  try {
    const { db } = await import('../infra/db');
    const { sql } = await import('drizzle-orm');

    const offCtx = await db.execute(sql`
      SELECT season, week, COUNT(*) as teams 
      FROM team_offensive_context 
      GROUP BY season, week 
      ORDER BY season DESC, week DESC 
      LIMIT 5
    `);

    const forgeEnv = await db.execute(sql`
      SELECT season, week, COUNT(*) as teams, MAX(last_updated) as last_refresh
      FROM forge_team_environment 
      GROUP BY season, week 
      ORDER BY season DESC, week DESC 
      LIMIT 5
    `);

    const pbpWeeks = await db.execute(sql`
      SELECT season, MAX(week) as latest_week, COUNT(*) as plays
      FROM bronze_nflfastr_plays
      GROUP BY season
      ORDER BY season DESC
      LIMIT 3
    `);

    return res.json({
      ok: true,
      offensiveContext: offCtx.rows,
      forgeEnvironment: forgeEnv.rows,
      pbpData: pbpWeeks.rows,
    });
  } catch (err) {
    console.error('[FORGE Admin] Status check failed:', err);
    return res.status(500).json({ ok: false, error: 'Status check failed' });
  }
});

export default router;
