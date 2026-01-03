/**
 * FORGE Simulation Service
 * 
 * Runs isolated simulations of the FORGE recursive engine against historical data.
 * Writes to forge_player_state_sim table, never touching production forge_player_state.
 * 
 * Key capabilities:
 * - Configurable parameters (decay ratio, volatility thresholds, momentum multiplier, etc.)
 * - Week-by-week sequential processing (week N's output feeds week N+1's prior state)
 * - Outlier detection and flagging
 * - Progress tracking for UI updates
 */

import { db } from '../../../infra/db';
import { 
  forgePlayerStateSim, 
  forgeSimRuns, 
  forgeSimPresets,
  weeklyStats,
  type ForgeSimPreset,
  type InsertForgePlayerStateSim,
  type InsertForgeSimRun,
} from '@shared/schema';
import { eq, and, sql, desc, inArray, gte, or, isNotNull } from 'drizzle-orm';
import { fetchContext } from '../context/contextFetcher';
import { buildWRFeatures } from '../features/wrFeatures';
import { buildRBFeatures } from '../features/rbFeatures';
import { buildTEFeatures } from '../features/teFeatures';
import { buildQBFeatures } from '../features/qbFeatures';
import { calculateAlphaScore } from '../alphaEngine';
import { assignTier } from '../tiberTiers';
import { clamp } from '../utils/scoring';
import type { ForgeContext, ForgeFeatureBundle, PlayerPosition } from '../types';

export interface SimulationParameters {
  decayRatio: number;
  baselineWeight: number;
  volatilityHighThreshold: number;
  volatilityLowThreshold: number;
  momentumMultiplier: number;
  adjustmentCap: number;
  historyWindowVolatility: number;
  historyWindowMomentum: number;
  outlierLargeAdjustment: number;
  outlierVolatilitySpike: number;
}

export const DEFAULT_PARAMETERS: SimulationParameters = {
  decayRatio: 0.7,
  baselineWeight: 0.3,
  volatilityHighThreshold: 10,
  volatilityLowThreshold: 5,
  momentumMultiplier: 0.15,
  adjustmentCap: 10,
  historyWindowVolatility: 4,
  historyWindowMomentum: 3,
  outlierLargeAdjustment: 8,
  outlierVolatilitySpike: 15,
};

export const POSITION_BASELINES: Record<string, number> = {
  QB: 65,
  RB: 55,
  WR: 55,
  TE: 50,
};

export interface SimulationRunConfig {
  season: number;
  weekStart: number;
  weekEnd: number;
  parameters: SimulationParameters;
  presetId?: number;
  presetName?: string;
  clearPrevious?: boolean;
}

export interface SimulationProgress {
  runId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  currentWeek: number;
  totalWeeks: number;
  totalPlayers: number;
  processedPlayers: number;
  outlierCount: number;
  error?: string;
}

const activeRuns = new Map<string, { cancelled: boolean }>();

