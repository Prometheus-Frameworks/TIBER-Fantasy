/**
 * Position Enrichment Module
 * 
 * Barrel export for all position-specific enrichment handlers.
 * Used during NFLfastR data ingestion to apply position-aware logic.
 * 
 * 2025 Pro-Grade Metrics:
 * - QB: CPOE, dakota, PACR, pressured EPA, play-action EPA
 * - WR/TE: WOPR, RACR, cushion, xyac_epa, slot rate, contested catch
 * - RB: RYOE, opportunity share, elusive rating, stuffed rate
 * - IDP: tackles, TFL, sacks, QB hits, pressure rate
 * - Fantasy: auto-calculated Standard/Half/PPR points
 */

export { enrichQB, enrichQBWithMeta, type EnrichedQB } from './qbBox';
export { enrichWR, enrichTE, enrichWRWithMeta, type EnrichedWR } from './wrBox';
export { enrichRB, enrichRBWithMeta, type EnrichedRB } from './rbBox';
export { enrichIDP, enrichIDPWithMeta, type EnrichedIDP } from './idpBox';
export { enrichFantasy, enrichFantasyWithMeta, type EnrichedFantasy } from './fantasyBox';

import type { WeeklyRow } from '../../shared/types/fantasy';
import { enrichQBWithMeta, type EnrichedQB } from './qbBox';
import { enrichWRWithMeta, type EnrichedWR } from './wrBox';
import { enrichRBWithMeta, type EnrichedRB } from './rbBox';
import { enrichIDPWithMeta, type EnrichedIDP } from './idpBox';

export type EnrichedPlayer = EnrichedQB | EnrichedWR | EnrichedRB | EnrichedIDP;

export interface EnrichmentResult {
  player: EnrichedPlayer | WeeklyRow;
  enriched: boolean;
  enrichments: string[];
}

/**
 * Route a player to the appropriate enrichment handler based on position.
 * Returns the enriched player data with metadata about what was enriched.
 */
export function enrichByPosition(player: WeeklyRow): EnrichmentResult {
  const pos = player.position;
  
  switch (pos) {
    case 'QB':
      return enrichQBWithMeta(player);
    case 'WR':
      return enrichWRWithMeta(player);
    case 'TE':
      return enrichWRWithMeta(player); // Uses WR enrichment with TE-specific fields
    case 'RB':
      return enrichRBWithMeta(player);
    default:
      // Unknown position or defensive player
      if (['DL', 'LB', 'DB', 'DE', 'DT', 'CB', 'S'].includes(pos as string)) {
        return enrichIDPWithMeta(player);
      }
      // Return unchanged for unknown positions
      return {
        player,
        enriched: false,
        enrichments: [],
      };
  }
}
