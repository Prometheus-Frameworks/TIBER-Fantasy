/**
 * Player Mapping API Routes
 * 
 * Endpoints for searching players, getting advanced stats,
 * metric leaderboards, and formula-based player matching.
 */

import { Router, Request, Response } from 'express';
import { PlayerAdvancedService } from '../services/playerAdvancedService';

const router = Router();
const playerAdvancedService = PlayerAdvancedService.getInstance();

/**
 * Parse a numeric query parameter safely with validation
 */
function parseIntParam(value: unknown, defaultValue: number, paramName: string): { value: number; error?: string } {
  if (value === undefined || value === null || value === '') {
    return { value: defaultValue };
  }
  if (typeof value !== 'string') {
    return { value: defaultValue, error: `${paramName} must be a string` };
  }
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    return { value: defaultValue, error: `${paramName} must be a valid integer, got "${value}"` };
  }
  if (parsed < 1) {
    return { value: defaultValue, error: `${paramName} must be positive, got ${parsed}` };
  }
  return { value: parsed };
}

/**
 * GET /api/players/search
 * Search players by name with optional position filter
 * 
 * Query params:
 *   q - search query (required)
 *   position - filter by position (optional, e.g. WR, RB, TE, QB)
 *   limit - max results (optional, default 10)
 */
router.get('/search', async (req: Request, res: Response) => {
  try {
    const { q, position, limit } = req.query;
    
    if (!q || typeof q !== 'string' || q.trim().length < 2) {
      return res.status(400).json({ 
        error: 'Query parameter "q" required (min 2 characters)' 
      });
    }
    
    const limitResult = parseIntParam(limit, 10, 'limit');
    if (limitResult.error) {
      return res.status(400).json({ error: limitResult.error });
    }
    
    const results = await playerAdvancedService.searchPlayers(q.trim(), {
      position: typeof position === 'string' ? position : undefined,
      limit: Math.min(limitResult.value, 50),
    });
    
    res.json({
      success: true,
      query: q,
      count: results.length,
      players: results,
    });
  } catch (error) {
    console.error('[PlayerMapping] Search error:', error);
    res.status(500).json({ error: 'Failed to search players' });
  }
});

/**
 * GET /api/players/:playerId/advanced
 * Get advanced stats for a player (WR or RB)
 * 
 * Query params:
 *   season - season year (optional, default 2025)
 *   scope - 'season' or 'weekly' (optional, default 'season')
 *   position - 'WR' or 'RB' (optional, auto-detected if not provided)
 */
router.get('/:playerId/advanced', async (req: Request, res: Response) => {
  try {
    const { playerId } = req.params;
    const { season, scope, position } = req.query;
    
    const seasonResult = parseIntParam(season, 2025, 'season');
    if (seasonResult.error) {
      return res.status(400).json({ error: seasonResult.error });
    }
    const seasonNum = seasonResult.value;
    const scopeType = scope === 'weekly' ? 'weekly' : 'season';
    
    let playerPosition = typeof position === 'string' ? position.toUpperCase() : null;
    
    if (!playerPosition || !['WR', 'RB'].includes(playerPosition)) {
      const identityPosition = await playerAdvancedService.getPlayerPosition(playerId);
      
      if (identityPosition && ['WR', 'RB'].includes(identityPosition)) {
        playerPosition = identityPosition;
      } else {
        const rbStats = await playerAdvancedService.getRBSeasonStats(playerId, seasonNum);
        const wrStats = await playerAdvancedService.getWRSeasonStats(playerId, seasonNum);
        
        if (rbStats) {
          playerPosition = 'RB';
        } else if (wrStats) {
          playerPosition = 'WR';
        } else {
          return res.status(404).json({ 
            error: 'Player not found or no advanced data available',
            playerId,
            season: seasonNum,
            hint: 'Currently only WR and RB positions are supported',
          });
        }
      }
    }
    
    if (playerPosition === 'RB') {
      if (scopeType === 'weekly') {
        const weeklyStats = await playerAdvancedService.getRBWeeklyStats(playerId, seasonNum);
        
        if (!weeklyStats.length) {
          return res.status(404).json({ 
            error: 'RB not found or no weekly data available',
            playerId,
            season: seasonNum,
          });
        }
        
        return res.json({
          success: true,
          playerId,
          position: 'RB',
          season: seasonNum,
          scope: 'weekly',
          weeks: weeklyStats,
        });
      }
      
      const seasonStats = await playerAdvancedService.getRBSeasonStats(playerId, seasonNum);
      
      if (!seasonStats) {
        return res.status(404).json({ 
          error: 'RB not found or no season data available',
          playerId,
          season: seasonNum,
        });
      }
      
      return res.json({
        success: true,
        playerId,
        position: 'RB',
        season: seasonNum,
        scope: 'season',
        profile: seasonStats,
      });
    }
    
    if (scopeType === 'weekly') {
      const weeklyStats = await playerAdvancedService.getWRWeeklyStats(playerId, seasonNum);
      
      if (!weeklyStats.length) {
        return res.status(404).json({ 
          error: 'WR not found or no weekly data available',
          playerId,
          season: seasonNum,
        });
      }
      
      return res.json({
        success: true,
        playerId,
        position: 'WR',
        season: seasonNum,
        scope: 'weekly',
        weeks: weeklyStats,
      });
    }
    
    const seasonStats = await playerAdvancedService.getWRSeasonStats(playerId, seasonNum);
    
    if (!seasonStats) {
      return res.status(404).json({ 
        error: 'WR not found or no season data available',
        playerId,
        season: seasonNum,
      });
    }
    
    res.json({
      success: true,
      playerId,
      position: 'WR',
      season: seasonNum,
      scope: 'season',
      profile: seasonStats,
    });
  } catch (error) {
    console.error('[PlayerMapping] Advanced stats error:', error);
    res.status(500).json({ error: 'Failed to get advanced stats' });
  }
});

