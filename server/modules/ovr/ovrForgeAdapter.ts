import type { ForgePosition, ForgeScore } from '../forge';
import { getForgeBatch, getForgeScoreForPlayer } from '../forge';

export interface OvrForgeContext {
  season: number;
  week: number;
  position?: ForgePosition;
}

/**
 * Get a batch of FORGE scores for OVR calculations.
 * This adapter provides a clean interface for OVR to consume FORGE data.
 */
export async function getOvrForgeSnapshot(
  ctx: OvrForgeContext,
  limit: number = 100
): Promise<ForgeScore[]> {
  const { season, week, position } = ctx;

  const batch = await getForgeBatch({
    season,
    week,
    position,
    limit,
  });

  return batch.scores;
}

/**
 * Get a single player's FORGE score for OVR calculation.
 */
export async function getOvrForgeScoreForPlayer(
  playerId: string,
  ctx: OvrForgeContext
): Promise<ForgeScore | null> {
  return getForgeScoreForPlayer(playerId, {
    season: ctx.season,
    week: ctx.week,
  });
}
