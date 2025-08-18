/**
 * Player Compass - Dynamic Player Evaluation System
 * Provides context-aware player guidance instead of rigid rankings
 * Integrates existing Prometheus methodology with flexible tier-based approach
 */

export interface CompassProfile {
  playerId: string;
  name: string;
  position: 'QB' | 'RB' | 'WR' | 'TE';
  team: string;
  tier: 'Elite' | 'High-End' | 'Solid' | 'Upside' | 'Deep';
  contextTags: CompassTag[];
  scenarios: CompassScenarios;
  keyInsights: string[];
  ageContext: {
    age: number;
    primeWindow: 'Peak' | 'Entering' | 'Prime' | 'Declining' | 'Veteran';
    yearsRemaining: number;
  };
  riskFactors: string[];
  opportunityMetrics: {
    usageSecurity: number; // 0-10 scale
    targetCompetition: 'Minimal' | 'Moderate' | 'High' | 'Severe';
    environmentStability: number; // 0-10 scale
  };
  timestamp: Date;
}

export interface CompassScenarios {
  contendingTeam: number; // 0-10 scale
  rebuildingTeam: number; // 0-10 scale
  redraftAppeal: number; // 0-10 scale
  dynastyCeiling: number; // 0-10 scale
  injuryReplacement: number; // 0-10 scale
  playoffReliability: number; // 0-10 scale
}

export type CompassTag = 
  | 'Win-Now' | 'Dynasty-Build' | 'Boom-Bust' | 'Floor-Play'
  | 'Injury-Risk' | 'Age-Concern' | 'Breakout-Candidate'
  | 'Usage-Secure' | 'Target-Competition' | 'Environment-Dependent'
  | 'Volume-Dependent' | 'Efficiency-Play' | 'Touchdown-Regression'
  | 'Rushing-Upside' | 'Pass-Catching' | 'Deep-Threat'
  | 'Slot-Role' | 'Alpha-Potential' | 'Scheme-Fit';

export interface CompassFilters {
  positions?: ('QB' | 'RB' | 'WR' | 'TE')[];
  tiers?: ('Elite' | 'High-End' | 'Solid' | 'Upside' | 'Deep')[];
  tags?: CompassTag[];
  teams?: string[];
  ageRange?: {
    min: number;
    max: number;
  };
  scenarios?: {
    scenario: keyof CompassScenarios;
    minValue: number;
  };
}

export class PlayerCompassService {
  
  /**
   * Generate compass profile for a player using existing evaluation frameworks
   */
  generateCompassProfile(playerData: any): CompassProfile {
    const baseProfile = this.createBaseProfile(playerData);
    const tier = this.calculateTier(playerData);
    const contextTags = this.generateContextTags(playerData);
    const scenarios = this.calculateScenarios(playerData);
    const keyInsights = this.generateKeyInsights(playerData, tier, contextTags);
    const ageContext = this.analyzeAgeContext(playerData);
    const riskFactors = this.identifyRiskFactors(playerData);
    const opportunityMetrics = this.calculateOpportunityMetrics(playerData);

    return {
      ...baseProfile,
      tier,
      contextTags,
      scenarios,
      keyInsights,
      ageContext,
      riskFactors,
      opportunityMetrics,
      timestamp: new Date()
    };
  }

  /**
   * Calculate tier based on existing Prometheus methodology
   */
  private calculateTier(playerData: any): CompassProfile['tier'] {
    // Use existing prometheus score if available
    const prometheusScore = playerData.prometheusScore || this.estimatePrometheusScore(playerData);
    
    if (prometheusScore >= 90) return 'Elite';
    if (prometheusScore >= 80) return 'High-End';
    if (prometheusScore >= 70) return 'Solid';
    if (prometheusScore >= 60) return 'Upside';
    return 'Deep';
  }

  /**
   * Generate context tags based on player characteristics
   */
  private generateContextTags(playerData: any): CompassTag[] {
    const tags: CompassTag[] = [];
    
    // Age-based tags
    if (playerData.age <= 25) tags.push('Dynasty-Build');
    if (playerData.age >= 29) tags.push('Age-Concern');
    if (playerData.age >= 27 && playerData.age <= 30) tags.push('Win-Now');
    
    // Performance pattern tags
    if (playerData.consistencyScore < 0.7) tags.push('Boom-Bust');
    if (playerData.consistencyScore >= 0.8) tags.push('Floor-Play');
    
    // Opportunity tags
    if (playerData.targetShare >= 0.25) tags.push('Usage-Secure');
    if (playerData.targetCompetition === 'High') tags.push('Target-Competition');
    
    // Position-specific tags
    if (playerData.position === 'QB' && playerData.rushingYards > 500) {
      tags.push('Rushing-Upside');
    }
    
    if (playerData.position === 'RB' && playerData.receivingTargets > 50) {
      tags.push('Pass-Catching');
    }
    
    if (playerData.position === 'WR') {
      if (playerData.averageDepthOfTarget > 12) tags.push('Deep-Threat');
      if (playerData.slotRate > 0.6) tags.push('Slot-Role');
      if (playerData.targetShare > 0.25) tags.push('Alpha-Potential');
    }
    
    return tags;
  }

