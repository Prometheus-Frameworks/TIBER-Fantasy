/**
 * Dynasty Decline Detection Framework
 * Identifies players at risk of value deterioration through skill-isolating metrics
 */

export interface DeclineIndicator {
  metric: string;
  currentValue: number;
  previousValue: number;
  twoYearsAgo?: number;
  decline: number;
  isSignificant: boolean;
}

export interface DeclineAssessment {
  playerId: string;
  playerName: string;
  position: string;
  riskLevel: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  declineIndicators: DeclineIndicator[];
  riskTags: DeclineRiskTag[];
  overallScore: number; // 0-100, lower = more decline risk
  recommendation: string;
  contextualFactors: string[];
}

export type DeclineRiskTag = 
  | 'SkillDecayRisk'      // One-year trend suggesting possible decline
  | 'DeclineVerified'     // Two+ seasons of skill-based regression
  | 'SystemDependent'     // Performance reliant on scheme or QB play
  | 'Post-Context Cliff'; // At risk of steep drop-off after system change

export interface PlayerMetricHistory {
  playerId: string;
  season: number;
  yacOverExpected?: number;
  missedTacklesForced?: number;
  targetShare?: number;
  firstReadShare?: number;
  epaPerTouch?: number;
  wopr?: number;
  yprr?: number;
  yardsOverExpected?: number;
  snapCount?: number;
  contextualFactors?: {
    qbRating?: number;
    offensiveScheme?: string;
    injuryStatus?: string;
  };
}

export class DynastyDeclineDetector {
  
  /**
   * Assess decline risk for a player based on multi-season metrics
   */
  assessDeclineRisk(playerHistory: PlayerMetricHistory[]): DeclineAssessment {
    if (playerHistory.length < 2) {
      return this.createMinimalAssessment(playerHistory[0]);
    }

    const sortedHistory = playerHistory.sort((a, b) => b.season - a.season);
    const current = sortedHistory[0];
    const previous = sortedHistory[1];
    const twoYearsAgo = sortedHistory[2];

    const indicators = this.analyzeDeclineIndicators(current, previous, twoYearsAgo);
    const riskTags = this.generateRiskTags(indicators, sortedHistory);
    const riskLevel = this.calculateRiskLevel(indicators, riskTags);
    const overallScore = this.calculateDeclineScore(indicators, riskTags);

    return {
      playerId: current.playerId,
      playerName: `Player ${current.playerId}`, // Will be enhanced with actual names
      position: this.inferPosition(current),
      riskLevel,
      declineIndicators: indicators,
      riskTags,
      overallScore,
      recommendation: this.generateRecommendation(riskLevel, riskTags),
      contextualFactors: this.analyzeContextualFactors(sortedHistory)
    };
  }

