/**
 * Datadive Context v1.0
 * 
 * Provides FORGE with access to the Datadive snapshot tables.
 * This is the bridge between the validated Datadive spine and FORGE scoring.
 * 
 * Features:
 * - getCurrentSnapshot(): Get current official snapshot metadata
 * - mapSnapshotRowToForgeInput(): Convert Datadive rows to FORGE-compatible input
 * - getSnapshotPlayerData(): Fetch player data from snapshot for FORGE
 */

import { db } from '../infra/db';
import { 
  datadiveSnapshotMeta, 
  datadiveSnapshotPlayerWeek, 
  datadiveSnapshotPlayerSeason,
  playerIdentityMap
} from '@shared/schema';
import { eq, and, desc, sql } from 'drizzle-orm';

// ========================================
// Feature Flag Configuration
// ========================================

export const USE_DATADIVE_FORGE = process.env.USE_DATADIVE_FORGE !== 'false';

// ========================================
// Types
// ========================================

export interface DatadiveSnapshot {
  snapshotId: number;
  season: number;
  week: number;
  snapshotAt: Date;
  rowCount: number;
  teamCount: number;
  isOfficial: boolean;
}

export interface DatadivePlayerRow {
  id: number;
  snapshotId: number;
  season: number;
  week: number;
  playerId: string;
  playerName: string;
  teamId: string;
  position: string;
  snaps: number | null;
  snapShare: number | null;
  routes: number | null;
  routeRate: number | null;
  targets: number | null;
  targetShare: number | null;
  receptions: number | null;
  recYards: number | null;
  recTds: number | null;
  aDot: number | null;
  airYards: number | null;
  yac: number | null;
  tprr: number | null;
  yprr: number | null;
  epaPerPlay: number | null;
  epaPerTarget: number | null;
  successRate: number | null;
  rushAttempts: number | null;
  rushYards: number | null;
  rushTds: number | null;
  yardsPerCarry: number | null;
  rushEpaPerPlay: number | null;
  fptsStd: number | null;
  fptsHalf: number | null;
  fptsPpr: number | null;
}

export interface ForgeDatadiveInput {
  gamesPlayed: number;
  snaps: number;
  snapShare: number;
  
  routes: number;
  routeRate: number;
  targets: number;
  targetShare: number;
  receptions: number;
  receivingYards: number;
  receivingTds: number;
  
  tprr: number;
  yprr: number;
  aDot: number;
  airYards: number;
  yac: number;
  
  epaPerPlay: number;
  epaPerTarget: number;
  successRate: number;
  
  rushAttempts: number;
  rushYards: number;
  rushTds: number;
  yardsPerCarry: number;
  rushEpaPerPlay: number;
  
  fantasyPointsStd: number;
  fantasyPointsHalf: number;
  fantasyPointsPpr: number;
}

// ========================================
// Core Functions
// ========================================

/**
 * Get the current official snapshot metadata.
 * Returns null if no official snapshot exists.
 */
export async function getCurrentSnapshot(): Promise<DatadiveSnapshot | null> {
  try {
    const result = await db
      .select({
        snapshotId: datadiveSnapshotMeta.id,
        season: datadiveSnapshotMeta.season,
        week: datadiveSnapshotMeta.week,
        snapshotAt: datadiveSnapshotMeta.snapshotAt,
        rowCount: datadiveSnapshotMeta.rowCount,
        teamCount: datadiveSnapshotMeta.teamCount,
        isOfficial: datadiveSnapshotMeta.isOfficial,
      })
      .from(datadiveSnapshotMeta)
      .where(eq(datadiveSnapshotMeta.isOfficial, true))
      .orderBy(desc(datadiveSnapshotMeta.snapshotAt))
      .limit(1);
    
    if (!result[0]) {
      console.log('[DatadiveContext] No official snapshot found');
      return null;
    }
    
    return {
      snapshotId: result[0].snapshotId,
      season: result[0].season,
      week: result[0].week,
      snapshotAt: result[0].snapshotAt!,
      rowCount: result[0].rowCount ?? 0,
      teamCount: result[0].teamCount ?? 0,
      isOfficial: result[0].isOfficial ?? false,
    };
  } catch (error) {
    console.error('[DatadiveContext] Error fetching current snapshot:', error);
    return null;
  }
}

/**
 * Map a Datadive snapshot weekly row to FORGE-compatible input.
 * 
 * NOTE: gamesPlayed is set to 1 because this function maps single-week data.
 * Season aggregators (like getSnapshotSeasonStats) override this with actual totals.
 */
