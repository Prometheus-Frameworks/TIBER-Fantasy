// server/services/wrAlphaEngine.ts
// TIBER Unified WR Alpha Engine
// Produces ONE canonical alphaScore (0-100) for all WR ranking systems
// Replaces separate scoring in Admin Sandbox, Fantasy Rankings, and complements Season Roles

// ===== TYPES =====

export interface WrAlphaInput {
  gamesPlayed: number;
  targetsPerGame: number;
  totalTargets: number;
  targetShareAvg: number | null;
  routesPerGame: number | null;
  fantasyPointsTotal: number;
  fantasyPointsPerGame: number;
  pprPerTarget: number | null;
  adjPprPerTarget: number | null;  // Volume-weighted efficiency (pts/tgt * samplePenalty)
  consistencyScore: number | null;  // From Role Bank (0-100)
  momentumScore: number | null;     // From Role Bank (0-100)
  deepTargetRate: number | null;    // For debug/display, not used in alpha calc
  slotRouteShareEst: number | null; // For debug/display, not used in alpha calc
  pureRoleScore?: number | null;    // For debug/display, not used in alpha calc
}

export interface WrAlphaOutput {
  alphaScore: number;         // Final unified score (0-100)
  volumeIndex: number;        // Volume pillar (0-100)
  productionIndex: number;    // Production pillar (0-100)
  efficiencyIndex: number;    // Efficiency pillar (0-100)
  stabilityIndex: number;     // Stability pillar (0-100)
}

// ===== SCALING FUNCTIONS =====

// Volume Components (reuse from Role Bank)

function scaleTargetsPerGame(tpg: number): number {
  if (tpg >= 12) return 100;
  if (tpg >= 10) return 90;
  if (tpg >= 8) return 75;
  if (tpg >= 6) return 55;
  if (tpg >= 4) return 35;
  if (tpg >= 2) return 20;
  return 10;
}

function scaleTargetShare(share: number): number {
  if (share >= 0.30) return 100;
  if (share >= 0.27) return 90;
  if (share >= 0.24) return 80;
  if (share >= 0.20) return 65;
  if (share >= 0.15) return 45;
  if (share >= 0.10) return 30;
  return 15;
}

function scaleRoutesPerGame2025(rpg: number): number {
  if (rpg >= 33) return 100;
  if (rpg >= 30) return 90;
  if (rpg >= 27) return 80;
  if (rpg >= 24) return 65;
  if (rpg >= 20) return 50;
  if (rpg >= 15) return 30;
  return 15;
}

// Production Components

function scalePPG(ppg: number): number {
  if (ppg >= 20) return 100;
  if (ppg >= 18) return 92;
  if (ppg >= 16) return 84;
  if (ppg >= 14) return 76;
  if (ppg >= 12) return 68;
  if (ppg >= 10) return 60;
  if (ppg >= 8) return 52;
  return 44;
}

function scaleTotalPoints(total: number): number {
  if (total >= 220) return 100;
  if (total >= 200) return 92;
  if (total >= 180) return 84;
  if (total >= 160) return 76;
  if (total >= 140) return 68;
  if (total >= 120) return 60;
  if (total >= 100) return 52;
  return 44;
}

// Efficiency Components

function scaleAdjPprPerTarget(adjPpr: number): number {
  if (adjPpr >= 2.40) return 100;
  if (adjPpr >= 2.20) return 92;
  if (adjPpr >= 2.00) return 84;
  if (adjPpr >= 1.85) return 76;
  if (adjPpr >= 1.70) return 68;
  if (adjPpr >= 1.55) return 60;
  return 50;
}

function scalePprPerTarget(ppr: number): number {
  if (ppr >= 2.40) return 100;
  if (ppr >= 2.20) return 92;
  if (ppr >= 2.00) return 84;
  if (ppr >= 1.85) return 76;
  if (ppr >= 1.70) return 68;
  if (ppr >= 1.55) return 60;
  return 50;
}

// ===== PILLAR CALCULATIONS =====

function calculateVolumeIndex(
  targetsPerGame: number,
  targetShareAvg: number | null,
  routesPerGame: number | null
): number {
  const targetsScore = scaleTargetsPerGame(targetsPerGame);
  const shareScore = targetShareAvg !== null 
    ? scaleTargetShare(targetShareAvg) 
    : targetsScore;
  const routesScore = routesPerGame !== null 
    ? scaleRoutesPerGame2025(routesPerGame) 
    : targetsScore;
  
  return Math.round(
    0.50 * targetsScore + 
    0.30 * shareScore + 
    0.20 * routesScore
  );
}

function calculateProductionIndex(
  fantasyPointsPerGame: number,
  fantasyPointsTotal: number
): number {
  const ppgIndex = scalePPG(fantasyPointsPerGame);
  const totalPointsIndex = scaleTotalPoints(fantasyPointsTotal);
  
  return Math.round(
    0.60 * ppgIndex + 
    0.40 * totalPointsIndex
  );
}

function calculateEfficiencyIndex(
  pprPerTarget: number | null,
  adjPprPerTarget: number | null
): number {
  // If adjPprPerTarget is available, use 70/30 blend
  if (adjPprPerTarget !== null && pprPerTarget !== null) {
    const adjScore = scaleAdjPprPerTarget(adjPprPerTarget);
    const rawScore = scalePprPerTarget(pprPerTarget);
    return Math.round(0.70 * adjScore + 0.30 * rawScore);
  }
  
  // If only adjPprPerTarget, use it
  if (adjPprPerTarget !== null) {
    return scaleAdjPprPerTarget(adjPprPerTarget);
  }
  
  // Fall back to pprPerTarget only
  if (pprPerTarget !== null) {
    return scalePprPerTarget(pprPerTarget);
  }
  
  // Default if both null
  return 50;
}

function calculateStabilityIndex(
  consistencyScore: number | null,
  momentumScore: number | null
): number {
  const consistency = consistencyScore ?? 60;
  const momentum = momentumScore ?? 60;
  
  return Math.round(
    0.60 * consistency + 
    0.40 * momentum
  );
}

// ===== MAIN ALPHA ENGINE =====

export function calculateWrAlphaScore(input: WrAlphaInput): WrAlphaOutput {
  // Pillar 1: Volume (50%)
  const volumeIndex = calculateVolumeIndex(
    input.targetsPerGame,
    input.targetShareAvg,
    input.routesPerGame
  );
  
  // Pillar 2: Production (25%)
  const productionIndex = calculateProductionIndex(
    input.fantasyPointsPerGame,
    input.fantasyPointsTotal
  );
  
  // Pillar 3: Efficiency (15%)
  const efficiencyIndex = calculateEfficiencyIndex(
    input.pprPerTarget,
    input.adjPprPerTarget
  );
  
  // Pillar 4: Stability (10%)
  const stabilityIndex = calculateStabilityIndex(
    input.consistencyScore,
    input.momentumScore
  );
  
  // Final Alpha Score (0-100)
  const alphaScore = Math.round(
    0.50 * volumeIndex + 
    0.25 * productionIndex + 
    0.15 * efficiencyIndex + 
    0.10 * stabilityIndex
  );
  
  return {
    alphaScore,
    volumeIndex,
    productionIndex,
    efficiencyIndex,
    stabilityIndex
  };
}
