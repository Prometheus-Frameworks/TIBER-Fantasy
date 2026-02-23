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
import { validateSnapshotRows } from './snapshotDataValidator';

export interface RoleConsistencyResult {
  primaryScore: number;    // 0-100, primary metric consistency
  secondaryScore: number;  // 0-100, secondary metric consistency
  blendedScore: number;    // 0-100, weighted blend
  belowGate: boolean;      // true if player below minimum participation
}

// Position-specific CV caps (values above this = fully unstable)
// Calibrated against real 2025 data: elite starters should score 50-80+.
// QB dropbacks naturally vary 20-55/week (CV ~0.25-0.35 for starters).
// RB touches vary 10-35/week (CV ~0.30-0.50 for starters).
const CV_CAPS: Record<Position, { primary: number; secondary: number }> = {
  RB: { primary: 0.65, secondary: 0.55 },  // touch counts, snap share
  WR: { primary: 0.55, secondary: 0.60 },  // route participation, target share
  TE: { primary: 0.55, secondary: 0.60 },  // route participation, target share
  QB: { primary: 0.55, secondary: 0.70 },  // dropback volume, rush share
};

// Minimum participation gates (per-game averages)
const MIN_PARTICIPATION: Record<Position, number> = {
  RB: 5,   // 5 touches per game
  WR: 10,  // 10 routes per game
  TE: 10,  // 10 routes per game
  QB: 15,  // 15 dropbacks per game
};

// Minimum primary metric value to count a week as "active"
// Filters out rest games (week 18 sit-outs), injury exits, etc.
const MIN_ACTIVE_THRESHOLD: Record<Position, number> = {
  RB: 3,   // At least 3 touches to count as playing
  WR: 5,   // At least 5 routes
  TE: 3,   // At least 3 routes (TEs have fewer)
  QB: 10,  // At least 10 dropbacks to count as starting
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

    // Filter out inactive weeks (rest games, injury exits, week 18 sit-outs)
    const activeWeeks = filterActiveWeeks(weeklyData, position);

    if (activeWeeks.length < 3) {
      return { primaryScore: DEFAULT_LOW_SCORE, secondaryScore: DEFAULT_LOW_SCORE, blendedScore: DEFAULT_LOW_SCORE, belowGate: true };
    }

    // Extract position-specific metrics
    const { primaryValues, secondaryValues, participationAvg } = extractRoleMetrics(activeWeeks, position);

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

    // Warning for suspiciously low scores on players with many games
    if (blendedScore < 10 && activeWeeks.length >= 10) {
      console.warn(`[RoleConsistency] WARNING: ${playerId} (${position}) stability=${blendedScore.toFixed(1)} with ${activeWeeks.length} active weeks — possible data gap. Primary CV=${primaryValues.length > 1 ? (stdev(primaryValues) / mean(primaryValues)).toFixed(3) : 'N/A'}`);
    }

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
  week: number;
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
      sm.week as week,
      COALESCE(spw.targets, 0) as targets,
      COALESCE(spw.rush_attempts, 0) as rush_attempts,
      spw.snap_share,
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

  const validation = validateSnapshotRows(
    result.rows as Record<string, any>[],
    position,
    statsId
  );

  return validation.cleanRows.map(row => ({
    week: parseInt(String(row.week)) || 0,
    targets: parseInt(String(row.targets)) || 0,
    rushAttempts: parseInt(String(row.rush_attempts)) || 0,
    snapShare: parseFloat(String(row.snap_share)) || 0,
    routes: parseInt(String(row.routes)) || 0,
    targetShare: parseFloat(String(row.target_share)) || 0,
    dropbacks: parseInt(String(row.dropbacks)) || 0,
  }));
}

/**
 * Filter out weeks where the player was inactive/resting.
 * Week 18 sit-outs, injury exits, and bye-week artifacts inject zeros
 * that blow up CV calculations. A single 0-dropback week can push
 * an elite QB's stability from 60 to 0.
 */
function filterActiveWeeks(weeks: WeeklyRoleRow[], position: Position): WeeklyRoleRow[] {
  const threshold = MIN_ACTIVE_THRESHOLD[position];

  return weeks.filter(w => {
    switch (position) {
      case 'RB':
        return (w.rushAttempts + w.targets) >= threshold;
      case 'WR':
      case 'TE':
        return w.routes >= threshold;
      case 'QB':
        return w.dropbacks >= threshold;
    }
  });
}

function extractRoleMetrics(
  weeks: WeeklyRoleRow[],
  position: Position
): { primaryValues: number[]; secondaryValues: number[]; participationAvg: number } {
  switch (position) {
    case 'RB': {
      // Primary: touch counts per week (carries + targets)
      const touchesPerWeek = weeks.map(w => w.rushAttempts + w.targets);
      // Secondary: snap share (team-relative fraction)
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
      // Secondary: target share
      const targetShares = weeks.map(w => w.targetShare);
      const avgRoutes = mean(routesPerWeek);
      return {
        primaryValues: routesPerWeek,
        secondaryValues: targetShares,
        participationAvg: avgRoutes,
      };
    }
    case 'QB': {
      // Primary: dropback volume per week
      const dropbacksPerWeek = weeks.map(w => w.dropbacks);
      // Secondary: rush involvement (rush attempts as fraction of total plays)
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

  const cleanValues = values.filter(v => Number.isFinite(v));
  if (cleanValues.length < 2) return DEFAULT_LOW_SCORE;

  const avg = mean(cleanValues);
  if (avg <= 0) return DEFAULT_LOW_SCORE;

  const sd = stdev(cleanValues);
  if (!Number.isFinite(sd)) return DEFAULT_LOW_SCORE;
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
