/**
 * Enhanced WR Algorithm with Environmental Context & Draft Capital
 * Factors in team offensive context, coaching stability, and situation-based target value
 */

export interface TeamOffensiveContext {
  team: string;
  passAttempts2024: number;
  redZoneAttempts: number;
  coachingStability: number; // 0-100 rating
  offensiveScheme: string;
  qbStability: number; // 0-100 rating
  homeAwayPerformanceDiff: number; // Home vs away scoring difference
}

export interface SituationalTargetValue {
  redZoneTargets: number;
  redZoneValue: number; // EPA per red zone target
  openFieldTargets: number; 
  openFieldValue: number; // EPA per open field target
  thirdDownTargets: number;
  thirdDownValue: number; // EPA per third down target
}

export interface EnhancedWRProfile {
  // Basic info
  id: number;
  name: string;
  team: string;
  age: number;
  
  // Environmental context (new)
  teamContext: TeamOffensiveContext;
  
  // Situational target value (new)
  targetValue: SituationalTargetValue;
  
  // Draft capital (for rookies/young players)
  draftCapital?: {
    round: number;
    pick: number;
    draftValue: number; // 0-100 based on historical success rates
  };
  
  // Enhanced opportunity scoring
  opportunityScore: {
    targetShare: number;
    snapShare: number;
    airYardShare: number;
    redZoneShare: number;
    teamContextAdjusted: number; // Adjusted for team pass volume
  };
  
  // Dynasty valuation
  dynastyValue: number;
  environmentalAdjustment: number; // +/- adjustment based on context
  finalDynastyValue: number;
}

/**
 * 2024 NFL Team Offensive Context Database
 */
export const NFL_TEAM_CONTEXTS: Record<string, TeamOffensiveContext> = {
  // Top passing volume teams (2024 season)
  "KC": {
    team: "KC",
    passAttempts2024: 588, // Chiefs - high volume, stable
    redZoneAttempts: 65,
    coachingStability: 98, // Reid/Mahomes stable
    offensiveScheme: "Spread/West Coast",
    qbStability: 98, // Mahomes
    homeAwayPerformanceDiff: 2.1 // Slight home advantage
  },
  
  "MIA": {
    team: "MIA",
    passAttempts2024: 612, // Dolphins - pass-heavy scheme
    redZoneAttempts: 58,
    coachingStability: 85, // McDaniel established
    offensiveScheme: "Spread/RPO",
    qbStability: 75, // Tua injury concerns
    homeAwayPerformanceDiff: 4.2 // Strong home advantage
  },
  
  "PHI": {
    team: "PHI",
    passAttempts2024: 580, // Eagles - balanced high volume
    redZoneAttempts: 72,
    coachingStability: 88, // Sirianni stable
    offensiveScheme: "RPO/Spread",
    qbStability: 82, // Hurts established
    homeAwayPerformanceDiff: 3.1
  },
  
  "BUF": {
    team: "BUF",
    passAttempts2024: 565,
    redZoneAttempts: 68,
    coachingStability: 92, // McDermott/Allen stable
    offensiveScheme: "Spread/No Huddle",
    qbStability: 95, // Allen
    homeAwayPerformanceDiff: 3.8 // Strong home advantage
  },
  
  "CIN": {
    team: "CIN",
    passAttempts2024: 578,
    redZoneAttempts: 61,
    coachingStability: 85, // Taylor established
    offensiveScheme: "West Coast/Spread",
    qbStability: 90, // Burrow when healthy
    homeAwayPerformanceDiff: 2.3
  },
  
  "LAC": {
    team: "LAC",
    passAttempts2024: 548,
    redZoneAttempts: 55,
    coachingStability: 78, // Harbaugh first year
    offensiveScheme: "West Coast",
    qbStability: 85, // Herbert
    homeAwayPerformanceDiff: 1.8
  },
  
  "JAC": {
    team: "JAC",
    passAttempts2024: 542,
    redZoneAttempts: 48,
    coachingStability: 60, // Peterson unstable
    offensiveScheme: "Spread",
    qbStability: 65, // Lawrence developing
    homeAwayPerformanceDiff: 1.2
  },
  
  // Add other teams with lower pass volumes
  "DEFAULT": {
    team: "DEFAULT",
    passAttempts2024: 520, // League average
    redZoneAttempts: 55,
    coachingStability: 75,
    offensiveScheme: "Mixed",
    qbStability: 75,
    homeAwayPerformanceDiff: 2.0
  }
};

