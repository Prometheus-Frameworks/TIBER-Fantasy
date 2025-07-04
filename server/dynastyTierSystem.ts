/**
 * 6-Tier Dynasty Ranking System
 * Comprehensive player classification for dynasty fantasy football
 */

export interface DynastyTier {
  name: string;
  label: string;
  minScore: number;
  maxScore: number;
  color: string;
  description: string;
  expectedCount: {
    QB: number;
    RB: number;
    WR: number;
    TE: number;
  };
}

export const DYNASTY_TIERS: DynastyTier[] = [
  {
    name: 'tier0',
    label: 'Elite',
    minScore: 95,
    maxScore: 100,
    color: '#8B5CF6', // Purple
    description: 'Championship-defining assets with elite production and youth',
    expectedCount: { QB: 3, RB: 4, WR: 6, TE: 2 }
  },
  {
    name: 'tier1',
    label: 'Premium',
    minScore: 85,
    maxScore: 94,
    color: '#3B82F6', // Blue
    description: 'Premium dynasty assets with high value and consistent production',
    expectedCount: { QB: 6, RB: 8, WR: 12, TE: 4 }
  },
  {
    name: 'tier2',
    label: 'Strong',
    minScore: 75,
    maxScore: 84,
    color: '#10B981', // Green
    description: 'Strong dynasty assets with good production or upside',
    expectedCount: { QB: 8, RB: 12, WR: 18, TE: 6 }
  },
  {
    name: 'tier3',
    label: 'Solid',
    minScore: 65,
    maxScore: 74,
    color: '#F59E0B', // Yellow
    description: 'Solid dynasty pieces with decent value',
    expectedCount: { QB: 10, RB: 15, WR: 25, TE: 8 }
  },
  {
    name: 'tier4',
    label: 'Depth',
    minScore: 50,
    maxScore: 64,
    color: '#EF4444', // Red
    description: 'Depth pieces and speculative assets',
    expectedCount: { QB: 12, RB: 20, WR: 30, TE: 10 }
  },
  {
    name: 'tier5',
    label: 'Bench',
    minScore: 0,
    maxScore: 49,
    color: '#6B7280', // Gray
    description: 'Bench stashes and long-shot prospects',
    expectedCount: { QB: 15, RB: 25, WR: 40, TE: 15 }
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

/**
 * Enhanced dynasty scoring with 6-tier classification
 * Based on Jake Maraia methodology with tier-specific thresholds
 */
export class DynastyTierEngine {
  
  /**
   * Calculate dynasty score with tier-aware adjustments
   */
  calculateDynastyScore(player: {
    name: string;
    position: string;
    age: number;
    avgPoints: number;
    team: string;
  }): { score: number; tier: DynastyTier; factors: string[] } {
    
    // Expert consensus overrides for known elite players
    const elitePlayerScores = this.getElitePlayerScores();
    if (elitePlayerScores[player.name]) {
      const score = elitePlayerScores[player.name];
      return {
        score,
        tier: getTierFromScore(score),
        factors: ['Expert consensus ranking', 'Proven elite production']
      };
    }
    
    // Age premium calculation (35% weight)
    const agePremium = this.calculateAgePremium(player.age, player.position);
    
    // Production baseline (30% weight)
    const productionScore = this.calculateProductionScore(player.avgPoints, player.position);
    
    // Opportunity context (35% weight)
    const opportunityScore = this.calculateOpportunityScore(player.team, player.position);
    
    // Calculate weighted score
    const rawScore = (agePremium * 0.35) + (productionScore * 0.30) + (opportunityScore * 0.35);
    
    // Apply position-specific adjustments
    const positionAdjusted = this.applyPositionAdjustments(rawScore, player.position);
    
    // Final score (0-100)
    const finalScore = Math.max(0, Math.min(100, positionAdjusted));
    
    const factors = this.generateFactors(player, agePremium, productionScore, opportunityScore);
    
    return {
      score: finalScore,
      tier: getTierFromScore(finalScore),
      factors
    };
  }
  
  private calculateAgePremium(age: number, position: string): number {
    const peakAges = { QB: 28, RB: 25, WR: 26, TE: 27 };
    const peakAge = peakAges[position as keyof typeof peakAges] || 26;
    
    if (age <= 23) return 100; // Elite youth premium
    if (age <= 25) return 90;  // Strong youth
    if (age <= peakAge) return 80; // Peak years
    if (age <= peakAge + 2) return 65; // Slight decline
    if (age <= peakAge + 4) return 45; // Noticeable decline
    return 25; // Steep decline
  }
  
  private calculateProductionScore(avgPoints: number, position: string): number {
    const eliteThresholds = { QB: 25, RB: 18, WR: 16, TE: 14 };
    const threshold = eliteThresholds[position as keyof typeof eliteThresholds] || 15;
    
    if (avgPoints >= threshold * 1.3) return 100; // Elite production
    if (avgPoints >= threshold) return 85; // Strong production
    if (avgPoints >= threshold * 0.8) return 70; // Good production
    if (avgPoints >= threshold * 0.6) return 55; // Decent production
    if (avgPoints >= threshold * 0.4) return 35; // Poor production
    return 15; // Very poor production
  }
  
  private calculateOpportunityScore(team: string, position: string): number {
    // Team offensive strength ratings (estimated)
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
  
  private applyPositionAdjustments(score: number, position: string): number {
    // Position scarcity adjustments
    const adjustments = { QB: 5, RB: 0, WR: -2, TE: 8 };
    return score + (adjustments[position as keyof typeof adjustments] || 0);
  }
  
  private generateFactors(player: any, age: number, production: number, opportunity: number): string[] {
    const factors: string[] = [];
    
    if (age >= 90) factors.push('Elite youth premium');
    if (age >= 80) factors.push('Strong age profile');
    if (production >= 85) factors.push('High production');
    if (opportunity >= 85) factors.push('Elite offensive context');
    if (player.position === 'TE' && production >= 70) factors.push('TE scarcity premium');
    if (player.position === 'QB' && production >= 80) factors.push('QB positional value');
    
    return factors;
  }
  
  private getElitePlayerScores(): Record<string, number> {
    return {
      // Elite Tier (95-100)
      'Josh Allen': 100, 'Lamar Jackson': 98, 'Jalen Hurts': 97,
      'Anthony Richardson': 96, 'C.J. Stroud': 95,
      
      'Breece Hall': 100, 'Bijan Robinson': 98, 'Jahmyr Gibbs': 97,
      'Jonathan Taylor': 96, 'Kenneth Walker': 95,
      
      'Justin Jefferson': 100, 'Ja\'Marr Chase': 99, 'CeeDee Lamb': 98,
      'Amon-Ra St. Brown': 97, 'Puka Nacua': 96, 'Garrett Wilson': 95,
      
      'Sam LaPorta': 100, 'Travis Kelce': 96,
      
      // Premium Tier (85-94)
      'Jayden Daniels': 94, 'Caleb Williams': 93, 'Joe Burrow': 92,
      'Tua Tagovailoa': 90, 'Dak Prescott': 88, 'Josh Jacobs': 94,
      'De\'Von Achane': 93, 'Kyren Williams': 92, 'Saquon Barkley': 90,
      'Derrick Henry': 88, 'Alvin Kamara': 87, 'Christian McCaffrey': 86,
      
      'Drake London': 94, 'Marvin Harrison Jr.': 93, 'Rome Odunze': 92,
      'DJ Moore': 91, 'Nico Collins': 90, 'Chris Olave': 89,
      'Jaylen Waddle': 88, 'Terry McLaurin': 87, 'DeVonta Smith': 86,
      
      'Trey McBride': 94, 'Kyle Pitts': 92, 'Mark Andrews': 90,
      'George Kittle': 88, 'Evan Engram': 86,
      
      // Strong Tier (75-84) - Additional players to reach proper tier distribution
      'Geno Smith': 84, 'Trevor Lawrence': 83, 'Brock Purdy': 82,
      'Jordan Love': 81, 'Kirk Cousins': 80, 'Jared Goff': 79,
      'Russell Wilson': 78, 'Daniel Jones': 77, 'Justin Herbert': 76,
      
      'Rachaad White': 84, 'Tony Pollard': 83, 'Rhamondre Stevenson': 82,
      'James Cook': 81, 'Travis Etienne': 80, 'Najee Harris': 79,
      'Joe Mixon': 78, 'Aaron Jones': 77, 'D\'Andre Swift': 76,
      
      'Tee Higgins': 84, 'DK Metcalf': 83, 'A.J. Brown': 82,
      'Tyreek Hill': 81, 'Mike Evans': 80, 'Amari Cooper': 79,
      'Keenan Allen': 78, 'Stefon Diggs': 77, 'Calvin Ridley': 76
    };
  }
}

export const dynastyTierEngine = new DynastyTierEngine();