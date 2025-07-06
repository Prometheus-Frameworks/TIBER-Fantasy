/**
 * Sleeper Player Database Service
 * Comprehensive service for syncing NFL player data from Sleeper API
 * Includes: player profiles, physical stats, game logs, and photos
 */

import { db } from "./db";
import { players, gameLogs, type InsertGameLogType } from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";

interface SleeperPlayer {
  player_id: string;
  first_name: string;
  last_name: string;
  full_name: string;
  position: string;
  team: string;
  number: number;
  age: number;
  years_exp: number;
  height: string; // e.g., "6'4""
  weight: number;
  college: string;
  birth_country: string;
  status: string; // "Active", "Inactive"
  fantasy_positions: string[];
  depth_chart_position: string;
  depth_chart_order: number;
  
  // External IDs
  espn_id: string;
  yahoo_id: string;
  rotowire_id: string;
  fantasy_data_id: string;
}

interface SleeperStats {
  player_id: string;
  season: number;
  week: number;
  season_type: string;
  opponent: string;
  game_date: string;
  
  // Fantasy points
  pts_ppr: number;
  pts_half_ppr: number;
  pts_std: number;
  
  // Passing
  pass_att: number;
  pass_cmp: number;
  pass_yd: number;
  pass_td: number;
  pass_int: number;
  pass_2pt: number;
  
  // Rushing
  rush_att: number;
  rush_yd: number;
  rush_td: number;
  rush_2pt: number;
  
  // Receiving
  rec: number;
  rec_tgt: number;
  rec_yd: number;
  rec_td: number;
  rec_2pt: number;
  
  // Other
  fum: number;
  fum_lost: number;
}

export class SleeperPlayerDB {
  private readonly baseUrl = 'https://api.sleeper.app/v1';
  private readonly statsUrl = 'https://api.sleeper.com/stats/nfl';
  private readonly rateLimitDelay = 150; // 150ms between requests for safety
  private readonly maxRetries = 3;
  
  private syncStatus = {
    isRunning: false,
    progress: 0,
    total: 0,
    processed: 0,
    errors: 0,
    startTime: null as Date | null,
    currentPhase: 'idle' as 'idle' | 'fetching' | 'processing' | 'complete' | 'error',
    lastError: null as string | null,
    estimatedTimeRemaining: 0
  };
  
  /**
   * Get current sync status for progress tracking
   */
  getSyncStatus() {
    return { ...this.syncStatus };
  }