  /**
   * Analyze skill-isolating metrics for decline patterns
   */
  private analyzeDeclineIndicators(
    current: PlayerMetricHistory,
    previous: PlayerMetricHistory,
    twoYearsAgo?: PlayerMetricHistory
  ): DeclineIndicator[] {
    const indicators: DeclineIndicator[] = [];

    // YAC over Expected decline
    if (current.yacOverExpected !== undefined && previous.yacOverExpected !== undefined) {
      const decline = ((current.yacOverExpected - previous.yacOverExpected) / previous.yacOverExpected) * 100;
      indicators.push({
        metric: 'YAC over Expected',
        currentValue: current.yacOverExpected,
        previousValue: previous.yacOverExpected,
        twoYearsAgo: twoYearsAgo?.yacOverExpected,
        decline,
        isSignificant: decline < -15 // 15% decline threshold
      });
    }

    // Missed tackles forced decline
    if (current.missedTacklesForced !== undefined && previous.missedTacklesForced !== undefined) {
      const decline = ((current.missedTacklesForced - previous.missedTacklesForced) / previous.missedTacklesForced) * 100;
      indicators.push({
        metric: 'Missed Tackles Forced',
        currentValue: current.missedTacklesForced,
        previousValue: previous.missedTacklesForced,
        twoYearsAgo: twoYearsAgo?.missedTacklesForced,
        decline,
        isSignificant: decline < -20 // 20% decline threshold
      });
    }

    // Target share decline (accounting for snap counts)
    if (current.targetShare !== undefined && previous.targetShare !== undefined) {
      const snapAdjusted = this.adjustForSnapCounts(current, previous, 'targetShare');
      const decline = snapAdjusted.decline;
      indicators.push({
        metric: 'Target Share (Snap-Adjusted)',
        currentValue: snapAdjusted.current,
        previousValue: snapAdjusted.previous,
        twoYearsAgo: twoYearsAgo?.targetShare,
        decline,
        isSignificant: decline < -10 && snapAdjusted.snapCountStable
      });
    }

    // EPA per touch decline
    if (current.epaPerTouch !== undefined && previous.epaPerTouch !== undefined) {
      const decline = ((current.epaPerTouch - previous.epaPerTouch) / Math.abs(previous.epaPerTouch)) * 100;
      indicators.push({
        metric: 'EPA per Touch',
        currentValue: current.epaPerTouch,
        previousValue: previous.epaPerTouch,
        twoYearsAgo: twoYearsAgo?.epaPerTouch,
        decline,
        isSignificant: decline < -25 // 25% decline threshold
      });
    }

    // WOPR decline
    if (current.wopr !== undefined && previous.wopr !== undefined) {
      const decline = ((current.wopr - previous.wopr) / previous.wopr) * 100;
      indicators.push({
        metric: 'WOPR',
        currentValue: current.wopr,
        previousValue: previous.wopr,
        twoYearsAgo: twoYearsAgo?.wopr,
        decline,
        isSignificant: decline < -15
      });
    }

    // YPRR decline
    if (current.yprr !== undefined && previous.yprr !== undefined) {
      const decline = ((current.yprr - previous.yprr) / previous.yprr) * 100;
      indicators.push({
        metric: 'YPRR',
        currentValue: current.yprr,
        previousValue: previous.yprr,
        twoYearsAgo: twoYearsAgo?.yprr,
        decline,
        isSignificant: decline < -12 // 12% decline threshold
      });
    }

    return indicators;
  }

  /**
   * Generate risk tags based on decline patterns
   */
  private generateRiskTags(indicators: DeclineIndicator[], history: PlayerMetricHistory[]): DeclineRiskTag[] {
    const tags: DeclineRiskTag[] = [];
    const significantDeclines = indicators.filter(i => i.isSignificant);
    const multiYearDeclines = indicators.filter(i => 
      i.twoYearsAgo !== undefined && 
      i.currentValue < i.previousValue && 
      i.previousValue < i.twoYearsAgo
    );

    // SkillDecayRisk: One-year significant decline
    if (significantDeclines.length >= 2) {
      tags.push('SkillDecayRisk');
    }

    // DeclineVerified: Two+ seasons of skill-based regression
    if (multiYearDeclines.length >= 2) {
      tags.push('DeclineVerified');
    }

    // SystemDependent: Performance tied to external factors
    if (this.isSystemDependent(history)) {
      tags.push('SystemDependent');
    }

    // Post-Context Cliff: Risk of steep drop-off
    if (tags.includes('SystemDependent') && significantDeclines.length >= 1) {
      tags.push('Post-Context Cliff');
    }

    return tags;
  }

  /**
   * Calculate overall risk level
   */
  private calculateRiskLevel(indicators: DeclineIndicator[], tags: DeclineRiskTag[]): 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL' {
    const significantDeclines = indicators.filter(i => i.isSignificant).length;
    
