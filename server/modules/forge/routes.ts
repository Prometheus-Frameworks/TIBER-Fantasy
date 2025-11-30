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
import { playerIdentityMap, gameLogs } from '@shared/schema';
import { eq, and, isNotNull, sql } from 'drizzle-orm';
import { createForgeSnapshot } from './forgeSnapshot';
import { computeFPRForPlayer } from './fibonacciPatternResonance';
import { PlayerIdentityService } from '../../services/PlayerIdentityService';
import { getForgePlayerContext, searchForgePlayersSimple } from './forgePlayerContext';
import { 
  getTeamPositionSoS, 
  getPlayerSoS, 
  getAllTeamSoSByPosition,
  getTeamWeeklySoS 
} from './sosService';
import { applySosMultiplier } from './helpers/sosMultiplier';
import { ForgeScore } from './types';

const router = Router();

/**
 * Extended ForgeScore with SoS enrichment
 */
interface ForgeScoreWithSoS extends ForgeScore {
  alphaBase: number;       // Pre-SoS alpha (what was 'alpha')
  sosRos: number;          // RoS SoS (0-100, higher = easier)
  sosNext3: number;        // Next 3 weeks SoS
  sosPlayoffs: number;     // Weeks 15-17 SoS
  sosNorm: number;         // Normalized SoS (0-1)
  sosMultiplier: number;   // SoS multiplier (0.90-1.10)
}

/**
 * Enrich a ForgeScore with SoS data
 * - alphaBase = original alpha
 * - alpha = SoS-adjusted alpha
 * - Adds sosRos, sosNext3, sosPlayoffs, sosNorm, sosMultiplier
 */
async function enrichWithSoS(score: ForgeScore, season: number): Promise<ForgeScoreWithSoS> {
  const baseAlpha = score.alpha;
  
  // Get SoS for this player
  const sos = await getPlayerSoS(score.playerId, season);
  const ros = sos?.sos?.ros ?? 50;
  const next3 = sos?.sos?.next3 ?? 50;
  const playoffs = sos?.sos?.playoffs ?? 50;
  
  // Apply SoS multiplier
  const { norm, multiplier, finalAlpha } = applySosMultiplier(baseAlpha, ros);
  
  return {
    ...score,
    alpha: Math.round(finalAlpha * 10) / 10,  // SoS-adjusted alpha
    alphaBase: baseAlpha,                      // Original pre-SoS alpha
    sosRos: ros,
    sosNext3: next3,
    sosPlayoffs: playoffs,
    sosNorm: Math.round(norm * 1000) / 1000,
    sosMultiplier: Math.round(multiplier * 1000) / 1000,
  };
}

/**
 * Batch enrich multiple scores with SoS data (parallel)
 */
async function enrichScoresWithSoS(scores: ForgeScore[], season: number): Promise<ForgeScoreWithSoS[]> {
  const enriched = await Promise.all(
    scores.map(score => enrichWithSoS(score, season).catch(() => ({
      ...score,
      alphaBase: score.alpha,
      sosRos: 50,
      sosNext3: 50,
      sosPlayoffs: 50,
      sosNorm: 0.5,
      sosMultiplier: 1.0,
    } as ForgeScoreWithSoS)))
  );
  return enriched;
}

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
 * - season (optional): number, defaults to 2025
 * - week (optional): number, defaults to 17
 * - limit (optional): number, defaults to 50
 * - playerIds (optional): comma-separated canonical IDs
 */