/**
 * GET /api/metrics/wr
 * Get WR metric leaderboard sorted by a specific metric
 * 
 * Query params:
 *   metric - metric name (required, e.g. fd_rr_est, yprr_est, target_share)
 *   season - season year (optional, default 2025)
 *   min_routes - minimum targets filter (optional, default 20)
 *   limit - max results (optional, default 25)
 */
router.get('/metrics/wr', async (_req: Request, res: Response) => {
  res.status(400).json({ 
    error: 'Use /api/metrics/wr?metric=<name> with proper query params' 
  });
});

export const metricsRouter = Router();

metricsRouter.get('/wr', async (req: Request, res: Response) => {
  try {
    const { metric, season, min_routes, limit } = req.query;
    
    if (!metric || typeof metric !== 'string') {
      return res.status(400).json({ 
        error: 'Query parameter "metric" required',
        validMetrics: [
          'targets', 'receptions', 'rec_yards', 'first_downs', 'tds',
          'target_share', 'air_yards_share', 'yards_per_target', 'fd_per_target',
          'catch_rate', 'yac_per_rec', 'epa_per_target', 'success_rate',
          'yprr_est', 'fd_rr_est'
        ],
      });
    }
    
    const seasonResult = parseIntParam(season, 2025, 'season');
    if (seasonResult.error) {
      return res.status(400).json({ error: seasonResult.error });
    }
    
    const minRoutesResult = parseIntParam(min_routes, 20, 'min_routes');
    if (minRoutesResult.error) {
      return res.status(400).json({ error: minRoutesResult.error });
    }
    
    const limitResult = parseIntParam(limit, 25, 'limit');
    if (limitResult.error) {
      return res.status(400).json({ error: limitResult.error });
    }
    
    const leaderboard = await playerAdvancedService.getWRMetricLeaderboard(metric, {
      season: seasonResult.value,
      minTargets: minRoutesResult.value,
      limit: Math.min(limitResult.value, 100),
    });
    
    res.json({
      success: true,
      metric,
      season: seasonResult.value,
      minTargets: minRoutesResult.value,
      count: leaderboard.length,
      leaderboard,
    });
  } catch (error: any) {
    console.error('[Metrics] WR leaderboard error:', error);
    if (error.message?.includes('Invalid metric')) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to get WR leaderboard' });
  }
});

/**
 * POST /api/forge/lab/wr-match
 * Find WRs matching a formula profile
 * 
 * Body:
 *   inputs - { TS, YPRR, FD_RR, YAC, CC } weights
 *   season - season year (optional, default 2025)
 *   min_routes - minimum targets filter (optional, default 30)
 *   limit - max results (optional, default 10)
 */
export const forgeLabRouter = Router();

/**
 * GET /api/metrics/rb
 * RB metric leaderboard
 * 
 * Query params:
 *   metric - RB metric to rank by (required)
 *   season - season year (optional, default 2025)
 *   min_carries - minimum carries filter (optional, default 50)
 *   limit - max results (optional, default 25)
 */
