/**
 * Feature Registry - Single Source of Truth for All Data Contracts
 * 
 * Phase A: Data Contracts (what Tiber expects)
 * Every feature has: id, entity, position, unit, scale, freshness, source, description
 */

export type Scale = 'raw' | 'pct' | 'z' | '0_100';
export type Freshness = 'live' | 'daily' | 'weekly';

export interface FeatureSpec {
  id: string;                 // "qb.designed_run_rate"
  entity: 'player' | 'team';
  position?: 'QB' | 'RB' | 'WR' | 'TE' | 'ANY';
  unit: string;               // "%", "points", "per route", etc.
  scale: Scale;               // how it's delivered to scoring
  freshness: Freshness;       // expected cadence
  source: string;             // "Sleeper", "nflfastR", "DeepSeek", "OASIS", "FP ECR"
  description: string;
}

/**
 * Comprehensive Feature Registry
 * 
 * Core FPG System: Fantasy points per game as the foundation
 * Advanced Analytics: Position-specific metrics for upside detection
 * Environment Context: Team and situational factors
 * Market Signals: External consensus and projections
 */
export const Features: FeatureSpec[] = [
  // Core FPG System
  { 
    id: 'core.fpg', 
    entity: 'player', 
    position: 'ANY', 
    unit: 'points', 
    scale: 'raw', 
    freshness: 'weekly', 
    source: 'Sleeper', 
    description: 'Fantasy points per game (OTC PPR)' 
  },
  { 
    id: 'core.xfpg', 
    entity: 'player', 
    position: 'ANY', 
    unit: 'points', 
    scale: 'raw', 
    freshness: 'weekly', 
    source: 'DeepSeek', 
    description: 'Expected fantasy points from usage' 
  },
  { 
    id: 'core.proj_fpg', 
    entity: 'player', 
    position: 'ANY', 
    unit: 'points', 
    scale: 'raw', 
    freshness: 'weekly', 
    source: 'Projections', 
    description: 'External projection' 
  },

  // QB-Specific Advanced Metrics
  { 
    id: 'qb.designed_run_rate', 
    entity: 'player', 
    position: 'QB', 
    unit: '% dropbacks', 
    scale: 'pct', 
    freshness: 'weekly', 
    source: 'nflfastR', 
    description: 'Designed QB runs share' 
  },
  { 
    id: 'qb.scramble_yds_g', 
    entity: 'player', 
    position: 'QB', 
    unit: 'yd/g', 
    scale: 'raw', 
    freshness: 'weekly', 
    source: 'nflfastR', 
    description: 'Scramble yards per game' 
  },
  { 
    id: 'qb.rz_rush_share', 
    entity: 'player', 
    position: 'QB', 
    unit: '% team RZ rushes', 
    scale: 'pct', 
    freshness: 'weekly', 
    source: 'nflfastR', 
    description: 'Red zone rushing share' 
  },
  { 
    id: 'qb.explosive_rate', 
    entity: 'player', 
    position: 'QB', 
    unit: '% plays', 
    scale: 'pct', 
    freshness: 'weekly', 
    source: 'nflfastR', 
    description: 'Explosive play rate (20+ yard plays)' 
  },

  // RB-Specific Advanced Metrics
  { 
    id: 'rb.inside10_share', 
    entity: 'player', 
    position: 'RB', 
    unit: '% team inside-10 opps', 
    scale: 'pct', 
    freshness: 'weekly', 
    source: 'nflfastR', 
    description: 'Goal-line access' 
  },
  { 
    id: 'rb.snap_share', 
    entity: 'player', 
    position: 'RB', 
    unit: '% snaps', 
    scale: 'pct', 
    freshness: 'weekly', 
    source: 'nflfastR', 
    description: 'Offensive snap share' 
  },
  { 
    id: 'rb.target_share', 
    entity: 'player', 
    position: 'RB', 
    unit: '% targets', 
    scale: 'pct', 
    freshness: 'weekly', 
    source: 'nflfastR', 
    description: 'Receiving target share' 
  },

  // WR-Specific Advanced Metrics
  { 
    id: 'wr.targets_per_route', 
    entity: 'player', 
    position: 'WR', 
    unit: '%', 
    scale: 'pct', 
    freshness: 'weekly', 
    source: 'nflfastR', 
    description: 'Earning targets' 
  },
  { 
    id: 'wr.air_yards_share', 
    entity: 'player', 
    position: 'WR', 
    unit: '% team air yards', 
    scale: 'pct', 
    freshness: 'weekly', 
    source: 'nflfastR', 
    description: 'Air yards opportunity' 
  },
  { 
    id: 'wr.slot_rate', 
    entity: 'player', 
    position: 'WR', 
    unit: '% snaps', 
    scale: 'pct', 
    freshness: 'weekly', 
    source: 'nflfastR', 
    description: 'Slot alignment rate' 
  },

  // TE-Specific Advanced Metrics
  { 
    id: 'te.blocking_rate', 
    entity: 'player', 
    position: 'TE', 
    unit: '% snaps', 
    scale: 'pct', 
    freshness: 'weekly', 
    source: 'nflfastR', 
    description: 'Pass blocking engagement' 
  },
  { 
    id: 'te.route_participation', 
    entity: 'player', 
    position: 'TE', 
    unit: '% routes', 
    scale: 'pct', 
    freshness: 'weekly', 
    source: 'nflfastR', 
    description: 'Route running participation' 
  },

  // Environment Context
  { 
    id: 'env.oasis', 
    entity: 'team', 
    position: 'ANY', 
    unit: 'index', 
    scale: '0_100', 
    freshness: 'weekly', 
    source: 'OASIS', 
    description: 'Pace/PROE/OL/QB stability' 
  },
  { 
    id: 'env.pace', 
    entity: 'team', 
    position: 'ANY', 
    unit: 'plays/g', 
    scale: 'raw', 
    freshness: 'weekly', 
    source: 'nflfastR', 
    description: 'Offensive pace (plays per game)' 
  },
  { 
    id: 'env.pass_rate', 
    entity: 'team', 
    position: 'ANY', 
    unit: '%', 
    scale: 'pct', 
    freshness: 'weekly', 
    source: 'nflfastR', 
    description: 'Team pass rate' 
  },

  // Market Signals
  { 
    id: 'mkt.ecr_rank', 
    entity: 'player', 
    position: 'ANY', 
    unit: 'rank', 
    scale: 'raw', 
    freshness: 'weekly', 
    source: 'FantasyPros', 
    description: 'Expert consensus rank' 
  },
  { 
    id: 'mkt.ownership', 
    entity: 'player', 
    position: 'ANY', 
    unit: '%', 
    scale: 'pct', 
    freshness: 'weekly', 
    source: 'Sleeper', 
    description: 'League ownership percentage' 
  },
  { 
    id: 'mkt.trade_volume', 
    entity: 'player', 
    position: 'ANY', 
    unit: 'trades/week', 
    scale: 'raw', 
    freshness: 'weekly', 
    source: 'Sleeper', 
    description: 'Trade activity volume' 
  }
];