  /**
   * Calculate scenario-specific values using Player Compass v1 methodology
   */
  private calculateScenarios(playerData: any): CompassScenarios {
    const baseScore = playerData.prometheusScore || this.estimatePrometheusScore(playerData);
    
    // Age adjustments for different scenarios
    const ageMultiplier = this.getAgeMultiplier(playerData.age, playerData.position);
    
    // Calculate Player Compass v1 final score for dynasty ceiling
    const compassResult = this.calculatePlayerCompassScore(playerData);
    
    return {
      contendingTeam: Math.min(10, baseScore / 10 * (playerData.age <= 30 ? 1.1 : 0.9)),
      rebuildingTeam: Math.min(10, baseScore / 10 * ageMultiplier.dynasty),
      redraftAppeal: Math.min(10, baseScore / 10 * ageMultiplier.redraft),
      dynastyCeiling: compassResult.final_compass_score, // Use new Player Compass v1 score
      injuryReplacement: Math.min(10, (baseScore / 10) * 0.8), // Slightly lower for replacement context
      playoffReliability: Math.min(10, baseScore / 10 * (playerData.consistencyScore || 0.75))
    };
  }

  /**
   * Player Compass v1 - Multidimensional scoring model
   * Framework: Derive player fit using four weighted directional factors
   * NORTH: Volume/Talent (Tier Score)
   * EAST: Scheme + Offensive Environment (Context Tags) 
   * SOUTH: Age/Injury Risk (Scenario Score)
   * WEST: Market Efficiency/Value (Key Insights)
   */
  private calculatePlayerCompassScore(playerData: any): {
    anchor_score: number;
    tier_score: number;
    context_tag_adjustment: number;
    scenario_score: number;
    key_insight_adjustment: number;
    final_compass_score: number;
  } {
    // Get anchor score (base talent score 0-100)
    const anchorScore = playerData.prometheusScore || this.estimatePrometheusScore(playerData);
    
    // 🧭 NORTH (Volume/Talent): Scale anchor score to 0-10 range
    const northScore = anchorScore / 12.0; // Grok's proven formula
    
    // 🧭 EAST (Scheme + Environment): Grok's enhanced context tag system
    const contextTagModifiers: Record<string, number> = {
      'usage_security': 0.6,
      'target_competition': 0.15,
      'role_clarity': 0.2,
      'breakout_candidate': 0.15,
      'scheme_fit': 0.1,
      'elite': 0.3,
      'injury_prone': -0.2,
      // Legacy tag mapping for compatibility
      'Usage-Secure': 0.6,
      'Target-Competition': -0.15,
      'Breakout-Candidate': 0.15,
      'Dynasty-Build': 0.15,
      'Alpha-Potential': 0.2,
      'Injury-Risk': -0.2
    };
    
    let eastScore = 5.0; // Neutral baseline (Grok's approach)
    const contextTags = this.generateContextTags(playerData);
    const tagModifier = contextTags.reduce((sum, tag) => {
      return sum + (contextTagModifiers[tag] || 0.0);
    }, 0);
    
    eastScore = Math.min(10, Math.max(0, eastScore + tagModifier));
    
    // 🧭 SOUTH (Age/Risk): Grok's refined age factor approach
    const contendingFit = Math.min(10, (anchorScore / 10) * (playerData.age <= 30 ? 1.0 : 0.85));
    const rebuildingFit = Math.min(10, (anchorScore / 10) * this.getAgeMultiplier(playerData.age, playerData.position).dynasty);
    const baseScenario = (contendingFit + rebuildingFit) / 2.0;
    
    // Apply Grok's age factor refinement
    let ageFactor: number;
    if (playerData.age <= 24) {
      ageFactor = 1.1; // Prime dynasty window
    } else if (playerData.age <= 27) {
      ageFactor = 1.0; // Peak years
    } else if (playerData.age <= 30) {
      ageFactor = 0.9; // Slight decline
    } else {
      ageFactor = 0.75; // Higher risk
    }
    
    const southScore = baseScenario * ageFactor;
    
    // 🧭 WEST (Market Efficiency): Grok's dynasty value vs market perception
    const contractModifiers: Record<string, number> = {
      'long_term': 0.2,
      'medium_term': 0.1,
      'expiring': -0.2,
      // Legacy mapping
      'Secure': 0.2,
      'Active': 0.1,
      'Expiring': -0.2
    };
    
    let westScore = 5.0; // Neutral baseline
    
    // Young elite = dynasty gold
    if (playerData.age <= 25 && anchorScore >= 85) {
      westScore += 2.0;
    }
    // Aging productive = sell window  
    else if (playerData.age >= 30 && anchorScore >= 80) {
      westScore -= 1.5;
    }
    
    // Efficiency metrics
    const targetShare = playerData.targetShare || 0.2;
    if (targetShare <= 0.18 && anchorScore >= 80) {
      westScore += 1.0; // Efficient production
    } else if (targetShare >= 0.28) {
      westScore -= 0.5; // Target dependent
    }
    
    // Contract stability (Grok's approach)
    const contractMod = contractModifiers[playerData.contractStatus || 'medium_term'] || 0.0;
    westScore += contractMod;
    
    westScore = Math.min(10, Math.max(0, westScore));
    
    // Calculate final compass score: Grok's equal 25% weighting framework
    const north = northScore;
    const east = eastScore;
    const south = southScore;
    const west = westScore;
    
    const finalScore = (north * 0.25) + (east * 0.25) + (south * 0.25) + (west * 0.25);
    const cappedScore = Math.min(10.0, Math.max(1.0, finalScore)); // Grok's floor/ceiling
    
    // Optional debug logging (disabled in production)
    // console.log(`🧭 DEBUG ${playerData.name}: Anchor=${anchorScore}, Tier=${tierScore.toFixed(2)}, Tags=${contextTagAdjustment}, Scenario=${scenarioScore.toFixed(2)}, Insights=${keyInsightAdjustment}, Final=${finalScore.toFixed(2)}`);
    
    return {
      anchor_score: anchorScore,
      tier_score: Math.round(north * 100) / 100,
      context_tag_adjustment: Math.round(east * 100) / 100,
      scenario_score: Math.round(south * 100) / 100,
      key_insight_adjustment: Math.round(west * 100) / 100,
      final_compass_score: Math.round(cappedScore * 100) / 100
    };
  }

