/**
 * RAG (Red/Amber/Green) Scoring System
 * 
 * Position-aware FPG-centric scoring with floor/ceiling calculations
 * and intelligent upside bias for rushing QBs
 */

import { clamp01 } from '../data/math';

export interface RAGInput {
  pos: 'QB' | 'RB' | 'WR' | 'TE';
  xfpg_pts: number;        // EWMA(3w) expected from usage (forward)
  proj_pts: number;        // External projections (market sanity)
  form_pts: number;        // Recent truth (EWMA 3w)
  oppMultiplier: number;   // 0.85-1.15 from SOS hook
  availability: number;    // 0.85-1.00 from practice trend
  roleVolatility: number;  // 0-1, stddev of snaps/routes/attempts (3w)
  teamVolatility: number;  // 0-1, pace/PROE swings (OASIS)
  injuryRisk: number;      // 0-1, Q tag trend / recent DNP
  qbStabilityPenalty: number; // 0-1, for WR/TE when QB changed
  upsideIndex: number;     // 0-100, rushing upside for QBs
  beatProj0_100: number;   // 0-100, beat projection rate
  posMedianPts: number;    // Position median points this week
  posStdPts: number;       // Position std dev points this week
  posP40: number;          // Position 40th percentile this week
}

export interface RAGOutput {
  mu: number;              // Expected points
  floor: number;           // Floor points (mu - 1.0*sigma)
  ceiling: number;         // Ceiling points (mu + 1.0*sigma)
  score: number;           // RAG score (0-100)
  color: 'GREEN' | 'AMBER' | 'RED'; // Color coding
  upside_boost: number;    // Points added from upside bias
  base_score: number;      // Score before upside boost
  risk: number;            // Overall risk factor (0-1)
  sigma: number;           // Variance in points
}

/**
 * Position spreads for variance calculation (empirical)
 */
const POS_SPREADS = {
  QB: 5,
  RB: 6, 
  WR: 7,
  TE: 5
} as const;

/**
 * Core RAG computation function
 * @param input RAG calculation inputs
 * @returns Complete RAG analysis
 */
export function computeRAG(input: RAGInput): RAGOutput {
  
  // 1) Build weekly expected points "mu"
  const rawMu = (
    0.50 * input.xfpg_pts +     // EWMA(3w) expected from usage
    0.35 * input.proj_pts +     // External projections
    0.15 * input.form_pts       // Recent truth
  );
  
  const mu = rawMu * input.oppMultiplier * input.availability;
  
  // 2) Estimate variance (sigma) for floor/ceiling
  const risk = (
    0.40 * input.roleVolatility +      // Role stability
    0.20 * input.teamVolatility +      // Team pace/PROE swings
    0.20 * input.injuryRisk +          // Injury concerns
    0.20 * input.qbStabilityPenalty    // QB change penalty
  );
  
  const sigma = risk * POS_SPREADS[input.pos];
  const floor = mu - 1.0 * sigma;
  const ceiling = mu + 1.0 * sigma;
  
  // 3) Upside bias (especially for rushing QBs)
  const upsideBoost = Math.min(4, 
    8 * (input.upsideIndex / 100) * 
    (0.4 + 0.6 * Math.max(0, input.beatProj0_100) / 100)
  );
  
  // 4) Convert to rag_score (0-100) + color
  const z = (mu - input.posMedianPts) / (input.posStdPts || 1);
  const baseScore = clamp01(0.5 + 0.2 * z) * 100;
  const ragScore = Math.max(0, Math.min(100, baseScore + upsideBoost));
  
  // 5) Color rules (per position this week)
  let color: 'GREEN' | 'AMBER' | 'RED';
  if (ragScore >= 66 || floor >= input.posP40) {
    color = 'GREEN';
  } else if (ragScore >= 40) {
    color = 'AMBER';
  } else {
    color = 'RED';
  }
  
  return {
    mu,
    floor,
    ceiling,
    score: ragScore,
    color,
    upside_boost: upsideBoost,
    base_score: baseScore,
    risk,
    sigma
  };
}

