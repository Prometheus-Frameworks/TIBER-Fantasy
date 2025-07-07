/**
 * Expert Consensus Validation System
 * Validates our dynasty algorithm against industry expert consensus rankings
 */

// Industry Expert Consensus Top 50 Dynasty Rankings (Superflex)
export const EXPERT_CONSENSUS_SUPERFLEX_TOP_50 = {
  // Top 15 Overall (Mixed Positions)
  overall: [
    { rank: 1, name: 'Josh Allen', position: 'QB', tier: 'Elite' },
    { rank: 2, name: 'Lamar Jackson', position: 'QB', tier: 'Elite' },
    { rank: 3, name: 'Jayden Daniels', position: 'QB', tier: 'Elite' },
    { rank: 4, name: 'Ja\'Marr Chase', position: 'WR', tier: 'Elite' },
    { rank: 5, name: 'CeeDee Lamb', position: 'WR', tier: 'Elite' },
    { rank: 6, name: 'Justin Jefferson', position: 'WR', tier: 'Elite' },
    { rank: 7, name: 'Joe Burrow', position: 'QB', tier: 'Elite' },
    { rank: 8, name: 'Malik Nabers', position: 'WR', tier: 'Elite' },
    { rank: 9, name: 'Brock Bowers', position: 'TE', tier: 'Elite' },
    { rank: 10, name: 'Jahmyr Gibbs', position: 'RB', tier: 'Elite' },
    { rank: 11, name: 'Breece Hall', position: 'RB', tier: 'Elite' },
    { rank: 12, name: 'Puka Nacua', position: 'WR', tier: 'Elite' },
    { rank: 13, name: 'Brian Thomas Jr.', position: 'WR', tier: 'Premium' },
    { rank: 14, name: 'Amon-Ra St. Brown', position: 'WR', tier: 'Premium' },
    { rank: 15, name: 'Saquon Barkley', position: 'RB', tier: 'Premium' }
  ],
  
  // QB Rankings (1-10)
  qbs: [
    { rank: 1, name: 'Josh Allen', dynastyValue: 100 },
    { rank: 2, name: 'Lamar Jackson', dynastyValue: 98 },
    { rank: 3, name: 'Jayden Daniels', dynastyValue: 96 },
    { rank: 4, name: 'Joe Burrow', dynastyValue: 94 },
    { rank: 5, name: 'Jalen Hurts', dynastyValue: 85 },
    { rank: 6, name: 'Drake Maye', dynastyValue: 82 },
    { rank: 7, name: 'Anthony Richardson', dynastyValue: 78 },
    { rank: 8, name: 'Jordan Love', dynastyValue: 75 },
    { rank: 9, name: 'Tua Tagovailoa', dynastyValue: 68 }, // NOT top 20 overall
    { rank: 10, name: 'Dak Prescott', dynastyValue: 65 }
  ],
  
  // WR Rankings (1-15)
  wrs: [
    { rank: 1, name: 'Ja\'Marr Chase', dynastyValue: 95 },
    { rank: 2, name: 'CeeDee Lamb', dynastyValue: 92 },
    { rank: 3, name: 'Justin Jefferson', dynastyValue: 90 },
    { rank: 4, name: 'Malik Nabers', dynastyValue: 88 },
    { rank: 5, name: 'Brian Thomas Jr.', dynastyValue: 85 },
    { rank: 6, name: 'Puka Nacua', dynastyValue: 83 },
    { rank: 7, name: 'Amon-Ra St. Brown', dynastyValue: 81 },
    { rank: 8, name: 'Drake London', dynastyValue: 78 },
    { rank: 9, name: 'Ladd McConkey', dynastyValue: 76 },
    { rank: 10, name: 'Marvin Harrison Jr.', dynastyValue: 74 },
    { rank: 11, name: 'Rome Odunze', dynastyValue: 72 },
    { rank: 12, name: 'Rashee Rice', dynastyValue: 70 },
    { rank: 13, name: 'Nico Collins', dynastyValue: 68 },
    { rank: 14, name: 'Jayden Reed', dynastyValue: 66 },
    { rank: 15, name: 'Chris Olave', dynastyValue: 64 }
  ],
  
  // RB Rankings (1-10)  
  rbs: [
    { rank: 1, name: 'Jahmyr Gibbs', dynastyValue: 88 },
    { rank: 2, name: 'Breece Hall', dynastyValue: 86 },
    { rank: 3, name: 'Bijan Robinson', dynastyValue: 84 }, // SHOULD BE HIGHER
    { rank: 4, name: 'Saquon Barkley', dynastyValue: 80 },
    { rank: 5, name: 'Kenneth Walker III', dynastyValue: 76 },
    { rank: 6, name: 'De\'Von Achane', dynastyValue: 74 },
    { rank: 7, name: 'Kyren Williams', dynastyValue: 70 },
    { rank: 8, name: 'Jonathan Taylor', dynastyValue: 68 },
    { rank: 9, name: 'Josh Jacobs', dynastyValue: 65 },
    { rank: 10, name: 'James Cook', dynastyValue: 62 }
  ],
  
  // TE Rankings (1-5)
  tes: [
    { rank: 1, name: 'Brock Bowers', dynastyValue: 90 },
    { rank: 2, name: 'Trey McBride', dynastyValue: 72 },
    { rank: 3, name: 'Sam LaPorta', dynastyValue: 70 },
    { rank: 4, name: 'Dalton Kincaid', dynastyValue: 65 },
    { rank: 5, name: 'Kyle Pitts', dynastyValue: 60 }
  ]
};

