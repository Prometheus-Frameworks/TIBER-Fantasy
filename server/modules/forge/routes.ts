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
import { computeFPRForPlayer } from './fibonacciPatternResonance';
import { PlayerIdentityService } from '../../services/PlayerIdentityService';

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
 * GET /api/forge/fpr/:playerId
 * 
 * Compute Fibonacci Pattern Resonance for a player's usage history.
 * Analyzes week-over-week usage patterns to detect growth, decay, or stability.
 * 
 * Path params:
 * - playerId: canonical player ID or sleeper ID
 * 
 * Query params:
 * - position (optional): WR | RB | TE | QB - defaults to player's position from identity
 * - season (optional): number, defaults to 2025
 */
router.get('/fpr/:playerId', async (req: Request, res: Response) => {
  try {
    const { playerId } = req.params;
    const positionParam = req.query.position as string | undefined;
    const season = parseInt(req.query.season as string) || 2025;

    if (!playerId) {
      return res.status(400).json({
        success: false,
        error: 'Missing playerId parameter',
      });
    }

    const playerIdentityService = PlayerIdentityService.getInstance();
    const identity = await playerIdentityService.getByAnyId(playerId);

    if (!identity) {
      return res.status(404).json({
        success: false,
        error: `Player not found: ${playerId}`,
      });
    }

    const position = (positionParam?.toUpperCase() || identity.position) as PlayerPosition;
    
    if (!['WR', 'RB', 'TE', 'QB'].includes(position)) {
      return res.status(400).json({
        success: false,
        error: `Invalid position: ${position}. Must be WR, RB, TE, or QB.`,
      });
    }

    const sleeperId = identity.externalIds?.sleeper || identity.canonicalId;

    console.log(`[FORGE/FPR] Computing FPR for ${identity.fullName} (${position}), sleeperId=${sleeperId}, season=${season}`);

    const result = await computeFPRForPlayer(sleeperId, position, season);

    return res.json({
      success: true,
      meta: {
        playerId: identity.canonicalId,
        playerName: identity.fullName,
        position,
        team: identity.nflTeam,
        season,
        inputDataPoints: result.inputData.length,
      },
      fpr: result.fpr,
      inputData: result.inputData,
    });

  } catch (error) {
    console.error('[FORGE/FPR] Error:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'FPR calculation failed',
    });
  }
});

/**
 * POST /api/forge/lab/wr-core/matches
 * 
 * Find WR players closest to the user's Lab slider configuration.
 * Uses WR Core Alpha formula: Chain (55% FD + 45% TS), Explosive (60% YPRR + 40% YAC), WinSkill (CC)
 * 
 * Request body:
 * - inputs: { TS, YPRR, FD_RR, YAC, CC } - the slider values from Lab
 * - season (optional): number, defaults to 2025
 * - week (optional): number | 'full' - specific week or full season aggregate
 * - limit (optional): number, defaults to 5
 */