/**
 * Calculate enhanced dynasty value with environmental factors
 */
export function calculateEnhancedWRValue(
  player: any,
  teamContext?: TeamOffensiveContext,
  draftCapital?: any
): EnhancedWRProfile {
  
  // Get team context (use default if not found)
  const context = teamContext || NFL_TEAM_CONTEXTS[player.team] || NFL_TEAM_CONTEXTS["DEFAULT"];
  
  // Base dynasty value calculation
  const baseValue = calculateBaseWRValue(player);
  
  // Environmental adjustments
  const environmentalAdjustment = calculateEnvironmentalAdjustment(player, context);
  
  // Draft capital adjustment (for young players)
  const draftAdjustment = calculateDraftCapitalAdjustment(player.age, draftCapital);
  
  // Target value weighting
  const targetValueScore = calculateSituationalTargetValue(player, context);
  
  // Final dynasty value
  const finalValue = baseValue + environmentalAdjustment + draftAdjustment + targetValueScore;
  
  return {
    id: player.id,
    name: player.name,
    team: player.team,
    age: player.age,
    teamContext: context,
    targetValue: calculateTargetBreakdown(player, context),
    draftCapital,
    opportunityScore: calculateEnhancedOpportunityScore(player, context),
    dynastyValue: baseValue,
    environmentalAdjustment,
    finalDynastyValue: Math.max(15, Math.min(98, finalValue))
  };
}

/**
 * Calculate base WR dynasty value (existing algorithm)
 */
function calculateBaseWRValue(player: any): number {
  const ppg = player.avgPoints || 0;
  const age = player.age || 26;
  const targets = player.targets2024 || player.targets || 0;
  
  // Production score (40% weight)
  const productionScore = Math.min(40, ppg * 2.8);
  
  // Age score (25% weight)
  let ageScore = 25;
  if (age <= 22) ageScore = 25;
  else if (age <= 24) ageScore = 23;
  else if (age <= 26) ageScore = 20;
  else if (age <= 28) ageScore = 16;
  else if (age <= 30) ageScore = 12;
  else ageScore = Math.max(5, 12 - (age - 30) * 2);
  
  // Opportunity score (35% weight)
  let opportunityScore = 15;
  if (targets >= 120) opportunityScore = 35;
  else if (targets >= 100) opportunityScore = 30;
  else if (targets >= 80) opportunityScore = 25;
  else if (targets >= 60) opportunityScore = 20;
  else if (targets >= 40) opportunityScore = 15;
  
  return productionScore + ageScore + opportunityScore;
}

/**
 * Environmental adjustment based on team context
 */
function calculateEnvironmentalAdjustment(player: any, context: TeamOffensiveContext): number {
  let adjustment = 0;
  
  // Pass volume adjustment (high volume = more opportunity)
  if (context.passAttempts2024 >= 580) adjustment += 4; // Elite pass volume
  else if (context.passAttempts2024 >= 550) adjustment += 2; // Above average
  else if (context.passAttempts2024 <= 480) adjustment -= 3; // Low volume penalty
  
  // Coaching stability premium
  if (context.coachingStability >= 90) adjustment += 3;
  else if (context.coachingStability <= 65) adjustment -= 2;
  
  // QB stability factor
  if (context.qbStability >= 90) adjustment += 2;
  else if (context.qbStability <= 70) adjustment -= 2;
  
  // Red zone opportunity
  if (context.redZoneAttempts >= 65) adjustment += 2;
  else if (context.redZoneAttempts <= 45) adjustment -= 1;
  
  return adjustment;
}

/**
 * Draft capital provides significant dynasty boost for young players
 */
