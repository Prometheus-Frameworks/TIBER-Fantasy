/**
 * FORGE Matchup Service v0.1
 * 
 * Provides position-specific matchup scores that measure how easy/hard
 * a defense is for fantasy production. Higher scores = easier matchup.
 * 
 * Data Sources:
 * - team_defensive_context: pass_epa_allowed, rush_epa_allowed, pressure_rate_generated
 * - bronze_nflfastr_plays: explosive plays, YAC allowed
 * - Aggregated fantasy points allowed by position
 * 
 * Score Formulas by Position:
 * 
 * WR: 0.30*pass_epa + 0.20*explosive_pass + 0.20*yac + 0.15*(1-pressure) + 0.15*fpts
 * RB: 0.40*rush_epa + 0.25*fpts + 0.20*(1-pressure) + 0.15*explosive_rush
 * TE: 0.35*pass_epa + 0.30*fpts + 0.20*yac + 0.15*(1-pressure)
 * QB: Defaults to 50 (neutral) for v0.1
 */

import { db } from '../../infra/db';
import { eq, and } from 'drizzle-orm';
import { forgeTeamMatchupContext, teamDefensiveContext, ForgeTeamMatchupContext } from '@shared/schema';
import type { MatchupContext, PlayerPosition } from './types';

const LEAGUE_AVG_MATCHUP_SCORE = 50;

/**
 * Get matchup context for a specific offense vs defense by position
 */
export async function getMatchupContext(
  season: number,
  week: number,
  offenseTeam: string,
  defenseTeam: string,
  position: PlayerPosition
): Promise<MatchupContext> {
  try {
    // First try cached forge_team_matchup_context table
    const cached = await db
      .select()
      .from(forgeTeamMatchupContext)
      .where(
        and(
          eq(forgeTeamMatchupContext.season, season),
          eq(forgeTeamMatchupContext.week, week),
          eq(forgeTeamMatchupContext.defenseTeam, defenseTeam),
          eq(forgeTeamMatchupContext.position, position)
        )
      )
      .limit(1);

    if (cached.length > 0) {
      const row = cached[0];
      return {
        season,
        week,
        offenseTeam,
        defenseTeam,
        position,
        matchupScore100: row.matchupScore100 ?? LEAGUE_AVG_MATCHUP_SCORE,
        metrics: {
          defPassEpaPerAttempt: row.defPassEpaPerAttempt ?? undefined,
          defRushEpaPerRush: row.defRushEpaPerRush ?? undefined,
          defPressureRate: row.defPressureRate ?? undefined,
          defYacPerCompletion: row.defYacPerCompletion ?? undefined,
          defExplosivePassRateAllowed: row.defExplosivePassRateAllowed ?? undefined,
          defExplosiveRushRateAllowed: row.defExplosiveRushRateAllowed ?? undefined,
          fantasyPtsAllowedPerGame: row.fantasyPtsAllowedPerGame ?? undefined,
        },
      };
    }

    // Fallback: compute from team_defensive_context
    const defCtx = await db
      .select()
      .from(teamDefensiveContext)
      .where(
        and(
          eq(teamDefensiveContext.season, season),
          eq(teamDefensiveContext.week, week),
          eq(teamDefensiveContext.team, defenseTeam)
        )
      )
      .limit(1);

    if (defCtx.length > 0) {
      const ctx = defCtx[0];
      const matchupScore = computeMatchupScoreFromContext(ctx, position);
      return {
        season,
        week,
        offenseTeam,
        defenseTeam,
        position,
        matchupScore100: matchupScore,
        metrics: {
          defPassEpaPerAttempt: ctx.passEpaAllowed ?? undefined,
          defRushEpaPerRush: ctx.rushEpaAllowed ?? undefined,
          defPressureRate: ctx.pressureRateGenerated ?? undefined,
        },
      };
    }

    // No data available - return league average
    return {
      season,
      week,
      offenseTeam,
      defenseTeam,
      position,
      matchupScore100: LEAGUE_AVG_MATCHUP_SCORE,
    };
  } catch (err) {
    console.error(`[FORGE/Matchup] Error fetching matchup for ${defenseTeam} vs ${position}:`, err);
    return {
      season,
      week,
      offenseTeam,
      defenseTeam,
      position,
      matchupScore100: LEAGUE_AVG_MATCHUP_SCORE,
    };
  }
}

/**
 * Get all matchup contexts for a defense team for all positions
 */
