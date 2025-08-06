/**
 * RB Player Compass Implementation
 * 4-directional dynasty evaluation with equal 25% weighting
 * Adapted from Kimi's Python framework for TypeScript/Node.js
 */

export interface RBPlayerMetrics {
  rush_att: number;
  tgt_share: number;
  gl_carries: number;
  yac_per_att: number;
  breakaway_pct: number;
}

export interface PopulationStats {
  [metric: string]: {
    mean: number;
    std: number;
  };
}

export interface RBPlayerData {
  player_name: string;
  team: string;
  age: number;
  player_metrics: RBPlayerMetrics;
  population_stats: PopulationStats;
  ol_rank: number;
  oc_run_rate: number;
  pos_snap_pct: number;
  neutral_script_rate: number;
  games_missed_2yr: number;
  fum_rate: number;
  proj_rank: number;
  adp_rank: number;
  pos_scarcity_z?: number;
  contract_yrs?: number;
}

export interface RBCompassResult {
  north: number;    // Volume/Talent
  east: number;     // Scheme/Environment  
  south: number;    // Age/Risk
  west: number;     // Market Efficiency
  final_score: number;
  tier: string;
}

/**
 * NORTH: Volume and talent metrics z-scored and normalized
 */
function calculateNorthScore(playerMetrics: RBPlayerMetrics, populationStats: PopulationStats): number {
  const metrics = ['rush_att', 'tgt_share', 'gl_carries', 'yac_per_att', 'breakaway_pct'];
  const zScores: number[] = [];
  
  for (const metric of metrics) {
    if (metric in playerMetrics && metric in populationStats) {
      const mean = populationStats[metric].mean;
      const std = populationStats[metric].std;
      const val = (playerMetrics as any)[metric];
      const z = std > 0 ? (val - mean) / std : 0;
      zScores.push(z);
    }
  }
  
  if (zScores.length === 0) return 5.0;
  
  const averageZ = zScores.reduce((sum, z) => sum + z, 0) / zScores.length;
  // Approximating normal CDF for z-score
  const volumeScore = 0.5 * (1 + Math.sign(averageZ) * Math.sqrt(1 - Math.exp(-2 * averageZ * averageZ / Math.PI)));
  return 10 * volumeScore;
}

/**
 * EAST: Environment factors normalized and averaged
 */
function calculateEastScore(
  olRank: number, 
  ocRunRate: number, 
  posSnapPct: number, 
  neutralScriptRate: number
): number {
  // O-line normalization (1=best, 32=worst)
  const olNorm = (32 - olRank + 1) / 32.0;
  const runNorm = Math.min(1.0, ocRunRate / 0.5);
  const snapNorm = posSnapPct;
  const neutralNorm = neutralScriptRate;
  
  const multiplier = (olNorm + runNorm + snapNorm + neutralNorm) / 4.0;
  return 10 * multiplier;
}

/**
 * SOUTH: Longevity via risk penalties
 */
function calculateSouthScore(age: number, gamesMissed2yr: number, fumRate: number): number {
  let agePen = 0.0;
  
  if (age <= 24) agePen = 0.0;
  else if (age <= 26) agePen = 0.05;
  else if (age === 27) agePen = 0.15;
  else if (age === 28) agePen = 0.25;
  else if (age === 29) agePen = 0.35;
  else agePen = 0.5;
  
  const injPen = gamesMissed2yr * 0.02;
  const fumPen = fumRate * 5.0;
  
  // Cap risk penalty at 1.0 to prevent negative longevity
  const riskPenalty = Math.min(1.0, agePen + injPen + fumPen);
  const longevity = Math.max(0.0, 1.0 - riskPenalty);
  return 10 * longevity;
}

/**
 * WEST: Market efficiency metrics averaged
 */
function calculateWestScore(playerData: RBPlayerData): number {
  const projRank = playerData.proj_rank;
  const adpRank = playerData.adp_rank;
  
  const maxRank = Math.max(projRank, adpRank, 36);
  const efficiency = 1 - Math.abs(projRank - adpRank) / maxRank;
  
  const posScarcityZ = playerData.pos_scarcity_z || 0.0;
  const scarcityNorm = 0.5 * (1 + Math.sign(posScarcityZ) * Math.sqrt(1 - Math.exp(-2 * posScarcityZ * posScarcityZ / Math.PI)));
  
  const contractYrs = playerData.contract_yrs || 1;
  const contractNorm = Math.min(1.0, contractYrs / 3.0);
  
  const ratio = (efficiency + scarcityNorm + contractNorm) / 3.0;
  return 10 * ratio;
}

/**
 * Determine dynasty tier based on final compass score
 */
function getDynastyTier(score: number): string {
  if (score >= 7.5) return 'Elite';
  if (score >= 6.5) return 'Solid';
  if (score >= 5.5) return 'Depth';
  if (score >= 4.5) return 'Bench';
  return 'Waiver';
}

/**
 * Complete 4-directional Player Compass for RBs with equal weighting
 */
export function calculateRBCompass(playerData: RBPlayerData): RBCompassResult {
  const north = calculateNorthScore(playerData.player_metrics, playerData.population_stats);
  
  const east = calculateEastScore(
    playerData.ol_rank,
    playerData.oc_run_rate,
    playerData.pos_snap_pct,
    playerData.neutral_script_rate
  );
  
  const south = calculateSouthScore(
    playerData.age,
    playerData.games_missed_2yr,
    playerData.fum_rate
  );
  
  const west = calculateWestScore(playerData);
  
  // Equal 25% weighting across all directions
  const finalScore = (north * 0.25) + (east * 0.25) + (south * 0.25) + (west * 0.25);
  
  // Floor at 1.0, ceiling at 10.0
  const clampedScore = Math.max(1.0, Math.min(10.0, finalScore));
  
  return {
    north,
    east,
    south,
    west,
    final_score: clampedScore,
    tier: getDynastyTier(clampedScore)
  };
}

/**
 * Sample population statistics for RB metrics (placeholder - to be replaced with real data)
 */
export const RB_POPULATION_STATS: PopulationStats = {
  rush_att: { mean: 180, std: 85 },
  tgt_share: { mean: 0.12, std: 0.08 },
  gl_carries: { mean: 15, std: 12 },
  yac_per_att: { mean: 1.2, std: 0.4 },
  breakaway_pct: { mean: 0.05, std: 0.03 }
};