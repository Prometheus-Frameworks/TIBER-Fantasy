/**
 * RB Position Enrichment Handler
 * 
 * Enriches RB player data with rushing and receiving metrics.
 * Called during NFLfastR ingestion before database upsert.
 */

import type { WeeklyRow } from '../../shared/types/fantasy';

export interface EnrichmentResult {
  player: WeeklyRow;
  enriched: boolean;
  enrichments: string[];
}

/**
 * Enrich RB player with rushing and dual-threat metrics.
 * 
 * Future enhancements:
 * - RYOE (rush yards over expectation)
 * - Opportunity share calculation
 * - Goal line / red zone usage
 * - Receiving work share
 * - Efficiency metrics by game script
 */
export function enrichRB(player: WeeklyRow): EnrichmentResult {
  const enrichments: string[] = [];
  
  // Validate rushing fields
  if (player.rush_att !== undefined && player.rush_att > 0) {
    enrichments.push('rush_attempts_present');
    
    // Calculate YPC if we have yards
    if (player.rush_yd !== undefined) {
      const ypc = player.rush_yd / player.rush_att;
      if (ypc >= 5.0) {
        enrichments.push('elite_ypc');
      }
    }
  }
  
  // Check for receiving work (dual-threat)
  if (player.targets !== undefined && player.targets >= 3) {
    enrichments.push('receiving_role');
  }
  
  // Future: Add RYOE calculation
  // Future: Add opportunity share
  // Future: Add goal line usage metrics
  
  return {
    player,
    enriched: enrichments.length > 0,
    enrichments,
  };
}
