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
    
    // 🧭 NORTH (Tier Score - Core Talent): Scale to proper 0-10 range
    const tierScore = Math.min(10, anchorScore / 10);
    
    // 🧭 EAST (Context Tags): Calculate tag-based adjustments
    const contextTags = this.generateContextTags(playerData);
    let contextTagAdjustment = 0;
    
    contextTags.forEach(tag => {
      switch (tag) {
        case 'Win-Now': contextTagAdjustment += 0.1; break;
        case 'Dynasty-Build': contextTagAdjustment += 0.15; break;
        case 'Boom-Bust': contextTagAdjustment -= 0.2; break;
        case 'Usage-Secure': contextTagAdjustment += 0.25; break;
        case 'Floor-Play': contextTagAdjustment += 0.1; break;
        case 'Alpha-Potential': contextTagAdjustment += 0.2; break;
        case 'Target-Competition': contextTagAdjustment -= 0.15; break;
        case 'Age-Concern': contextTagAdjustment -= 0.1; break;
        case 'Injury-Risk': contextTagAdjustment -= 0.25; break;
        case 'Breakout-Candidate': contextTagAdjustment += 0.15; break;
      }
    });
    
    // 🧭 SOUTH (Scenario Score): Average of contending and rebuilding fit (scaled down)
    const contendingFit = Math.min(10, (anchorScore / 10) * (playerData.age <= 30 ? 1.0 : 0.85));
    const rebuildingFit = Math.min(10, (anchorScore / 10) * this.getAgeMultiplier(playerData.age, playerData.position).dynasty);
    const scenarioScore = (contendingFit + rebuildingFit) / 2;
    
    // 🧭 WEST (Market Efficiency/Value): Dynasty value vs current market perception
    let marketEfficiencyScore = 5.0; // Base score of 5 (neutral)
    
    // Age vs Production efficiency (young + productive = undervalued)
    if (playerData.age <= 25 && anchorScore >= 85) {
      marketEfficiencyScore += 2.0; // Young elite = great dynasty value
    } else if (playerData.age >= 30 && anchorScore >= 80) {
      marketEfficiencyScore -= 1.5; // Aging but productive = sell-high candidate
    }
    
    // Target share efficiency (high production with lower target share = efficient)
    const targetShare = playerData.targetShare || 0;
    if (targetShare <= 0.18 && anchorScore >= 80) {
      marketEfficiencyScore += 1.0; // Efficient with targets
    } else if (targetShare >= 0.28) {
      marketEfficiencyScore -= 0.5; // High target dependency
    }
    
    // Contract/stability value
    if (playerData.contractStatus === 'Secure' || playerData.contractStatus === 'Active') {
      marketEfficiencyScore += 0.5; // Stable situation
    } else if (playerData.contractStatus === 'Expiring') {
      marketEfficiencyScore -= 0.5; // Uncertainty
    }
    
    // Injury risk vs opportunity
    if (playerData.injuryHistory && playerData.injuryHistory.length > 0) {
      marketEfficiencyScore -= 1.0; // Injury risk reduces dynasty value
    }
    
    // Cap the market efficiency score
    const keyInsightAdjustment = Math.min(10, Math.max(0, marketEfficiencyScore)) - 5; // Convert to adjustment (-5 to +5)
    
    // Calculate final compass score: Equal 25% weighting for all four directions
    const rawScore = (tierScore * 0.25) + (contextTagAdjustment * 0.25) + (scenarioScore * 0.25) + (keyInsightAdjustment * 0.25);
    const finalScore = Math.min(10, Math.max(1, rawScore)); // Floor at 1, ceiling at 10
    
    // Optional debug logging (disabled in production)
    // console.log(`🧭 DEBUG ${playerData.name}: Anchor=${anchorScore}, Tier=${tierScore.toFixed(2)}, Tags=${contextTagAdjustment}, Scenario=${scenarioScore.toFixed(2)}, Insights=${keyInsightAdjustment}, Final=${finalScore.toFixed(2)}`);
    
    return {
      anchor_score: anchorScore,
      tier_score: Math.round(tierScore * 100) / 100,
      context_tag_adjustment: Math.round(contextTagAdjustment * 100) / 100,
      scenario_score: Math.round(scenarioScore * 100) / 100,
      key_insight_adjustment: Math.round(keyInsightAdjustment * 100) / 100,
      final_compass_score: Math.round(finalScore * 100) / 100
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
      playerId: playerData.id || playerData.player_id || '',
      name: playerData.name || playerData.player_name || '',
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