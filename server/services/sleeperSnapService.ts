import axios from 'axios';
import fs from 'fs';
import path from 'path';

interface SleeperPlayer {
  player_id: string;
  first_name: string;
  last_name: string;
  full_name: string;
  position: string;
  team: string;
  active: boolean;
}

interface SnapPercentageData {
  player_name: string;
  snap_percentages: {
    [key: string]: number; // week_1: 42, week_2: 56, etc.
  };
}

export class SleeperSnapService {
  private cache: Map<string, any> = new Map();
  private cacheExpiry: number = 30 * 60 * 1000; // 30 minutes

  /**
   * Check if Sleeper API provides snap percentage data
   */
  async checkSleeperSnapData(): Promise<{ hasSnapData: boolean; alternativeSources: string[] }> {
    try {
      console.log('🔍 Checking Sleeper API for snap percentage data...');
      
      // Test Sleeper stats endpoint for 2024 season
      const statsResponse = await axios.get('https://api.sleeper.app/v1/stats/nfl/regular/2024', {
        timeout: 10000
      });
      
      if (statsResponse.data) {
        // Check if any player has snap-related fields
        const sampleStats = Object.values(statsResponse.data).slice(0, 10);
        const hasSnapFields = sampleStats.some((stats: any) => 
          stats && (
            'snap_count' in stats || 
            'snap_pct' in stats || 
            'snaps' in stats ||
            'snap_percentage' in stats
          )
        );
        
        console.log(`📊 Sleeper snap data check: ${hasSnapFields ? 'FOUND' : 'NOT FOUND'}`);
        
        return {
          hasSnapData: hasSnapFields,
          alternativeSources: hasSnapFields ? [] : [
            'FantasyPros Snap Count API',
            'ESPN Hidden API',
            'Pro Football Reference',
            'Generated from usage patterns'
          ]
        };
      }
      
      return {
        hasSnapData: false,
        alternativeSources: ['API returned no data']
      };
      
    } catch (error) {
      console.error('❌ Error checking Sleeper snap data:', error);
      return {
        hasSnapData: false,
        alternativeSources: [
          'FantasyPros Snap Count API',
          'ESPN Hidden API', 
          'Generated from game logs'
        ]
      };
    }
  }

  /**
   * Get WR players from Sleeper API for our rankings pool
   */
  async getSleeperWRPlayers(): Promise<SleeperPlayer[]> {
    try {
      const cacheKey = 'sleeper_wr_players';
      const cached = this.cache.get(cacheKey);
      
      if (cached && (Date.now() - cached.timestamp < this.cacheExpiry)) {
        console.log('📋 Using cached Sleeper WR players');
        return cached.data;
      }

      console.log('🏈 Fetching WR players from Sleeper API...');
      
      const response = await axios.get('https://api.sleeper.app/v1/players/nfl', {
        timeout: 15000
      });
      
      if (response.data) {
        // Filter for active WRs
        const wrPlayers = Object.values(response.data)
          .filter((player: any) => 
            player.position === 'WR' && 
            player.active === true &&
            player.team && 
            player.team !== 'None'
          )
          .map((player: any) => ({
            player_id: player.player_id,
            first_name: player.first_name || '',
            last_name: player.last_name || '',
            full_name: player.full_name || `${player.first_name} ${player.last_name}`,
            position: player.position,
            team: player.team,
            active: player.active
          })) as SleeperPlayer[];

        console.log(`✅ Found ${wrPlayers.length} active WRs in Sleeper API`);
        
        // Cache the results
        this.cache.set(cacheKey, {
          data: wrPlayers,
          timestamp: Date.now()
        });
        
        return wrPlayers;
      }
      
      return [];
      
    } catch (error) {
      console.error('❌ Error fetching Sleeper WR players:', error);
      return [];
    }
  }