metricsRouter.get('/rb', async (req: Request, res: Response) => {
  try {
    const { metric, season, min_carries, limit } = req.query;
    
    if (!metric || typeof metric !== 'string') {
      return res.status(400).json({ 
        error: 'Query parameter "metric" required',
        validMetrics: [
          'carries', 'rush_yards', 'yards_per_carry', 'explosive_rush_rate',
          'rush_success_rate', 'rush_epa_per_att', 'rush_fd_rate',
          'carry_share', 'target_share', 'targets', 'receptions', 'rec_yards',
          'yards_per_target', 'catch_rate', 'yac_per_rec',
          'total_tds', 'rush_tds', 'rec_tds', 'goal_line_carries', 'redzone_carries',
          'total_yards', 'total_opportunities', 'carries_per_game', 'targets_per_game', 'yards_per_game'
        ],
      });
    }
    
    const seasonResult = parseIntParam(season, 2025, 'season');
    if (seasonResult.error) {
      return res.status(400).json({ error: seasonResult.error });
    }
    
    const minCarriesResult = parseIntParam(min_carries, 50, 'min_carries');
    if (minCarriesResult.error) {
      return res.status(400).json({ error: minCarriesResult.error });
    }
    
    const limitResult = parseIntParam(limit, 25, 'limit');
    if (limitResult.error) {
      return res.status(400).json({ error: limitResult.error });
    }
    
    const leaderboard = await playerAdvancedService.getRBMetricLeaderboard(metric, {
      season: seasonResult.value,
      minCarries: minCarriesResult.value,
      limit: Math.min(limitResult.value, 100),
    });
    
    res.json({
      success: true,
      metric,
      season: seasonResult.value,
      minCarries: minCarriesResult.value,
      count: leaderboard.length,
      leaderboard,
    });
  } catch (error: any) {
    console.error('[Metrics] RB leaderboard error:', error);
    if (error.message?.includes('Invalid metric')) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to get RB leaderboard' });
  }
});

forgeLabRouter.post('/wr-match', async (req: Request, res: Response) => {
  try {
    const { inputs, season, min_routes, limit } = req.body;
    
    if (!inputs || typeof inputs !== 'object') {
      return res.status(400).json({ 
        error: 'Request body must include "inputs" object with WR formula weights',
        example: {
          inputs: { TS: 0.22, YPRR: 2.1, FD_RR: 0.08, YAC: 4.5, CC: 0.52 },
          season: 2025,
          min_routes: 30,
          limit: 10,
        },
      });
    }
    
    const parsedSeason = typeof season === 'number' ? season : 2025;
    const parsedMinRoutes = typeof min_routes === 'number' ? min_routes : 30;
    const parsedLimit = typeof limit === 'number' ? Math.min(limit, 50) : 10;
    
    if (parsedSeason < 2020 || parsedSeason > 2030) {
      return res.status(400).json({ error: 'season must be between 2020 and 2030' });
    }
    if (parsedMinRoutes < 1 || parsedMinRoutes > 500) {
      return res.status(400).json({ error: 'min_routes must be between 1 and 500' });
    }
    
    const matches = await playerAdvancedService.findMatchingWRs(inputs, {
      season: parsedSeason,
      minTargets: parsedMinRoutes,
      limit: parsedLimit,
    });
    
    const calculateUserSubscores = (inputs: any) => {
      const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
      const ts = inputs.TS ?? 0.20;
      const yprr = inputs.YPRR ?? 2.0;
      const fdRr = inputs.FD_RR ?? 0.08;
      const yac = inputs.YAC ?? 4.0;
      const cc = inputs.CC ?? 0.65;
      
      const tsNorm = clamp((ts - 0.08) / (0.35 - 0.08), 0, 1);
      const fdRrNorm = clamp((fdRr - 0.03) / (0.15 - 0.03), 0, 1);
      const chain = 0.55 * fdRrNorm + 0.45 * tsNorm;
      
      const yprrNorm = clamp((yprr - 1.0) / (3.5 - 1.0), 0, 1);
      const yacNorm = clamp((yac - 2.0) / (7.0 - 2.0), 0, 1);
      const explosive = 0.60 * yprrNorm + 0.40 * yacNorm;
      
      const winSkill = cc;
      const wrAlpha = (chain * 0.40 + explosive * 0.35 + winSkill * 0.25) * 100;
      
      return {
        Chain: Math.round(chain * 10000) / 10000,
        Explosive: Math.round(explosive * 10000) / 10000,
        WinSkill: Math.round(winSkill * 10000) / 10000,
        WR_Alpha: Math.round(wrAlpha * 100) / 100,
      };
    };
    
    res.json({
      success: true,
      meta: {
        season: parsedSeason,
        minTargets: parsedMinRoutes,
        userInputs: inputs,
        userSubscores: calculateUserSubscores(inputs),
        matchCount: matches.length,
      },
      matches,
    });
  } catch (error) {
    console.error('[ForgeLab] WR match error:', error);
    res.status(500).json({ error: 'Failed to find matching WRs' });
  }
});

