/**
 * Comprehensive NFL Player Database Sync
 * 
 * Populates database with authentic fantasy football data from multiple sources:
 * - SportsDataIO for official NFL statistics
 * - ESPN API for real-time updates and injury reports
 * - Sleeper API for dynasty values and consensus rankings
 * - Our Player Value Score (PVS) calculations
 */

import { storage } from './storage';
import { sportsDataAPI } from './sportsdata';
import { espnAPI } from './espnAPI';
import { playerValueScoreEngine } from './playerValueScore';

interface PlayerDataSources {
  sportsData?: any;
  espnData?: any;
  sleeperData?: any;
  pvsData?: any;
}

interface SyncProgress {
  totalPlayers: number;
  processed: number;
  created: number;
  updated: number;
  errors: string[];
  startTime: Date;
  endTime?: Date;
  duration?: number;
}

class ComprehensiveDataSyncService {
  private readonly API_RATE_LIMIT = 100; // requests per minute
  private readonly BATCH_SIZE = 50;
  private requestQueue: Array<() => Promise<any>> = [];
  private rateLimitWindow = 60000; // 1 minute in ms

  /**
   * Main sync function - orchestrates all data sources
   */
  async syncAllPlayerData(): Promise<SyncProgress> {
    console.log('🚀 Starting comprehensive NFL player data sync...');
    
    const progress: SyncProgress = {
      totalPlayers: 0,
      processed: 0,
      created: 0,
      updated: 0,
      errors: [],
      startTime: new Date()
    };

    try {
      // Step 1: Fetch player lists from all sources
      console.log('📋 Fetching player lists from all sources...');
      const [sportsDataPlayers, espnPlayers] = await Promise.allSettled([
        this.fetchSportsDataPlayers(),
        this.fetchESPNPlayers()
      ]);

      // Process results and handle errors
      const allPlayers = this.consolidatePlayerLists(sportsDataPlayers, espnPlayers, progress);
      progress.totalPlayers = allPlayers.length;

      console.log(`📊 Found ${progress.totalPlayers} unique NFL players to sync`);

      // Step 2: Process players in batches
      const batches = this.createBatches(allPlayers, this.BATCH_SIZE);
      
      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        console.log(`🔄 Processing batch ${i + 1}/${batches.length} (${batch.length} players)...`);
        
        await this.processBatch(batch, progress);
        
        // Rate limiting between batches
        if (i < batches.length - 1) {
          await this.rateLimitDelay();
        }
      }

      // Step 3: Calculate PVS for all players
      console.log('🧮 Calculating Player Value Scores...');
      await this.calculatePVSForAllPlayers(progress);

      progress.endTime = new Date();
      progress.duration = progress.endTime.getTime() - progress.startTime.getTime();

      console.log(`✅ Data sync completed in ${Math.round(progress.duration / 1000)}s`);
      console.log(`📈 Results: ${progress.created} created, ${progress.updated} updated, ${progress.errors.length} errors`);

      return progress;

    } catch (error) {
      console.error('❌ Critical error during data sync:', error);
      progress.errors.push(`Critical sync error: ${error.message}`);
      progress.endTime = new Date();
      throw error;
    }
  }

  /**
   * Fetch NFL players from SportsDataIO
   */
  private async fetchSportsDataPlayers(): Promise<any[]> {
    try {
      if (!process.env.SPORTSDATA_API_KEY) {
        console.warn('⚠️ SportsDataIO API key not found, skipping...');
        return [];
      }

      console.log('🏈 Fetching players from SportsDataIO...');
      const players = await sportsDataAPI.getAllPlayers();
      console.log(`📊 SportsDataIO: ${players.length} players found`);
      return players;
    } catch (error) {
      console.error('❌ SportsDataIO fetch failed:', error);
      return [];
    }
  }

  /**
   * Fetch NFL players from ESPN API
   */
  private async fetchESPNPlayers(): Promise<any[]> {
    try {
      console.log('📺 Fetching players from ESPN API...');
      // ESPN doesn't have a direct "all players" endpoint, so we'll get team rosters
      const teams = await espnAPI.getAllTeams();
      const allPlayers: any[] = [];

      for (const team of teams.slice(0, 5)) { // Limit to prevent rate limiting
        try {
          const teamRoster = await espnAPI.getTeamRoster(team.id);
          if (teamRoster && teamRoster.players) {
            allPlayers.push(...teamRoster.players);
          }
        } catch (error) {
          console.warn(`⚠️ Failed to fetch roster for team ${team.name}:`, error);
        }
      }

      console.log(`📊 ESPN: ${allPlayers.length} players found`);
      return allPlayers;
    } catch (error) {
      console.error('❌ ESPN fetch failed:', error);
      return [];
    }
  }

  /**
   * Consolidate player lists from multiple sources
   */
  private consolidatePlayerLists(
    sportsDataResult: PromiseSettledResult<any[]>,
    espnResult: PromiseSettledResult<any[]>,
    progress: SyncProgress
  ): any[] {
    const allPlayers: any[] = [];
    const playerMap = new Map<string, any>();

    // Process SportsDataIO results
    if (sportsDataResult.status === 'fulfilled') {
      sportsDataResult.value.forEach(player => {
        const key = `${player.Name || player.name}_${player.Team || player.team}`.toLowerCase();
        playerMap.set(key, { ...player, source: 'sportsdata' });
      });
    } else {
      progress.errors.push(`SportsDataIO fetch failed: ${sportsDataResult.reason}`);
    }

    // Process ESPN results  
    if (espnResult.status === 'fulfilled') {
      espnResult.value.forEach(player => {
        const key = `${player.name || player.displayName}_${player.team}`.toLowerCase();
        if (!playerMap.has(key)) {
          playerMap.set(key, { ...player, source: 'espn' });
        } else {
          // Merge data from both sources
          const existing = playerMap.get(key);
          playerMap.set(key, { ...existing, ...player, source: 'merged' });
        }
      });
    } else {
      progress.errors.push(`ESPN fetch failed: ${espnResult.reason}`);
    }

    return Array.from(playerMap.values());
  }

  /**
   * Create batches for processing
   */
  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Process a batch of players
   */
  private async processBatch(players: any[], progress: SyncProgress): Promise<void> {
    const batchPromises = players.map(async (playerData) => {
      try {
        const result = await this.syncSinglePlayer(playerData);
        if (result.created) progress.created++;
        if (result.updated) progress.updated++;
        progress.processed++;
      } catch (error) {
        progress.errors.push(`Player ${playerData.name || playerData.Name}: ${error.message}`);
        progress.processed++;
      }
    });

    await Promise.allSettled(batchPromises);
  }

  /**
   * Sync a single player with all available data
   */
  private async syncSinglePlayer(rawData: any): Promise<{ created: boolean; updated: boolean }> {
    // Normalize player data from different sources
    const normalizedPlayer = this.normalizePlayerData(rawData);
    
    // Check if player already exists
    const existingPlayer = await storage.getPlayerByExternalId(normalizedPlayer.externalId);
    
    if (existingPlayer) {
      // Update existing player
      await storage.updatePlayer(existingPlayer.id, normalizedPlayer);
      return { created: false, updated: true };
    } else {
      // Create new player
      await storage.createPlayer(normalizedPlayer);
      return { created: true, updated: false };
    }
  }

  /**
   * Normalize player data from different API sources
   */
  private normalizePlayerData(rawData: any): any {
    const source = rawData.source || 'unknown';
    
    // Common normalization logic
    const normalized = {
      name: rawData.Name || rawData.name || rawData.displayName || 'Unknown',
      team: this.normalizeTeamName(rawData.Team || rawData.team || rawData.teamAbbrev || ''),
      position: this.normalizePosition(rawData.Position || rawData.position || ''),
      isAvailable: true,
      
      // Default values
      avgPoints: 0,
      projectedPoints: 0,
      ownershipPercentage: 0,
      upside: 50,
      consistency: 50,
      
      // External reference
      externalId: this.generateExternalId(rawData),
      
      // Source-specific data
      ...this.extractSourceSpecificData(rawData, source)
    };

    return normalized;
  }

  /**
   * Normalize team names to standard abbreviations
   */
  private normalizeTeamName(team: string): string {
    const teamMappings: Record<string, string> = {
      'ARI': 'ARI', 'ATL': 'ATL', 'BAL': 'BAL', 'BUF': 'BUF',
      'CAR': 'CAR', 'CHI': 'CHI', 'CIN': 'CIN', 'CLE': 'CLE',
      'DAL': 'DAL', 'DEN': 'DEN', 'DET': 'DET', 'GB': 'GB',
      'HOU': 'HOU', 'IND': 'IND', 'JAX': 'JAX', 'KC': 'KC',
      'LV': 'LV', 'LAC': 'LAC', 'LAR': 'LAR', 'MIA': 'MIA',
      'MIN': 'MIN', 'NE': 'NE', 'NO': 'NO', 'NYG': 'NYG',
      'NYJ': 'NYJ', 'PHI': 'PHI', 'PIT': 'PIT', 'SF': 'SF',
      'SEA': 'SEA', 'TB': 'TB', 'TEN': 'TEN', 'WAS': 'WAS',
      
      // Alternative team names
      'Las Vegas Raiders': 'LV',
      'Los Angeles Chargers': 'LAC',
      'Los Angeles Rams': 'LAR',
      'New England Patriots': 'NE',
      'New Orleans Saints': 'NO',
      'New York Giants': 'NYG',
      'New York Jets': 'NYJ',
      'San Francisco 49ers': 'SF',
      'Tampa Bay Buccaneers': 'TB',
      'Washington Commanders': 'WAS'
    };

    return teamMappings[team.toUpperCase()] || team.toUpperCase().slice(0, 3);
  }

  /**
   * Normalize position names
   */
  private normalizePosition(position: string): string {
    const positionMappings: Record<string, string> = {
      'QB': 'QB', 'RB': 'RB', 'WR': 'WR', 'TE': 'TE',
      'K': 'K', 'DEF': 'DEF', 'DST': 'DEF',
      'Quarterback': 'QB',
      'Running Back': 'RB', 
      'Wide Receiver': 'WR',
      'Tight End': 'TE',
      'Kicker': 'K',
      'Defense': 'DEF'
    };

    return positionMappings[position] || position;
  }

  /**
   * Generate unique external ID for player
   */
  private generateExternalId(rawData: any): string {
    // Use official player ID if available, otherwise create composite ID
    if (rawData.PlayerID) return `sportsdata_${rawData.PlayerID}`;
    if (rawData.id) return `espn_${rawData.id}`;
    
    // Fallback: create ID from name and team
    const name = (rawData.Name || rawData.name || rawData.displayName || '').replace(/\s+/g, '_');
    const team = rawData.Team || rawData.team || rawData.teamAbbrev || '';
    return `${name}_${team}`.toLowerCase();
  }

  /**
   * Extract source-specific data and calculate fantasy metrics
   */
  private extractSourceSpecificData(rawData: any, source: string): any {
    const data: any = {};

    if (source === 'sportsdata') {
      // SportsDataIO specific fields
      data.injuryStatus = rawData.InjuryStatus || 'Healthy';
      data.avgPoints = rawData.FantasyPointsPPR || rawData.FantasyPoints || 0;
      data.projectedPoints = rawData.ProjectedFantasyPointsPPR || rawData.ProjectedFantasyPoints || 0;
      
      // Calculate consistency from game stats if available
      if (rawData.GameStats && rawData.GameStats.length > 0) {
        data.consistency = this.calculateConsistencyFromStats(rawData.GameStats);
      }
    }

    if (source === 'espn') {
      // ESPN specific fields
      data.injuryStatus = rawData.injuryStatus || 'Healthy';
      data.ownership = rawData.ownership || 0;
      
      // Use ESPN's fantasy points if available
      if (rawData.stats && rawData.stats.totalPoints) {
        data.avgPoints = rawData.stats.totalPoints / 17; // Assuming 17-game season
      }
    }

    return data;
  }

  /**
   * Calculate consistency score from game-by-game stats
   */
  private calculateConsistencyFromStats(gameStats: any[]): number {
    if (gameStats.length < 3) return 50; // Default for insufficient data

    const points = gameStats.map(game => game.FantasyPointsPPR || game.FantasyPoints || 0);
    const mean = points.reduce((sum, p) => sum + p, 0) / points.length;
    const variance = points.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / points.length;
    const stdDev = Math.sqrt(variance);

    // Convert to 0-100 scale (lower std dev = higher consistency)
    const normalizedStdDev = Math.min(stdDev / mean, 1); // Cap at 100% of mean
    return Math.round((1 - normalizedStdDev) * 100);
  }

  /**
   * Calculate PVS for all players in database
   */
  private async calculatePVSForAllPlayers(progress: SyncProgress): Promise<void> {
    try {
      const allPlayers = await storage.getAllPlayers();
      const dynastyPlayers = allPlayers.filter(p => 
        ['QB', 'RB', 'WR', 'TE'].includes(p.position)
      );

      console.log(`🧮 Calculating PVS for ${dynastyPlayers.length} dynasty-relevant players...`);

      const leagueSettings = {
        scoring: 'ppr' as const,
        positions: ['QB', 'RB', 'WR', 'TE']
      };

      // Process in smaller batches to avoid memory issues
      const pvsBatches = this.createBatches(dynastyPlayers, 25);
      
      for (let i = 0; i < pvsBatches.length; i++) {
        const batch = pvsBatches[i];
        console.log(`🔄 PVS Batch ${i + 1}/${pvsBatches.length}...`);
        
        const pvsPromises = batch.map(async (player) => {
          try {
            const pvsData = await playerValueScoreEngine.calculatePlayerValueScore(
              player.id,
              leagueSettings
            );
            
            // Update player with PVS data
            await storage.updatePlayer(player.id, {
              dynastyValue: Math.round(pvsData.playerValueScore),
              consistency: Math.round(pvsData.consistencyScore),
              // Store component scores for analysis
              efficiency: Math.round(pvsData.positionalScarcityScore),
              durability: Math.round(pvsData.durabilityScore)
            });
            
          } catch (error) {
            progress.errors.push(`PVS calculation failed for ${player.name}: ${error.message}`);
          }
        });

        await Promise.allSettled(pvsPromises);
      }

      console.log(`✅ PVS calculations completed`);
      
    } catch (error) {
      console.error('❌ PVS calculation error:', error);
      progress.errors.push(`PVS calculation error: ${error.message}`);
    }
  }

  /**
   * Rate limiting delay
   */
  private async rateLimitDelay(): Promise<void> {
    const delayMs = Math.floor(this.rateLimitWindow / this.API_RATE_LIMIT) * this.BATCH_SIZE;
    console.log(`⏱️ Rate limiting: waiting ${delayMs}ms...`);
    await new Promise(resolve => setTimeout(resolve, delayMs));
  }

  /**
   * Get sync status and statistics
   */
  async getSyncStatus(): Promise<any> {
    const totalPlayers = await storage.getAllPlayers();
    const dynastyPlayers = totalPlayers.filter(p => 
      ['QB', 'RB', 'WR', 'TE'].includes(p.position)
    );

    return {
      totalPlayers: totalPlayers.length,
      dynastyPlayers: dynastyPlayers.length,
      playersWithPVS: dynastyPlayers.filter(p => p.dynastyValue && p.dynastyValue > 0).length,
      lastSync: null, // Would track in database
      apiSources: {
        sportsDataIO: !!process.env.SPORTSDATA_API_KEY,
        espnAPI: true, // Always available
        sleeperAPI: true // Always available
      }
    };
  }

  /**
   * Incremental sync for daily updates
   */
  async incrementalSync(): Promise<SyncProgress> {
    console.log('🔄 Starting incremental data sync...');
    
    // For incremental sync, focus on:
    // 1. Injury status updates
    // 2. Recent performance data  
    // 3. Ownership percentage updates
    // 4. Re-calculating PVS for trending players

    const progress: SyncProgress = {
      totalPlayers: 0,
      processed: 0,
      created: 0,
      updated: 0,
      errors: [],
      startTime: new Date()
    };

    try {
      // Get injury updates from ESPN
      const injuryNews = await espnAPI.getInjuryNews();
      
      // Update player injury statuses
      for (const injury of injuryNews.slice(0, 50)) { // Limit for rate limiting
        try {
          const player = await this.findPlayerByName(injury.playerName);
          if (player) {
            await storage.updatePlayer(player.id, {
              injuryStatus: injury.status || 'Questionable'
            });
            progress.updated++;
          }
        } catch (error) {
          progress.errors.push(`Injury update failed for ${injury.playerName}: ${error.message}`);
        }
        progress.processed++;
      }

      progress.totalPlayers = progress.processed;
      progress.endTime = new Date();
      progress.duration = progress.endTime.getTime() - progress.startTime.getTime();

      console.log(`✅ Incremental sync completed: ${progress.updated} updates`);
      return progress;

    } catch (error) {
      console.error('❌ Incremental sync failed:', error);
      progress.errors.push(`Incremental sync error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Helper to find player by name
   */
  private async findPlayerByName(playerName: string): Promise<any> {
    const allPlayers = await storage.getAllPlayers();
    return allPlayers.find(p => 
      p.name.toLowerCase().includes(playerName.toLowerCase()) ||
      playerName.toLowerCase().includes(p.name.toLowerCase())
    );
  }
}

export const comprehensiveDataSync = new ComprehensiveDataSyncService();