  /**
   * Attempt to fetch weekly snap percentages from Sleeper API
   */
  async fetchSleeperSnapPercentages(position: string = 'WR'): Promise<SnapPercentageData[]> {
    try {
      console.log(`🏈 Attempting to fetch ${position} snap percentages from Sleeper API...`);
      
      // First check if Sleeper has snap data
      const snapCheck = await this.checkSleeperSnapData();
      
      if (!snapCheck.hasSnapData) {
        console.log('⚠️ Sleeper API does not provide snap percentage data');
        console.log('🔄 Available alternatives:', snapCheck.alternativeSources.join(', '));
        
        // Return existing generated data as fallback
        return this.loadExistingSnapData(position);
      }
      
      // If Sleeper has snap data, fetch it
      const players = await this.getSleeperWRPlayers();
      const snapData: SnapPercentageData[] = [];
      
      // Fetch weekly stats for each player (weeks 1-17)
      for (const player of players.slice(0, 50)) { // Top 50 WRs
        const playerSnapData: SnapPercentageData = {
          player_name: player.full_name,
          snap_percentages: {}
        };
        
        // Fetch each week's data
        for (let week = 1; week <= 17; week++) {
          try {
            // Try to get weekly snap data from Sleeper
            const weeklyStats = await this.fetchWeeklySnapData(player.player_id, week);
            playerSnapData.snap_percentages[`week_${week}`] = weeklyStats.snap_pct || 0;
            
            // Rate limiting
            await new Promise(resolve => setTimeout(resolve, 100));
            
          } catch (weekError) {
            console.log(`⚠️ No snap data for ${player.full_name} week ${week}`);
            playerSnapData.snap_percentages[`week_${week}`] = 0;
          }
        }
        
        snapData.push(playerSnapData);
      }
      
      console.log(`✅ Fetched snap data for ${snapData.length} ${position}s from Sleeper`);
      return snapData;
      
    } catch (error) {
      console.error('❌ Error fetching Sleeper snap percentages:', error);
      
      // Fallback to existing data
      console.log('🔄 Falling back to existing snap percentage data...');
      return this.loadExistingSnapData(position);
    }
  }

  /**
   * Load existing snap percentage data as fallback
   */
  private async loadExistingSnapData(position: string): Promise<SnapPercentageData[]> {
    try {
      const dataPath = path.join(process.cwd(), 'server/data/wr_snap_percentages_2024.json');
      
      if (fs.existsSync(dataPath)) {
        const existingData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
        console.log(`✅ Loaded existing snap data for ${existingData.length} ${position}s`);
        return existingData;
      }
      
      console.log('⚠️ No existing snap data found');
      return [];
      
    } catch (error) {
      console.error('❌ Error loading existing snap data:', error);
      return [];
    }
  }

  /**
   * Attempt to fetch weekly snap data for a specific player
   */
  private async fetchWeeklySnapData(playerId: string, week: number): Promise<{ snap_pct: number }> {
    try {
      // This would be the theoretical endpoint if Sleeper provided snap data
      const response = await axios.get(
        `https://api.sleeper.app/v1/stats/nfl/regular/2024/${week}`,
        { timeout: 5000 }
      );
      
      const playerStats = response.data[playerId];
      
      if (playerStats && 'snap_pct' in playerStats) {
        return { snap_pct: playerStats.snap_pct };
      }
      
      throw new Error('No snap percentage data available');
      
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get service status and data availability
   */
  async getServiceStatus(): Promise<{
    sleeperApiActive: boolean;
    hasSnapData: boolean;
    playerCount: number;
    alternativeSources: string[];
  }> {
    try {
      const players = await this.getSleeperWRPlayers();
      const snapCheck = await this.checkSleeperSnapData();
      
      return {
        sleeperApiActive: players.length > 0,
        hasSnapData: snapCheck.hasSnapData,
        playerCount: players.length,
        alternativeSources: snapCheck.alternativeSources
      };
      
    } catch (error) {
      return {
        sleeperApiActive: false,
        hasSnapData: false,
        playerCount: 0,
        alternativeSources: ['Service unavailable']
      };
    }
  }
}

export const sleeperSnapService = new SleeperSnapService();