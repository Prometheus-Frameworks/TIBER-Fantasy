/**
 * Clean Dynasty Rankings System
 * Provides accurate, easy-to-understand dynasty values without confusing decimals
 */

import { generateCleanRankings, type ComprehensivePlayer } from './comprehensivePlayerData';

export interface CleanRankingEntry {
  rank: number;
  player: {
    id: number;
    name: string;
    team: string;
    position: string;
    age: number;
  };
  dynastyValue: number;          // Clean integer 1-100
  tier: string;                  // Elite, Tier1, Tier2, etc.
  trendDirection: string;        // Rising, Stable, Declining
  keyStrengths: string[];
  concerns: string[];
  fantasyPoints2024: number;
  projectedPoints2025: number;
  adp: number;
}

export interface PositionRankings {
  position: string;
  rankings: CleanRankingEntry[];
  totalPlayers: number;
  lastUpdated: string;
}

class CleanRankingService {
  private convertToDynastyValue(player: ComprehensivePlayer): number {
    // Convert complex scoring to simple 1-100 scale based on tier and rank
    const tierValues = {
      'Elite': 90,
      'Tier1': 75, 
      'Tier2': 60,
      'Tier3': 45,
      'Bench': 25
    };
    
    const baseValue = tierValues[player.tier] || 25;
    
    // Adjust for rank within tier (higher rank = slightly higher value)
    const rankAdjustment = Math.max(0, 10 - (player.dynastyRank / 2));
    
    // Age adjustment for dynasty value
    const ageAdjustment = player.age <= 23 ? 5 : player.age >= 30 ? -5 : 0;
    
    // Trend adjustment
    const trendAdjustment = 
      player.trendDirection === 'Rising' ? 3 :
      player.trendDirection === 'Declining' ? -3 : 0;
    
    return Math.min(100, Math.max(1, Math.round(baseValue + rankAdjustment + ageAdjustment + trendAdjustment)));
  }

  private convertToCleanEntry(player: ComprehensivePlayer, rank: number): CleanRankingEntry {
    return {
      rank,
      player: {
        id: player.id,
        name: player.name,
        team: player.team,
        position: player.position,
        age: player.age
      },
      dynastyValue: this.convertToDynastyValue(player),
      tier: player.tier,
      trendDirection: player.trendDirection,
      keyStrengths: player.keyStrengths,
      concerns: player.concerns,
      fantasyPoints2024: player.fantasyPoints2024,
      projectedPoints2025: player.projectedPoints2025,
      adp: player.adp
    };
  }

  public getCleanRankings(): Record<string, PositionRankings> {
    const data = generateCleanRankings();
    const timestamp = new Date().toISOString();
    
    return {
      QB: {
        position: 'QB',
        rankings: data.QB.map((player, index) => this.convertToCleanEntry(player, index + 1)),
        totalPlayers: data.QB.length,
        lastUpdated: timestamp
      },
      RB: {
        position: 'RB', 
        rankings: data.RB.map((player, index) => this.convertToCleanEntry(player, index + 1)),
        totalPlayers: data.RB.length,
        lastUpdated: timestamp
      },
      WR: {
        position: 'WR',
        rankings: data.WR.map((player, index) => this.convertToCleanEntry(player, index + 1)),
        totalPlayers: data.WR.length,
        lastUpdated: timestamp
      },
      TE: {
        position: 'TE',
        rankings: data.TE.map((player, index) => this.convertToCleanEntry(player, index + 1)),
        totalPlayers: data.TE.length,
        lastUpdated: timestamp
      },
      SFLEX: {
        position: 'SFLEX',
        rankings: data.SFLEX.map((player, index) => this.convertToCleanEntry(player, index + 1)),
        totalPlayers: data.SFLEX.length,
        lastUpdated: timestamp
      }
    };
  }

  public getSuperflexExample(): any {
    // Show Josh Allen transformation example
    const oneQBRank = 24;  // Josh Allen rank in 1QB leagues
    const superflexRank = 1; // Josh Allen rank in superflex leagues
    
    return {
      player: "Josh Allen",
      transformation: {
        oneQB: {
          rank: oneQBRank,
          explanation: "QB24 overall in standard 1QB leagues (only start 1 QB)"
        },
        superflex: {
          rank: superflexRank,
          explanation: "QB1 overall in superflex (can start 2 QBs = massive scarcity premium)"
        },
        reasoning: [
          "In 1QB leagues: QBs compete with all skill positions for starting spots",
          "In Superflex: Only ~32 starting QBs available, teams need 2",
          "Elite QBs like Allen get +35 dynasty points due to positional scarcity",
          "QB scoring floors are higher and more predictable than skill positions"
        ]
      }
    };
  }
}

export const cleanRankingService = new CleanRankingService();