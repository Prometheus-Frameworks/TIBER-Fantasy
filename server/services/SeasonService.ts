/**
 * SeasonService - Dynamic season/week detection with hierarchical source fallback
 * Provides intelligent season/week detection using Sleeper API → DB → ENV
 */

import { db } from '../infra/db';
import { seasonState } from '@shared/schema';
import { desc, sql } from 'drizzle-orm';

type SeasonSnapshot = { 
  season: number; 
  week: number; 
  seasonType: 'pre' | 'regular' | 'post'; 
  source: 'sleeper' | 'db' | 'env';
};

interface SleeperStateResponse {
  season: string;
  season_type: string;
  week: number;
}

// Standard error helper
function err(code: string, message: string, details?: any, status?: number) {
  const e: any = new Error(message);
  e.code = code; 
  if (details !== undefined) e.details = details;
  if (status) e.status = status;
  return e;
}

// JSON-structured log helpers  
function logInfo(msg: string, meta?: Record<string, any>) {
  console.log(JSON.stringify({ level:'info', src:'SeasonService', msg, ...(meta||{}) }));
}

function logError(msg: string, error: any, meta?: Record<string, any>) {
  console.error(JSON.stringify({ level:'error', src:'SeasonService', msg, error: error?.message||String(error), stack: error?.stack, ...(meta||{}) }));
}

export class SeasonService {
  private readonly BASE_URL = 'https://api.sleeper.app/v1';
  private readonly CACHE_DURATION = 1000 * 60 * 15; // 15 minutes
  private cachedSnapshot: SeasonSnapshot | null = null;
  private lastCacheUpdate = 0;

  /**
   * Get current season/week with hierarchical detection
   * 1. Try Sleeper /state API
   * 2. Fall back to DB (gold_player_week table)
   * 3. Fall back to ENV variables
   */
  async current(): Promise<SeasonSnapshot> {
    const now = Date.now();
    
    // Return cached result if still valid
    if (this.cachedSnapshot && (now - this.lastCacheUpdate) < this.CACHE_DURATION) {
      logInfo('Returning cached season snapshot', this.cachedSnapshot);
      return this.cachedSnapshot;
    }

    // 1. Try Sleeper API first
    try {
      const snapshot = await this.detectFromSleeper();
      await this.persist(snapshot.source, snapshot.season, snapshot.week, snapshot.seasonType);
      this.cachedSnapshot = snapshot;
      this.lastCacheUpdate = now;
      logInfo('Season detected from Sleeper API', snapshot);
      return snapshot;
    } catch (error) {
      logError('Sleeper API detection failed', error);
    }

    // 2. Try database fallback
    try {
      const snapshot = await this.detectFromDatabase();
      await this.persist(snapshot.source, snapshot.season, snapshot.week, snapshot.seasonType);
      this.cachedSnapshot = snapshot;
      this.lastCacheUpdate = now;
      logInfo('Season detected from database', snapshot);
      return snapshot;
    } catch (error) {
      logError('Database detection failed', error);
    }

    // 3. ENV fallback (always works)
    const snapshot = this.detectFromEnv();
    await this.persist(snapshot.source, snapshot.season, snapshot.week, snapshot.seasonType);
    this.cachedSnapshot = snapshot;
    this.lastCacheUpdate = now;
    logInfo('Season detected from environment', snapshot);
    return snapshot;
  }

  /**
   * Detect season/week from Sleeper /state API
   */
  private async detectFromSleeper(): Promise<SeasonSnapshot> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout

    try {
      const response = await fetch(`${this.BASE_URL}/state/nfl`, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'OnTheClock/1.0'
        }
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw err('SLEEPER_API_ERROR', `Sleeper state API returned ${response.status}`, { status: response.status }, response.status);
      }

      const state: SleeperStateResponse = await response.json();
      
      if (!state.season || !state.season_type || typeof state.week !== 'number') {
        throw err('INVALID_SLEEPER_RESPONSE', 'Sleeper state response missing required fields', { state });
      }