export function mapSnapshotRowToForgeInput(row: DatadivePlayerRow): ForgeDatadiveInput {
  return {
    gamesPlayed: 1, // Single week = 1 game; season aggregators override with actual totals
    snaps: row.snaps ?? 0,
    snapShare: row.snapShare ?? 0,
    
    routes: row.routes ?? 0,
    routeRate: row.routeRate ?? 0,
    targets: row.targets ?? 0,
    targetShare: row.targetShare ?? 0,
    receptions: row.receptions ?? 0,
    receivingYards: row.recYards ?? 0,
    receivingTds: row.recTds ?? 0,
    
    tprr: row.tprr ?? 0,
    yprr: row.yprr ?? 0,
    aDot: row.aDot ?? 0,
    airYards: row.airYards ?? 0,
    yac: row.yac ?? 0,
    
    epaPerPlay: row.epaPerPlay ?? 0,
    epaPerTarget: row.epaPerTarget ?? 0,
    successRate: row.successRate ?? 0,
    
    rushAttempts: row.rushAttempts ?? 0,
    rushYards: row.rushYards ?? 0,
    rushTds: row.rushTds ?? 0,
    yardsPerCarry: row.yardsPerCarry ?? 0,
    rushEpaPerPlay: row.rushEpaPerPlay ?? 0,
    
    fantasyPointsStd: row.fptsStd ?? 0,
    fantasyPointsHalf: row.fptsHalf ?? 0,
    fantasyPointsPpr: row.fptsPpr ?? 0,
  };
}

/**
 * Get player data from the current snapshot for a specific player.
 * Returns aggregated season stats from datadive_snapshot_player_season,
 * with weighted EPA metrics computed from weekly rows.
 */
export async function getSnapshotSeasonStats(
  nflDataPyId: string,
  season: number
): Promise<ForgeDatadiveInput | null> {
  try {
    const snapshot = await getCurrentSnapshot();
    if (!snapshot || snapshot.season !== season) {
      console.log(`[DatadiveContext] No matching snapshot for season ${season}`);
      return null;
    }
    
    const result = await db
      .select()
      .from(datadiveSnapshotPlayerSeason)
      .where(
        and(
          eq(datadiveSnapshotPlayerSeason.snapshotId, snapshot.snapshotId),
          eq(datadiveSnapshotPlayerSeason.playerId, nflDataPyId),
          eq(datadiveSnapshotPlayerSeason.season, season)
        )
      )
      .limit(1);
    
    if (!result[0]) {
      console.log(`[DatadiveContext] No season data for player ${nflDataPyId}`);
      return null;
    }
    
    const row = result[0];
    
    // Calculate weighted EPA metrics from weekly rows
    const { epaPerTarget, rushEpaPerPlay } = await calculateWeightedEpaMetrics(
      snapshot.snapshotId,
      nflDataPyId,
      season
    );
    
    return {
      gamesPlayed: row.gamesPlayed ?? 0,
      snaps: row.totalSnaps ?? 0,
      snapShare: row.avgSnapShare ?? 0,
      
      routes: row.totalRoutes ?? 0,
      routeRate: row.avgRouteRate ?? 0,
      targets: row.totalTargets ?? 0,
      targetShare: row.avgTargetShare ?? 0,
      receptions: row.totalReceptions ?? 0,
      receivingYards: row.totalRecYards ?? 0,
      receivingTds: row.totalRecTds ?? 0,
      
      tprr: row.avgTprr ?? 0,
      yprr: row.avgYprr ?? 0,
      aDot: row.avgAdot ?? 0,
      airYards: row.totalAirYards ?? 0,
      yac: row.totalYac ?? 0,
      
      epaPerPlay: row.avgEpaPerPlay ?? 0,
      epaPerTarget,  // Weighted average from weekly data
      successRate: row.avgSuccessRate ?? 0,
      
      rushAttempts: row.totalRushAttempts ?? 0,
      rushYards: row.totalRushYards ?? 0,
      rushTds: row.totalRushTds ?? 0,
      yardsPerCarry: row.avgYpc ?? 0,
      rushEpaPerPlay,  // Weighted average from weekly data
      
      fantasyPointsStd: row.totalFptsStd ?? 0,
      fantasyPointsHalf: row.totalFptsHalf ?? 0,
      fantasyPointsPpr: row.totalFptsPpr ?? 0,
    };
  } catch (error) {
    console.error('[DatadiveContext] Error fetching season stats:', error);
    return null;
  }
}

