/**
 * Sleeper Sync Service with Cache Fallback
 * Handles real-time sync with Sleeper API and graceful fallback to cached data
 */

import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';

export interface SleeperPlayer {
  player_id: string;
  full_name: string;
  first_name: string;
  last_name: string;
  position: string;
  team: string;
  age: number;
  years_exp: number;
  status: string;
  fantasy_positions: string[];
  injury_status?: string;
  search_full_name?: string;
}

export interface SleeperProjection {
  player_id: string;
  week: number;
  season: string;
  projection_data: {
    pass_yds?: number;
    pass_tds?: number;
    pass_int?: number;
    rush_yds?: number;
    rush_tds?: number;
    rec_yds?: number;
    rec_tds?: number;
    receptions?: number;
    fantasy_points?: number;
    fantasy_points_ppr?: number;
  };
}

export interface SleeperSyncResult {
  success: boolean;
  source: 'live' | 'cache';
  timestamp: string;
  players_count: number;
  projections_count: number;
  error?: string;
}

class SleeperSyncService {
  private readonly CACHE_DIR = path.join(process.cwd(), 'server', 'data', 'sleeper_cache');
  private readonly PLAYERS_CACHE_FILE = path.join(this.CACHE_DIR, 'players.json');
  private readonly PROJECTIONS_CACHE_FILE = path.join(this.CACHE_DIR, 'projections.json');
  private readonly BASE_URL = 'https://api.sleeper.app/v1';
  private readonly CACHE_EXPIRY_HOURS = 6;

  constructor() {
    this.ensureCacheDirectory();
  }

  private async ensureCacheDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.CACHE_DIR, { recursive: true });
    } catch (error) {
      console.error('Failed to create cache directory:', error);
    }
  }

  private async isCacheStale(filePath: string): Promise<boolean> {
    try {
      const stats = await fs.stat(filePath);
      const ageHours = (Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60);
      return ageHours > this.CACHE_EXPIRY_HOURS;
    } catch {
      return true; // File doesn't exist or can't be accessed
    }
  }

  private async readCache<T>(filePath: string): Promise<T | null> {
    try {
      const data = await fs.readFile(filePath, 'utf8');
      return JSON.parse(data);
    } catch {
      return null;
    }
  }

  private async writeCache<T>(filePath: string, data: T): Promise<void> {
    try {
      await fs.writeFile(filePath, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error(`Failed to write cache file ${filePath}:`, error);
    }
  }

  /**
   * Sync all NFL players from Sleeper API
   */
  async syncPlayers(): Promise<SleeperSyncResult> {
    const startTime = new Date().toISOString();
    
    try {
      // Try live API first
      console.log('📡 Attempting live Sleeper players sync...');
      const response = await axios.get(`${this.BASE_URL}/players/nfl`, {
        timeout: 10000,
        headers: {
          'User-Agent': 'OnTheClock/1.0'
        }
      });

      const players: SleeperPlayer[] = Object.values(response.data);
      const filteredPlayers = players.filter(p => 
        p.position && ['QB', 'RB', 'WR', 'TE'].includes(p.position)
      );

      await this.writeCache(this.PLAYERS_CACHE_FILE, filteredPlayers);
      
      console.log(`✅ Live sync successful: ${filteredPlayers.length} players`);
      return {
        success: true,
        source: 'live',
        timestamp: startTime,
        players_count: filteredPlayers.length,
        projections_count: 0
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.warn('⚠️ Live sync failed, falling back to cache:', errorMessage);
      
      // Fallback to cache
      const cachedPlayers = await this.readCache<SleeperPlayer[]>(this.PLAYERS_CACHE_FILE);
      
      if (cachedPlayers) {
        console.log(`📦 Using cached players: ${cachedPlayers.length} entries`);
        return {
          success: true,
          source: 'cache',
          timestamp: startTime,
          players_count: cachedPlayers.length,
          projections_count: 0
        };
      }

      return {
        success: false,
        source: 'cache',
        timestamp: startTime,
        players_count: 0,
        projections_count: 0,
        error: 'No cache available and live sync failed'
      };
    }
  }

  /**
   * Get all cached players
   */
  async getPlayers(): Promise<SleeperPlayer[]> {
    const players = await this.readCache<SleeperPlayer[]>(this.PLAYERS_CACHE_FILE);
    return players || [];
  }

  /**
   * Get player by ID
   */
  async getPlayerById(playerId: string): Promise<SleeperPlayer | null> {
    const players = await this.getPlayers();
    return players.find(p => p.player_id === playerId) || null;
  }

  /**
   * Search players by name
   */
  async searchPlayers(query: string): Promise<SleeperPlayer[]> {
    const players = await this.getPlayers();
    const searchTerm = query.toLowerCase();
    
    return players.filter(p => 
      p.full_name?.toLowerCase().includes(searchTerm) ||
      p.search_full_name?.toLowerCase().includes(searchTerm) ||
      `${p.first_name} ${p.last_name}`.toLowerCase().includes(searchTerm)
    );
  }

  /**
   * Get players by position
   */
  async getPlayersByPosition(position: string): Promise<SleeperPlayer[]> {
    const players = await this.getPlayers();
    return players.filter(p => p.position === position.toUpperCase());
  }

  /**
   * Force refresh cache (for manual sync)
   */
  async forceRefresh(): Promise<SleeperSyncResult> {
    // Delete cache files to force refresh
    try {
      await fs.unlink(this.PLAYERS_CACHE_FILE);
    } catch {}
    
    return await this.syncPlayers();
  }

  /**
   * Get sync status and cache information
   */
  async getSyncStatus(): Promise<{
    cache_exists: boolean;
    cache_stale: boolean;
    last_sync: string | null;
    players_count: number;
  }> {
    const cacheExists = await this.readCache(this.PLAYERS_CACHE_FILE) !== null;
    const cacheStale = await this.isCacheStale(this.PLAYERS_CACHE_FILE);
    
    let lastSync = null;
    let playersCount = 0;
    
    if (cacheExists) {
      try {
        const stats = await fs.stat(this.PLAYERS_CACHE_FILE);
        lastSync = stats.mtime.toISOString();
        const players = await this.getPlayers();
        playersCount = players.length;
      } catch {}
    }

    return {
      cache_exists: cacheExists,
      cache_stale: cacheStale,
      last_sync: lastSync,
      players_count: playersCount
    };
  }
}

export const sleeperSyncService = new SleeperSyncService();