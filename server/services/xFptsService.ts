/**
 * xFPTS Service v2
 * Context-aware expected fantasy points computation
 * 
 * Computes both v1 (usage-only) and v2 (context-aware) expected fantasy points
 * for each player-week in the Datadive snapshot system.
 */

import { db } from "../infra/db";
import { sql } from "drizzle-orm";
import {
  calculateXFptsV1,
  calculateRecMultiplier,
  calculateRushMultiplier,
  contextConfig,
} from "./xFptsConfig";

interface NflfastrMetrics {
  playerId: string;
  position: string | null;
  targets: number | null;
  airYards: number | null;
  yacPerRec: number | null;
  rzTargets: number | null;
  rzCarries: number | null;
  rushEpa: number | null;
  rushSuccess: number | null;
}

interface SnapshotPlayerWeekRow {
  playerId: string;
  playerName: string;
  position: string | null;
  targets: number;
  rushAttempts: number;
  fptsPpr: number | null;
  yac: number | null;
  receptions: number | null;
  rushEpaPerPlay: number | null;
  successRate: number | null;
}

interface ExpectedFantasyResult {
  playerId: string;
  position: string | null;
  actualPpr: number;
  xPprV1: number;
  xfpgoePprV1: number;
  xPprV2: number;
  xfpgoePprV2: number;
  recMultiplier: number;
  rushMultiplier: number;
  rzShare: number;
  yacRatio: number;
  rushEpaCtx: number;
  rushSuccessCtx: number;
  expectedRecPprV1: number;
  expectedRushPprV1: number;
  expectedRecPprV2: number;
  expectedRushPprV2: number;
}

/**
 * Load nflfastR metrics for a given season/week
 * Returns a map keyed by playerId
 */
async function loadNflfastrMetrics(
  season: number,
  week: number
): Promise<Map<string, NflfastrMetrics>> {
  const result = await db.execute(sql`
    SELECT 
      player_id,
      position,
      targets,
      air_yards,
      yac_per_rec,
      rz_targets,
      rz_carries,
      rush_epa,
      rush_success
    FROM datadive_nflfastr_metrics
    WHERE season = ${season} AND week = ${week}
  `);

  const rows = (result as any).rows || [];
  const metricsMap = new Map<string, NflfastrMetrics>();

  for (const row of rows) {
    metricsMap.set(row.player_id, {
      playerId: row.player_id,
      position: row.position,
      targets: row.targets,
      airYards: row.air_yards,
      yacPerRec: row.yac_per_rec,
      rzTargets: row.rz_targets,
      rzCarries: row.rz_carries,
      rushEpa: row.rush_epa,
      rushSuccess: row.rush_success,
    });
  }

  return metricsMap;
}

/**
 * Load snapshot player week data for a given season/week
 */
async function loadSnapshotPlayerWeek(
  season: number,
  week: number
): Promise<SnapshotPlayerWeekRow[]> {
  const result = await db.execute(sql`
    SELECT 
      spw.player_id,
      spw.player_name,
      spw.position,
      COALESCE(spw.targets, 0) as targets,
      COALESCE(spw.rush_attempts, 0) as rush_attempts,
      spw.fpts_ppr,
      spw.yac,
      spw.receptions,
      spw.rush_epa_per_play,
      spw.success_rate
    FROM datadive_snapshot_player_week spw
    JOIN datadive_snapshot_meta sm ON sm.id = spw.snapshot_id
    WHERE sm.season = ${season} 
      AND sm.week = ${week}
      AND sm.is_official = true
  `);

  const rows = (result as any).rows || [];
  return rows.map((row: any) => ({
    playerId: row.player_id,
    playerName: row.player_name,
    position: row.position,
    targets: Number(row.targets) || 0,
    rushAttempts: Number(row.rush_attempts) || 0,
    fptsPpr: row.fpts_ppr !== null ? Number(row.fpts_ppr) : null,
    yac: row.yac !== null ? Number(row.yac) : null,
    receptions: row.receptions !== null ? Number(row.receptions) : null,
    rushEpaPerPlay: row.rush_epa_per_play !== null ? Number(row.rush_epa_per_play) : null,
    successRate: row.success_rate !== null ? Number(row.success_rate) : null,
  }));
}

