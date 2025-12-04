/**
 * IDP (Individual Defensive Player) Enrichment Handler
 * 
 * Full 2025 IDP metrics: tackles, TFL, sacks, QB hits, passes defended,
 * blitz rate, coverage snaps, pressure rate, and missed tackle rate.
 */

export interface EnrichedIDP {
  tackles_solo: number;
  tackles_assist: number;
  tfl: number;
  sacks: number;
  qb_hits: number;
  passes_defended: number;
  forced_fumbles: number;
  fumble_recoveries: number;
  interceptions: number;
  int_return_yards: number;
  blitz_rate: number | null;
  coverage_snaps: number | null;
  hurry_pct: number | null;
  pressure_rate: number | null;
  missed_tackle_rate: number | null;
  [key: string]: any;
}

export const enrichIDP = (p: any): EnrichedIDP => {
  return {
    ...p,
    tackles_solo: p.tackles_solo ?? p.solo_tackles ?? 0,
    tackles_assist: p.tackles_assist ?? p.assisted_tackles ?? 0,
    tfl: p.tfl ?? p.tackles_for_loss ?? 0,
    sacks: p.sacks ?? 0,
    qb_hits: p.qb_hits ?? 0,
    passes_defended: p.passes_defended ?? p.defensed_passes ?? 0,
    forced_fumbles: p.forced_fumbles ?? 0,
    fumble_recoveries: p.fumble_recoveries ?? 0,
    interceptions: p.interceptions ?? 0,
    int_return_yards: p.int_return_yards ?? 0,
    blitz_rate: p.blitz_rate ?? null,
    coverage_snaps: p.coverage_snaps ?? null,
    hurry_pct: p.hurry_pct ?? null,
    pressure_rate: p.pressure_rate ?? null,
    missed_tackle_rate: p.missed_tackle_rate ?? null,
  };
};

export interface EnrichmentResult {
  player: EnrichedIDP;
  enriched: boolean;
  enrichments: string[];
}

export function enrichIDPWithMeta(player: any): EnrichmentResult {
  const enriched = enrichIDP(player);
  const enrichments: string[] = [];
  
  if (enriched.sacks > 0) enrichments.push('sacks');
  if (enriched.tackles_solo > 0) enrichments.push('tackles');
  if (enriched.tfl > 0) enrichments.push('tfl');
  if (enriched.pressure_rate !== null) enrichments.push('pressure_rate');
  if (enriched.blitz_rate !== null) enrichments.push('blitz_rate');
  
  return {
    player: enriched,
    enriched: enrichments.length > 0,
    enrichments,
  };
}
