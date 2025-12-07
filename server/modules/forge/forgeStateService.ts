/**
 * FORGE State Service
 * 
 * Manages persistent state for FORGE's recursive scoring engine.
 * Each week's score depends on previous week's state (alpha, tier, volatility, momentum)
 * to enable multi-pass scoring with feedback loops.
 * 
 * FORGE Recursion v1:
 * - Pass 0: Compute alpha_raw using existing feature weights
 * - Pass 1: Calculate surprise, adjust using volatility/momentum, produce alpha_final
 * - Store updated state for next week's computation
 */

import { db } from '../../infra/db';
import { forgePlayerState, type ForgePlayerState, type InsertForgePlayerState } from '@shared/schema';
import { eq, and, desc, sql } from 'drizzle-orm';

export interface ForgeStateInput {
  playerId: string;
  playerName?: string;
  position?: string;
  team?: string;
  season: number;
  week: number;
}

export interface PreviousForgeState {
  alphaPrev: number | null;
  tierPrev: number | null;
  volatilityPrev: number | null;
  momentum: number | null;
  alphaHistory: number[];
}

export interface ForgeStateUpdate extends ForgeStateInput {
  alphaPrev: number | null;
  tierPrev: number | null;
  volatilityPrev: number | null;
  momentum: number | null;
  alphaRaw: number;
  expectedAlpha: number | null;
  surprise: number | null;
  stabilityAdjustment: number | null;
  alphaFinal: number;
  tierFinal: number;
  confidenceScore: number;
  alphaHistory: number[];
  volatilityUpdated: number | null;
  momentumUpdated: number | null;
}

const VOLATILITY_WINDOW = 4;
const BASELINE_DECAY = 0.7;

export const POSITION_BASELINES: Record<string, number> = {
  QB: 65,
  RB: 55,
  WR: 55,
  TE: 50,
};

export async function getPreviousWeekState(
  playerId: string,
  season: number,
  currentWeek: number
): Promise<PreviousForgeState | null> {
  if (currentWeek <= 1) {
    return null;
  }

  try {
    const [result] = await db
      .select()
      .from(forgePlayerState)
      .where(
        and(
          eq(forgePlayerState.playerId, playerId),
          eq(forgePlayerState.season, season),
          eq(forgePlayerState.week, currentWeek - 1)
        )
      )
      .limit(1);

    if (!result) {
      return null;
    }

    return {
      alphaPrev: result.alphaFinal,
      tierPrev: result.tierFinal,
      volatilityPrev: result.volatilityUpdated,
      momentum: result.momentumUpdated,
      alphaHistory: result.alphaHistory ?? [],
    };
  } catch (error) {
    console.error(`[ForgeState] Error fetching previous state for ${playerId}:`, error);
    return null;
  }
}

export async function getSeasonHistory(
  playerId: string,
  season: number,
  beforeWeek: number
): Promise<ForgePlayerState[]> {
  try {
    const results = await db
      .select()
      .from(forgePlayerState)
      .where(
        and(
          eq(forgePlayerState.playerId, playerId),
          eq(forgePlayerState.season, season),
          sql`${forgePlayerState.week} < ${beforeWeek}`
        )
      )
      .orderBy(desc(forgePlayerState.week));

    return results;
  } catch (error) {
    console.error(`[ForgeState] Error fetching season history for ${playerId}:`, error);
    return [];
  }
}

export function calculateVolatility(alphaHistory: number[]): number | null {
  if (alphaHistory.length < 2) {
    return null;
  }

  const window = alphaHistory.slice(0, VOLATILITY_WINDOW);
  const mean = window.reduce((sum, a) => sum + a, 0) / window.length;
  const variance = window.reduce((sum, a) => sum + Math.pow(a - mean, 2), 0) / window.length;
  
  return Math.sqrt(variance);
}

export function calculateMomentum(
  alphaHistory: number[],
  position: string
): number | null {
  if (alphaHistory.length < 3) {
    return null;
  }

  const recentAvg = alphaHistory.slice(0, 3).reduce((s, a) => s + a, 0) / 3;
  const seasonAvg = alphaHistory.reduce((s, a) => s + a, 0) / alphaHistory.length;
  const baseline = POSITION_BASELINES[position] ?? 55;

  return recentAvg - ((seasonAvg + baseline) / 2);
}