router.post('/lab/wr-core/matches', async (req: Request, res: Response) => {
  try {
    const { inputs, season = 2025, week = 'full', limit = 5 } = req.body;
    
    if (!inputs || typeof inputs !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'Missing inputs object with TS, YPRR, FD_RR, YAC, CC',
      });
    }
    
    const { TS, YPRR, FD_RR, YAC, CC } = inputs;
    
    if ([TS, YPRR, FD_RR, YAC, CC].some(v => v === undefined || typeof v !== 'number')) {
      return res.status(400).json({
        success: false,
        error: 'All inputs (TS, YPRR, FD_RR, YAC, CC) must be numbers',
      });
    }
    
    console.log(`[FORGE/Lab] WR Core matches request: season=${season}, week=${week}, inputs=`, inputs);
    
    // Calculate user's subscores using WR Core Alpha formula
    const userSubscores = computeWRCoreSubscores(inputs);
    
    // Fetch WR players and their stats
    const playerIds = await fetchPlayerIdsForPosition('WR', 100);
    const scores = await forgeService.getForgeScoresForPlayers(playerIds, season, week === 'full' ? 17 : week);
    
    // For each player, estimate their WR Core Alpha subscores from FORGE context
    const playerMatches = await Promise.all(
      scores.map(async (score) => {
        try {
          const playerData = await fetchPlayerWRCoreData(score.playerId, season, week);
          if (!playerData) return null;
          
          const playerSubscores = computeWRCoreSubscores(playerData);
          const similarity = computeSimilarity(userSubscores, playerSubscores);
          
          return {
            playerId: score.playerId,
            playerName: score.playerName,
            team: score.nflTeam || '',
            WR_Alpha: parseFloat(playerSubscores.WR_Alpha.toFixed(2)),
            Chain: parseFloat(playerSubscores.Chain.toFixed(4)),
            Explosive: parseFloat(playerSubscores.Explosive.toFixed(4)),
            WinSkill: parseFloat(playerSubscores.WinSkill.toFixed(4)),
            similarity: parseFloat(similarity.toFixed(4)),
            rawInputs: playerData,
          };
        } catch (e) {
          return null;
        }
      })
    );
    
    // Filter nulls, sort by similarity, take top N
    const topMatches = playerMatches
      .filter((m): m is NonNullable<typeof m> => m !== null)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, Math.min(limit, 10));
    
    return res.json({
      success: true,
      meta: {
        season,
        week,
        userInputs: inputs,
        userSubscores: {
          Chain: parseFloat(userSubscores.Chain.toFixed(4)),
          Explosive: parseFloat(userSubscores.Explosive.toFixed(4)),
          WinSkill: parseFloat(userSubscores.WinSkill.toFixed(4)),
          WR_Alpha: parseFloat(userSubscores.WR_Alpha.toFixed(2)),
        },
        matchCount: topMatches.length,
      },
      matches: topMatches.map((m, idx) => ({
        rank: idx + 1,
        ...m,
      })),
    });
    
  } catch (error) {
    console.error('[FORGE/Lab] WR Core matches error:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Match calculation failed',
    });
  }
});

/**
 * Compute WR Core Alpha subscores from raw inputs
 */
function computeWRCoreSubscores(inputs: { TS: number; YPRR: number; FD_RR: number; YAC: number; CC: number }) {
  const { TS, YPRR, FD_RR, YAC, CC } = inputs;
  
  // Normalize inputs
  const TS_norm = Math.min(TS / 0.30, 1);
  const YPRR_norm = Math.min(YPRR / 2.70, 1);
  const FD_norm = Math.min(FD_RR / 0.12, 1);
  const YAC_norm = Math.min(YAC / 6.00, 1);
  const CC_norm = CC;
  
  // Compute subscores
  const Chain = 0.55 * FD_norm + 0.45 * TS_norm;
  const Explosive = 0.60 * YPRR_norm + 0.40 * YAC_norm;
  const WinSkill = CC_norm;
  
  // Final alpha
  const WR_Core = 0.40 * Chain + 0.40 * Explosive + 0.20 * WinSkill;
  const WR_Alpha = 25 + 65 * WR_Core;
  
  return { Chain, Explosive, WinSkill, WR_Alpha };
}

/**
 * Compute similarity between user subscores and player subscores (0-1)
 * Uses weighted Euclidean distance converted to similarity
 */
function computeSimilarity(
  user: { Chain: number; Explosive: number; WinSkill: number },
  player: { Chain: number; Explosive: number; WinSkill: number }
): number {
  // Weight the subscores (same as WR Core blend)
  const weights = { Chain: 0.40, Explosive: 0.40, WinSkill: 0.20 };
  
  const diffChain = (user.Chain - player.Chain) ** 2 * weights.Chain;
  const diffExplosive = (user.Explosive - player.Explosive) ** 2 * weights.Explosive;
  const diffWinSkill = (user.WinSkill - player.WinSkill) ** 2 * weights.WinSkill;
  
  const distance = Math.sqrt(diffChain + diffExplosive + diffWinSkill);
  
  // Convert distance to similarity (max distance ~1, so similarity = 1 - distance)
  return Math.max(0, 1 - distance);
}

/**
 * Fetch player's WR Core data from game logs and identity
 */
