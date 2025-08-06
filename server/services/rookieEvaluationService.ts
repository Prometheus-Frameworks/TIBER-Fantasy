/**
 * Rookie Evaluation Service
 * Single player evaluation and batch processing for rookie compass integration
 */

import { rookieStorageService, type RookiePlayer } from './rookieStorageService';

interface RookieEvaluationData {
  name: string;
  position: 'QB' | 'RB' | 'WR' | 'TE';
  team: string;
  college?: string;
  draft_round?: number;
  draft_pick?: number;
  adp?: number;
  projected_points?: number;
  // Position-specific stats
  rush_yds?: number;
  rec_yds?: number;
  rec?: number;
  rush_td?: number;
  rec_td?: number;
  rush?: number;
  pass_yds?: number;
  pass_tds?: number;
}

interface RookieCompassResult {
  player_name: string;
  position: string;
  team: string;
  compass_score: number;
  tier: string;
  north_score: number;
  east_score: number;
  south_score: number;
  west_score: number;
  draft_capital_tier: string;
  evaluation_notes: string[];
  dynasty_projection: string;
  timestamp: string;
}

interface BatchResult {
  batch_id: string;
  total_rookies: number;
  evaluations: RookieCompassResult[];
  batch_summary: {
    elite_prospects: number;
    solid_prospects: number;
    average_compass_score: number;
    position_breakdown: Record<string, number>;
  };
  export_timestamp: string;
}

class RookieEvaluationService {
  
