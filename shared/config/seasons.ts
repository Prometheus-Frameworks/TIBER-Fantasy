/**
 * Central NFL season configuration
 * 
 * This controls:
 * - Default season for ingest scripts
 * - fetchSeasonToDate behavior
 * - Debug endpoint defaults
 * - Any cron/batch job season selection
 * 
 * Updated: Nov 17, 2025 - Migrated to nflreadpy, 2025 Weeks 1-11 available
 */

export const CURRENT_NFL_SEASON = 2025;

/**
 * Seasons with known weekly stats availability in the database.
 * Update this as you ingest new season data.
 */
export const SEASONS_WITH_WEEKLY_DATA = [2024, 2025];

/**
 * Check if weekly stats are available for a given season
 */
export function hasWeeklyDataForSeason(season: number): boolean {
  return SEASONS_WITH_WEEKLY_DATA.includes(season);
}
