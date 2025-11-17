/**
 * Central NFL season configuration
 * 
 * Update CURRENT_NFL_SEASON when NFLfastR has reliable 2025 data available.
 * This controls:
 * - Default season for ingest scripts
 * - fetchSeasonToDate behavior
 * - Debug endpoint defaults
 * - Any cron/batch job season selection
 * 
 * @example
 * // When 2025 data is ready, simply update:
 * export const CURRENT_NFL_SEASON = 2025;
 */

export const CURRENT_NFL_SEASON = 2024;

/**
 * Seasons with known weekly stats availability in the database.
 * Update this as you ingest new season data.
 */
export const SEASONS_WITH_WEEKLY_DATA = [2024];

/**
 * Check if weekly stats are available for a given season
 */
export function hasWeeklyDataForSeason(season: number): boolean {
  return SEASONS_WITH_WEEKLY_DATA.includes(season);
}
