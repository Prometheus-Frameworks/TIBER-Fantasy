/**
 * FORGE Recursion v1 - Recursive Alpha Engine
 * 
 * A multi-pass scoring engine where each week's score depends not just on 
 * current performance, but on how that performance interacts with the 
 * player's historical trajectory and stability profile.
 * 
 * Two-Pass Scoring Loop:
 * - Pass 0: Compute alpha_raw using existing feature weights (standard FORGE)
 * - Pass 1: Calculate surprise, adjust using volatility/momentum, produce alpha_final
 * 
 * State is persisted in forge_player_state table for week-over-week recursion.
 */

import { 
  ForgeScore, 
  ForgeContext, 
  ForgeFeatureBundle,
  PlayerPosition,
} from './types';
import { calculateAlphaScore, AlphaModifierContext } from './alphaEngine';
import { assignTier } from './tiberTiers';
import { 
  getPreviousWeekState,
  calculateExpectedAlpha,
  calculateSurprise,
  calculateStabilityAdjustment,
  calculateVolatility,
  calculateMomentum,
  saveForgeState,
  type PreviousForgeState,
  type ForgeStateUpdate,
  POSITION_BASELINES,
} from './forgeStateService';
import { clamp } from './utils/scoring';

export interface RecursiveForgeScore extends ForgeScore {
  recursion: {
    pass0Alpha: number;
    pass1Alpha: number;
    expectedAlpha: number | null;
    surprise: number | null;
    stabilityAdjustment: number | null;
    volatility: number | null;
    momentum: number | null;
    alphaPrev: number | null;
    tierPrev: number | null;
    isFirstWeek: boolean;
  };
}

export interface RecursiveScoringOptions {
  persistState?: boolean;
  modifiers?: AlphaModifierContext;
}

export async function calculateRecursiveAlpha(
  context: ForgeContext,
  features: ForgeFeatureBundle,
  options: RecursiveScoringOptions = {}
): Promise<RecursiveForgeScore> {
  const { persistState = true, modifiers } = options;
  
  console.log(`[FORGE/Recursive] Starting two-pass scoring for ${context.playerName} (${context.position}, Week ${context.asOfWeek})`);

  const pass0Score = calculateAlphaScore(context, features, modifiers);
  const pass0Alpha = pass0Score.alpha;
  
  console.log(`[FORGE/Recursive] Pass 0 complete: alpha_raw = ${pass0Alpha.toFixed(1)}`);

  const week = typeof context.asOfWeek === 'number' ? context.asOfWeek : 1;
  const previousState = await getPreviousWeekState(
    context.playerId,
    context.season,
    week
  );

  const isFirstWeek = previousState === null;
  
  let pass1Alpha = pass0Alpha;
  let expectedAlpha: number | null = null;
  let surprise: number | null = null;
  let stabilityAdjustment: number | null = null;
  let volatility: number | null = null;
  let momentum: number | null = null;
  let alphaPrev: number | null = null;
  let tierPrev: number | null = null;
  let alphaHistory: number[] = [];

  if (previousState) {
    alphaPrev = previousState.alphaPrev;
    tierPrev = previousState.tierPrev;
    volatility = previousState.volatilityPrev;
    momentum = previousState.momentum;
    alphaHistory = previousState.alphaHistory ?? [];

    expectedAlpha = calculateExpectedAlpha(alphaPrev, context.position);
    surprise = calculateSurprise(pass0Alpha, expectedAlpha);
    stabilityAdjustment = calculateStabilityAdjustment(surprise, volatility, momentum);
    
    pass1Alpha = clamp(pass0Alpha + stabilityAdjustment, 0, 100);
    
    console.log(`[FORGE/Recursive] Pass 1: expected=${expectedAlpha.toFixed(1)}, surprise=${surprise.toFixed(1)}, adj=${stabilityAdjustment.toFixed(1)}, final=${pass1Alpha.toFixed(1)}`);
  } else {
    expectedAlpha = POSITION_BASELINES[context.position] ?? 55;
    surprise = pass0Alpha - expectedAlpha;
    console.log(`[FORGE/Recursive] First week for player - no previous state, using raw alpha`);
  }

  const newAlphaHistory = [pass1Alpha, ...alphaHistory].slice(0, 8);
  const volatilityUpdated = calculateVolatility(newAlphaHistory);
  const momentumUpdated = calculateMomentum(newAlphaHistory, context.position);

  const tierString = assignTier(pass1Alpha, context.position as PlayerPosition);
  const tierFinal = tierString === 'T1' ? 1 : tierString === 'T2' ? 2 : tierString === 'T3' ? 3 : 4;

  if (persistState) {
    const stateUpdate: ForgeStateUpdate = {
      playerId: context.playerId,
      playerName: context.playerName,
      position: context.position,
      team: context.nflTeam,
      season: context.season,
      week,
      alphaPrev,
      tierPrev,
      volatilityPrev: volatility,
      momentum,
      alphaRaw: pass0Alpha,
      expectedAlpha,
      surprise,
      stabilityAdjustment,
      alphaFinal: pass1Alpha,
      tierFinal,
      confidenceScore: pass0Score.confidence,
      alphaHistory: newAlphaHistory,
      volatilityUpdated,
      momentumUpdated,
    };

    try {
      await saveForgeState(stateUpdate);
    } catch (err) {
      console.error(`[FORGE/Recursive] Failed to persist state:`, err);
    }
  }

  return {
    ...pass0Score,
    alpha: Math.round(pass1Alpha * 10) / 10,
    rawAlpha: pass0Alpha,
    recursion: {
      pass0Alpha,
      pass1Alpha,
      expectedAlpha,
      surprise,
      stabilityAdjustment,
      volatility,
      momentum,
      alphaPrev,
      tierPrev,
      isFirstWeek,
    },
  };
}

