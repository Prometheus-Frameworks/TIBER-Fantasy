/**
 * Fantasy Points Enrichment Handler
 * 
 * Auto-calculates fantasy points for all scoring formats:
 * - Standard (non-PPR)
 * - Half-PPR (0.5 per reception)
 * - Full PPR (1.0 per reception)
 * 
 * Includes hooks for projection model integration.
 */

export interface EnrichedFantasy {
  fantasy_points_standard: number;
  fantasy_points_half_ppr: number;
  fantasy_points_ppr: number;
  fantasy_rank_standard: number | null;
  fantasy_rank_ppr: number | null;
  projected_points_ppr: number | null;
  [key: string]: any;
}

export const enrichFantasy = (p: any): EnrichedFantasy => {
  const passTd = p.passing_tds ?? p.pass_td ?? 0;
  const rushTd = p.rushing_tds ?? p.rush_td ?? 0;
  const recTd = p.receiving_tds ?? p.rec_td ?? 0;
  const rec = p.receptions ?? p.rec ?? 0;
  const rushYds = p.rushing_yards ?? p.rush_yd ?? 0;
  const recYds = p.receiving_yards ?? p.rec_yd ?? 0;
  const passYds = p.passing_yards ?? p.pass_yd ?? 0;
  const interceptions = p.interceptions ?? p.int ?? 0;
  const fumbles = p.fumbles ?? p.fumbles_lost ?? 0;
  const twoPt = p.two_pt ?? p.two_point_conversions ?? 0;

  // Standard scoring formula
  const standard = 
    passYds / 25 +           // 0.04 per passing yard
    passTd * 4 +             // 4 per passing TD
    rushYds / 10 +           // 0.1 per rushing yard
    rushTd * 6 +             // 6 per rushing TD
    recYds / 10 +            // 0.1 per receiving yard
    recTd * 6 +              // 6 per receiving TD
    twoPt * 2 -              // 2 per 2-pt conversion
    interceptions * 2 -      // -2 per INT
    fumbles * 2;             // -2 per fumble

  const ppr = standard + rec * 1;       // +1 per reception
  const halfPpr = standard + rec * 0.5; // +0.5 per reception

  return {
    ...p,
    fantasy_points_standard: Number(standard.toFixed(2)),
    fantasy_points_half_ppr: Number(halfPpr.toFixed(2)),
    fantasy_points_ppr: Number(ppr.toFixed(2)),
    fantasy_rank_standard: null,   // Filled by ranking job
    fantasy_rank_ppr: null,        // Filled by ranking job
    projected_points_ppr: null,    // Hook for projection model
  };
};

export interface EnrichmentResult {
  player: EnrichedFantasy;
  enriched: boolean;
  enrichments: string[];
}

export function enrichFantasyWithMeta(player: any): EnrichmentResult {
  const enriched = enrichFantasy(player);
  const enrichments: string[] = ['fantasy_standard', 'fantasy_half', 'fantasy_ppr'];
  
  return {
    player: enriched,
    enriched: true,
    enrichments,
  };
}
