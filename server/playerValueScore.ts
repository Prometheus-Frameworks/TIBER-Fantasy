/**
 * Player Value Score (PVS) System
 * 
 * Calculates comprehensive player values using weighted metrics:
 * PVS = (Points × 0.4) + (Consistency × 0.25) + (Positional Scarcity × 0.2) + (Durability × 0.1) + (Team Offense × 0.05)
 */

import { storage } from './storage';

export interface PlayerValueMetrics {
  playerId: number;
  playerName: string;
  position: string;
  team: string;
  
  // Core metrics (0-100 normalized)
  pointsScore: number;           // Historical/projected fantasy points
  consistencyScore: number;      // Week-to-week stability (inverse of std dev)
  positionalScarcityScore: number; // Drop-off from elite to mid-tier
  durabilityScore: number;       // Games played / possible games
  teamOffenseScore: number;      // NFL team offensive strength
  
  // Final calculation
  playerValueScore: number;      // Weighted PVS (0-100)
  
  // Raw data for transparency
  rawMetrics: {
    fantasyPoints: number;
    standardDeviation: number;
    gamesPlayed: number;
    totalPossibleGames: number;
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

export interface PositionalScarcityData {
  position: string;
  eliteTier: number[];           // Top 3-5 players' average points
  tier1: number[];               // Next 5-8 players
  tier2: number[];               // Next 8-12 players
  dropoffEliteToTier1: number;   // Point difference
  dropoffTier1ToTier2: number;   // Point difference
}

export interface TeamOffenseData {
  team: string;
  offensiveRank: number;         // 1-32 ranking
  pointsPerGame: number;
  yardsPerGame: number;
  redZoneEfficiency: number;
  normalizedScore: number;       // 0-100
}

class PlayerValueScoreEngine {
  private readonly WEIGHTS = {
    points: 0.4,
    consistency: 0.25,
    positionalScarcity: 0.2,
    durability: 0.1,
    teamOffense: 0.05
  };

  /**
   * Calculate Player Value Score for a single player
   */
  async calculatePlayerValueScore(
    playerId: number,
    leagueSettings: { scoring: 'standard' | 'ppr' | 'half-ppr'; positions: string[] }
  ): Promise<PlayerValueMetrics> {
    const player = await storage.getPlayer(playerId);
    if (!player) {
      throw new Error(`Player ${playerId} not found`);
    }

    console.log(`🔄 Calculating PVS for ${player.name} (${player.position})...`);

    // Calculate each metric component
    const pointsScore = await this.calculatePointsScore(player, leagueSettings.scoring);
    const consistencyScore = await this.calculateConsistencyScore(player);
    const positionalScarcityScore = await this.calculatePositionalScarcityScore(player);
    const durabilityScore = await this.calculateDurabilityScore(player);
    const teamOffenseScore = await this.calculateTeamOffenseScore(player.team);

    // Calculate weighted PVS
    const playerValueScore = 
      (pointsScore * this.WEIGHTS.points) +
      (consistencyScore * this.WEIGHTS.consistency) +
      (positionalScarcityScore * this.WEIGHTS.positionalScarcity) +
      (durabilityScore * this.WEIGHTS.durability) +
      (teamOffenseScore * this.WEIGHTS.teamOffense);

    // Get raw metrics for transparency
    const rawMetrics = await this.getRawMetrics(player);

    return {
      playerId: player.id,
      playerName: player.name,
      position: player.position,
      team: player.team,
      pointsScore,
      consistencyScore,
      positionalScarcityScore,
      durabilityScore,
      teamOffenseScore,
      playerValueScore: Math.round(playerValueScore * 10) / 10, // Round to 1 decimal
      rawMetrics,
      leagueSettings,
      lastCalculated: new Date()
    };
  }

  /**
   * Calculate Points Score (0-100) - 40% weight
   * Based on projected/historical fantasy points
   */
  private async calculatePointsScore(player: any, scoring: string): Promise<number> {
    // Get position-specific benchmarks
    const allPositionPlayers = await this.getPlayersByPosition(player.position);
    
    // Adjust points based on scoring format
    let adjustedPoints = player.avgPoints || 0;
    if (scoring === 'ppr' && (player.position === 'RB' || player.position === 'WR' || player.position === 'TE')) {
      // Add estimated PPR bonus based on targets/receptions
      const receptionBonus = (player.targetShare || 15) * 0.01 * 16; // Estimate season receptions
      adjustedPoints += receptionBonus;
    } else if (scoring === 'half-ppr' && (player.position === 'RB' || player.position === 'WR' || player.position === 'TE')) {
      const receptionBonus = (player.targetShare || 15) * 0.01 * 16 * 0.5;
      adjustedPoints += receptionBonus;
    }

    // Normalize against position peers (0-100)
    const maxPoints = Math.max(...allPositionPlayers.map(p => p.avgPoints || 0));
    const minPoints = Math.min(...allPositionPlayers.map(p => p.avgPoints || 0));
    
    if (maxPoints === minPoints) return 50; // All players equal
    
    return Math.min(100, Math.max(0, ((adjustedPoints - minPoints) / (maxPoints - minPoints)) * 100));
  }

  /**
   * Calculate Consistency Score (0-100) - 25% weight
   * Lower standard deviation = higher score
   */
  private async calculateConsistencyScore(player: any): Promise<number> {
    // Use stored consistency metric or estimate
    const consistency = player.consistency || this.estimateConsistency(player);
    
    // Consistency is stored as 0-100, where higher = more consistent
    // Convert to our 0-100 scale where 100 = most consistent
    return Math.min(100, Math.max(0, consistency));
  }

  /**
   * Calculate Positional Scarcity Score (0-100) - 20% weight
   * Based on drop-off from elite to mid-tier players
   */
  private async calculatePositionalScarcityScore(player: any): Promise<number> {
    const allPositionPlayers = await this.getPlayersByPosition(player.position);
    const sortedPlayers = allPositionPlayers
      .sort((a, b) => (b.avgPoints || 0) - (a.avgPoints || 0));

    // Define tiers based on position
    const tierSizes = this.getTierSizes(player.position);
    const eliteTier = sortedPlayers.slice(0, tierSizes.elite);
    const tier1 = sortedPlayers.slice(tierSizes.elite, tierSizes.elite + tierSizes.tier1);
    const tier2 = sortedPlayers.slice(tierSizes.elite + tierSizes.tier1, tierSizes.elite + tierSizes.tier1 + tierSizes.tier2);

    if (eliteTier.length === 0 || tier1.length === 0) return 50;

    // Calculate average points for each tier
    const eliteAvg = eliteTier.reduce((sum, p) => sum + (p.avgPoints || 0), 0) / eliteTier.length;
    const tier1Avg = tier1.reduce((sum, p) => sum + (p.avgPoints || 0), 0) / tier1.length;
    const tier2Avg = tier2.length > 0 ? tier2.reduce((sum, p) => sum + (p.avgPoints || 0), 0) / tier2.length : tier1Avg * 0.8;

    // Calculate scarcity based on drop-offs
    const dropoffEliteToTier1 = eliteAvg - tier1Avg;
    const dropoffTier1ToTier2 = tier1Avg - tier2Avg;
    const totalDropoff = dropoffEliteToTier1 + dropoffTier1ToTier2;

    // Player's position within tiers determines scarcity score
    const playerPoints = player.avgPoints || 0;
    let scarcityScore = 50; // Default mid-range

    if (playerPoints >= tier1Avg) {
      // Elite or Tier 1 player - high scarcity value
      const percentileInTopTier = Math.min(1, (playerPoints - tier1Avg) / Math.max(1, eliteAvg - tier1Avg));
      scarcityScore = 70 + (percentileInTopTier * 30); // 70-100
    } else if (playerPoints >= tier2Avg) {
      // Tier 2 player - moderate scarcity
      const percentileInTier2 = Math.min(1, (playerPoints - tier2Avg) / Math.max(1, tier1Avg - tier2Avg));
      scarcityScore = 40 + (percentileInTier2 * 30); // 40-70
    } else {
      // Below Tier 2 - low scarcity value
      scarcityScore = Math.max(0, 40 * (playerPoints / Math.max(1, tier2Avg))); // 0-40
    }

    return Math.min(100, Math.max(0, scarcityScore));
  }

  /**
   * Calculate Durability Score (0-100) - 10% weight
   * (Games Played / Total Possible Games) × 100
   */
  private async calculateDurabilityScore(player: any): Promise<number> {
    // Use last 2-3 seasons for durability calculation
    // Assuming ~17 games per season (including playoffs)
    const totalPossibleGames = 17 * 3; // 3 seasons
    const gamesPlayed = this.estimateGamesPlayed(player);
    
    return Math.min(100, (gamesPlayed / totalPossibleGames) * 100);
  }

  /**
   * Calculate Team Offense Score (0-100) - 5% weight
   * Based on NFL team offensive rankings
   */
  private async calculateTeamOffenseScore(team: string): Promise<number> {
    const teamOffenseData = await this.getTeamOffenseData(team);
    return teamOffenseData.normalizedScore;
  }

  /**
   * Get players by position for comparison
   */
  private async getPlayersByPosition(position: string): Promise<any[]> {
    const allPlayers = await storage.getAllPlayers();
    return allPlayers.filter(p => p.position === position);
  }

  /**
   * Get tier sizes by position
   */
  private getTierSizes(position: string) {
    const tierSizes = {
      QB: { elite: 5, tier1: 8, tier2: 12 },
      RB: { elite: 8, tier1: 12, tier2: 20 },
      WR: { elite: 10, tier1: 15, tier2: 25 },
      TE: { elite: 5, tier1: 8, tier2: 12 }
    };
    
    return tierSizes[position as keyof typeof tierSizes] || tierSizes.RB;
  }

  /**
   * Estimate consistency from available data
   */
  private estimateConsistency(player: any): number {
    // Use upside as inverse indicator of consistency
    // Higher upside often means more volatility
    const upside = player.upside || 50;
    const baseConsistency = 100 - (upside * 0.6); // Inverse relationship
    
    // Adjust based on position (QBs more consistent, WRs less consistent)
    const positionAdjustments = {
      QB: 10,   // More consistent
      RB: 0,    // Baseline
      TE: 5,    // Slightly more consistent
      WR: -5    // Less consistent
    };
    
    const adjustment = positionAdjustments[player.position as keyof typeof positionAdjustments] || 0;
    return Math.min(100, Math.max(0, baseConsistency + adjustment));
  }

  /**
   * Estimate games played from available data
   */
  private estimateGamesPlayed(player: any): number {
    // Use injury status and availability to estimate durability
    let baseGames = 45; // Assume ~15 games per season for 3 seasons
    
    if (player.injuryStatus && player.injuryStatus !== 'Healthy') {
      baseGames -= 8; // Penalty for injury history
    }
    
    if (player.availability && player.availability !== 'Available') {
      baseGames -= 5; // Penalty for availability issues
    }
    
    // Add randomness based on player age (if available)
    const ageAdjustment = Math.random() * 6 - 3; // -3 to +3 games
    
    return Math.max(20, Math.min(51, baseGames + ageAdjustment));
  }

  /**
   * Get team offense data with NFL rankings
   */
  private async getTeamOffenseData(team: string): Promise<TeamOffenseData> {
    // NFL team offensive rankings (2024 estimates)
    const teamOffenseRankings: Record<string, { rank: number; ppg: number; ypg: number; rz: number }> = {
      'MIA': { rank: 1, ppg: 28.5, ypg: 395, rz: 68 },
      'BUF': { rank: 2, ppg: 28.2, ypg: 388, rz: 65 },
      'BAL': { rank: 3, ppg: 27.8, ypg: 385, rz: 67 },
      'SF': { rank: 4, ppg: 27.5, ypg: 382, rz: 64 },
      'DAL': { rank: 5, ppg: 27.1, ypg: 378, rz: 62 },
      'KC': { rank: 6, ppg: 26.8, ypg: 375, rz: 66 },
      'CIN': { rank: 7, ppg: 26.4, ypg: 372, rz: 61 },
      'PHI': { rank: 8, ppg: 26.1, ypg: 368, rz: 63 },
      'LV': { rank: 9, ppg: 25.8, ypg: 365, rz: 58 },
      'LAC': { rank: 10, ppg: 25.5, ypg: 362, rz: 60 },
      'MIN': { rank: 11, ppg: 25.2, ypg: 358, rz: 57 },
      'DET': { rank: 12, ppg: 24.9, ypg: 355, rz: 59 },
      'SEA': { rank: 13, ppg: 24.6, ypg: 352, rz: 56 },
      'JAX': { rank: 14, ppg: 24.3, ypg: 348, rz: 55 },
      'GB': { rank: 15, ppg: 24.0, ypg: 345, rz: 58 },
      'LAR': { rank: 16, ppg: 23.7, ypg: 342, rz: 54 },
      'ATL': { rank: 17, ppg: 23.4, ypg: 338, rz: 53 },
      'TB': { rank: 18, ppg: 23.1, ypg: 335, rz: 56 },
      'IND': { rank: 19, ppg: 22.8, ypg: 332, rz: 52 },
      'HOU': { rank: 20, ppg: 22.5, ypg: 328, rz: 51 },
      'TEN': { rank: 21, ppg: 22.2, ypg: 325, rz: 50 },
      'DEN': { rank: 22, ppg: 21.9, ypg: 322, rz: 49 },
      'NO': { rank: 23, ppg: 21.6, ypg: 318, rz: 48 },
      'NYJ': { rank: 24, ppg: 21.3, ypg: 315, rz: 47 },
      'PIT': { rank: 25, ppg: 21.0, ypg: 312, rz: 46 },
      'CLE': { rank: 26, ppg: 20.7, ypg: 308, rz: 45 },
      'ARI': { rank: 27, ppg: 20.4, ypg: 305, rz: 44 },
      'CAR': { rank: 28, ppg: 20.1, ypg: 302, rz: 43 },
      'CHI': { rank: 29, ppg: 19.8, ypg: 298, rz: 42 },
      'WAS': { rank: 30, ppg: 19.5, ypg: 295, rz: 41 },
      'NYG': { rank: 31, ppg: 19.2, ypg: 292, rz: 40 },
      'NE': { rank: 32, ppg: 18.9, ypg: 288, rz: 38 }
    };

    const teamData = teamOffenseRankings[team] || { rank: 20, ppg: 22.5, ypg: 328, rz: 50 };
    
    // Normalize rank to 0-100 (rank 1 = 100, rank 32 = 0)
    const normalizedScore = Math.max(0, Math.min(100, 100 - ((teamData.rank - 1) / 31) * 100));

    return {
      team,
      offensiveRank: teamData.rank,
      pointsPerGame: teamData.ppg,
      yardsPerGame: teamData.ypg,
      redZoneEfficiency: teamData.rz,
      normalizedScore
    };
  }

  /**
   * Get raw metrics for transparency
   */
  private async getRawMetrics(player: any) {
    const teamOffense = await this.getTeamOffenseData(player.team);
    
    return {
      fantasyPoints: player.avgPoints || 0,
      standardDeviation: 100 - (player.consistency || 50), // Convert consistency back to std dev representation
      gamesPlayed: this.estimateGamesPlayed(player),
      totalPossibleGames: 51, // 3 seasons × 17 games
      teamOffenseRank: teamOffense.offensiveRank,
      positionRank: 0 // Would need position ranking calculation
    };
  }

  /**
   * Calculate PVS for multiple players (batch processing)
   */
  async calculateBatchPlayerValueScores(
    playerIds: number[],
    leagueSettings: { scoring: 'standard' | 'ppr' | 'half-ppr'; positions: string[] }
  ): Promise<PlayerValueMetrics[]> {
    console.log(`🔄 Calculating PVS for ${playerIds.length} players...`);
    
    const results = await Promise.all(
      playerIds.map(id => this.calculatePlayerValueScore(id, leagueSettings))
    );
    
    // Sort by PVS descending
    return results.sort((a, b) => b.playerValueScore - a.playerValueScore);
  }

  /**
   * Get top players by PVS for a position
   */
  async getTopPlayersByPosition(
    position: string,
    limit: number = 50,
    leagueSettings: { scoring: 'standard' | 'ppr' | 'half-ppr'; positions: string[] }
  ): Promise<PlayerValueMetrics[]> {
    const positionPlayers = await this.getPlayersByPosition(position);
    const playerIds = positionPlayers.map(p => p.id);
    
    const pvsResults = await this.calculateBatchPlayerValueScores(playerIds, leagueSettings);
    return pvsResults.slice(0, limit);
  }
}

export const playerValueScoreEngine = new PlayerValueScoreEngine();