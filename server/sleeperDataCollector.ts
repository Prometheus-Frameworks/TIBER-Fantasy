/**
 * Sleeper API Data Collector
 * Fetches and stores player data from Sleeper API with filtering criteria
 */

import { db } from './infra/db';
import { players, gameLogs } from '@shared/schema';
import { eq, or } from 'drizzle-orm';

export interface SleeperPlayer {
  player_id: string;
  first_name: string;
  last_name: string;
  full_name: string;
  team: string | null;
  position: string;
  jersey_number: number | null;
  height: string | null;
  weight: number | null;
  age: number | null;
  years_exp: number | null;
  college: string | null;
  birth_country: string | null;
  status: string;
  depth_chart_position: string | null;
  depth_chart_order: number | null;
  // External IDs
  espn_id: string | null;
  yahoo_id: string | null;
  rotowire_id: string | null;
  fantasy_data_id: string | null;
  // ADP data from trends endpoint
  adp?: number;
}

export interface SleeperGameLog {
  player_id: string;
  season: string;
  week: number;
  season_type: string;
  opponent: string;
  stats: {
    pts_ppr?: number;
    pts_half_ppr?: number;
    pts_std?: number;
    pass_att?: number;
    pass_cmp?: number;
    pass_yd?: number;
    pass_td?: number;
    pass_int?: number;
    pass_2pt?: number;
    rush_att?: number;
    rush_yd?: number;
    rush_td?: number;
    rush_2pt?: number;
    rec?: number;
    rec_tgt?: number;
    rec_yd?: number;
    rec_td?: number;
    rec_2pt?: number;
    fum?: number;
    fum_lost?: number;
  };
}

export class SleeperDataCollector {
  private readonly SLEEPER_BASE_URL = 'https://api.sleeper.app/v1';
  private readonly VALID_POSITIONS = ['QB', 'RB', 'WR', 'TE'];
  private readonly RATE_LIMIT_DELAY = 100; // 100ms between requests

  /**
   * Main collection method - fetch and store all eligible players
   */
  async collectAndStorePlayerData(): Promise<{
    playersProcessed: number;
    playersStored: number;
    gameLogsStored: number;
    errors: string[];
  }> {
    console.log('🏈 Starting Sleeper data collection...');
    
    const errors: string[] = [];
    let playersProcessed = 0;
    let playersStored = 0;
    let gameLogsStored = 0;

    try {
      // 1. Fetch all players from Sleeper
      const allPlayers = await this.fetchAllPlayers();
      console.log(`📋 Retrieved ${Object.keys(allPlayers).length} total players from Sleeper`);

      // 2. Fetch ADP data
      const adpData = await this.fetchADPData();
      console.log(`📈 Retrieved ADP data for ${Object.keys(adpData).length} players`);

      // 3. Filter eligible players
      const eligiblePlayers = this.filterEligiblePlayers(allPlayers, adpData);
      console.log(`✅ ${eligiblePlayers.length} players meet criteria for storage`);

      // 4. Store players in database
      for (const player of eligiblePlayers) {
        try {
          await this.storePlayer(player);
          playersStored++;
          
          // Optional: Fetch and store game logs (can be enabled)
          // const logs = await this.fetchPlayerGameLogs(player.player_id);
          // gameLogsStored += await this.storeGameLogs(player.player_id, logs);
          
          playersProcessed++;
          
          // Rate limiting
          if (playersProcessed % 10 === 0) {
            console.log(`📊 Processed ${playersProcessed}/${eligiblePlayers.length} players...`);
            await new Promise(resolve => setTimeout(resolve, this.RATE_LIMIT_DELAY));
          }
        } catch (error) {
          const errorMsg = `Failed to store player ${player.full_name}: ${error}`;
          errors.push(errorMsg);
          console.error(errorMsg);
        }
      }

      console.log(`🎯 Collection complete! Stored ${playersStored} players, ${gameLogsStored} game logs`);
      
      return {
        playersProcessed,
        playersStored,
        gameLogsStored,
        errors
      };

    } catch (error) {
      const errorMsg = `Critical error in data collection: ${error}`;
      errors.push(errorMsg);
      console.error(errorMsg);
      throw error;
    }
  }

