/**
 * Ranking Enhancement System
 * Integrates player mapping data with NFL rankings to provide enhanced dynasty valuations
 */

import { playerMapping } from './playerMapping';
import { sleeperAPI } from './sleeperAPI';
// Removed playerNameMapping dependency - now using direct mapping logic
import { dynastyADPService } from './dynastyADPService';
// Removed fallbackADPService dependency - using streamlined approach

// Utility function for dynasty tier classification
function getDynastyTierFromValue(dynastyValue: number): string {
  if (dynastyValue >= 95) return 'Elite';    // Only true dynasty cornerstones
  if (dynastyValue >= 85) return 'Premium';  // High-end dynasty assets
  if (dynastyValue >= 70) return 'Strong';   // Solid dynasty pieces
  if (dynastyValue >= 55) return 'Solid';    // Fantasy contributors
  if (dynastyValue >= 35) return 'Depth';    // Bench/depth players
  return 'Bench';
}

export interface EnhancedPlayer {
  id: number;
  name: string;
  position: 'QB' | 'RB' | 'WR' | 'TE';
  team: string;
  age: number;
  avgPoints: number;
  dynastyValue: number;
  dynastyTier: string;
  
  // ADP Integration
  dynastyADP?: number;
  adpWeightedValue?: number;
  valueCategory?: 'STEAL' | 'VALUE' | 'FAIR' | 'OVERVALUED' | 'AVOID';
  adpDifference?: number;
  
  // Enhanced data from Sleeper mapping
  sleeperId?: string;
  fantasyOwnership?: number;
  sleeperRank?: number;
  recentNews?: string[];
  injuryStatus?: string;
}

