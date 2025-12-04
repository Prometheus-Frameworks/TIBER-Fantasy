/**
 * WR/TE Position Enrichment Handler
 * 
 * Full 2025 receiver metrics: WOPR, RACR, cushion, xyac_epa, slot rate,
 * contested catch rate, target share, air yards share, and TE-specific metrics.
 */

export interface EnrichedWR {
  wopr_x: number | null;
  racr: number | null;
  target_share: number | null;
  air_yards_share: number | null;
  yac_per_reception: number | null;
  aypt: number | null;
  ypt: number | null;
  xyac_epa: number | null;
  cushion_avg: number | null;
  separation_pct: number | null;
  slot_rate: number | null;
  contested_catch_rate: number | null;
  rz_targets: number;
  end_zone_targets: number;
  is_te?: boolean;
  inline_rate?: number | null;
  yprr?: number | null;
  [key: string]: any;
}

export const enrichWR = (p: any): EnrichedWR => {
  const targets = p.targets || 0;
  const rec = p.receptions || p.rec || 0;
  const air = p.receiving_air_yards || p.air_yards || p.airYards || 0;
  const recYds = p.receiving_yards || p.rec_yd || p.recYards || 0;
  const yac = p.receiving_yards_after_catch || p.yac || 0;

  const enriched: EnrichedWR = {
    ...p,
    wopr_x: p.wopr_x ?? p.wopr ?? null,
    racr: air > 0 ? recYds / air : null,
    target_share: p.target_share ?? p.targetShare ?? null,
    air_yards_share: p.air_yards_share ?? p.airYardsShare ?? null,
    yac_per_reception: rec > 0 ? yac / rec : null,
    aypt: targets > 0 ? air / targets : null,
    ypt: targets > 0 ? recYds / targets : null,
    xyac_epa: p.xyac_epa ?? null,
    cushion_avg: p.cushion ?? p.cushion_avg ?? null,
    separation_pct: p.separation_pct ?? p.separation ?? null,
    slot_rate: p.slot_rate ?? null,
    contested_catch_rate: p.contested_catch_rate ?? null,
    rz_targets: p.rz_targets ?? p.receiving_rz_target ?? 0,
    end_zone_targets: p.end_zone_targets ?? 0,
  };

  // Auto-split TE vs WR for downstream boxes
  if (p.position === 'TE') {
    enriched.is_te = true;
    enriched.inline_rate = p.inline_rate ?? null;
    enriched.yprr = p.yards_per_route_run ?? p.yprr ?? null;
  }

  return enriched;
};

export const enrichTE = enrichWR;

export interface EnrichmentResult {
  player: EnrichedWR;
  enriched: boolean;
  enrichments: string[];
}

export function enrichWRWithMeta(player: any): EnrichmentResult {
  const enriched = enrichWR(player);
  const enrichments: string[] = [];
  
  if (enriched.wopr_x !== null) enrichments.push('wopr_x');
  if (enriched.racr !== null) enrichments.push('racr');
  if (enriched.target_share !== null) enrichments.push('target_share');
  if (enriched.xyac_epa !== null) enrichments.push('xyac_epa');
  if (enriched.cushion_avg !== null) enrichments.push('cushion');
  if (enriched.separation_pct !== null) enrichments.push('separation');
  if (enriched.slot_rate !== null) enrichments.push('slot_rate');
  if (enriched.is_te) enrichments.push('te_metrics');
  
  return {
    player: enriched,
    enriched: enrichments.length > 0,
    enrichments,
  };
}
