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
import { populateQbContext2025, getPrimaryQbContext } from './qbContextPopulator';
import { applySosMultiplier } from './helpers/sosMultiplier';
import { ForgeScore } from './types';
import { batchCalculateAlphaV2, AlphaV2Result } from './alphaV2';
import { sleeperLiveStatusSync } from '../../services/sleeperLiveStatusSync';
import { evaluate, recordEvents } from '../sentinel/sentinelEngine';
import { computeAllGrades, computeAndCacheGrades, getGradesFromCache, CACHE_VERSION } from './forgeGradeCache';

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
 * Preview FORGE alpha scores for players by position.
 * Uses weekly_stats-ranked player pool (not alphabetical).
 * 
 * Query params:
 * - position (required): WR | RB | TE | QB
 * - season (optional): number, defaults to 2025
 * - week (optional): number, defaults to 17
 * - limit (optional): number, defaults to 50, max 100
 * - playerIds (optional): comma-separated canonical IDs
 * - minGamesPlayed (optional): filter out players with fewer games
 * - minConfidence (optional): filter out players below confidence threshold
 */
router.get('/preview', async (req: Request, res: Response) => {
  try {
    const position = (req.query.position as string)?.toUpperCase() as PlayerPosition;
    const season = parseInt(req.query.season as string) || 2025;
    const week = parseInt(req.query.week as string) || 17;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const playerIdsParam = req.query.playerIds as string;
    const minGamesPlayed = parseInt(req.query.minGamesPlayed as string) || 0;
    const minConfidence = parseInt(req.query.minConfidence as string) || 0;
    
    if (!position || !['WR', 'RB', 'TE', 'QB'].includes(position)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or missing position. Must be WR, RB, TE, or QB.',
      });
    }
    
    console.log(`[FORGE/Routes] Preview request: position=${position}, season=${season}, week=${week}, limit=${limit}, minGames=${minGamesPlayed}, minConf=${minConfidence}`);
    
    let scores: ForgeScore[];
    
    if (playerIdsParam) {
      const playerIds = playerIdsParam.split(',').map(id => id.trim()).filter(Boolean);
      scores = await forgeService.getForgeScoresForPlayers(playerIds, season, week);
    } else {
      scores = await forgeService.getForgeScoresBatch({
        position: position as 'WR' | 'RB' | 'TE' | 'QB',
        limit: limit * 2,
        season,
        asOfWeek: week,
      });
    }
    
    if (scores.length === 0) {
      console.log(`[FORGE/Routes] No players found for ${position}`);
    }
    
    console.log(`[FORGE/Routes] Scored ${scores.length} ${position}s`);
    
    let filteredScores = scores;
    if (minGamesPlayed > 0) {
      filteredScores = filteredScores.filter(s => (s.gamesPlayed || 0) >= minGamesPlayed);
    }
    if (minConfidence > 0) {
      filteredScores = filteredScores.filter(s => (s.confidence || 0) >= minConfidence);
    }
    
    const enrichedScores = await enrichScoresWithSoS(filteredScores, season);
    
    const sortedScores = enrichedScores
      .sort((a, b) => b.alpha - a.alpha)
      .slice(0, limit);
    
    return res.json({
      success: true,
      meta: {
        position,
        season,
        week,
        requestedCount: limit,
        returnedCount: sortedScores.length,
        totalBeforeFilter: scores.length,
        filters: { minGamesPlayed, minConfidence },
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
 * GET /api/forge/preview-v2
 * 
 * Preview FORGE Alpha V2 scores - 2025 final formula
 * 
 * Key changes from V1:
 * - Hard games-played floor (MIN_GAMES = 4)
 * - Recency bias (last 4 weeks = 65%)
 * - Rebalanced position weights
 * - Elite ceiling protection
 * 
 * Query params:
 * - position (required): WR | RB | TE | QB
 * - season (optional): number, defaults to 2025
 * - week (optional): number, defaults to 14
 * - limit (optional): number, defaults to 50, max 100
 */
router.get('/preview-v2', async (req: Request, res: Response) => {
  try {
    const position = (req.query.position as string)?.toUpperCase() as PlayerPosition;
    const season = parseInt(req.query.season as string) || 2025;
    const week = parseInt(req.query.week as string) || 14;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    
    if (!position || !['WR', 'RB', 'TE', 'QB'].includes(position)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or missing position. Must be WR, RB, TE, or QB.',
      });
    }
    
    console.log(`[FORGE/Routes] Preview V2 request: position=${position}, season=${season}, week=${week}, limit=${limit}`);
    
    // Get V1 scores first
    const v1Scores = await forgeService.getForgeScoresBatch({
      position: position as 'WR' | 'RB' | 'TE' | 'QB',
      limit: 150,
      season,
      asOfWeek: week,
    });
    
    if (v1Scores.length === 0) {
      console.log(`[FORGE/Routes] No players found for ${position}`);
      return res.json({
        success: true,
        meta: {
          position,
          season,
          week,
          version: 'v2',
          returnedCount: 0,
        },
        scores: [],
      });
    }
    
    console.log(`[FORGE/Routes] Converting ${v1Scores.length} ${position}s to V2 Alpha`);
    
    // Calculate V2 Alpha for all players
    const v2Results = batchCalculateAlphaV2(v1Scores);
    
    // Sort by V2 Alpha and take top N
    const topScores = v2Results.slice(0, limit);
    
    // Count flagged players
    const flaggedCount = v2Results.filter(r => r.flags.length > 0).length;
    const lowSampleCount = v2Results.filter(r => r.gamesPlayed < 4).length;
    
    return res.json({
      success: true,
      meta: {
        position,
        season,
        week,
        version: 'v2',
        formula: {
          minGames: 4,
          recencyWeight: 0.65,
          baseWeight: 0.35,
          weights: {
            QB: { volume: 0.25, efficiency: 0.50, stability: 0.15, context: 0.10 },
            RB: { volume: 0.40, efficiency: 0.35, stability: 0.15, context: 0.10 },
            WR: { volume: 0.35, efficiency: 0.40, stability: 0.15, context: 0.10 },
            TE: { volume: 0.35, efficiency: 0.40, stability: 0.15, context: 0.10 },
          }[position],
        },
        requestedCount: limit,
        returnedCount: topScores.length,
        totalScored: v1Scores.length,
        flaggedCount,
        lowSampleCount,
        scoredAt: new Date().toISOString(),
      },
      scores: topScores,
    });
    
  } catch (error) {
    console.error('[FORGE/Routes] Preview V2 error:', error);
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


    const sentinelReport = evaluate('forge', {
      ...enrichedScore,
      mode: 'redraft',
      _endpoint: '/api/forge/score/:playerId',
    });

    if (sentinelReport.events.length > 0) {
      recordEvents(sentinelReport.events).catch((err) => {
        console.error('[Sentinel] Failed to record FORGE score events:', err);
      });
    }

    return res.json({
      success: true,
      score: enrichedScore,
      _sentinel: {
        checked: true,
        warnings: sentinelReport.warnings,
        blocks: sentinelReport.blocks,
      },
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
 * - startWeek (optional): number, start of week range filter
 * - endWeek (optional): number, end of week range filter
 * - leagueType (optional): 'redraft' | 'dynasty' (default: redraft)
 * - pprType (optional): '0.5' | '1' (default: 1 = full PPR)
 * 
 * v1.4: PPR/Dynasty adjustments:
 * - PPR: Scales efficiency subscore by reception weight (+2 pts per rec above position avg)
 * - Dynasty: Applies age multiplier (1.1 if <27, 0.95^(age-27) if >27)
 */
router.get('/batch', async (req: Request, res: Response) => {
  try {
    const { position, limit, season, week, startWeek, endWeek, leagueType, pprType } = req.query;

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

    // Week range filtering (v0.3)
    const normalizedStartWeek =
      typeof startWeek === 'string' && !Number.isNaN(Number(startWeek))
        ? Number(startWeek)
        : undefined;
    
    const normalizedEndWeek =
      typeof endWeek === 'string' && !Number.isNaN(Number(endWeek))
        ? Number(endWeek)
        : undefined;

    // v1.4: PPR/Dynasty scoring options
    const normalizedLeagueType = 
      typeof leagueType === 'string' && ['redraft', 'dynasty'].includes(leagueType)
        ? (leagueType as 'redraft' | 'dynasty')
        : undefined;
    
    const normalizedPprType = 
      typeof pprType === 'string' && ['0.5', '1'].includes(pprType)
        ? (pprType as '0.5' | '1')
        : undefined;

    const weekRangeStr = normalizedStartWeek && normalizedEndWeek 
      ? `, weeks ${normalizedStartWeek}-${normalizedEndWeek}` 
      : '';
    const optionsStr = normalizedLeagueType || normalizedPprType 
      ? ` [${normalizedLeagueType ?? 'redraft'}/${normalizedPprType ?? '1'}PPR]` 
      : '';
    console.log(`[FORGE/Routes] Batch request: position=${normalizedPosition ?? 'ALL'}, limit=${normalizedLimit}, season=${normalizedSeason}, week=${normalizedWeek}${weekRangeStr}${optionsStr}`);

    const scores = await forgeService.getForgeScoresBatch({
      position: normalizedPosition,
      limit: normalizedLimit,
      season: normalizedSeason,
      asOfWeek: normalizedWeek,
      startWeek: normalizedStartWeek,
      endWeek: normalizedEndWeek,
      leagueType: normalizedLeagueType,
      pprType: normalizedPprType,
    });

    // Enrich scores with SoS data
    const enrichedScores = await enrichScoresWithSoS(scores, normalizedSeason);

    // Sort by: alpha DESC, gamesPlayed DESC, playerName ASC (for stability)
    const sortedScores = enrichedScores.sort((a, b) => {
      // Primary: alpha score (higher first)
      if (b.alpha !== a.alpha) return b.alpha - a.alpha;
      // Secondary: games played (more games = more reliable)
      const aGP = a.gamesPlayed ?? 0;
      const bGP = b.gamesPlayed ?? 0;
      if (bGP !== aGP) return bGP - aGP;
      // Tertiary: alphabetical by name (for consistent ordering)
      return (a.playerName ?? '').localeCompare(b.playerName ?? '');
    });

    const mode = normalizedLeagueType ?? 'redraft';
    const perPlayerReports = sortedScores.map((score) =>
      evaluate('forge', {
        ...score,
        mode,
        _endpoint: '/api/forge/batch',
      })
    );
    const batchReport = evaluate('forge', {
      scores: sortedScores,
      count: sortedScores.length,
      position: normalizedPosition ?? 'ALL',
      _endpoint: '/api/forge/batch',
    });

    const sentinelWarnings = perPlayerReports.reduce((sum, report) => sum + report.warnings, 0) + batchReport.warnings;
    const sentinelBlocks = perPlayerReports.reduce((sum, report) => sum + report.blocks, 0) + batchReport.blocks;
    const sentinelEvents = [
      ...perPlayerReports.flatMap((report) => report.events),
      ...batchReport.events,
    ];

    if (sentinelEvents.length > 0) {
      recordEvents(sentinelEvents).catch((err) => {
        console.error('[Sentinel] Failed to record FORGE batch events:', err);
      });
    }

    return res.json({
      success: true,
      scores: sortedScores,
      meta: {
        position: normalizedPosition ?? 'ALL',
        limit: normalizedLimit,
        season: normalizedSeason,
        week: normalizedWeek,
        startWeek: normalizedStartWeek,
        endWeek: normalizedEndWeek,
        weekRangeActive: !!(normalizedStartWeek && normalizedEndWeek),
        count: sortedScores.length,
        sosIntegrated: true,
        eligibilityRules: 'v0.3: gamesPlayed >= 1, deduped by normalized name, week range filter',
        scoredAt: new Date().toISOString(),
      },
      _sentinel: {
        checked: true,
        warnings: sentinelWarnings,
        blocks: sentinelBlocks,
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
 * GET /api/forge/recursive/batch
 * 
 * Recursive batch scoring endpoint using FORGE Recursion v1.
 * Uses two-pass scoring with historical state for trajectory-aware grading.
 * 
 * Query params:
 * - position (optional): WR | RB | TE | QB (defaults to all if not specified)
 * - limit (optional): number, 1-100, defaults to 50
 * - season (optional): number, defaults to 2025
 * - week (optional): number, defaults to current week
 * - persist (optional): 'true' | 'false', whether to save state (defaults to true)
 */
router.get('/recursive/batch', async (req: Request, res: Response) => {
  try {
    const { position, limit, season, week, persist } = req.query;

    const normalizedPosition =
      typeof position === 'string' && ['QB', 'RB', 'WR', 'TE'].includes(position.toUpperCase())
        ? (position.toUpperCase() as PlayerPosition)
        : undefined;

    const normalizedLimit =
      typeof limit === 'string' && !Number.isNaN(Number(limit))
        ? Math.max(1, Math.min(Number(limit), 100))
        : 50;

    const normalizedSeason = 
      typeof season === 'string' && !Number.isNaN(Number(season))
        ? Number(season)
        : 2025;

    const normalizedWeek =
      typeof week === 'string' && !Number.isNaN(Number(week))
        ? Number(week)
        : 14;

    const shouldPersist = persist !== 'false';

    console.log(`[FORGE/Recursive] Batch request: position=${normalizedPosition ?? 'ALL'}, limit=${normalizedLimit}, season=${normalizedSeason}, week=${normalizedWeek}, persist=${shouldPersist}`);

    const { calculateRecursiveAlpha, getRecursionSummary } = await import('./recursiveAlphaEngine');
    const { fetchContext } = await import('./context/contextFetcher');
    const { buildWRFeatures } = await import('./features/wrFeatures');
    const { buildQBFeatures } = await import('./features/qbFeatures');
    const { buildRBFeatures } = await import('./features/rbFeatures');
    const { buildTEFeatures } = await import('./features/teFeatures');

    const scores = await forgeService.getForgeScoresBatch({
      position: normalizedPosition,
      limit: normalizedLimit,
      season: normalizedSeason,
      asOfWeek: normalizedWeek,
    });

    const recursiveScores = [];
    
    for (const score of scores) {
      try {
        const context = await fetchContext(score.playerId, normalizedSeason, normalizedWeek);
        if (!context) continue;

        let features;
        switch (context.position) {
          case 'QB':
            features = buildQBFeatures(context);
            break;
          case 'RB':
            features = buildRBFeatures(context);
            break;
          case 'TE':
            features = buildTEFeatures(context);
            break;
          default:
            features = buildWRFeatures(context);
        }

        const recursiveScore = await calculateRecursiveAlpha(
          context,
          features,
          { persistState: shouldPersist }
        );

        recursiveScores.push({
          ...recursiveScore,
          recursionSummary: getRecursionSummary(recursiveScore),
        });
      } catch (err) {
        console.error(`[FORGE/Recursive] Failed to score ${score.playerName}:`, err);
      }
    }

    const sortedScores = recursiveScores.sort((a, b) => b.alpha - a.alpha);

    return res.json({
      success: true,
      scores: sortedScores,
      meta: {
        position: normalizedPosition ?? 'ALL',
        limit: normalizedLimit,
        season: normalizedSeason,
        week: normalizedWeek,
        count: sortedScores.length,
        recursionEnabled: true,
        statePersisted: shouldPersist,
        description: 'FORGE Recursion v1: Two-pass scoring with historical trajectory awareness',
        scoredAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('[FORGE/Recursive] Batch error:', error);
    return res.status(500).json({
      success: false,
      error: 'FORGE_RECURSIVE_BATCH_FAILED',
    });
  }
});

/**
 * GET /api/forge/recursive/player/:playerId
 * 
 * Get recursive scoring history for a single player
 */
router.get('/recursive/player/:playerId', async (req: Request, res: Response) => {
  try {
    const { playerId } = req.params;
    const season = typeof req.query.season === 'string' ? Number(req.query.season) : 2025;

    const { getPlayerStateHistory } = await import('./forgeStateService');
    const history = await getPlayerStateHistory(playerId, season);

    if (history.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No recursive state history found for this player',
      });
    }

    return res.json({
      success: true,
      playerId,
      season,
      history: history.map(state => ({
        week: state.week,
        alphaPrev: state.alphaPrev,
        alphaRaw: state.alphaRaw,
        alphaFinal: state.alphaFinal,
        tier: state.tierFinal,
        surprise: state.surprise,
        volatility: state.volatilityUpdated,
        momentum: state.momentumUpdated,
        confidence: state.confidenceScore,
      })),
      meta: {
        weeksTracked: history.length,
        latestWeek: history[history.length - 1]?.week,
        latestAlpha: history[history.length - 1]?.alphaFinal,
      },
    });
  } catch (error) {
    console.error('[FORGE/Recursive] Player history error:', error);
    return res.status(500).json({
      success: false,
      error: 'FORGE_RECURSIVE_PLAYER_FAILED',
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
 * - minGamesPlayed (optional): filter to players with >= N games (default: 4)
 * - minConfidence (optional): filter to players with >= N confidence (default: 0)
 * - includeAllPlayers (optional): if 'true', skip filters (for debugging)
 */
router.get('/debug/distribution', async (req: Request, res: Response) => {
  try {
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({ error: 'FORGE_DEBUG_DISABLED_IN_PROD' });
    }

    const position = (req.query.position as string)?.toUpperCase() as PlayerPosition;
    const season = parseInt(req.query.season as string) || 2025;
    const week = parseInt(req.query.week as string) || 10;
    const includeAllPlayers = req.query.includeAllPlayers === 'true';
    const minGamesPlayed = includeAllPlayers ? 0 : (parseInt(req.query.minGamesPlayed as string) || 4);
    const minConfidence = includeAllPlayers ? 0 : (parseInt(req.query.minConfidence as string) || 0);

    if (!position || !['WR', 'RB', 'TE', 'QB'].includes(position)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or missing position. Must be WR, RB, TE, or QB.',
      });
    }

    console.log(`[FORGE/Debug] Distribution request: position=${position}, season=${season}, week=${week}, minGames=${minGamesPlayed}, minConf=${minConfidence}`);

    const playerIds = await fetchPlayerIdsForPosition(position, 500);
    const allScores = await forgeService.getForgeScoresForPlayers(playerIds, season, week);

    const totalPlayers = allScores.length;
    const cappedCount = allScores.filter(s => s.dataQuality?.cappedDueToMissingData).length;
    
    const filteredScores = allScores.filter(s => 
      s.gamesPlayed >= minGamesPlayed && 
      s.confidence >= minConfidence
    );

    const rawAlphas = filteredScores
      .map(s => s.rawAlpha)
      .filter((v): v is number => v != null && !isNaN(v))
      .sort((a, b) => a - b);

    if (rawAlphas.length === 0) {
      return res.json({
        success: true,
        position,
        season,
        week,
        filters: { minGamesPlayed, minConfidence },
        count: 0,
        distribution: null,
        dataQuality: {
          totalPlayers,
          cappedCount,
          cappedPct: Math.round((cappedCount / totalPlayers) * 100),
        },
        message: 'No scores found matching filters',
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
    const p95Idx = Math.min(Math.floor(count * 0.95), count - 1);
    const p97Idx = Math.min(Math.floor(count * 0.97), count - 1);

    const distribution = {
      count,
      min: Math.round(min * 10) / 10,
      p10: Math.round(rawAlphas[p10Idx] * 10) / 10,
      p25: Math.round(rawAlphas[p25Idx] * 10) / 10,
      p50: Math.round(rawAlphas[p50Idx] * 10) / 10,
      p75: Math.round(rawAlphas[p75Idx] * 10) / 10,
      p90: Math.round(rawAlphas[p90Idx] * 10) / 10,
      p95: Math.round(rawAlphas[p95Idx] * 10) / 10,
      p97: Math.round(rawAlphas[p97Idx] * 10) / 10,
      max: Math.round(max * 10) / 10,
    };

    const spread = {
      p10_p50: Math.round((distribution.p50 - distribution.p10) * 10) / 10,
      p50_p90: Math.round((distribution.p90 - distribution.p50) * 10) / 10,
      p90_p95: Math.round((distribution.p95 - distribution.p90) * 10) / 10,
      total: Math.round((distribution.max - distribution.min) * 10) / 10,
    };

    console.log(`[FORGE/Debug] ${position} ${season}w${week} rawAlpha: p10=${distribution.p10} p50=${distribution.p50} p90=${distribution.p90} p95=${distribution.p95} p97=${distribution.p97} max=${distribution.max} (${count} players)`);

    return res.json({
      success: true,
      position,
      season,
      week,
      filters: { minGamesPlayed, minConfidence },
      distribution,
      spread,
      dataQuality: {
        totalPlayers,
        filteredPlayers: count,
        cappedCount,
        cappedPct: Math.round((cappedCount / totalPlayers) * 100),
      },
      calibrationSuggestion: {
        p10: distribution.p10,
        p95: distribution.p95,
        outMin: 25,
        outMax: 90,
        note: 'Using p95 as upper bound to allow elite differentiation',
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
 * POST /api/forge/admin/sync-live-status
 * 
 * Sync player live status (current team, injury status) from Sleeper API.
 * This updates player_live_status table for FORGE eligibility filtering.
 * Fixes issues like:
 * - Thielen showing CAR instead of PIT
 * - Anthony Richardson appearing despite being on IR
 */
router.post('/admin/sync-live-status', async (req: Request, res: Response) => {
  try {
    console.log('[FORGE/Admin] Syncing player live status from Sleeper...');
    
    const result = await sleeperLiveStatusSync.syncLiveStatus();
    
    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error,
      });
    }
    
    return res.json({
      success: true,
      meta: {
        playersProcessed: result.playersProcessed,
        playersUpdated: result.playersUpdated,
        playersSkipped: result.playersSkipped,
        syncedAt: new Date().toISOString(),
      },
      examples: result.examples,
      message: `Synced ${result.playersUpdated} players from Sleeper API`,
    });
  } catch (err) {
    console.error('[FORGE/Admin] sync-live-status error:', err);
    return res.status(500).json({ success: false, error: 'Live status sync failed' });
  }
});

/**
 * GET /api/forge/admin/ineligible-players
 * 
 * List players currently marked as ineligible for FORGE (IR, PUP, etc.)
 */
router.get('/admin/ineligible-players', async (req: Request, res: Response) => {
  try {
    const ineligible = await sleeperLiveStatusSync.getIneligiblePlayers();
    
    return res.json({
      success: true,
      count: ineligible.length,
      players: ineligible,
    });
  } catch (err) {
    console.error('[FORGE/Admin] ineligible-players error:', err);
    return res.status(500).json({ success: false, error: 'Failed to get ineligible players' });
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

/**
 * POST /api/forge/admin/qb-context/populate
 * 
 * Populate qb_context_2025 table with QB scores for each team.
 * This should be run whenever QB data changes or at season start.
 */
router.post('/admin/qb-context/populate', async (req: Request, res: Response) => {
  try {
    const season = parseInt(req.body.season as string) || parseInt(req.query.season as string) || 2025;
    
    console.log(`[FORGE/Admin] QB Context populate request: season=${season}`);
    
    const result = await populateQbContext2025(season);
    
    return res.json({
      success: result.success,
      meta: { season },
      teamsProcessed: result.teamsProcessed,
      errors: result.errors,
      message: `Populated QB context for ${result.teamsProcessed} teams`,
    });
  } catch (err) {
    console.error('[FORGE/Admin] qb-context populate error:', err);
    return res.status(500).json({ success: false, error: 'QB Context populate failed' });
  }
});

/**
 * GET /api/forge/qb-context/:team
 * 
 * Get primary QB context for a team.
 */
router.get('/qb-context/:team', async (req: Request, res: Response) => {
  try {
    const team = req.params.team?.toUpperCase();
    const season = parseInt(req.query.season as string) || 2025;
    
    if (!team) {
      return res.status(400).json({ success: false, error: 'Team is required' });
    }
    
    const context = await getPrimaryQbContext(team, season);
    
    if (!context) {
      return res.status(404).json({ 
        success: false, 
        error: `No QB context found for ${team}. Run POST /admin/qb-context/populate first.`
      });
    }
    
    return res.json({
      success: true,
      team,
      season,
      qbContext: context,
    });
  } catch (err) {
    console.error('[FORGE] qb-context error:', err);
    return res.status(500).json({ success: false, error: 'Failed to get QB context' });
  }
});

/**
 * POST /api/forge/admin/backfill-recursive
 * 
 * Run the recursive alpha engine for specific players across weeks 1-maxWeek.
 * Processes weeks sequentially so each week builds on the previous state.
 * Body: { playerIds: string[], season?: number, maxWeek?: number }
 */
router.post('/admin/backfill-recursive', async (req: Request, res: Response) => {
  try {
    const { calculateRecursiveAlpha } = await import('./recursiveAlphaEngine');
    const { fetchContext } = await import('./context/contextFetcher');
    const { buildWRFeatures } = await import('./features/wrFeatures');
    const { buildRBFeatures } = await import('./features/rbFeatures');
    const { buildTEFeatures } = await import('./features/teFeatures');
    const { buildQBFeatures } = await import('./features/qbFeatures');

    const featureBuilders: Record<string, (ctx: any) => any> = {
      WR: buildWRFeatures,
      RB: buildRBFeatures,
      TE: buildTEFeatures,
      QB: buildQBFeatures,
    };

    const { playerIds } = req.body;
    const season = parseInt(req.body.season) || 2025;
    const maxWeek = parseInt(req.body.maxWeek) || 17;

    if (!playerIds || !Array.isArray(playerIds) || playerIds.length === 0) {
      return res.status(400).json({ success: false, error: 'playerIds array required' });
    }

    if (playerIds.length > 10) {
      return res.status(400).json({ success: false, error: 'Max 10 players per request for testing' });
    }

    console.log(`[FORGE/Admin] Recursive backfill: ${playerIds.length} players, season=${season}, weeks 1-${maxWeek}`);

    const results: any[] = [];

    for (const playerId of playerIds) {
      const playerResult: any = {
        playerId,
        weeks: [],
        error: null,
      };

      try {
        for (let week = 1; week <= maxWeek; week++) {
          try {
            const context = await fetchContext(playerId, season, week);
            const builder = featureBuilders[context.position];
            if (!builder) {
              playerResult.error = `No feature builder for position: ${context.position}`;
              break;
            }

            const features = builder(context);
            const score = await calculateRecursiveAlpha(context, features, { persistState: true });

            playerResult.playerName = context.playerName;
            playerResult.position = context.position;
            playerResult.weeks.push({
              week,
              alphaRaw: Math.round(score.rawAlpha * 10) / 10,
              alphaFinal: score.alpha,
              volatility: score.recursion.volatility !== null ? Math.round(score.recursion.volatility * 10) / 10 : null,
              momentum: score.recursion.momentum !== null ? Math.round(score.recursion.momentum * 10) / 10 : null,
              stabilityAdj: score.recursion.stabilityAdjustment !== null ? Math.round(score.recursion.stabilityAdjustment * 10) / 10 : null,
              isFirstWeek: score.recursion.isFirstWeek,
            });
          } catch (weekErr: any) {
            playerResult.weeks.push({
              week,
              error: weekErr.message || 'Unknown error',
            });
          }
        }
      } catch (err: any) {
        playerResult.error = err.message || 'Unknown error';
      }

      results.push(playerResult);
    }

    return res.json({
      success: true,
      season,
      maxWeek,
      results,
    });
  } catch (err) {
    console.error('[FORGE/Admin] backfill-recursive error:', err);
    return res.status(500).json({ success: false, error: 'Backfill failed' });
  }
});

/**
 * GET /api/forge/opportunity-shifts
 * 
 * Get opportunity shifts for players when starters go OUT/IR.
 * Returns players gaining opportunity (green arrow) and losing opportunity (red arrow).
 */
router.get('/opportunity-shifts', async (req: Request, res: Response) => {
  try {
    const { nextManUpService } = await import('../../services/nextManUpService');
    const result = await nextManUpService.getOpportunityShifts();
    
    return res.json(result);
  } catch (err) {
    console.error('[FORGE] opportunity-shifts error:', err);
    return res.status(500).json({ success: false, error: 'Failed to get opportunity shifts' });
  }
});

/**
 * GET /api/forge/eg/batch
 * 
 * FORGE Engine+Grading (E+G) batch endpoint.
 * Uses new modular architecture:
 * - Engine: Fetches context, builds pillar scores (volume, efficiency, teamContext, stability)
 * - Football Lens (F): Detects football-sense issues, applies bounded pillar adjustments
 * - Orientation (O): Applies mode-specific weight adjustments (redraft, dynasty, bestball)
 * - Grading: Applies position weights, recursion bias, tier mapping
 * 
 * Query params:
 * - position (required): WR | RB | TE | QB
 * - mode (optional): 'redraft' | 'dynasty' | 'bestball', defaults to 'redraft'
 * - season (optional): number, defaults to 2025
 * - week (optional): number | 'season', defaults to 'season'
 * - limit (optional): number, 1-100, defaults to 50
 */
router.get('/eg/batch', async (req: Request, res: Response) => {
  try {
    const { runForgeEngineBatch } = await import('./forgeEngine');
    const { gradeForgeWithMeta } = await import('./forgeGrading');
    type EGPosition = 'QB' | 'RB' | 'WR' | 'TE';

    const position = (req.query.position as string)?.toUpperCase();
    const modeParam = (req.query.mode as string)?.toLowerCase();
    const mode: 'redraft' | 'dynasty' | 'bestball' = 
      modeParam && ['redraft', 'dynasty', 'bestball'].includes(modeParam)
        ? (modeParam as 'redraft' | 'dynasty' | 'bestball')
        : 'redraft';
    const season = parseInt(req.query.season as string) || 2025;
    const weekParam = req.query.week as string;
    const week = weekParam === 'season' || !weekParam ? 'season' : parseInt(weekParam);
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);

    if (!position || !['WR', 'RB', 'TE', 'QB'].includes(position)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or missing position. Must be WR, RB, TE, or QB.',
      });
    }

    console.log(`[FORGE/EG] Batch request: position=${position}, mode=${mode}, season=${season}, week=${week}, limit=${limit}`);

    const engineOutputs = await runForgeEngineBatch(
      position as EGPosition,
      season,
      week as number | 'season',
      limit
    );

    const results = engineOutputs.map(output => gradeForgeWithMeta(output, { mode }));

    const sortedResults = results.sort((a, b) => b.alpha - a.alpha);

    const issueCount = sortedResults.filter(r => r.issues && r.issues.length > 0).length;

    return res.json({
      success: true,
      meta: {
        position,
        mode,
        season,
        week,
        version: 'E+G/v2',
        description: 'FORGE Engine+Grading with Football Lens (F) and Orientation (O) layers',
        count: sortedResults.length,
        playersWithIssues: issueCount,
        scoredAt: new Date().toISOString(),
      },
      scores: sortedResults.map(r => ({
        playerId: r.playerId,
        playerName: r.playerName,
        position: r.position,
        nflTeam: r.nflTeam,
        alpha: r.alpha,
        tier: r.tier,
        tierPosition: r.tierPosition,
        gamesPlayed: r.gamesPlayed,
        pillars: {
          volume: Math.round(r.pillars.volume * 10) / 10,
          efficiency: Math.round(r.pillars.efficiency * 10) / 10,
          teamContext: Math.round(r.pillars.teamContext * 10) / 10,
          stability: Math.round(r.pillars.stability * 10) / 10,
          dynastyContext: r.pillars.dynastyContext !== undefined 
            ? Math.round(r.pillars.dynastyContext * 10) / 10 
            : undefined,
        },
        issues: r.issues,
        debug: r.debug,
      })),
    });
  } catch (error) {
    console.error('[FORGE/EG] Batch error:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'FORGE_EG_BATCH_FAILED',
    });
  }
});

/**
 * GET /api/forge/eg/player/:playerId
 * 
 * Get FORGE Engine+Grading score for a single player
 * 
 * Query params:
 * - position (required): WR | RB | TE | QB
 * - mode (optional): 'redraft' | 'dynasty' | 'bestball', defaults to 'redraft'
 * - season (optional): number, defaults to 2025
 * - week (optional): number | 'season', defaults to 'season'
 */
router.get('/eg/player/:playerId', async (req: Request, res: Response) => {
  try {
    const { runForgeEngine } = await import('./forgeEngine');
    const { gradeForgeWithMeta } = await import('./forgeGrading');
    type EGPosition = 'QB' | 'RB' | 'WR' | 'TE';

    const { playerId } = req.params;
    const position = (req.query.position as string)?.toUpperCase();
    const modeParam = (req.query.mode as string)?.toLowerCase();
    const mode: 'redraft' | 'dynasty' | 'bestball' = 
      modeParam && ['redraft', 'dynasty', 'bestball'].includes(modeParam)
        ? (modeParam as 'redraft' | 'dynasty' | 'bestball')
        : 'redraft';
    const season = parseInt(req.query.season as string) || 2025;
    const weekParam = req.query.week as string;
    const week = weekParam === 'season' || !weekParam ? 'season' : parseInt(weekParam);

    if (!playerId) {
      return res.status(400).json({
        success: false,
        error: 'Missing playerId parameter',
      });
    }

    if (!position || !['WR', 'RB', 'TE', 'QB'].includes(position)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or missing position. Must be WR, RB, TE, or QB.',
      });
    }

    console.log(`[FORGE/EG] Player request: playerId=${playerId}, position=${position}, mode=${mode}, season=${season}, week=${week}`);

    const engineOutput = await runForgeEngine(
      playerId,
      position as EGPosition,
      season,
      week as number | 'season'
    );

    const result = gradeForgeWithMeta(engineOutput, { mode });

    return res.json({
      success: true,
      meta: {
        mode,
        version: 'E+G/v2',
      },
      score: {
        playerId: result.playerId,
        playerName: result.playerName,
        position: result.position,
        nflTeam: result.nflTeam,
        alpha: result.alpha,
        tier: result.tier,
        tierPosition: result.tierPosition,
        gamesPlayed: result.gamesPlayed,
        pillars: {
          volume: Math.round(result.pillars.volume * 10) / 10,
          efficiency: Math.round(result.pillars.efficiency * 10) / 10,
          teamContext: Math.round(result.pillars.teamContext * 10) / 10,
          stability: Math.round(result.pillars.stability * 10) / 10,
          dynastyContext: result.pillars.dynastyContext !== undefined 
            ? Math.round(result.pillars.dynastyContext * 10) / 10 
            : undefined,
        },
        issues: result.issues,
        debug: result.debug,
        rawMetrics: result.rawMetrics,
      },
    });
  } catch (error) {
    console.error('[FORGE/EG] Player error:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'FORGE_EG_PLAYER_FAILED',
    });
  }
});

/**
 * GET /api/forge/transparency/:playerId
 *
 * Full FORGE transparency endpoint - exposes exactly how a player's score is calculated.
 * Returns pillar breakdown with contributing metrics, recursion adjustments, weekly history.
 *
 * Path params:
 * - playerId (required): canonical player ID or sleeper ID
 *
 * Query params:
 * - season (optional): number, defaults to 2025
 * - week (optional): number, defaults to latest available
 * - mode (optional): 'redraft' | 'dynasty' | 'bestball', defaults to 'redraft'
 */
router.get('/transparency/:playerId', async (req: Request, res: Response) => {
  try {
    const { runForgeEngine, getPositionPillarConfig } = await import('./forgeEngine');
    const { gradeForgeWithMeta } = await import('./forgeGrading');
    const { getPlayerStateHistory, POSITION_BASELINES } = await import('./forgeStateService');

    const { playerId } = req.params;
    const season = parseInt(req.query.season as string) || 2025;
    const week = parseInt(req.query.week as string) || 17;
    const modeParam = (req.query.mode as string)?.toLowerCase();
    const mode: 'redraft' | 'dynasty' | 'bestball' =
      modeParam && ['redraft', 'dynasty', 'bestball'].includes(modeParam)
        ? (modeParam as 'redraft' | 'dynasty' | 'bestball')
        : 'redraft';

    if (!playerId) {
      return res.status(400).json({
        success: false,
        error: 'Missing playerId parameter',
      });
    }

    console.log(`[FORGE/Transparency] Request: playerId=${playerId}, season=${season}, week=${week}, mode=${mode}`);

    // Resolve player identity
    const identity = await PlayerIdentityService.getInstance().getByAnyId(playerId);
    if (!identity) {
      return res.status(404).json({
        success: false,
        error: `Player not found: ${playerId}`,
      });
    }

    const position = identity.position as 'QB' | 'RB' | 'WR' | 'TE';
    if (!['QB', 'RB', 'WR', 'TE'].includes(position)) {
      return res.status(400).json({
        success: false,
        error: `Invalid position: ${position}. Must be QB, RB, WR, or TE.`,
      });
    }

    // Run FORGE engine
    const engineOutput = await runForgeEngine(
      identity.canonicalId,
      position,
      season,
      week
    );

    // Apply grading
    const gradedResult = gradeForgeWithMeta(engineOutput, { mode });

    // Get player state history for recursion data
    const stateHistory = await getPlayerStateHistory(identity.canonicalId, season);
    const currentState = stateHistory.find(s => s.week === week);
    const latestState = stateHistory[stateHistory.length - 1];

    // Build pillar breakdown with contributing metrics
    const pillarConfig = getPositionPillarConfig(position);
    const pillarBreakdown = buildPillarBreakdown(pillarConfig, engineOutput, position);

    // Get weekly alpha history for trend chart
    const weeklyHistory = stateHistory.map(state => ({
      week: state.week,
      alpha: state.alphaFinal ?? state.alphaRaw ?? 0,
      alphaRaw: state.alphaRaw ?? 0,
    }));

    // Build recursion details from current state or latest available
    const stateForRecursion = currentState || latestState;
    const recursion = stateForRecursion ? {
      pass0Alpha: stateForRecursion.alphaRaw ?? gradedResult.alpha,
      pass1Alpha: stateForRecursion.alphaFinal ?? gradedResult.alpha,
      alphaPrev: stateForRecursion.alphaPrev,
      expectedAlpha: stateForRecursion.expectedAlpha,
      surprise: stateForRecursion.surprise,
      volatility: stateForRecursion.volatilityUpdated ?? stateForRecursion.volatilityPrev,
      momentum: stateForRecursion.momentumUpdated ?? stateForRecursion.momentum,
      stabilityAdjustment: stateForRecursion.stabilityAdjustment,
      isFirstWeek: stateHistory.length <= 1,
    } : {
      pass0Alpha: gradedResult.alpha,
      pass1Alpha: gradedResult.alpha,
      alphaPrev: null,
      expectedAlpha: POSITION_BASELINES[position] ?? 55,
      surprise: null,
      volatility: null,
      momentum: null,
      stabilityAdjustment: null,
      isFirstWeek: true,
    };

    // Generate plain English summary
    const summary = generatePlainEnglishSummary(
      gradedResult.playerName,
      position,
      gradedResult.alpha,
      gradedResult.pillars,
      recursion,
      gradedResult.issues || []
    );

    return res.json({
      success: true,
      player: {
        id: identity.canonicalId,
        name: gradedResult.playerName,
        position: gradedResult.position,
        team: gradedResult.nflTeam || identity.nflTeam,
      },
      season,
      week,
      mode,
      gamesPlayed: gradedResult.gamesPlayed,

      // Alpha scores
      alphaFinal: gradedResult.alpha,
      alphaRaw: recursion.pass0Alpha,
      tier: gradedResult.tier,

      // Pillar breakdown with contributing metrics
      pillars: pillarBreakdown,

      // Recursive adjustments
      recursion,

      // Weekly alpha history for trend chart
      weeklyHistory,

      // Football lens issues
      issues: gradedResult.issues || [],

      // Plain English summary
      summary,

      // Debug info (optional, for development)
      debug: {
        version: 'transparency/v1',
        qbContext: engineOutput.qbContext,
        rawMetrics: engineOutput.rawMetrics,
      },
    });
  } catch (error) {
    console.error('[FORGE/Transparency] Error:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'FORGE_TRANSPARENCY_FAILED',
    });
  }
});

/**
 * Build pillar breakdown with contributing metrics
 */
function buildPillarBreakdown(
  pillarConfig: any,
  engineOutput: any,
  position: string
): Record<string, any> {
  const PILLAR_WEIGHTS: Record<string, Record<string, number>> = {
    QB: { volume: 0.25, efficiency: 0.50, teamContext: 0.10, stability: 0.15 },
    RB: { volume: 0.40, efficiency: 0.35, teamContext: 0.10, stability: 0.15 },
    WR: { volume: 0.35, efficiency: 0.40, teamContext: 0.10, stability: 0.15 },
    TE: { volume: 0.35, efficiency: 0.40, teamContext: 0.10, stability: 0.15 },
  };

  const weights = PILLAR_WEIGHTS[position] || PILLAR_WEIGHTS['WR'];

  const buildMetricsArray = (pillarKey: string): any[] => {
    const config = pillarConfig[pillarKey];
    if (!config?.metrics) return [];

    return config.metrics.map((m: any) => {
      const rawValue = engineOutput.rawMetrics?.[m.metricKey];
      return {
        name: formatMetricName(m.metricKey),
        key: m.metricKey,
        rawValue: rawValue ?? null,
        weight: Math.round(m.weight * 100),
        source: m.source,
        inverted: m.invert || false,
      };
    });
  };

  return {
    volume: {
      score: Math.round(engineOutput.pillars.volume * 10) / 10,
      weight: Math.round(weights.volume * 100),
      metrics: buildMetricsArray('volume'),
    },
    efficiency: {
      score: Math.round(engineOutput.pillars.efficiency * 10) / 10,
      weight: Math.round(weights.efficiency * 100),
      metrics: buildMetricsArray('efficiency'),
    },
    teamContext: {
      score: Math.round(engineOutput.pillars.teamContext * 10) / 10,
      weight: Math.round(weights.teamContext * 100),
      metrics: buildMetricsArray('teamContext'),
    },
    stability: {
      score: Math.round(engineOutput.pillars.stability * 10) / 10,
      weight: Math.round(weights.stability * 100),
      metrics: buildMetricsArray('stability'),
    },
  };
}

/**
 * Format metric key to human-readable name
 */
function formatMetricName(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase())
    .replace(/Ppr/g, 'PPR')
    .replace(/Epa/g, 'EPA')
    .replace(/Yprr/g, 'YPRR')
    .replace(/Yac/g, 'YAC')
    .replace(/Cpoe/g, 'CPOE')
    .replace(/Sos/g, 'SoS')
    .replace(/Rz/g, 'Red Zone')
    .replace(/Std Dev/g, 'Std. Dev.');
}

/**
 * Generate plain English summary explaining the score
 */
function generatePlainEnglishSummary(
  playerName: string,
  position: string,
  alpha: number,
  pillars: any,
  recursion: any,
  issues: any[]
): string {
  const parts: string[] = [];
  const firstName = playerName.split(' ')[0];

  // Overall tier description
  if (alpha >= 85) {
    parts.push(`${firstName} scores elite`);
  } else if (alpha >= 70) {
    parts.push(`${firstName} scores as a strong starter`);
  } else if (alpha >= 55) {
    parts.push(`${firstName} grades out as a solid flex option`);
  } else if (alpha >= 40) {
    parts.push(`${firstName} projects as a boom-bust play`);
  } else {
    parts.push(`${firstName} has limited fantasy value`);
  }

  // Volume description
  if (pillars.volume >= 85) {
    parts.push('due to massive volume');
  } else if (pillars.volume >= 70) {
    parts.push('with strong usage');
  } else if (pillars.volume <= 40) {
    parts.push('despite limited opportunities');
  }

  // Efficiency description
  if (pillars.efficiency >= 85) {
    parts.push('combined with top-tier efficiency');
  } else if (pillars.efficiency >= 70) {
    parts.push('and solid production per opportunity');
  } else if (pillars.efficiency <= 40) {
    parts.push('but struggles with efficiency');
  }

  // Build the main sentence
  let summary = parts.join(' ') + '.';

  // Add recursion context
  if (recursion && !recursion.isFirstWeek) {
    if (recursion.volatility !== null && recursion.volatility < 5) {
      summary += ` Low volatility (${recursion.volatility.toFixed(1)}) over recent weeks earned a stability bonus.`;
    } else if (recursion.volatility !== null && recursion.volatility > 10) {
      summary += ` High volatility (${recursion.volatility.toFixed(1)}) introduces some scoring variance.`;
    }

    if (recursion.momentum !== null && recursion.momentum > 5) {
      summary += ` Momentum is positive (+${recursion.momentum.toFixed(1)}), indicating an upward trend.`;
    } else if (recursion.momentum !== null && recursion.momentum < -5) {
      summary += ` Momentum is negative (${recursion.momentum.toFixed(1)}), suggesting a downward trend.`;
    }
  }

  // Add context pillar insight
  if (pillars.teamContext >= 75) {
    summary += ` Favorable team environment boosts ceiling.`;
  } else if (pillars.teamContext <= 35) {
    summary += ` Difficult team context may cap upside.`;
  }

  // Add stability insight for WRs
  if (position === 'WR' && pillars.stability >= 80) {
    summary += ` Role security is excellent with minimal competition for targets.`;
  }

  // Add issue warnings
  const blockingIssues = issues.filter(i => i.severity === 'block' || i.severity === 'warn');
  if (blockingIssues.length > 0) {
    const issueMessages = blockingIssues.map(i => i.message).join('; ');
    summary += ` Note: ${issueMessages}.`;
  }

  return summary;
}

router.get('/tiers', async (req: Request, res: Response) => {
  try {
    const season = parseInt(req.query.season as string) || 2025;
    const asOfWeekParam = req.query.asOfWeek as string | undefined;
    const asOfWeek = asOfWeekParam ? parseInt(asOfWeekParam, 10) : undefined;
    const position = ((req.query.position as string) || 'ALL').toUpperCase() as 'QB' | 'RB' | 'WR' | 'TE' | 'ALL';
    const limit = Math.min(parseInt(req.query.limit as string) || 100, 300);

    if (!['QB', 'RB', 'WR', 'TE', 'ALL'].includes(position)) {
      return res.status(400).json({ error: 'Invalid position. Use QB, RB, WR, TE, or ALL.' });
    }

    const cache = await getGradesFromCache(season, asOfWeek, position, limit, CACHE_VERSION);

    if (cache.players.length === 0) {
      return res.json({
        season,
        asOfWeek: cache.asOfWeek ?? asOfWeek ?? null,
        position,
        fallback: true,
        message: 'FORGE grades not yet computed for this week. Run POST /api/forge/compute-grades to generate.',
        count: 0,
        players: [],
      });
    }

    const players = cache.players.map((row, idx) => ({
      playerId: row.playerId,
      playerName: row.playerName,
      position: row.position,
      nflTeam: row.nflTeam,
      rank: idx + 1,
      alpha: row.alpha,
      rawAlpha: row.rawAlpha,
      tier: row.tier,
      tierNumeric: row.tierNumeric,
      subscores: {
        volume: row.volumeScore,
        efficiency: row.efficiencyScore,
        teamContext: row.teamContextScore,
        stability: row.stabilityScore,
        dynastyContext: row.dynastyContext,
      },
      trajectory: row.trajectory,
      confidence: row.confidence,
      gamesPlayed: row.gamesPlayed,
      footballLensIssues: row.footballLensIssues ?? [],
      lensAdjustment: row.lensAdjustment ?? 0,
      fantasyStats: {
        ppgPpr: row.ppgPpr,
        seasonFptsPpr: row.seasonFptsPpr,
        targets: row.targets,
        touches: row.touches,
      },
    }));

    return res.json({
      season,
      asOfWeek: cache.asOfWeek,
      position,
      computedAt: cache.computedAt?.toISOString(),
      version: cache.version,
      count: players.length,
      fallback: false,
      players,
    });
  } catch (error) {
    console.error('[FORGE/Routes] tiers endpoint error:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

router.post('/compute-grades', async (req: Request, res: Response) => {
  try {
    const adminKey = (req.headers['x-admin-key'] || req.headers['authorization']) as string | undefined;
    if (!adminKey || adminKey !== process.env.FORGE_ADMIN_KEY) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const season = Number(req.body?.season) || 2025;
    const asOfWeek = Number(req.body?.asOfWeek) || 17;
    const position = String(req.body?.position || 'ALL').toUpperCase() as 'QB' | 'RB' | 'WR' | 'TE' | 'ALL';
    const limit = Math.min(Number(req.body?.limit) || 200, 300);

    if (!['QB', 'RB', 'WR', 'TE', 'ALL'].includes(position)) {
      return res.status(400).json({ error: 'Invalid position. Use QB, RB, WR, TE, or ALL.' });
    }

    const jobStart = Date.now();

    let results: Record<string, { computed: number; errors: number; durationMs: number }>;
    if (position === 'ALL') {
      results = await computeAllGrades(season, asOfWeek, { limit, version: CACHE_VERSION });
    } else {
      const single = await computeAndCacheGrades(position, season, asOfWeek, { limit, version: CACHE_VERSION });
      results = { [position]: single };
    }

    const totalDurationMs = Date.now() - jobStart;
    const totalComputed = Object.values(results).reduce((acc, item) => acc + item.computed, 0);
    const totalErrors = Object.values(results).reduce((acc, item) => acc + item.errors, 0);

    if (totalComputed === 0 && totalErrors > 0) {
      return res.status(500).json({
        status: 'failed',
        season,
        asOfWeek,
        results,
        totalDurationMs,
        version: CACHE_VERSION,
      });
    }

    return res.json({
      status: 'completed',
      season,
      asOfWeek,
      results,
      totalDurationMs,
      version: CACHE_VERSION,
    });
  } catch (error) {
    console.error('[FORGE/Routes] compute-grades endpoint error:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export function registerForgeRoutes(app: any): void {
  app.use('/api/forge', router);
  console.log('🔥 FORGE v0.2 routes mounted at /api/forge/* (E+G architecture enabled, Transparency endpoint added)');
}

export default router;
