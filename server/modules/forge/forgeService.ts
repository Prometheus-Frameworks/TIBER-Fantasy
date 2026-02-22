/**
 * FORGE v0.1 - Service
 * Football Oriented Recursive Grading Engine
 * 
 * Main service class providing the programmatic API for FORGE scoring.
 * 
 * Public API:
 * - getForgeScoreForPlayer(playerId, season, asOfWeek)
 * - getForgeScoresForPlayers(playerIds, season, asOfWeek)
 * - getForgeScoresBatch(query) - batch scoring with position/limit filters
 */

import { 
  ForgeScore, 
  ForgeContext, 
  ForgeFeatureBundle, 
  WeekOrPreseason, 
  PlayerPosition, 
  IForgeService,
  ForgePosition,
} from './types';
import { db } from '../../infra/db';
import { playerIdentityMap, weeklyStats } from '@shared/schema';
import { eq, and, isNotNull, sql, desc, gte } from 'drizzle-orm';
import { 
  USE_DATADIVE_FORGE, 
  getDatadiveEligiblePlayers,
  getCurrentSnapshot 
} from '../../services/datadiveContext';

import type { LeagueType, ForgeScoreOptions } from './types';
import { DEFAULT_SCORE_OPTIONS } from './types';

/**
 * Query parameters for batch scoring
 */
export interface ForgeBatchQuery {
  position?: ForgePosition;
  limit?: number;
  season?: number;
  asOfWeek?: WeekOrPreseason;
  startWeek?: number;
  endWeek?: number;
  leagueType?: LeagueType;
}

import { calculateAlphaScore } from './alphaEngine';
import { fetchContext } from './context/contextFetcher';
import { buildWRFeatures } from './features/wrFeatures';
import { buildRBFeatures } from './features/rbFeatures';
import { buildTEFeatures } from './features/teFeatures';
import { buildQBFeatures } from './features/qbFeatures';
import { getThisWeekMatchup } from './dvpMatchupService';

const featureBuilderMap = new Map<PlayerPosition, (context: ForgeContext) => ForgeFeatureBundle>([
  ['WR', buildWRFeatures],
  ['RB', buildRBFeatures],
  ['TE', buildTEFeatures],
  ['QB', buildQBFeatures],
]);

class ForgeService implements IForgeService {
  private async scoreSinglePlayer(
    playerId: string, 
    season: number, 
    asOfWeek: WeekOrPreseason
  ): Promise<ForgeScore> {
    console.log(`[FORGE] Scoring player ${playerId} for season ${season}, week ${asOfWeek}`);
    
    const context: ForgeContext = await fetchContext(playerId, season, asOfWeek);

    const builder = featureBuilderMap.get(context.position);
    if (!builder) {
      throw new Error(`FORGE v0.1: Feature builder not found for position: ${context.position}`);
    }

    console.log(`[FORGE] Building features for ${context.playerName} (${context.position})...`);
    const featureBundle: ForgeFeatureBundle = builder(context);

    console.log(`[FORGE] Calculating Alpha Score...`);
    const forgeScore: ForgeScore = calculateAlphaScore(context, featureBundle);
    
    console.log(`[FORGE] ${context.playerName}: Alpha=${forgeScore.alpha}, Confidence=${forgeScore.confidence}, Trajectory=${forgeScore.trajectory}`);
    
    return forgeScore;
  }

  /**
   * Get FORGE score for a single player
   */
  public async getForgeScoreForPlayer(
    playerId: string, 
    season: number, 
    asOfWeek: WeekOrPreseason
  ): Promise<ForgeScore> {
    return this.scoreSinglePlayer(playerId, season, asOfWeek);
  }

  /**
   * Get FORGE scores for multiple players
   * Returns only successful scores, logs errors for failures
   */
  public async getForgeScoresForPlayers(
    playerIds: string[], 
    season: number, 
    asOfWeek: WeekOrPreseason
  ): Promise<ForgeScore[]> {
    console.log(`[FORGE] Scoring ${playerIds.length} players...`);
    
    const scorePromises = playerIds.map(id => 
      this.scoreSinglePlayer(id, season, asOfWeek)
        .catch(error => {
          console.error(`[FORGE] Error scoring player ${id}:`, error.message);
          return null;
        })
    );

    const results = await Promise.all(scorePromises);
    const successfulScores = results.filter((score): score is ForgeScore => score !== null);
    
    console.log(`[FORGE] Successfully scored ${successfulScores.length}/${playerIds.length} players`);
    
    return successfulScores;
  }