export class RankingEnhancementService {
  /**
   * Enhance NFL player rankings with fantasy platform data
   */
  async enhancePlayerRankings(players: any[]): Promise<EnhancedPlayer[]> {
    console.log(`🔄 Enhancing ${players.length} players with fantasy platform data...`);
    
    // Auto-initialize mapping data if missing
    await this.ensureMappingDataLoaded();
    
    const enhancedPlayers: EnhancedPlayer[] = [];
    
    for (const player of players) {
      try {
        const enhanced = await this.enhanceIndividualPlayer(player);
        enhancedPlayers.push(enhanced);
      } catch (error) {
        console.error(`❌ Failed to enhance player ${player.name}:`, error);
        // Fallback to basic player data
        enhancedPlayers.push({
          ...player
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
    // Get accurate 2024 age
    const { get2024Age } = await import('./player2024Ages');
    const accurate2024Age = get2024Age(player.name);
    
    const enhanced: EnhancedPlayer = {
      id: player.id || player.rank,
      name: player.name,
      position: player.position,
      team: player.team,
      age: accurate2024Age || player.age || 26, // Use accurate 2024 age first
      avgPoints: player.avgPoints || 0,
      dynastyValue: player.dynastyValue || player.dynastyScore || player.enhancedDynastyValue || 50,
      dynastyTier: player.dynastyTier || getDynastyTierFromValue(player.dynastyValue || player.dynastyScore || player.enhancedDynastyValue || 50)
    };

    // Try to get Sleeper mapping using comprehensive name bridging
    let sleeperId = null;
    
    // Strategy 1: Direct mapping lookup for dynasty players  
    sleeperId = playerMapping.getSleeperIdByName(player.name);
    
    // Strategy 2: Try direct NFL database lookup
    if (!sleeperId && player.nfl_id) {
      sleeperId = playerMapping.getSleeperIdByNFL(player.nfl_id);
    }
    
    // Strategy 3: Try fuzzy matching with Sleeper database
    if (!sleeperId) {
      sleeperId = await this.findSleeperIdByFullName(player.name, player.team, player.position);
    }
    
    if (sleeperId) {
      enhanced.sleeperId = sleeperId;
      
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
      }
    }

    // Add ADP integration to weight dynasty rankings
    await this.integrateADPData(enhanced);

    return enhanced;
  }

  /**
   * Get enhanced data from Sleeper for a player
   */
  private async getSleeperPlayerData(sleeperId: string): Promise<any | null> {
    try {
      // Return basic data structure without API call
      // The Sleeper API connection will be added later
      return {
        ownership: 50, // Default ownership
        rank: 999,
        news: [],
        injury: null
      };
    } catch (error) {
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
   * Ensure mapping data is loaded before enhancement
   */
  private async ensureMappingDataLoaded(): Promise<void> {
    try {
      // Check if player mapping has data
      const testMapping = playerMapping.getSleeperIdByNFL('J.Allen');
      if (!testMapping) {
        console.log('🔄 Player mapping data not found, generating...');
        // Trigger mapping regeneration
        await fetch('http://localhost:5000/api/mapping/generate');
      }
    } catch (error) {
      console.error('❌ Failed to ensure mapping data loaded:', error);
    }
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
   * Integrate ADP data to weight dynasty rankings and identify value
   */
  private async integrateADPData(player: EnhancedPlayer): Promise<void> {
    try {
      // Try external ADP service first
      let adpPlayer = await dynastyADPService.getPlayerADP(player.name);
      let adpValue: number | null = null;
      
      if (adpPlayer && adpPlayer.adp) {
        adpValue = adpPlayer.adp;
      } else {
        // Use fallback ADP data for key players
        adpValue = fallbackADPService.getPlayerADP(player.name);
      }
      
      if (adpValue) {
        player.dynastyADP = adpValue;
        
        // Calculate ADP-weighted dynasty value
        // High ADP = more valuable (earlier draft pick)
        // Formula: Base dynasty value + ADP bonus
        const adpBonus = this.calculateADPBonus(adpValue, player.position);
        player.adpWeightedValue = Math.min(100, player.dynastyValue + adpBonus);
        
        // Determine value category based on ADP vs our ranking
        const valueAnalysis = this.analyzePlayerValue(player, adpValue);
        player.valueCategory = valueAnalysis.category;
        player.adpDifference = valueAnalysis.difference;
        
        // Update dynasty tier based on weighted value
        player.dynastyTier = getDynastyTierFromValue(player.adpWeightedValue);
      } else {
        // No ADP data available - use base dynasty value
        player.adpWeightedValue = player.dynastyValue;
      }
    } catch (error) {
      // Silently continue without ADP data - don't spam logs
      player.adpWeightedValue = player.dynastyValue;
    }
  }

  /**
   * Calculate ADP bonus for dynasty value weighting
   */
  private calculateADPBonus(dynastyADP: number, position: string): number {
    // Early picks get higher bonuses
    if (dynastyADP <= 12) return 15; // First round dynasty picks
    if (dynastyADP <= 24) return 10; // Second round
    if (dynastyADP <= 48) return 5;  // Third-fourth round
    if (dynastyADP <= 96) return 2;  // Fifth-eighth round
    return 0; // Later picks get no bonus
  }

  /**
   * Analyze player value vs market ADP
   */
  private analyzePlayerValue(player: EnhancedPlayer, dynastyADP: number): {
    category: 'STEAL' | 'VALUE' | 'FAIR' | 'OVERVALUED' | 'AVOID';
    difference: number;
  } {
    // Convert dynasty value to rough ADP equivalent
    // Elite (90+) = picks 1-12, Premium (75+) = picks 13-24, etc.
    const ourADPEstimate = this.dynastyValueToADP(player.dynastyValue, player.position);
    const difference = dynastyADP - ourADPEstimate; // Positive = undervalued by market
    
    if (difference >= 50) return { category: 'STEAL', difference };
    if (difference >= 25) return { category: 'VALUE', difference };
    if (difference >= -25) return { category: 'FAIR', difference };
    if (difference >= -50) return { category: 'OVERVALUED', difference };
    return { category: 'AVOID', difference };
  }

  /**
   * Convert dynasty value to estimated ADP
   */
  private dynastyValueToADP(dynastyValue: number, position: string): number {
    if (dynastyValue >= 90) return 6;   // Elite: picks 1-12
    if (dynastyValue >= 75) return 18;  // Premium: picks 13-24
    if (dynastyValue >= 60) return 36;  // Strong: picks 25-48
    if (dynastyValue >= 45) return 72;  // Solid: picks 49-96
    if (dynastyValue >= 30) return 144; // Depth: picks 97-192
    return 250; // Bench: undrafted
  }

  /**
   * Get mapping statistics for reporting
   */
  getMappingStats(enhancedPlayers: EnhancedPlayer[]): any {
    const total = enhancedPlayers.length;
    const mapped = enhancedPlayers.filter(p => p.sleeperId).length;
    
    return {
      total,
      mapped,
      unmapped: total - mapped,
      mappingRate: Math.round(mapped / total * 100)
    };
  }
}

export const rankingEnhancement = new RankingEnhancementService();