/**
 * Calculate weighted EPA metrics from weekly snapshot data.
 * 
 * - epaPerTarget = (Σ week.epaPerTarget * week.targets) / max(Σ week.targets, 1)
 * - rushEpaPerPlay = (Σ week.rushEpaPerPlay * week.rushAttempts) / max(Σ week.rushAttempts, 1)
 * 
 * Returns 0 when no volume exists so downstream logic can detect missing metrics.
 */
async function calculateWeightedEpaMetrics(
  snapshotId: number,
  playerId: string,
  season: number
): Promise<{ epaPerTarget: number; rushEpaPerPlay: number }> {
  try {
    const weeklyRows = await db
      .select({
        targets: datadiveSnapshotPlayerWeek.targets,
        epaPerTarget: datadiveSnapshotPlayerWeek.epaPerTarget,
        rushAttempts: datadiveSnapshotPlayerWeek.rushAttempts,
        rushEpaPerPlay: datadiveSnapshotPlayerWeek.rushEpaPerPlay,
      })
      .from(datadiveSnapshotPlayerWeek)
      .where(
        and(
          eq(datadiveSnapshotPlayerWeek.snapshotId, snapshotId),
          eq(datadiveSnapshotPlayerWeek.playerId, playerId),
          eq(datadiveSnapshotPlayerWeek.season, season)
        )
      );
    
    if (weeklyRows.length === 0) {
      return { epaPerTarget: 0, rushEpaPerPlay: 0 };
    }
    
    // Weighted average for epaPerTarget
    let totalTargets = 0;
    let weightedEpaTarget = 0;
    for (const week of weeklyRows) {
      const targets = week.targets ?? 0;
      const epaTarget = week.epaPerTarget ?? 0;
      if (targets > 0 && epaTarget !== null) {
        totalTargets += targets;
        weightedEpaTarget += epaTarget * targets;
      }
    }
    const epaPerTarget = totalTargets > 0 ? weightedEpaTarget / totalTargets : 0;
    
    // Weighted average for rushEpaPerPlay
    let totalRushAttempts = 0;
    let weightedRushEpa = 0;
    for (const week of weeklyRows) {
      const rushAttempts = week.rushAttempts ?? 0;
      const rushEpa = week.rushEpaPerPlay ?? 0;
      if (rushAttempts > 0 && rushEpa !== null) {
        totalRushAttempts += rushAttempts;
        weightedRushEpa += rushEpa * rushAttempts;
      }
    }
    const rushEpaPerPlay = totalRushAttempts > 0 ? weightedRushEpa / totalRushAttempts : 0;
    
    return { epaPerTarget, rushEpaPerPlay };
  } catch (error) {
    console.error('[DatadiveContext] Error calculating weighted EPA metrics:', error);
    return { epaPerTarget: 0, rushEpaPerPlay: 0 };
  }
}

/**
 * Get weekly stats for a player from the current snapshot.
 * Used for trajectory/stability analysis.
 */
export async function getSnapshotWeeklyStats(
  nflDataPyId: string,
  season: number,
  asOfWeek?: number
): Promise<DatadivePlayerRow[]> {
  try {
    const snapshot = await getCurrentSnapshot();
    if (!snapshot || snapshot.season !== season) {
      return [];
    }
    
    let weekCondition = eq(datadiveSnapshotPlayerWeek.snapshotId, snapshot.snapshotId);
    
    const result = await db
      .select()
      .from(datadiveSnapshotPlayerWeek)
      .where(
        and(
          eq(datadiveSnapshotPlayerWeek.snapshotId, snapshot.snapshotId),
          eq(datadiveSnapshotPlayerWeek.playerId, nflDataPyId),
          eq(datadiveSnapshotPlayerWeek.season, season)
        )
      )
      .orderBy(desc(datadiveSnapshotPlayerWeek.week));
    
    return result as DatadivePlayerRow[];
  } catch (error) {
    console.error('[DatadiveContext] Error fetching weekly stats:', error);
    return [];
  }
}

/**
 * Get list of eligible players for FORGE batch scoring from Datadive snapshot.
 * Replaces the weeklyStats-based eligibility check.
 * 
 * Uses canonical ID for deterministic deduplication (not player names).
 * Filters by both identity map position AND snapshot position for accuracy.
 */
