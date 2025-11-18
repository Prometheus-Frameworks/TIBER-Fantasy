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
  private currentSeasonCache: string | null = null;
  private currentWeekCache: number | null = null;
  
  // Top performers cache (refreshes every 1 hour)
  private topPerformersCache: {
    data: string;
    timestamp: number;
  } | null = null;
  private readonly TOP_PERFORMERS_CACHE_TTL = 60 * 60 * 1000; // 1 hour in ms
  
  /**
   * Fetch current NFL season year from Sleeper API
   */
  private async getCurrentSeason(): Promise<string> {
    if (this.currentSeasonCache) {
      return this.currentSeasonCache;
    }
    
    try {
      const response = await axios.get('https://api.sleeper.app/v1/state/nfl');
      const season = response.data.season;
      const week = response.data.week;
      this.currentSeasonCache = season;
      this.currentWeekCache = week;
      console.log(`✅ Current NFL season: ${season}, Week: ${week}`);
      return season;
    } catch (error) {
      console.error('❌ Failed to fetch current NFL season, falling back to current year:', error);
      return new Date().getFullYear().toString();
    }
  }
  
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
   * Calculate half-PPR fantasy points from weekly stats
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
    
    // Half-PPR scoring (0.5 points per reception)
    const recPoints = (receiving.receptions * 0.5) + (receiving.yards * 0.1) + (receiving.tds * 6);
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
      // Get current NFL season and week from Sleeper API
      const currentSeason = await this.getCurrentSeason();
      const currentWeek = await this.getCurrentWeek();
      
      console.log(`📊 Fetching ${position} data for weeks 1-${currentWeek} of ${currentSeason} season (half-PPR)`);
      
      // Fetch all weeks from 1 to current week
      for (let week = 1; week <= currentWeek; week++) {
        const response = await axios.get(`https://api.sleeper.app/v1/stats/nfl/regular/${currentSeason}/${week}`);
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
        const currentSeason = await this.getCurrentSeason();
        console.warn(`⚠️ No stats found for ${player.full_name} in ${currentSeason}`);
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
   * Format VORP data for prompt context with team info
   */
  formatForPrompt(vorpData: PlayerVORPData): string {
    // Include team to provide fresh roster context and override stale RAG data
    return `**${vorpData.playerName} (${vorpData.team} ${vorpData.position}${vorpData.positionRank})** - ${vorpData.totalPoints} pts in ${vorpData.gamesPlayed} games (${vorpData.pointsPerGame} PPG), ${vorpData.vorp > 0 ? '+' : ''}${vorpData.vorp} VORP (${vorpData.tier})`;
  }
  
  /**
   * Get top 24 performers for each position (for season awareness context)
   * Uses 1-hour cache to avoid 40+ API calls on every chat request
   */
  async getTopPerformersContext(): Promise<string> {
    try {
      // Check cache first
      const now = Date.now();
      if (this.topPerformersCache && (now - this.topPerformersCache.timestamp) < this.TOP_PERFORMERS_CACHE_TTL) {
        console.log(`📊 [Top Performers] Using cached data (${Math.floor((now - this.topPerformersCache.timestamp) / 60000)} min old)`);
        return this.topPerformersCache.data;
      }
      
      console.log(`📊 [Top Performers] Cache miss or expired - fetching fresh data...`);
      
      await this.fetchSleeperPlayers();
      const currentSeason = await this.getCurrentSeason();
      const currentWeek = await this.getCurrentWeek();
      
      const topPerformers: { [position: string]: string[] } = {
        QB: [],
        RB: [],
        WR: [],
        TE: [],
      };
      
      // Fetch top 24 for each position
      for (const position of ['QB', 'RB', 'WR', 'TE']) {
        const positionalData = await this.fetchPositionalData(position);
        
        // Sort by total points descending
        positionalData.sort((a, b) => b.totalPoints - a.totalPoints);
        
        // Get top 24 players
        const top24 = positionalData.slice(0, 24);
        
        topPerformers[position] = top24.map((p, index) => {
          const player = this.sleeperPlayersCache.get(p.playerId);
          if (!player) return '';
          
          const rank = index + 1;
          const ppg = (p.totalPoints / p.gamesPlayed).toFixed(1);
          return `${position}${rank}: ${player.full_name} (${ppg} PPG)`;
        }).filter(Boolean);
      }
      
      // Format as concise context
      const contextLines = [
        `📊 2025 Season Leaders (Week ${currentWeek} - ${currentSeason}):`,
        '',
        `**QB Top 12**: ${topPerformers.QB.slice(0, 12).join(', ')}`,
        '',
        `**RB Top 24**: ${topPerformers.RB.slice(0, 24).join(', ')}`,
        '',
        `**WR Top 24**: ${topPerformers.WR.slice(0, 24).join(', ')}`,
        '',
        `**TE Top 12**: ${topPerformers.TE.slice(0, 12).join(', ')}`,
      ];
      
      const contextString = contextLines.join('\n');
      
      // Update cache
      this.topPerformersCache = {
        data: contextString,
        timestamp: now,
      };
      
      console.log(`✅ [Top Performers] Cached fresh data (valid for ${this.TOP_PERFORMERS_CACHE_TTL / 60000} min)`);
      
      return contextString;
    } catch (error) {
      console.error('❌ Failed to fetch top performers context:', error);
      
      // If cache exists but expired, return stale data rather than breaking chat
      if (this.topPerformersCache) {
        console.log(`⚠️  [Top Performers] Returning stale cache as fallback`);
        return this.topPerformersCache.data;
      }
      
      return ''; // Return empty string only if no cache exists
    }
  }
  
  /**
   * Get current NFL week from Sleeper API (cached)
   */
  private async getCurrentWeek(): Promise<number> {
    if (this.currentWeekCache) {
      return this.currentWeekCache;
    }
    
    // Fetch season (which also sets week cache)
    await this.getCurrentSeason();
    
    // Return cached week or default to 11 as fallback
    return this.currentWeekCache || 11;
  }
}

export const vorpCalculationService = new VORPCalculationService();