  /**
   * Batch scoring with position/limit filters
   * Used by /api/forge/batch endpoint
   * 
   * ELIGIBILITY (v0.2):
   * - Only includes players with actual 2025 game activity
   * - Ordered by total fantasy points before scoring
   * - Deduplicates identity variations (e.g., "Chris Godwin" vs "Chris Godwin Jr.")
   * 
   * WEEK RANGE (v0.3):
   * - startWeek/endWeek allow filtering to specific week ranges
   * - Useful for "Last 4 Weeks" or custom date range analysis
   */
  public async getForgeScoresBatch(query: ForgeBatchQuery): Promise<ForgeScore[]> {
    const { 
      position, 
      limit = 100, 
      season = 2025, 
      asOfWeek = 17,
      startWeek,
      endWeek,
      leagueType,
    } = query;

    const scoreOptions: ForgeScoreOptions = {
      ...DEFAULT_SCORE_OPTIONS,
      ...(leagueType && { leagueType }),
    };

    const weekRangeStr = startWeek && endWeek ? `, weeks ${startWeek}-${endWeek}` : '';
    const optionsStr = `[${scoreOptions.leagueType}]`;
    console.log(`[FORGE] Batch request: position=${position ?? 'ALL'}, limit=${limit}, season=${season}${weekRangeStr} ${optionsStr}`);

    // Fetch only eligible players with 2025 activity
    const playerIds = await this.fetchPlayerIdsForBatch(position, limit, season, startWeek, endWeek);

    if (playerIds.length === 0) {
      console.log('[FORGE] No eligible players found for batch query');
      return [];
    }

    // Pass week range and scoring options to scoring
    return this.getForgeScoresForPlayersWithRange(playerIds, season, asOfWeek, startWeek, endWeek, scoreOptions);
  }

  /**
   * Get FORGE scores for multiple players with optional week range filtering
   */
  private async getForgeScoresForPlayersWithRange(
    playerIds: string[], 
    season: number, 
    asOfWeek: WeekOrPreseason,
    startWeek?: number,
    endWeek?: number,
    scoreOptions?: ForgeScoreOptions
  ): Promise<ForgeScore[]> {
    console.log(`[FORGE] Scoring ${playerIds.length} players...${startWeek && endWeek ? ` (weeks ${startWeek}-${endWeek})` : ''}`);
    
    const scorePromises = playerIds.map(id => 
      this.scoreSinglePlayerWithRange(id, season, asOfWeek, startWeek, endWeek, scoreOptions)
        .catch(error => {
          console.error(`[FORGE] Error scoring player ${id}:`, error.message);
          return null;
        })
    );

    const results = await Promise.all(scorePromises);
    const successfulScores = results.filter((score): score is ForgeScore => score !== null);
    
    console.log(`[FORGE] Successfully scored ${successfulScores.length}/${playerIds.length} players`);
    
    return successfulScores;
  }

