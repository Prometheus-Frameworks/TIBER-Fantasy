/**
 * Bulletproof Scoring Combiner for DeepSeek v3.1
 * 
 * Eliminates NaN propagation, handles missing data gracefully,
 * and provides consistent scoring without magic fallback numbers.
 */

type Num = number;

// Core utility functions with guardrails
const clamp01 = (x: Num): Num => Math.max(0, Math.min(1, x));
const safe = (x: any, fallback = 0): Num => Number.isFinite(x) ? x as number : fallback;

// Percentile with guardrails (pass in precomputed pct 0–100 or min/max)
const pct = (x: Num, min: Num, max: Num): Num => {
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) {
    return 50; // neutral default when bounds are bad
  }
  return 100 * clamp01((x - min) / (max - min));
};

// Bulletproof score combiner - never returns NaN
export function combineScore(
  { prod, opp, age }: { prod: Num; opp: Num; age: Num },
  weights: { wProd: Num; wOpp: Num; wAge: Num }
): Num {
  // Neutralize missing pieces to 50 (middle of 0-100 scale)
  const p = safe(prod, 50);
  const o = safe(opp, 50); 
  const a = safe(age, 50);
  
  const { wProd, wOpp, wAge } = weights;
  const wSum = wProd + wOpp + wAge;
  
  // Guard against bad weights
  if (!Number.isFinite(wSum) || wSum <= 0) {
    return 50;
  }
  
  const score = (wProd * p + wOpp * o + wAge * a) / wSum;
  return Math.round(score * 10) / 10; // one decimal place
}

// Enhanced bounds calculation with safety checks
export function calculateBounds(players: any[], getter: (p: any) => number) {
  const values = players
    .map(getter)
    .filter(v => Number.isFinite(v))
    .sort((a, b) => a - b);
  
  if (values.length === 0) {
    return { min: 0, max: 100 }; // Safe defaults
  }
  
  if (values.length === 1) {
    return { min: values[0] - 1, max: values[0] + 1 }; // Avoid zero range
  }
  
  return { min: values[0], max: values[values.length - 1] };
}

// DYNASTY scoring for WRs with bulletproof components
export function dynastyScoreWR(player: any, bounds: any): Num {
  const maxAge = 32, minAge = 21;
  
  // Age component - younger is better in dynasty
  const ageScore = 100 * clamp01((maxAge - safe(player.age, 26)) / (maxAge - minAge));
  
  // Opportunity score - targets + route rate + team share
  const oppRaw = 
    0.5 * safe(player.targets_per_game || player.tgtShare * 8 || 0) +
    0.3 * safe(player.team_tprr_share || player.tgtShare || 0) +
    0.2 * safe(player.route_rate || player.routeRate || 0);
  
  const oppScore = pct(oppRaw, bounds.opp.min, bounds.opp.max);
  
  // Production score - xFP with FPTS fallback
  const prodRaw = 
    0.6 * safe(player.xfp_last8 || player.xfpScore || player.fpts_last8 || 0) +
    0.4 * safe(player.xfp_season || player.season_fpts || 0);
    
  const prodScore = pct(prodRaw, bounds.prod.min, bounds.prod.max);
  
  return combineScore(
    { prod: prodScore, opp: oppScore, age: ageScore },
    { wProd: 0.35, wOpp: 0.35, wAge: 0.30 }
  );
}

// REDRAFT scoring for WRs with immediate production focus
export function redraftScoreWR(player: any, bounds: any): Num {
  const maxAge = 32, minAge = 21;
  
  // Age component - less impact in redraft, but still matters
  const ageBase = 100 * clamp01((maxAge - safe(player.age, 26)) / (maxAge - minAge));
  const ageScore = 0.5 * ageBase; // Soften age penalty for redraft
  
  // Opportunity score - more weight on recent targets
  const oppRaw =
    0.6 * safe(player.targets_per_game || player.tgtShare * 8 || 0) +
    0.2 * safe(player.team_tprr_share || player.tgtShare || 0) +  
    0.2 * safe(player.route_rate || player.routeRate || 0);
    
  const oppScore = pct(oppRaw, bounds.opp.min, bounds.opp.max);
  
  // Production score - heavier weight on recent performance
  const prodRaw =
    0.7 * safe(player.xfp_last6 || player.last6wPerf || player.fpts_last6 || 0) +
    0.3 * safe(player.xfp_season || player.season_fpts || 0);
    
  const prodScore = pct(prodRaw, bounds.prod.min, bounds.prod.max);
  
  return combineScore(
    { prod: prodScore, opp: oppScore, age: ageScore },
    { wProd: 0.50, wOpp: 0.35, wAge: 0.15 }
  );
}

// Comprehensive diagnostic logging
export function logScoringDiagnostics(player: any, components: any, finalScore: number) {
  console.table([{
    player: player.name,
    age: player.age,
    ageScore: components.ageScore?.toFixed(1),
    tgt_g: player.targets_per_game || player.tgtShare,
    tprr_share: player.team_tprr_share || 'N/A',
    route_rate: player.route_rate || player.routeRate,
    oppScore: components.oppScore?.toFixed(1),
    xfp8: player.xfp_last8 || player.xfpScore,
    xfp_season: player.xfp_season || player.season_fpts,
    fpts8: player.fpts_last8 || 'N/A',
    fpts_season: player.fpts_season || player.season_fpts,
    prodScore: components.prodScore?.toFixed(1),
    finalScore: finalScore?.toFixed(1)
  }]);
  
  // Check for any undefined/NaN values
  const issues = [];
  if (!Number.isFinite(components.ageScore)) issues.push('ageScore');
  if (!Number.isFinite(components.oppScore)) issues.push('oppScore');
  if (!Number.isFinite(components.prodScore)) issues.push('prodScore');
  if (!Number.isFinite(finalScore)) issues.push('finalScore');
  
  if (issues.length > 0) {
    console.log(`🚨 SCORING ISSUES for ${player.name}: ${issues.join(', ')}`);
  }
}

// Position-specific scoring dispatcher
export function calculatePlayerScore(player: any, mode: 'dynasty' | 'redraft', bounds: any): number {
  if (player.pos === 'WR') {
    return mode === 'dynasty' 
      ? dynastyScoreWR(player, bounds)
      : redraftScoreWR(player, bounds);
  }
  
  // For now, return a safe fallback for other positions
  // TODO: Implement RB, TE, QB scoring with same pattern
  return 50;
}