function calculateDraftCapitalAdjustment(age: number, draftCapital?: any): number {
  if (!draftCapital || age > 25) return 0; // Only applies to young players
  
  const { round, pick } = draftCapital;
  
  if (round === 1) {
    if (pick <= 10) return 8; // Top 10 picks get major boost
    else if (pick <= 20) return 6; // Mid 1st round
    else return 4; // Late 1st round
  } else if (round === 2) {
    return 3; // Day 2 picks
  } else if (round === 3) {
    return 1; // Day 3 picks
  }
  
  return 0;
}

/**
 * Weight targets by situation using EPA data
 */
function calculateSituationalTargetValue(player: any, context: TeamOffensiveContext): number {
  const targets = player.targets2024 || player.targets || 0;
  if (targets === 0) return 0;
  
  // Estimate target distribution
  const redZoneTargets = Math.round(targets * 0.18); // ~18% in red zone
  const thirdDownTargets = Math.round(targets * 0.22); // ~22% on 3rd down
  const openFieldTargets = targets - redZoneTargets - thirdDownTargets;
  
  // EPA values by situation (league averages)
  const redZoneEPA = 0.85; // High value
  const thirdDownEPA = 0.42; // Medium value  
  const openFieldEPA = 0.25; // Base value
  
  // Calculate weighted target value
  const totalValue = (redZoneTargets * redZoneEPA) + 
                    (thirdDownTargets * thirdDownEPA) + 
                    (openFieldTargets * openFieldEPA);
  
  // Convert to dynasty points (scale to 0-5 point bonus)
  return Math.min(5, totalValue / 20);
}

/**
 * Enhanced opportunity score with team context
 */
function calculateEnhancedOpportunityScore(player: any, context: TeamOffensiveContext): any {
  const targets = player.targets2024 || player.targets || 0;
  const teamTargets = context.passAttempts2024 * 0.65; // ~65% completion rate
  
  return {
    targetShare: teamTargets > 0 ? (targets / teamTargets) * 100 : 0,
    snapShare: player.snapShare || estimateSnapShare(targets),
    airYardShare: estimateAirYardShare(targets),
    redZoneShare: estimateRedZoneShare(player, context),
    teamContextAdjusted: (targets / teamTargets) * (context.passAttempts2024 / 550) * 100
  };
}

function calculateTargetBreakdown(player: any, context: TeamOffensiveContext): SituationalTargetValue {
  const targets = player.targets2024 || player.targets || 0;
  
  return {
    redZoneTargets: Math.round(targets * 0.18),
    redZoneValue: 0.85,
    openFieldTargets: Math.round(targets * 0.60),
    openFieldValue: 0.25,
    thirdDownTargets: Math.round(targets * 0.22),
    thirdDownValue: 0.42
  };
}

function estimateSnapShare(targets: number): number {
  if (targets >= 100) return 85;
  if (targets >= 80) return 75;
  if (targets >= 60) return 65;
  if (targets >= 40) return 55;
  return 40;
}

function estimateAirYardShare(targets: number): number {
  return Math.min(25, targets * 0.2);
}

function estimateRedZoneShare(player: any, context: TeamOffensiveContext): number {
  const targets = player.targets2024 || player.targets || 0;
  const redZoneTargets = targets * 0.18;
  return context.redZoneAttempts > 0 ? (redZoneTargets / context.redZoneAttempts) * 100 : 0;
}

/**
 * Draft capital database for recent picks
 */
export const WR_DRAFT_CAPITAL: Record<string, any> = {
  "Brian Thomas Jr.": { round: 1, pick: 23, draftValue: 85 },
  "Malik Nabers": { round: 1, pick: 6, draftValue: 92 },
  "Marvin Harrison Jr.": { round: 1, pick: 4, draftValue: 95 },
  "Rome Odunze": { round: 1, pick: 9, draftValue: 90 },
  "Ladd McConkey": { round: 2, pick: 34, draftValue: 78 },
  "Keon Coleman": { round: 2, pick: 33, draftValue: 75 },
  "Xavier Worthy": { round: 1, pick: 28, draftValue: 82 }
};