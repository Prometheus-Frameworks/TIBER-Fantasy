/**
 * NFLfastR Metrics Registry
 * 
 * Defines which metrics belong to which position groups and modules.
 * Used for position-aware routing during data ingestion.
 */

export type PositionGroup = 'QB' | 'RB' | 'WR' | 'TE' | 'DL' | 'LB' | 'DB';
export type ModuleName = 'qb' | 'rb' | 'wr' | 'idp' | 'fantasy';

export interface MetricDef {
  position: readonly PositionGroup[];
  module: ModuleName;
  description?: string;
}

export const METRIC_REGISTRY = {
  // QB Metrics
  passing_epa:          { position: ['QB'] as const,               module: 'qb' as const,      description: 'Expected points added on pass attempts' },
  cpoe:                 { position: ['QB'] as const,               module: 'qb' as const,      description: 'Completion percentage over expectation' },
  dakota:               { position: ['QB'] as const,               module: 'qb' as const,      description: 'QB rating model combining EPA + CPOE' },
  pacr:                 { position: ['QB'] as const,               module: 'qb' as const,      description: 'Passing Air Conversion Ratio' },
  aggression:           { position: ['QB'] as const,               module: 'qb' as const,      description: 'Aggressiveness on throws' },
  bad_throw_pct:        { position: ['QB'] as const,               module: 'qb' as const,      description: 'Percentage of poorly thrown passes' },

  // WR / TE Receiving Metrics
  wopr_x:               { position: ['WR', 'TE'] as const,         module: 'wr' as const,      description: 'Weighted Opportunity Rating' },
  racr:                 { position: ['WR', 'TE'] as const,         module: 'wr' as const,      description: 'Receiver Air Conversion Ratio' },
  target_share:         { position: ['WR', 'TE', 'RB'] as const,   module: 'wr' as const,      description: 'Team target share percentage' },
  air_yards_share:      { position: ['WR', 'TE'] as const,         module: 'wr' as const,      description: 'Share of team air yards' },
  yac_epa:              { position: ['WR', 'TE', 'RB'] as const,   module: 'wr' as const,      description: 'EPA from yards after catch' },
  xyac_epa:             { position: ['WR', 'TE', 'RB'] as const,   module: 'wr' as const,      description: 'Expected YAC EPA' },
  adot:                 { position: ['WR', 'TE'] as const,         module: 'wr' as const,      description: 'Average depth of target' },

  // RB Rushing Metrics
  rushing_epa:          { position: ['RB', 'QB'] as const,         module: 'rb' as const,      description: 'Expected points added on rushes' },
  ryoe:                 { position: ['RB'] as const,               module: 'rb' as const,      description: 'Rush yards over expectation' },
  ryoe_per_carry:       { position: ['RB'] as const,               module: 'rb' as const,      description: 'RYOE per rushing attempt' },
  opportunity_share:    { position: ['RB'] as const,               module: 'rb' as const,      description: 'Share of team rushing opportunities' },
  rush_success_rate:    { position: ['RB', 'QB'] as const,         module: 'rb' as const,      description: 'Percentage of successful rushes' },

  // IDP / Defensive Metrics
  sacks:                { position: ['DL', 'LB'] as const,         module: 'idp' as const,     description: 'Total sacks' },
  tackles_solo:         { position: ['LB', 'DB', 'DL'] as const,   module: 'idp' as const,     description: 'Solo tackles' },
  tackles_combined:     { position: ['LB', 'DB', 'DL'] as const,   module: 'idp' as const,     description: 'Combined tackles' },
  tackles_for_loss:     { position: ['DL', 'LB'] as const,         module: 'idp' as const,     description: 'Tackles for loss' },
  pass_defended:        { position: ['DB', 'LB'] as const,         module: 'idp' as const,     description: 'Passes defended' },
  qb_hits:              { position: ['DL', 'LB'] as const,         module: 'idp' as const,     description: 'QB hits' },
  forced_fumbles:       { position: ['DL', 'LB', 'DB'] as const,   module: 'idp' as const,     description: 'Forced fumbles' },

  // Fantasy Points (applies to skill positions)
  fantasy_points_std:   { position: ['QB', 'RB', 'WR', 'TE'] as const, module: 'fantasy' as const, description: 'Standard fantasy points' },
  fantasy_points_half:  { position: ['QB', 'RB', 'WR', 'TE'] as const, module: 'fantasy' as const, description: 'Half-PPR fantasy points' },
  fantasy_points_ppr:   { position: ['QB', 'RB', 'WR', 'TE'] as const, module: 'fantasy' as const, description: 'Full PPR fantasy points' },
} as const;

export type MetricName = keyof typeof METRIC_REGISTRY;

/**
 * Get all metrics for a specific position
 */
export function getMetricsForPosition(pos: PositionGroup): MetricName[] {
  return (Object.entries(METRIC_REGISTRY) as [MetricName, MetricDef][])
    .filter(([_, def]) => def.position.includes(pos))
    .map(([name]) => name);
}

/**
 * Get all metrics for a specific module
 */
export function getMetricsForModule(mod: ModuleName): MetricName[] {
  return (Object.entries(METRIC_REGISTRY) as [MetricName, MetricDef][])
    .filter(([_, def]) => def.module === mod)
    .map(([name]) => name);
}

/**
 * Check if a metric applies to a given position
 */
export function metricAppliesToPosition(metric: MetricName, pos: PositionGroup): boolean {
  const def = METRIC_REGISTRY[metric];
  return def ? (def.position as readonly string[]).includes(pos) : false;
}
