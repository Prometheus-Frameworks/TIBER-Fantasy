/**
 * Role Consistency Pillar — CV-based stability measurement
 *
 * Replaces scoring-variance stability with coefficient of variation (CV)
 * on role metrics (snap share, touch share, route participation, target share).
 *
 * Key insight: elite bellcows have volatile *scoring* but consistent *roles*.
 * A player who gets 20 touches every week is highly stable even if his
 * point totals swing from 8 to 30. Scoring variance is a function of
 * TD luck, not role instability.
 *
 * CV = stdev / mean — scales dispersion relative to the average level.
 * Low CV = consistent week-to-week role = high stability score.
 */

import { db } from '../../infra/db';
import { sql } from 'drizzle-orm';
import type { Position } from './forgeEngine';

export interface RoleConsistencyResult {
  primaryScore: number;    // 0-100, primary metric consistency
  secondaryScore: number;  // 0-100, secondary metric consistency
  blendedScore: number;    // 0-100, weighted blend
  belowGate: boolean;      // true if player below minimum participation
}

// Position-specific CV caps (values above this = fully unstable)
const CV_CAPS: Record<Position, { primary: number; secondary: number }> = {
  RB: { primary: 0.50, secondary: 0.45 },  // touch share, snap share
  WR: { primary: 0.45, secondary: 0.50 },  // route participation, target share
  TE: { primary: 0.45, secondary: 0.50 },  // route participation, target share
  QB: { primary: 0.35, secondary: 0.60 },  // dropback volume, rush share
};

// Minimum participation gates (per-game averages)
const MIN_PARTICIPATION: Record<Position, number> = {
  RB: 5,   // 5 touches per game
  WR: 10,  // 10 routes per game
  TE: 10,  // 10 routes per game
  QB: 15,  // 15 dropbacks per game
};

const DEFAULT_LOW_SCORE = 25;

/**
 * Compute role consistency for a player using CV of weekly role metrics.
 */
export async function computeRoleConsistency(
  playerId: string,
  position: Position,
  season: number
): Promise<RoleConsistencyResult> {
  try {
    // Look up stats ID
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

    // Fetch weekly data from snapshot_player_week
    const weeklyData = await fetchWeeklyRoleData(statsId, position, season);

    if (weeklyData.length < 3) {
      return { primaryScore: DEFAULT_LOW_SCORE, secondaryScore: DEFAULT_LOW_SCORE, blendedScore: DEFAULT_LOW_SCORE, belowGate: true };
    }

    // Extract position-specific metrics
    const { primaryValues, secondaryValues, participationAvg } = extractRoleMetrics(weeklyData, position);

    // Check participation gate
    if (participationAvg < MIN_PARTICIPATION[position]) {
      return { primaryScore: DEFAULT_LOW_SCORE, secondaryScore: DEFAULT_LOW_SCORE, blendedScore: DEFAULT_LOW_SCORE, belowGate: true };
    }

    // Compute CV-based scores
    const caps = CV_CAPS[position];
    const primaryScore = cvToScore(primaryValues, caps.primary);
    const secondaryScore = cvToScore(secondaryValues, caps.secondary);

    // Blend: 60% primary, 40% secondary
    const blendedScore = 0.60 * primaryScore + 0.40 * secondaryScore;

    return {
      primaryScore: Math.round(primaryScore * 10) / 10,
      secondaryScore: Math.round(secondaryScore * 10) / 10,
      blendedScore: Math.round(blendedScore * 10) / 10,
      belowGate: false,
    };
  } catch (error) {
    console.error(`[roleConsistencyPillar] Error for ${playerId}:`, error);
    return { primaryScore: DEFAULT_LOW_SCORE, secondaryScore: DEFAULT_LOW_SCORE, blendedScore: DEFAULT_LOW_SCORE, belowGate: true };
  }
}

interface WeeklyRoleRow {
  targets: number;
  rushAttempts: number;
  snapShare: number;
  routes: number;
  targetShare: number;
  dropbacks: number;
}

