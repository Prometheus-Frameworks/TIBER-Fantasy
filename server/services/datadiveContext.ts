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
import { enrichByPosition, type EnrichedPlayer } from '../enrichment';

// ========================================
// Feature Flag Configuration
// ========================================

// v1.2: Disabled by default until Datadive snapshot has full player coverage
// Set USE_DATADIVE_FORGE=true in .env to enable Datadive-based eligibility
export const USE_DATADIVE_FORGE = process.env.USE_DATADIVE_FORGE === 'true';

// ========================================
// Types
// ========================================

export type SnapshotContext = {
  snapshotId: number;
  season: number;
  week: number;
};

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
 * 
 * ELIGIBILITY RULES (v0.3):
 * - Must be on active NFL team (not FA)
 * - Must have at least 1 game played
 * - Must NOT be on IR or other ineligible status (via player_live_status table)
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
          COALESCE(pls.current_team, pim.nfl_team) as team,
          COALESCE(dss.total_fpts_ppr, 0) as total_fpts
        FROM datadive_snapshot_player_season dss
        JOIN player_identity_map pim ON pim.nfl_data_py_id = dss.player_id
        LEFT JOIN player_live_status pls ON pls.canonical_id = pim.canonical_id
        WHERE dss.snapshot_id = ${snapshot.snapshotId}
          AND dss.season = ${snapshot.season}
          AND UPPER(pim.position) = ${posUpper}
          AND (dss.position IS NULL OR UPPER(dss.position) = ${posUpper})
          AND pim.nfl_team IS NOT NULL
          AND pim.nfl_team != 'FA'
          AND pim.is_active = true
          AND dss.games_played >= 1
          AND (pls.is_eligible_for_forge IS NULL OR pls.is_eligible_for_forge = true)
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

/**
 * Enriched Player Weekly Data v1.0
 * 
 * NEW DATA PATH: Reads from datadive_snapshot_player_week and applies
 * position-specific enrichment. This replaces the old season aggregation path
 * and ensures all 2025 pro-grade metrics (CPOE, WOPR, RACR, RYOE, etc.) flow
 * through FORGE as the single source of truth.
 * 
 * Data flow:
 *   nflfastR → ingest-week.ts → enrichment boxes → datadive_snapshot_player_week
 *                                                          ↓
 *                                                        FORGE
 *                                                          ↓
 *                                            Tiber / Leaderboards / Projections
 */
export interface EnrichedPlayerData {
  // Core identity
  canonicalId: string;
  nflDataPyId: string;
  playerName: string;
  position: string;
  team: string | null;
  
  // Aggregated season stats
  gamesPlayed: number;
  snaps: number;
  snapShare: number;
  
  // Receiving (all positions)
  targets: number;
  targetShare: number;
  receptions: number;
  receivingYards: number;
  receivingTds: number;
  routes: number;
  routeRate: number;
  
  // Advanced receiving
  tprr: number;
  yprr: number;
  aDot: number;
  airYards: number;
  yac: number;
  
  // Rushing
  rushAttempts: number;
  rushYards: number;
  rushTds: number;
  yardsPerCarry: number;
  
  // EPA metrics
  epaPerPlay: number;
  epaPerTarget: number;
  rushEpaPerPlay: number;
  successRate: number;
  
  // Fantasy points
  fantasyPointsStd: number;
  fantasyPointsHalf: number;
  fantasyPointsPpr: number;
  
  // Position-specific enrichment (added based on position)
  enrichedMetrics: Record<string, any>;
  enrichmentList: string[];
}

/**
 * Get the nfl_data_py_id for a canonical player ID
 */
async function getNflDataPyIdFromCanonical(canonicalId: string): Promise<string | null> {
  const result = await db
    .select({ nflDataPyId: playerIdentityMap.nflDataPyId })
    .from(playerIdentityMap)
    .where(eq(playerIdentityMap.canonicalId, canonicalId))
    .limit(1);
  
  return result[0]?.nflDataPyId ?? null;
}

/**
 * Get enriched player data from the weekly snapshot tables.
 * 
 * This is the NEW single source of truth for FORGE data.
 * It reads from datadive_snapshot_player_week ACROSS ALL OFFICIAL SNAPSHOTS
 * and applies position-specific enrichment.
 * 
 * CRITICAL FIX v1.1: Now queries all official snapshots for weeks 1 through asOfWeek
 * to properly aggregate season-to-date statistics instead of using a single snapshot.
 * 
 * v1.2: Added startWeek support for week range filtering.
 * 
 * @param canonicalId - The canonical player ID (e.g., "rashee-rice")
 * @param season - The NFL season (default: 2025)
 * @param asOfWeek - Optional: only include data up to this week (default: all available)
 * @param startWeek - Optional: only include data starting from this week (default: 1)
 */
