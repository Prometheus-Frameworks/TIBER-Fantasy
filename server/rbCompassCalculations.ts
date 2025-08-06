// RB Player Compass - Kimi K2's 4-directional evaluation system
// Integrated from derive_metrics module with TypeScript adaptation

interface PlayerMetrics {
  rush_att: number;
  tgt_share: number;
  gl_carries: number;
  yac_per_att: number;
  breakaway_pct: number;
}

interface PopulationStats {
  [key: string]: {
    mean: number;
    std: number;
  };
}

interface RBPayload {
  // Raw data inputs
  rush_attempts?: number;
  receiving_targets?: number;
  goal_line_carries?: number;
  yac_per_attempt?: number;
  breakaway_runs?: number;
  ol_run_block_grade?: number;
  team_rush_rate?: number;
  snap_pct?: number;
  team_red_zone_efficiency?: number;
  age?: number;
  injury_games_missed_last2?: number;
  fumble_rate_per_touch?: number;
  contract_years_left?: number;
  dynasty_adp?: number;
  market_efficiency_gap?: number;
  draft_capital?: string;
}

interface DerivedData {
  player_metrics: PlayerMetrics;
  population_stats: PopulationStats;
  ol_rank: number;
  oc_run_rate: number;
  pos_snap_pct: number;
  neutral_script_rate: number;
  age: number;
  games_missed_2yr: number;
  fum_rate: number;
  proj_rank: number;
  adp_rank: number;
  pos_scarcity_z: number;
  contract_yrs: number;
}

// Medians (configurable; based on typical league averages)
const MEDIANS = {
  rush_att: 15.0,
  tgt_share: 0.15,
  gl_carries: 2.0,
  yac_per_att: 2.5,
  breakaway_pct: 0.05,
  ol_rank: 16,
  oc_run_rate: 0.45,
  pos_snap_pct: 0.65,
  neutral_script_rate: 0.5,
  age: 26,
  games_missed_2yr: 2,
  fum_rate: 0.01,
  proj_rank: 18,
  adp_rank: 18,
  pos_scarcity_z: 0.0,
  contract_yrs: 1
};

export function deriveMetrics(payload: RBPayload): DerivedData {
  // North derivations
  const rush_att = payload.rush_attempts || MEDIANS.rush_att;
  const receiving_targets = payload.receiving_targets || 4.0;
  const tgt_share = receiving_targets / 35.0 || MEDIANS.tgt_share; // Placeholder; need team_pass_att
  const gl_carries = payload.goal_line_carries || MEDIANS.gl_carries;
  const yac_per_att = payload.yac_per_attempt || MEDIANS.yac_per_att;
  const breakaway_runs = payload.breakaway_runs || 0;
  const breakaway_pct = rush_att > 0 ? breakaway_runs / rush_att : MEDIANS.breakaway_pct;

  const player_metrics: PlayerMetrics = {
    rush_att,
    tgt_share,
    gl_carries,
    yac_per_att,
    breakaway_pct
  };

  // East derivations
  const ol_grade = payload.ol_run_block_grade;
  const ol_rank = ol_grade ? Math.ceil((90 - ol_grade) / (90 / 32)) : MEDIANS.ol_rank;
  const oc_run_rate = payload.team_rush_rate || MEDIANS.oc_run_rate;
  const pos_snap_pct = payload.snap_pct || MEDIANS.pos_snap_pct;
  const neutral_script_rate = payload.team_red_zone_efficiency || MEDIANS.neutral_script_rate;

  // South
  const age = payload.age || MEDIANS.age;
  const games_missed_2yr = payload.injury_games_missed_last2 || MEDIANS.games_missed_2yr;
  const fum_rate = payload.fumble_rate_per_touch || MEDIANS.fum_rate;
  const contract_yrs = payload.contract_years_left || MEDIANS.contract_yrs;

  // West derivations
  const adp_rank = Math.round(payload.dynasty_adp || MEDIANS.adp_rank);
  const market_gap = payload.market_efficiency_gap || 0;
  const proj_rank = market_gap ? adp_rank + market_gap : MEDIANS.proj_rank;
  
  const draft_capital = payload.draft_capital || 'Undrafted';
  let scarcity_z = MEDIANS.pos_scarcity_z;
  if (draft_capital.includes('Round 1')) scarcity_z = 1.5;
  else if (draft_capital.includes('Round 2')) scarcity_z = 0.5;

  return {
    player_metrics,
    population_stats: {}, // Will be injected externally
    ol_rank,
    oc_run_rate,
    pos_snap_pct,
    neutral_script_rate,
    age,
    games_missed_2yr,
    fum_rate,
    proj_rank,
    adp_rank,
    pos_scarcity_z: scarcity_z,
    contract_yrs
  };
}

