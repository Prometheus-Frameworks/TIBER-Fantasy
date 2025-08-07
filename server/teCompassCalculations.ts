/**
 * TE Player Compass Calculations
 * 4-directional dynasty evaluation for tight ends
 * Equal 25% weighting: NORTH (Volume/Talent), EAST (Environment), SOUTH (Risk), WEST (Value)
 */

export interface TECompass {
  north: number;  // Volume/Talent
  east: number;   // Environment/Scheme  
  south: number;  // Risk/Durability
  west: number;   // Value/Dynasty
  score: number;  // Overall compass score
  tier: string;   // Dynasty tier classification
}

export interface TEPlayerData {
  name: string;
  team: string;
  position: string;
  age: number;
  rookie_status: string;
  games_played: number;
  targets: number;
  receptions: number;
  receiving_yards: number;
  receiving_touchdowns: number;
  yards_per_reception: number;
  yards_after_catch: number;
  red_zone_targets: number;
  pff_receiving_grade: number;
  pff_pass_blocking_grade: number;
  notes: string;
}

/**
 * Calculate NORTH score - Volume/Talent (25%)
 * Focus: Target share, red zone usage, reception efficiency, route participation
 */
function calculateNorthScore(player: TEPlayerData): number {
  const {
    targets,
    receptions, 
    receiving_yards,
    receiving_touchdowns,
    red_zone_targets,
    pff_receiving_grade,
    games_played
  } = player;

  // Per-game metrics for consistency
  const targetsPerGame = targets / games_played;
  const receptionsPerGame = receptions / games_played;
  const yardsPerGame = receiving_yards / games_played;
  const redZoneTargetsPerGame = red_zone_targets / games_played;

  // Reception efficiency
  const catchRate = receptions / targets;
  
  // Volume score (0-10 scale)
  let volumeScore = 0;
  volumeScore += Math.min(4, targetsPerGame / 2.5); // ~10+ targets/game = max
  volumeScore += Math.min(3, yardsPerGame / 25); // ~75+ yards/game = max
  volumeScore += Math.min(2, redZoneTargetsPerGame * 4); // High RZ usage premium
  volumeScore += Math.min(1, catchRate * 2 - 1); // 75%+ catch rate = max

  // PFF receiving grade adjustment
  const pffAdjustment = (pff_receiving_grade - 60) / 40; // Scale from 60-100 to 0-1
  volumeScore *= (1 + Math.max(0, Math.min(0.5, pffAdjustment))); // Up to 50% boost

  return Math.max(0, Math.min(10, volumeScore));
}

/**
 * Calculate EAST score - Environment/Scheme (25%) 
 * Focus: Offensive scheme, QB relationship, team context, role definition
 */
function calculateEastScore(player: TEPlayerData): number {
  const {
    team,
    targets,
    receptions,
    receiving_touchdowns,
    red_zone_targets,
    pff_pass_blocking_grade,
    games_played
  } = player;

  // Team offensive context (simplified - could integrate OASIS data later)
  const teamOffenseMultiplier = getTeamOffenseMultiplier(team);
  
  // Role definition - receiving vs blocking
  const receivingRole = targets / games_played; // Pure receiving volume
  const blockingGrade = pff_pass_blocking_grade;
  
  // Scheme fit score
  let schemeScore = 5.0; // Neutral baseline
  
  // High-volume passing offense bonus
  if (receivingRole > 8) {
    schemeScore += 1.5; // Elite target hog
  } else if (receivingRole > 5) {
    schemeScore += 1.0; // Solid receiving role
  }
  
  // Red zone involvement (scheme-dependent)
  const redZoneRate = red_zone_targets / targets;
  if (redZoneRate > 0.15) {
    schemeScore += 1.0; // High red zone usage
  }
  
  // Blocking ability maintaining snaps
  if (blockingGrade > 70) {
    schemeScore += 0.5; // Three-down player
  }
  
  // Apply team context
  schemeScore *= teamOffenseMultiplier;
  
  return Math.max(0, Math.min(10, schemeScore));
}

/**
 * Calculate SOUTH score - Risk/Durability (25%)
 * Focus: Age, injury history, competition, positional security
 */