export async function getEnrichedPlayerWeek(
  canonicalId: string,
  season: number = 2025,
  asOfWeek?: number,
  startWeek?: number
): Promise<EnrichedPlayerData | null> {
  try {
    // Get the nfl_data_py_id for this canonical ID
    const nflDataPyId = await getNflDataPyIdFromCanonical(canonicalId);
    if (!nflDataPyId) {
      console.log(`[DatadiveContext] No nfl_data_py_id for canonical ${canonicalId}`);
      return null;
    }
    
    // Get all official snapshot IDs for the season within week range
    // v1.2: Added startWeek support for week range filtering
    const weekFilterMax = asOfWeek !== undefined ? asOfWeek : 99; // 99 = all weeks
    const weekFilterMin = startWeek !== undefined ? startWeek : 1; // default to week 1
    
    const officialSnapshots = await db
      .select({ id: datadiveSnapshotMeta.id, week: datadiveSnapshotMeta.week })
      .from(datadiveSnapshotMeta)
      .where(
        and(
          eq(datadiveSnapshotMeta.season, season),
          eq(datadiveSnapshotMeta.isOfficial, true),
          sql`${datadiveSnapshotMeta.week} >= ${weekFilterMin}`,
          sql`${datadiveSnapshotMeta.week} <= ${weekFilterMax}`
        )
      );
    
    if (officialSnapshots.length === 0) {
      console.log(`[DatadiveContext] No official snapshots found for season ${season}`);
      return null;
    }
    
    const snapshotIds = officialSnapshots.map(s => s.id);
    console.log(`[DatadiveContext] Fetching from ${snapshotIds.length} official snapshots for ${canonicalId} (weeks ${weekFilterMin}-${weekFilterMax})`);
    
    // Fetch weekly rows across ALL official snapshots for this player
    // Use DISTINCT ON to handle duplicate week entries from re-snapshots
    const weeklyRows = await db.execute<{
      snapshot_id: number;
      season: number;
      week: number;
      player_id: string;
      player_name: string;
      team_id: string | null;
      position: string | null;
      snaps: number | null;
      snap_share: number | null;
      routes: number | null;
      route_rate: number | null;
      targets: number | null;
      target_share: number | null;
      receptions: number | null;
      rec_yards: number | null;
      rec_tds: number | null;
      adot: number | null;
      air_yards: number | null;
      yac: number | null;
      tprr: number | null;
      yprr: number | null;
      epa_per_play: number | null;
      epa_per_target: number | null;
      success_rate: number | null;
      rush_attempts: number | null;
      rush_yards: number | null;
      rush_tds: number | null;
      yards_per_carry: number | null;
      rush_epa_per_play: number | null;
      fpts_std: number | null;
      fpts_half: number | null;
      fpts_ppr: number | null;
    }>(sql`
      SELECT DISTINCT ON (week) 
        snapshot_id,
        season,
        week,
        player_id,
        player_name,
        team_id,
        position,
        snaps,
        snap_share,
        routes,
        route_rate,
        targets,
        target_share,
        receptions,
        rec_yards,
        rec_tds,
        adot,
        air_yards,
        yac,
        tprr,
        yprr,
        epa_per_play,
        epa_per_target,
        success_rate,
        rush_attempts,
        rush_yards,
        rush_tds,
        yards_per_carry,
        rush_epa_per_play,
        fpts_std,
        fpts_half,
        fpts_ppr
      FROM datadive_snapshot_player_week
      WHERE player_id = ${nflDataPyId}
        AND season = ${season}
        AND week >= ${weekFilterMin}
        AND week <= ${weekFilterMax}
        AND snapshot_id IN (${sql.raw(snapshotIds.join(','))})
      ORDER BY week ASC, snapshot_id DESC
    `);
    
    if (weeklyRows.rows.length === 0) {
      console.log(`[DatadiveContext] No weekly data for player ${canonicalId} (${nflDataPyId})`);
      return null;
    }
    
    console.log(`[DatadiveContext] Found ${weeklyRows.rows.length} weeks of data for ${canonicalId}`);
    
    // Convert raw SQL result to expected format
    const rows = weeklyRows.rows;
    
    // Get player identity info
    const identity = await db
      .select({
        fullName: playerIdentityMap.fullName,
        position: playerIdentityMap.position,
        team: playerIdentityMap.nflTeam,
      })
      .from(playerIdentityMap)
      .where(eq(playerIdentityMap.canonicalId, canonicalId))
      .limit(1);
    
    const playerName = identity[0]?.fullName ?? rows[0].player_name;
    const position = identity[0]?.position ?? rows[0].position ?? 'WR';
    const team = identity[0]?.team ?? rows[0].team_id;
    
    // Aggregate weekly rows into season totals
    // Note: rows already filtered by asOfWeek via SQL query
    let totalSnaps = 0, totalRoutes = 0, totalTargets = 0, totalReceptions = 0;
    let totalRecYards = 0, totalRecTds = 0, totalAirYards = 0, totalYac = 0;
    let totalRushAttempts = 0, totalRushYards = 0, totalRushTds = 0;
    let totalFptsStd = 0, totalFptsHalf = 0, totalFptsPpr = 0;
    
    // For weighted averages
    let weightedSnapShare = 0, weightedRouteRate = 0, weightedTargetShare = 0;
    let weightedTprr = 0, weightedYprr = 0, weightedAdot = 0;
    let weightedEpaPerPlay = 0, weightedEpaPerTarget = 0, weightedRushEpa = 0;
    let weightedSuccessRate = 0;
    let gamesWithSnaps = 0, gamesWithTargets = 0, gamesWithRushes = 0;
    
    for (const row of rows) {
      // Sum totals (using snake_case from raw SQL)
      totalSnaps += Number(row.snaps) || 0;
      totalRoutes += Number(row.routes) || 0;
      totalTargets += Number(row.targets) || 0;
      totalReceptions += Number(row.receptions) || 0;
      totalRecYards += Number(row.rec_yards) || 0;
      totalRecTds += Number(row.rec_tds) || 0;
      totalAirYards += Number(row.air_yards) || 0;
      totalYac += Number(row.yac) || 0;
      totalRushAttempts += Number(row.rush_attempts) || 0;
      totalRushYards += Number(row.rush_yards) || 0;
      totalRushTds += Number(row.rush_tds) || 0;
      totalFptsStd += Number(row.fpts_std) || 0;
      totalFptsHalf += Number(row.fpts_half) || 0;
      totalFptsPpr += Number(row.fpts_ppr) || 0;
      
      // Weighted averages (weight by volume)
      const snaps = Number(row.snaps) || 0;
      const targets = Number(row.targets) || 0;
      const rushes = Number(row.rush_attempts) || 0;
      
      if (snaps > 0) {
        gamesWithSnaps++;
        weightedSnapShare += (Number(row.snap_share) || 0) * snaps;
        weightedRouteRate += (Number(row.route_rate) || 0) * snaps;
        weightedEpaPerPlay += (Number(row.epa_per_play) || 0) * snaps;
        weightedSuccessRate += (Number(row.success_rate) || 0) * snaps;
      }
      
      if (targets > 0) {
        gamesWithTargets++;
        weightedTargetShare += (Number(row.target_share) || 0) * targets;
        weightedTprr += (Number(row.tprr) || 0) * targets;
        weightedYprr += (Number(row.yprr) || 0) * targets;
        weightedAdot += (Number(row.adot) || 0) * targets;
        weightedEpaPerTarget += (Number(row.epa_per_target) || 0) * targets;
      }
      
      if (rushes > 0) {
        gamesWithRushes++;
        weightedRushEpa += (Number(row.rush_epa_per_play) || 0) * rushes;
      }
    }
    
    // Calculate weighted averages
    const avgSnapShare = totalSnaps > 0 ? weightedSnapShare / totalSnaps : 0;
    const avgRouteRate = totalSnaps > 0 ? weightedRouteRate / totalSnaps : 0;
    const avgTargetShare = totalTargets > 0 ? weightedTargetShare / totalTargets : 0;
    const avgTprr = totalTargets > 0 ? weightedTprr / totalTargets : 0;
    const avgYprr = totalRoutes > 0 ? totalRecYards / totalRoutes : 0; // Direct calculation
    const avgAdot = totalTargets > 0 ? weightedAdot / totalTargets : 0;
    const avgEpaPerPlay = totalSnaps > 0 ? weightedEpaPerPlay / totalSnaps : 0;
    const avgEpaPerTarget = totalTargets > 0 ? weightedEpaPerTarget / totalTargets : 0;
    const avgRushEpa = totalRushAttempts > 0 ? weightedRushEpa / totalRushAttempts : 0;
    const avgSuccessRate = totalSnaps > 0 ? weightedSuccessRate / totalSnaps : 0;
    const avgYpc = totalRushAttempts > 0 ? totalRushYards / totalRushAttempts : 0;
    
    // Build aggregated player object for enrichment
    const aggregatedPlayer = {
      position,
      snaps: totalSnaps,
      snap_share: avgSnapShare,
      routes: totalRoutes,
      route_rate: avgRouteRate,
      targets: totalTargets,
      target_share: avgTargetShare,
      targetShare: avgTargetShare,
      receptions: totalReceptions,
      receiving_yards: totalRecYards,
      rec_yd: totalRecYards,
      receiving_tds: totalRecTds,
      receiving_air_yards: totalAirYards,
      air_yards: totalAirYards,
      receiving_yards_after_catch: totalYac,
      yac: totalYac,
      tprr: avgTprr,
      yprr: avgYprr,
      adot: avgAdot,
      aDot: avgAdot,
      rushing_yards: totalRushYards,
      rush_att: totalRushAttempts,
      carries: totalRushAttempts,
      rushing_tds: totalRushTds,
      epa_per_play: avgEpaPerPlay,
      epa_per_target: avgEpaPerTarget,
      rush_epa_per_play: avgRushEpa,
      success_rate: avgSuccessRate,
      fpts_std: totalFptsStd,
      fpts_half: totalFptsHalf,
      fpts_ppr: totalFptsPpr,
      // WR-specific calculated metrics
      wopr_x: null, // Would need to be pulled from external enrichment source
      wopr: null,
      racr: totalAirYards > 0 ? totalRecYards / totalAirYards : null,
      // RZ metrics are not in weekly snapshot - would need external source
      rz_targets: 0,
      end_zone_targets: 0,
    };
    
    // Apply position-specific enrichment
    const enrichmentResult = enrichByPosition(aggregatedPlayer as any);
    
    return {
      canonicalId,
      nflDataPyId,
      playerName,
      position,
      team,
      
      gamesPlayed: rows.length,
      snaps: totalSnaps,
      snapShare: avgSnapShare,
      
      targets: totalTargets,
      targetShare: avgTargetShare,
      receptions: totalReceptions,
      receivingYards: totalRecYards,
      receivingTds: totalRecTds,
      routes: totalRoutes,
      routeRate: avgRouteRate,
      
      tprr: avgTprr,
      yprr: avgYprr,
      aDot: avgAdot,
      airYards: totalAirYards,
      yac: totalYac,
      
      rushAttempts: totalRushAttempts,
      rushYards: totalRushYards,
      rushTds: totalRushTds,
      yardsPerCarry: avgYpc,
      
      epaPerPlay: avgEpaPerPlay,
      epaPerTarget: avgEpaPerTarget,
      rushEpaPerPlay: avgRushEpa,
      successRate: avgSuccessRate,
      
      fantasyPointsStd: totalFptsStd,
      fantasyPointsHalf: totalFptsHalf,
      fantasyPointsPpr: totalFptsPpr,
      
      // Position-specific enriched metrics
      enrichedMetrics: enrichmentResult.player as Record<string, any>,
      enrichmentList: enrichmentResult.enrichments,
    };
  } catch (error) {
    console.error('[DatadiveContext] Error fetching enriched player data:', error);
    return null;
  }
}

