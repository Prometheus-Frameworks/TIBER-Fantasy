/**
 * Comprehensive Rookie Evaluation System
 * Combines College Production (30%) + Draft Capital (25%) + Athletic Metrics (20%) + Team Opportunity (25%)
 * Weighted by historical rookie success trends and position-specific factors
 */

export interface RookieEvaluationProfile {
  // Basic Info
  id: string;
  name: string;
  position: 'QB' | 'RB' | 'WR' | 'TE';
  college: string;
  draftYear: number;
  nflTeam?: string;
  
  // Evaluation Components (weighted scores 0-100)
  collegeProduction: {
    score: number;           // 0-100 based on college PPG vs position
    ppgScaled: number;       // College fantasy points scaled to position
    dominatorRating: number; // Market share of team production
    breakoutAge: number;     // Age at first dominant season
    rawStats: {
      games: number;
      yards: number;
      touchdowns: number;
      receptions?: number;   // For skill positions
      targets?: number;      // For WR/TE
    };
  };
  
  draftCapital: {
    score: number;           // 0-100 based on draft position value
    round: number;
    pick: number;
    draftValue: number;      // Historical success rate by pick
    positionDraftRank: number; // Where drafted vs other positions
  };
  
  athleticMetrics: {
    score: number;           // 0-100 composite athletic score
    combineGrade: number;    // Verified combine performance
    rasScore?: number;       // Relative Athletic Score if available
    estimatedMetrics: {
      fortyYard?: number;
      verticalJump?: number;
      broadJump?: number;
      threeConeDrill?: number;
      twentyYardShuttle?: number;
    };
    physicalProfile: {
      height: number;        // Inches
      weight: number;        // Pounds
      bmi: number;
      armLength?: number;    // Inches
      handSize?: number;     // Inches
    };
  };
  
  teamOpportunity: {
    score: number;           // 0-100 opportunity projection
    projectedTargets?: number; // For WR/TE
    projectedTouches?: number;  // For RB
    depthChartPosition: number; // 1-5 projected depth
    competitionLevel: number;   // 0-100 based on incumbent talent
    offensiveScheme: {
      passVolume: number;    // Team pass attempts projection
      redZoneOpportunity: number; // Red zone target share projection
      rookieFriendly: number; // Historical rookie usage
    };
  };
  
  // Final Evaluation
  overallScore: number;      // 0-100 composite rookie value
  tier: 'Elite' | 'Premium' | 'Solid' | 'Depth' | 'Dart Throw';
  confidence: number;        // 0-100 confidence in projection
  breakoutProbability: number; // 0-100 chance of rookie success
  
  // Context & Analysis
  historicalComparisons: string[]; // Similar rookie profiles
  strengthsAnalysis: string[];     // Key positive factors
  concernsAnalysis: string[];      // Risk factors
  yearOneProjection: {
    lowEnd: number;          // Conservative fantasy points
    mostLikely: number;      // Expected fantasy points
    upside: number;          // Best-case fantasy points
  };
}

/**
 * Historical Rookie Success Patterns by Position and Draft Capital
 */
