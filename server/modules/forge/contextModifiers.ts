/**
 * FORGE Context Modifiers v0.2
 * 
 * Provides environment and matchup score adjustments for FORGE alpha.
 * Uses safe, clamped multipliers to prevent extreme swings.
 * 
 * Pipeline: rawAlpha → envAdjustedAlpha → matchupAdjustedAlpha → finalAlpha
 */

export interface ForgeEnvInputs {
  rawAlpha: number;           // calibrated alpha, typically 25–90
  envScore: number | null;    // 0–100, offense environment
  wEnv?: number;              // default 0.15
}

export interface ForgeEnvOutput {
  baseAlpha: number;
  envAdjustedAlpha: number;
  envMultiplier: number;
}

/**
 * Apply offensive environment modifier to rawAlpha
 * 
 * Formula: envFactor = 1 + wEnv * (envScore/50 - 1)
 * - envScore = 50 → factor = 1.0 (neutral)
 * - envScore = 80 with wEnv = 0.15 → factor = 1.09 (small buff)
 * - envScore = 20 with wEnv = 0.15 → factor = 0.91 (small nerf)
 * 
 * Result is clamped to [25, 90] to stay within FORGE band.
 */
export function applyForgeEnvModifier({
  rawAlpha,
  envScore,
  wEnv = 0.15,
}: ForgeEnvInputs): ForgeEnvOutput {
  const baseAlpha = rawAlpha;

  const safeScore = (score: number | null | undefined): number => {
    if (score == null || Number.isNaN(score)) return 50; // neutral env
    return Math.max(0, Math.min(100, score));
  };

  const env = safeScore(envScore);

  // score in [0,100] → factor around 1.0
  // factor = 1 + wEnv * (env/50 - 1)
  const envFactor = 1 + wEnv * (env / 50 - 1);

  let envAdjusted = baseAlpha * envFactor;

  // Clamp to sane FORGE band
  const clamp = (v: number, min: number, max: number) =>
    Math.max(min, Math.min(max, v));

  envAdjusted = clamp(envAdjusted, 25, 90);

  return {
    baseAlpha,
    envAdjustedAlpha: Math.round(envAdjusted * 100) / 100,
    envMultiplier: Math.round(envFactor * 1000) / 1000,
  };
}

/**
 * Get environment label based on score
 */
export function getEnvLabel(score: number | null): string {
  if (score === null) return 'unknown';
  if (score >= 70) return 'elite';
  if (score >= 55) return 'good';
  if (score >= 45) return 'average';
  if (score >= 30) return 'below_avg';
  return 'poor';
}

/**
 * Matchup modifier types
 */
export interface ForgeMatchupInputs {
  alphaAfterEnv: number;        // already env-adjusted alpha
  matchupScore: number | null;  // 0–100, defense vs position (higher = easier matchup)
  wMatchup?: number;            // default 0.25
}

export interface ForgeMatchupOutput {
  envAdjustedAlpha: number;
  finalAlpha: number;
  matchupMultiplier: number;
}

/**
 * Apply matchup modifier on top of env-adjusted alpha
 * 
 * Formula: matchupFactor = 1 + wMatchup * (matchupScore/50 - 1)
 * - matchupScore = 50 → factor = 1.0 (neutral)
 * - matchupScore = 75 with wMatchup = 0.25 → factor = 1.125 (easy matchup buff)
 * - matchupScore = 25 with wMatchup = 0.25 → factor = 0.875 (tough matchup nerf)
 * 
 * Result is clamped to [25, 90] to stay within FORGE band.
 */
export function applyForgeMatchupModifier({
  alphaAfterEnv,
  matchupScore,
  wMatchup = 0.25,
}: ForgeMatchupInputs): ForgeMatchupOutput {
  const safeScore = (score: number | null | undefined): number => {
    if (score == null || Number.isNaN(score)) return 50; // neutral matchup
    return Math.max(0, Math.min(100, score));
  };

  const mu = safeScore(matchupScore);

  // matchupScore [0,100] → factor around 1.0
  const muFactor = 1 + wMatchup * (mu / 50 - 1);

  const clamp = (v: number, min: number, max: number) =>
    Math.max(min, Math.min(max, v));

  const envAdjustedAlpha = clamp(alphaAfterEnv, 25, 90);
  let finalAlpha = envAdjustedAlpha * muFactor;
  finalAlpha = clamp(finalAlpha, 25, 90);

  return {
    envAdjustedAlpha,
    finalAlpha: Math.round(finalAlpha * 100) / 100,
    matchupMultiplier: Math.round(muFactor * 1000) / 1000,
  };
}

/**
 * Get matchup label based on score
 */
export function getMatchupLabel(score: number | null): string {
  if (score === null) return 'unknown';
  if (score >= 70) return 'smash';      // very easy matchup
  if (score >= 55) return 'favorable';
  if (score >= 45) return 'neutral';
  if (score >= 30) return 'tough';
  return 'shadow';  // very tough matchup
}

export default {
  applyForgeEnvModifier,
  applyForgeMatchupModifier,
  getEnvLabel,
  getMatchupLabel,
};
