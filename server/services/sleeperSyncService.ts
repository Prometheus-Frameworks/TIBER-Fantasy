/**
 * Sleeper Sync Service with Cache Fallback
 * Handles real-time sync with Sleeper API and graceful fallback to cached data
 */

import axios from 'axios';
import * as fs from 'fs/promises';
import * as path from 'path';

// Centralized axios instance
const http = axios.create({ 
  baseURL: 'https://api.sleeper.app/v1', 
  timeout: 8000, 
  validateStatus: (s) => s >= 200 && s < 500 
});

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

// Standard error helper
function err(code: string, message: string, details?: any, status?: number) {
  const e: any = new Error(message);
  e.code = code; 
  if (details !== undefined) e.details = details;
  if (status) e.status = status;
  return e;
}

// Season validation helper
function validateSeason(season: string): boolean {
  if (!/^\d{4}$/.test(season)) return false;
  const y = Number(season), current = new Date().getFullYear();
  return y >= 2018 && y <= current + 1;
}

// JSON-structured log helpers
function logInfo(msg: string, meta?: Record<string, any>) {
  console.log(JSON.stringify({ level:'info', src:'SleeperSync', msg, ...(meta||{}) }));
}

function logError(msg: string, error: any, meta?: Record<string, any>) {
  console.error(JSON.stringify({ level:'error', src:'SleeperSync', msg, error: error?.message||String(error), stack: error?.stack, ...(meta||{}) }));
}

class SleeperSyncService {
  private readonly CACHE_DIR = path.join(process.cwd(), 'server', 'data', 'sleeper_cache');
  private readonly PLAYERS_CACHE_FILE = path.join(this.CACHE_DIR, 'players.json');
  private readonly PROJECTIONS_CACHE_FILE = path.join(this.CACHE_DIR, 'projections.json');
  private readonly BASE_URL = 'https://api.sleeper.app/v1';
  private readonly CACHE_EXPIRY_HOURS = 6;
  private playersCache = { data: null as SleeperPlayer[] | null, updatedAt: null as Date | null };

  constructor() {
    this.ensureCacheDirectory();
  }

  private async ensureCacheDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.CACHE_DIR, { recursive: true });
    } catch (error) {
      logError('Failed to create cache directory', error);
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
      // Update cache metadata if this is players cache
      if (filePath === this.PLAYERS_CACHE_FILE && Array.isArray(data)) {
        this.playersCache.data = data as SleeperPlayer[];
        this.playersCache.updatedAt = new Date();
      }
    } catch (error) {
      logError(`Failed to write cache file ${filePath}`, error);
    }
  }

  /**
   * Sync all NFL players from Sleeper API
   */
  async syncPlayers(): Promise<SleeperSyncResult> {
    const startTime = new Date().toISOString();
    
    try {
      // Try live API first
      logInfo('Attempting live Sleeper players sync');
      const response = await http.get('/players/nfl', {
        headers: {
          'User-Agent': 'OnTheClock/1.0'
        }
      });

      if (response.status >= 400) {
        throw err('UPSTREAM_ERROR', `Sleeper API returned ${response.status}`, { status: response.status }, 502);
      }

      const players: SleeperPlayer[] = Object.values(response.data);
      const filteredPlayers = players.filter(p => 
        p.position && ['QB', 'RB', 'WR', 'TE'].includes(p.position)
      );

      await this.writeCache(this.PLAYERS_CACHE_FILE, filteredPlayers);
      
      logInfo('Live sync successful', { players_count: filteredPlayers.length });
      return {
        success: true,
        source: 'live',
        timestamp: startTime,
        players_count: filteredPlayers.length,
        projections_count: 0
      };

    } catch (error) {
      logError('Live sync failed, falling back to cache', error);
      
      // Fallback to cache
      const cachedPlayers = await this.readCache<SleeperPlayer[]>(this.PLAYERS_CACHE_FILE);
      
      if (cachedPlayers) {
        logInfo('Using cached players', { players_count: cachedPlayers.length });
        return {
          success: true,
          source: 'cache',
          timestamp: startTime,
          players_count: cachedPlayers.length,
          projections_count: 0
        };
      }

      throw err('NO_DATA', 'No cache available and live sync failed', { original_error: error instanceof Error ? error.message : String(error) }, 502);
    }
  }

  /**
   * Get all cached players
   */
  async getPlayers(): Promise<SleeperPlayer[]> {
    // Use in-memory cache if available
    if (this.playersCache.data) {
      return this.playersCache.data;
    }
    
    const players = await this.readCache<SleeperPlayer[]>(this.PLAYERS_CACHE_FILE);
    if (players) {
      // Update in-memory cache
      this.playersCache.data = players;
      try {
        const stats = await fs.stat(this.PLAYERS_CACHE_FILE);
        this.playersCache.updatedAt = stats.mtime;
      } catch {}
    }
    return players || [];
  }

  /**
   * Get player by ID
   */
  async getPlayerById(playerId: string): Promise<SleeperPlayer | null> {
    if (!playerId) {
      throw err('MISSING_PARAM', 'playerId is required', null, 400);
    }
    
    const players = await this.getPlayers();
    const player = players.find(p => p.player_id === playerId);
    
    if (!player) {
      throw err('PLAYER_NOT_FOUND', `Player with ID ${playerId} not found`, { playerId }, 404);
    }
    
    return player;
  }

  /**
   * Search players by name
   */
  async searchPlayers(query: string): Promise<SleeperPlayer[]> {
    if (!query || typeof query !== 'string') {
      throw err('MISSING_PARAM', 'Search query is required', null, 400);
    }
    
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
    if (!position || typeof position !== 'string') {
      throw err('MISSING_PARAM', 'Position is required', null, 400);
    }
    
    const validPositions = ['QB', 'RB', 'WR', 'TE'];
    const pos = position.toUpperCase();
    
    if (!validPositions.includes(pos)) {
      throw err('INVALID_POSITION', 'Invalid position. Must be QB, RB, WR, or TE', { position, validPositions }, 422);
    }
    
    const players = await this.getPlayers();
    return players.filter(p => p.position === pos);
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

  /**
   * Add materializeLeagueContext method (placeholder implementation)
   */
  async materializeLeagueContext(context: any): Promise<any> {
    const missing: string[] = [];
    
    // Check for missing upstream resources
    if (!context.leagues) missing.push('leagues');
    if (!context.rosters) missing.push('rosters');
    if (!context.matchups) missing.push('matchups');
    
    if (missing.length > 0) {
      throw err('PARTIAL_UPSTREAM', 'Some upstream resources failed', { missing, context }, 206);
    }
    
    return context;
  }
}

// Export functions for cache metadata
export function getPlayersCacheMeta(): { updatedAt: string | null; count: number } {
  const instance = sleeperSyncService as any; // Access private members
  const cache = instance.playersCache || { data: null, updatedAt: null };
  const count = cache.data ? cache.data.length : 0;
  return { updatedAt: cache.updatedAt ? cache.updatedAt.toISOString() : null, count };
}

// Temporary compatibility export (remove later if unused)
export const getCacheMetadata = getPlayersCacheMeta;

export const sleeperSyncService = new SleeperSyncService();