/**
 * Player Value Score (PVS) System - Updated with Jake Maraia Methodology
 * 
 * Calculates comprehensive player values using Jake's research-based weights:
 * Age/Longevity (35%) + Current Production (30%) + Opportunity Context (35%)
 */

import { storage } from "./storage";

export interface PlayerValueMetrics {
  playerId: number;
  playerName: string;
  position: string;
  team: string;
  
  // Core metrics (0-100 normalized) - Updated for Jake's methodology
  ageLongevityScore: number;      // Age premium - most important
  currentProductionScore: number;  // Fantasy points baseline  
  opportunityContextScore: number; // Target share, team role
  
  // Legacy fields for compatibility
  pointsScore: number;
  consistencyScore: number;
  positionalScarcityScore: number;
  durabilityScore: number;
  teamOffenseScore: number;
  
  // Final calculation
  playerValueScore: number;      // Weighted PVS (0-100)
  
  // Raw data for transparency
  rawMetrics: {
    fantasyPoints: number;
    age: number;
    targetShare: number;
    teamOffenseRank: number;
    positionRank: number;
  };
  
  // League context
  leagueSettings: {
    scoring: 'standard' | 'ppr' | 'half-ppr';
    positions: string[];
  };
  
  lastCalculated: Date;
}

class PlayerValueScoreEngine {
  // Jake Maraia methodology weights
  private readonly WEIGHTS = {
    ageLongevity: 0.35,      // Age premium - most predictive
    currentProduction: 0.30,  // Fantasy points baseline
    opportunityContext: 0.35  // Target share, team role
  };

  /**
   * Calculate Player Value Score using Jake Maraia methodology
   */
  async calculatePlayerValueScore(
    playerId: number,
    leagueSettings: { scoring: 'standard' | 'ppr' | 'half-ppr'; positions: string[] }
  ): Promise<PlayerValueMetrics> {
    const player = await storage.getPlayer(playerId);
    if (!player) {
      throw new Error(`Player ${playerId} not found`);
    }

    console.log(`🔄 Calculating Jake's PVS for ${player.name} (${player.position})...`);

    // Calculate Jake's three components
    const ageLongevityScore = this.calculateAgeLongevityScore(player);
    const currentProductionScore = this.calculateCurrentProductionScore(player, leagueSettings.scoring);
    const opportunityContextScore = this.calculateOpportunityContextScore(player);

    // Calculate weighted PVS using Jake's methodology
    const playerValueScore = 
      (ageLongevityScore * this.WEIGHTS.ageLongevity) +
      (currentProductionScore * this.WEIGHTS.currentProduction) +
      (opportunityContextScore * this.WEIGHTS.opportunityContext);

    return {
      playerId: player.id,
      playerName: player.name,
      position: player.position,
      team: player.team,
      ageLongevityScore,
      currentProductionScore,
      opportunityContextScore,
      pointsScore: currentProductionScore,
      consistencyScore: ageLongevityScore,
      positionalScarcityScore: opportunityContextScore,
      durabilityScore: ageLongevityScore,
      teamOffenseScore: opportunityContextScore,
      playerValueScore: Math.round(playerValueScore * 10) / 10,
      rawMetrics: {
        fantasyPoints: player.avgPoints || 0,
        age: this.estimateAge(player),
        targetShare: this.estimateTargetShare(player),
        teamOffenseRank: this.getTeamOffenseRank(player.team),
        positionRank: 0 // Will be calculated later
      },
      leagueSettings,
      lastCalculated: new Date()
    };
  }

  /**
   * Calculate Age/Longevity Score (35% weight)
   * Youth is the biggest factor in Jake's methodology
   */
  private calculateAgeLongevityScore(player: any): number {
    const playerAge = this.estimateAge(player);
    
    // Jake's age curve: No WR over 30 in top 15
    if (playerAge <= 23) return 100; // Elite youth premium (Brian Thomas Jr.)
    if (playerAge <= 24) return 95;  // Perfect dynasty age (Puka Nacua)
    if (playerAge <= 25) return 90;  // Prime dynasty age (Ja'Marr Chase)
    if (playerAge <= 26) return 85;  // Still excellent (CeeDee Lamb)
    if (playerAge <= 27) return 75;  // Good dynasty value
    if (playerAge <= 28) return 65;  // Declining value
    if (playerAge <= 29) return 50;  // Significant penalty (A.J. Brown)
    if (playerAge <= 30) return 35;  // Major concerns (Tyreek Hill #14)
    if (playerAge <= 31) return 25;  // Rarely in top 15
    
    return 15; // Over 31 - minimal dynasty value
  }

