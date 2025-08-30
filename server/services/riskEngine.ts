/**
 * Risk Engine - Age penalty, injury risk, and volatility calculations
 * Part of DeepSeek v3.2 + Compass fusion system
 */

interface RiskComponents {
  age_penalty: number;
  injury_risk: number;
  volatility: number;
}

interface AgeConfig {
  peak_age: number;
  decline_start: number;
  cliff_age: number;
}

// Load age curves from config
const AGE_CURVES = {
  "RB": { peak_age: 25, decline_start: 27, cliff_age: 29 },
  "WR": { peak_age: 26, decline_start: 29, cliff_age: 32 },
  "TE": { peak_age: 27, decline_start: 30, cliff_age: 33 },
  "QB": { peak_age: 28, decline_start: 33, cliff_age: 37 }
};

export class RiskEngine {
  
  /**
   * Calculate age penalty for position-specific age curves
   * Returns 0-100 scale where 100 = maximum risk
   */
  calculateAgePenalty(age: number, position: string): number {
    const curve = AGE_CURVES[position as keyof typeof AGE_CURVES];
    if (!curve) return 50; // Unknown position default
    
    if (age <= curve.peak_age) {
      // Young player - minimal penalty
      return Math.max(0, (curve.peak_age - age) * 2); // Slight penalty for very young
    } else if (age <= curve.decline_start) {
      // Prime years - low penalty
      return 10 + ((age - curve.peak_age) / (curve.decline_start - curve.peak_age)) * 15;
    } else if (age <= curve.cliff_age) {
      // Decline phase - moderate to high penalty
      const progress = (age - curve.decline_start) / (curve.cliff_age - curve.decline_start);
      return 25 + (progress * 40); // 25-65 range
    } else {
      // Post-cliff - severe penalty
      const yearsOverCliff = age - curve.cliff_age;
      return Math.min(100, 65 + (yearsOverCliff * 10));
    }
  }
  
  /**
   * Calculate injury risk based on games missed and injury patterns
   * Returns 0-100 scale where 100 = maximum risk
   */
  calculateInjuryRisk(playerData: any): number {
    const gamesMissedLastTwoYears = playerData.games_missed_2yr || 0;
    const injuryHistory = playerData.injury_history || [];
    const hasRecurringInjury = playerData.has_recurring_injury || false;
    
    let riskScore = 0;
    
    // Games missed penalty (0-4 games = low, 5-8 = moderate, 9+ = high)
    if (gamesMissedLastTwoYears >= 9) {
      riskScore += 50;
    } else if (gamesMissedLastTwoYears >= 5) {
      riskScore += 25;
    } else if (gamesMissedLastTwoYears >= 2) {
      riskScore += 10;
    }
    
    // Injury history length
    riskScore += Math.min(30, injuryHistory.length * 5);
    
    // Recurring injury flag
    if (hasRecurringInjury) {
      riskScore += 20;
    }
    
    // Soft tissue injury pattern (from notes/tags)
    const notes = (playerData.notes || '').toLowerCase();
    const hasSoftTissue = notes.includes('hamstring') || 
                         notes.includes('groin') || 
                         notes.includes('calf') ||
                         notes.includes('quad');
    if (hasSoftTissue) {
      riskScore += 15;
    }
    
    return Math.min(100, Math.max(0, riskScore));
  }
  
  /**
   * Calculate volatility based on fantasy point consistency
   * Returns 0-100 scale where 100 = maximum volatility (risk)
   */
  calculateVolatility(playerData: any): number {
    const weeklyScores = playerData.weekly_scores || [];
    const seasonAvg = playerData.season_avg_fpts || 0;
    
    if (weeklyScores.length < 4) {
      // Insufficient data - use position-based default
      const position = playerData.position;
      if (position === 'RB') return 35; // RBs generally more volatile
      if (position === 'WR') return 30; // WRs moderate volatility
      if (position === 'TE') return 40; // TEs very volatile
      if (position === 'QB') return 25; // QBs most consistent
      return 30; // Default
    }
    
    // Calculate coefficient of variation (CV)
    const mean = weeklyScores.reduce((sum: number, score: number) => sum + score, 0) / weeklyScores.length;
    const variance = weeklyScores.reduce((sum: number, score: number) => sum + Math.pow(score - mean, 2), 0) / weeklyScores.length;
    const standardDev = Math.sqrt(variance);
    const cv = mean > 0 ? standardDev / mean : 1.0;
    
    // Convert CV to 0-100 scale
    // CV of 0.5 = 50%, CV of 1.0 = 100% (very volatile)
    const volatilityScore = Math.min(100, cv * 100);
    
    // Boom/bust pattern detection
    const boomWeeks = weeklyScores.filter((score: number) => score > mean * 1.5).length;
    const bustWeeks = weeklyScores.filter((score: number) => score < mean * 0.5).length;
    const boomBustBonus = ((boomWeeks + bustWeeks) / weeklyScores.length) * 20;
    
    return Math.min(100, Math.max(0, volatilityScore + boomBustBonus));
  }
  
  /**
   * Calculate all risk components for a player
   */
  calculateRiskComponents(playerData: any, format: 'dynasty' | 'redraft' = 'dynasty'): RiskComponents {
    const age = playerData.age || 25;
    const position = playerData.position || 'WR';
    
    let agePenalty = this.calculateAgePenalty(age, position);
    
    // Apply format multipliers
    if (format === 'dynasty') {
      agePenalty *= 1.3; // Dynasty cares more about age
    } else {
      agePenalty *= 0.6; // Redraft cares less about age
    }
    
    const injuryRisk = this.calculateInjuryRisk(playerData);
    const volatility = this.calculateVolatility(playerData);
    
    return {
      age_penalty: Math.min(100, Math.max(0, agePenalty)),
      injury_risk: injuryRisk,
      volatility: volatility
    };
  }
  
  /**
   * Calculate South quadrant score (Risk/Durability converted to Safety)
   * Higher score = safer player
   */
  calculateSouthScore(playerData: any, format: 'dynasty' | 'redraft' = 'dynasty'): number {
    const components = this.calculateRiskComponents(playerData, format);
    
    // Weighted risk composite (per config)
    const riskComposite = 
      0.55 * components.age_penalty + 
      0.30 * components.injury_risk + 
      0.15 * components.volatility;
    
    // Convert risk to safety (invert)
    const safetyScore = Math.max(0, 100 - riskComposite);
    
    return Math.round(safetyScore * 10) / 10;
  }
  
  /**
   * Get risk component breakdown for debug
   */
  getDebugBreakdown(playerData: any, format: 'dynasty' | 'redraft' = 'dynasty') {
    const components = this.calculateRiskComponents(playerData, format);
    const southScore = this.calculateSouthScore(playerData, format);
    
    return {
      components,
      composite_risk: 0.55 * components.age_penalty + 0.30 * components.injury_risk + 0.15 * components.volatility,
      south_score: southScore,
      interpretation: southScore >= 75 ? 'Low Risk' : southScore >= 50 ? 'Moderate Risk' : 'High Risk'
    };
  }
}