export async function getDefenseMatchups(
  season: number,
  week: number,
  defenseTeam: string
): Promise<Record<PlayerPosition, number>> {
  const positions: PlayerPosition[] = ['WR', 'RB', 'TE', 'QB'];
  const result: Record<PlayerPosition, number> = {
    WR: LEAGUE_AVG_MATCHUP_SCORE,
    RB: LEAGUE_AVG_MATCHUP_SCORE,
    TE: LEAGUE_AVG_MATCHUP_SCORE,
    QB: LEAGUE_AVG_MATCHUP_SCORE,
  };

  try {
    const rows = await db
      .select()
      .from(forgeTeamMatchupContext)
      .where(
        and(
          eq(forgeTeamMatchupContext.season, season),
          eq(forgeTeamMatchupContext.week, week),
          eq(forgeTeamMatchupContext.defenseTeam, defenseTeam)
        )
      );

    for (const row of rows) {
      const pos = row.position as PlayerPosition;
      if (positions.includes(pos)) {
        result[pos] = row.matchupScore100 ?? LEAGUE_AVG_MATCHUP_SCORE;
      }
    }
  } catch (err) {
    console.error(`[FORGE/Matchup] Error fetching defense matchups:`, err);
  }

  return result;
}

/**
 * Compute matchup score from team_defensive_context data
 * Uses position-specific formulas
 */
function computeMatchupScoreFromContext(
  ctx: {
    passEpaAllowed: number | null;
    rushEpaAllowed: number | null;
    pressureRateGenerated: number | null;
    explosive20PlusAllowed: number | null;
    ypaAllowed: number | null;
  },
  position: PlayerPosition
): number {
  let score = 50; // League average baseline

  switch (position) {
    case 'WR':
      score = computeWRMatchupScore(ctx);
      break;
    case 'RB':
      score = computeRBMatchupScore(ctx);
      break;
    case 'TE':
      score = computeTEMatchupScore(ctx);
      break;
    case 'QB':
      // QB defaults to 50 for v0.1
      score = 50;
      break;
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

function computeWRMatchupScore(ctx: {
  passEpaAllowed: number | null;
  pressureRateGenerated: number | null;
  explosive20PlusAllowed: number | null;
}): number {
  let score = 50;
  let factors = 0;

  // Pass EPA allowed (higher = worse defense = better matchup)
  // Range: -0.2 to +0.2
  if (ctx.passEpaAllowed !== null) {
    const epaNorm = normalize(ctx.passEpaAllowed, -0.15, 0.15);
    score += (epaNorm - 0.5) * 30; // 0.30 weight * 100
    factors++;
  }

  // Pressure rate (lower = worse defense = better matchup for WR)
  // Range: 15% to 40%
  if (ctx.pressureRateGenerated !== null) {
    const pressNorm = 1 - normalize(ctx.pressureRateGenerated, 0.15, 0.40);
    score += (pressNorm - 0.5) * 15;
    factors++;
  }

  // Explosive plays allowed
  if (ctx.explosive20PlusAllowed !== null) {
    const explNorm = normalize(ctx.explosive20PlusAllowed, 2, 8);
    score += (explNorm - 0.5) * 20;
    factors++;
  }

  return score;
}

function computeRBMatchupScore(ctx: {
  rushEpaAllowed: number | null;
  pressureRateGenerated: number | null;
  explosive20PlusAllowed: number | null;
}): number {
  let score = 50;

  // Rush EPA allowed (higher = worse run defense = better matchup)
  // Range: -0.2 to +0.1
  if (ctx.rushEpaAllowed !== null) {
    const epaNorm = normalize(ctx.rushEpaAllowed, -0.15, 0.10);
    score += (epaNorm - 0.5) * 40;
  }

  // Pressure rate (defensive front quality proxy)
  if (ctx.pressureRateGenerated !== null) {
    const pressNorm = 1 - normalize(ctx.pressureRateGenerated, 0.15, 0.40);
    score += (pressNorm - 0.5) * 20;
  }

  return score;
}

function computeTEMatchupScore(ctx: {
  passEpaAllowed: number | null;
  pressureRateGenerated: number | null;
}): number {
  let score = 50;

  // Pass EPA allowed (same as WR but weighted differently)
  if (ctx.passEpaAllowed !== null) {
    const epaNorm = normalize(ctx.passEpaAllowed, -0.15, 0.15);
    score += (epaNorm - 0.5) * 35;
  }

  // Pressure rate
  if (ctx.pressureRateGenerated !== null) {
    const pressNorm = 1 - normalize(ctx.pressureRateGenerated, 0.15, 0.40);
    score += (pressNorm - 0.5) * 15;
  }

  return score;
}

/**
 * Min-max normalization helper
 */
function normalize(value: number, min: number, max: number): number {
  if (max === min) return 0.5;
  return Math.max(0, Math.min(1, (value - min) / (max - min)));
}

export default {
  getMatchupContext,
  getDefenseMatchups,
};
