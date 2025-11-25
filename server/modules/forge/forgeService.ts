/**
 * FORGE v0.1 - Service
 * Football Oriented Recursive Grading Engine
 * 
 * Main service class providing the programmatic API for FORGE scoring.
 * 
 * Public API:
 * - getForgeScoreForPlayer(playerId, season, asOfWeek)
 * - getForgeScoresForPlayers(playerIds, season, asOfWeek)
 */

import { 
  ForgeScore, 
  ForgeContext, 
  ForgeFeatureBundle, 
  WeekOrPreseason, 
  PlayerPosition, 
  IForgeService 
} from './types';
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
}

export const forgeService: IForgeService = new ForgeService();

export default forgeService;