export const ROOKIE_SUCCESS_PATTERNS = {
  QB: {
    firstRound: { hitRate: 65, avgYearOnePoints: 285, topPerformers: ['Andrew Luck', 'Cam Newton', 'Dak Prescott'] },
    secondRound: { hitRate: 35, avgYearOnePoints: 180, topPerformers: ['Derek Carr', 'Drew Brees', 'Russell Wilson'] },
    dayThree: { hitRate: 15, avgYearOnePoints: 95, topPerformers: ['Tom Brady', 'Tony Romo', 'Gardner Minshew'] }
  },
  RB: {
    firstRound: { hitRate: 75, avgYearOnePoints: 195, topPerformers: ['Saquon Barkley', 'Ezekiel Elliott', 'Adrian Peterson'] },
    secondRound: { hitRate: 45, avgYearOnePoints: 145, topPerformers: ['Nick Chubb', 'Dalvin Cook', 'Alvin Kamara'] },
    dayThree: { hitRate: 20, avgYearOnePoints: 85, topPerformers: ['Kareem Hunt', 'James Robinson', 'Phillip Lindsay'] }
  },
  WR: {
    firstRound: { hitRate: 60, avgYearOnePoints: 165, topPerformers: ['Ja\'Marr Chase', 'Justin Jefferson', 'Odell Beckham'] },
    secondRound: { hitRate: 35, avgYearOnePoints: 115, topPerformers: ['DK Metcalf', 'Deebo Samuel', 'Terry McLaurin'] },
    dayThree: { hitRate: 15, avgYearOnePoints: 75, topPerformers: ['Tyreek Hill', 'Antonio Brown', 'Julian Edelman'] }
  },
  TE: {
    firstRound: { hitRate: 45, avgYearOnePoints: 125, topPerformers: ['Rob Gronkowski', 'Travis Kelce', 'Mark Andrews'] },
    secondRound: { hitRate: 25, avgYearOnePoints: 85, topPerformers: ['George Kittle', 'Dallas Goedert', 'Hunter Henry'] },
    dayThree: { hitRate: 10, avgYearOnePoints: 55, topPerformers: ['Antonio Gates', 'Jason Witten', 'Darren Waller'] }
  }
};

/**
 * Position-Specific College Production Benchmarks
 */
export const COLLEGE_PRODUCTION_BENCHMARKS = {
  QB: {
    elite: 28.0,      // Fantasy PPG in college
    good: 22.0,
    average: 18.0,
    below: 15.0
  },
  RB: {
    elite: 18.5,
    good: 15.0,
    average: 12.0,
    below: 9.0
  },
  WR: {
    elite: 16.0,
    good: 12.5,
    average: 9.5,
    below: 7.0
  },
  TE: {
    elite: 12.0,
    good: 9.0,
    average: 6.5,
    below: 4.5
  }
};

/**
 * Athletic Thresholds by Position (based on NFL success patterns)
 */
export const ATHLETIC_THRESHOLDS = {
  QB: {
    height: { elite: 76, good: 74, concern: 72 }, // inches
    weight: { elite: 230, good: 220, concern: 205 },
    fortyYard: { elite: 4.6, good: 4.8, concern: 5.0 }
  },
  RB: {
    height: { elite: 72, good: 70, concern: 68 },
    weight: { elite: 220, good: 205, concern: 190 },
    fortyYard: { elite: 4.4, good: 4.5, concern: 4.7 }
  },
  WR: {
    height: { elite: 74, good: 72, concern: 70 },
    weight: { elite: 210, good: 195, concern: 180 },
    fortyYard: { elite: 4.4, good: 4.5, concern: 4.6 }
  },
  TE: {
    height: { elite: 78, good: 76, concern: 74 },
    weight: { elite: 260, good: 245, concern: 230 },
    fortyYard: { elite: 4.6, good: 4.7, concern: 4.9 }
  }
};

export class RookieEvaluationEngine {
  