  /**
   * Add debugging endpoint to see compass calculation breakdown
   */
  getCompassCalculationBreakdown(playerData: any) {
    return this.calculatePlayerCompassScore(playerData);
  }

  /**
   * Generate key insights for decision-making
   */
  private generateKeyInsights(playerData: any, tier: string, tags: CompassTag[]): string[] {
    const insights: string[] = [];
    
    // Age-based insights
    if (playerData.age <= 24) {
      insights.push(`Age ${playerData.age} - prime dynasty window ahead`);
    } else if (playerData.age >= 29) {
      insights.push(`Age ${playerData.age} - consider selling high before cliff`);
    }
    
    // Usage insights
    if (tags.includes('Usage-Secure')) {
      insights.push('Secure target share with minimal competition');
    }
    
    if (tags.includes('Target-Competition')) {
      insights.push('Faces significant target competition - monitor usage trends');
    }
    
    // Performance insights
    if (tier === 'Elite') {
      insights.push('Elite tier production with proven track record');
    }
    
    if (tags.includes('Breakout-Candidate')) {
      insights.push('Strong breakout potential - buy before price increases');
    }
    
    return insights;
  }

  /**
   * Analyze age context for position-specific evaluation
   */
  private analyzeAgeContext(playerData: any): CompassProfile['ageContext'] {
    const age = playerData.age;
    const position = playerData.position;
    
    let primeWindow: CompassProfile['ageContext']['primeWindow'];
    let yearsRemaining: number;
    
    // Position-specific age curves
    switch (position) {
      case 'RB':
        if (age <= 24) { primeWindow = 'Entering'; yearsRemaining = 4; }
        else if (age <= 27) { primeWindow = 'Prime'; yearsRemaining = 2; }
        else if (age <= 29) { primeWindow = 'Peak'; yearsRemaining = 1; }
        else { primeWindow = 'Declining'; yearsRemaining = 0; }
        break;
        
      case 'WR':
        if (age <= 25) { primeWindow = 'Entering'; yearsRemaining = 5; }
        else if (age <= 29) { primeWindow = 'Prime'; yearsRemaining = 3; }
        else if (age <= 32) { primeWindow = 'Peak'; yearsRemaining = 1; }
        else { primeWindow = 'Declining'; yearsRemaining = 0; }
        break;
        
      case 'QB':
        if (age <= 26) { primeWindow = 'Entering'; yearsRemaining = 8; }
        else if (age <= 32) { primeWindow = 'Prime'; yearsRemaining = 5; }
        else if (age <= 36) { primeWindow = 'Peak'; yearsRemaining = 2; }
        else { primeWindow = 'Veteran'; yearsRemaining = 1; }
        break;
        
      case 'TE':
        if (age <= 26) { primeWindow = 'Entering'; yearsRemaining = 6; }
        else if (age <= 30) { primeWindow = 'Prime'; yearsRemaining = 4; }
        else if (age <= 33) { primeWindow = 'Peak'; yearsRemaining = 2; }
        else { primeWindow = 'Declining'; yearsRemaining = 0; }
        break;
        
      default:
        primeWindow = 'Prime';
        yearsRemaining = 3;
    }
    
    return { age, primeWindow, yearsRemaining };
  }

