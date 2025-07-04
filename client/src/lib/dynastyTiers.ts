/**
 * 6-Tier Dynasty Ranking System (Client-side)
 * Comprehensive player classification for dynasty fantasy football
 */

export interface DynastyTier {
  name: string;
  label: string;
  minScore: number;
  maxScore: number;
  color: string;
  description: string;
  icon: string;
}

export const DYNASTY_TIERS: DynastyTier[] = [
  {
    name: 'tier0',
    label: 'Elite',
    minScore: 95,
    maxScore: 100,
    color: '#8B5CF6', // Purple
    description: 'Foundational assets - Top 2 round startup ADP (QB1s, RB1s, WR1s)',
    icon: 'Crown'
  },
  {
    name: 'tier1',
    label: 'Premium',
    minScore: 85,
    maxScore: 94,
    color: '#3B82F6', // Blue
    description: 'Premium dynasty assets with high value and consistent production',
    icon: 'Trophy'
  },
  {
    name: 'tier2',
    label: 'Strong',
    minScore: 75,
    maxScore: 84,
    color: '#10B981', // Green
    description: 'Strong dynasty assets with good production or upside',
    icon: 'Star'
  },
  {
    name: 'tier3',
    label: 'Solid',
    minScore: 65,
    maxScore: 74,
    color: '#F59E0B', // Yellow
    description: 'Solid dynasty pieces with decent value',
    icon: 'Award'
  },
  {
    name: 'tier4',
    label: 'Depth',
    minScore: 50,
    maxScore: 64,
    color: '#EF4444', // Red
    description: 'Depth pieces and speculative assets',
    icon: 'Target'
  },
  {
    name: 'tier5',
    label: 'Bench',
    minScore: 0,
    maxScore: 49,
    color: '#6B7280', // Gray
    description: 'Bench stashes and long-shot prospects',
    icon: 'Shield'
  }
];

export function getTierFromScore(score: number): DynastyTier {
  return DYNASTY_TIERS.find(tier => score >= tier.minScore && score <= tier.maxScore) || DYNASTY_TIERS[5];
}

export function getTierColor(tierName: string): string {
  const tier = DYNASTY_TIERS.find(t => t.name === tierName);
  return tier?.color || '#6B7280';
}

export function getTierLabel(tierName: string): string {
  const tier = DYNASTY_TIERS.find(t => t.name === tierName);
  return tier?.label || 'Bench';
}

export function getTierIcon(tierName: string): string {
  const tier = DYNASTY_TIERS.find(t => t.name === tierName);
  return tier?.icon || 'Shield';
}

/**
 * Enhanced dynasty scoring with 6-tier classification
 * Client-side version using Jake Maraia methodology
 */
export function calculateDynastyScore(player: {
  name: string;
  position: string;
  age?: number;
  avgPoints: number;
  team: string;
}): { score: number; tier: DynastyTier; factors: string[] } {
  
  // Expert consensus overrides for known elite players
  const elitePlayerScores = getElitePlayerScores();
  if (elitePlayerScores[player.name]) {
    const score = elitePlayerScores[player.name];
    return {
      score,
      tier: getTierFromScore(score),
      factors: ['Expert consensus ranking', 'Proven elite production']
    };
  }
  
  const age = player.age || 25;
  
  // Age premium calculation (35% weight)
  const agePremium = calculateAgePremium(age, player.position);
  
  // Production baseline (30% weight)
  const productionScore = calculateProductionScore(player.avgPoints, player.position);
  
  // Opportunity context (35% weight)
  const opportunityScore = calculateOpportunityScore(player.team, player.position);
  
  // Calculate weighted score
  const rawScore = (agePremium * 0.35) + (productionScore * 0.30) + (opportunityScore * 0.35);
  
  // Apply position-specific adjustments
  const positionAdjusted = applyPositionAdjustments(rawScore, player.position);
  
  // Final score (0-100)
  const finalScore = Math.max(0, Math.min(100, positionAdjusted));
  
  const factors = generateFactors(player, agePremium, productionScore, opportunityScore);
  
  return {
    score: finalScore,
    tier: getTierFromScore(finalScore),
    factors
  };
}

function calculateAgePremium(age: number, position: string): number {
  // Dynasty heavily penalizes age - this is NOT redraft
  const peakAges = { QB: 28, RB: 24, WR: 26, TE: 27 };
  const peakAge = peakAges[position as keyof typeof peakAges] || 25;
  
  // Much steeper age penalties for dynasty
  if (age <= 22) return 100; // Elite youth premium
  if (age <= 24) return 85;  // Strong youth
  if (age <= 26) return 70; // Good age
  if (age <= 28) return 50; // Declining value
  if (age <= 30) return 25; // Poor dynasty value
  return 10; // Very poor dynasty value (30+ for RB/WR)
}

