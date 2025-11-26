import { forgeService } from './forgeService';
import type { ForgePosition, ForgeScore } from './types';

export interface ForgeBatchQuery {
  position?: ForgePosition;
  limit?: number;
  season?: number;
  week?: number;
}

export interface ForgeBatchResult {
  scores: ForgeScore[];
  meta: {
    position: ForgePosition | 'ALL';
    limit: number;
    season: number;
    week: number;
    count: number;
    scoredAt: string;
  };
}

/**
 * Canonical server-side way to get a batch of FORGE scores.
 * Internal modules (OVR, TIBER, Strategy, etc.) should use this
 * instead of hitting the HTTP endpoint.
 */
export async function getForgeBatch(query: ForgeBatchQuery): Promise<ForgeBatchResult> {
  const {
    position,
    limit = 100,
    season = 2024,
    week = 17,
  } = query;

  const scores = await forgeService.getForgeScoresBatch({
    position,
    limit,
    season,
    asOfWeek: week,
  });

  const sortedScores = scores.sort((a, b) => b.alpha - a.alpha);

  return {
    scores: sortedScores,
    meta: {
      position: position ?? 'ALL',
      limit,
      season,
      week,
      count: sortedScores.length,
      scoredAt: new Date().toISOString(),
    },
  };
}

/**
 * Get a single player's FORGE score snapshot for a given season/week.
 */
export async function getForgeScoreForPlayer(
  playerId: string,
  options?: { season?: number; week?: number }
): Promise<ForgeScore | null> {
  const { season = 2024, week = 17 } = options ?? {};

  try {
    const score = await forgeService.getForgeScoreForPlayer(playerId, season, week);
    return score;
  } catch (error) {
    console.error(`[FORGE/Gateway] Error getting score for player ${playerId}:`, error);
    return null;
  }
}