/**
 * Compute expected fantasy points for a single player-week
 * Returns both v1 and v2 values
 */
function computePlayerExpectedFantasy(
  snapshot: SnapshotPlayerWeekRow,
  metrics: NflfastrMetrics | null
): ExpectedFantasyResult {
  const { playerId, position, targets, rushAttempts, fptsPpr, yac, receptions, rushEpaPerPlay, successRate } = snapshot;
  const actualPpr = fptsPpr ?? 0;
  const pos = position || 'WR';

  // 1) v1 computation (existing usage-only logic)
  const v1 = calculateXFptsV1(targets, rushAttempts, pos);
  const xPprV1 = v1.totalPpr;
  const xfpgoePprV1 = actualPpr - xPprV1;

  // 2) v2 receiving context
  const rzTargets = metrics?.rzTargets ?? 0;
  
  // Calculate YAC per reception from snapshot data if metrics not available
  let yacPerRec: number | null = null;
  if (metrics?.yacPerRec !== null && metrics?.yacPerRec !== undefined) {
    yacPerRec = metrics.yacPerRec;
  } else if (receptions && receptions > 0 && yac !== null) {
    yacPerRec = yac / receptions;
  }

  const recCtx = calculateRecMultiplier(rzTargets, targets, yacPerRec);
  const expectedRecPprV2 = v1.recPpr * recCtx.multiplier;

  // 3) v2 rushing context
  const rushEpa = metrics?.rushEpa ?? rushEpaPerPlay ?? null;
  const rushSuccess = metrics?.rushSuccess ?? successRate ?? null;
  
  const rushCtx = calculateRushMultiplier(rushEpa, rushSuccess, rushAttempts);
  const expectedRushPprV2 = v1.rushPpr * rushCtx.multiplier;

  // 4) Combine v2
  const xPprV2 = expectedRecPprV2 + expectedRushPprV2;
  const xfpgoePprV2 = actualPpr - xPprV2;

  return {
    playerId,
    position,
    actualPpr,
    xPprV1,
    xfpgoePprV1,
    xPprV2,
    xfpgoePprV2,
    recMultiplier: recCtx.multiplier,
    rushMultiplier: rushCtx.multiplier,
    rzShare: recCtx.rzShare,
    yacRatio: recCtx.yacRatio,
    rushEpaCtx: rushCtx.epaCtx,
    rushSuccessCtx: rushCtx.successCtx,
    expectedRecPprV1: v1.recPpr,
    expectedRushPprV1: v1.rushPpr,
    expectedRecPprV2,
    expectedRushPprV2,
  };
}

/**
 * Upsert expected fantasy result to database
 */
async function upsertExpectedFantasyWeek(
  season: number,
  week: number,
  result: ExpectedFantasyResult
): Promise<void> {
  await db.execute(sql`
    INSERT INTO datadive_expected_fantasy_week (
      season, week, player_id, position,
      actual_ppr,
      x_ppr_v1, xfpgoe_ppr_v1,
      x_ppr_v2, xfpgoe_ppr_v2,
      rec_multiplier, rush_multiplier,
      rz_share, yac_ratio,
      rush_epa_ctx, rush_success_ctx,
      expected_rec_ppr_v1, expected_rush_ppr_v1,
      expected_rec_ppr_v2, expected_rush_ppr_v2,
      updated_at
    ) VALUES (
      ${season}, ${week}, ${result.playerId}, ${result.position},
      ${result.actualPpr},
      ${result.xPprV1}, ${result.xfpgoePprV1},
      ${result.xPprV2}, ${result.xfpgoePprV2},
      ${result.recMultiplier}, ${result.rushMultiplier},
      ${result.rzShare}, ${result.yacRatio},
      ${result.rushEpaCtx}, ${result.rushSuccessCtx},
      ${result.expectedRecPprV1}, ${result.expectedRushPprV1},
      ${result.expectedRecPprV2}, ${result.expectedRushPprV2},
      now()
    )
    ON CONFLICT (season, week, player_id) 
    DO UPDATE SET
      position = EXCLUDED.position,
      actual_ppr = EXCLUDED.actual_ppr,
      x_ppr_v1 = EXCLUDED.x_ppr_v1,
      xfpgoe_ppr_v1 = EXCLUDED.xfpgoe_ppr_v1,
      x_ppr_v2 = EXCLUDED.x_ppr_v2,
      xfpgoe_ppr_v2 = EXCLUDED.xfpgoe_ppr_v2,
      rec_multiplier = EXCLUDED.rec_multiplier,
      rush_multiplier = EXCLUDED.rush_multiplier,
      rz_share = EXCLUDED.rz_share,
      yac_ratio = EXCLUDED.yac_ratio,
      rush_epa_ctx = EXCLUDED.rush_epa_ctx,
      rush_success_ctx = EXCLUDED.rush_success_ctx,
      expected_rec_ppr_v1 = EXCLUDED.expected_rec_ppr_v1,
      expected_rush_ppr_v1 = EXCLUDED.expected_rush_ppr_v1,
      expected_rec_ppr_v2 = EXCLUDED.expected_rec_ppr_v2,
      expected_rush_ppr_v2 = EXCLUDED.expected_rush_ppr_v2,
      updated_at = now()
  `);
}

