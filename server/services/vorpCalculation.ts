import axios from 'axios';

interface PlayerVORPData {
  playerName: string;
  position: string;
  team: string;
  totalPoints: number;
  gamesPlayed: number;
  pointsPerGame: number;
  positionRank: number;
  vorp: number;
  replacementValue: number;
  tier: string;
}

interface SleeperPlayerData {
  player_id: string;
  full_name: string;
  position: string;
  team: string;
}

// Positional replacement levels (12-team PPR league)
const REPLACEMENT_LEVELS = {
  QB: 12,  // QB12
  RB: 24,  // RB24 (2 starters + FLEX)
  WR: 36,  // WR36 (3 starters + FLEX)
  TE: 12,  // TE12
};

// VORP tiers based on value above replacement
const VORP_TIERS = [
  { min: 80, label: 'Elite (Top 5)' },
  { min: 50, label: 'High-End (Top 12)' },
  { min: 25, label: 'Solid Starter' },
  { min: 10, label: 'Viable Flex' },
  { min: 0, label: 'Replacement Level' },
  { min: -Infinity, label: 'Below Replacement' },
];

export class VORPCalculationService {
  private sleeperPlayersCache: Map<string, SleeperPlayerData> = new Map();
  
  /**
   * Fetch all Sleeper players and cache them
   */
  private async fetchSleeperPlayers(): Promise<void> {
    if (this.sleeperPlayersCache.size > 0) {
      return; // Already cached
    }
    
    try {
      console.log('📥 Fetching Sleeper player database...');
      const response = await axios.get('https://api.sleeper.app/v1/players/nfl');
      const players = response.data;
      
      for (const [playerId, playerData] of Object.entries(players)) {
        const player = playerData as any;
        this.sleeperPlayersCache.set(playerId, {
          player_id: playerId,
          full_name: player.full_name || player.first_name + ' ' + player.last_name,
          position: player.position,
          team: player.team || 'FA',
        });
      }
      
      console.log(`✅ Cached ${this.sleeperPlayersCache.size} Sleeper players`);
    } catch (error) {
      console.error('❌ Failed to fetch Sleeper players:', error);
      throw error;
    }
  }
  
  /**
   * Find Sleeper player ID by name (fuzzy match)
   */
  private findPlayerByName(playerName: string): SleeperPlayerData | null {
    const normalizedSearch = playerName.toLowerCase().trim();
    
    // Exact match first
    for (const player of Array.from(this.sleeperPlayersCache.values())) {
      if (player.full_name.toLowerCase() === normalizedSearch) {
        return player;
      }
    }
    
    // Partial match (for abbreviated names like "J. Jefferson")
    for (const player of Array.from(this.sleeperPlayersCache.values())) {
      if (player.full_name.toLowerCase().includes(normalizedSearch)) {
        return player;
      }
    }
    
    return null;
  }
  
  /**
   * Calculate PPR fantasy points from weekly stats
   */
  private calculatePPRPoints(stats: any): number {
    const receiving = {
      receptions: stats.rec_rec || 0,
      yards: stats.rec_yd || 0,
      tds: stats.rec_td || 0,
    };
    
    const rushing = {
      yards: stats.rush_yd || 0,
      tds: stats.rush_td || 0,
    };
    
    const passing = {
      yards: stats.pass_yd || 0,
      tds: stats.pass_td || 0,
      interceptions: stats.pass_int || 0,
    };
    
    // PPR scoring
    const recPoints = receiving.receptions + (receiving.yards * 0.1) + (receiving.tds * 6);
    const rushPoints = (rushing.yards * 0.1) + (rushing.tds * 6);
    const passPoints = (passing.yards * 0.04) + (passing.tds * 4) - (passing.interceptions * 2);
    
    return recPoints + rushPoints + passPoints;
  }
  