  /**
   * Single player rookie evaluation
   */
  public async evaluateRookie(playerData: RookieEvaluationData): Promise<RookieCompassResult> {
    console.log(`🔍 Evaluating rookie: ${playerData.name} (${playerData.position})`);
    
    try {
      // Convert to compass format
      const compassData = this.prepareRookieForCompass(playerData);
      
      // Calculate compass scores based on position
      let compassScores;
      if (playerData.position === 'WR') {
        compassScores = this.calculateWRCompassScores(compassData);
      } else if (playerData.position === 'RB') {
        compassScores = this.calculateRBCompassScores(compassData);
      } else {
        // Default scoring for QB/TE (can be expanded)
        compassScores = this.calculateDefaultCompassScores(compassData);
      }
      
      const overallScore = this.calculateOverallCompassScore(compassScores);
      const tier = this.determineTier(overallScore);
      const draftCapitalTier = this.calculateDraftCapitalTier(playerData.adp);
      
      return {
        player_name: playerData.name,
        position: playerData.position,
        team: playerData.team,
        compass_score: Math.round(overallScore * 100) / 100,
        tier,
        north_score: Math.round(compassScores.north * 100) / 100,
        east_score: Math.round(compassScores.east * 100) / 100,
        south_score: Math.round(compassScores.south * 100) / 100,
        west_score: Math.round(compassScores.west * 100) / 100,
        draft_capital_tier: draftCapitalTier,
        evaluation_notes: this.generateEvaluationNotes(playerData, compassScores, draftCapitalTier),
        dynasty_projection: this.generateDynastyProjection(overallScore, draftCapitalTier),
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      console.error(`❌ Error evaluating rookie ${playerData.name}:`, error);
      throw new Error(`Failed to evaluate rookie: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Prepare rookie data for compass calculation
   */
  private prepareRookieForCompass(rookie: RookieEvaluationData): any {
    return {
      player_name: rookie.name,
      name: rookie.name,
      position: rookie.position,
      team: rookie.team,
      age: 22, // Default rookie age
      experience: 1, // Rookie year
      college: rookie.college,
      draft_round: rookie.draft_round,
      draft_pick: rookie.draft_pick,
      adp: rookie.adp,
      projected_points: rookie.projected_points || 0,
      // Position-specific stats
      rush_attempts: rookie.rush || 0,
      receiving_targets: rookie.rec || 0,
      rush_yards: rookie.rush_yds || 0,
      receiving_yards: rookie.rec_yds || 0,
      rush_tds: rookie.rush_td || 0,
      receiving_tds: rookie.rec_td || 0,
      pass_yards: rookie.pass_yds || 0,
      pass_tds: rookie.pass_tds || 0
    };
  }
  
  /**
   * Calculate WR compass scores for rookie
   */
  private calculateWRCompassScores(compassData: any) {
    // Direct WR rookie calculation using our own logic
    const baseScores = {
      north: this.calculateRookieWRNorth(compassData),
      east: this.calculateRookieWREast(compassData),
      south: this.calculateRookieWRSouth(compassData),
      west: this.calculateRookieWRWest(compassData)
    };
    
    return baseScores;
  }
  
  /**
   * Calculate RB compass scores for rookie
   */
  private calculateRBCompassScores(compassData: any) {
    // Direct RB rookie calculation using our own logic
    const baseScores = {
      north: this.calculateRookieRBNorth(compassData),
      east: this.calculateRookieRBEast(compassData),
      south: this.calculateRookieRBSouth(compassData),
      west: this.calculateRookieRBWest(compassData)
    };
    
    return baseScores;
  }
  
  /**
   * Default compass calculation for QB/TE
   */
  private calculateDefaultCompassScores(compassData: any) {
    return {
      north: 5.0 + (compassData.projected_points / 250) * 2, // Volume baseline
      east: 5.0 + this.getTeamOffenseScore(compassData.team) * 0.5, // Environment
      south: 7.0 - (compassData.age - 22) * 0.2, // Age/Risk (rookies start high)
      west: 5.0 + this.getADPValueScore(compassData.adp) // Market Value
    };
  }
  
  /**
   * Rookie-specific adjustment methods
   */
  private applyRookieVolumeAdjustment(baseScore: number, draftRound?: number): number {
    if (!draftRound) return baseScore;
    
    // Higher draft capital = higher volume expectation
    const draftBonus = Math.max(0, (4 - draftRound) * 0.5);
    return Math.min(10, baseScore + draftBonus);
  }
  
  private applyRookieEnvironmentAdjustment(baseScore: number, team: string): number {
    // Team offensive environment scoring (simplified)
    const eliteOffenses = ['KC', 'BUF', 'DAL', 'MIA', 'SF'];
    const goodOffenses = ['CIN', 'LAC', 'MIN', 'DET', 'GB'];
    
    if (eliteOffenses.includes(team)) return Math.min(10, baseScore + 1.0);
    if (goodOffenses.includes(team)) return Math.min(10, baseScore + 0.5);
    return baseScore;
  }
  
  private applyRookieRiskAdjustment(baseScore: number, age: number): number {
    // Rookies have inherent uncertainty but also upside
    const ageBonus = Math.max(0, (24 - age) * 0.3); // Younger = less risk
    return Math.min(10, baseScore + ageBonus);
  }
  
  private applyRookieValueAdjustment(baseScore: number, adp?: number): number {
    if (!adp) return baseScore;
    
    // Early ADP = lower value score (more expensive)
    if (adp <= 24) return Math.max(1, baseScore - 2.0); // Round 1-2
    if (adp <= 60) return Math.max(1, baseScore - 1.0); // Round 3-5
    if (adp <= 120) return baseScore; // Mid rounds
    return Math.min(10, baseScore + 1.5); // Late round value
  }
  
  /**
   * Position-specific calculations for rookies
   */
  private calculateRookieRBNorth(compassData: any): number {
    let score = 5.0;
    
    // Draft capital influence
    if (compassData.draft_round && compassData.draft_round <= 2) score += 2.0;
    else if (compassData.draft_round && compassData.draft_round <= 4) score += 1.0;
    
    // Projected usage
    if (compassData.rush_attempts > 200) score += 1.5;
    if (compassData.receiving_targets > 40) score += 1.0;
    
    return Math.min(10, score);
  }

  private calculateRookieWRNorth(compassData: any): number {
    let score = 5.0;
    
    // Draft capital influence (more important for WRs)
    if (compassData.draft_round && compassData.draft_round === 1) score += 2.5;
    else if (compassData.draft_round && compassData.draft_round <= 3) score += 1.5;
    else if (compassData.draft_round && compassData.draft_round <= 5) score += 0.5;
    
    // Projected volume
    if (compassData.receiving_targets > 100) score += 2.0;
    else if (compassData.receiving_targets > 70) score += 1.0;
    
    // College production indicators
    if (compassData.receiving_yards > 1000) score += 1.0;
    
    return Math.min(10, score);
  }
  
  private calculateRookieWREast(compassData: any): number {
    return 5.0 + this.getTeamOffenseScore(compassData.team) * 0.6;
  }
  
  private calculateRookieWRSouth(compassData: any): number {
    // WR rookies have position risk but also clean injury history
    let score = 6.5; // Neutral-positive baseline
    
    // Age factor (younger is better for dynasty)
    if (compassData.age <= 21) score += 0.5;
    
    return Math.min(10, score);
  }
  
  private calculateRookieWRWest(compassData: any): number {
    return 5.0 + this.getADPValueScore(compassData.adp) * 0.8;
  }
  
  private calculateRookieRBEast(compassData: any): number {
    return 5.0 + this.getTeamOffenseScore(compassData.team) * 0.8;
  }
  
  private calculateRookieRBSouth(compassData: any): number {
    // RBs have positional risk but rookies start with clean slates
    return 6.5; // Neutral-positive for rookies
  }
  
  private calculateRookieRBWest(compassData: any): number {
    return 5.0 + this.getADPValueScore(compassData.adp);
  }
  
  /**
   * Helper methods
   */
  private getTeamOffenseScore(team: string): number {
    const offenseRankings: Record<string, number> = {
      'KC': 9.5, 'BUF': 9.0, 'DAL': 8.5, 'MIA': 8.5, 'SF': 8.0,
      'CIN': 8.0, 'LAC': 7.5, 'MIN': 7.5, 'DET': 7.0, 'GB': 7.0
    };
    return offenseRankings[team] || 5.0;
  }
  
  private getADPValueScore(adp?: number): number {
    if (!adp) return 5.0;
    if (adp <= 12) return 2.0; // Expensive
    if (adp <= 36) return 3.0; // Moderate
    if (adp <= 84) return 5.0; // Fair
    if (adp <= 156) return 7.0; // Good value
    return 8.5; // Excellent value
  }
  
  private calculateOverallCompassScore(scores: any): number {
    return (scores.north + scores.east + scores.south + scores.west) / 4;
  }
  
  private determineTier(score: number): string {
    if (score >= 8.5) return 'Elite';
    if (score >= 7.5) return 'Excellent';
    if (score >= 6.5) return 'Solid';
    if (score >= 5.5) return 'Average';
    if (score >= 4.0) return 'Below Average';
    return 'Poor';
  }
  
  private calculateDraftCapitalTier(adp?: number): string {
    if (!adp) return 'UDFA';
    if (adp <= 12) return 'Elite';
    if (adp <= 36) return 'High';
    if (adp <= 84) return 'Mid';
    if (adp <= 156) return 'Late';
    return 'UDFA';
  }
  
  private generateEvaluationNotes(player: RookieEvaluationData, scores: any, draftTier: string): string[] {
    const notes: string[] = [];
    
    if (scores.north >= 7.5) notes.push('Strong volume projection based on draft capital');
    if (scores.east >= 7.5) notes.push('Favorable offensive environment for rookie development');
    if (scores.south >= 7.0) notes.push('Low injury risk profile entering NFL');
    if (scores.west >= 7.0) notes.push('Excellent dynasty value at current ADP');
    if (draftTier === 'Elite') notes.push('First-round draft capital provides immediate opportunity');
    
    return notes;
  }
  
  private generateDynastyProjection(score: number, draftTier: string): string {
    if (score >= 8.0 && draftTier === 'Elite') return 'Elite long-term dynasty asset';
    if (score >= 7.0) return 'Strong dynasty contributor with upside';
    if (score >= 6.0) return 'Solid dynasty piece with role security';
    if (score >= 5.0) return 'Depth player with situational value';
    return 'Limited dynasty relevance without significant development';
  }
}

/**
 * Rookie Batch Processing Class
 */
export class RookieBatch {
  private rookies: RookieEvaluationData[] = [];
  private evaluationService: RookieEvaluationService;
  private batchId: string;
  
  constructor() {
    this.evaluationService = new RookieEvaluationService();
    this.batchId = `batch_${Date.now()}`;
  }
  
  /**
   * Add rookie to batch
   */
  addRookie(playerData: RookieEvaluationData): void {
    this.rookies.push(playerData);
    console.log(`✅ Added ${playerData.name} to batch (${this.rookies.length} total)`);
  }
  
  /**
   * Process entire batch
   */
  async processBatch(): Promise<BatchResult> {
    console.log(`🔄 Processing batch of ${this.rookies.length} rookies...`);
    
    const evaluations: RookieCompassResult[] = [];
    
    for (const rookie of this.rookies) {
      try {
        const evaluation = await this.evaluationService.evaluateRookie(rookie);
        evaluations.push(evaluation);
      } catch (error) {
        console.error(`❌ Failed to evaluate ${rookie.name}:`, error);
      }
    }
    
    const summary = this.generateBatchSummary(evaluations);
    
    return {
      batch_id: this.batchId,
      total_rookies: this.rookies.length,
      evaluations,
      batch_summary: summary,
      export_timestamp: new Date().toISOString()
    };
  }
  
  /**
   * Export batch as JSON for database storage
   */
  async exportJson(): Promise<string> {
    const batchResult = await this.processBatch();
    return JSON.stringify(batchResult, null, 2);
  }
  
  /**
   * Generate batch summary statistics
   */
  private generateBatchSummary(evaluations: RookieCompassResult[]) {
    const eliteProspects = evaluations.filter(e => e.compass_score >= 8.0).length;
    const solidProspects = evaluations.filter(e => e.compass_score >= 6.5).length;
    const avgScore = evaluations.reduce((sum, e) => sum + e.compass_score, 0) / evaluations.length;
    
    const positionBreakdown = evaluations.reduce((acc, e) => {
      acc[e.position] = (acc[e.position] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    return {
      elite_prospects: eliteProspects,
      solid_prospects: solidProspects,
      average_compass_score: Math.round(avgScore * 100) / 100,
      position_breakdown: positionBreakdown
    };
  }
}

// Export singleton evaluation service
export const rookieEvaluationService = new RookieEvaluationService();
export { RookieEvaluationService, type RookieEvaluationData, type RookieCompassResult };