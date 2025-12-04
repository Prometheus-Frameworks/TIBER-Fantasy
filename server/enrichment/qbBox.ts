/**
 * QB Position Enrichment Handler
 * 
 * Full 2025 QB metrics: CPOE, dakota, PACR, aggression, time-to-throw,
 * pressured EPA, play-action EPA, red zone EPA, and completion percentages.
 */

export interface EnrichedQB {
  cpoe: number | null;
  dakota: number | null;
  pacr: number | null;
  aggression_pct: number | null;
  avg_time_to_throw: number | null;
  pressured_epa_per_dropback: number | null;
  play_action_epa: number | null;
  rz_passing_epa: number | null;
  completion_pct: number | null;
  ypa: number | null;
  adj_yards_per_attempt: number | null;
  qb_rating: number | null;
  [key: string]: any;
}

export const enrichQB = (p: any): EnrichedQB => {
  const att = p.passing_attempts || p.attempts || p.pass_att || 0;
  const comp = p.passing_completions || p.completions || 0;
  const airYds = p.passing_air_yards || p.air_yards || 0;
  const yds = p.passing_yards || p.pass_yd || 0;
  const passTds = p.passing_tds || p.pass_td || 0;
  const interceptions = p.interceptions || p.int || 0;

  return {
    ...p,
    cpoe: p.cpoe ?? null,
    dakota: p.dakota ?? null,
    pacr: airYds > 0 ? yds / airYds : null,
    aggression_pct: p.aggression_pct ?? p.aggression ?? null,
    avg_time_to_throw: p.avg_time_to_throw ?? p.time_to_throw ?? null,
    pressured_epa_per_dropback: p.pressured_epa ?? p.pressured_epa_per_dropback ?? null,
    play_action_epa: p.play_action_epa ?? null,
    rz_passing_epa: p.redzone_passing_epa ?? p.rz_passing_epa ?? null,
    completion_pct: att > 0 ? (comp / att) * 100 : null,
    ypa: att > 0 ? yds / att : null,
    adj_yards_per_attempt: att > 0 ? (yds + 20 * passTds - 45 * interceptions) / att : null,
    qb_rating: p.qb_rating ?? p.passer_rating ?? null,
  };
};

export interface EnrichmentResult {
  player: EnrichedQB;
  enriched: boolean;
  enrichments: string[];
}

export function enrichQBWithMeta(player: any): EnrichmentResult {
  const enriched = enrichQB(player);
  const enrichments: string[] = [];
  
  if (enriched.cpoe !== null) enrichments.push('cpoe');
  if (enriched.dakota !== null) enrichments.push('dakota');
  if (enriched.pacr !== null) enrichments.push('pacr');
  if (enriched.completion_pct !== null) enrichments.push('completion_pct');
  if (enriched.pressured_epa_per_dropback !== null) enrichments.push('pressured_epa');
  
  return {
    player: enriched,
    enriched: enrichments.length > 0,
    enrichments,
  };
}
