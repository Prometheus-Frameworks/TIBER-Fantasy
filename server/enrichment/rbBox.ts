/**
 * RB Position Enrichment Handler
 * 
 * Full 2025 RB metrics: RYOE, opportunity share, elusive rating,
 * breakaway rate, stuffed rate, yards after contact, and receiving metrics.
 */

export interface EnrichedRB {
  ryoe_per_carry: number | null;
  ryoe_total: number | null;
  opportunity_share: number | null;
  rush_share: number | null;
  target_share: number | null;
  elusive_rating: number | null;
  breakaway_rate: number | null;
  yards_per_route_run: number | null;
  receiving_epa_per_target: number | null;
  rz_carries: number;
  goal_line_carries: number;
  stuffed_rate: number | null;
  yco_attempt: number | null;
  [key: string]: any;
}

export const enrichRB = (p: any): EnrichedRB => {
  const carries = p.carries || p.rush_att || 0;
  const rushYds = p.rushing_yards || p.rush_yd || 0;
  const targets = p.targets || 0;
  const yardsAfterContact = p.yards_after_contact || p.yac_rushing || 0;
  const receivingEpa = p.receiving_epa || 0;

  return {
    ...p,
    ryoe_per_carry: p.ryoe_per_carry ?? p.rushing_yards_over_expected_per_attempt ?? null,
    ryoe_total: p.ryoe_total ?? p.rushing_yards_over_expected ?? null,
    opportunity_share: p.opportunity_share ?? null,
    rush_share: p.rush_share ?? null,
    target_share: p.target_share ?? p.targetShare ?? null,
    elusive_rating: p.elusive_rating ?? null,
    breakaway_rate: p.breakaway_rate ?? null,
    yards_per_route_run: p.yards_per_route_run ?? p.yprr ?? null,
    receiving_epa_per_target: targets > 0 ? receivingEpa / targets : null,
    rz_carries: p.rz_carries ?? p.rushing_rz_attempts ?? 0,
    goal_line_carries: p.goal_line_carries ?? 0,
    stuffed_rate: p.stuffed_rate ?? null,
    yco_attempt: carries > 0 ? yardsAfterContact / carries : null,
  };
};

export interface EnrichmentResult {
  player: EnrichedRB;
  enriched: boolean;
  enrichments: string[];
}

export function enrichRBWithMeta(player: any): EnrichmentResult {
  const enriched = enrichRB(player);
  const enrichments: string[] = [];
  
  if (enriched.ryoe_per_carry !== null) enrichments.push('ryoe');
  if (enriched.opportunity_share !== null) enrichments.push('opportunity_share');
  if (enriched.elusive_rating !== null) enrichments.push('elusive_rating');
  if (enriched.stuffed_rate !== null) enrichments.push('stuffed_rate');
  if (enriched.yco_attempt !== null) enrichments.push('yco_attempt');
  if (enriched.yards_per_route_run !== null) enrichments.push('yprr');
  
  return {
    player: enriched,
    enriched: enrichments.length > 0,
    enrichments,
  };
}