      return {
        season: Number(state.season),
        week: state.week,
        seasonType: this.mapType(state.season_type),
        source: 'sleeper'
      };

    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error?.name === 'AbortError') {
        throw err('SLEEPER_TIMEOUT', 'Sleeper API request timed out');
      }
      throw error;
    }
  }

  /**
   * Detect season/week from database (gold_player_week table)
   */
  private async detectFromDatabase(): Promise<SeasonSnapshot> {
    try {
      // Try to find the latest season/week from existing data
      const latestWeek = await db.execute(sql`
        SELECT season, max(week) as week 
        FROM gold_player_week 
        WHERE season IS NOT NULL AND week IS NOT NULL
        GROUP BY season 
        ORDER BY season DESC, week DESC 
        LIMIT 1
      `);

      if (latestWeek.rows.length === 0) {
        throw err('NO_DATABASE_DATA', 'No season/week data found in database');
      }

      const row = latestWeek.rows[0] as { season: number; week: number };
      
      return {
        season: row.season,
        week: row.week,
        seasonType: this.inferSeasonType(row.week),
        source: 'db'
      };

    } catch (error: any) {
      throw err('DATABASE_QUERY_ERROR', 'Failed to query database for season data', { error: error?.message });
    }
  }

  /**
   * Detect season/week from environment variables (fallback)
   */
  private detectFromEnv(): SeasonSnapshot {
    const currentYear = new Date().getFullYear();
    const season = Number(process.env.TIBER_SEASON) || currentYear;
    const week = Number(process.env.TIBER_WEEK) || this.estimateCurrentWeek();
    
    return {
      season,
      week,
      seasonType: this.inferSeasonType(week),
      source: 'env'
    };
  }

  /**
   * Map Sleeper season type to our canonical format
   */
  private mapType(sleeperType: string): 'pre' | 'regular' | 'post' {
    switch (sleeperType.toLowerCase()) {
      case 'pre':
      case 'preseason': 
        return 'pre';
      case 'post':
      case 'postseason':
      case 'playoffs':
        return 'post';
      case 'regular':
      case 'regular_season':
      default:
        return 'regular';
    }
  }

  /**
   * Infer season type from week number
   */
  private inferSeasonType(week: number): 'pre' | 'regular' | 'post' {
    if (week <= 0) return 'pre';
    if (week >= 19) return 'post'; // Week 19+ is typically playoffs
    return 'regular';
  }

  /**
   * Estimate current NFL week based on calendar date
   */
  private estimateCurrentWeek(): number {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth(); // 0-based
    
    // NFL season typically starts first Thursday after Labor Day (early September)
    // Rough estimation: September = Week 1, October = Week 5, etc.
    if (month < 8) return 1; // Before September
    if (month === 8) return Math.min(4, Math.floor(now.getDate() / 7)); // September
    if (month === 9) return Math.min(8, 4 + Math.floor(now.getDate() / 7)); // October
    if (month === 10) return Math.min(12, 8 + Math.floor(now.getDate() / 7)); // November
    if (month === 11) return Math.min(17, 12 + Math.floor(now.getDate() / 7)); // December
    return 18; // January = playoffs/post-season
  }

  /**
   * Persist season detection to database for tracking
   */
  private async persist(source: string, season: number, week: number, seasonType: string): Promise<void> {
    try {
      await db.insert(seasonState).values({
        source,
        season,
        week,
        seasonType
      });
    } catch (error) {
      // Log but don't throw - persistence failure shouldn't break detection
      logError('Failed to persist season state', error, { source, season, week, seasonType });
    }
  }

  /**
   * Get latest persisted season state from database  
   */
  async getLatestPersistedState(): Promise<SeasonSnapshot | null> {
    try {
      const result = await db
        .select()
        .from(seasonState)
        .orderBy(desc(seasonState.observedAt))
        .limit(1);

      if (result.length === 0) {
        return null;
      }

      const state = result[0];
      return {
        season: state.season,
        week: state.week,
        seasonType: state.seasonType as 'pre' | 'regular' | 'post',
        source: state.source as 'sleeper' | 'db' | 'env'
      };
    } catch (error) {
      logError('Failed to get latest persisted state', error);
      return null;
    }
  }

  /**
   * Clear cache (for testing or manual refresh)
   */
  clearCache(): void {
    this.cachedSnapshot = null;
    this.lastCacheUpdate = 0;
    logInfo('Season service cache cleared');
  }
}

// Export singleton instance
export const seasonService = new SeasonService();