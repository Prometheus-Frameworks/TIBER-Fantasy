/**
 * WR/TE Position Enrichment Handler
 * 
 * Enriches WR and TE player data with receiving-specific metrics.
 * Called during NFLfastR ingestion before database upsert.
 */

import type { WeeklyRow } from '../../shared/types/fantasy';

export interface EnrichmentResult {
  player: WeeklyRow;
  enriched: boolean;
  enrichments: string[];
}

/**
 * Enrich WR/TE player with receiving-specific calculations.
 * 
 * Future enhancements:
 * - WOPR calculation (weighted opportunity rating)
 * - RACR calculation (receiver air conversion ratio)
 * - Target quality metrics
 * - Route-running efficiency
 * - Contested catch rate
 */
export function enrichWR(player: WeeklyRow): EnrichmentResult {
  const enrichments: string[] = [];
  
  // Validate receiving fields
  if (player.targets !== undefined && player.targets > 0) {
    enrichments.push('targets_present');
    
    // Calculate catch rate if we have both rec and targets
    if (player.rec !== undefined) {
      const catchRate = player.rec / player.targets;
      if (catchRate >= 0.75) {
        enrichments.push('high_catch_rate');
      }
    }
  }
  
  // Check for air yards / depth of target
  if (player.routes !== undefined && player.routes > 0) {
    enrichments.push('route_data_present');
  }
  
  // Future: Add WOPR calculation
  // Future: Add target share normalization
  // Future: Add YAC vs air yards split
  
  return {
    player,
    enriched: enrichments.length > 0,
    enrichments,
  };
}

/**
 * Alias for TE enrichment (uses same logic as WR)
 */
export const enrichTE = enrichWR;
