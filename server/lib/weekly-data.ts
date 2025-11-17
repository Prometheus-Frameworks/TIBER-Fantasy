/**
 * Weekly data availability utilities
 * 
 * Provides guards and helpers for checking if weekly stats exist in the database
 * for a given season. Used to prevent queries against empty datasets and provide
 * user-friendly fallback messages.
 */

import { dbPool as pool } from '../infra/db';
import { CURRENT_NFL_SEASON, hasWeeklyDataForSeason } from '../../shared/config/seasons';

/**
 * Check if weekly stats exist in the database for a given season.
 * This queries the database directly to handle cases where data was ingested
 * but the static SEASONS_WITH_WEEKLY_DATA config hasn't been updated yet.
 * 
 * @param season - NFL season year (e.g., 2024, 2025)
 * @returns true if at least one weekly stat exists for the season
 */
export async function hasWeeklyData(season: number): Promise<boolean> {
  try {
    const result = await pool.query(
      `SELECT 1 FROM weekly_stats WHERE season = $1 LIMIT 1`,
      [season]
    );
    return result.rowCount !== null && result.rowCount > 0;
  } catch (error) {
    console.error(`[WeeklyData] Error checking availability for season ${season}:`, error);
    return false;
  }
}

/**
 * Get user-friendly error message when weekly data is not available
 * 
 * @param season - The season that was requested
 * @returns Error message object with user guidance
 */
export function getNoWeeklyDataMessage(season: number) {
  return {
    success: false,
    error: `I don't have weekly stats for the ${season} season yet. ` +
           `I do have full-season rankings and VORP for ${CURRENT_NFL_SEASON}, ` +
           `and full weekly stats for 2024 if you want historical context.`,
    availableSeasons: [2024],
    requestedSeason: season,
  };
}

export { CURRENT_NFL_SEASON };
