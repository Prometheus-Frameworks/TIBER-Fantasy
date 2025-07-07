/**
 * Ranking Enhancement System
 * Integrates player mapping data with NFL rankings to provide enhanced dynasty valuations
 */

import { playerMapping } from './playerMapping';
import { sleeperAPI } from './sleeperAPI';
import { playerNameMapping } from './playerNameMapping';

export interface EnhancedPlayer {
  id: number;
  name: string;
  position: 'QB' | 'RB' | 'WR' | 'TE';
  team: string;
  age: number;
  avgPoints: number;
  dynastyValue: number;
  dynastyTier: string;
  
  // Enhanced data from Sleeper mapping
  sleeperId?: string;
  fantasyOwnership?: number;
  sleeperRank?: number;
  recentNews?: string[];
  injuryStatus?: string;
  mappingConfidence: number;
}

export class RankingEnhancementService {
  /**
   * Enhance NFL player rankings with fantasy platform data
   */
  async enhancePlayerRankings(players: any[]): Promise<EnhancedPlayer[]> {
    console.log(`🔄 Enhancing ${players.length} players with fantasy platform data...`);
    
    const enhancedPlayers: EnhancedPlayer[] = [];
    
    for (const player of players) {
      try {
        const enhanced = await this.enhanceIndividualPlayer(player);
        enhancedPlayers.push(enhanced);
      } catch (error) {
        console.error(`❌ Failed to enhance player ${player.name}:`, error);
        // Fallback to basic player data
        enhancedPlayers.push({
          ...player,
          mappingConfidence: 0
        });
      }
    }
    
    const mappedCount = enhancedPlayers.filter(p => p.sleeperId).length;
    console.log(`✅ Enhanced ${enhancedPlayers.length} players, ${mappedCount} with Sleeper data (${Math.round(mappedCount/enhancedPlayers.length*100)}%)`);
    
    return enhancedPlayers;
  }

  /**
   * Enhance individual player with fantasy platform data
   */
  private async enhanceIndividualPlayer(player: any): Promise<EnhancedPlayer> {
    const enhanced: EnhancedPlayer = {
      id: player.id || player.rank,
      name: player.name,
      position: player.position,
      team: player.team,
      age: player.age || 26,
      avgPoints: player.avgPoints || 0,
      dynastyValue: player.dynastyValue || player.dynastyScore || 0,
      dynastyTier: player.dynastyTier || 'Bench',
      mappingConfidence: 0
    };

    // Try to get Sleeper mapping using comprehensive name bridging
    let sleeperId = null;
    let mappingConfidence = 0;
    
    // Strategy 1: Use manual name mapping for top dynasty players
    const nflName = playerNameMapping.convertToNFLFormat(player.name);
    if (nflName !== player.name) {
      sleeperId = playerMapping.getSleeperIdByNFL(nflName);
      if (sleeperId) {
        mappingConfidence = 95; // High confidence for manual mappings
      }
    }
    
    // Strategy 2: Try direct NFL database lookup
    if (!sleeperId && player.nfl_id) {
      sleeperId = playerMapping.getSleeperIdByNFL(player.nfl_id);
      if (sleeperId) mappingConfidence = 90;
    }
    
    // Strategy 3: Try fuzzy matching with Sleeper database
    if (!sleeperId) {
      sleeperId = await this.findSleeperIdByFullName(player.name, player.team, player.position);
      if (sleeperId) mappingConfidence = 80;
    }
    
    if (sleeperId) {
      enhanced.sleeperId = sleeperId;
      enhanced.mappingConfidence = mappingConfidence;
      
      try {
        // Get enhanced data from Sleeper
        const sleeperData = await this.getSleeperPlayerData(sleeperId);
        if (sleeperData) {
          enhanced.fantasyOwnership = sleeperData.ownership;
          enhanced.sleeperRank = sleeperData.rank;
          enhanced.recentNews = sleeperData.news;
          enhanced.injuryStatus = sleeperData.injury;
          
          // Boost dynasty value for highly owned players
          if (sleeperData.ownership > 80) {
            enhanced.dynastyValue = Math.min(100, enhanced.dynastyValue + 5);
          }
        }
      } catch (error) {
        console.error(`❌ Failed to get Sleeper data for ${player.name}:`, error);
      }
    } else {
      // Try fuzzy matching for unmapped players
      const fuzzyMatch = await this.attemptFuzzyMapping(player);
      if (fuzzyMatch) {
        enhanced.sleeperId = fuzzyMatch;
        enhanced.mappingConfidence = 60; // Medium confidence for fuzzy match
      }
    }

    return enhanced;
  }