export async function calculateRecursiveAlphaBatch(
  players: Array<{ context: ForgeContext; features: ForgeFeatureBundle }>,
  options: RecursiveScoringOptions = {}
): Promise<RecursiveForgeScore[]> {
  console.log(`[FORGE/Recursive] Starting batch recursive scoring for ${players.length} players`);
  
  const results: RecursiveForgeScore[] = [];
  
  for (const { context, features } of players) {
    try {
      const score = await calculateRecursiveAlpha(context, features, options);
      results.push(score);
    } catch (err) {
      console.error(`[FORGE/Recursive] Failed to score ${context.playerName}:`, err);
    }
  }
  
  console.log(`[FORGE/Recursive] Batch complete: ${results.length}/${players.length} scored`);
  
  return results;
}

export function getRecursionSummary(score: RecursiveForgeScore): string {
  const r = score.recursion;
  
  if (r.isFirstWeek) {
    return `First week: α=${r.pass0Alpha.toFixed(1)} (no prior state)`;
  }
  
  const surpriseLabel = 
    r.surprise! > 5 ? 'OUTPERFORMED' :
    r.surprise! < -5 ? 'UNDERPERFORMED' :
    'MET_EXPECTATIONS';
  
  return [
    `Pass0: ${r.pass0Alpha.toFixed(1)}`,
    `Expected: ${r.expectedAlpha?.toFixed(1) ?? 'N/A'}`,
    `Surprise: ${r.surprise?.toFixed(1) ?? 'N/A'} (${surpriseLabel})`,
    `Adj: ${r.stabilityAdjustment?.toFixed(1) ?? '0'}`,
    `Final: ${r.pass1Alpha.toFixed(1)}`,
    `Vol: ${r.volatility?.toFixed(1) ?? 'N/A'}`,
    `Mom: ${r.momentum?.toFixed(1) ?? 'N/A'}`,
  ].join(' | ');
}
