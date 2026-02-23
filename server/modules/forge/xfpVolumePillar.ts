/**
 * xFP Volume Pillar — Expected Fantasy Points per game
 *
 * Replaces raw-count volume with opportunity-quality-priced expected fantasy points.
 * Each opportunity type (carry, target, RZ carry, deep target, etc.) is valued at
 * its league-average PPR expected value. The result is a single xFP/G number that
 * captures both volume AND opportunity quality without reflecting player efficiency.
 *
 * Clean separation:
 * - Volume = xFP per game (what the opportunities are worth at league-avg efficiency)
 * - Efficiency = FPOE (actual production minus xFP — how much the player beats/misses expectations)
 */

import { db } from '../../infra/db';
import { sql } from 'drizzle-orm';
import { xfpV3Coefficients, xfpNormalizationRanges } from '../../services/xFptsConfig';
import type { Position } from './forgeEngine';
import { validateSnapshotRows } from './snapshotDataValidator';

export interface XfpResult {
  xfpPerGame: number;
  fpoePerGame: number;
  weeksUsed: number;
}

/**
 * Compute xFP per game for a player using v3 granular per-opportunity-type pricing.
 * Queries datadive_snapshot_player_week for weekly opportunity breakdowns.
 */
export async function computeXfpPerGame(
  playerId: string,
  position: Position,
  season: number
): Promise<XfpResult> {
  try {
    // Look up the player's stats ID (role bank uses nfl_data_py_id)
    const idLookup = await db.execute(sql`
      SELECT nfl_data_py_id, gsis_id
      FROM player_identity_map
      WHERE canonical_id = ${playerId}
      LIMIT 1
    `);

    let statsId = playerId;
    if (idLookup.rows.length > 0) {
      const row = idLookup.rows[0] as Record<string, any>;
      statsId = row.nfl_data_py_id || row.gsis_id || playerId;
    }

    // Fetch weekly snapshot data with opportunity breakdowns
    const result = await db.execute(sql`
      SELECT
        sm.week,
        spw.player_id,
        spw.targets,
        spw.rush_attempts,
        spw.routes,
        spw.snap_share,
        spw.rz_rush_attempts,
        spw.rz_targets,
        spw.deep_target_rate,
        spw.fpts_ppr,
        spw.dropbacks
      FROM datadive_snapshot_player_week spw
      JOIN datadive_snapshot_meta sm ON sm.id = spw.snapshot_id
      WHERE spw.player_id = ${statsId}
        AND sm.season = ${season}
        AND sm.is_official = true
      ORDER BY sm.week
    `);

    if (result.rows.length === 0) {
      // Fallback: try existing v2 xFP data from datadive_expected_fantasy_week
      return computeXfpFromV2Fallback(statsId, season);
    }

    const validation = validateSnapshotRows(
      result.rows as Record<string, any>[],
      position,
      playerId
    );

    const weeks = validation.cleanRows;
    let totalXfp = 0;
    let totalActualFpts = 0;

    for (const week of weeks) {
      const xfp = computeWeekXfp(week, position);
      totalXfp += xfp;
      totalActualFpts += parseFloat(week.fpts_ppr) || 0;
    }

    const weeksUsed = weeks.length;
    const xfpPerGame = weeksUsed > 0 ? totalXfp / weeksUsed : 0;
    const actualPerGame = weeksUsed > 0 ? totalActualFpts / weeksUsed : 0;
    const fpoePerGame = actualPerGame - xfpPerGame;

    return { xfpPerGame, fpoePerGame, weeksUsed };
  } catch (error) {
    console.error(`[xfpVolumePillar] Error computing xFP for ${playerId}:`, error);
    return { xfpPerGame: 0, fpoePerGame: 0, weeksUsed: 0 };
  }
}

/**
 * Compute xFP for a single week using v3 coefficients
 */
function computeWeekXfp(week: Record<string, any>, position: Position): number {
  const targets = parseInt(week.targets) || 0;
  const rushAttempts = parseInt(week.rush_attempts) || 0;
  const rzRushAttempts = parseInt(week.rz_rush_attempts) || 0;
  const rzTargets = parseInt(week.rz_targets) || 0;
  const deepTargetRate = parseFloat(week.deep_target_rate) || 0;
  const dropbacks = parseInt(week.dropbacks) || 0;

  switch (position) {
    case 'RB': {
      const nonRzCarries = Math.max(0, rushAttempts - rzRushAttempts);
      const rbXfp =
        nonRzCarries * xfpV3Coefficients.RB.carryNonRZ +
        rzRushAttempts * xfpV3Coefficients.RB.carryRZ +
        targets * xfpV3Coefficients.RB.target;
      return rbXfp;
    }
    case 'WR': {
      const deepTargets = Math.round(targets * deepTargetRate);
      const nonDeepTargets = Math.max(0, targets - deepTargets);
      const wrXfp =
        nonDeepTargets * xfpV3Coefficients.WR.targetNonDeep +
        deepTargets * xfpV3Coefficients.WR.targetDeep;
      return wrXfp;
    }
    case 'TE': {
      const nonRzTargets = Math.max(0, targets - rzTargets);
      const teXfp =
        nonRzTargets * xfpV3Coefficients.TE.targetNonRZ +
        rzTargets * xfpV3Coefficients.TE.targetRZ;
      return teXfp;
    }
    case 'QB': {
      const qbXfp =
        dropbacks * xfpV3Coefficients.QB.dropback +
        rushAttempts * xfpV3Coefficients.QB.rushAttempt;
      return qbXfp;
    }
    default:
      return 0;
  }
}

/**
 * Fallback: compute xFP/G from existing v2 expected fantasy data
 */
async function computeXfpFromV2Fallback(
  playerId: string,
  season: number
): Promise<XfpResult> {
  try {
    const result = await db.execute(sql`
      SELECT
        AVG(COALESCE(x_ppr_v2, x_ppr_v1, 0)) as avg_xfp,
        AVG(COALESCE(actual_ppr, 0)) as avg_actual,
        COUNT(*) as weeks_used
      FROM datadive_expected_fantasy_week
      WHERE player_id = ${playerId}
        AND season = ${season}
    `);

    if (result.rows.length === 0) {
      return { xfpPerGame: 0, fpoePerGame: 0, weeksUsed: 0 };
    }

    const row = result.rows[0] as Record<string, any>;
    const xfpPerGame = parseFloat(row.avg_xfp) || 0;
    const actualPerGame = parseFloat(row.avg_actual) || 0;
    return {
      xfpPerGame,
      fpoePerGame: actualPerGame - xfpPerGame,
      weeksUsed: parseInt(row.weeks_used) || 0,
    };
  } catch {
    return { xfpPerGame: 0, fpoePerGame: 0, weeksUsed: 0 };
  }
}

/**
 * Normalize raw xFP/G to 0-100 pillar score using position-specific ranges
 */
export function normalizeXfpToScore(xfpPerGame: number, position: Position): number {
  const range = xfpNormalizationRanges[position];
  if (!range) return 50;

  const denom = range.max - range.min;
  if (denom === 0) return 50;
  const normalized = ((xfpPerGame - range.min) / denom) * 100;
  return Math.max(0, Math.min(100, normalized));
}
