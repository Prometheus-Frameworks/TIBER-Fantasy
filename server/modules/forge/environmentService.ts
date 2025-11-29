/**
 * FORGE Environment Service v0.1
 * 
 * Provides team environment scores that measure how fantasy-friendly
 * an offense is for skill players. Higher scores = better environment.
 * 
 * Data Sources:
 * - team_offensive_context: cpoe, pass_epa, pressure_rate_allowed
 * - bronze_nflfastr_plays: neutral script data, sack rates
 * 
 * Score Formula (env_score_100):
 *   0.25 * norm(qb_cpoe) 
 * + 0.25 * norm(qb_epa_per_dropback)
 * + 0.20 * (1 - norm(pressure_rate_allowed))  // Less pressure = better
 * + 0.15 * norm(neutral_pass_rate + proe)
 * + 0.15 * norm(ppg + rz_possessions_per_game)
 */

import { db } from '../../infra/db';
import { eq, and } from 'drizzle-orm';
import { forgeTeamEnvironment, teamOffensiveContext, ForgeTeamEnvironment } from '@shared/schema';
import type { TeamEnvironment } from './types';

const LEAGUE_AVG_ENV_SCORE = 50;

/**
 * Get team environment score for a specific team/week
 * Returns null if no data available
 */
export async function getTeamEnvironment(
  season: number,
  week: number,
  team: string
): Promise<TeamEnvironment | null> {
  try {
    // First try to get from cached forge_team_environment table
    const cached = await db
      .select()
      .from(forgeTeamEnvironment)
      .where(
        and(
          eq(forgeTeamEnvironment.season, season),
          eq(forgeTeamEnvironment.week, week),
          eq(forgeTeamEnvironment.team, team)
        )
      )
      .limit(1);

    if (cached.length > 0) {
      const row = cached[0];
      return {
        season: row.season,
        week: row.week,
        team: row.team,
        envScore100: row.envScore100 ?? LEAGUE_AVG_ENV_SCORE,
        metrics: {
          qbCpoe: row.qbCpoe ?? undefined,
          qbEpaPerDropback: row.qbEpaPerDropback ?? undefined,
          neutralPassRate: row.neutralPassRate ?? undefined,
          proe: row.proe ?? undefined,
          pressureRateAllowed: row.pressureRateAllowed ?? undefined,
          sackRateAllowed: row.sackRateAllowed ?? undefined,
          ppg: row.ppg ?? undefined,
          rzPossessionsPerGame: row.rzPossessionsPerGame ?? undefined,
        },
      };
    }

    // Fallback: try to compute from team_offensive_context
    const offCtx = await db
      .select()
      .from(teamOffensiveContext)
      .where(
        and(
          eq(teamOffensiveContext.season, season),
          eq(teamOffensiveContext.week, week),
          eq(teamOffensiveContext.team, team)
        )
      )
      .limit(1);

    if (offCtx.length > 0) {
      const ctx = offCtx[0];
      // Simple score based on available data
      const envScore = computeEnvScoreFromContext(ctx);
      return {
        season,
        week,
        team,
        envScore100: envScore,
        metrics: {
          qbCpoe: ctx.cpoe ?? undefined,
          qbEpaPerDropback: ctx.passEpa ?? undefined,
          pressureRateAllowed: ctx.pressureRateAllowed ?? undefined,
        },
      };
    }

    return null;
  } catch (err) {
    console.error(`[FORGE/Env] Error fetching environment for ${team}:`, err);
    return null;
  }
}

/**
 * Get environment scores for all teams for a given week
 * Used for batch processing and normalization
 */
export async function getAllTeamEnvironments(
  season: number,
  week: number
): Promise<TeamEnvironment[]> {
  try {
    const rows = await db
      .select()
      .from(forgeTeamEnvironment)
      .where(
        and(
          eq(forgeTeamEnvironment.season, season),
          eq(forgeTeamEnvironment.week, week)
        )
      );

    return rows.map(row => ({
      season: row.season,
      week: row.week,
      team: row.team,
      envScore100: row.envScore100 ?? LEAGUE_AVG_ENV_SCORE,
      metrics: {
        qbCpoe: row.qbCpoe ?? undefined,
        qbEpaPerDropback: row.qbEpaPerDropback ?? undefined,
        neutralPassRate: row.neutralPassRate ?? undefined,
        proe: row.proe ?? undefined,
        pressureRateAllowed: row.pressureRateAllowed ?? undefined,
      },
    }));
  } catch (err) {
    console.error(`[FORGE/Env] Error fetching all environments:`, err);
    return [];
  }
}

/**
 * Compute environment score from team_offensive_context data
 * Used as fallback when forge_team_environment isn't populated
 */
function computeEnvScoreFromContext(ctx: {
  passEpa: number | null;
  cpoe: number | null;
  pressureRateAllowed: number | null;
}): number {
  // Normalize each metric to 0-100 scale
  // These ranges are approximate league distributions
  
  let score = 50; // Start at league average
  let factors = 0;

  if (ctx.passEpa !== null) {
    // EPA/play typically ranges from -0.2 to +0.3
    const epaNorm = normalize(ctx.passEpa, -0.15, 0.25);
    score += (epaNorm - 0.5) * 25; // ±12.5 points
    factors++;
  }

  if (ctx.cpoe !== null) {
    // CPOE typically ranges from -5 to +5
    const cpoeNorm = normalize(ctx.cpoe, -4, 4);
    score += (cpoeNorm - 0.5) * 25;
    factors++;
  }

  if (ctx.pressureRateAllowed !== null) {
    // Pressure rate typically 20-40%
    const pressNorm = 1 - normalize(ctx.pressureRateAllowed, 0.20, 0.40);
    score += (pressNorm - 0.5) * 20;
    factors++;
  }

  // Clamp to valid range
  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Min-max normalization helper
 */
function normalize(value: number, min: number, max: number): number {
  if (max === min) return 0.5;
  return Math.max(0, Math.min(1, (value - min) / (max - min)));
}

export default {
  getTeamEnvironment,
  getAllTeamEnvironments,
};
