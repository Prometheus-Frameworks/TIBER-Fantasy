/**
 * Dynasty Rankings Integration
 * Combines expanded player database with ADP and dynasty scoring
 */

import { sleeperDynastyADPService } from './sleeperDynastyADP';
import { expandedPlayerDatabase } from './expandedPlayerDatabase';

export interface DynastyPlayerRanking {
  id: string;
  sleeperId: string;
  name: string;
  position: string;
  team: string;
  age: number;
  experience: number;
  adp: number;
  dynastyScore: number;
  tier: 'Elite' | 'Premium' | 'Strong' | 'Solid' | 'Depth' | 'Bench';
  rankOverall: number;
  rankPosition: number;
  strengths: string[];
  concerns: string[];
}

export class DynastyRankingsIntegration {
  
  /**
   * Generate comprehensive dynasty rankings combining our expanded database
   */
  generateIntegratedRankings(): DynastyPlayerRanking[] {
    console.log('🔄 Generating integrated dynasty rankings...');
    
    // Get ADP data
    const adpData = sleeperDynastyADPService.getSleeperDynastyADP();
    
    // Get expanded player database
    const playerDatabase = expandedPlayerDatabase.getAllNFLPlayers();
    
    // Merge data sources
    const integratedPlayers: DynastyPlayerRanking[] = [];
    
    adpData.players.forEach((adpPlayer, index) => {
      const dbPlayer = playerDatabase.find(p => 
        p.name === adpPlayer.name || p.sleeperId === adpPlayer.sleeperId
      );
      
      const dynastyScore = this.calculateDynastyScore(adpPlayer, dbPlayer);
      const tier = this.assignTier(dynastyScore);
      const strengths = this.identifyStrengths(adpPlayer, dbPlayer);
      const concerns = this.identifyconcerns(adpPlayer, dbPlayer);
      
      integratedPlayers.push({
        id: adpPlayer.id,
        sleeperId: adpPlayer.sleeperId,
        name: adpPlayer.name,
        position: adpPlayer.position,
        team: adpPlayer.team,
        age: dbPlayer?.age || this.estimateAge(adpPlayer.name),
        experience: dbPlayer?.experience || this.estimateExperience(adpPlayer.name),
        adp: adpPlayer.adp,
        dynastyScore,
        tier,
        rankOverall: index + 1,
        rankPosition: this.calculatePositionRank(adpPlayer.position, index, adpData.players),
        strengths,
        concerns
      });
    });
    
    // Sort by dynasty score (highest first)
    integratedPlayers.sort((a, b) => b.dynastyScore - a.dynastyScore);
    
    // Update overall rankings
    integratedPlayers.forEach((player, index) => {
      player.rankOverall = index + 1;
    });
    
    console.log(`✅ Generated ${integratedPlayers.length} integrated dynasty rankings`);
    return integratedPlayers;
  }

  /**
   * Calculate dynasty score using Prometheus v2.0 algorithm
   */
  private calculateDynastyScore(adpPlayer: any, dbPlayer: any): number {
    const age = dbPlayer?.age || this.estimateAge(adpPlayer.name);
    const experience = dbPlayer?.experience || this.estimateExperience(adpPlayer.name);
    const position = adpPlayer.position;
    
    // Base score from ADP (lower ADP = higher score)
    let score = Math.max(0, 100 - (adpPlayer.adp - 1) * 1.2);
    
    // Age factor (40% weight)
    if (age <= 23) score += 15;
    else if (age <= 25) score += 10;
    else if (age <= 27) score += 5;
    else if (age >= 30) score -= (age - 29) * 3;
    
    // Experience factor (20% weight)  
    if (experience <= 2) score += 8; // Young players
    else if (experience >= 8) score += 5; // Proven veterans
    
    // Position-specific adjustments (35% weight)
    if (position === 'QB' && adpPlayer.adp <= 20) score += 12; // 2QB format premium
    if (position === 'RB' && age <= 25) score += 8; // RB shelf life
    if (position === 'WR' && age <= 26) score += 6; // WR longevity
    if (position === 'TE' && adpPlayer.adp <= 15) score += 10; // Elite TE scarcity
    
    // Team context (5% weight)
    const offenseBonus = this.getOffenseBonus(adpPlayer.team);
    score += offenseBonus;
    
    return Math.round(Math.max(0, Math.min(100, score)));
  }
  