function generateRunId(): string {
  return `sim_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

export async function startSimulation(config: SimulationRunConfig): Promise<string> {
  const runId = generateRunId();
  
  activeRuns.set(runId, { cancelled: false });
  
  const runRecord: InsertForgeSimRun = {
    id: runId,
    presetId: config.presetId ?? null,
    presetName: config.presetName ?? 'Custom',
    season: config.season,
    weekStart: config.weekStart,
    weekEnd: config.weekEnd,
    parametersSnapshot: JSON.stringify(config.parameters),
    status: 'pending',
    currentWeek: config.weekStart,
    totalPlayers: 0,
    processedPlayers: 0,
    startedAt: new Date(),
  };
  
  await db.insert(forgeSimRuns).values(runRecord);
  
  runSimulationAsync(runId, config).catch(err => {
    console.error(`[ForgeSim] Simulation ${runId} failed:`, err);
  });
  
  return runId;
}

export async function cancelSimulation(runId: string): Promise<boolean> {
  const runState = activeRuns.get(runId);
  if (runState) {
    runState.cancelled = true;
    await db.update(forgeSimRuns)
      .set({ status: 'cancelled', completedAt: new Date() })
      .where(eq(forgeSimRuns.id, runId));
    return true;
  }
  return false;
}

export async function getSimulationProgress(runId: string): Promise<SimulationProgress | null> {
  const [run] = await db.select().from(forgeSimRuns).where(eq(forgeSimRuns.id, runId)).limit(1);
  if (!run) return null;
  
  return {
    runId: run.id,
    status: run.status as SimulationProgress['status'],
    currentWeek: run.currentWeek ?? run.weekStart,
    totalWeeks: run.weekEnd - run.weekStart + 1,
    totalPlayers: run.totalPlayers ?? 0,
    processedPlayers: run.processedPlayers ?? 0,
    outlierCount: run.outlierCount ?? 0,
    error: run.error ?? undefined,
  };
}

async function runSimulationAsync(runId: string, config: SimulationRunConfig): Promise<void> {
  const { season, weekStart, weekEnd, parameters, clearPrevious } = config;
  
  console.log(`[ForgeSim] Starting simulation ${runId} for season ${season}, weeks ${weekStart}-${weekEnd}`);
  
  try {
    await db.update(forgeSimRuns)
      .set({ status: 'running' })
      .where(eq(forgeSimRuns.id, runId));
    
    if (clearPrevious) {
      await db.delete(forgePlayerStateSim)
        .where(eq(forgePlayerStateSim.simRunId, runId));
    }
    
    const skillPositions = ['QB', 'RB', 'WR', 'TE'];
    const playerStateCache = new Map<string, SimPlayerState>();
    
    let totalProcessed = 0;
    let outlierCount = 0;
    
    for (let week = weekStart; week <= weekEnd; week++) {
      const runState = activeRuns.get(runId);
      if (runState?.cancelled) {
        console.log(`[ForgeSim] Simulation ${runId} cancelled at week ${week}`);
        return;
      }
      
      console.log(`[ForgeSim] Processing week ${week}...`);
      
      await db.update(forgeSimRuns)
        .set({ currentWeek: week })
        .where(eq(forgeSimRuns.id, runId));
      
      // Filter out practice squad/inactive players by requiring minimum activity
      // Players must have at least 5 snaps OR some meaningful usage (targets/rush attempts)
      const playersThisWeek = await db
        .selectDistinct({
          playerId: weeklyStats.playerId,
          playerName: weeklyStats.playerName,
          position: weeklyStats.position,
          team: weeklyStats.team,
        })
        .from(weeklyStats)
        .where(
          and(
            eq(weeklyStats.season, season),
            eq(weeklyStats.week, week),
            inArray(weeklyStats.position, skillPositions),
            or(
              gte(weeklyStats.snaps, 5),
              gte(weeklyStats.targets, 1),
              gte(weeklyStats.rushAtt, 1)
            )
          )
        );
      
      if (week === weekStart) {
        await db.update(forgeSimRuns)
          .set({ totalPlayers: playersThisWeek.length })
          .where(eq(forgeSimRuns.id, runId));
      }
      
      for (const player of playersThisWeek) {
        if (!player.playerId || !player.position) continue;

        try {
          const result = await scorePlayerWeek(
            runId,
            player.playerId,
            player.playerName ?? 'Unknown',
            player.position as PlayerPosition,
            player.team ?? '',
            season,
            week,
            parameters,
            playerStateCache
          );

          if (result.outlierFlags.length > 0) {
            outlierCount++;
          }

          totalProcessed++;

          // Update progress every 10 players for real-time feedback
          if (totalProcessed % 10 === 0) {
            await db.update(forgeSimRuns)
              .set({
                processedPlayers: totalProcessed,
                outlierCount,
              })
              .where(eq(forgeSimRuns.id, runId));
          }
        } catch (err) {
          console.error(`[ForgeSim] Error scoring ${player.playerName}:`, err);
        }
      }

      // Final update for this week
      await db.update(forgeSimRuns)
        .set({
          processedPlayers: totalProcessed,
          outlierCount,
        })
        .where(eq(forgeSimRuns.id, runId));
    }
    
    const avgAdj = await calculateAvgAdjustmentMagnitude(runId);
    
    await db.update(forgeSimRuns)
      .set({ 
        status: 'completed',
        completedAt: new Date(),
        outlierCount,
        avgAdjustmentMagnitude: avgAdj,
      })
      .where(eq(forgeSimRuns.id, runId));
    
    console.log(`[ForgeSim] Simulation ${runId} completed. Processed ${totalProcessed} player-weeks, ${outlierCount} outliers`);
    
  } catch (err) {
    console.error(`[ForgeSim] Simulation ${runId} failed:`, err);
    await db.update(forgeSimRuns)
      .set({ 
        status: 'failed',
        error: err instanceof Error ? err.message : String(err),
        completedAt: new Date(),
      })
      .where(eq(forgeSimRuns.id, runId));
  } finally {
    activeRuns.delete(runId);
  }
}

interface SimPlayerState {
  alphaPrev: number;
  tierPrev: number;
  volatilityPrev: number | null;
  momentum: number | null;
  alphaHistory: number[];
}

interface ScoreResult {
  alphaRaw: number;
  alphaFinal: number;
  adjustment: number;
  outlierFlags: string[];
}

async function scorePlayerWeek(
  simRunId: string,
  playerId: string,
  playerName: string,
  position: PlayerPosition,
  team: string,
  season: number,
  week: number,
  params: SimulationParameters,
  stateCache: Map<string, SimPlayerState>
): Promise<ScoreResult> {
  const cacheKey = `${playerId}_${season}`;
  const priorState = stateCache.get(cacheKey);
  
  let context: ForgeContext;
  try {
    context = await fetchContext(playerId, season, week, 1);
  } catch (err) {
    throw new Error(`Failed to fetch context for ${playerName}: ${err}`);
  }
  
  let features: ForgeFeatureBundle;
  try {
    switch (position) {
      case 'WR':
        features = buildWRFeatures(context);
        break;
      case 'RB':
        features = buildRBFeatures(context);
        break;
      case 'TE':
        features = buildTEFeatures(context);
        break;
      case 'QB':
        features = buildQBFeatures(context);
        break;
      default:
        throw new Error(`Unknown position: ${position}`);
    }
  } catch (err) {
    throw new Error(`Failed to build features for ${playerName}: ${err}`);
  }
  
  const pass0Score = calculateAlphaScore(context, features);
  const alphaRaw = pass0Score.alpha;
  
  let alphaFinal = alphaRaw;
  let expectedAlpha: number | null = null;
  let surprise: number | null = null;
  let stabilityAdjustment: number | null = null;
  let volatility: number | null = null;
  let momentum: number | null = null;
  let alphaPrev: number | null = null;
  let tierPrev: number | null = null;
  let alphaHistory: number[] = [];
  
  if (priorState) {
    alphaPrev = priorState.alphaPrev;
    tierPrev = priorState.tierPrev;
    volatility = priorState.volatilityPrev;
    momentum = priorState.momentum;
    alphaHistory = priorState.alphaHistory;
    
    expectedAlpha = calculateExpectedAlpha(alphaPrev, position, params);
    surprise = alphaRaw - expectedAlpha;
    stabilityAdjustment = calculateStabilityAdjustmentSim(surprise, volatility, momentum, params);
    
    alphaFinal = clamp(alphaRaw + stabilityAdjustment, 0, 100);
  } else {
    expectedAlpha = POSITION_BASELINES[position] ?? 55;
    surprise = alphaRaw - expectedAlpha;
  }
  
  const newAlphaHistory = [alphaFinal, ...alphaHistory].slice(0, 8);
  const volatilityUpdated = calculateVolatilitySim(newAlphaHistory, params.historyWindowVolatility);
  const momentumUpdated = calculateMomentumSim(newAlphaHistory, position, params.historyWindowMomentum);
  
  const tierString = assignTier(alphaFinal, position);
  const tierFinal = tierString === 'T1' ? 1 : tierString === 'T2' ? 2 : tierString === 'T3' ? 3 : tierString === 'T4' ? 4 : 5;
  
  stateCache.set(cacheKey, {
    alphaPrev: alphaFinal,
    tierPrev: tierFinal,
    volatilityPrev: volatilityUpdated,
    momentum: momentumUpdated,
    alphaHistory: newAlphaHistory,
  });
  
  const outlierFlags = detectOutliers(
    stabilityAdjustment,
    volatilityUpdated,
    momentum,
    surprise,
    alphaFinal,
    params
  );
  
  const record: InsertForgePlayerStateSim = {
    simRunId,
    playerId,
    playerName,
    position,
    team,
    season,
    week,
    alphaPrev,
    tierPrev,
    volatilityPrev: volatility,
    momentum,
    alphaRaw,
    expectedAlpha,
    surprise,
    stabilityAdjustment,
    alphaFinal,
    tierFinal,
    confidenceScore: pass0Score.confidence,
    alphaHistory: newAlphaHistory,
    volatilityUpdated,
    momentumUpdated,
    outlierFlags: outlierFlags.length > 0 ? outlierFlags : null,
    computedAt: new Date(),
    passCount: 2,
  };
  
  await db.insert(forgePlayerStateSim).values(record);
  
  return {
    alphaRaw,
    alphaFinal,
    adjustment: stabilityAdjustment ?? 0,
    outlierFlags,
  };
}

function calculateExpectedAlpha(alphaPrev: number, position: string, params: SimulationParameters): number {
  const baseline = POSITION_BASELINES[position] ?? 55;
  return alphaPrev * params.decayRatio + baseline * params.baselineWeight;
}

function calculateStabilityAdjustmentSim(
  surprise: number,
  volatility: number | null,
  momentum: number | null,
  params: SimulationParameters
): number {
  let adjustment = 0;
  
  if (volatility !== null) {
    if (volatility > params.volatilityHighThreshold) {
      adjustment -= Math.min(surprise * 0.3, 5);
    } else if (volatility < params.volatilityLowThreshold) {
      adjustment += Math.min(Math.abs(surprise) * 0.2, 3);
    }
  }
  
  if (momentum !== null) {
    if (momentum > 5 && surprise > 0) {
      adjustment += Math.min(momentum * params.momentumMultiplier, 3);
    } else if (momentum < -5 && surprise < 0) {
      adjustment -= Math.min(Math.abs(momentum) * params.momentumMultiplier, 3);
    }
  }
  
  return clamp(adjustment, -params.adjustmentCap, params.adjustmentCap);
}

function calculateVolatilitySim(alphaHistory: number[], windowSize: number): number | null {
  if (alphaHistory.length < 2) return null;
  
  const window = alphaHistory.slice(0, windowSize);
  const mean = window.reduce((sum, a) => sum + a, 0) / window.length;
  const variance = window.reduce((sum, a) => sum + Math.pow(a - mean, 2), 0) / window.length;
  
  return Math.sqrt(variance);
}

function calculateMomentumSim(alphaHistory: number[], position: string, windowSize: number): number | null {
  if (alphaHistory.length < windowSize) return null;
  
  const recentAvg = alphaHistory.slice(0, windowSize).reduce((s, a) => s + a, 0) / windowSize;
  const seasonAvg = alphaHistory.reduce((s, a) => s + a, 0) / alphaHistory.length;
  const baseline = POSITION_BASELINES[position] ?? 55;
  
  return recentAvg - ((seasonAvg + baseline) / 2);
}

function detectOutliers(
  adjustment: number | null,
  volatility: number | null,
  momentum: number | null,
  surprise: number | null,
  alphaFinal: number,
  params: SimulationParameters
): string[] {
  const flags: string[] = [];
  
  if (adjustment !== null && Math.abs(adjustment) > params.outlierLargeAdjustment) {
    flags.push('LARGE_ADJUSTMENT');
  }
  
  if (momentum !== null && adjustment !== null) {
    if ((momentum > 0 && adjustment < -2) || (momentum < 0 && adjustment > 2)) {
      flags.push('UNEXPECTED_DIRECTION');
    }
  }
  
  if (alphaFinal === 0 || alphaFinal === 100) {
    flags.push('SCORE_AT_BOUNDS');
  }
  
  if (volatility !== null && volatility > params.outlierVolatilitySpike) {
    flags.push('VOLATILITY_SPIKE');
  }
  
  return flags;
}

async function calculateAvgAdjustmentMagnitude(runId: string): Promise<number> {
  const result = await db
    .select({
      avgAbs: sql<number>`AVG(ABS(${forgePlayerStateSim.stabilityAdjustment}))`,
    })
    .from(forgePlayerStateSim)
    .where(
      and(
        eq(forgePlayerStateSim.simRunId, runId),
        sql`${forgePlayerStateSim.stabilityAdjustment} IS NOT NULL`
      )
    );
  
  return result[0]?.avgAbs ?? 0;
}

export async function getSimulationResults(
  runId: string,
  filters?: {
    position?: string;
    weekStart?: number;
    weekEnd?: number;
    minAdjustment?: number;
    playerSearch?: string;
    outlierOnly?: boolean;
  },
  limit = 500,
  offset = 0
): Promise<{ results: any[]; total: number }> {
  let query = db
    .select()
    .from(forgePlayerStateSim)
    .where(eq(forgePlayerStateSim.simRunId, runId));
  
  const conditions = [eq(forgePlayerStateSim.simRunId, runId)];
  
  if (filters?.position) {
    conditions.push(eq(forgePlayerStateSim.position, filters.position));
  }
  if (filters?.weekStart) {
    conditions.push(sql`${forgePlayerStateSim.week} >= ${filters.weekStart}`);
  }
  if (filters?.weekEnd) {
    conditions.push(sql`${forgePlayerStateSim.week} <= ${filters.weekEnd}`);
  }
  if (filters?.minAdjustment) {
    conditions.push(sql`ABS(${forgePlayerStateSim.stabilityAdjustment}) >= ${filters.minAdjustment}`);
  }
  if (filters?.playerSearch) {
    conditions.push(sql`${forgePlayerStateSim.playerName} ILIKE ${'%' + filters.playerSearch + '%'}`);
  }
  if (filters?.outlierOnly) {
    conditions.push(sql`${forgePlayerStateSim.outlierFlags} IS NOT NULL AND array_length(${forgePlayerStateSim.outlierFlags}, 1) > 0`);
  }
  
  const [countResult] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(forgePlayerStateSim)
    .where(and(...conditions));
  
  const results = await db
    .select()
    .from(forgePlayerStateSim)
    .where(and(...conditions))
    .orderBy(forgePlayerStateSim.week, forgePlayerStateSim.playerName)
    .limit(limit)
    .offset(offset);
  
  return {
    results,
    total: Number(countResult?.count ?? 0),
  };
}

export async function getPlayerDiffView(
  runId: string,
  playerId: string
): Promise<any[]> {
  const results = await db
    .select()
    .from(forgePlayerStateSim)
    .where(
      and(
        eq(forgePlayerStateSim.simRunId, runId),
        eq(forgePlayerStateSim.playerId, playerId)
      )
    )
    .orderBy(forgePlayerStateSim.week);
  
  return results;
}

export async function getOutliers(runId: string): Promise<any[]> {
  const results = await db
    .select()
    .from(forgePlayerStateSim)
    .where(
      and(
        eq(forgePlayerStateSim.simRunId, runId),
        sql`${forgePlayerStateSim.outlierFlags} IS NOT NULL AND array_length(${forgePlayerStateSim.outlierFlags}, 1) > 0`
      )
    )
    .orderBy(desc(sql`array_length(${forgePlayerStateSim.outlierFlags}, 1)`), forgePlayerStateSim.week);
  
  return results;
}

export async function markOutlierReviewed(
  simRunId: string,
  playerId: string,
  week: number,
  reviewedBy: string,
  notes?: string
): Promise<void> {
  await db.update(forgePlayerStateSim)
    .set({
      reviewedAt: new Date(),
      reviewedBy,
      reviewNotes: notes,
    })
    .where(
      and(
        eq(forgePlayerStateSim.simRunId, simRunId),
        eq(forgePlayerStateSim.playerId, playerId),
        eq(forgePlayerStateSim.week, week)
      )
    );
}

export async function getAllPresets(): Promise<ForgeSimPreset[]> {
  return db.select().from(forgeSimPresets).orderBy(forgeSimPresets.name);
}

export async function getPreset(id: number): Promise<ForgeSimPreset | null> {
  const [preset] = await db.select().from(forgeSimPresets).where(eq(forgeSimPresets.id, id)).limit(1);
  return preset ?? null;
}

export async function createPreset(name: string, description: string | null, params: SimulationParameters): Promise<number> {
  const [result] = await db.insert(forgeSimPresets).values({
    name,
    description,
    ...params,
  }).returning({ id: forgeSimPresets.id });
  
  return result.id;
}

export async function updatePreset(id: number, name: string, description: string | null, params: SimulationParameters): Promise<void> {
  await db.update(forgeSimPresets)
    .set({
      name,
      description,
      ...params,
      updatedAt: new Date(),
    })
    .where(eq(forgeSimPresets.id, id));
}

export async function deletePreset(id: number): Promise<void> {
  await db.delete(forgeSimPresets).where(eq(forgeSimPresets.id, id));
}

export async function getAllRuns(limit = 20): Promise<any[]> {
  return db.select().from(forgeSimRuns).orderBy(desc(forgeSimRuns.startedAt)).limit(limit);
}

export async function deleteRun(runId: string): Promise<void> {
  await db.delete(forgePlayerStateSim).where(eq(forgePlayerStateSim.simRunId, runId));
  await db.delete(forgeSimRuns).where(eq(forgeSimRuns.id, runId));
}