  /**
   * Comprehensive rookie evaluation with weighted components
   */
  evaluateRookie(rookieData: Partial<RookieEvaluationProfile>): RookieEvaluationProfile {
    const position = rookieData.position!;
    
    // Calculate component scores
    const collegeScore = this.calculateCollegeProductionScore(rookieData, position);
    const draftScore = this.calculateDraftCapitalScore(rookieData, position);
    const athleticScore = this.calculateAthleticScore(rookieData, position);
    const opportunityScore = this.calculateTeamOpportunityScore(rookieData, position);
    
    // Weighted composite score: College (30%) + Draft (25%) + Athletic (20%) + Opportunity (25%)
    const overallScore = Math.round(
      (collegeScore * 0.30) + 
      (draftScore * 0.25) + 
      (athleticScore * 0.20) + 
      (opportunityScore * 0.25)
    );
    
    // Determine tier and projections
    const tier = this.assignRookieTier(overallScore, position);
    const confidence = this.calculateConfidence(rookieData, position);
    const breakoutProbability = this.calculateBreakoutProbability(overallScore, position, rookieData);
    
    return {
      id: rookieData.id || `rookie_${rookieData.name?.replace(/\s+/g, '_').toLowerCase()}`,
      name: rookieData.name || 'Unknown Rookie',
      position,
      college: rookieData.college || 'Unknown College',
      draftYear: rookieData.draftYear || 2025,
      nflTeam: rookieData.nflTeam,
      
      collegeProduction: this.buildCollegeProfile(rookieData, position, collegeScore),
      draftCapital: this.buildDraftProfile(rookieData, position, draftScore),
      athleticMetrics: this.buildAthleticProfile(rookieData, position, athleticScore),
      teamOpportunity: this.buildOpportunityProfile(rookieData, position, opportunityScore),
      
      overallScore,
      tier,
      confidence,
      breakoutProbability,
      
      historicalComparisons: this.findHistoricalComparisons(rookieData, position),
      strengthsAnalysis: this.identifyStrengths(rookieData, position),
      concernsAnalysis: this.identifyConcerns(rookieData, position),
      yearOneProjection: this.projectYearOneFantasy(overallScore, position, rookieData)
    };
  }
  
  /**
   * College Production Score (30% weight)
   * Scales college fantasy performance relative to position benchmarks
   */
  private calculateCollegeProductionScore(rookieData: any, position: string): number {
    const benchmarks = COLLEGE_PRODUCTION_BENCHMARKS[position as keyof typeof COLLEGE_PRODUCTION_BENCHMARKS];
    const collegePPG = rookieData.collegeProduction?.ppgScaled || 0;
    
    if (collegePPG >= benchmarks.elite) return 100;
    if (collegePPG >= benchmarks.good) return 80;
    if (collegePPG >= benchmarks.average) return 60;
    if (collegePPG >= benchmarks.below) return 40;
    return 20;
  }
  
  /**
   * Draft Capital Score (25% weight)
   * Historical success rates by draft position
   */
  private calculateDraftCapitalScore(rookieData: any, position: string): number {
    const round = rookieData.draftCapital?.round || 7;
    const pick = rookieData.draftCapital?.pick || 250;
    
    // First round picks (1-32)
    if (round === 1) {
      if (pick <= 10) return 100;  // Top 10 picks
      if (pick <= 20) return 90;   // Mid-first
      return 80;                   // Late first
    }
    
    // Second round (33-64)
    if (round === 2) {
      if (pick <= 45) return 70;   // Early second
      return 60;                   // Late second
    }
    
    // Third round (65-96)
    if (round === 3) return 50;
    
    // Day 3 picks (rounds 4-7)
    if (round <= 5) return 30;     // Rounds 4-5
    return 15;                     // Rounds 6-7 or UDFA
  }
  
  /**
   * Athletic Score (20% weight)
   * Combine metrics and physical measurements
   */
  private calculateAthleticScore(rookieData: any, position: string): number {
    const thresholds = ATHLETIC_THRESHOLDS[position as keyof typeof ATHLETIC_THRESHOLDS];
    const physical = rookieData.athleticMetrics?.physicalProfile || {};
    const metrics = rookieData.athleticMetrics?.estimatedMetrics || {};
    
    let score = 50; // Base score
    
    // Height evaluation
    if (physical.height >= thresholds.height.elite) score += 15;
    else if (physical.height >= thresholds.height.good) score += 10;
    else if (physical.height < thresholds.height.concern) score -= 10;
    
    // Weight evaluation
    if (physical.weight >= thresholds.weight.elite) score += 15;
    else if (physical.weight >= thresholds.weight.good) score += 10;
    else if (physical.weight < thresholds.weight.concern) score -= 10;
    
    // 40-yard dash evaluation
    if (metrics.fortyYard && metrics.fortyYard <= thresholds.fortyYard.elite) score += 20;
    else if (metrics.fortyYard && metrics.fortyYard <= thresholds.fortyYard.good) score += 10;
    else if (metrics.fortyYard && metrics.fortyYard > thresholds.fortyYard.concern) score -= 15;
    
    return Math.max(0, Math.min(100, score));
  }
  