export interface ValidationResult {
  overallAccuracy: number;
  positionAccuracy: {
    QB: number;
    RB: number;
    WR: number;
    TE: number;
  };
  majorDiscrepancies: Array<{
    player: string;
    position: string;
    ourRank: number;
    jakeRank: number;
    difference: number;
    issue: string;
  }>;
  improvements: string[];
}

export class ExpertConsensusValidator {
  
  /**
   * Validate our top 50 against expert consensus rankings
   */
  validateRankings(ourPlayers: any[]): ValidationResult {
    const discrepancies: ValidationResult['majorDiscrepancies'] = [];
    const improvements: string[] = [];
    
    // Validate QBs
    const ourQBs = ourPlayers.filter(p => p.position === 'QB').slice(0, 10);
    const qbAccuracy = this.validatePositionRankings(ourQBs, EXPERT_CONSENSUS_SUPERFLEX_TOP_50.qbs, 'QB', discrepancies);
    
    // Validate WRs
    const ourWRs = ourPlayers.filter(p => p.position === 'WR').slice(0, 15);
    const wrAccuracy = this.validatePositionRankings(ourWRs, EXPERT_CONSENSUS_SUPERFLEX_TOP_50.wrs, 'WR', discrepancies);
    
    // Validate RBs
    const ourRBs = ourPlayers.filter(p => p.position === 'RB').slice(0, 10);
    const rbAccuracy = this.validatePositionRankings(ourRBs, EXPERT_CONSENSUS_SUPERFLEX_TOP_50.rbs, 'RB', discrepancies);
    
    // Validate TEs
    const ourTEs = ourPlayers.filter(p => p.position === 'TE').slice(0, 5);
    const teAccuracy = this.validatePositionRankings(ourTEs, EXPERT_CONSENSUS_SUPERFLEX_TOP_50.tes, 'TE', discrepancies);
    
    // Calculate overall accuracy
    const totalPlayers = 10 + 15 + 10 + 5; // QB + WR + RB + TE
    const totalCorrect = (qbAccuracy * 10) + (wrAccuracy * 15) + (rbAccuracy * 10) + (teAccuracy * 5);
    const overallAccuracy = (totalCorrect / totalPlayers) * 100;
    
    // Generate improvement suggestions
    this.generateImprovements(discrepancies, improvements);
    
    return {
      overallAccuracy: Math.round(overallAccuracy),
      positionAccuracy: {
        QB: Math.round(qbAccuracy * 100),
        RB: Math.round(rbAccuracy * 100), 
        WR: Math.round(wrAccuracy * 100),
        TE: Math.round(teAccuracy * 100)
      },
      majorDiscrepancies: discrepancies.sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference)),
      improvements
    };
  }
  
  private validatePositionRankings(
    ourPlayers: any[], 
    jakeRankings: any[], 
    position: string,
    discrepancies: ValidationResult['majorDiscrepancies']
  ): number {
    let correctWithinTolerance = 0;
    const tolerance = position === 'QB' ? 2 : 3; // Allow ±2 for QB, ±3 for others
    
    for (let i = 0; i < Math.min(ourPlayers.length, jakeRankings.length); i++) {
      const ourPlayer = ourPlayers[i];
      const jakePlayer = jakeRankings.find(p => 
        this.normalizePlayerName(p.name) === this.normalizePlayerName(ourPlayer.name)
      );
      
      if (jakePlayer) {
        const ourRank = i + 1;
        const jakeRank = jakePlayer.rank;
        const difference = Math.abs(ourRank - jakeRank);
        
        if (difference <= tolerance) {
          correctWithinTolerance++;
        } else {
          // Major discrepancy
          discrepancies.push({
            player: ourPlayer.name,
            position,
            ourRank,
            jakeRank,
            difference,
            issue: ourRank > jakeRank ? 'Ranked too low' : 'Ranked too high'
          });
        }
      }
    }
    
    return correctWithinTolerance / Math.min(ourPlayers.length, jakeRankings.length);
  }
  
  private generateImprovements(
    discrepancies: ValidationResult['majorDiscrepancies'], 
    improvements: string[]
  ): void {
    // Analyze patterns in discrepancies
    const overvaluedQBs = discrepancies.filter(d => d.position === 'QB' && d.issue === 'Ranked too high');
    const undervaluedRBs = discrepancies.filter(d => d.position === 'RB' && d.issue === 'Ranked too low');
    const overvaluedOldPlayers = discrepancies.filter(d => d.player.includes('Tua') || d.player.includes('Dak'));
    
    if (overvaluedQBs.length > 0) {
      improvements.push('Reduce QB age bonus for players 27+ years old');
    }
    
    if (undervaluedRBs.length > 0) {
      improvements.push('Increase RB dynasty value for elite young players (Bijan, etc.)');
    }
    
    if (overvaluedOldPlayers.length > 0) {
      improvements.push('Apply stricter age penalties for players 30+');
    }
    
    // Specific player fixes
    const bijonIssue = discrepancies.find(d => d.player.includes('Bijan'));
    if (bijonIssue) {
      improvements.push('Fix Bijan Robinson algorithm - should be RB3 (84+ dynasty value)');
    }
    
    const tuaIssue = discrepancies.find(d => d.player.includes('Tua') && d.ourRank <= 20);
    if (tuaIssue) {
      improvements.push('Move Tua out of top 20 overall - injury concerns + age');
    }
  }
  
  private normalizePlayerName(name: string): string {
    return name.toLowerCase()
      .replace(/[^a-z\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }
  
  /**
   * Get recommended dynasty value adjustments
   */
  getRecommendedAdjustments(ourPlayers: any[]): Array<{
    player: string;
    currentValue: number;
    recommendedValue: number;
    reason: string;
  }> {
    const adjustments = [];
    
    // Find players in our rankings and compare to Jake's values
    for (const player of ourPlayers.slice(0, 50)) {
      let jakePlayer = null;
      
      // Search across all expert consensus position rankings
      const allExpertPlayers = [
        ...EXPERT_CONSENSUS_SUPERFLEX_TOP_50.qbs,
        ...EXPERT_CONSENSUS_SUPERFLEX_TOP_50.wrs,
        ...EXPERT_CONSENSUS_SUPERFLEX_TOP_50.rbs,
        ...EXPERT_CONSENSUS_SUPERFLEX_TOP_50.tes
      ];
      
      jakePlayer = allExpertPlayers.find(p => 
        this.normalizePlayerName(p.name) === this.normalizePlayerName(player.name)
      );
      
      if (jakePlayer && Math.abs(player.dynastyValue - jakePlayer.dynastyValue) > 5) {
        adjustments.push({
          player: player.name,
          currentValue: player.dynastyValue,
          recommendedValue: jakePlayer.dynastyValue,
          reason: `Expert consensus: ${jakePlayer.dynastyValue}`
        });
      }
    }
    
    return adjustments.slice(0, 10); // Top 10 adjustments needed
  }
}

export const expertConsensusValidator = new ExpertConsensusValidator();