function calculateSouthScore(player: TEPlayerData): number {
  const { age, rookie_status, games_played, team, notes } = player;
  
  let riskScore = 8.0; // Start optimistic for TEs (longer careers)
  
  // Age penalties (TEs age better than RBs/WRs)
  if (age >= 33) {
    riskScore -= 2.5; // Significant decline risk
  } else if (age >= 30) {
    riskScore -= 1.0; // Minor age concern
  } else if (age <= 23) {
    riskScore += 0.5; // Youth bonus
  }
  
  // Games played durability
  if (games_played < 14) {
    riskScore -= 1.5; // Missed significant time
  } else if (games_played === 17) {
    riskScore += 0.5; // Full season bonus
  }
  
  // Injury concerns from notes (basic pattern matching)
  const injuryKeywords = ['injury', 'injured', 'missed', 'labrum', 'surgery', 'IR'];
  const hasInjuryConcern = injuryKeywords.some(keyword => 
    notes.toLowerCase().includes(keyword)
  );
  if (hasInjuryConcern) {
    riskScore -= 1.0;
  }
  
  // Competition risk (simplified team context)
  const competitionRisk = getTeamTECompetition(team);
  riskScore -= competitionRisk;
  
  return Math.max(0, Math.min(10, riskScore));
}

/**
 * Calculate WEST score - Value/Dynasty (25%)
 * Focus: Efficiency, consistency, positional scarcity, long-term value
 */
function calculateWestScore(player: TEPlayerData): number {
  const {
    receiving_yards,
    receiving_touchdowns,
    targets,
    yards_per_reception,
    pff_receiving_grade,
    age,
    rookie_status
  } = player;
  
  let valueScore = 5.0; // Neutral baseline
  
  // Production efficiency
  const yardsPerTarget = receiving_yards / targets;
  const touchdownRate = receiving_touchdowns / targets;
  
  // Efficiency bonuses
  if (yardsPerTarget > 8.5) {
    valueScore += 1.5; // Elite efficiency
  } else if (yardsPerTarget > 7.0) {
    valueScore += 1.0; // Good efficiency
  }
  
  // Touchdown efficiency (critical for TE value)
  if (touchdownRate > 0.06) {
    valueScore += 1.5; // Elite TD rate
  } else if (touchdownRate > 0.04) {
    valueScore += 1.0; // Good TD rate
  }
  
  // PFF grade consistency indicator
  if (pff_receiving_grade > 85) {
    valueScore += 1.0; // Elite grade
  } else if (pff_receiving_grade > 75) {
    valueScore += 0.5; // Solid grade
  }
  
  // Age-based dynasty value adjustments
  if (age <= 25) {
    valueScore += 1.0; // Prime dynasty asset
  } else if (age >= 32) {
    valueScore -= 1.0; // Limited dynasty value
  }
  
  // Rookie premium (upside potential)
  if (rookie_status === 'Rookie') {
    valueScore += 0.5;
  }
  
  // Positional scarcity premium for top-12 production
  if (receiving_yards > 600 && receiving_touchdowns >= 4) {
    valueScore += 0.5; // TE1 scarcity bonus
  }
  
  return Math.max(0, Math.min(10, valueScore));
}

/**
 * Calculate overall TE compass score and tier
 */
export function calculateTECompass(player: TEPlayerData): TECompass {
  const north = calculateNorthScore(player);
  const east = calculateEastScore(player);
  const south = calculateSouthScore(player);
  const west = calculateWestScore(player);
  
  // Equal 25% weighting
  const score = (north + east + south + west) / 4;
  
  // Dynasty tier classification
  let tier: string;
  if (score >= 8.5) tier = 'Elite';
  else if (score >= 7.5) tier = 'Excellent';
  else if (score >= 6.5) tier = 'Solid';
  else if (score >= 5.5) tier = 'Decent';
  else if (score >= 4.5) tier = 'Concerning';
  else tier = 'Avoid';
  
  return {
    north: Math.round(north * 10) / 10,
    east: Math.round(east * 10) / 10,
    south: Math.round(south * 10) / 10,
    west: Math.round(west * 10) / 10,
    score: Math.round(score * 10) / 10,
    tier
  };
}

/**
 * Team offensive context multipliers (simplified)
 * Future: Integrate with OASIS R server data
 */
function getTeamOffenseMultiplier(team: string): number {
  const highVolumeOffenses = ['KC', 'BUF', 'MIA', 'SF', 'DAL', 'DET'];
  const averageOffenses = ['BAL', 'LAC', 'CIN', 'MIN', 'PHI', 'TB'];
  const lowVolumeOffenses = ['PIT', 'TEN', 'NYJ', 'CHI', 'CAR', 'WAS'];
  
  if (highVolumeOffenses.includes(team)) return 1.1;
  if (lowVolumeOffenses.includes(team)) return 0.9;
  return 1.0; // Average/unknown teams
}

/**
 * Team TE competition assessment
 */
function getTeamTECompetition(team: string): number {
  // Teams with heavy TE competition (higher risk)
  const highCompetition = ['NE', 'LAC', 'NYG']; // Multiple viable TEs
  const lowCompetition = ['LV', 'ARI', 'SF', 'DET']; // Clear TE1
  
  if (highCompetition.includes(team)) return 1.0;
  if (lowCompetition.includes(team)) return 0.0;
  return 0.5; // Average competition
}