  /**
   * Fetch all players from Sleeper API
   */
  private async fetchAllPlayers(): Promise<Record<string, SleeperPlayer>> {
    const response = await fetch(`${this.SLEEPER_BASE_URL}/players/nfl`);
    if (!response.ok) {
      throw new Error(`Failed to fetch players: ${response.status} ${response.statusText}`);
    }
    return await response.json();
  }

  /**
   * Fetch ADP data from Sleeper trends
   */
  private async fetchADPData(): Promise<Record<string, number>> {
    try {
      const response = await fetch(`${this.SLEEPER_BASE_URL}/players/nfl/trending/add?lookback_hours=24&limit=1000`);
      if (!response.ok) {
        console.warn(`ADP fetch failed: ${response.status}, continuing without ADP data`);
        return {};
      }
      
      const trendingData = await response.json();
      const adpMap: Record<string, number> = {};
      
      // Process trending data to extract ADP-like rankings
      trendingData.forEach((player: any, index: number) => {
        if (player.player_id) {
          // Use trending position as proxy for ADP (higher trending = lower ADP)
          adpMap[player.player_id] = index + 1;
        }
      });
      
      return adpMap;
    } catch (error) {
      console.warn(`Could not fetch ADP data: ${error}`);
      return {};
    }
  }

  /**
   * Filter players based on your criteria
   */
  private filterEligiblePlayers(
    allPlayers: Record<string, SleeperPlayer>, 
    adpData: Record<string, number>
  ): SleeperPlayer[] {
    const eligible: SleeperPlayer[] = [];

    for (const [playerId, player] of Object.entries(allPlayers)) {
      // Check all criteria
      const hasValidTeam = player.team && player.team !== null && player.team.length > 0;
      const hasValidPosition = this.VALID_POSITIONS.includes(player.position);
      const isNotRetired = player.status !== 'Retired' && player.status !== 'Inactive';
      const hasADP = adpData[playerId] !== undefined;

      if (hasValidTeam && hasValidPosition && isNotRetired && hasADP) {
        // Add ADP to player data
        player.adp = adpData[playerId];
        eligible.push(player);
      }
    }

    return eligible;
  }

  /**
   * Store individual player in database
   */
  private async storePlayer(sleeperPlayer: SleeperPlayer): Promise<void> {
    // Check if player already exists
    const existingPlayer = await db
      .select()
      .from(players)
      .where(eq(players.sleeperId, sleeperPlayer.player_id))
      .limit(1);

    const playerData = {
      // Core required fields  
      name: sleeperPlayer.full_name || `${sleeperPlayer.first_name} ${sleeperPlayer.last_name}`.trim(),
      team: sleeperPlayer.team!,
      position: sleeperPlayer.position,
      avgPoints: 0, // Will be calculated from game logs
      projectedPoints: 0, // Will be updated separately
      ownershipPercentage: 50, // Default, will be updated
      isAvailable: true,
      upside: 0, // Will be calculated
      
      // Sleeper-specific fields
      sleeperId: sleeperPlayer.player_id,
      firstName: sleeperPlayer.first_name,
      lastName: sleeperPlayer.last_name,
      fullName: sleeperPlayer.full_name,
      jerseyNumber: sleeperPlayer.jersey_number,
      age: sleeperPlayer.age,
      yearsExp: sleeperPlayer.years_exp,
      height: sleeperPlayer.height,
      weight: sleeperPlayer.weight,
      college: sleeperPlayer.college,
      birthCountry: sleeperPlayer.birth_country,
      status: sleeperPlayer.status,
      depthChartPosition: sleeperPlayer.depth_chart_position,
      depthChartOrder: sleeperPlayer.depth_chart_order,
      
      // External IDs
      espnId: sleeperPlayer.espn_id,
      yahooId: sleeperPlayer.yahoo_id,
      rotowireId: sleeperPlayer.rotowire_id,
      fantasyDataId: sleeperPlayer.fantasy_data_id,
      
      // Market data (optional fields that may not exist in DB yet)
      adp: sleeperPlayer.adp,
      
      // Metadata
      lastSleeperSync: new Date(),
    };

    if (existingPlayer.length > 0) {
      // Update existing player
      await db
        .update(players)
        .set({
          ...playerData,
          // Keep existing dynasty values if they exist
          dynastyValue: existingPlayer[0].dynastyValue || null,
        })
        .where(eq(players.sleeperId, sleeperPlayer.player_id));
        
      console.log(`📝 Updated: ${playerData.name} (${playerData.position} - ${playerData.team})`);
    } else {
      // Insert new player
      await db.insert(players).values(playerData);
      console.log(`✨ Added: ${playerData.name} (${playerData.position} - ${playerData.team})`);
    }
  }

