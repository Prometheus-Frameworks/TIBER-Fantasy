/**
 * IDP (Individual Defensive Player) Enrichment Handler
 * 
 * Enriches defensive player data with IDP-specific metrics.
 * Called during NFLfastR ingestion before database upsert.
 * 
 * Note: IDP is a future enhancement - currently stub implementation.
 */

import type { WeeklyRow } from '../../shared/types/fantasy';

export interface EnrichmentResult {
  player: WeeklyRow;
  enriched: boolean;
  enrichments: string[];
}

/**
 * Enrich defensive player with IDP-specific metrics.
 * 
 * Future enhancements:
 * - Solo vs assisted tackle breakdown
 * - Pressure rate calculation
 * - Coverage metrics
 * - Snap count by alignment
 * - Pass rush win rate
 */
export function enrichIDP(player: WeeklyRow): EnrichmentResult {
  const enrichments: string[] = [];
  
  // IDP is currently not a priority for fantasy (skill positions only)
  // This is a placeholder for future IDP league support
  
  // Future: Add tackle metrics
  // Future: Add sack/pressure metrics
  // Future: Add coverage metrics
  
  return {
    player,
    enriched: false,
    enrichments,
  };
}