  /**
   * Identify key risk factors
   */
  private identifyRiskFactors(playerData: any): string[] {
    const risks: string[] = [];
    
    if (playerData.injuryHistory?.length > 0) {
      risks.push('Injury history concerns');
    }
    
    if (playerData.age >= 29 && playerData.position === 'RB') {
      risks.push('Age cliff risk for RB position');
    }
    
    if (playerData.contractStatus === 'Expiring') {
      risks.push('Contract uncertainty');
    }
    
    if (playerData.targetCompetition === 'High') {
      risks.push('High target competition');
    }
    
    return risks;
  }

  /**
   * Calculate opportunity metrics
   */
  private calculateOpportunityMetrics(playerData: any): CompassProfile['opportunityMetrics'] {
    const usageSecurity = Math.min(10, (playerData.targetShare || 0) * 40);
    
    let targetCompetition: CompassProfile['opportunityMetrics']['targetCompetition'];
    if ((playerData.targetShare || 0) >= 0.25) targetCompetition = 'Minimal';
    else if ((playerData.targetShare || 0) >= 0.18) targetCompetition = 'Moderate';
    else if ((playerData.targetShare || 0) >= 0.12) targetCompetition = 'High';
    else targetCompetition = 'Severe';
    
    const environmentStability = playerData.teamStability || 7; // Default moderate stability
    
    return {
      usageSecurity,
      targetCompetition,
      environmentStability
    };
  }

  /**
   * Get age multipliers for different scenarios
   */
  private getAgeMultiplier(age: number, position: string): {
    dynasty: number;
    redraft: number;
    ceiling: number;
  } {
    // Simplified age curves - can be enhanced with your specific research
    if (position === 'RB') {
      if (age <= 25) return { dynasty: 1.2, redraft: 1.0, ceiling: 1.3 };
      if (age <= 28) return { dynasty: 1.0, redraft: 1.1, ceiling: 1.0 };
      return { dynasty: 0.7, redraft: 0.9, ceiling: 0.6 };
    }
    
    if (position === 'WR') {
      if (age <= 26) return { dynasty: 1.15, redraft: 1.0, ceiling: 1.2 };
      if (age <= 30) return { dynasty: 1.0, redraft: 1.05, ceiling: 1.0 };
      return { dynasty: 0.8, redraft: 0.95, ceiling: 0.7 };
    }
    
    // Default multipliers
    return { dynasty: 1.0, redraft: 1.0, ceiling: 1.0 };
  }

  /**
   * Estimate prometheus score if not available
   */
  private estimatePrometheusScore(playerData: any): number {
    // Simplified estimation - will integrate with actual Prometheus when available
    const baseScore = (playerData.fpg || 0) * 4; // Rough conversion
    return Math.min(100, Math.max(0, baseScore));
  }

  /**
   * Create base profile structure
   */
  private createBaseProfile(playerData: any): Partial<CompassProfile> {
    return {
      playerId: playerData.id || playerData.player_id || playerData.playerId || '',
      name: playerData.playerName || playerData.name || playerData.player_name || '',
      position: playerData.position as CompassProfile['position'],
      team: playerData.team || ''
    };
  }

  /**
   * Filter compass profiles based on criteria
   */
  filterProfiles(profiles: CompassProfile[], filters: CompassFilters): CompassProfile[] {
    return profiles.filter(profile => {
      // Position filter
      if (filters.positions && !filters.positions.includes(profile.position)) {
        return false;
      }
      
      // Tier filter
      if (filters.tiers && !filters.tiers.includes(profile.tier)) {
        return false;
      }
      
      // Tag filter
      if (filters.tags && !filters.tags.some(tag => profile.contextTags.includes(tag))) {
        return false;
      }
      
      // Team filter
      if (filters.teams && !filters.teams.includes(profile.team)) {
        return false;
      }
      
      // Age range filter
      if (filters.ageRange) {
        const age = profile.ageContext.age;
        if (age < filters.ageRange.min || age > filters.ageRange.max) {
          return false;
        }
      }
      
      // Scenario filter
      if (filters.scenarios) {
        const scenarioValue = profile.scenarios[filters.scenarios.scenario];
        if (scenarioValue < filters.scenarios.minValue) {
          return false;
        }
      }
      
      return true;
    });
  }
}