export function calculateExpectedAlpha(
  alphaPrev: number | null,
  position: string
): number {
  const baseline = POSITION_BASELINES[position] ?? 55;
  
  if (alphaPrev === null) {
    return baseline;
  }

  return alphaPrev * BASELINE_DECAY + baseline * (1 - BASELINE_DECAY);
}

export function calculateSurprise(
  alphaRaw: number,
  expectedAlpha: number
): number {
  return alphaRaw - expectedAlpha;
}

export function calculateStabilityAdjustment(
  surprise: number,
  volatility: number | null,
  momentum: number | null
): number {
  let adjustment = 0;

  if (volatility !== null) {
    if (volatility > 10) {
      adjustment -= Math.min(surprise * 0.3, 5);
    } else if (volatility < 5) {
      adjustment += Math.min(Math.abs(surprise) * 0.2, 3);
    }
  }

  if (momentum !== null) {
    if (momentum > 5 && surprise > 0) {
      adjustment += Math.min(momentum * 0.15, 3);
    } else if (momentum < -5 && surprise < 0) {
      adjustment -= Math.min(Math.abs(momentum) * 0.15, 3);
    }
  }

  return Math.max(-10, Math.min(10, adjustment));
}

export async function saveForgeState(update: ForgeStateUpdate): Promise<void> {
  try {
    const existing = await db
      .select({ id: forgePlayerState.id })
      .from(forgePlayerState)
      .where(
        and(
          eq(forgePlayerState.playerId, update.playerId),
          eq(forgePlayerState.season, update.season),
          eq(forgePlayerState.week, update.week)
        )
      )
      .limit(1);

    const record: InsertForgePlayerState = {
      playerId: update.playerId,
      playerName: update.playerName,
      position: update.position,
      team: update.team,
      season: update.season,
      week: update.week,
      alphaPrev: update.alphaPrev,
      tierPrev: update.tierPrev,
      volatilityPrev: update.volatilityPrev,
      momentum: update.momentum,
      alphaRaw: update.alphaRaw,
      expectedAlpha: update.expectedAlpha,
      surprise: update.surprise,
      stabilityAdjustment: update.stabilityAdjustment,
      alphaFinal: update.alphaFinal,
      tierFinal: update.tierFinal,
      confidenceScore: update.confidenceScore,
      alphaHistory: update.alphaHistory,
      volatilityUpdated: update.volatilityUpdated,
      momentumUpdated: update.momentumUpdated,
      computedAt: new Date(),
      passCount: 2,
    };

    if (existing.length > 0) {
      await db
        .update(forgePlayerState)
        .set(record)
        .where(eq(forgePlayerState.id, existing[0].id));
    } else {
      await db.insert(forgePlayerState).values(record);
    }

    console.log(`[ForgeState] Saved state for ${update.playerName} (Week ${update.week}): alpha=${update.alphaFinal.toFixed(1)}, surprise=${update.surprise?.toFixed(1) ?? 'N/A'}`);
  } catch (error) {
    console.error(`[ForgeState] Error saving state for ${update.playerId}:`, error);
    throw error;
  }
}

export async function getLatestPlayerStates(
  season: number,
  week: number,
  position?: string
): Promise<ForgePlayerState[]> {
  try {
    let query = db
      .select()
      .from(forgePlayerState)
      .where(
        and(
          eq(forgePlayerState.season, season),
          eq(forgePlayerState.week, week),
          position ? eq(forgePlayerState.position, position) : undefined
        )
      )
      .orderBy(desc(forgePlayerState.alphaFinal));

    return await query;
  } catch (error) {
    console.error(`[ForgeState] Error fetching latest states:`, error);
    return [];
  }
}

export async function getPlayerStateHistory(
  playerId: string,
  season: number
): Promise<ForgePlayerState[]> {
  try {
    return await db
      .select()
      .from(forgePlayerState)
      .where(
        and(
          eq(forgePlayerState.playerId, playerId),
          eq(forgePlayerState.season, season)
        )
      )
      .orderBy(forgePlayerState.week);
  } catch (error) {
    console.error(`[ForgeState] Error fetching player history:`, error);
    return [];
  }
}
