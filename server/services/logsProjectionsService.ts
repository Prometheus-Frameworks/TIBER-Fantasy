/**
 * Logs & Projections Service
 * Centralized service for game logs and projections data
 */

import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';

export interface GameLog {
  player_id: string;
  player_name: string;
  position: string;
  team: string;
  week: number;
  season: number;
  opponent: string;
  game_date: string;
  stats: {
    // Passing
    pass_att?: number;
    pass_cmp?: number;
    pass_yds?: number;
    pass_tds?: number;
    pass_int?: number;
    // Rushing
    rush_att?: number;
    rush_yds?: number;
    rush_tds?: number;
    // Receiving
    receptions?: number;
    rec_yds?: number;
    rec_tds?: number;
    targets?: number;
    // Fantasy
    fantasy_points?: number;
    fantasy_points_ppr?: number;
  };
}

export interface WeeklyProjection {
  player_id: string;
  player_name: string;
  position: string;
  team: string;
  week: number;
  season: number;
  projections: {
    // Passing projections
    pass_att?: number;
    pass_cmp?: number;
    pass_yds?: number;
    pass_tds?: number;
    pass_int?: number;
    // Rushing projections
    rush_att?: number;
    rush_yds?: number;
    rush_tds?: number;
    // Receiving projections
    targets?: number;
    receptions?: number;
    rec_yds?: number;
    rec_tds?: number;
    // Fantasy projections
    fantasy_points?: number;
    fantasy_points_ppr?: number;
    confidence?: number; // 0-100
  };
}

export interface PlayerStats {
  player_id: string;
  player_name: string;
  position: string;
  team: string;
  season: number;
  games_played: number;
  season_totals: {
    pass_yds?: number;
    pass_tds?: number;
    pass_int?: number;
    rush_yds?: number;
    rush_tds?: number;
    rec_yds?: number;
    rec_tds?: number;
    receptions?: number;
    targets?: number;
    fantasy_points?: number;
    fantasy_points_ppr?: number;
  };
  per_game_averages: {
    pass_yds?: number;
    pass_tds?: number;
    rush_yds?: number;
    rush_tds?: number;
    rec_yds?: number;
    rec_tds?: number;
    receptions?: number;
    targets?: number;
    fantasy_points?: number;
    fantasy_points_ppr?: number;
  };
}

class LogsProjectionsService {
  private readonly DATA_DIR = path.join(process.cwd(), 'server', 'data');
  private readonly GAME_LOGS_FILE = path.join(this.DATA_DIR, 'game_logs_2024.json');
  private readonly PROJECTIONS_FILE = path.join(this.DATA_DIR, 'weekly_projections_2025.json');
  private readonly SEASON_STATS_FILE = path.join(this.DATA_DIR, 'season_stats_2024.json');

  constructor() {
    this.ensureDataDirectory();
  }

