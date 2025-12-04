/**
 * QB Position Enrichment Handler
 * 
 * Enriches QB player data with position-specific metrics and validations.
 * Called during NFLfastR ingestion before database upsert.
 */

import type { WeeklyRow } from '../../shared/types/fantasy';

export interface EnrichmentResult {
  player: WeeklyRow;
  enriched: boolean;
  enrichments: string[];
}

/**
 * Enrich QB player with position-specific calculations and validations.
 * 
 * Future enhancements:
 * - Pressure-adjusted EPA
 * - Clean pocket vs pressure splits
 * - Red zone efficiency metrics
 * - Play-action vs dropback splits
 */
export function enrichQB(player: WeeklyRow): EnrichmentResult {
  const enrichments: string[] = [];
  
  // Validate required QB fields exist
  if (player.pass_yd !== undefined && player.pass_yd > 0) {
    enrichments.push('pass_yards_present');
  }
  
  // Future: Add CPOE validation
  // Future: Add EPA normalization
  // Future: Add pressure-adjusted metrics
  
  return {
    player,
    enriched: enrichments.length > 0,
    enrichments,
  };
}
