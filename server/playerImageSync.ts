/**
 * Player Image Synchronization
 * Handles fetching and storing player headshots from various fantasy platforms
 */

export class PlayerImageSync {
  
  /**
   * Get player image URL from Sleeper platform
   */
  static getSleeperPlayerImage(playerId: string): string {
    return `https://sleepercdn.com/avatars/${playerId}.jpg`;
  }
  
  /**
   * Get player image URL from ESPN platform
   */
  static getESPNPlayerImage(playerId: string): string {
    return `https://a.espncdn.com/combiner/i?img=/i/headshots/nfl/players/full/${playerId}.png`;
  }
  
  /**
   * Get player image URL from Yahoo platform
   */
  static getYahooPlayerImage(playerId: string): string {
    return `https://s.yimg.com/iu/api/res/1.2/player_${playerId}_headshots_nfl.png`;
  }
  
  /**
   * Fetch player image from multiple sources with fallback
   */
  static async getPlayerImageWithFallback(
    playerName: string,
    position: string,
    team: string,
    sleeperPlayerId?: string,
    espnPlayerId?: string
  ): Promise<string | null> {
    
    // Try Sleeper first (highest quality images)
    if (sleeperPlayerId) {
      const sleeperUrl = this.getSleeperPlayerImage(sleeperPlayerId);
      if (await this.validateImageUrl(sleeperUrl)) {
        return sleeperUrl;
      }
    }
    
    // Try ESPN as fallback
    if (espnPlayerId) {
      const espnUrl = this.getESPNPlayerImage(espnPlayerId);
      if (await this.validateImageUrl(espnUrl)) {
        return espnUrl;
      }
    }
    
    // No valid image found
    return null;
  }
  
  /**
   * Validate that an image URL returns a valid image
   */
  static async validateImageUrl(url: string): Promise<boolean> {
    try {
      const response = await fetch(url, { method: 'HEAD' });
      return response.ok && (response.headers.get('content-type')?.startsWith('image/') || false);
    } catch (error) {
      return false;
    }
  }
  
  /**
   * Extract Sleeper player data including image
   */
  static processSleeperPlayer(sleeperPlayerData: any): {
    name: string;
    position: string;
    team: string;
    imageUrl: string | null;
    sleeperPlayerId: string;
  } {
    return {
      name: sleeperPlayerData.full_name || sleeperPlayerData.player?.full_name || 'Unknown',
      position: sleeperPlayerData.position || sleeperPlayerData.player?.position || 'FLEX',
      team: sleeperPlayerData.team || sleeperPlayerData.player?.team || 'UNK',
      imageUrl: sleeperPlayerData.player_id ? this.getSleeperPlayerImage(sleeperPlayerData.player_id) : null,
      sleeperPlayerId: sleeperPlayerData.player_id || ''
    };
  }
  
  /**
   * Extract ESPN player data including image
   */
  static processESPNPlayer(espnPlayerData: any): {
    name: string;
    position: string;
    team: string;
    imageUrl: string | null;
    espnPlayerId: string;
  } {
    const positionMap: Record<number, string> = {
      1: 'QB', 2: 'RB', 3: 'WR', 4: 'TE', 5: 'K', 16: 'DST'
    };
    
    return {
      name: espnPlayerData.fullName || 'Unknown',
      position: positionMap[espnPlayerData.defaultPositionId] || 'FLEX',
      team: this.getESPNTeamAbbreviation(espnPlayerData.proTeamId),
      imageUrl: espnPlayerData.id ? this.getESPNPlayerImage(espnPlayerData.id.toString()) : null,
      espnPlayerId: espnPlayerData.id?.toString() || ''
    };
  }
  
  /**
   * Convert ESPN team ID to abbreviation
   */
  private static getESPNTeamAbbreviation(teamId: number): string {
    const teamMap: Record<number, string> = {
      1: 'ATL', 2: 'BUF', 3: 'CHI', 4: 'CIN', 5: 'CLE', 6: 'DAL', 7: 'DEN',
      8: 'DET', 9: 'GB', 10: 'TEN', 11: 'IND', 12: 'KC', 13: 'LV', 14: 'LAR',
      15: 'MIA', 16: 'MIN', 17: 'NE', 18: 'NO', 19: 'NYG', 20: 'NYJ',
      21: 'PHI', 22: 'ARI', 23: 'PIT', 24: 'LAC', 25: 'SF', 26: 'SEA',
      27: 'TB', 28: 'WAS', 29: 'CAR', 30: 'JAC', 33: 'BAL', 34: 'HOU'
    };
    
    return teamMap[teamId] || 'UNK';
  }
}

export const playerImageSync = new PlayerImageSync();