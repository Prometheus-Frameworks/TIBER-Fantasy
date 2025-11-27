/**
 * FORGE v0.1 - Routes
 * 
 * HTTP API endpoints for FORGE scoring preview.
 * 
 * Endpoints:
 * - GET /api/forge/preview - Preview FORGE scores for players
 */

import { Router, Request, Response } from 'express';
import { forgeService } from './forgeService';
import { PlayerPosition } from './types';
import { db } from '../../infra/db';
import { playerIdentityMap } from '@shared/schema';
import { eq, and, isNotNull, sql } from 'drizzle-orm';
import { createForgeSnapshot } from './forgeSnapshot';

const router = Router();

const FALLBACK_PLAYERS: Record<PlayerPosition, string[]> = {
  WR: [
    'tyreek_hill', 'justin_jefferson', 'jamarr_chase', 'ceedee_lamb',
    'davante_adams', 'aj_brown', 'deebo_samuel', 'stefon_diggs',
    'garrett_wilson', 'chris_olave'
  ],
  RB: [
    'christian_mccaffrey', 'austin_ekeler', 'saquon_barkley', 'bijan_robinson',
    'breece_hall', 'josh_jacobs', 'jonathan_taylor', 'nick_chubb',
    'derrick_henry', 'jahmyr_gibbs'
  ],
  TE: [
    'travis_kelce', 'mark_andrews', 'tj_hockenson', 'dallas_goedert',
    'george_kittle', 'sam_laporta', 'evan_engram', 'kyle_pitts',
    'david_njoku', 'pat_freiermuth'
  ],
  QB: [
    'patrick_mahomes', 'josh_allen', 'jalen_hurts', 'lamar_jackson',
    'joe_burrow', 'justin_herbert', 'trevor_lawrence', 'dak_prescott',
    'tua_tagovailoa', 'cj_stroud'
  ],
};

/**
 * GET /api/forge/preview
 * 
 * Query params:
 * - position (required): WR | RB | TE | QB
 * - season (optional): number, defaults to 2024
 * - week (optional): number, defaults to 17
 * - limit (optional): number, defaults to 50
 * - playerIds (optional): comma-separated canonical IDs
 */