export async function getDatadiveEligiblePlayers(
  position?: string,
  limit: number = 100
): Promise<Array<{ canonicalId: string; fullName: string; team: string; totalFpts: number }>> {
  try {
    const snapshot = await getCurrentSnapshot();
    if (!snapshot) {
      console.log('[DatadiveContext] No snapshot available for eligibility check');
      return [];
    }
    
    const skillPositions = position ? [position] : ['QB', 'RB', 'WR', 'TE'];
    const perPositionLimit = position ? limit : Math.ceil(limit / 4);
    const allPlayers: Array<{ canonicalId: string; fullName: string; team: string; totalFpts: number }> = [];
    const seenCanonicalIds = new Set<string>();
    
    for (const pos of skillPositions) {
      const posUpper = pos.toUpperCase();
      const result = await db.execute(sql`
        SELECT DISTINCT ON (pim.canonical_id)
          pim.canonical_id,
          pim.full_name,
          pim.nfl_team as team,
          COALESCE(dss.total_fpts_ppr, 0) as total_fpts
        FROM datadive_snapshot_player_season dss
        JOIN player_identity_map pim ON pim.nfl_data_py_id = dss.player_id
        WHERE dss.snapshot_id = ${snapshot.snapshotId}
          AND dss.season = ${snapshot.season}
          AND UPPER(pim.position) = ${posUpper}
          AND (dss.position IS NULL OR UPPER(dss.position) = ${posUpper})
          AND pim.nfl_team IS NOT NULL
          AND pim.nfl_team != 'FA'
          AND pim.is_active = true
          AND dss.games_played >= 1
        ORDER BY pim.canonical_id, dss.total_fpts_ppr DESC
        LIMIT ${perPositionLimit * 2}
      `);
      
      for (const row of result.rows as any[]) {
        const canonicalId = row.canonical_id;
        if (seenCanonicalIds.has(canonicalId)) {
          continue;
        }
        seenCanonicalIds.add(canonicalId);
        
        allPlayers.push({
          canonicalId,
          fullName: row.full_name,
          team: row.team,
          totalFpts: parseFloat(row.total_fpts) || 0,
        });
        
        if (allPlayers.length >= perPositionLimit) break;
      }
    }
    
    return allPlayers.sort((a, b) => b.totalFpts - a.totalFpts).slice(0, limit);
  } catch (error) {
    console.error('[DatadiveContext] Error fetching eligible players:', error);
    return [];
  }
}

/**
 * Convert Datadive season stats to FORGE seasonStats format
 * This matches the ForgeContext['seasonStats'] structure
 */
export function toForgeSeasonStats(input: ForgeDatadiveInput): {
  gamesPlayed: number;
  gamesStarted: number;
  snapCount: number;
  snapShare: number;
  fantasyPointsPpr: number;
  fantasyPointsHalfPpr: number;
  targets?: number;
  receptions?: number;
  receivingYards?: number;
  receivingTds?: number;
  rushAttempts?: number;
  rushYards?: number;
  rushTds?: number;
  targetShare?: number;
  airYards?: number;
} {
  return {
    gamesPlayed: input.gamesPlayed,
    gamesStarted: input.gamesPlayed,
    snapCount: input.snaps,
    snapShare: input.snapShare,
    fantasyPointsPpr: input.fantasyPointsPpr,
    fantasyPointsHalfPpr: input.fantasyPointsHalf,
    targets: input.targets,
    receptions: input.receptions,
    receivingYards: input.receivingYards,
    receivingTds: input.receivingTds,
    rushAttempts: input.rushAttempts,
    rushYards: input.rushYards,
    rushTds: input.rushTds,
    targetShare: input.targetShare,
    airYards: input.airYards,
  };
}

/**
 * Convert Datadive stats to FORGE advancedMetrics format
 * This matches the ForgeContext['advancedMetrics'] structure
 */
export function toForgeAdvancedMetrics(input: ForgeDatadiveInput): {
  yprr?: number;
  adot?: number;
  epaPerPlay?: number;
  yardsPerCarry?: number;
  successRate?: number;
} | undefined {
  if (input.targets === 0 && input.rushAttempts === 0) {
    return undefined;
  }
  
  return {
    yprr: input.yprr > 0 ? input.yprr : undefined,
    adot: input.aDot > 0 ? input.aDot : undefined,
    epaPerPlay: input.epaPerPlay !== 0 ? input.epaPerPlay : undefined,
    yardsPerCarry: input.yardsPerCarry > 0 ? input.yardsPerCarry : undefined,
    successRate: input.successRate > 0 ? input.successRate : undefined,
  };
}

export default {
  USE_DATADIVE_FORGE,
  getCurrentSnapshot,
  mapSnapshotRowToForgeInput,
  getSnapshotSeasonStats,
  getSnapshotWeeklyStats,
  getDatadiveEligiblePlayers,
  toForgeSeasonStats,
  toForgeAdvancedMetrics,
};
