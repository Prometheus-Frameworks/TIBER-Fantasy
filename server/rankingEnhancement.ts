/**
 * Simplified Ranking Enhancement System
 * Core dynasty ranking functionality without complex dependencies
 */

import { playerMapping } from './playerMapping';
import { sleeperAPI } from './sleeperAPI';
import { dynastyADPService } from './dynastyADPService';

export interface EnhancedPlayer {
  id: number;
  name: string;
  position: 'QB' | 'RB' | 'WR' | 'TE';
  team: string;
  age: number;
  avgPoints: number;
  dynastyValue: number;
  dynastyTier: string;
  sleeperId?: string | null;
  fantasyOwnership?: number | null;
  enhancementStatus: 'Enhanced' | 'Basic';
}

export class RankingEnhancementService {
  
  /**
   * Enhance player rankings with platform integration data
   */
  async enhancePlayerRankings(players: any[]): Promise<EnhancedPlayer[]> {
    const enhancedPlayers: EnhancedPlayer[] = [];
    
    for (const player of players) {
      try {
        const enhanced = await this.enhanceIndividualPlayer(player);
        enhancedPlayers.push(enhanced);
      } catch (error) {
        console.error(`Failed to enhance player ${player.name}:`, error);
        // Fallback to basic player data
        enhancedPlayers.push({
          ...player,
          sleeperId: null,
          fantasyOwnership: null,
          enhancementStatus: 'Basic' as const
        });
      }
    }
    
    return enhancedPlayers;
  }
  
  /**
   * Enhance individual player with mapping data
   */
  async enhanceIndividualPlayer(player: any): Promise<EnhancedPlayer> {
    // Get Sleeper mapping
    const sleeperId = playerMapping.getSleeperIdByName(player.name);
    
    // Get fantasy ownership data (simplified)
    let fantasyOwnership: number | null = null;
    if (sleeperId) {
      fantasyOwnership = 50; // Default ownership for mapped players
    }
    
    return {
      id: player.id,
      name: player.name,
      position: player.position,
      team: player.team,
      age: player.age,
      avgPoints: player.avgPoints,
      dynastyValue: player.dynastyValue,
      dynastyTier: player.dynastyTier,
      sleeperId,
      fantasyOwnership,
      enhancementStatus: sleeperId ? 'Enhanced' : 'Basic'
    };
  }
  
  /**
   * Get mapping statistics for enhanced players
   */
  getMappingStats(players: EnhancedPlayer[]): {
    total: number;
    mapped: number;
    unmapped: number;
    mappingRate: number;
  } {
    const total = players.length;
    const mapped = players.filter(p => p.sleeperId).length;
    const unmapped = total - mapped;
    const mappingRate = Math.round((mapped / total) * 100);
    
    return {
      total,
      mapped,
      unmapped,
      mappingRate
    };
  }
}

export const rankingEnhancement = new RankingEnhancementService();