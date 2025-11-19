/**
 * Advanced Metric Registry
 * 
 * Centralizes which advanced metrics TIBER has access to, preventing hallucinations
 * while allowing knowledgeable users to see available data.
 */

export type MetricTier = 'tier1' | 'tier2' | 'tier3';

export interface MetricDefinition {
  name: string;
  tier: MetricTier;
  meaningTag: string;        // 3-5 word plain language interpretation
  source?: string;           // Where the data comes from
  availableFor: string[];    // Positions this metric applies to
  refusalMessage?: string;   // What to say when unavailable
}

/**
 * TIER DEFINITIONS:
 * 
 * Tier 1 (Core): Always available, cite freely
 * - VORP, PPG, Rankings, Total Points
 * 
 * Tier 2 (Advanced Available): Real data we have access to
 * - Show when user asks for "advanced metrics" or explicitly requests
 * - Always pair with meaning tag
 * 
 * Tier 3 (Unavailable): Data we don't have
 * - Explicitly refuse with helpful redirect
 */

export const ADVANCED_METRIC_REGISTRY: Record<string, MetricDefinition> = {
  // ═══════════════════════════════════════════════════════════════
  // TIER 2: ADVANCED METRICS WE HAVE
  // ═══════════════════════════════════════════════════════════════
  
  'epa_per_target': {
    name: 'EPA per target',
    tier: 'tier2',
    meaningTag: 'strong efficiency',
    source: 'NFLfastR play-by-play',
    availableFor: ['WR', 'TE', 'RB'],
  },
  
  'epa_per_play': {
    name: 'EPA per play',
    tier: 'tier2',
    meaningTag: 'overall efficiency',
    source: 'NFLfastR play-by-play',
    availableFor: ['QB', 'RB', 'WR', 'TE'],
  },
  
  'wopr': {
    name: 'WOPR',
    tier: 'tier2',
    meaningTag: 'true featured role',
    source: 'NFLfastR target/air yards',
    availableFor: ['WR', 'TE'],
  },
  
  'racr': {
    name: 'RACR',
    tier: 'tier2',
    meaningTag: 'actual vs expected yards',
    source: 'NFLfastR air yards',
    availableFor: ['WR', 'TE'],
  },
  
  'pacr': {
    name: 'PACR',
    tier: 'tier2',
    meaningTag: 'catches per opportunity',
    source: 'NFLfastR targets',
    availableFor: ['WR', 'TE'],
  },
  
  'air_yards_share': {
    name: 'Air yards share',
    tier: 'tier2',
    meaningTag: 'downfield involvement',
    source: 'NFLfastR air yards',
    availableFor: ['WR', 'TE'],
  },
  
  'yac_epa': {
    name: 'YAC EPA',
    tier: 'tier2',
    meaningTag: 'after-catch value',
    source: 'NFLfastR play-by-play',
    availableFor: ['WR', 'TE', 'RB'],
  },
  
  'cpoe': {
    name: 'CPOE',
    tier: 'tier2',
    meaningTag: 'accuracy over expected',
    source: 'NFLfastR play-by-play',
    availableFor: ['QB'],
  },
  
  'success_rate': {
    name: 'Success rate',
    tier: 'tier2',
    meaningTag: 'consistent positive plays',
    source: 'NFLfastR play-by-play',
    availableFor: ['QB', 'RB', 'WR', 'TE'],
  },
  
  // ═══════════════════════════════════════════════════════════════
  // TIER 3: METRICS WE DON'T HAVE (YET)
  // ═══════════════════════════════════════════════════════════════
  
  'snap_share': {
    name: 'Snap share',
    tier: 'tier3',
    meaningTag: '',
    availableFor: ['QB', 'RB', 'WR', 'TE'],
    refusalMessage: "I don't have 2025 snap share data yet",
  },
  
  'route_participation': {
    name: 'Route participation',
    tier: 'tier3',
    meaningTag: '',
    availableFor: ['WR', 'TE'],
    refusalMessage: "I don't have 2025 route participation data yet",
  },
  
  'target_share': {
    name: 'Target share',
    tier: 'tier3',
    meaningTag: '',
    availableFor: ['WR', 'TE', 'RB'],
    refusalMessage: "I don't have 2025 target share data yet",
  },
  
  'red_zone_usage': {
    name: 'Red zone usage',
    tier: 'tier3',
    meaningTag: '',
    availableFor: ['RB', 'WR', 'TE'],
    refusalMessage: "I don't have 2025 red zone usage data yet",
  },
  
  'touches_per_game': {
    name: 'Touches per game',
    tier: 'tier3',
    meaningTag: '',
    availableFor: ['RB'],
    refusalMessage: "I don't have 2025 touches per game data yet",
  },
};

/**
 * Get all Tier 2 (available) metrics for a position
 */
export function getAvailableMetrics(position: string): MetricDefinition[] {
  return Object.values(ADVANCED_METRIC_REGISTRY).filter(
    metric => metric.tier === 'tier2' && metric.availableFor.includes(position)
  );
}

/**
 * Get all Tier 3 (unavailable) metrics for a position
 */
export function getUnavailableMetrics(position: string): MetricDefinition[] {
  return Object.values(ADVANCED_METRIC_REGISTRY).filter(
    metric => metric.tier === 'tier3' && metric.availableFor.includes(position)
  );
}

/**
 * Check if a specific metric is available
 */
export function isMetricAvailable(metricKey: string): boolean {
  const metric = ADVANCED_METRIC_REGISTRY[metricKey];
  return metric?.tier === 'tier2';
}

/**
 * Get meaning tag for a metric
 */
export function getMeaningTag(metricKey: string): string {
  return ADVANCED_METRIC_REGISTRY[metricKey]?.meaningTag || '';
}

/**
 * Detect if user is asking for advanced metrics
 */
export function isAdvancedMetricsRequest(query: string): boolean {
  const advancedPatterns = [
    /advanced (?:metrics|stats|data)/i,
    /show me (?:the )?(?:epa|wopr|racr|pacr|cpoe)/i,
    /what'?s (?:his|her|their) (?:epa|wopr|racr|snap share|target share)/i,
    /efficiency (?:metrics|stats)/i,
    /underlying (?:metrics|stats|data)/i,
  ];
  
  return advancedPatterns.some(pattern => pattern.test(query));
}
