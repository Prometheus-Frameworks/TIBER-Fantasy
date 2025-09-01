/**
 * Production Safety Nets
 * 
 * Phase F: Caps, fallbacks, and confidence gating for production reliability
 * Ensures scoring system remains stable even with edge cases or bad data
 */

import { confidenceGating, clamp01 } from './math';

export interface SafetyConfig {
  fpg_caps: {
    QB: [number, number];  // [min, max] FPG bounds
    RB: [number, number];
    WR: [number, number];
    TE: [number, number];
  };
  score_caps: {
    min_overall_score: number;    // Minimum overall power score
    max_overall_score: number;    // Maximum overall power score
    confidence_floor: number;     // Minimum confidence level
  };
  upside_caps: {
    max_upside_index: number;     // Cap upside index at reasonable level
    rookie_penalty: number;       // Confidence penalty for rookies
  };
}

export const PRODUCTION_SAFETY_CONFIG: SafetyConfig = {
  fpg_caps: {
    QB: [8.0, 35.0],    // Reasonable QB FPG range
    RB: [6.0, 30.0],    // Reasonable RB FPG range  
    WR: [4.0, 28.0],    // Reasonable WR FPG range
    TE: [3.0, 22.0]     // Reasonable TE FPG range
  },
  score_caps: {
    min_overall_score: 20,    // Minimum viable fantasy player
    max_overall_score: 100,   // Perfect score cap
    confidence_floor: 0.6     // 60% minimum confidence
  },
  upside_caps: {
    max_upside_index: 95,     // Leave some room above 100 for true outliers
    rookie_penalty: 0.85      // 15% confidence penalty for rookies
  }
};

/**
 * Apply safety nets to player facts before scoring
 * @param facts Raw player facts
 * @param position Player position
 * @param config Safety configuration
 * @returns Capped and validated facts
 */
export function applySafetyNets(
  facts: any,
  position: 'QB' | 'RB' | 'WR' | 'TE',
  config: SafetyConfig = PRODUCTION_SAFETY_CONFIG
): any {
  
  const caps = config.fpg_caps[position];
  
  // Apply FPG caps
  const safeFPG = Math.max(caps[0], Math.min(caps[1], facts.fpg || 0));
  const safeXFPG = Math.max(caps[0], Math.min(caps[1], facts.xfpg || 0));
  const safeProjFPG = Math.max(caps[0], Math.min(caps[1], facts.proj_fpg || 0));
  
  // Apply upside caps
  const safeUpsideIndex = Math.max(0, Math.min(config.upside_caps.max_upside_index, facts.upside_index || 0));
  
  // Apply beat projection bounds (-100 to +100 is reasonable)
  const safeBeatProj = Math.max(0, Math.min(100, facts.beat_proj || 0));
  
  // Validate features object
  const safeFeatures = {
    ...facts.features,
    position,
    safety_applied: true,
    original_fpg: facts.fpg,
    capped_values: safeFPG !== facts.fpg || safeXFPG !== facts.xfpg || safeProjFPG !== facts.proj_fpg
  };
  
  return {
    ...facts,
    fpg: safeFPG,
    xfpg: safeXFPG,
    proj_fpg: safeProjFPG,
    beat_proj: safeBeatProj,
    upside_index: safeUpsideIndex,
    features: safeFeatures
  };
}

/**
 * Apply safety nets to final power scores
 * @param score Raw power score
 * @param config Safety configuration
 * @returns Capped and validated score
 */
export function applyScoreSafetyNets(
  score: any,
  config: SafetyConfig = PRODUCTION_SAFETY_CONFIG
): any {
  
  // Apply overall score caps
  const safeOverallScore = Math.max(
    config.score_caps.min_overall_score,
    Math.min(config.score_caps.max_overall_score, score.overall_score || 0)
  );
  
  // Apply confidence floor
  const safeConfidence = Math.max(config.score_caps.confidence_floor, score.confidence || 0);
  
  // Validate component scores (all should be 0-100)
  const safeComponents = {
    usage: clamp01(score.components.usage / 100) * 100,
    talent: clamp01(score.components.talent / 100) * 100,
    environment: clamp01(score.components.environment / 100) * 100,
    availability: clamp01(score.components.availability / 100) * 100,
    market_anchor: clamp01(score.components.market_anchor / 100) * 100
  };
  
  return {
    ...score,
    overall_score: safeOverallScore,
    confidence: safeConfidence,
    components: safeComponents,
    safety_nets_applied: true
  };
}

/**
 * Validate upside calculation for QBs specifically
 * @param qbMetrics QB rushing metrics
 * @returns Validation results
 */