/**
 * Compute expected fantasy for all players in a given week
 * This is the main entry point for v2 xFPTS computation
 */
export async function computeExpectedFantasyForWeek(
  season: number,
  week: number
): Promise<{ processed: number; errors: number }> {
  console.log(`[xFPTS] Computing expected fantasy for ${season} Week ${week}...`);

  // Load nflfastR metrics (may be empty if not yet populated)
  const metricsMap = await loadNflfastrMetrics(season, week);
  console.log(`[xFPTS] Loaded ${metricsMap.size} nflfastR metrics records`);

  // Load snapshot player week data
  const snapshotRows = await loadSnapshotPlayerWeek(season, week);
  console.log(`[xFPTS] Loaded ${snapshotRows.length} snapshot player-week records`);

  let processed = 0;
  let errors = 0;

  for (const snapshot of snapshotRows) {
    try {
      const metrics = metricsMap.get(snapshot.playerId) || null;
      const result = computePlayerExpectedFantasy(snapshot, metrics);
      await upsertExpectedFantasyWeek(season, week, result);
      processed++;
    } catch (err) {
      console.error(`[xFPTS] Error processing ${snapshot.playerId}:`, err);
      errors++;
    }
  }

  console.log(`[xFPTS] Completed: ${processed} processed, ${errors} errors`);
  return { processed, errors };
}

/**
 * Compute expected fantasy for an entire season
 */
export async function computeExpectedFantasyForSeason(
  season: number,
  startWeek: number = 1,
  endWeek: number = 18
): Promise<{ weekResults: { week: number; processed: number; errors: number }[] }> {
  const weekResults: { week: number; processed: number; errors: number }[] = [];

  // Get available weeks from snapshot metadata
  const availableWeeks = await db.execute(sql`
    SELECT DISTINCT week 
    FROM datadive_snapshot_meta 
    WHERE season = ${season} 
      AND is_official = true
      AND week BETWEEN ${startWeek} AND ${endWeek}
    ORDER BY week
  `);

  const weeks = ((availableWeeks as any).rows || []).map((r: any) => Number(r.week));
  console.log(`[xFPTS] Processing ${weeks.length} weeks for season ${season}`);

  for (const week of weeks) {
    const result = await computeExpectedFantasyForWeek(season, week);
    weekResults.push({ week, ...result });
  }

  return { weekResults };
}

/**
 * Extract and populate nflfastR metrics from existing snapshot data
 * This derives context metrics from the snapshot player week data
 * For a full implementation, this would integrate with external nflfastR data
 */
