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

/**
 * Get current NFL week based on season start date
 * NFL seasons typically start the first Tuesday after Labor Day (first Monday in September)
 * 
 * @param season - NFL season year (default: CURRENT_NFL_SEASON)
 * @returns Current week number (1-18) or null if before season start
 */
export function getCurrentNFLWeek(season: number = CURRENT_NFL_SEASON): number | null {
  // NFL 2025 Season Start: September 4, 2025 (Week 1)
  // Each week is 7 days
  const seasonStartDates: Record<number, string> = {
    2024: '2024-09-05', // Thursday, Sept 5, 2024
    2025: '2025-09-04', // Thursday, Sept 4, 2025
  };

  const startDateStr = seasonStartDates[season];
  if (!startDateStr) {
    console.warn(`[getCurrentNFLWeek] No start date configured for season ${season}`);
    return null;
  }

  const seasonStart = new Date(startDateStr);
  const now = new Date();

  // If before season start, return null
  if (now < seasonStart) {
    return null;
  }

  // Calculate weeks elapsed
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  const msSinceStart = now.getTime() - seasonStart.getTime();
  const weeksElapsed = Math.floor(msSinceStart / msPerWeek);

  // NFL has 18 weeks
  const currentWeek = Math.min(weeksElapsed + 1, 18);
  
  return currentWeek;
}