/**
 * Feature Registry Utilities
 */

// Get features by position
export function getFeaturesByPosition(position: 'QB' | 'RB' | 'WR' | 'TE'): FeatureSpec[] {
  return Features.filter(f => f.position === position || f.position === 'ANY');
}

// Get features by source
export function getFeaturesBySource(source: string): FeatureSpec[] {
  return Features.filter(f => f.source === source);
}

// Get feature by ID
export function getFeature(id: string): FeatureSpec | undefined {
  return Features.find(f => f.id === id);
}

// Get all core FPG features
export function getCoreFPGFeatures(): FeatureSpec[] {
  return Features.filter(f => f.id.startsWith('core.'));
}

// Get position-specific upside features
export function getUpsideFeatures(position: 'QB' | 'RB' | 'WR' | 'TE'): FeatureSpec[] {
  return Features.filter(f => 
    f.position === position && 
    (f.id.includes('run') || f.id.includes('upside') || f.id.includes('explosive'))
  );
}

// Validate feature specification
export function validateFeatureSpec(spec: FeatureSpec): string[] {
  const errors: string[] = [];
  
  if (!spec.id || !spec.id.includes('.')) {
    errors.push('Feature ID must be in format "category.metric"');
  }
  
  if (!spec.description || spec.description.length < 10) {
    errors.push('Feature description must be at least 10 characters');
  }
  
  if (spec.scale === 'pct' && !spec.unit.includes('%')) {
    errors.push('Percentage features should have "%" in unit');
  }
  
  return errors;
}

export default Features;