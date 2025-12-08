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
}

import { calculateAlphaScore } from './alphaEngine';
import { fetchContext } from './context/contextFetcher';
import { buildWRFeatures } from './features/wrFeatures';
import { buildRBFeatures } from './features/rbFeatures';
import { buildTEFeatures } from './features/teFeatures';
import { buildQBFeatures } from './features/qbFeatures';

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
      endWeek
    } = query;

    const weekRangeStr = startWeek && endWeek ? `, weeks ${startWeek}-${endWeek}` : '';
    console.log(`[FORGE] Batch request: position=${position ?? 'ALL'}, limit=${limit}, season=${season}${weekRangeStr}`);

    // Fetch only eligible players with 2025 activity
    const playerIds = await this.fetchPlayerIdsForBatch(position, limit, season, startWeek, endWeek);

    if (playerIds.length === 0) {
      console.log('[FORGE] No eligible players found for batch query');
      return [];
    }

    // Pass week range to scoring
    return this.getForgeScoresForPlayersWithRange(playerIds, season, asOfWeek, startWeek, endWeek);
  }

  /**
   * Get FORGE scores for multiple players with optional week range filtering
   */
  private async getForgeScoresForPlayersWithRange(
    playerIds: string[], 
    season: number, 
    asOfWeek: WeekOrPreseason,
    startWeek?: number,
    endWeek?: number
  ): Promise<ForgeScore[]> {
    console.log(`[FORGE] Scoring ${playerIds.length} players...${startWeek && endWeek ? ` (weeks ${startWeek}-${endWeek})` : ''}`);
    
    const scorePromises = playerIds.map(id => 
      this.scoreSinglePlayerWithRange(id, season, asOfWeek, startWeek, endWeek)
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
   * Score a single player with optional week range filtering
   */
  private async scoreSinglePlayerWithRange(
    playerId: string, 
    season: number, 
    asOfWeek: WeekOrPreseason,
    startWeek?: number,
    endWeek?: number
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
    const forgeScore: ForgeScore = calculateAlphaScore(context, featureBundle);
    
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