/**
 * Calculate position distribution statistics for league-relative scoring
 * @param players Array of players for the position
 * @param extractFPG Function to extract FPG value from player
 * @returns Position statistics
 */
export function calculatePositionDistribution(
  players: any[],
  extractFPG: (player: any) => number
): {
  median: number;
  std: number;
  p40: number;  // 40th percentile
  count: number;
} {
  
  if (players.length === 0) {
    return { median: 15, std: 5, p40: 12, count: 0 }; // Safe fallbacks
  }
  
  const fpgValues = players
    .map(extractFPG)
    .filter(fpg => fpg > 0)
    .sort((a, b) => a - b);
  
  if (fpgValues.length === 0) {
    return { median: 15, std: 5, p40: 12, count: 0 };
  }
  
  // Calculate median
  const mid = Math.floor(fpgValues.length / 2);
  const median = fpgValues.length % 2 === 0 
    ? (fpgValues[mid - 1] + fpgValues[mid]) / 2
    : fpgValues[mid];
  
  // Calculate standard deviation
  const mean = fpgValues.reduce((sum, val) => sum + val, 0) / fpgValues.length;
  const variance = fpgValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / fpgValues.length;
  const std = Math.sqrt(variance);
  
  // Calculate 40th percentile
  const p40Index = Math.floor(0.4 * fpgValues.length);
  const p40 = fpgValues[p40Index] || fpgValues[0];
  
  return {
    median,
    std: Math.max(1, std), // Minimum std of 1 to avoid division by zero
    p40,
    count: fpgValues.length
  };
}

/**
 * Generate reasoning array for UI display
 * @param input RAG inputs
 * @param output RAG outputs  
 * @returns Array of reason strings
 */
export function generateRAGReasons(input: RAGInput, output: RAGOutput): string[] {
  const reasons: string[] = [];
  
  // Upside-related reasons
  if (input.pos === 'QB' && input.upsideIndex > 60) {
    reasons.push('Rushing QB (+upside)');
  }
  
  if (input.beatProj0_100 > 60) {
    reasons.push('Beating projections');
  }
  
  // Matchup reasons
  if (input.oppMultiplier > 1.05) {
    reasons.push('Good matchup');
  } else if (input.oppMultiplier < 0.95) {
    reasons.push('Tough matchup');
  }
  
  // Availability reasons
  if (input.availability < 0.90) {
    reasons.push('Availability risk');
  }
  
  // Volatility reasons
  if (input.roleVolatility > 0.7) {
    reasons.push('Role uncertainty');
  }
  
  if (input.teamVolatility > 0.7) {
    reasons.push('Team pace volatility');
  }
  
  if (input.injuryRisk > 0.6) {
    reasons.push('Injury concerns');
  }
  
  if (input.qbStabilityPenalty > 0.3) {
    reasons.push('QB change impact');
  }
  
  // Score-based reasons
  if (output.score >= 75) {
    reasons.push('Elite weekly outlook');
  } else if (output.score <= 30) {
    reasons.push('Concerning outlook');
  }
  
  return reasons;
}

/**
 * Validate RAG calculation results
 * @param output RAG output
 * @returns Validation results
 */
export function validateRAGOutput(output: RAGOutput): {
  valid: boolean;
  warnings: string[];
} {
  const warnings: string[] = [];
  
  // Basic bounds checking
  if (output.score < 0 || output.score > 100) {
    warnings.push(`Invalid RAG score: ${output.score}`);
  }
  
  if (output.floor > output.ceiling) {
    warnings.push(`Floor (${output.floor.toFixed(1)}) > Ceiling (${output.ceiling.toFixed(1)})`);
  }
  
  if (output.mu < 0) {
    warnings.push(`Negative expected points: ${output.mu.toFixed(1)}`);
  }
  
  if (output.upside_boost > 4.1) {
    warnings.push(`Excessive upside boost: ${output.upside_boost.toFixed(2)}`);
  }
  
  return {
    valid: warnings.length === 0,
    warnings
  };
}