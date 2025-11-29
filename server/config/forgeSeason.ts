/**
 * FORGE Season Configuration
 * 
 * Central config for current NFL season used by FORGE rebuild pipelines.
 * Update this at the start of each new season.
 */

export const FORGE_DEFAULT_SEASON = 2025;

export function getForgeSeason(fromEnv = true): number {
  if (fromEnv && process.env.FORGE_SEASON) {
    return Number(process.env.FORGE_SEASON);
  }
  return FORGE_DEFAULT_SEASON;
}

export function getCurrentNFLWeek(): number {
  const seasonStart = new Date('2025-09-04');
  const now = new Date();
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  const weeksSinceStart = Math.floor((now.getTime() - seasonStart.getTime()) / msPerWeek);
  return Math.max(1, Math.min(18, weeksSinceStart + 1));
}