  /**
   * Calculate Current Production Score (30% weight)
   * Minimum 12 PPG for dynasty relevance
   */
  private calculateCurrentProductionScore(player: any, scoring: string): number {
    const playerPoints = player.avgPoints || 0;
    
    // Jake's 12 PPG dynasty minimum threshold
    if (playerPoints < 12) return 0;
    
    // Position-specific elite benchmarks
    const eliteThresholds = {
      'QB': 25,  // Elite QB production
      'RB': 18,  // Elite RB production  
      'WR': 16,  // Elite WR production
      'TE': 14   // Elite TE production
    };
    
    const positionThreshold = eliteThresholds[player.position as keyof typeof eliteThresholds] || 15;
    
    // Score based on production relative to elite threshold
    if (playerPoints >= positionThreshold) return 100;
    if (playerPoints >= positionThreshold * 0.85) return 85;
    if (playerPoints >= positionThreshold * 0.7) return 70;
    if (playerPoints >= positionThreshold * 0.6) return 55;
    if (playerPoints >= 12) return 40; // Above dynasty minimum
    
    return 0; // Below dynasty relevance
  }

  /**
   * Calculate Opportunity Context Score (35% weight)
   * Target share, team role, clear path to alpha status
   */
  private calculateOpportunityContextScore(player: any): number {
    let score = 0;
    
    // Target share component (40% of opportunity score)
    const targetShare = this.estimateTargetShare(player);
    if (targetShare >= 25) score += 40;
    else if (targetShare >= 20) score += 32;
    else if (targetShare >= 15) score += 24;
    else if (targetShare >= 10) score += 16;
    else score += 8;
    
    // Team offensive strength (30% of opportunity score)
    const teamScore = this.getTeamOffenseScore(player.team);
    score += (teamScore / 100) * 30;
    
    // Role clarity/competition (30% of opportunity score)
    const roleScore = this.calculateRoleClarity(player);
    score += roleScore * 0.3;
    
    return Math.min(100, Math.round(score));
  }

  /**
   * Calculate role clarity based on depth chart position
   */
  private calculateRoleClarity(player: any): number {
    const avgPoints = player.avgPoints || 0;
    const ownershipPct = player.ownershipPercentage || 0;
    
    // High production + high ownership = clear alpha role
    if (avgPoints >= 15 && ownershipPct >= 80) return 100;
    if (avgPoints >= 12 && ownershipPct >= 60) return 80;
    if (avgPoints >= 10 && ownershipPct >= 40) return 60;
    if (avgPoints >= 8) return 40;
    
    return 20; // Unclear role
  }

  /**
   * Estimate target share for opportunity analysis
   */
  private estimateTargetShare(player: any): number {
    const avgPoints = player.avgPoints || 0;
    const position = player.position;
    
    if (position === 'WR') {
      if (avgPoints >= 16) return 25; // Elite WR1 (Ja'Marr Chase level)
      if (avgPoints >= 12) return 20; // Solid WR2
      if (avgPoints >= 8) return 15;  // WR3
      return 10; // Limited role
    }
    
    if (position === 'RB') {
      if (avgPoints >= 18) return 30; // Workhorse back
      if (avgPoints >= 14) return 25; // Featured back
      if (avgPoints >= 10) return 20; // Committee back
      return 15; // Limited touches
    }
    
    if (position === 'TE') {
      if (avgPoints >= 14) return 20; // Elite TE
      if (avgPoints >= 10) return 15; // Solid TE
      if (avgPoints >= 6) return 10;  // Streaming option
      return 5; // Minimal role
    }
    
    return 0; // QB doesn't use target share
  }

  /**
   * Estimate player age from available data
   */
  private estimateAge(player: any): number {
    if (player.age) return player.age;
    
    // Use experience or other indicators
    if (player.experience !== undefined) {
      return 22 + player.experience; // Typical rookie age + experience
    }
    
    // Default to average NFL age for dynasty consideration
    return 26;
  }

  /**
   * Get team offense score (0-100)
   */
  private getTeamOffenseScore(team: string): number {
    // Simplified team scoring for now
    const eliteOffenses = ['KC', 'DAL', 'BUF', 'MIA', 'CIN'];
    const goodOffenses = ['DET', 'SF', 'LAR', 'PHI', 'ATL', 'TB'];
    const averageOffenses = ['LAC', 'GB', 'MIN', 'SEA', 'JAC'];
    
    if (eliteOffenses.includes(team)) return 90;
    if (goodOffenses.includes(team)) return 75;
    if (averageOffenses.includes(team)) return 60;
    
    return 45; // Below average offense
  }

  /**
   * Get team offense rank for transparency
   */
  private getTeamOffenseRank(team: string): number {
    const score = this.getTeamOffenseScore(team);
    // Convert score to approximate rank (1-32)
    return Math.round(33 - (score / 100 * 32));
  }
}

export const playerValueScoreEngine = new PlayerValueScoreEngine();