    if (tags.includes('DeclineVerified') && tags.includes('Post-Context Cliff')) {
      return 'CRITICAL';
    }
    if (tags.includes('DeclineVerified') || significantDeclines >= 3) {
      return 'HIGH';
    }
    if (tags.includes('SkillDecayRisk') || significantDeclines >= 2) {
      return 'MODERATE';
    }
    return 'LOW';
  }

  /**
   * Calculate numerical decline score (0-100, lower = more risk)
   */
  private calculateDeclineScore(indicators: DeclineIndicator[], tags: DeclineRiskTag[]): number {
    let score = 100;

    // Penalize for significant declines
    const significantDeclines = indicators.filter(i => i.isSignificant);
    score -= significantDeclines.length * 15;

    // Penalize for risk tags
    tags.forEach(tag => {
      switch (tag) {
        case 'SkillDecayRisk': score -= 10; break;
        case 'DeclineVerified': score -= 25; break;
        case 'SystemDependent': score -= 15; break;
        case 'Post-Context Cliff': score -= 20; break;
      }
    });

    // Consider magnitude of declines
    indicators.forEach(indicator => {
      if (indicator.isSignificant && indicator.decline < -30) {
        score -= 10; // Extra penalty for severe declines
      }
    });

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Adjust metrics for snap count changes
   */
  private adjustForSnapCounts(
    current: PlayerMetricHistory, 
    previous: PlayerMetricHistory, 
    metric: keyof PlayerMetricHistory
  ): { current: number; previous: number; decline: number; snapCountStable: boolean } {
    const currentValue = current[metric] as number;
    const previousValue = previous[metric] as number;
    const currentSnaps = current.snapCount || 100;
    const previousSnaps = previous.snapCount || 100;
    
    const snapChange = Math.abs((currentSnaps - previousSnaps) / previousSnaps);
    const snapCountStable = snapChange < 0.15; // 15% threshold for stability
    
    // If snap counts are stable, use raw decline
    if (snapCountStable) {
      const decline = ((currentValue - previousValue) / previousValue) * 100;
      return { current: currentValue, previous: previousValue, decline, snapCountStable };
    }
    
    // Adjust for snap count changes
    const snapAdjustedCurrent = currentValue * (previousSnaps / currentSnaps);
    const decline = ((snapAdjustedCurrent - previousValue) / previousValue) * 100;
    
    return { current: snapAdjustedCurrent, previous: previousValue, decline, snapCountStable };
  }

  /**
   * Determine if player is system-dependent
   */
  private isSystemDependent(history: PlayerMetricHistory[]): boolean {
    if (history.length < 2) return false;
    
    const recent = history.slice(0, 2);
    const hasQBChange = recent[0].contextualFactors?.qbRating !== recent[1].contextualFactors?.qbRating;
    const hasSchemeChange = recent[0].contextualFactors?.offensiveScheme !== recent[1].contextualFactors?.offensiveScheme;
    
    // If performance varies significantly with context changes
    return hasQBChange || hasSchemeChange;
  }

  /**
   * Generate actionable recommendation
   */
  private generateRecommendation(riskLevel: string, tags: DeclineRiskTag[]): string {
    switch (riskLevel) {
      case 'CRITICAL':
        return 'SELL IMMEDIATELY: Multiple skill metrics declining, high system dependency risk';
      case 'HIGH':
        return 'CONSIDER SELLING: Clear decline pattern established, value likely to decrease';
      case 'MODERATE':
        return 'MONITOR CLOSELY: Early warning signs present, evaluate trade opportunities';
      case 'LOW':
      default:
        return 'HOLD/BUY: No significant decline indicators detected';
    }
  }

  /**
   * Analyze contextual factors affecting performance
   */
  private analyzeContextualFactors(history: PlayerMetricHistory[]): string[] {
    const factors: string[] = [];
    
    if (history.length < 2) return factors;
    
    const current = history[0];
    const previous = history[1];
    
    // QB rating changes
    if (current.contextualFactors?.qbRating && previous.contextualFactors?.qbRating) {
      const qbChange = current.contextualFactors.qbRating - previous.contextualFactors.qbRating;
      if (Math.abs(qbChange) > 10) {
        factors.push(`QB Rating change: ${qbChange > 0 ? '+' : ''}${qbChange.toFixed(1)}`);
      }
    }
    
    // Scheme changes
    if (current.contextualFactors?.offensiveScheme !== previous.contextualFactors?.offensiveScheme) {
      factors.push(`Offensive scheme change: ${previous.contextualFactors?.offensiveScheme} → ${current.contextualFactors?.offensiveScheme}`);
    }
    
    // Injury considerations
    if (current.contextualFactors?.injuryStatus) {
      factors.push(`Injury status: ${current.contextualFactors.injuryStatus}`);
    }
    
    return factors;
  }

  /**
   * Infer position from available metrics
   */
  private inferPosition(metrics: PlayerMetricHistory): string {
    if (metrics.yprr !== undefined || metrics.targetShare !== undefined) return 'WR/TE';
    if (metrics.missedTacklesForced !== undefined) return 'RB';
    return 'UNKNOWN';
  }

  /**
   * Create minimal assessment for single season
   */
  private createMinimalAssessment(current: PlayerMetricHistory): DeclineAssessment {
    return {
      playerId: current.playerId,
      playerName: `Player ${current.playerId}`,
      position: this.inferPosition(current),
      riskLevel: 'LOW',
      declineIndicators: [],
      riskTags: [],
      overallScore: 85, // Default safe score
      recommendation: 'INSUFFICIENT DATA: Need multiple seasons for decline analysis',
      contextualFactors: []
    };
  }
}

export const dynastyDeclineDetector = new DynastyDeclineDetector();