function calculateProductionScore(avgPoints: number, position: string): number {
  // Realistic dynasty production thresholds
  const eliteThresholds = { QB: 22, RB: 15, WR: 14, TE: 12 };
  const threshold = eliteThresholds[position as keyof typeof eliteThresholds] || 12;
  
  if (avgPoints >= threshold * 1.2) return 95; // Elite production
  if (avgPoints >= threshold) return 80; // Strong production
  if (avgPoints >= threshold * 0.75) return 65; // Good production
  if (avgPoints >= threshold * 0.50) return 45; // Decent production
  if (avgPoints >= threshold * 0.25) return 25; // Poor production
  return 10; // Very poor production
}

function calculateOpportunityScore(team: string, position: string): number {
  // Team offensive strength ratings
  const offensiveStrength: Record<string, number> = {
    'BUF': 95, 'KC': 95, 'MIA': 90, 'LAR': 90, 'SF': 90,
    'BAL': 88, 'CIN': 88, 'DAL': 85, 'GB': 85, 'MIN': 85,
    'PHI': 85, 'TB': 82, 'DET': 82, 'LAC': 80, 'IND': 80,
    'ATL': 78, 'HOU': 78, 'SEA': 78, 'NO': 75, 'DEN': 75,
    'TEN': 72, 'JAX': 72, 'WAS': 70, 'LV': 70, 'ARI': 68,
    'NYJ': 68, 'CLE': 65, 'NYG': 65, 'CHI': 62, 'CAR': 60,
    'NE': 58, 'PIT': 55
  };
  
  return offensiveStrength[team] || 65;
}

function applyPositionAdjustments(score: number, position: string): number {
  // Position scarcity adjustments
  const adjustments = { QB: 5, RB: 0, WR: -2, TE: 8 };
  return score + (adjustments[position as keyof typeof adjustments] || 0);
}

function generateFactors(player: any, age: number, production: number, opportunity: number): string[] {
  const factors: string[] = [];
  
  if (age >= 90) factors.push('Elite youth premium');
  if (age >= 80) factors.push('Strong age profile');
  if (production >= 85) factors.push('High production');
  if (opportunity >= 85) factors.push('Elite offensive context');
  if (player.position === 'TE' && production >= 70) factors.push('TE scarcity premium');
  if (player.position === 'QB' && production >= 80) factors.push('QB positional value');
  
  return factors;
}

function getElitePlayerScores(): Record<string, number> {
  return {
    // Elite Tier (95-100) - Foundational assets, 1st-2nd round startup ADP
    // QB1s: Top tier dynasty QBs that anchor teams
    'Josh Allen': 100, 'Lamar Jackson': 98, 'Jalen Hurts': 97, 'Anthony Richardson': 96,
    
    // RB1s: Young elite backs with 3+ year windows
    'Breece Hall': 100, 'Bijan Robinson': 99, 'Jahmyr Gibbs': 98, 'Jonathan Taylor': 96,
    
    // WR1s: Elite young receivers, true WR1 ceiling
    'Justin Jefferson': 100, 'Ja\'Marr Chase': 99, 'CeeDee Lamb': 98, 
    'Amon-Ra St. Brown': 97, 'Puka Nacua': 96, 'Garrett Wilson': 95,
    
    // TE1: True difference makers at position
    'Sam LaPorta': 100, 'Kyle Pitts': 95,
    
    // Premium Tier (85-94) - High-end assets but not foundational
    'C.J. Stroud': 94, 'Jayden Daniels': 93, 'Caleb Williams': 92,
    'Joe Burrow': 90, 'Tua Tagovailoa': 87,
    
    'Kenneth Walker': 92, 'De\'Von Achane': 91, 'Josh Jacobs': 89,
    'Kyren Williams': 87, 'Saquon Barkley': 85,
    
    'Drake London': 93, 'Marvin Harrison Jr.': 92, 'Rome Odunze': 91,
    'DJ Moore': 90, 'Nico Collins': 89, 'Chris Olave': 88,
    'Jaylen Waddle': 87, 'DeVonta Smith': 86, 'Terry McLaurin': 85,
    
    'Trey McBride': 92, 'Mark Andrews': 85,
    
    // Strong Tier (75-84) - Solid assets but aging or limited ceiling
    'Dak Prescott': 82, 'Trevor Lawrence': 80, 'Herbert': 78,
    'Christian McCaffrey': 80, 'Derrick Henry': 75, 'Alvin Kamara': 75,
    'Tyreek Hill': 80, 'Davante Adams': 75, 'Mike Evans': 75,
    'George Kittle': 80, 'Travis Kelce': 75,
    
    // Older/Lower Value Players - Dynasty Bench/Depth (Under 65)
    'Kareem Hunt': 45, 'Dare Ogunbowale': 30, 'Kyle Juszczyk': 25,
    'Samaje Perine': 35, 'C.J. Ham': 20
  };
}