  /**
   * Score a single player with optional week range filtering and scoring options
   */
  private async scoreSinglePlayerWithRange(
    playerId: string, 
    season: number, 
    asOfWeek: WeekOrPreseason,
    startWeek?: number,
    endWeek?: number,
    scoreOptions?: ForgeScoreOptions
  ): Promise<ForgeScore> {
    const weekRangeStr = startWeek && endWeek ? ` (weeks ${startWeek}-${endWeek})` : '';
    console.log(`[FORGE] Scoring player ${playerId} for season ${season}, week ${asOfWeek}${weekRangeStr}`);
    
    // Use endWeek as asOfWeek if provided, otherwise use the original asOfWeek
    const effectiveAsOfWeek = endWeek ?? asOfWeek;
    
    const context: ForgeContext = await fetchContext(playerId, season, effectiveAsOfWeek, startWeek);

    const builder = featureBuilderMap.get(context.position);
    if (!builder) {
      throw new Error(`FORGE v0.1: Feature builder not found for position: ${context.position}`);
    }

    console.log(`[FORGE] Building features for ${context.playerName} (${context.position})...`);
    const featureBundle: ForgeFeatureBundle = builder(context);

    console.log(`[FORGE] Calculating Alpha Score...`);
    const forgeScore: ForgeScore = calculateAlphaScore(context, featureBundle, undefined, scoreOptions);
    
    // v1.7: Fetch next week matchup data for DvP column
    if (context.nflTeam && typeof effectiveAsOfWeek === 'number') {
      try {
        const nextWeek = effectiveAsOfWeek + 1;
        const matchup = await getThisWeekMatchup(context.nflTeam, context.position, nextWeek, season);
        if (matchup) {
          forgeScore.nextMatchup = {
            opponent: matchup.opponent,
            dvpRank: matchup.rankVsPosition,
            isHome: matchup.isHome,
          };
        }
      } catch (err) {
        // Silently continue without matchup data
      }
    }
    
    console.log(`[FORGE] ${context.playerName}: Alpha=${forgeScore.alpha}, Confidence=${forgeScore.confidence}, Trajectory=${forgeScore.trajectory}`);
    
    return forgeScore;
  }

  /**
   * Fetch player IDs from identity map based on position/limit
   * ELIGIBILITY RULES (as of v0.3):
   * 1. For 2025+ with USE_DATADIVE_FORGE: Uses Datadive snapshot tables
   * 2. Must have at least 1 game played in current season
   * 3. Must be on an active NFL team (not FA)
   * 4. Ordered by total fantasy points (PPR) to get most relevant players first
   * 5. Deduplication: If multiple canonical IDs map to same sleeper_id, prefer the one with more data
   * 6. Week range filtering: Only counts activity within startWeek-endWeek if provided
   */
  private async fetchPlayerIdsForBatch(
    position: ForgePosition | undefined,
    limit: number,
    season: number = 2025,
    startWeek?: number,
    endWeek?: number
  ): Promise<string[]> {
    try {
      // For 2025+, use Datadive snapshot if feature flag is enabled
      if (season >= 2025 && USE_DATADIVE_FORGE) {
        const snapshot = await getCurrentSnapshot();
        if (snapshot && snapshot.season === season) {
          console.log(`[FORGE] Using Datadive snapshot for batch eligibility (snapshot ${snapshot.snapshotId}, week ${snapshot.week})`);
          
          const datadivePlayers = await getDatadiveEligiblePlayers(position, limit);
          if (datadivePlayers.length > 0) {
            const playerIds = datadivePlayers.map(p => p.canonicalId);
            console.log(`[FORGE] Found ${playerIds.length} eligible players from Datadive (position=${position ?? 'ALL'})`);
            
            if (playerIds.length > 0) {
              console.log(`[FORGE] Top 5 eligible: ${playerIds.slice(0, 5).join(', ')}`);
            }
            
            return playerIds;
          }
          
          console.log('[FORGE] No players from Datadive, falling back to legacy query');
        }
      }
      
      // Legacy path: Use weekly_stats directly with live status filtering
      const skillPositions: ForgePosition[] = ['QB', 'RB', 'WR', 'TE'];
      const targetPositions = position ? [position] : skillPositions;
      
      const allPlayerIds: string[] = [];
      const perPositionLimit = position ? limit : Math.ceil(limit / 4);
      
      // Track seen players to avoid duplicates across identity variations
      const seenPlayerNames = new Set<string>();

      for (const pos of targetPositions) {
        // Query: Join identity map with weekly_stats and live status
        // Filter out IR/ineligible players using player_live_status table
        const playersWithActivity = await db.execute<{
          canonical_id: string;
          full_name: string;
          nfl_team: string;
          current_team: string;
          games_played: number;
          total_fpts: number;
        }>(sql`
          SELECT 
            p.canonical_id,
            p.full_name,
            p.nfl_team,
            COALESCE(pls.current_team, p.nfl_team) as current_team,
            COUNT(DISTINCT w.week) as games_played,
            COALESCE(SUM(w.fantasy_points_ppr), 0) as total_fpts
          FROM player_identity_map p
          INNER JOIN weekly_stats w ON (
            w.player_id = p.sleeper_id 
            OR w.player_id = p.gsis_id
            OR w.player_id = p.nfl_data_py_id
            OR w.player_id = p.canonical_id
          )
          LEFT JOIN player_live_status pls ON pls.canonical_id = p.canonical_id
          WHERE p.position = ${pos}
            AND p.is_active = true
            AND p.nfl_team IS NOT NULL
            AND w.season = ${season}
            AND w.fantasy_points_ppr > 0
            AND (pls.is_eligible_for_forge IS NULL OR pls.is_eligible_for_forge = true)
          GROUP BY p.canonical_id, p.full_name, p.nfl_team, pls.current_team
          HAVING COUNT(DISTINCT w.week) >= 1
          ORDER BY total_fpts DESC
          LIMIT ${perPositionLimit * 2}
        `);

        // Deduplicate by normalized player name (handles "Chris Godwin" vs "Chris Godwin Jr.")
        for (const player of playersWithActivity.rows) {
          const normalizedName = this.normalizePlayerName(player.full_name);
          
          if (!seenPlayerNames.has(normalizedName)) {
            seenPlayerNames.add(normalizedName);
            allPlayerIds.push(player.canonical_id);
            
            if (allPlayerIds.length >= limit) break;
          }
        }
        
        if (allPlayerIds.length >= limit) break;
      }

      console.log(`[FORGE] Found ${allPlayerIds.length} eligible players for batch (position=${position ?? 'ALL'}, season=${season})`);
      
      // Debug: Log first 5 players
      if (allPlayerIds.length > 0) {
        console.log(`[FORGE] Top 5 eligible: ${allPlayerIds.slice(0, 5).join(', ')}`);
      }

      return allPlayerIds.slice(0, limit);
    } catch (error) {
      console.error('[FORGE] Error fetching players for batch:', error);
      // Fallback to legacy query if new approach fails
      return this.fetchPlayerIdsForBatchLegacy(position, limit);
    }
  }