  private async ensureDataDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.DATA_DIR, { recursive: true });
    } catch (error) {
      console.error('Failed to create data directory:', error);
    }
  }

  private async readDataFile<T>(filePath: string): Promise<T[]> {
    try {
      const data = await fs.readFile(filePath, 'utf8');
      return JSON.parse(data);
    } catch {
      return [];
    }
  }

  private async writeDataFile<T>(filePath: string, data: T[]): Promise<void> {
    try {
      await fs.writeFile(filePath, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error(`Failed to write data file ${filePath}:`, error);
    }
  }

  /**
   * Get game logs for a specific player
   */
  async getPlayerGameLogs(playerId: string, season: number = 2024): Promise<GameLog[]> {
    const allLogs = await this.readDataFile<GameLog>(this.GAME_LOGS_FILE);
    return allLogs.filter(log => 
      log.player_id === playerId && log.season === season
    ).sort((a, b) => a.week - b.week);
  }

  /**
   * Get game logs for a specific position
   */
  async getPositionGameLogs(position: string, season: number = 2024): Promise<GameLog[]> {
    const allLogs = await this.readDataFile<GameLog>(this.GAME_LOGS_FILE);
    return allLogs.filter(log => 
      log.position === position.toUpperCase() && log.season === season
    );
  }

  /**
   * Get game logs for a specific week
   */
  async getWeekGameLogs(week: number, season: number = 2024): Promise<GameLog[]> {
    const allLogs = await this.readDataFile<GameLog>(this.GAME_LOGS_FILE);
    return allLogs.filter(log => 
      log.week === week && log.season === season
    );
  }

  /**
   * Get weekly projections for a player
   */
  async getPlayerProjections(playerId: string, season: number = 2025): Promise<WeeklyProjection[]> {
    const allProjections = await this.readDataFile<WeeklyProjection>(this.PROJECTIONS_FILE);
    return allProjections.filter(proj => 
      proj.player_id === playerId && proj.season === season
    ).sort((a, b) => a.week - b.week);
  }

  /**
   * Get weekly projections for a specific week
   */
  async getWeekProjections(week: number, season: number = 2025): Promise<WeeklyProjection[]> {
    const allProjections = await this.readDataFile<WeeklyProjection>(this.PROJECTIONS_FILE);
    return allProjections.filter(proj => 
      proj.week === week && proj.season === season
    );
  }

  /**
   * Get season statistics for a player
   */
  async getPlayerSeasonStats(playerId: string, season: number = 2024): Promise<PlayerStats | null> {
    const allStats = await this.readDataFile<PlayerStats>(this.SEASON_STATS_FILE);
    return allStats.find(stats => 
      stats.player_id === playerId && stats.season === season
    ) || null;
  }

  /**
   * Get top performers by position
   */
  async getTopPerformers(
    position: string, 
    stat: string,
    limit: number = 20,
    season: number = 2024
  ): Promise<PlayerStats[]> {
    const allStats = await this.readDataFile<PlayerStats>(this.SEASON_STATS_FILE);
    
    return allStats
      .filter(stats => stats.position === position.toUpperCase() && stats.season === season)
      .sort((a, b) => {
        const aValue = a.season_totals[stat as keyof typeof a.season_totals] || 0;
        const bValue = b.season_totals[stat as keyof typeof b.season_totals] || 0;
        return bValue - aValue;
      })
      .slice(0, limit);
  }

  /**
   * Load sample data for development
   */
  async loadSampleData(): Promise<void> {
    console.log('📊 Loading sample game logs and projections...');

    // Sample game logs for key players
    const sampleGameLogs: GameLog[] = [
      {
        player_id: 'josh_allen',
        player_name: 'Josh Allen',
        position: 'QB',
        team: 'BUF',
        week: 1,
        season: 2024,
        opponent: 'NYJ',
        game_date: '2024-09-09',
        stats: {
          pass_att: 34,
          pass_cmp: 26,
          pass_yds: 297,
          pass_tds: 2,
          pass_int: 0,
          rush_att: 8,
          rush_yds: 54,
          rush_tds: 2,
          fantasy_points: 31.2,
          fantasy_points_ppr: 31.2
        }
      },
      {
        player_id: 'jamarr_chase',
        player_name: "Ja'Marr Chase",
        position: 'WR',
        team: 'CIN',
        week: 1,
        season: 2024,
        opponent: 'NE',
        game_date: '2024-09-08',
        stats: {
          targets: 12,
          receptions: 6,
          rec_yds: 62,
          rec_tds: 1,
          fantasy_points: 18.2,
          fantasy_points_ppr: 24.2
        }
      }
    ];

    // Sample projections for 2025
    const sampleProjections: WeeklyProjection[] = [
      {
        player_id: 'josh_allen',
        player_name: 'Josh Allen',
        position: 'QB',
        team: 'BUF',
        week: 1,
        season: 2025,
        projections: {
          pass_att: 32,
          pass_cmp: 24,
          pass_yds: 285,
          pass_tds: 2.1,
          pass_int: 0.8,
          rush_att: 7,
          rush_yds: 45,
          rush_tds: 0.6,
          fantasy_points: 26.8,
          fantasy_points_ppr: 26.8,
          confidence: 85
        }
      },
      {
        player_id: 'jamarr_chase',
        player_name: "Ja'Marr Chase",
        position: 'WR',
        team: 'CIN',
        week: 1,
        season: 2025,
        projections: {
          targets: 10,
          receptions: 6.5,
          rec_yds: 95,
          rec_tds: 0.7,
          fantasy_points: 16.5,
          fantasy_points_ppr: 23.0,
          confidence: 78
        }
      }
    ];

    // Sample season stats
    const sampleSeasonStats: PlayerStats[] = [
      {
        player_id: 'josh_allen',
        player_name: 'Josh Allen',
        position: 'QB',
        team: 'BUF',
        season: 2024,
        games_played: 17,
        season_totals: {
          pass_yds: 4306,
          pass_tds: 28,
          pass_int: 6,
          rush_yds: 523,
          rush_tds: 12,
          fantasy_points: 388.2,
          fantasy_points_ppr: 388.2
        },
        per_game_averages: {
          pass_yds: 253.3,
          pass_tds: 1.6,
          rush_yds: 30.8,
          rush_tds: 0.7,
          fantasy_points: 22.8,
          fantasy_points_ppr: 22.8
        }
      }
    ];

    await this.writeDataFile(this.GAME_LOGS_FILE, sampleGameLogs);
    await this.writeDataFile(this.PROJECTIONS_FILE, sampleProjections);
    await this.writeDataFile(this.SEASON_STATS_FILE, sampleSeasonStats);

    console.log('✅ Sample data loaded successfully');
  }

  /**
   * Get data summary for health checks
   */
  async getDataSummary(): Promise<{
    game_logs_count: number;
    projections_count: number;
    season_stats_count: number;
    last_updated: string;
  }> {
    const [gameLogs, projections, seasonStats] = await Promise.all([
      this.readDataFile<GameLog>(this.GAME_LOGS_FILE),
      this.readDataFile<WeeklyProjection>(this.PROJECTIONS_FILE),
      this.readDataFile<PlayerStats>(this.SEASON_STATS_FILE)
    ]);

    return {
      game_logs_count: gameLogs.length,
      projections_count: projections.length,
      season_stats_count: seasonStats.length,
      last_updated: new Date().toISOString()
    };
  }
}

export const logsProjectionsService = new LogsProjectionsService();