  /**
   * Team Opportunity Score (25% weight)
   * Projected role and situation
   */
  private calculateTeamOpportunityScore(rookieData: any, position: string): number {
    const opportunity = rookieData.teamOpportunity || {};
    
    let score = 50; // Base score
    
    // Depth chart position
    const depth = opportunity.depthChartPosition || 3;
    if (depth === 1) score += 30;      // Immediate starter
    else if (depth === 2) score += 15; // Backup with upside
    else if (depth >= 4) score -= 20;  // Buried on depth chart
    
    // Competition level (inverse - less competition = higher score)
    const competition = opportunity.competitionLevel || 50;
    score += (100 - competition) * 0.2;
    
    // Offensive scheme factors
    const scheme = opportunity.offensiveScheme || {};
    if (scheme.rookieFriendly >= 80) score += 10;
    if (scheme.passVolume >= 600) score += 10; // High-volume passing offense
    
    return Math.max(0, Math.min(100, score));
  }
  
  /**
   * Assign rookie tier based on overall score
   */
  private assignRookieTier(score: number, position: string): 'Elite' | 'Premium' | 'Solid' | 'Depth' | 'Dart Throw' {
    if (score >= 85) return 'Elite';      // Generational prospects
    if (score >= 70) return 'Premium';    // Strong rookie contributors
    if (score >= 55) return 'Solid';      // Reliable depth/potential
    if (score >= 40) return 'Depth';      // Developmental players
    return 'Dart Throw';                  // Long-shot prospects
  }
  
  /**
   * Calculate confidence in projection based on data quality
   */
  private calculateConfidence(rookieData: any, position: string): number {
    let confidence = 50;
    
    // Data completeness boosts confidence
    if (rookieData.collegeProduction?.rawStats?.games >= 24) confidence += 15; // 2+ seasons
    if (rookieData.draftCapital?.round <= 3) confidence += 20; // Drafted player
    if (rookieData.athleticMetrics?.combineGrade) confidence += 15; // Combine data
    if (rookieData.teamOpportunity?.depthChartPosition <= 2) confidence += 10; // Clear role
    
    return Math.min(100, confidence);
  }
  
  /**
   * Calculate breakout probability using historical patterns
   */
  private calculateBreakoutProbability(score: number, position: string, rookieData: any): number {
    const round = rookieData.draftCapital?.round || 7;
    const patterns = ROOKIE_SUCCESS_PATTERNS[position as keyof typeof ROOKIE_SUCCESS_PATTERNS];
    
    let baseRate = 15; // Default for late picks
    if (round === 1) baseRate = patterns.firstRound.hitRate;
    else if (round === 2) baseRate = patterns.secondRound.hitRate;
    else if (round === 3) baseRate = patterns.dayThree.hitRate;
    
    // Adjust based on overall score
    const scoreMultiplier = score / 70; // 70 is average good prospect
    return Math.round(Math.min(95, baseRate * scoreMultiplier));
  }
  
  /**
   * Build detailed component profiles
   */
  private buildCollegeProfile(rookieData: any, position: string, score: number): any {
    const college = rookieData.collegeProduction || {};
    return {
      score,
      ppgScaled: college.ppgScaled || 0,
      dominatorRating: college.dominatorRating || 0,
      breakoutAge: college.breakoutAge || 20,
      rawStats: college.rawStats || {}
    };
  }
  