  /**
   * Normalize player name for deduplication
   * Handles: "Chris Godwin Jr." -> "chris godwin", "Ja'Marr Chase" -> "jamarr chase"
   */
  private normalizePlayerName(name: string): string {
    return name
      .toLowerCase()
      .replace(/\s+(jr\.?|sr\.?|ii|iii|iv|v)$/i, '') // Remove suffix
      .replace(/[^a-z\s]/g, '') // Remove special chars
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Legacy fallback: Original simple query without activity filtering
   */
  private async fetchPlayerIdsForBatchLegacy(
    position: ForgePosition | undefined,
    limit: number
  ): Promise<string[]> {
    console.log('[FORGE] Using legacy player fetch (fallback)');
    const skillPositions: ForgePosition[] = ['QB', 'RB', 'WR', 'TE'];
    const targetPositions = position ? [position] : skillPositions;
    
    const allPlayerIds: string[] = [];
    const perPositionLimit = position ? limit : Math.ceil(limit / 4);

    for (const pos of targetPositions) {
      const players = await db
        .select({ canonicalId: playerIdentityMap.canonicalId })
        .from(playerIdentityMap)
        .where(
          and(
            eq(playerIdentityMap.isActive, true),
            isNotNull(playerIdentityMap.nflTeam),
            eq(playerIdentityMap.position, pos)
          )
        )
        .limit(perPositionLimit);

      allPlayerIds.push(...players.map(p => p.canonicalId));
    }

    return allPlayerIds.slice(0, limit);
  }
}

export const forgeService = new ForgeService();

export default forgeService;

// ============================================================================
// NEW E/F/O/G Unified API Helpers (v2)
// These wrap the full E→F→O→G pipeline for external systems
// ============================================================================

import { Position as EGPosition, ForgePillarScores, runForgeEngineBatch } from './forgeEngine';
import { ViewMode, gradeForgeWithMeta } from './forgeGrading';
import type { FootballLensIssue } from './forgeFootballLens';

export type ForgeMode = ViewMode;

export type ForgeFullResult = {
  playerId: string;
  playerName: string;
  position: EGPosition;
  nflTeam?: string;
  season: number;
  week: number | 'season';
  gamesPlayed: number;
  pillars: ForgePillarScores;
  alpha: number;
  tier: string;
  issues: FootballLensIssue[] | null;
  debug?: {
    baseAlpha: number;
    recursionAdjustment: number;
    footballLensAdjusted: boolean;
  };
};

export type ForgeBatchResult = {
  scores: ForgeFullResult[];
  meta: {
    position: EGPosition;
    mode: ForgeMode;
    season: number;
    week: number | 'season';
    version: string;
    description: string;
    count: number;
    playersWithIssues: number;
    scoredAt: string;
  };
};

/**
 * Get FORGE score for a single player using full E→F→O→G pipeline
 */
export async function getForgeForPlayer(
  playerId: string,
  position: EGPosition,
  season: number = 2025,
  week: number | 'season' = 'season',
  mode: ForgeMode = 'redraft'
): Promise<ForgeFullResult | null> {
  try {
    const { runForgeEngine } = await import('./forgeEngine');
    const { gradeForge } = await import('./forgeGrading');
    
    const engineOutput = await runForgeEngine(playerId, position, season, week);
    if (!engineOutput) return null;
    
    const gradeResult = gradeForge(engineOutput, { mode });
    
    return {
      playerId: engineOutput.playerId,
      playerName: engineOutput.playerName,
      position: engineOutput.position,
      nflTeam: engineOutput.nflTeam,
      season: engineOutput.season,
      week: engineOutput.week,
      gamesPlayed: engineOutput.gamesPlayed,
      pillars: engineOutput.pillars,
      alpha: gradeResult.alpha,
      tier: gradeResult.tier,
      issues: gradeResult.issues || null,
      debug: gradeResult.debug,
    };
  } catch (error) {
    console.error(`[ForgeService] getForgeForPlayer error for ${playerId}:`, error);
    return null;
  }
}

/**
 * Get FORGE scores for all players at a position using full E→F→O→G pipeline
 */
export async function getForgeForBatch(
  position: EGPosition,
  season: number = 2025,
  week: number | 'season' = 'season',
  mode: ForgeMode = 'redraft',
  limit: number = 50
): Promise<ForgeBatchResult> {
  const engineOutputs = await runForgeEngineBatch(position, season, week, limit);
  
  const scores: ForgeFullResult[] = engineOutputs.map((engineOutput) => {
    const gradeResult = gradeForgeWithMeta(engineOutput, { mode });
    
    return {
      playerId: engineOutput.playerId,
      playerName: engineOutput.playerName,
      position: engineOutput.position,
      nflTeam: engineOutput.nflTeam,
      season: engineOutput.season,
      week: engineOutput.week,
      gamesPlayed: engineOutput.gamesPlayed,
      pillars: engineOutput.pillars,
      alpha: gradeResult.alpha,
      tier: gradeResult.tier,
      issues: gradeResult.issues || null,
      debug: gradeResult.debug,
    };
  });

  scores.sort((a, b) => b.alpha - a.alpha);
  
  const playersWithIssues = scores.filter(s => s.issues && s.issues.length > 0).length;

  return {
    scores,
    meta: {
      position,
      mode,
      season,
      week,
      version: 'E+G/v2',
      description: 'FORGE Engine+Grading with Football Lens (F) and Orientation (O) layers',
      count: scores.length,
      playersWithIssues,
      scoredAt: new Date().toISOString(),
    },
  };
}

/**
 * Map FORGE tier (T1-T5) to branded Tiber tier names (optional)
 */
export const TIBER_TIER_MAP: Record<string, string> = {
  T1: 'Tiber Prime',
  T2: 'Tiber Core',
  T3: 'Tiber Fringe',
  T4: 'Tiber Depth',
  T5: 'Tiber Fragile',
};

export function getTiberTierName(forgeTier: string): string {
  return TIBER_TIER_MAP[forgeTier] || forgeTier;
}