async function fetchWeeklyRoleData(
  statsId: string,
  position: Position,
  season: number
): Promise<WeeklyRoleRow[]> {
  const result = await db.execute(sql`
    SELECT
      COALESCE(spw.targets, 0) as targets,
      COALESCE(spw.rush_attempts, 0) as rush_attempts,
      COALESCE(spw.snap_share, 0) as snap_share,
      COALESCE(spw.routes, 0) as routes,
      COALESCE(spw.target_share, 0) as target_share,
      COALESCE(spw.dropbacks, 0) as dropbacks
    FROM datadive_snapshot_player_week spw
    JOIN datadive_snapshot_meta sm ON sm.id = spw.snapshot_id
    WHERE spw.player_id = ${statsId}
      AND sm.season = ${season}
      AND sm.is_official = true
    ORDER BY sm.week
  `);

  return (result.rows as Record<string, any>[]).map(row => ({
    targets: parseInt(row.targets) || 0,
    rushAttempts: parseInt(row.rush_attempts) || 0,
    snapShare: parseFloat(row.snap_share) || 0,
    routes: parseInt(row.routes) || 0,
    targetShare: parseFloat(row.target_share) || 0,
    dropbacks: parseInt(row.dropbacks) || 0,
  }));
}

function extractRoleMetrics(
  weeks: WeeklyRoleRow[],
  position: Position
): { primaryValues: number[]; secondaryValues: number[]; participationAvg: number } {
  switch (position) {
    case 'RB': {
      // Primary: touch share (carries + targets as fraction of total touches)
      // We approximate touch share using raw touches since team totals aren't per-week here
      const touchesPerWeek = weeks.map(w => w.rushAttempts + w.targets);
      const snapShares = weeks.map(w => w.snapShare);
      const avgTouches = mean(touchesPerWeek);
      return {
        primaryValues: touchesPerWeek,
        secondaryValues: snapShares,
        participationAvg: avgTouches,
      };
    }
    case 'WR':
    case 'TE': {
      // Primary: route participation (routes per week)
      const routesPerWeek = weeks.map(w => w.routes);
      const targetShares = weeks.map(w => w.targetShare);
      const avgRoutes = mean(routesPerWeek);
      return {
        primaryValues: routesPerWeek,
        secondaryValues: targetShares,
        participationAvg: avgRoutes,
      };
    }
    case 'QB': {
      // Primary: dropback volume
      const dropbacksPerWeek = weeks.map(w => w.dropbacks);
      // Secondary: rush share (rush attempts as portion of total plays)
      const rushSharePerWeek = weeks.map(w => {
        const total = w.dropbacks + w.rushAttempts;
        return total > 0 ? w.rushAttempts / total : 0;
      });
      const avgDropbacks = mean(dropbacksPerWeek);
      return {
        primaryValues: dropbacksPerWeek,
        secondaryValues: rushSharePerWeek,
        participationAvg: avgDropbacks,
      };
    }
  }
}

/**
 * Convert a series of weekly values to a 0-100 stability score using CV.
 * Low CV = consistent = high score.
 */
function cvToScore(values: number[], cvCap: number): number {
  if (values.length < 2) return DEFAULT_LOW_SCORE;

  const avg = mean(values);
  if (avg <= 0) return DEFAULT_LOW_SCORE;

  const sd = stdev(values);
  const cv = sd / avg;

  // Map CV to 0-100: cv=0 → 100, cv>=cvCap → 0
  const score = (1 - Math.min(cv / cvCap, 1)) * 100;
  return Math.max(0, Math.min(100, score));
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function stdev(values: number[]): number {
  if (values.length < 2) return 0;
  const avg = mean(values);
  const sumSqDiff = values.reduce((sum, v) => sum + (v - avg) ** 2, 0);
  return Math.sqrt(sumSqDiff / (values.length - 1)); // sample stdev
}