router.get('/preview', async (req: Request, res: Response) => {
  try {
    const position = (req.query.position as string)?.toUpperCase() as PlayerPosition;
    const season = parseInt(req.query.season as string) || 2025;
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
    
    // Enrich scores with SoS data
    const enrichedScores = await enrichScoresWithSoS(scores, season);
    
    // Sort by SoS-adjusted alpha (higher first)
    const sortedScores = enrichedScores.sort((a, b) => b.alpha - a.alpha);
    
    return res.json({
      success: true,
      meta: {
        position,
        season,
        week,
        requestedCount: playerIds.length,
        returnedCount: sortedScores.length,
        sosIntegrated: true,
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
 * - season (optional): number, defaults to 2025
 * - week (optional): number, defaults to 17
 */
router.get('/score/:playerId', async (req: Request, res: Response) => {
  try {
    const { playerId } = req.params;
    const season = parseInt(req.query.season as string) || 2025;
    const week = parseInt(req.query.week as string) || 17;
    
    if (!playerId) {
      return res.status(400).json({
        success: false,
        error: 'Missing playerId parameter',
      });
    }
    
    console.log(`[FORGE/Routes] Score request: playerId=${playerId}, season=${season}, week=${week}`);
    
    const score = await forgeService.getForgeScoreForPlayer(playerId, season, week);
    
    // Enrich with SoS data
    const enrichedScore = await enrichWithSoS(score, season);
    
    return res.json({
      success: true,
      score: enrichedScore,
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
 * - season (optional): number, defaults to 2025
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
        : 2025;

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

    // Enrich scores with SoS data
    const enrichedScores = await enrichScoresWithSoS(scores, normalizedSeason);

    // Sort by SoS-adjusted alpha (higher first)
    const sortedScores = enrichedScores.sort((a, b) => b.alpha - a.alpha);

    return res.json({
      success: true,
      scores: sortedScores,
      meta: {
        position: normalizedPosition ?? 'ALL',
        limit: normalizedLimit,
        season: normalizedSeason,
        week: normalizedWeek,
        count: sortedScores.length,
        sosIntegrated: true,
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
 * - season: number (defaults to 2025)
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
    
    // Get game logs for the season (REG = Regular season)
    const playerGameLogs = await db
      .select()
      .from(gameLogs)
      .where(
        and(
          eq(gameLogs.sleeperId, sleeperId),
          eq(gameLogs.season, season),
          eq(gameLogs.seasonType, 'REG')
        )
      );
    
    if (playerGameLogs.length === 0) return null;
    
    // Filter by week if specified - 'full' aggregates all weeks, specific week filters up to that week
    const logs = week === 'full' 
      ? playerGameLogs 
      : playerGameLogs.filter(g => g.week <= week);
    
    if (logs.length === 0) return null;
    
    // Aggregate stats across all matching logs - use typed column names from schema
    const totals = logs.reduce((acc, log) => {
      return {
        targets: acc.targets + (log.targets || 0),
        receptions: acc.receptions + (log.receptions || 0),
        recYards: acc.recYards + (log.recYards || 0),
        yac: acc.yac + 0, // YAC not available in gameLogs schema - will estimate
        firstDowns: acc.firstDowns + 0, // First downs not available - will estimate
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
    
    // YPRR - estimate as yards per target (approximation)
    const yardsPerTarget = totals.targets > 0 ? totals.recYards / totals.targets : 0;
    const YPRR = yardsPerTarget * 0.75; // Rough conversion factor (yards per target to YPRR)
    
    // First Downs per Route Run - estimate using receptions and yards (FD not in schema)
    // Estimate: approximately 1 first down per 12 yards
    const estimatedFirstDowns = totals.recYards / 12;
    const FD_RR = totals.targets > 0 ? estimatedFirstDowns / totals.targets : 0;
    
    // YAC per reception - estimate as 35% of yards per reception (league avg)
    const yardsPerRec = totals.receptions > 0 ? totals.recYards / totals.receptions : 0;
    const YAC = yardsPerRec * 0.35;
    
    // Contested Catch Rate - use catch rate as proxy (no contested data available)
    const catchRate = totals.targets > 0 ? totals.receptions / totals.targets : 0;
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
import { refreshForgeContext, getEnvDebug, getMatchupDebug } from './envMatchupRefresh';

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
 * GET /api/forge/env-debug
 * 
 * v0.2 Debug endpoint: Shows component breakdown for environment score.
 * Returns raw values and robust-normalized scores for each pillar.
 * 
 * Query params:
 * - team: team abbreviation (required)
 * - season (optional): defaults to 2025
 * - week (optional): defaults to 12 (most recently completed week)
 */
router.get('/env-debug', async (req: Request, res: Response) => {
  try {
    const season = parseInt(req.query.season as string) || 2025;
    const week = parseInt(req.query.week as string) || 12;
    const team = (req.query.team as string)?.toUpperCase() || 'KC';

    const debug = await getEnvDebug(season, week, team);

    if (!debug) {
      return res.status(404).json({
        error: 'No data found',
        meta: { season, week, team },
      });
    }

    return res.json({
      meta: { team, season, week },
      components: debug.components,
      env_score_100: debug.env_score_100,
    });
  } catch (err) {
    console.error('[FORGE/Debug] env-debug endpoint error:', err);
    return res.status(500).json({ error: 'env-debug failed' });
  }
});

/**
 * GET /api/forge/matchup-debug
 * 
 * v0.2 Debug endpoint: Shows component breakdown for matchup score.
 * Returns raw values and robust-normalized scores for each factor.
 * Currently only supports WR position.
 * 
 * Query params:
 * - defense: defense team abbreviation (required)
 * - position: WR | RB | TE (defaults to WR)
 * - season (optional): defaults to 2025
 * - week (optional): defaults to 12 (most recently completed week)
 */
router.get('/matchup-debug', async (req: Request, res: Response) => {
  try {
    const season = parseInt(req.query.season as string) || 2025;
    const week = parseInt(req.query.week as string) || 12;
    const defense = (req.query.defense as string)?.toUpperCase() || 'NYJ';
    const position = ((req.query.position as string)?.toUpperCase() || 'WR') as PlayerPosition;

    if (position !== 'WR') {
      return res.json({
        meta: { defense, position, season, week },
        message: 'Component debug only available for WR position in v0.2',
        matchup_score_100: null,
      });
    }

    const debug = await getMatchupDebug(season, week, defense, position);

    if (!debug) {
      return res.status(404).json({
        error: 'No data found',
        meta: { defense, position, season, week },
      });
    }

    return res.json({
      meta: { defense, position, season, week },
      components: debug.components,
      matchup_score_100: debug.matchup_score_100,
    });
  } catch (err) {
    console.error('[FORGE/Debug] matchup-debug endpoint error:', err);
    return res.status(500).json({ error: 'matchup-debug failed' });
  }
});

// ========================================
// PUBLIC MATCHUPS UI ENDPOINTS
// ========================================

/**
 * Get matchup band label based on score
 */
function getMatchupBand(score: number): string {
  if (score >= 75) return 'Smash';
  if (score >= 60) return 'Good';
  if (score >= 45) return 'Neutral';
  if (score >= 30) return 'Tough';
  return 'Stay Away';
}

/**
 * Get style tag based on pass/rush EPA ratio
 */
function getStyleTag(passEpa: number | null, rushEpa: number | null): string {
  if (passEpa === null || rushEpa === null) return 'Balanced';
  const ratio = passEpa / Math.max(0.01, Math.abs(rushEpa) + Math.abs(passEpa));
  if (ratio >= 0.6) return 'Pass-leaning';
  if (ratio <= 0.4) return 'Run-heavy';
  return 'Balanced';
}

/**
 * GET /api/forge/env-season
 * 
 * Season-level environment scores per team.
 * Aggregates data across all weeks for the selected season.
 * 
 * Query params:
 * - season (optional): defaults to 2025
 */
router.get('/env-season', async (req: Request, res: Response) => {
  try {
    const season = parseInt(req.query.season as string) || 2025;

    console.log(`[FORGE/UI] env-season request: season=${season}`);

    const results = await db.execute(sql`
      WITH latest_week AS (
        SELECT MAX(week) as max_week FROM team_offensive_context WHERE season = ${season}
      ),
      env_data AS (
        SELECT 
          o.team,
          o.pass_epa,
          o.rush_epa,
          o.run_success_rate,
          COALESCE(e.env_score_100, 50) as env_score_100
        FROM team_offensive_context o
        LEFT JOIN forge_team_environment e 
          ON o.season = e.season AND o.week = e.week AND o.team = e.team
        WHERE o.season = ${season} 
          AND o.week = (SELECT max_week FROM latest_week)
      )
      SELECT 
        team,
        env_score_100,
        pass_epa,
        rush_epa
      FROM env_data
      ORDER BY env_score_100 DESC
    `);

    const teams = (results.rows as any[]).map((row, idx) => ({
      rank: idx + 1,
      season,
      team: row.team,
      envScore100: Math.round(row.env_score_100 || 50),
      passEpaPerPlay: row.pass_epa ? parseFloat(row.pass_epa.toFixed(3)) : 0,
      rushEpaPerPlay: row.rush_epa ? parseFloat(row.rush_epa.toFixed(3)) : 0,
      styleTag: getStyleTag(row.pass_epa, row.rush_epa),
    }));

    return res.json({
      meta: { season, count: teams.length },
      teams,
    });
  } catch (err) {
    console.error('[FORGE/UI] env-season endpoint error:', err);
    return res.status(500).json({ error: 'env-season failed' });
  }
});

/**
 * GET /api/forge/matchups
 * 
 * Weekly matchup cards for the UI.
 * Returns game-by-game matchup data with environment and matchup scores.
 * 
 * Query params:
 * - season (optional): defaults to 2025
 * - week (optional): defaults to 12
 * - position (optional): WR | RB | TE, defaults to WR
 */
router.get('/matchups', async (req: Request, res: Response) => {
  try {
    const season = parseInt(req.query.season as string) || 2025;
    const week = parseInt(req.query.week as string) || 12;
    const position = ((req.query.position as string)?.toUpperCase() || 'WR') as PlayerPosition;

    if (!['WR', 'RB', 'TE'].includes(position)) {
      return res.status(400).json({ error: 'Invalid position. Must be WR, RB, or TE.' });
    }

    console.log(`[FORGE/UI] matchups request: season=${season}, week=${week}, position=${position}`);

    // Get unique games from PBP data
    const gamesResult = await db.execute(sql`
      SELECT DISTINCT 
        LEAST(posteam, defteam) as team_a,
        GREATEST(posteam, defteam) as team_b
      FROM bronze_nflfastr_plays
      WHERE season = ${season} 
        AND week = ${week}
        AND posteam IS NOT NULL 
        AND defteam IS NOT NULL
      ORDER BY team_a
    `);

    const games = gamesResult.rows as { team_a: string; team_b: string }[];

    // Get all environment scores for the week
    const envResult = await db.execute(sql`
      SELECT team, env_score_100 
      FROM forge_team_environment 
      WHERE season = ${season} AND week = ${week}
    `);
    const envMap = new Map<string, number>();
    for (const row of envResult.rows as any[]) {
      envMap.set(row.team, row.env_score_100 || 50);
    }

    // Get all matchup scores for the week and position
    const matchupResult = await db.execute(sql`
      SELECT defense_team, matchup_score_100
      FROM forge_team_matchup_context
      WHERE season = ${season} AND week = ${week} AND position = ${position}
    `);
    const matchupMap = new Map<string, number>();
    for (const row of matchupResult.rows as any[]) {
      matchupMap.set(row.defense_team, row.matchup_score_100 || 50);
    }

    // Build matchup cards - one entry per offense per game
    // Each game has exactly 2 entries: away offense (isHome=false) and home offense (isHome=true)
    const matchups: any[] = [];

    for (const game of games) {
      // Alphabetically sorted, so team_a is always "away" and team_b is "home"
      const gameId = `${game.team_a}@${game.team_b}-${season}-${week}`;
      
      // Away team (team_a) on offense vs Home team (team_b) defense
      const awayEnv = envMap.get(game.team_a) || 50;
      const awayVsHomeDef = matchupMap.get(game.team_b) || 50; // Away offense faces Home's defense
      
      // Home team (team_b) on offense vs Away team (team_a) defense  
      const homeEnv = envMap.get(game.team_b) || 50;
      const homeVsAwayDef = matchupMap.get(game.team_a) || 50; // Home offense faces Away's defense

      // Away offense entry (isHome=false)
      matchups.push({
        season,
        week,
        gameId,
        isHome: false,
        offenseTeam: game.team_a,
        defenseTeam: game.team_b,
        position,
        offenseEnvScore100: Math.round(awayEnv),
        offenseMatchupScore100: Math.round(awayVsHomeDef),
        offenseBand: getMatchupBand(awayVsHomeDef),
      });

      // Home offense entry (isHome=true)
      matchups.push({
        season,
        week,
        gameId,
        isHome: true,
        offenseTeam: game.team_b,
        defenseTeam: game.team_a,
        position,
        offenseEnvScore100: Math.round(homeEnv),
        offenseMatchupScore100: Math.round(homeVsAwayDef),
        offenseBand: getMatchupBand(homeVsAwayDef),
      });
    }

    // Sort by gameId then isHome (away first, home second) for deterministic ordering
    matchups.sort((a, b) => {
      if (a.gameId !== b.gameId) return a.gameId.localeCompare(b.gameId);
      return a.isHome ? 1 : -1;
    });

    return res.json({
      meta: { season, week, position, gameCount: games.length },
      matchups,
    });
  } catch (err) {
    console.error('[FORGE/UI] matchups endpoint error:', err);
    return res.status(500).json({ error: 'matchups failed' });
  }
});

/**
 * GET /api/forge/weeks
 * 
 * Get available weeks with data for a season.
 */
router.get('/weeks', async (req: Request, res: Response) => {
  try {
    const season = parseInt(req.query.season as string) || 2025;

    const result = await db.execute(sql`
      SELECT DISTINCT week 
      FROM bronze_nflfastr_plays 
      WHERE season = ${season}
      ORDER BY week DESC
    `);

    const weeks = (result.rows as any[]).map(r => r.week);

    return res.json({
      season,
      weeks,
      currentWeek: weeks[0] || 12,
    });
  } catch (err) {
    console.error('[FORGE/UI] weeks endpoint error:', err);
    return res.status(500).json({ error: 'weeks failed' });
  }
});

/**
 * GET /api/forge/player-context/:playerId
 * 
 * Get complete FORGE player context including identity, team, and advanced stats.
 */
router.get('/player-context/:playerId', async (req: Request, res: Response) => {
  try {
    const { playerId } = req.params;
    const season = parseInt(req.query.season as string) || 2025;

    if (!playerId) {
      return res.status(400).json({ error: 'Missing playerId parameter' });
    }

    console.log(`[FORGE/PlayerContext] Request: playerId=${playerId}, season=${season}`);

    const ctx = await getForgePlayerContext(playerId, season);

    if (!ctx) {
      return res.status(404).json({ error: `Player not found: ${playerId}` });
    }

    return res.json(ctx);
  } catch (err) {
    console.error('[FORGE/PlayerContext] Error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/forge/search-players
 * 
 * Search players by name for admin pages.
 * Returns identity + current team from roster.
 */
router.get('/search-players', async (req: Request, res: Response) => {
  try {
    const query = (req.query.query as string) || '';
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);

    if (!query || query.trim().length < 2) {
      return res.json([]);
    }

    console.log(`[FORGE/Search] Query: "${query}", limit=${limit}`);

    const results = await searchForgePlayersSimple(query, limit);

    return res.json(results);
  } catch (err) {
    console.error('[FORGE/Search] Error:', err);
    return res.status(500).json({ error: 'Search failed' });
  }
});

// =============================================
// FORGE Strength of Schedule (SoS) Endpoints
// =============================================

/**
 * GET /api/forge/sos/team-position
 * 
 * Get team + position SoS data.
 * 
 * Query params:
 * - season (required): number, e.g. 2025
 * - team (required): team code, e.g. 'DAL'
 * - position (required): 'QB' | 'RB' | 'WR' | 'TE'
 * - includeWeekly (optional): boolean, include weekly matchup breakdown
 */
router.get('/sos/team-position', async (req: Request, res: Response) => {
  try {
    const season = parseInt(req.query.season as string);
    const team = (req.query.team as string)?.toUpperCase();
    const position = (req.query.position as string)?.toUpperCase();
    const includeWeekly = req.query.includeWeekly === 'true';

    if (!season || isNaN(season)) {
      return res.status(400).json({ 
        error: 'Missing or invalid season parameter',
        example: '?season=2025&team=DAL&position=WR'
      });
    }

    if (!team) {
      return res.status(400).json({ 
        error: 'Missing team parameter',
        example: '?season=2025&team=DAL&position=WR'
      });
    }

    if (!position || !['QB', 'RB', 'WR', 'TE'].includes(position)) {
      return res.status(400).json({ 
        error: 'Invalid or missing position. Must be QB, RB, WR, or TE.',
        example: '?season=2025&team=DAL&position=WR'
      });
    }

    console.log(`[FORGE/SoS] Team-Position request: season=${season}, team=${team}, position=${position}`);

    const result = includeWeekly 
      ? await getTeamWeeklySoS(team, position, season)
      : await getTeamPositionSoS(team, position, season);

    if (!result) {
      return res.status(404).json({ 
        error: `No SoS data found for ${team} ${position} in ${season}`,
        hint: 'Team code may not exist in schedule or matchup context tables'
      });
    }

    return res.json(result);
  } catch (err) {
    console.error('[FORGE/SoS] Team-Position error:', err);
    return res.status(500).json({ error: 'Failed to calculate team-position SoS' });
  }
});

/**
 * GET /api/forge/sos/player/:playerId
 * 
 * Get player-level SoS data.
 * Resolves player to team + position, then returns SoS for that combination.
 * 
 * Path params:
 * - playerId (required): canonical player ID
 * 
 * Query params:
 * - season (required): number, e.g. 2025
 */
router.get('/sos/player/:playerId', async (req: Request, res: Response) => {
  try {
    const playerId = req.params.playerId;
    const season = parseInt(req.query.season as string);

    if (!playerId) {
      return res.status(400).json({ error: 'Missing playerId path parameter' });
    }

    if (!season || isNaN(season)) {
      return res.status(400).json({ 
        error: 'Missing or invalid season query parameter',
        example: `/api/forge/sos/player/${playerId}?season=2025`
      });
    }

    console.log(`[FORGE/SoS] Player request: playerId=${playerId}, season=${season}`);

    const result = await getPlayerSoS(playerId, season);

    if (!result) {
      return res.status(404).json({ 
        error: `Player not found: ${playerId}`,
        hint: 'Ensure playerId matches canonical_id in player_identity_map'
      });
    }

    if (result.meta.remainingWeeks === 0 && !result.meta.team) {
      return res.status(404).json({
        error: `Player ${playerId} has no current team`,
        meta: result.meta,
        hint: 'Player may be a free agent or retired'
      });
    }

    return res.json(result);
  } catch (err) {
    console.error('[FORGE/SoS] Player error:', err);
    return res.status(500).json({ error: 'Failed to calculate player SoS' });
  }
});

/**
 * GET /api/forge/sos/rankings
 * 
 * Get SoS rankings for all teams by position.
 * Returns teams sorted by RoS SoS (easiest schedule first).
 * 
 * Query params:
 * - season (required): number, e.g. 2025
 * - position (required): 'QB' | 'RB' | 'WR' | 'TE'
 */
router.get('/sos/rankings', async (req: Request, res: Response) => {
  try {
    const season = parseInt(req.query.season as string);
    const position = (req.query.position as string)?.toUpperCase();

    if (!season || isNaN(season)) {
      return res.status(400).json({ 
        error: 'Missing or invalid season parameter',
        example: '?season=2025&position=WR'
      });
    }

    if (!position || !['QB', 'RB', 'WR', 'TE'].includes(position)) {
      return res.status(400).json({ 
        error: 'Invalid or missing position. Must be QB, RB, WR, or TE.',
        example: '?season=2025&position=WR'
      });
    }

    console.log(`[FORGE/SoS] Rankings request: season=${season}, position=${position}`);

    const rankings = await getAllTeamSoSByPosition(position, season);

    return res.json({
      meta: {
        season,
        position,
        teamsCount: rankings.length,
        generatedAt: new Date().toISOString(),
      },
      rankings: rankings.map((r, i) => ({
        rank: i + 1,
        ...r,
      })),
    });
  } catch (err) {
    console.error('[FORGE/SoS] Rankings error:', err);
    return res.status(500).json({ error: 'Failed to get SoS rankings' });
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
  console.log('🔥 FORGE v0.2 routes mounted at /api/forge/*');
}

export default router;