async function fetchPlayerWRCoreData(
  playerId: string, 
  season: number, 
  week: number | 'full'
): Promise<{ TS: number; YPRR: number; FD_RR: number; YAC: number; CC: number } | null> {
  try {
    const identity = await PlayerIdentityService.getInstance().getByAnyId(playerId);
    if (!identity || identity.position !== 'WR') return null;
    
    const sleeperId = identity.externalIds?.sleeper;
    if (!sleeperId) return null;
    
    // Get game logs for the season
    const gameLogs = await db
      .select()
      .from(require('@shared/schema').sleeperPlayerGameLogs)
      .where(
        and(
          eq(require('@shared/schema').sleeperPlayerGameLogs.sleeperId, sleeperId),
          eq(require('@shared/schema').sleeperPlayerGameLogs.season, season),
          eq(require('@shared/schema').sleeperPlayerGameLogs.seasonType, 'REG')
        )
      );
    
    if (gameLogs.length === 0) return null;
    
    // Filter by week if specified - 'full' aggregates all weeks, specific week filters up to that week
    const logs = week === 'full' 
      ? gameLogs 
      : gameLogs.filter(g => g.week <= week);
    
    if (logs.length === 0) return null;
    
    // Aggregate stats across all matching logs
    const totals = logs.reduce((acc, log) => {
      const stats = log.stats as Record<string, number> || {};
      return {
        targets: acc.targets + (stats.rec_tgt || 0),
        receptions: acc.receptions + (stats.rec || 0),
        recYards: acc.recYards + (stats.rec_yd || 0),
        yac: acc.yac + (stats.rec_yac || 0),
        firstDowns: acc.firstDowns + (stats.rec_fd || 0),
        games: acc.games + 1,
      };
    }, { targets: 0, receptions: 0, recYards: 0, yac: 0, firstDowns: 0, games: 0 });
    
    // Require minimum data to compute valid metrics
    if (totals.targets < 5 || totals.games < 1) return null;
    
    // Estimate metrics (use reasonable approximations for missing data)
    const gamesPlayed = totals.games || 1;
    const teamPassAtt = gamesPlayed * 35; // League avg ~35 pass attempts per game
    
    // Target Share = targets / team pass attempts (estimated)
    const TS = totals.targets / teamPassAtt;
    
    // YPRR - estimate as yards per target * catch rate (approximation)
    const catchRate = totals.targets > 0 ? totals.receptions / totals.targets : 0;
    const yardsPerTarget = totals.targets > 0 ? totals.recYards / totals.targets : 0;
    const YPRR = yardsPerTarget * 0.9; // Rough conversion factor
    
    // First Downs per Route Run - estimate as FD per target
    const FD_RR = totals.targets > 0 ? totals.firstDowns / totals.targets : 0;
    
    // YAC per reception
    const YAC = totals.receptions > 0 ? totals.yac / totals.receptions : 0;
    
    // Contested Catch Rate - use catch rate as proxy (no contested data available)
    const CC = catchRate;
    
    // Validate all values are valid numbers
    if ([TS, YPRR, FD_RR, YAC, CC].some(v => isNaN(v) || !isFinite(v))) {
      return null;
    }
    
    return { TS, YPRR, FD_RR, YAC, CC };
  } catch (e) {
    console.error(`[FORGE/Lab] Error fetching WR core data for ${playerId}:`, e);
    return null;
  }
}

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

// ========================================
// DEBUG ENDPOINTS - Environment & Matchup
// ========================================

import { getTeamEnvironment, getAllTeamEnvironments } from './environmentService';
import { getMatchupContext, getDefenseMatchups } from './matchupService';
import { refreshForgeContext } from './envMatchupRefresh';

/**
 * GET /api/forge/env
 * 
 * Debug endpoint to inspect team environment scores.
 * 
 * Query params:
 * - season (optional): number, defaults to 2025
 * - week (optional): number, defaults to 10
 * - team (optional): team abbreviation, defaults to 'KC'
 */
