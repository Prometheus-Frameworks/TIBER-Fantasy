/**
 * FORGE Alpha Modifiers v0.1
 * 
 * Applies team environment and matchup context adjustments to rawAlpha
 * before calibration. This creates a modulation pipeline:
 * 
 *   rawAlpha → envAdjustedAlpha → matchupAdjustedAlpha → calibratedAlpha
 * 
 * The adjustments are multiplicative, meaning:
 * - envScore100 = 100 → +40% boost (at default w_env = 0.40)
 * - envScore100 = 50 → no change
 * - envScore100 = 0 → -40% penalty
 * 
 * Same logic applies to matchup scores.
 */

import type { 
  TeamEnvironment, 
  MatchupContext, 
  ForgeModifierWeights 
} from './types';
import { DEFAULT_FORGE_MODIFIER_WEIGHTS } from './types';

/**
 * Apply environment and matchup modifiers to rawAlpha
 * 
 * @param rawAlpha - Pre-calibration alpha score from FORGE engine
 * @param env - Team environment data (or null if unavailable)
 * @param matchup - Matchup context data (or null if unavailable)
 * @param weights - Modifier weights (defaults to DEFAULT_FORGE_MODIFIER_WEIGHTS)
 * @returns Adjusted alpha (still pre-calibration)
 */
export function applyForgeModifiers(
  rawAlpha: number,
  env: TeamEnvironment | null,
  matchup: MatchupContext | null,
  weights: ForgeModifierWeights = DEFAULT_FORGE_MODIFIER_WEIGHTS
): number {
  let adjusted = rawAlpha;

  // Apply environment modifier
  // envScore100 is 0-100 where 50 = neutral
  // We convert to ~[-1, +1] range: (score / 50) - 1
  // At score=100: (100/50)-1 = +1 → multiply by 1 + (0.40 * 1) = 1.40
  // At score=50:  (50/50)-1 = 0 → multiply by 1 + (0.40 * 0) = 1.00
  // At score=0:   (0/50)-1 = -1 → multiply by 1 + (0.40 * -1) = 0.60
  if (env && typeof env.envScore100 === 'number') {
    const envNorm = (env.envScore100 / 50) - 1; // ~[-1, +1]
    adjusted *= (1 + weights.w_env * envNorm);
  }

  // Apply matchup modifier
  // Same logic as environment
  if (matchup && typeof matchup.matchupScore100 === 'number') {
    const muNorm = (matchup.matchupScore100 / 50) - 1;
    adjusted *= (1 + weights.w_mu * muNorm);
  }

  // Safety bounds - prevent negative or infinite values
  if (!Number.isFinite(adjusted) || adjusted < 0) {
    adjusted = 0;
  }

  return adjusted;
}

/**
 * Get a descriptive label for an environment score
 */
export function getEnvScoreLabel(score: number): string {
  if (score >= 75) return 'elite';
  if (score >= 60) return 'good';
  if (score >= 40) return 'average';
  if (score >= 25) return 'below average';
  return 'poor';
}

/**
 * Get a descriptive label for a matchup score
 */
export function getMatchupScoreLabel(score: number): string {
  if (score >= 75) return 'smash';      // Elite matchup
  if (score >= 60) return 'favorable';
  if (score >= 40) return 'neutral';
  if (score >= 25) return 'tough';
  return 'avoid';                        // Very difficult matchup
}

/**
 * Calculate the combined modifier effect
 * Returns the multiplier that would be applied to rawAlpha
 */
export function calculateModifierEffect(
  env: TeamEnvironment | null,
  matchup: MatchupContext | null,
  weights: ForgeModifierWeights = DEFAULT_FORGE_MODIFIER_WEIGHTS
): {
  envMultiplier: number;
  matchupMultiplier: number;
  combinedMultiplier: number;
} {
  let envMultiplier = 1.0;
  let matchupMultiplier = 1.0;

  if (env && typeof env.envScore100 === 'number') {
    const envNorm = (env.envScore100 / 50) - 1;
    envMultiplier = 1 + weights.w_env * envNorm;
  }

  if (matchup && typeof matchup.matchupScore100 === 'number') {
    const muNorm = (matchup.matchupScore100 / 50) - 1;
    matchupMultiplier = 1 + weights.w_mu * muNorm;
  }

  return {
    envMultiplier,
    matchupMultiplier,
    combinedMultiplier: envMultiplier * matchupMultiplier,
  };
}

export default {
  applyForgeModifiers,
  getEnvScoreLabel,
  getMatchupScoreLabel,
  calculateModifierEffect,
};