export function calculateNorthScore(playerMetrics: PlayerMetrics, populationStats: PopulationStats): number {
  // NORTH: Volume and talent metrics z-scored and normalized
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
  
  // Normal CDF approximation
  const volumeScore = 0.5 * (1 + erf(averageZ / Math.sqrt(2)));
  return 10 * volumeScore;
}

export function calculateEastScore(olRank: number, ocRunRate: number, posSnapPct: number, neutralScriptRate: number): number {
  // EAST: Environment factors normalized and averaged
  const olNorm = (33 - olRank) / 32.0;
  const runNorm = Math.min(1.0, ocRunRate / 0.5);
  const snapNorm = posSnapPct;
  const neutralNorm = neutralScriptRate;
  
  const multiplier = (olNorm + runNorm + snapNorm + neutralNorm) / 4.0;
  return 10 * multiplier;
}

export function calculateSouthScore(age: number, gamesMissed2yr: number, fumRate: number): number {
  // SOUTH: Longevity via risk penalties
  let agePen = 0.0;
  if (age <= 24) agePen = 0.0;
  else if (age <= 26) agePen = 0.05;
  else if (age === 27) agePen = 0.15;
  else if (age === 28) agePen = 0.25;
  else if (age === 29) agePen = 0.35;
  else agePen = 0.5;
  
  const injPen = gamesMissed2yr * 0.02;
  const fumPen = fumRate * 5.0;
  const riskPenalty = agePen + injPen + fumPen;
  const longevity = Math.max(0.0, 1.0 - riskPenalty);
  
  return 10 * longevity;
}

export function calculateWestScore(derivedData: DerivedData): number {
  // WEST: Market efficiency metrics averaged
  const projRank = derivedData.proj_rank;
  const adpRank = derivedData.adp_rank;
  const efficiency = 1 - Math.abs(projRank - adpRank) / 36.0;
  
  const posScarcityZ = derivedData.pos_scarcity_z;
  const scarcityNorm = 0.5 * (1 + erf(posScarcityZ / Math.sqrt(2))); // Normal CDF
  
  const contractYrs = derivedData.contract_yrs;
  const contractNorm = Math.min(1.0, contractYrs / 3.0);
  
  const ratio = (efficiency + scarcityNorm + contractNorm) / 3.0;
  return 10 * ratio;
}

export function calculateRBCompass(payload: RBPayload, populationStats?: PopulationStats): number {
  // Adapted for canonical payload; derives inputs, imputes nulls
  const derived = deriveMetrics(payload);
  derived.population_stats = populationStats || {};
  
  const north = calculateNorthScore(derived.player_metrics, derived.population_stats);
  const east = calculateEastScore(derived.ol_rank, derived.oc_run_rate, derived.pos_snap_pct, derived.neutral_script_rate);
  const south = calculateSouthScore(derived.age, derived.games_missed_2yr, derived.fum_rate);
  const west = calculateWestScore(derived);
  
  const finalScore = (north * 0.25) + (east * 0.25) + (south * 0.25) + (west * 0.25);
  return Math.max(1.0, Math.min(10.0, finalScore));
}

// Error function approximation for normal CDF
function erf(x: number): number {
  const a1 =  0.254829592;
  const a2 = -0.284496736;
  const a3 =  1.421413741;
  const a4 = -1.453152027;
  const a5 =  1.061405429;
  const p  =  0.3275911;

  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x);

  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

  return sign * y;
}

export interface RBCompassResult {
  score: number;
  north: number;
  east: number;
  south: number;
  west: number;
  methodology: string;
}

export function calculateRBCompassDetailed(payload: RBPayload, populationStats?: PopulationStats): RBCompassResult {
  const derived = deriveMetrics(payload);
  derived.population_stats = populationStats || {};
  
  const north = calculateNorthScore(derived.player_metrics, derived.population_stats);
  const east = calculateEastScore(derived.ol_rank, derived.oc_run_rate, derived.pos_snap_pct, derived.neutral_script_rate);
  const south = calculateSouthScore(derived.age, derived.games_missed_2yr, derived.fum_rate);
  const west = calculateWestScore(derived);
  
  const score = Math.max(1.0, Math.min(10.0, (north * 0.25) + (east * 0.25) + (south * 0.25) + (west * 0.25)));
  
  return {
    score,
    north,
    east,
    south,
    west,
    methodology: "Kimi K2 4-directional RB evaluation with z-scoring normalization"
  };
}