  private assignTier(score: number): 'Elite' | 'Premium' | 'Strong' | 'Solid' | 'Depth' | 'Bench' {
    if (score >= 90) return 'Elite';
    if (score >= 75) return 'Premium';
    if (score >= 60) return 'Strong';
    if (score >= 45) return 'Solid';
    if (score >= 30) return 'Depth';
    return 'Bench';
  }
  
  private identifyStrengths(adpPlayer: any, dbPlayer: any): string[] {
    const strengths: string[] = [];
    const age = dbPlayer?.age || this.estimateAge(adpPlayer.name);
    const experience = dbPlayer?.experience || 0;
    
    if (age <= 24) strengths.push('Elite age profile');
    if (experience <= 2 && adpPlayer.adp <= 50) strengths.push('Breakout potential');
    if (adpPlayer.adp <= 12) strengths.push('First-round startup pick');
    if (adpPlayer.position === 'QB' && adpPlayer.adp <= 20) strengths.push('2QB format premium');
    if (adpPlayer.position === 'TE' && adpPlayer.adp <= 25) strengths.push('TE positional scarcity');
    
    const goodOffenses = ['KC', 'BUF', 'MIA', 'DAL', 'SF', 'DET', 'BAL', 'CIN'];
    if (goodOffenses.includes(adpPlayer.team)) strengths.push('Elite offensive environment');
    
    return strengths;
  }
  
  private identifyConcerns(adpPlayer: any, dbPlayer: any): string[] {
    const concerns: string[] = [];
    const age = dbPlayer?.age || this.estimateAge(adpPlayer.name);
    const experience = dbPlayer?.experience || 0;
    
    if (age >= 30) concerns.push('Age-related decline risk');
    if (adpPlayer.position === 'RB' && age >= 27) concerns.push('RB aging curve');
    if (experience >= 8 && adpPlayer.adp >= 50) concerns.push('Veteran decline phase');
    if (adpPlayer.adp >= 80) concerns.push('Deep league depth only');
    
    const strugglingOffenses = ['NYJ', 'NE', 'CAR', 'CHI', 'DEN', 'LV'];
    if (strugglingOffenses.includes(adpPlayer.team)) concerns.push('Limited offensive upside');
    
    return concerns;
  }
  
  private calculatePositionRank(position: string, overallIndex: number, allPlayers: any[]): number {
    const positionPlayers = allPlayers.filter(p => p.position === position);
    return positionPlayers.findIndex(p => allPlayers[overallIndex].name === p.name) + 1;
  }
  
  private estimateAge(name: string): number {
    // Basic age estimation based on known player patterns
    const rookieNames = ['Caleb Williams', 'Jayden Daniels', 'Drake Maye', 'Malik Nabers', 'Brian Thomas Jr.'];
    if (rookieNames.includes(name)) return 22;
    
    const youngPlayers = ['Josh Allen', 'Lamar Jackson', 'Joe Burrow', 'Justin Herbert'];
    if (youngPlayers.includes(name)) return 26;
    
    return 27; // Default estimate
  }
  
  private estimateExperience(name: string): number {
    const rookieNames = ['Caleb Williams', 'Jayden Daniels', 'Drake Maye', 'Malik Nabers'];
    if (rookieNames.includes(name)) return 1;
    
    return 4; // Default estimate
  }
  
  private getOffenseBonus(team: string): number {
    const eliteOffenses = ['KC', 'BUF', 'MIA', 'DAL', 'SF', 'DET', 'BAL', 'CIN'];
    const goodOffenses = ['HOU', 'LAC', 'PHI', 'ATL', 'LAR', 'MIN', 'GB'];
    
    if (eliteOffenses.includes(team)) return 3;
    if (goodOffenses.includes(team)) return 1;
    return 0;
  }
}

export const dynastyRankingsIntegration = new DynastyRankingsIntegration();