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
import { playerIdentityMap } from '@shared/schema';
import { eq, and, isNotNull } from 'drizzle-orm';

/**
 * Query parameters for batch scoring
 */
export interface ForgeBatchQuery {
  position?: ForgePosition;
  limit?: number;
  season?: number;
  asOfWeek?: WeekOrPreseason;
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
   */
  public async getForgeScoresBatch(query: ForgeBatchQuery): Promise<ForgeScore[]> {
    const { 
      position, 
      limit = 100, 
      season = 2024, 
      asOfWeek = 17 
    } = query;

    console.log(`[FORGE] Batch request: position=${position ?? 'ALL'}, limit=${limit}`);

    const playerIds = await this.fetchPlayerIdsForBatch(position, limit);

    if (playerIds.length === 0) {
      console.log('[FORGE] No players found for batch query');
      return [];
    }

    return this.getForgeScoresForPlayers(playerIds, season, asOfWeek);
  }

  /**
   * Fetch player IDs from identity map based on position/limit
   * If no position specified, fetches all skill positions (QB, RB, WR, TE)
   */
  private async fetchPlayerIdsForBatch(
    position: ForgePosition | undefined,
    limit: number
  ): Promise<string[]> {
    try {
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
    } catch (error) {
      console.error('[FORGE] Error fetching players for batch:', error);
      return [];
    }
  }
}

export const forgeService = new ForgeService();

export default forgeService;
