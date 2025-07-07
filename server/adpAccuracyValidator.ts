/**
 * ADP Accuracy Validator
 * Cross-references Sleeper dynasty ADP with FantasyPros expert consensus
 */

import { sleeperDynastyADPService } from './sleeperDynastyADP';

export interface ADPComparison {
  player: string;
  position: string;
  sleeperADP: number;
  fantasyProADP: number;
  difference: number;
  accuracyCategory: 'EXACT' | 'CLOSE' | 'MODERATE' | 'SIGNIFICANT' | 'MAJOR';
}

export interface AccuracyReport {
  overallAccuracy: number;
  exactMatches: number;
  closeMatches: number;
  totalPlayers: number;
  averageDifference: number;
  topComparisons: ADPComparison[];
  recommendations: string[];
}

export class ADPAccuracyValidator {
  
  /**
   * Validate Sleeper ADP against FantasyPros expert consensus
   */
  async validateSleeperVsFantasyPros(): Promise<AccuracyReport> {
    console.log('🔍 Cross-referencing Sleeper ADP vs FantasyPros consensus...');
    
    // Get Sleeper dynasty ADP data (real 2QB mock draft values)
    const sleeperData = sleeperDynastyADPService.getSleeperDynastyADP();
    
    // FantasyPros 2QB Dynasty ADP (January 2025 expert consensus)
    const fantasyProADP = this.getFantasyProsDynastyADP();
    
    const comparisons: ADPComparison[] = [];
    
    // Cross-reference each player
    sleeperData.players.forEach(sleeperPlayer => {
      const fpPlayer = fantasyProADP.find(fp => 
        this.normalizePlayerName(fp.name) === this.normalizePlayerName(sleeperPlayer.name)
      );
      
      if (fpPlayer) {
        const difference = Math.abs(sleeperPlayer.adp - fpPlayer.adp);
        const comparison: ADPComparison = {
          player: sleeperPlayer.name,
          position: sleeperPlayer.position,
          sleeperADP: sleeperPlayer.adp,
          fantasyProADP: fpPlayer.adp,
          difference,
          accuracyCategory: this.categorizeAccuracy(difference)
        };
        comparisons.push(comparison);
      }
    });
    
    // Calculate accuracy metrics
    const exactMatches = comparisons.filter(c => c.accuracyCategory === 'EXACT').length;
    const closeMatches = comparisons.filter(c => c.accuracyCategory === 'CLOSE').length;
    const averageDifference = comparisons.reduce((sum, c) => sum + c.difference, 0) / comparisons.length;
    const overallAccuracy = ((exactMatches + closeMatches) / comparisons.length) * 100;
    
    return {
      overallAccuracy,
      exactMatches,
      closeMatches,
      totalPlayers: comparisons.length,
      averageDifference,
      topComparisons: comparisons.slice(0, 20),
      recommendations: this.generateRecommendations(comparisons)
    };
  }
  
  private normalizePlayerName(name: string): string {
    return name.toLowerCase()
      .replace(/['\.-]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }
  
  private categorizeAccuracy(difference: number): 'EXACT' | 'CLOSE' | 'MODERATE' | 'SIGNIFICANT' | 'MAJOR' {
    if (difference <= 0.5) return 'EXACT';
    if (difference <= 2.0) return 'CLOSE';
    if (difference <= 5.0) return 'MODERATE';
    if (difference <= 10.0) return 'SIGNIFICANT';
    return 'MAJOR';
  }
  
  private generateRecommendations(comparisons: ADPComparison[]): string[] {
    const recommendations: string[] = [];
    
    const exactCount = comparisons.filter(c => c.accuracyCategory === 'EXACT').length;
    const closeCount = comparisons.filter(c => c.accuracyCategory === 'CLOSE').length;
    const totalAccuracy = ((exactCount + closeCount) / comparisons.length) * 100;
    
    if (totalAccuracy >= 90) {
      recommendations.push('✅ Excellent accuracy - Sleeper data closely matches expert consensus');
    } else if (totalAccuracy >= 75) {
      recommendations.push('🟡 Good accuracy - Minor discrepancies with expert consensus');
    } else {
      recommendations.push('⚠️ Moderate accuracy - Consider additional data validation');
    }
    
    const majorDifferences = comparisons.filter(c => c.accuracyCategory === 'MAJOR');
    if (majorDifferences.length > 0) {
      recommendations.push(`🔍 ${majorDifferences.length} players have major ADP differences (>10 picks)`);
    }
    
    return recommendations;
  }
  
  /**
   * FantasyPros Dynasty Superflex ADP (Expert Consensus)
   * January 2025 - Cross-reference source
   */
  private getFantasyProsDynastyADP() {
    return [
      { name: 'Josh Allen', position: 'QB', adp: 1.8 },
      { name: 'Jayden Daniels', position: 'QB', adp: 2.2 },
      { name: 'Lamar Jackson', position: 'QB', adp: 3.1 },
      { name: 'Ja\'Marr Chase', position: 'WR', adp: 4.9 },
      { name: 'Joe Burrow', position: 'QB', adp: 5.6 },
      { name: 'Justin Jefferson', position: 'WR', adp: 6.3 },
      { name: 'Jalen Hurts', position: 'QB', adp: 7.4 },
      { name: 'Bijan Robinson', position: 'RB', adp: 8.8 },
      { name: 'Brock Bowers', position: 'TE', adp: 9.1 },
      { name: 'Jahmyr Gibbs', position: 'RB', adp: 10.7 },
      { name: 'Malik Nabers', position: 'WR', adp: 12.3 },
      { name: 'Patrick Mahomes', position: 'QB', adp: 13.5 },
      { name: 'CeeDee Lamb', position: 'WR', adp: 14.1 },
      { name: 'Justin Herbert', position: 'QB', adp: 15.8 },
      { name: 'Puka Nacua', position: 'WR', adp: 16.4 },
      { name: 'Amon-Ra St. Brown', position: 'WR', adp: 17.2 },
      { name: 'Drake Maye', position: 'QB', adp: 18.6 },
      { name: 'C.J. Stroud', position: 'QB', adp: 19.3 },
      { name: 'Caleb Williams', position: 'QB', adp: 20.1 },
      { name: 'Brian Thomas Jr.', position: 'WR', adp: 21.8 }
    ];
  }
}

export const adpAccuracyValidator = new ADPAccuracyValidator();