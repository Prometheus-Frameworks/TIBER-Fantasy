/**
 * SportsDataIO Integration for Authentic NFL Player Data
 * Refreshes player database with current NFL rosters and stats
 */

import { storage } from './storage';

interface SportsDataPlayer {
  PlayerID: number;
  Name: string;
  Team: string;
  Position: string;
  Active: boolean;
  FantasyPoints: number;
  FantasyPointsPPR: number;
  Targets: number;
  Receptions: number;
  ReceivingYards: number;
  RushingAttempts: number;
  RushingYards: number;
  TouchdownsTotal: number;
  Age: number;
}

export class DataRefreshService {
  private apiKey: string;
  private baseUrl = 'https://api.sportsdata.io/v3/nfl';

  constructor() {
    this.apiKey = process.env.SPORTSDATA_API_KEY!;
    if (!this.apiKey) {
      throw new Error('SPORTSDATA_API_KEY environment variable is required');
    }
  }

  /**
   * Fetch current NFL players from SportsDataIO
   */
  private async fetchNFLPlayers(): Promise<SportsDataPlayer[]> {
    try {
      const response = await fetch(
        `${this.baseUrl}/stats/players/2024REG?key=${this.apiKey}`,
        {
          headers: {
            'Accept': 'application/json',
          }
        }
      );

      if (!response.ok) {
        throw new Error(`SportsDataIO API error: ${response.status} ${response.statusText}`);
      }

      const players = await response.json();
      console.log(`✅ Fetched ${players.length} NFL players from SportsDataIO`);
      return players;
    } catch (error) {
      console.error('❌ Failed to fetch NFL players:', error);
      throw error;
    }
  }

  /**
   * Filter for dynasty-relevant players
   */
  private filterDynastyRelevantPlayers(players: SportsDataPlayer[]): SportsDataPlayer[] {
    return players.filter(player => {
      // Only active players
      if (!player.Active) return false;
      
      // Only relevant positions
      if (!['QB', 'RB', 'WR', 'TE'].includes(player.Position)) return false;
      
      // Filter out players with no fantasy production
      const fantasyPoints = player.FantasyPointsPPR || player.FantasyPoints || 0;
      
      // Position-specific minimum fantasy points for dynasty relevance
      const minPoints = {
        QB: 50,   // ~3 PPG over 16 games
        RB: 40,   // ~2.5 PPG
        WR: 30,   // ~2 PPG  
        TE: 25    // ~1.5 PPG
      };
      
      const threshold = minPoints[player.Position as keyof typeof minPoints] || 0;
      return fantasyPoints >= threshold;
    });
  }

  /**
   * Convert SportsDataIO player to our database format
   */
  private convertToPlayerFormat(sportsPlayer: SportsDataPlayer) {
    const fantasyPoints = sportsPlayer.FantasyPointsPPR || sportsPlayer.FantasyPoints || 0;
    const avgPoints = fantasyPoints / 17; // 2024 has 17 games
    
    // Calculate upside based on position and performance
    const calculateUpside = (player: SportsDataPlayer): number => {
      const baseUpside = avgPoints * 0.3; // 30% upside as baseline
      
      // Young players get higher upside
      if (player.Age && player.Age < 25) return baseUpside * 1.5;
      if (player.Age && player.Age < 27) return baseUpside * 1.2;
      if (player.Age && player.Age > 30) return baseUpside * 0.8;
      
      return baseUpside;
    };

    return {
      name: sportsPlayer.Name,
      team: sportsPlayer.Team || 'FA',
      position: sportsPlayer.Position,
      avgPoints: parseFloat(avgPoints.toFixed(1)),
      projectedPoints: parseFloat((avgPoints * 1.05).toFixed(1)), // 5% growth projection
      ownershipPercentage: this.calculateOwnershipPercentage(avgPoints, sportsPlayer.Position),
      isAvailable: true,
      upside: parseFloat(calculateUpside(sportsPlayer).toFixed(1)),
      injuryStatus: 'Healthy',
      availability: 'Available',
      imageUrl: `https://api.sleeper.app/v1/avatar/${sportsPlayer.PlayerID}`,
      consistency: this.calculateConsistency(sportsPlayer),
      matchupRating: 85, // Default neutral matchup
      trend: 'stable',
      ownership: this.calculateOwnershipPercentage(avgPoints, sportsPlayer.Position),
      targetShare: this.calculateTargetShare(sportsPlayer),
      redZoneTargets: Math.floor((sportsPlayer.Targets || 0) * 0.15), // ~15% of targets in red zone
      carries: sportsPlayer.RushingAttempts || 0,
      snapCount: Math.floor(avgPoints * 12), // Rough snap count estimation
      externalId: sportsPlayer.PlayerID.toString()
    };
  }

  private calculateOwnershipPercentage(avgPoints: number, position: string): number {
    // Ownership based on fantasy production
    if (avgPoints > 15) return 95; // Elite players
    if (avgPoints > 10) return 80; // Top tier
    if (avgPoints > 7) return 60;  // Good players
    if (avgPoints > 4) return 35;  // Decent players
    return 15; // Deep league players
  }

  private calculateConsistency(player: SportsDataPlayer): number {
    // Higher consistency for established players with steady production
    const fantasyPoints = player.FantasyPointsPPR || player.FantasyPoints || 0;
    const baseConsistency = Math.min(fantasyPoints / 200 * 100, 95); // Cap at 95
    
    // Position adjustments
    if (player.Position === 'QB') return Math.min(baseConsistency + 10, 95);
    if (player.Position === 'RB') return Math.max(baseConsistency - 5, 30);
    return baseConsistency;
  }

  private calculateTargetShare(player: SportsDataPlayer): number {
    if (!player.Targets || player.Position === 'QB' || player.Position === 'RB') return 0;
    
    // Estimate target share based on targets (league average ~180 targets per team)
    const estimatedTeamTargets = 180;
    return Math.min((player.Targets / estimatedTeamTargets) * 100, 35); // Cap at 35%
  }

  /**
   * Refresh all player data from SportsDataIO
   */
  async refreshPlayerData(): Promise<{ updated: number; filtered: number; total: number }> {
    console.log('🔄 Starting player data refresh from SportsDataIO...');
    
    try {
      // Fetch fresh data
      const allPlayers = await this.fetchNFLPlayers();
      console.log(`📊 Retrieved ${allPlayers.length} total NFL players`);
      
      // Filter for dynasty relevance
      const relevantPlayers = this.filterDynastyRelevantPlayers(allPlayers);
      console.log(`✅ Filtered to ${relevantPlayers.length} dynasty-relevant players`);
      
      // Update database
      let updatedCount = 0;
      for (const sportsPlayer of relevantPlayers) {
        try {
          const playerData = this.convertToPlayerFormat(sportsPlayer);
          
          // Check if player exists by external ID
          const existingPlayer = await storage.getPlayerByExternalId(sportsPlayer.PlayerID.toString());
          
          if (existingPlayer) {
            // Update existing player
            await storage.updatePlayer(existingPlayer.id, playerData);
          } else {
            // Create new player
            await storage.createPlayer(playerData);
          }
          
          updatedCount++;
        } catch (error) {
          console.warn(`⚠️ Failed to update player ${sportsPlayer.Name}:`, error);
        }
      }

      console.log(`✅ Successfully updated ${updatedCount} players`);
      
      return {
        updated: updatedCount,
        filtered: allPlayers.length - relevantPlayers.length,
        total: allPlayers.length
      };
      
    } catch (error) {
      console.error('❌ Data refresh failed:', error);
      throw error;
    }
  }
}

export const dataRefreshService = new DataRefreshService();