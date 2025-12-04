/**
 * Position Enrichment Module
 * 
 * Barrel export for all position-specific enrichment handlers.
 * Used during NFLfastR data ingestion to apply position-aware logic.
 */

export { enrichQB } from './qbBox';
export { enrichWR, enrichTE } from './wrBox';
export { enrichRB } from './rbBox';
export { enrichIDP } from './idpBox';

export type { EnrichmentResult } from './qbBox';

import type { WeeklyRow } from '../../shared/types/fantasy';
import type { EnrichmentResult } from './qbBox';
import { enrichQB } from './qbBox';
import { enrichWR, enrichTE } from './wrBox';
import { enrichRB } from './rbBox';
import { enrichIDP } from './idpBox';

/**
 * Route a player to the appropriate enrichment handler based on position.
 * Returns the enriched player data with metadata about what was enriched.
 */
export function enrichByPosition(player: WeeklyRow): EnrichmentResult {
  const pos = player.position;
  
  switch (pos) {
    case 'QB':
      return enrichQB(player);
    case 'WR':
      return enrichWR(player);
    case 'TE':
      return enrichTE(player);
    case 'RB':
      return enrichRB(player);
    default:
      // Unknown position or defensive player
      if (['DL', 'LB', 'DB', 'DE', 'DT', 'CB', 'S'].includes(pos as string)) {
        return enrichIDP(player);
      }
      // Return unchanged for unknown positions
      return {
        player,
        enriched: false,
        enrichments: [],
      };
  }
}