/**
 * POST /api/forge/lab/rb-match
 * Find RBs matching a formula profile
 * 
 * Body:
 *   weights - { volume, efficiency, receiving, explosive, scoring } dimension weights
 *   targetProfile - { carryShare, rushSuccessRate, explosiveRushRate, yardsPerCarry, targetsPerGame, catchRate, goalLineCarriesPerGame }
 *   season - season year (optional, default 2025)
 *   min_carries - minimum carries filter (optional, default 50)
 *   limit - max results (optional, default 10)
 */
forgeLabRouter.post('/rb-match', async (req: Request, res: Response) => {
  try {
    const { weights, targetProfile, season, min_carries, limit } = req.body;
    
    if (!weights && !targetProfile) {
      return res.status(400).json({ 
        error: 'Request body must include "weights" and/or "targetProfile"',
        example: {
          weights: { volume: 0.25, efficiency: 0.30, receiving: 0.15, explosive: 0.15, scoring: 0.15 },
          targetProfile: {
            carryShare: 0.55,
            rushSuccessRate: 0.45,
            explosiveRushRate: 0.12,
            yardsPerCarry: 4.8,
            targetsPerGame: 3.5,
            catchRate: 0.80,
            goalLineCarriesPerGame: 0.6
          },
          season: 2025,
          min_carries: 50,
          limit: 10,
        },
      });
    }
    
    const parsedSeason = typeof season === 'number' ? season : 2025;
    const parsedMinCarries = typeof min_carries === 'number' ? min_carries : 50;
    const parsedLimit = typeof limit === 'number' ? Math.min(limit, 50) : 10;
    
    if (parsedSeason < 2020 || parsedSeason > 2030) {
      return res.status(400).json({ error: 'season must be between 2020 and 2030' });
    }
    if (parsedMinCarries < 1 || parsedMinCarries > 500) {
      return res.status(400).json({ error: 'min_carries must be between 1 and 500' });
    }
    
    const matches = await playerAdvancedService.findMatchingRBs(
      weights || {},
      targetProfile || {},
      {
        season: parsedSeason,
        minCarries: parsedMinCarries,
        limit: parsedLimit,
      }
    );
    
    res.json({
      success: true,
      meta: {
        season: parsedSeason,
        minCarries: parsedMinCarries,
        weights: {
          volume: weights?.volume ?? 0.25,
          efficiency: weights?.efficiency ?? 0.30,
          receiving: weights?.receiving ?? 0.15,
          explosive: weights?.explosive ?? 0.15,
          scoring: weights?.scoring ?? 0.15,
        },
        targetProfile: {
          carryShare: targetProfile?.carryShare ?? 0.50,
          rushSuccessRate: targetProfile?.rushSuccessRate ?? 0.45,
          explosiveRushRate: targetProfile?.explosiveRushRate ?? 0.12,
          yardsPerCarry: targetProfile?.yardsPerCarry ?? 4.5,
          targetsPerGame: targetProfile?.targetsPerGame ?? 3.0,
          catchRate: targetProfile?.catchRate ?? 0.75,
          goalLineCarriesPerGame: targetProfile?.goalLineCarriesPerGame ?? 0.5,
        },
        matchCount: matches.length,
      },
      matches,
    });
  } catch (error) {
    console.error('[ForgeLab] RB match error:', error);
    res.status(500).json({ error: 'Failed to find matching RBs' });
  }
});

/**
 * GET /api/admin/player-mapping/search
 * Admin endpoint for player mapping sanity testing
 * Returns detailed player identity and advanced stats
 * 
 * Query params:
 *   query - player name fragment (required)
 *   position - filter by position (optional: WR, RB, TE, QB)
 *   limit - max results (optional, default 10, max 50)
 */
export const adminPlayerMappingRouter = Router();