  /**
   * Fetch all players' season totals and calculate positional replacement levels
   */
  private async fetchPositionalData(position: string): Promise<Array<{ playerId: string; totalPoints: number; gamesPlayed: number }>> {
    const playerTotals = new Map<string, { totalPoints: number; gamesPlayed: number }>();
    
    try {
      // Fetch weeks 1-11 (current 2024 season progress)
      for (let week = 1; week <= 11; week++) {
        const response = await axios.get(`https://api.sleeper.app/v1/stats/nfl/regular/2024/${week}`);
        const weekStats = response.data;
        
        if (!weekStats) continue;
        
        for (const [playerId, stats] of Object.entries(weekStats)) {
          const playerData = this.sleeperPlayersCache.get(playerId);
          if (!playerData || playerData.position !== position) continue;
          
          const points = this.calculatePPRPoints(stats);
          
          if (points > 0) {
            if (!playerTotals.has(playerId)) {
              playerTotals.set(playerId, { totalPoints: 0, gamesPlayed: 0 });
            }
            const current = playerTotals.get(playerId)!;
            current.totalPoints += points;
            current.gamesPlayed += 1;
          }
        }
      }
      
      return Array.from(playerTotals.entries()).map(([playerId, data]) => ({
        playerId,
        ...data,
      }));
    } catch (error) {
      console.error(`❌ Failed to fetch ${position} data:`, error);
      return [];
    }
  }
  
  /**
   * Calculate VORP for a specific player
   */
  async calculatePlayerVORP(playerName: string): Promise<PlayerVORPData | null> {
    try {
      // Ensure player cache is loaded
      await this.fetchSleeperPlayers();
      
      // Find player
      const player = this.findPlayerByName(playerName);
      if (!player) {
        console.warn(`⚠️ Player not found: ${playerName}`);
        return null;
      }
      
      // Only calculate for skill positions
      if (!['QB', 'RB', 'WR', 'TE'].includes(player.position)) {
        console.warn(`⚠️ VORP not available for position: ${player.position}`);
        return null;
      }
      
      console.log(`🎯 Calculating VORP for ${player.full_name} (${player.position})`);
      
      // Fetch all positional data
      const positionalData = await this.fetchPositionalData(player.position);
      
      // Sort by total points descending
      positionalData.sort((a, b) => b.totalPoints - a.totalPoints);
      
      // Find player's rank
      const playerIndex = positionalData.findIndex(p => p.playerId === player.player_id);
      if (playerIndex === -1) {
        console.warn(`⚠️ No stats found for ${player.full_name} in 2024`);
        return null;
      }
      
      const playerData = positionalData[playerIndex];
      const positionRank = playerIndex + 1;
      
      // Calculate replacement level value
      const replacementIndex = REPLACEMENT_LEVELS[player.position as keyof typeof REPLACEMENT_LEVELS] - 1;
      const replacementPlayer = positionalData[replacementIndex];
      const replacementValue = replacementPlayer ? replacementPlayer.totalPoints : 0;
      
      // Calculate VORP
      const vorp = playerData.totalPoints - replacementValue;
      
      // Determine tier
      const tier = VORP_TIERS.find(t => vorp >= t.min)?.label || 'Unknown';
      
      console.log(`✅ ${player.full_name}: ${player.position}${positionRank}, ${playerData.totalPoints.toFixed(1)} pts, ${vorp.toFixed(1)} VORP`);
      
      return {
        playerName: player.full_name,
        position: player.position,
        team: player.team,
        totalPoints: parseFloat(playerData.totalPoints.toFixed(1)),
        gamesPlayed: playerData.gamesPlayed,
        pointsPerGame: parseFloat((playerData.totalPoints / playerData.gamesPlayed).toFixed(1)),
        positionRank,
        vorp: parseFloat(vorp.toFixed(1)),
        replacementValue: parseFloat(replacementValue.toFixed(1)),
        tier,
      };
    } catch (error) {
      console.error(`❌ Failed to calculate VORP for ${playerName}:`, error);
      return null;
    }
  }
  
  /**
   * Format VORP data for prompt context
   */
  formatForPrompt(vorpData: PlayerVORPData): string {
    return `**${vorpData.playerName} (${vorpData.position}${vorpData.positionRank})** - ${vorpData.totalPoints} pts in ${vorpData.gamesPlayed} games (${vorpData.pointsPerGame} PPG), ${vorpData.vorp > 0 ? '+' : ''}${vorpData.vorp} VORP (${vorpData.tier})`;
  }
}

export const vorpCalculationService = new VORPCalculationService();