  private buildDraftProfile(rookieData: any, position: string, score: number): any {
    const draft = rookieData.draftCapital || {};
    return {
      score,
      round: draft.round || 7,
      pick: draft.pick || 250,
      draftValue: score,
      positionDraftRank: draft.positionDraftRank || 20
    };
  }
  
  private buildAthleticProfile(rookieData: any, position: string, score: number): any {
    const athletic = rookieData.athleticMetrics || {};
    return {
      score,
      combineGrade: athletic.combineGrade || 0,
      rasScore: athletic.rasScore,
      estimatedMetrics: athletic.estimatedMetrics || {},
      physicalProfile: athletic.physicalProfile || {}
    };
  }
  
  private buildOpportunityProfile(rookieData: any, position: string, score: number): any {
    const opportunity = rookieData.teamOpportunity || {};
    return {
      score,
      projectedTargets: opportunity.projectedTargets,
      projectedTouches: opportunity.projectedTouches,
      depthChartPosition: opportunity.depthChartPosition || 3,
      competitionLevel: opportunity.competitionLevel || 50,
      offensiveScheme: opportunity.offensiveScheme || {}
    };
  }
  
  /**
   * Find similar historical prospects
   */
  private findHistoricalComparisons(rookieData: any, position: string): string[] {
    const round = rookieData.draftCapital?.round || 7;
    const patterns = ROOKIE_SUCCESS_PATTERNS[position as keyof typeof ROOKIE_SUCCESS_PATTERNS];
    
    if (round === 1) return patterns.firstRound.topPerformers.slice(0, 2);
    if (round === 2) return patterns.secondRound.topPerformers.slice(0, 2);
    return patterns.dayThree.topPerformers.slice(0, 2);
  }
  
  /**
   * Identify key strengths
   */
  private identifyStrengths(rookieData: any, position: string): string[] {
    const strengths: string[] = [];
    
    if (rookieData.draftCapital?.round === 1) strengths.push("High draft capital");
    if (rookieData.collegeProduction?.dominatorRating >= 35) strengths.push("College domination");
    if (rookieData.teamOpportunity?.depthChartPosition === 1) strengths.push("Immediate opportunity");
    if (rookieData.athleticMetrics?.rasScore >= 8.0) strengths.push("Elite athleticism");
    
    return strengths.length ? strengths : ["Development potential"];
  }
  
  /**
   * Identify concerns
   */
  private identifyConcerns(rookieData: any, position: string): string[] {
    const concerns: string[] = [];
    
    if (rookieData.draftCapital?.round >= 6) concerns.push("Limited draft capital");
    if (rookieData.teamOpportunity?.competitionLevel >= 80) concerns.push("Heavy competition");
    if (rookieData.collegeProduction?.breakoutAge >= 22) concerns.push("Late bloomer");
    if (rookieData.athleticMetrics?.combineGrade <= 3) concerns.push("Athletic limitations");
    
    return concerns.length ? concerns : ["Standard rookie risk"];
  }
  
  /**
   * Project year-one fantasy performance
   */
  private projectYearOneFantasy(score: number, position: string, rookieData: any): any {
    const round = rookieData.draftCapital?.round || 7;
    const patterns = ROOKIE_SUCCESS_PATTERNS[position as keyof typeof ROOKIE_SUCCESS_PATTERNS];
    
    let baseline = patterns.dayThree.avgYearOnePoints;
    if (round === 1) baseline = patterns.firstRound.avgYearOnePoints;
    else if (round === 2) baseline = patterns.secondRound.avgYearOnePoints;
    
    const multiplier = score / 70; // Adjust based on overall evaluation
    const mostLikely = Math.round(baseline * multiplier);
    
    return {
      lowEnd: Math.round(mostLikely * 0.6),
      mostLikely,
      upside: Math.round(mostLikely * 1.8)
    };
  }
}

export const rookieEvaluationEngine = new RookieEvaluationEngine();