adminPlayerMappingRouter.get('/search', async (req: Request, res: Response) => {
  try {
    const { query, position, limit } = req.query;
    
    if (!query || typeof query !== 'string' || query.trim().length < 2) {
      return res.json({
        meta: { query: query || '', count: 0 },
        data: [],
      });
    }
    
    const limitResult = parseIntParam(limit, 10, 'limit');
    if (limitResult.error) {
      return res.status(400).json({ error: limitResult.error });
    }
    const parsedLimit = Math.min(Math.max(limitResult.value, 1), 50);
    
    const positionFilter = typeof position === 'string' && ['WR', 'RB', 'TE', 'QB'].includes(position.toUpperCase())
      ? position.toUpperCase()
      : undefined;
    
    const searchResults = await playerAdvancedService.searchPlayers(query.trim(), {
      position: positionFilter,
      limit: parsedLimit,
    });
    
    const enrichedPlayers = await Promise.all(
      searchResults.map(async (player) => {
        let usage: Record<string, unknown> = {};
        let efficiency: Record<string, unknown> = {};
        let finishing: Record<string, unknown> = {};
        let meta: Record<string, unknown> = {
          gamesPlayed: 0,
          lastUpdated: new Date().toISOString(),
        };
        
        try {
          if (player.position === 'WR') {
            const wrStats = await playerAdvancedService.getWRSeasonStats(player.playerId, 2025);
            if (wrStats) {
              usage = {
                targets: wrStats.targets,
                receptions: wrStats.receptions,
                targetShare: wrStats.targetShare,
                airYards: wrStats.airYards,
                airYardsShare: wrStats.airYardsShare,
              };
              efficiency = {
                yprrEst: wrStats.yprrEst,
                epaPerTarget: wrStats.epaPerTarget,
                successRate: wrStats.successRate,
                fdPerTarget: wrStats.fdPerTarget,
                catchRate: wrStats.catchRate,
                yacPerRec: wrStats.yacPerRec,
              };
              finishing = {
                tds: wrStats.tds,
                firstDowns: wrStats.firstDowns,
                recYards: wrStats.recYards,
              };
              meta = {
                gamesPlayed: wrStats.gamesPlayed,
                lastUpdated: new Date().toISOString(),
              };
            }
          } else if (player.position === 'RB') {
            const rbStats = await playerAdvancedService.getRBSeasonStats(player.playerId, 2025);
            if (rbStats) {
              usage = {
                carries: rbStats.carries,
                carryShare: rbStats.carryShare,
                targets: rbStats.targets,
                targetShare: rbStats.targetShare,
                carriesPerGame: rbStats.carriesPerGame,
                targetsPerGame: rbStats.targetsPerGame,
              };
              efficiency = {
                yardsPerCarry: rbStats.yardsPerCarry,
                rushSuccessRate: rbStats.rushSuccessRate,
                rushEpaPerAtt: rbStats.rushEpaPerAtt,
                explosiveRushRate: rbStats.explosiveRushRate,
                catchRate: rbStats.catchRate,
                yacPerRec: rbStats.yacPerRec,
              };
              finishing = {
                totalTds: rbStats.totalTds,
                rushTds: rbStats.rushTds,
                recTds: rbStats.recTds,
                goalLineCarries: rbStats.goalLineCarries,
                redzoneCarries: rbStats.redzoneCarries,
              };
              meta = {
                gamesPlayed: rbStats.gamesPlayed,
                totalYards: rbStats.totalYards,
                lastUpdated: new Date().toISOString(),
              };
            }
          }
        } catch (err) {
          console.warn(`[AdminPlayerMapping] Failed to enrich stats for ${player.playerId}:`, err);
        }
        
        return {
          playerId: player.playerId,
          displayName: player.fullName,
          sleeperId: player.sleeperId || null,
          nflfastrGsisId: null,
          position: player.position,
          team: player.team,
          season: 2025,
          usage,
          efficiency,
          finishing,
          meta,
        };
      })
    );
    
    res.json({
      meta: {
        query: query.trim(),
        position: positionFilter || 'ALL',
        limit: parsedLimit,
        count: enrichedPlayers.length,
      },
      data: enrichedPlayers,
    });
  } catch (error) {
    console.error('[AdminPlayerMapping] Search error:', error);
    res.status(500).json({ 
      meta: { query: req.query.query || '', count: 0 },
      data: [],
      error: 'Failed to search players',
    });
  }
});

export default router;