  /**
   * Full sync of all NFL players from Sleeper API with comprehensive progress tracking
   * Use sparingly - intended for daily updates only
   */
  async syncAllPlayers(): Promise<{ 
    success: boolean; 
    playersUpdated: number; 
    errors: string[] 
  }> {
    // Prevent concurrent syncs
    if (this.syncStatus.isRunning) {
      throw new Error('Player sync already in progress');
    }

    // Initialize sync status
    this.syncStatus = {
      isRunning: true,
      progress: 0,
      total: 0,
      processed: 0,
      errors: 0,
      startTime: new Date(),
      currentPhase: 'fetching',
      lastError: null,
      estimatedTimeRemaining: 0
    };

    console.log('🔄 Starting comprehensive Sleeper player sync...');
    
    try {
      this.syncStatus.currentPhase = 'fetching';
      const response = await fetch(`${this.baseUrl}/players/nfl`);
      if (!response.ok) {
        throw new Error(`Sleeper API error: ${response.status} ${response.statusText}`);
      }
      
      const playersData: Record<string, SleeperPlayer> = await response.json();
      const playersList = Object.values(playersData)
        .filter(player => player && player.player_id && player.position && player.position !== 'DEF');
      
      this.syncStatus.total = playersList.length;
      this.syncStatus.currentPhase = 'processing';
      
      console.log(`📊 Retrieved ${playersList.length} active NFL players from Sleeper API`);
      
      let playersUpdated = 0;
      const errors: string[] = [];
      
      // Process in smaller batches for better reliability
      const batchSize = 25;
      for (let i = 0; i < playersList.length; i += batchSize) {
        const batch = playersList.slice(i, i + batchSize);
        
        try {
          await this.processBatchWithRetry(batch);
          playersUpdated += batch.length;
          this.syncStatus.processed += batch.length;
          this.syncStatus.progress = Math.round((this.syncStatus.processed / this.syncStatus.total) * 100);
          
          // Calculate estimated time remaining
          const elapsed = Date.now() - this.syncStatus.startTime!.getTime();
          const rate = this.syncStatus.processed / (elapsed / 1000); // players per second
          const remaining = this.syncStatus.total - this.syncStatus.processed;
          this.syncStatus.estimatedTimeRemaining = Math.round(remaining / rate);
          
          console.log(`📈 Progress: ${this.syncStatus.processed}/${this.syncStatus.total} (${this.syncStatus.progress}%)`);
          
          // Rate limiting between batches
          if (i + batchSize < playersList.length) {
            await this.delay(this.rateLimitDelay);
          }
        } catch (error) {
          console.error(`❌ Batch processing error (${i}-${i + batchSize}):`, error);
          errors.push(`Batch ${i}-${i + batchSize}: ${error}`);
          this.syncStatus.errors++;
          this.syncStatus.lastError = `Batch error: ${error}`;
        }
      }
      
      console.log(`✅ Sleeper sync complete: ${playersUpdated} players updated`);
      
      return {
        success: true,
        playersUpdated,
        errors
      };
      
    } catch (error) {
      console.error('❌ Full player sync failed:', error);
      this.syncStatus.currentPhase = 'error';
      this.syncStatus.lastError = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        playersUpdated: 0,
        errors: [error instanceof Error ? error.message : String(error)]
      };
    } finally {
      this.syncStatus.isRunning = false;
    }
  }

  /**
   * Process batch with retry logic for reliability
   */
  private async processBatchWithRetry(batch: SleeperPlayer[]): Promise<void> {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        await this.processBatch(batch);
        return; // Success, exit retry loop
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.warn(`⚠️ Batch attempt ${attempt}/${this.maxRetries} failed:`, lastError.message);
        
        if (attempt < this.maxRetries) {
          // Exponential backoff
          await this.delay(this.rateLimitDelay * Math.pow(2, attempt - 1));
        }
      }
    }
    
    throw lastError || new Error('Unknown batch processing error');
  }
  
  /**
   * Sync player game logs for a specific season and week
   */
  async syncGameLogs(season: number, week: number, seasonType: string = 'regular'): Promise<{
    success: boolean;
    logsUpdated: number;
    errors: string[];
  }> {
    console.log(`🔄 Syncing game logs for ${season} season, week ${week} (${seasonType})...`);
    
    try {
      const response = await fetch(
        `${this.statsUrl}/${season}/${week}?season_type=${seasonType}`
      );
      
      if (!response.ok) {
        throw new Error(`Stats API error: ${response.status} ${response.statusText}`);
      }
      
      const statsData: Record<string, SleeperStats> = await response.json();
      const statsList = Object.values(statsData);
      
      console.log(`📊 Retrieved ${statsList.length} game logs`);
      
      let logsUpdated = 0;
      const errors: string[] = [];
      
      for (const stats of statsList) {
        try {
          await this.processGameLog(stats, season, week, seasonType);
          logsUpdated++;
        } catch (error) {
          console.error(`❌ Game log processing error for ${stats.player_id}:`, error);
          errors.push(`Player ${stats.player_id}: ${error}`);
        }
      }
      
      console.log(`✅ Game logs sync complete: ${logsUpdated} logs updated`);
      
      return {
        success: true,
        logsUpdated,
        errors
      };
      
    } catch (error) {
      console.error('❌ Game logs sync failed:', error);
      return {
        success: false,
        logsUpdated: 0,
        errors: [error.toString()]
      };
    }
  }
  
  /**
   * Get trending players from Sleeper API
   */
  async getTrendingPlayers(type: 'add' | 'drop' = 'add', hours = 24, limit = 25): Promise<{
    success: boolean;
    players: any[];
    errors: string[];
  }> {
    try {
      const response = await fetch(
        `${this.baseUrl}/players/nfl/trending/${type}?lookback_hours=${hours}&limit=${limit}`
      );
      
      if (!response.ok) {
        throw new Error(`Trending API error: ${response.status} ${response.statusText}`);
      }
      
      const trendingData = await response.json();
      
      return {
        success: true,
        players: trendingData,
        errors: []
      };
      
    } catch (error) {
      console.error('❌ Trending players fetch failed:', error);
      return {
        success: false,
        players: [],
        errors: [error.toString()]
      };
    }
  }
  
  /**
   * Get player headshot/photo URLs
   * Sleeper uses a standardized format for player photos
   */
  getPlayerPhotoUrl(sleeperId: string, size: 'small' | 'medium' | 'large' = 'medium'): string {
    const sizeMap = {
      small: '64',
      medium: '128',
      large: '256'
    };
    
    // Sleeper player photos follow this pattern
    return `https://sleepercdn.com/content/nfl/players/thumb/${sleeperId}.jpg`;
  }
  
  /**
   * Sync individual player by Sleeper ID
   */
  async syncPlayerById(sleeperId: string): Promise<{
    success: boolean;
    player?: any;
    error?: string;
  }> {
    try {
      // Get all players and find the specific one
      const response = await fetch(`${this.baseUrl}/players/nfl`);
      if (!response.ok) {
        throw new Error(`Sleeper API error: ${response.status} ${response.statusText}`);
      }
      
      const playersData: Record<string, SleeperPlayer> = await response.json();
      const playerData = playersData[sleeperId];
      
      if (!playerData) {
        return {
          success: false,
          error: `Player ${sleeperId} not found in Sleeper database`
        };
      }
      
      const updatedPlayer = await this.upsertPlayer(playerData);
      
      return {
        success: true,
        player: updatedPlayer
      };
      
    } catch (error) {
      console.error(`❌ Individual player sync failed for ${sleeperId}:`, error);
      return {
        success: false,
        error: error.toString()
      };
    }
  }
  
  /**
   * Process a batch of players and upsert to database
   */
  private async processBatch(players: SleeperPlayer[]): Promise<void> {
    for (const player of players) {
      await this.upsertPlayer(player);
    }
  }
  
  /**
   * Upsert individual player to database
   */
  private async upsertPlayer(playerData: SleeperPlayer): Promise<any> {
    const photoUrl = this.getPlayerPhotoUrl(playerData.player_id);
    
    const playerInsert = {
      name: playerData.full_name || `${playerData.first_name} ${playerData.last_name}`,
      team: playerData.team || 'FA',
      position: playerData.position || 'UNKNOWN',
      avgPoints: 0, // Will be calculated from game logs
      projectedPoints: 0, // Will be calculated from advanced analytics
      ownershipPercentage: 50, // Default value
      imageUrl: photoUrl,
      
      // Sleeper-specific fields
      sleeperId: playerData.player_id,
      firstName: playerData.first_name,
      lastName: playerData.last_name,
      fullName: playerData.full_name,
      jerseyNumber: playerData.number,
      age: playerData.age,
      yearsExp: playerData.years_exp,
      height: playerData.height,
      weight: playerData.weight,
      college: playerData.college,
      birthCountry: playerData.birth_country,
      status: playerData.status,
      depthChartPosition: playerData.depth_chart_position,
      depthChartOrder: playerData.depth_chart_order,
      
      // External IDs
      espnId: playerData.espn_id,
      yahooId: playerData.yahoo_id,
      rotowireId: playerData.rotowire_id,
      fantasyDataId: playerData.fantasy_data_id,
      
      lastSleeperSync: new Date()
    };
    
    try {
      // Check if player exists
      const [existingPlayer] = await db
        .select()
        .from(players)
        .where(eq(players.sleeperId, playerData.player_id))
        .limit(1);
      
      if (existingPlayer) {
        // Update existing player
        const [updatedPlayer] = await db
          .update(players)
          .set(playerInsert)
          .where(eq(players.sleeperId, playerData.player_id))
          .returning();
        
        return updatedPlayer;
      } else {
        // Insert new player
        const [newPlayer] = await db
          .insert(players)
          .values(playerInsert)
          .returning();
        
        return newPlayer;
      }
      
    } catch (error) {
      console.error(`❌ Player upsert failed for ${playerData.full_name}:`, error);
      throw error;
    }
  }
  
  /**
   * Process and store game log data
   */
  private async processGameLog(stats: SleeperStats, season: number, week: number, seasonType: string): Promise<void> {
    // Find the player in our database
    const [player] = await db
      .select()
      .from(players)
      .where(eq(players.sleeperId, stats.player_id))
      .limit(1);
    
    if (!player) {
      console.warn(`⚠️ Player ${stats.player_id} not found in database, skipping game log`);
      return;
    }
    
    const gameLogData: InsertGameLogType = {
      playerId: player.id,
      sleeperId: stats.player_id,
      season,
      week,
      seasonType,
      opponent: stats.opponent,
      gameDate: stats.game_date ? new Date(stats.game_date) : null,
      
      // Fantasy points
      fantasyPoints: stats.pts_std || 0,
      fantasyPointsPpr: stats.pts_ppr || 0,
      fantasyPointsHalfPpr: stats.pts_half_ppr || 0,
      
      // Passing stats
      passAttempts: stats.pass_att || 0,
      passCompletions: stats.pass_cmp || 0,
      passYards: stats.pass_yd || 0,
      passTd: stats.pass_td || 0,
      passInt: stats.pass_int || 0,
      pass2pt: stats.pass_2pt || 0,
      
      // Rushing stats
      rushAttempts: stats.rush_att || 0,
      rushYards: stats.rush_yd || 0,
      rushTd: stats.rush_td || 0,
      rush2pt: stats.rush_2pt || 0,
      
      // Receiving stats
      receptions: stats.rec || 0,
      targets: stats.rec_tgt || 0,
      recYards: stats.rec_yd || 0,
      recTd: stats.rec_td || 0,
      rec2pt: stats.rec_2pt || 0,
      
      // Other stats
      fumbles: stats.fum || 0,
      fumblesLost: stats.fum_lost || 0
    };
    
    try {
      // Check if game log already exists
      const [existingLog] = await db
        .select()
        .from(gameLogs)
        .where(
          and(
            eq(gameLogs.sleeperId, stats.player_id),
            eq(gameLogs.season, season),
            eq(gameLogs.week, week),
            eq(gameLogs.seasonType, seasonType)
          )
        )
        .limit(1);
      
      if (existingLog) {
        // Update existing log
        await db
          .update(gameLogs)
          .set(gameLogData)
          .where(eq(gameLogs.id, existingLog.id));
      } else {
        // Insert new log
        await db
          .insert(gameLogs)
          .values(gameLogData);
      }
      
    } catch (error) {
      console.error(`❌ Game log upsert failed for ${stats.player_id}:`, error);
      throw error;
    }
  }
  
  /**
   * Get player statistics summary from game logs
   */
  async getPlayerStats(sleeperId: string, season: number, seasonType: string = 'regular'): Promise<{
    totalStats: any;
    weeklyLogs: any[];
    averages: any;
  }> {
    try {
      const logs = await db
        .select()
        .from(gameLogs)
        .where(
          and(
            eq(gameLogs.sleeperId, sleeperId),
            eq(gameLogs.season, season),
            eq(gameLogs.seasonType, seasonType)
          )
        );
      
      if (logs.length === 0) {
        return {
          totalStats: {},
          weeklyLogs: [],
          averages: {}
        };
      }
      
      // Calculate totals and averages
      const totals = logs.reduce((acc, log) => ({
        fantasyPointsPpr: (acc.fantasyPointsPpr || 0) + (log.fantasyPointsPpr || 0),
        passYards: (acc.passYards || 0) + (log.passYards || 0),
        passTd: (acc.passTd || 0) + (log.passTd || 0),
        rushYards: (acc.rushYards || 0) + (log.rushYards || 0),
        rushTd: (acc.rushTd || 0) + (log.rushTd || 0),
        receptions: (acc.receptions || 0) + (log.receptions || 0),
        recYards: (acc.recYards || 0) + (log.recYards || 0),
        recTd: (acc.recTd || 0) + (log.recTd || 0),
        targets: (acc.targets || 0) + (log.targets || 0)
      }), {});
      
      const averages = Object.keys(totals).reduce((acc, key) => ({
        ...acc,
        [key]: Number((totals[key] / logs.length).toFixed(1))
      }), {});
      
      return {
        totalStats: totals,
        weeklyLogs: logs,
        averages
      };
      
    } catch (error) {
      console.error(`❌ Player stats fetch failed for ${sleeperId}:`, error);
      throw error;
    }
  }
  
  /**
   * Utility function for rate limiting
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const sleeperPlayerDB = new SleeperPlayerDB();