  /**
   * Fetch game logs for a specific player (optional feature)
   */
  private async fetchPlayerGameLogs(playerId: string, season: number = 2024): Promise<SleeperGameLog[]> {
    const logs: SleeperGameLog[] = [];
    
    // Fetch regular season stats (weeks 1-18)
    for (let week = 1; week <= 18; week++) {
      try {
        await new Promise(resolve => setTimeout(resolve, this.RATE_LIMIT_DELAY));
        
        const response = await fetch(
          `${this.SLEEPER_BASE_URL}/stats/nfl/regular/${season}/${week}?position=all`
        );
        
        if (!response.ok) continue;
        
        const weekStats = await response.json();
        
        if (weekStats[playerId]) {
          logs.push({
            player_id: playerId,
            season: season.toString(),
            week,
            season_type: 'regular',
            opponent: '', // Would need roster/schedule data
            stats: weekStats[playerId]
          });
        }
      } catch (error) {
        console.warn(`Could not fetch week ${week} stats for player ${playerId}: ${error}`);
      }
    }
    
    return logs;
  }

  /**
   * Store game logs for a player
   */
  private async storeGameLogs(playerId: string, logs: SleeperGameLog[]): Promise<number> {
    let stored = 0;
    
    for (const log of logs) {
      try {
        const gameLogData = {
          playerId: 0, // Will be set after player lookup
          sleeperId: log.player_id,
          season: parseInt(log.season),
          week: log.week,
          seasonType: log.season_type,
          opponent: log.opponent,
          
          // Fantasy points
          fantasyPoints: log.stats.pts_std || 0,
          fantasyPointsPpr: log.stats.pts_ppr || 0,
          fantasyPointsHalfPpr: log.stats.pts_half_ppr || 0,
          
          // Passing
          passAttempts: log.stats.pass_att || 0,
          passCompletions: log.stats.pass_cmp || 0,
          passYards: log.stats.pass_yd || 0,
          passTd: log.stats.pass_td || 0,
          passInt: log.stats.pass_int || 0,
          pass2pt: log.stats.pass_2pt || 0,
          
          // Rushing  
          rushAttempts: log.stats.rush_att || 0,
          rushYards: log.stats.rush_yd || 0,
          rushTd: log.stats.rush_td || 0,
          rush2pt: log.stats.rush_2pt || 0,
          
          // Receiving
          receptions: log.stats.rec || 0,
          targets: log.stats.rec_tgt || 0,
          recYards: log.stats.rec_yd || 0,
          recTd: log.stats.rec_td || 0,
          rec2pt: log.stats.rec_2pt || 0,
          
          // Other
          fumbles: log.stats.fum || 0,
          fumblesLost: log.stats.fum_lost || 0,
        };

        // Find player ID from sleeper ID
        const player = await db
          .select()
          .from(players)
          .where(eq(players.sleeperId, log.player_id))
          .limit(1);

        if (player.length > 0) {
          gameLogData.playerId = player[0].id;
          
          // Insert or update game log
          await db.insert(gameLogs).values(gameLogData).onConflictDoNothing();
          stored++;
        }
      } catch (error) {
        console.warn(`Failed to store game log: ${error}`);
      }
    }
    
    return stored;
  }
}

export const sleeperDataCollector = new SleeperDataCollector();