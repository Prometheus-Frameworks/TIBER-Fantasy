/**
 * Market Engine - ADP vs model rank, contract horizon, and position scarcity
 * Part of DeepSeek v3.2 + Compass fusion system
 */

interface MarketComponents {
  market_eff: number;
  contract_horizon: number;
  pos_scarcity: number;
}

export class MarketEngine {
  
  /**
   * Calculate market efficiency based on ADP vs projected model rank
   * Returns 0-100 scale where 100 = maximum efficiency (undervalued)
   */
  calculateMarketEfficiency(playerData: any): number {
    const adpRank = playerData.adp_rank || playerData.adp || 100;
    const modelRank = playerData.model_rank || playerData.projected_rank || 50;
    
    const K = 36; // Normalization constant for rank differences
    const rankDiff = Math.abs(modelRank - adpRank);
    
    // Efficiency = 1 - |model_rank - adp_rank| / K
    const rawEfficiency = Math.max(0, 1 - (rankDiff / K));
    
    // Bonus for undervalued players (model rank better than ADP)
    let efficiencyScore = rawEfficiency * 100;
    if (modelRank < adpRank) {
      // Player is undervalued - bonus points
      const undervaluedBonus = Math.min(25, (adpRank - modelRank) / 2);
      efficiencyScore += undervaluedBonus;
    }
    
    return Math.min(100, Math.max(0, efficiencyScore));
  }
  
  /**
   * Calculate contract horizon value
   * Returns 0-100 scale where 100 = maximum value (long-term security)
   */
  calculateContractHorizon(playerData: any): number {
    const contractYearsLeft = playerData.contract_years_left || playerData.contract_yrs || 1;
    const isRookie = playerData.rookie_status === 'Rookie' || playerData.draft_year === new Date().getFullYear();
    const teamStability = playerData.team_stability || 0.7; // 0-1 scale
    
    let horizonScore = 0;
    
    // Years remaining component (0-4+ years)
    if (contractYearsLeft >= 4) {
      horizonScore += 40; // Long-term security
    } else if (contractYearsLeft >= 2) {
      horizonScore += 25; // Medium-term security
    } else if (contractYearsLeft >= 1) {
      horizonScore += 10; // Short-term
    } else {
      horizonScore += 0; // Expiring/unsigned
    }
    
    // Rookie contract premium
    if (isRookie && contractYearsLeft >= 3) {
      horizonScore += 20; // Rookie deals are valuable
    }
    
    // Team stability factor
    horizonScore += teamStability * 25;
    
    // Contract value relative to production (if available)
    const contractValue = playerData.contract_value || 0;
    const production = playerData.season_fpts || playerData.projected_fpts || 0;
    if (contractValue > 0 && production > 0) {
      const valueRatio = production / (contractValue / 1000000); // Per $1M
      if (valueRatio > 15) horizonScore += 15; // Bargain contract
      else if (valueRatio > 10) horizonScore += 10; // Fair value
      else if (valueRatio < 5) horizonScore -= 10; // Overpaid
    }
    
    return Math.min(100, Math.max(0, horizonScore));
  }
  
  /**
   * Calculate positional scarcity value
   * Returns 0-100 scale where 100 = maximum scarcity value
   */
  calculatePositionScarcity(playerData: any, positionData?: any): number {
    const position = playerData.position;
    const draftCapital = playerData.draft_capital || playerData.draft_round || 'Undrafted';
    const usage = playerData.target_share || playerData.snap_percentage || 0.5;
    
    let scarcityScore = 50; // Neutral baseline
    
    // Position-specific scarcity factors
    switch (position) {
      case 'QB':
        // QBs have high scarcity in Superflex
        scarcityScore += 20;
        if (playerData.league_format === 'superflex') scarcityScore += 15;
        break;
      case 'RB':
        // RBs age quickly - scarcity premium for young talent
        if (playerData.age <= 25) scarcityScore += 15;
        if (usage >= 0.6) scarcityScore += 10; // Workhorse back
        break;
      case 'WR':
        // WRs have moderate scarcity
        if (usage >= 0.25) scarcityScore += 10; // Alpha receiver
        break;
      case 'TE':
        // TEs have highest scarcity after top tier
        scarcityScore += 25;
        if (usage >= 0.15) scarcityScore += 15; // Involved TE
        break;
    }
    
    // Draft capital component
    if (typeof draftCapital === 'string') {
      if (draftCapital.includes('Round 1')) scarcityScore += 15;
      else if (draftCapital.includes('Round 2')) scarcityScore += 10;
      else if (draftCapital.includes('Round 3')) scarcityScore += 5;
    } else if (typeof draftCapital === 'number') {
      if (draftCapital <= 32) scarcityScore += 15; // 1st round
      else if (draftCapital <= 64) scarcityScore += 10; // 2nd round
      else if (draftCapital <= 96) scarcityScore += 5; // 3rd round
    }
    
    // Age premium for dynasty (younger = scarcer)
    const age = playerData.age || 25;
    if (age <= 23) scarcityScore += 10;
    else if (age <= 25) scarcityScore += 5;
    else if (age >= 30) scarcityScore -= 10;
    
    // Elite production scarcity
    const fpts = playerData.season_fpts || playerData.projected_fpts || 0;
    if (fpts >= 250) scarcityScore += 15; // Elite production
    else if (fpts >= 200) scarcityScore += 10; // High-end production
    
    return Math.min(100, Math.max(0, scarcityScore));
  }
  
  /**
   * Calculate all market components for a player
   */
  calculateMarketComponents(playerData: any, format: 'dynasty' | 'redraft' = 'dynasty'): MarketComponents {
    let marketEff = this.calculateMarketEfficiency(playerData);
    let contractHorizon = this.calculateContractHorizon(playerData);
    const posScarcity = this.calculatePositionScarcity(playerData);
    
    // Apply format multipliers
    if (format === 'redraft') {
      marketEff *= 1.1; // Redraft cares more about immediate value
      contractHorizon *= 0.9; // Contract horizon less important
    } else {
      contractHorizon *= 1.1; // Dynasty cares more about long-term contracts
    }
    
    return {
      market_eff: Math.min(100, Math.max(0, marketEff)),
      contract_horizon: Math.min(100, Math.max(0, contractHorizon)),
      pos_scarcity: posScarcity
    };
  }
  
  /**
   * Calculate West quadrant score (Market/Value)
   * Higher score = better market value
   */
  calculateWestScore(playerData: any, format: 'dynasty' | 'redraft' = 'dynasty'): number {
    const components = this.calculateMarketComponents(playerData, format);
    
    // Weighted market composite (per config)
    const marketComposite = 
      0.50 * components.market_eff + 
      0.30 * components.contract_horizon + 
      0.20 * components.pos_scarcity;
    
    return Math.round(marketComposite * 10) / 10;
  }
  
  /**
   * Get market component breakdown for debug
   */
  getDebugBreakdown(playerData: any, format: 'dynasty' | 'redraft' = 'dynasty') {
    const components = this.calculateMarketComponents(playerData, format);
    const westScore = this.calculateWestScore(playerData, format);
    
    return {
      components,
      composite: 0.50 * components.market_eff + 0.30 * components.contract_horizon + 0.20 * components.pos_scarcity,
      west_score: westScore,
      interpretation: westScore >= 75 ? 'Excellent Value' : westScore >= 50 ? 'Fair Value' : 'Poor Value'
    };
  }
}