export function validateQBUpsideCalculation(qbMetrics: {
  designedRunRate: number;
  scrambleYdsG: number;
  rzRushShare: number;
}): {
  valid: boolean;
  warnings: string[];
  adjusted_metrics?: any;
} {
  
  const warnings: string[] = [];
  let adjusted = { ...qbMetrics };
  
  // Validate designed run rate (0-40% is reasonable)
  if (qbMetrics.designedRunRate > 0.40) {
    warnings.push(`High designed run rate: ${qbMetrics.designedRunRate.toFixed(2)}`);
    adjusted.designedRunRate = 0.40;
  }
  
  if (qbMetrics.designedRunRate < 0) {
    warnings.push(`Negative designed run rate: ${qbMetrics.designedRunRate.toFixed(2)}`);
    adjusted.designedRunRate = 0;
  }
  
  // Validate scramble yards (0-50 yards/game is reasonable)
  if (qbMetrics.scrambleYdsG > 50) {
    warnings.push(`High scramble yards: ${qbMetrics.scrambleYdsG.toFixed(1)}`);
    adjusted.scrambleYdsG = 50;
  }
  
  if (qbMetrics.scrambleYdsG < 0) {
    warnings.push(`Negative scramble yards: ${qbMetrics.scrambleYdsG.toFixed(1)}`);
    adjusted.scrambleYdsG = 0;
  }
  
  // Validate red zone rush share (0-50% is reasonable)
  if (qbMetrics.rzRushShare > 0.50) {
    warnings.push(`High RZ rush share: ${qbMetrics.rzRushShare.toFixed(2)}`);
    adjusted.rzRushShare = 0.50;
  }
  
  if (qbMetrics.rzRushShare < 0) {
    warnings.push(`Negative RZ rush share: ${qbMetrics.rzRushShare.toFixed(2)}`);
    adjusted.rzRushShare = 0;
  }
  
  return {
    valid: warnings.length === 0,
    warnings,
    adjusted_metrics: warnings.length > 0 ? adjusted : undefined
  };
}

/**
 * Circuit breaker for data source failures
 * @param attempts Number of failed attempts
 * @param maxAttempts Maximum attempts before circuit opens
 * @returns Whether to continue trying
 */
export function circuitBreaker(attempts: number, maxAttempts: number = 3): boolean {
  return attempts < maxAttempts;
}

/**
 * Data quality checker for incoming data
 * @param data Raw data from external source
 * @param expectedFields Required fields
 * @returns Quality check results
 */
export function checkDataQuality(
  data: any,
  expectedFields: string[]
): {
  quality_score: number;  // 0-100 quality score
  missing_fields: string[];
  data_warnings: string[];
} {
  
  const missing = expectedFields.filter(field => !data[field]);
  const warnings: string[] = [];
  
  // Check for suspicious values
  if (data.fpg && (data.fpg < 0 || data.fpg > 50)) {
    warnings.push(`Suspicious FPG: ${data.fpg}`);
  }
  
  if (data.upside_index && (data.upside_index < 0 || data.upside_index > 100)) {
    warnings.push(`Invalid upside index: ${data.upside_index}`);
  }
  
  // Calculate quality score
  const completeness = (expectedFields.length - missing.length) / expectedFields.length;
  const reliability = warnings.length === 0 ? 1.0 : 0.7;
  
  const qualityScore = Math.round(completeness * reliability * 100);
  
  return {
    quality_score: qualityScore,
    missing_fields: missing,
    data_warnings: warnings
  };
}

/**
 * Emergency fallback values for when all data sources fail
 */
export const EMERGENCY_FALLBACKS = {
  QB: {
    fpg: 18.0,           // Reasonable QB baseline
    xfpg: 17.5,
    proj_fpg: 17.8,
    beat_proj: 50,       // Neutral
    upside_index: 45,    // Slightly below average (conservative)
    confidence: 0.6      // Lower confidence for fallback
  },
  RB: {
    fpg: 12.0,
    xfpg: 11.5,
    proj_fpg: 11.8,
    beat_proj: 50,
    upside_index: 50,
    confidence: 0.6
  },
  WR: {
    fpg: 10.0,
    xfpg: 9.5,
    proj_fpg: 9.8,
    beat_proj: 50,
    upside_index: 50,
    confidence: 0.6
  },
  TE: {
    fpg: 8.0,
    xfpg: 7.5,
    proj_fpg: 7.8,
    beat_proj: 50,
    upside_index: 50,
    confidence: 0.6
  }
} as const;