router.get('/preview', async (req: Request, res: Response) => {
  try {
    const position = (req.query.position as string)?.toUpperCase() as PlayerPosition;
    const season = parseInt(req.query.season as string) || 2024;
    const week = parseInt(req.query.week as string) || 17;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const playerIdsParam = req.query.playerIds as string;
    
    if (!position || !['WR', 'RB', 'TE', 'QB'].includes(position)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or missing position. Must be WR, RB, TE, or QB.',
      });
    }
    
    console.log(`[FORGE/Routes] Preview request: position=${position}, season=${season}, week=${week}, limit=${limit}`);
    
    let playerIds: string[] = [];
    
    if (playerIdsParam) {
      playerIds = playerIdsParam.split(',').map(id => id.trim()).filter(Boolean);
    } else {
      playerIds = await fetchPlayerIdsForPosition(position, limit);
    }
    
    if (playerIds.length === 0) {
      console.log(`[FORGE/Routes] No players found, using fallback list for ${position}`);
      playerIds = FALLBACK_PLAYERS[position].slice(0, limit);
    }
    
    console.log(`[FORGE/Routes] Scoring ${playerIds.length} ${position}s...`);
    
    const scores = await forgeService.getForgeScoresForPlayers(playerIds, season, week);
    
    const sortedScores = scores.sort((a, b) => b.alpha - a.alpha);
    
    return res.json({
      success: true,
      meta: {
        position,
        season,
        week,
        requestedCount: playerIds.length,
        returnedCount: sortedScores.length,
        scoredAt: new Date().toISOString(),
      },
      scores: sortedScores,
    });
    
  } catch (error) {
    console.error('[FORGE/Routes] Preview error:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/forge/score/:playerId
 * 
 * Get FORGE score for a specific player
 * 
 * Path params:
 * - playerId (required): canonical player ID
 * 
 * Query params:
 * - season (optional): number, defaults to 2024
 * - week (optional): number, defaults to 17
 */
router.get('/score/:playerId', async (req: Request, res: Response) => {
  try {
    const { playerId } = req.params;
    const season = parseInt(req.query.season as string) || 2024;
    const week = parseInt(req.query.week as string) || 17;
    
    if (!playerId) {
      return res.status(400).json({
        success: false,
        error: 'Missing playerId parameter',
      });
    }
    
    console.log(`[FORGE/Routes] Score request: playerId=${playerId}, season=${season}, week=${week}`);
    
    const score = await forgeService.getForgeScoreForPlayer(playerId, season, week);
    
    return res.json({
      success: true,
      score,
    });
    
  } catch (error) {
    console.error('[FORGE/Routes] Score error:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/forge/health
 * 
 * Health check endpoint
 */
router.get('/health', (req: Request, res: Response) => {
  return res.json({
    success: true,
    service: 'FORGE',
    version: '0.1',
    status: 'operational',
    timestamp: new Date().toISOString(),
  });
});

/**
 * GET /api/forge/batch
 * 
 * Batch scoring endpoint for internal + external consumers
 * 
 * Query params:
 * - position (optional): WR | RB | TE | QB (defaults to all WR if not specified)
 * - limit (optional): number, 1-500, defaults to 100
 * - season (optional): number, defaults to 2024
 * - week (optional): number, defaults to 17
 */
router.get('/batch', async (req: Request, res: Response) => {
  try {
    const { position, limit, season, week } = req.query;

    const normalizedPosition =
      typeof position === 'string' && ['QB', 'RB', 'WR', 'TE'].includes(position.toUpperCase())
        ? (position.toUpperCase() as PlayerPosition)
        : undefined;

    const normalizedLimit =
      typeof limit === 'string' && !Number.isNaN(Number(limit))
        ? Math.max(1, Math.min(Number(limit), 500))
        : 100;

    const normalizedSeason = 
      typeof season === 'string' && !Number.isNaN(Number(season))
        ? Number(season)
        : 2024;

    const normalizedWeek =
      typeof week === 'string' && !Number.isNaN(Number(week))
        ? Number(week)
        : 17;

    console.log(`[FORGE/Routes] Batch request: position=${normalizedPosition ?? 'ALL'}, limit=${normalizedLimit}, season=${normalizedSeason}, week=${normalizedWeek}`);

    const scores = await forgeService.getForgeScoresBatch({
      position: normalizedPosition,
      limit: normalizedLimit,
      season: normalizedSeason,
      asOfWeek: normalizedWeek,
    });

    const sortedScores = scores.sort((a, b) => b.alpha - a.alpha);

    return res.json({
      success: true,
      scores: sortedScores,
      meta: {
        position: normalizedPosition ?? 'ALL',
        limit: normalizedLimit,
        season: normalizedSeason,
        week: normalizedWeek,
        count: sortedScores.length,
        scoredAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('[FORGE/Routes] Batch error:', error);
    return res.status(500).json({
      success: false,
      error: 'FORGE_BATCH_FAILED',
    });
  }
});

/**
 * POST /api/forge/snapshot
 * 
 * Dev-only: trigger a snapshot export as JSON file on the server.
 * Creates a timestamped JSON file in data/forge/ directory.
 * 
 * Request body (all optional):
 * - position: WR | RB | TE | QB | ALL (defaults to ALL)
 * - limit: number (defaults to 500)
 * - season: number (defaults to 2024)
 * - week: number (defaults to 17)
 */
router.post('/snapshot', async (req: Request, res: Response) => {
  try {
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({ error: 'FORGE_SNAPSHOT_DISABLED_IN_PROD' });
    }

    const { position, limit, season, week } = req.body ?? {};

    console.log(`[FORGE/Routes] Snapshot request: position=${position ?? 'ALL'}, limit=${limit ?? 500}`);

    const result = await createForgeSnapshot({
      position,
      limit,
      season,
      week,
    });

    return res.json({
      success: true,
      snapshot: result,
    });
  } catch (error) {
    console.error('[FORGE] /api/forge/snapshot error:', error);
    return res.status(500).json({ error: 'FORGE_SNAPSHOT_FAILED' });
  }
});

/**
 * GET /api/forge/debug/distribution
 * 
 * Returns rawAlpha distribution stats for a position (dev-only).
 * Use this to derive p10/p90 for ALPHA_CALIBRATION config.
 * 
 * Query params:
 * - position (required): WR | RB | TE | QB
 * - season (optional): number, defaults to 2025
 * - week (optional): number, defaults to 10
 */
router.get('/debug/distribution', async (req: Request, res: Response) => {
  try {
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({ error: 'FORGE_DEBUG_DISABLED_IN_PROD' });
    }

    const position = (req.query.position as string)?.toUpperCase() as PlayerPosition;
    const season = parseInt(req.query.season as string) || 2025;
    const week = parseInt(req.query.week as string) || 10;

    if (!position || !['WR', 'RB', 'TE', 'QB'].includes(position)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or missing position. Must be WR, RB, TE, or QB.',
      });
    }

    console.log(`[FORGE/Debug] Distribution request: position=${position}, season=${season}, week=${week}`);

    const playerIds = await fetchPlayerIdsForPosition(position, 500);
    const scores = await forgeService.getForgeScoresForPlayers(playerIds, season, week);

    const rawAlphas = scores
      .map(s => s.rawAlpha)
      .filter((v): v is number => v != null && !isNaN(v))
      .sort((a, b) => a - b);

    if (rawAlphas.length === 0) {
      return res.json({
        success: true,
        position,
        season,
        week,
        count: 0,
        distribution: null,
        message: 'No scores found for this position/season/week',
      });
    }

    const count = rawAlphas.length;
    const min = rawAlphas[0];
    const max = rawAlphas[count - 1];
    const p10Idx = Math.floor(count * 0.1);
    const p25Idx = Math.floor(count * 0.25);
    const p50Idx = Math.floor(count * 0.5);
    const p75Idx = Math.floor(count * 0.75);
    const p90Idx = Math.floor(count * 0.9);

    const distribution = {
      count,
      min: Math.round(min * 10) / 10,
      p10: Math.round(rawAlphas[p10Idx] * 10) / 10,
      p25: Math.round(rawAlphas[p25Idx] * 10) / 10,
      p50: Math.round(rawAlphas[p50Idx] * 10) / 10,
      p75: Math.round(rawAlphas[p75Idx] * 10) / 10,
      p90: Math.round(rawAlphas[p90Idx] * 10) / 10,
      max: Math.round(max * 10) / 10,
    };

    console.log(`[FORGE/Debug] ${position} ${season}w${week} rawAlpha: min=${distribution.min} p10=${distribution.p10} p50=${distribution.p50} p90=${distribution.p90} max=${distribution.max}`);

    return res.json({
      success: true,
      position,
      season,
      week,
      distribution,
      calibrationSuggestion: {
        p10: distribution.p10,
        p90: distribution.p90,
        outMin: 25,
        outMax: 90,
      },
    });
  } catch (error) {
    console.error('[FORGE/Debug] Distribution error:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Fetch player IDs for a position from the identity map
 */
async function fetchPlayerIdsForPosition(
  position: PlayerPosition, 
  limit: number
): Promise<string[]> {
  try {
    const players = await db
      .select({ canonicalId: playerIdentityMap.canonicalId })
      .from(playerIdentityMap)
      .where(
        and(
          eq(playerIdentityMap.position, position),
          eq(playerIdentityMap.isActive, true),
          isNotNull(playerIdentityMap.nflTeam)
        )
      )
      .limit(limit);
    
    return players.map(p => p.canonicalId);
  } catch (error) {
    console.error(`[FORGE/Routes] Error fetching players for ${position}:`, error);
    return [];
  }
}

export function registerForgeRoutes(app: any): void {
  app.use('/api/forge', router);
  console.log('🔥 FORGE v0.1 routes mounted at /api/forge/*');
}

export default router;