export async function extractNflfastrMetricsFromSnapshots(
  season: number,
  week: number
): Promise<{ processed: number }> {
  console.log(`[xFPTS] Extracting nflfastR metrics from snapshots for ${season} Week ${week}...`);

  // For now, we derive what we can from existing snapshot data
  // RZ targets/carries would require play-by-play data which isn't in snapshots
  // YAC per reception can be computed from yac / receptions
  // Rush EPA/success can be pulled from snapshot fields

  const result = await db.execute(sql`
    INSERT INTO datadive_nflfastr_metrics (
      season, week, player_id, position,
      targets, air_yards, yac_per_rec,
      rz_targets, rz_carries,
      rush_epa, rush_success,
      updated_at
    )
    SELECT 
      sm.season,
      sm.week,
      spw.player_id,
      spw.position,
      spw.targets,
      spw.air_yards,
      CASE WHEN spw.receptions > 0 THEN spw.yac::numeric / spw.receptions ELSE NULL END as yac_per_rec,
      0 as rz_targets,  -- Placeholder: would need play-by-play data
      0 as rz_carries,  -- Placeholder: would need play-by-play data
      spw.rush_epa_per_play as rush_epa,
      spw.success_rate as rush_success,
      now()
    FROM datadive_snapshot_player_week spw
    JOIN datadive_snapshot_meta sm ON sm.id = spw.snapshot_id
    WHERE sm.season = ${season}
      AND sm.week = ${week}
      AND sm.is_official = true
    ON CONFLICT (season, week, player_id)
    DO UPDATE SET
      position = EXCLUDED.position,
      targets = EXCLUDED.targets,
      air_yards = EXCLUDED.air_yards,
      yac_per_rec = EXCLUDED.yac_per_rec,
      rush_epa = EXCLUDED.rush_epa,
      rush_success = EXCLUDED.rush_success,
      updated_at = now()
  `);

  // Count the number of rows affected
  const countResult = await db.execute(sql`
    SELECT COUNT(*) as cnt FROM datadive_nflfastr_metrics
    WHERE season = ${season} AND week = ${week}
  `);
  const count = Number((countResult as any).rows?.[0]?.cnt || 0);

  console.log(`[xFPTS] Extracted ${count} nflfastR metrics records`);
  return { processed: count };
}

/**
 * Get expected fantasy stats for a player across weeks
 */
export async function getPlayerExpectedFantasy(
  playerId: string,
  season: number,
  weekFrom?: number,
  weekTo?: number
): Promise<any[]> {
  let weekFilter = sql.raw('');
  if (weekFrom !== undefined && weekTo !== undefined) {
    weekFilter = sql.raw(`AND week BETWEEN ${weekFrom} AND ${weekTo}`);
  } else if (weekFrom !== undefined) {
    weekFilter = sql.raw(`AND week >= ${weekFrom}`);
  } else if (weekTo !== undefined) {
    weekFilter = sql.raw(`AND week <= ${weekTo}`);
  }

  const result = await db.execute(sql`
    SELECT 
      season, week, player_id, position,
      actual_ppr,
      x_ppr_v1, xfpgoe_ppr_v1,
      x_ppr_v2, xfpgoe_ppr_v2,
      rec_multiplier, rush_multiplier,
      rz_share, yac_ratio,
      rush_epa_ctx, rush_success_ctx
    FROM datadive_expected_fantasy_week
    WHERE season = ${season}
      AND player_id = ${playerId}
      ${weekFilter}
    ORDER BY week
  `);

  return (result as any).rows || [];
}

/**
 * Get aggregated expected fantasy stats for usage-agg endpoint
 * Uses v2 as default with v1 fallback
 */
export async function getAggregatedExpectedFantasy(
  season: number,
  startWeek: number,
  endWeek: number,
  position?: string
): Promise<Map<string, { xPpr: number; xfpgoe: number; gamesWithData: number }>> {
  const posFilter = position && position !== 'ALL' 
    ? sql.raw(`AND position = '${position}'`)
    : sql.raw('');

  const result = await db.execute(sql`
    SELECT 
      player_id,
      COUNT(*) as games_with_data,
      SUM(COALESCE(x_ppr_v2, x_ppr_v1, 0)) as total_x_ppr,
      SUM(COALESCE(actual_ppr, 0)) as total_actual_ppr
    FROM datadive_expected_fantasy_week
    WHERE season = ${season}
      AND week BETWEEN ${startWeek} AND ${endWeek}
      ${posFilter}
    GROUP BY player_id
  `);

  const rows = (result as any).rows || [];
  const aggregatedMap = new Map<string, { xPpr: number; xfpgoe: number; gamesWithData: number }>();

  for (const row of rows) {
    const xPpr = Number(row.total_x_ppr) || 0;
    const actualPpr = Number(row.total_actual_ppr) || 0;
    const gamesWithData = Number(row.games_with_data) || 0;

    aggregatedMap.set(row.player_id, {
      xPpr,
      xfpgoe: actualPpr - xPpr,
      gamesWithData,
    });
  }

  return aggregatedMap;
}