/**
 * Convert enriched player data to FORGE input format
 */
export function enrichedToForgeInput(data: EnrichedPlayerData): ForgeDatadiveInput {
  return {
    gamesPlayed: data.gamesPlayed,
    snaps: data.snaps,
    snapShare: data.snapShare,
    
    routes: data.routes,
    routeRate: data.routeRate,
    targets: data.targets,
    targetShare: data.targetShare,
    receptions: data.receptions,
    receivingYards: data.receivingYards,
    receivingTds: data.receivingTds,
    
    tprr: data.tprr,
    yprr: data.yprr,
    aDot: data.aDot,
    airYards: data.airYards,
    yac: data.yac,
    
    epaPerPlay: data.epaPerPlay,
    epaPerTarget: data.epaPerTarget,
    successRate: data.successRate,
    
    rushAttempts: data.rushAttempts,
    rushYards: data.rushYards,
    rushTds: data.rushTds,
    yardsPerCarry: data.yardsPerCarry,
    rushEpaPerPlay: data.rushEpaPerPlay,
    
    fantasyPointsStd: data.fantasyPointsStd,
    fantasyPointsHalf: data.fantasyPointsHalf,
    fantasyPointsPpr: data.fantasyPointsPpr,
  };
}

export default {
  USE_DATADIVE_FORGE,
  getCurrentSnapshot,
  mapSnapshotRowToForgeInput,
  getSnapshotSeasonStats,
  getSnapshotWeeklyStats,
  getEnrichedPlayerWeek,
  enrichedToForgeInput,
  getDatadiveEligiblePlayers,
  toForgeSeasonStats,
  toForgeAdvancedMetrics,
};