  /**
   * Get enhanced data from Sleeper for a player
   */
  private async getSleeperPlayerData(sleeperId: string): Promise<any | null> {
    try {
      // Get basic player info from Sleeper
      const playerInfo = await sleeperAPI.getPlayerInfo(sleeperId);
      
      return {
        ownership: this.calculateOwnershipFromADP(playerInfo),
        rank: playerInfo.rank || 999,
        news: playerInfo.news || [],
        injury: playerInfo.injury_status || null
      };
    } catch (error) {
      console.error(`❌ Failed to get Sleeper data for player ${sleeperId}:`, error);
      return null;
    }
  }

  /**
   * Calculate ownership percentage from ADP/rank
   */
  private calculateOwnershipFromADP(playerInfo: any): number {
    const rank = playerInfo.rank || 999;
    
    // Ownership estimation based on typical draft patterns
    if (rank <= 12) return 95; // Elite tier
    if (rank <= 24) return 85; // Top tier
    if (rank <= 50) return 70; // Solid starters
    if (rank <= 100) return 50; // Flex/bench
    if (rank <= 200) return 25; // Deep league relevant
    return 10; // Waiver wire
  }

  /**
   * Convert full name to abbreviated format used in NFL database
   */
  private convertToAbbreviatedName(fullName: string): string {
    const parts = fullName.trim().split(' ');
    if (parts.length >= 2) {
      const firstName = parts[0];
      const lastName = parts[parts.length - 1];
      return `${firstName[0]}.${lastName}`;
    }
    return fullName;
  }

  /**
   * Find Sleeper ID by searching full name in Sleeper player database
   */
  private async findSleeperIdByFullName(name: string, team: string, position: string): Promise<string | null> {
    try {
      // Access the Sleeper players from the mapping service
      const sleeperPlayers = (playerMapping as any).sleeperPlayers;
      if (!sleeperPlayers) return null;

      for (const [sleeperId, sleeperPlayer] of Array.from(sleeperPlayers.entries())) {
        if (!sleeperPlayer.full_name) continue;

        // Direct name match
        if (sleeperPlayer.full_name.toLowerCase() === name.toLowerCase()) {
          // Verify team/position if available
          if (sleeperPlayer.team === team || sleeperPlayer.position === position) {
            return sleeperId;
          }
        }

        // Fuzzy name matching
        const nameSimilarity = this.calculateNameSimilarity(name, sleeperPlayer.full_name);
        if (nameSimilarity > 0.85 && sleeperPlayer.team === team) {
          return sleeperId;
        }
      }

      return null;
    } catch (error) {
      console.error(`❌ Error finding Sleeper ID for ${name}:`, error);
      return null;
    }
  }

  /**
   * Calculate name similarity for fuzzy matching
   */
  private calculateNameSimilarity(name1: string, name2: string): number {
    const clean1 = name1.toLowerCase().replace(/[^\w\s]/g, '');
    const clean2 = name2.toLowerCase().replace(/[^\w\s]/g, '');
    
    if (clean1 === clean2) return 1.0;
    
    // Simple Levenshtein distance-based similarity
    const maxLength = Math.max(clean1.length, clean2.length);
    if (maxLength === 0) return 1.0;
    
    return (maxLength - this.levenshteinDistance(clean1, clean2)) / maxLength;
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  /**
   * Estimate fantasy ownership based on dynasty value and position
   */
  private estimateOwnership(dynastyValue: number, position: string): number {
    // Elite dynasty assets are owned in 90%+ leagues
    if (dynastyValue >= 90) return Math.random() * 10 + 90; // 90-100%
    
    // Premium players owned in 75-90% leagues
    if (dynastyValue >= 75) return Math.random() * 15 + 75; // 75-90%
    
    // Strong players owned in 60-80% leagues
    if (dynastyValue >= 60) return Math.random() * 20 + 60; // 60-80%
    
    // Solid players owned in 40-65% leagues
    if (dynastyValue >= 45) return Math.random() * 25 + 40; // 40-65%
    
    // Depth/bench players owned in 10-45% leagues
    return Math.random() * 35 + 10; // 10-45%
  }

  /**
   * Attempt fuzzy matching for unmapped players
   */
  private async attemptFuzzyMapping(player: any): Promise<string | null> {
    return await this.findSleeperIdByFullName(player.name, player.team, player.position);
  }

  /**
   * Get mapping statistics for reporting
   */
  getMappingStats(enhancedPlayers: EnhancedPlayer[]): any {
    const total = enhancedPlayers.length;
    const mapped = enhancedPlayers.filter(p => p.sleeperId).length;
    const highConfidence = enhancedPlayers.filter(p => p.mappingConfidence >= 80).length;
    const mediumConfidence = enhancedPlayers.filter(p => p.mappingConfidence >= 50 && p.mappingConfidence < 80).length;
    
    return {
      total,
      mapped,
      unmapped: total - mapped,
      mappingRate: Math.round(mapped / total * 100),
      highConfidence,
      mediumConfidence,
      lowConfidence: mapped - highConfidence - mediumConfidence
    };
  }
}

export const rankingEnhancement = new RankingEnhancementService();