router.get('/env', async (req: Request, res: Response) => {
  try {
    const season = parseInt(req.query.season as string) || 2025;
    const week = parseInt(req.query.week as string) || 10;
    const team = (req.query.team as string)?.toUpperCase() || 'KC';

    console.log(`[FORGE/Debug] Environment request: season=${season}, week=${week}, team=${team}`);

    const env = await getTeamEnvironment(season, week, team);

    return res.json({
      meta: { season, week, team },
      env,
      _debug: {
        hasData: env !== null,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error('[FORGE/Debug] env endpoint error:', err);
    return res.status(500).json({ error: 'env debug failed' });
  }
});

/**
 * GET /api/forge/env/all
 * 
 * Get all team environment scores for a given week.
 * Useful for seeing the full distribution.
 */
router.get('/env/all', async (req: Request, res: Response) => {
  try {
    const season = parseInt(req.query.season as string) || 2025;
    const week = parseInt(req.query.week as string) || 10;

    const envs = await getAllTeamEnvironments(season, week);

    return res.json({
      meta: { season, week },
      count: envs.length,
      environments: envs.sort((a, b) => b.envScore100 - a.envScore100),
    });
  } catch (err) {
    console.error('[FORGE/Debug] env/all endpoint error:', err);
    return res.status(500).json({ error: 'env/all debug failed' });
  }
});

/**
 * GET /api/forge/matchup
 * 
 * Debug endpoint to inspect position-specific matchup scores.
 * 
 * Query params:
 * - season (optional): number, defaults to 2025
 * - week (optional): number, defaults to 10
 * - offense (optional): offense team abbreviation, defaults to 'KC'
 * - defense (optional): defense team abbreviation, defaults to 'LV'
 * - position (optional): WR | RB | TE | QB, defaults to 'WR'
 */
router.get('/matchup', async (req: Request, res: Response) => {
  try {
    const season = parseInt(req.query.season as string) || 2025;
    const week = parseInt(req.query.week as string) || 10;
    const offense = (req.query.offense as string)?.toUpperCase() || 'KC';
    const defense = (req.query.defense as string)?.toUpperCase() || 'LV';
    const position = ((req.query.position as string)?.toUpperCase() || 'WR') as PlayerPosition;

    if (!['WR', 'RB', 'TE', 'QB'].includes(position)) {
      return res.status(400).json({ error: 'Invalid position. Must be WR, RB, TE, or QB.' });
    }

    console.log(`[FORGE/Debug] Matchup request: season=${season}, week=${week}, offense=${offense}, defense=${defense}, position=${position}`);

    const matchup = await getMatchupContext(season, week, offense, defense, position);

    return res.json({
      meta: { season, week, offense, defense, position },
      matchup,
      _debug: {
        hasData: matchup.matchupScore100 !== 50 || matchup.metrics !== undefined,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error('[FORGE/Debug] matchup endpoint error:', err);
    return res.status(500).json({ error: 'matchup debug failed' });
  }
});

/**
 * GET /api/forge/matchup/defense
 * 
 * Get all position matchup scores for a specific defense.
 */
router.get('/matchup/defense', async (req: Request, res: Response) => {
  try {
    const season = parseInt(req.query.season as string) || 2025;
    const week = parseInt(req.query.week as string) || 10;
    const defense = (req.query.defense as string)?.toUpperCase() || 'LV';

    const matchups = await getDefenseMatchups(season, week, defense);

    return res.json({
      meta: { season, week, defense },
      matchups,
    });
  } catch (err) {
    console.error('[FORGE/Debug] matchup/defense endpoint error:', err);
    return res.status(500).json({ error: 'matchup/defense debug failed' });
  }
});

/**
 * POST /api/forge/admin/refresh
 * 
 * Refresh environment and matchup context tables for a given week.
 * This populates forge_team_environment and forge_team_matchup_context.
 */
router.post('/admin/refresh', async (req: Request, res: Response) => {
  try {
    const season = parseInt(req.body.season as string) || parseInt(req.query.season as string) || 2025;
    const week = parseInt(req.body.week as string) || parseInt(req.query.week as string) || 10;

    console.log(`[FORGE/Admin] Refresh request: season=${season}, week=${week}`);

    const result = await refreshForgeContext(season, week);

    return res.json({
      success: true,
      meta: { season, week },
      result,
      message: `Refreshed ${result.environments} environments and ${result.matchups} matchup contexts`,
    });
  } catch (err) {
    console.error('[FORGE/Admin] refresh endpoint error:', err);
    return res.status(500).json({ success: false, error: 'Refresh failed' });
  }
});

export function registerForgeRoutes(app: any): void {
  app.use('/api/forge', router);
  console.log('🔥 FORGE v0.1 routes mounted at /api/forge/*');
}

export default router;
