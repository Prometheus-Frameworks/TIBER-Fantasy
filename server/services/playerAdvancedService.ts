/**
 * Player Advanced Service
 * 
 * Provides access to WR advanced stats derived from NFLfastR play-by-play data.
 * Designed for use by chat/gateway components and API endpoints.
 */

import { db } from '../infra/db';
import { sql } from 'drizzle-orm';

export interface WRAdvancedProfile {
  playerId: string;
  playerName: string;
  team: string;
  gamesPlayed: number;
  
  // Volume
  targets: number;
  receptions: number;
  recYards: number;
  firstDowns: number;
  tds: number;
  airYards: number;
  yac: number;
  
  // Advanced Metrics
  targetShare: number;
  airYardsShare: number;
  yardsPerTarget: number;
  fdPerTarget: number;
  catchRate: number;
  yacPerRec: number;
  epaPerTarget: number;
  successRate: number;
  
  // Derived
  yprrEst: number;
  fdRrEst: number;
  
  // Identity
  sleeperId?: string;
  nflId?: string;
}

export interface WRWeeklyStats {
  week: number;
  team: string;
  targets: number;
  receptions: number;
  recYards: number;
  firstDowns: number;
  tds: number;
  airYards: number;
  yac: number;
  targetShare: number;
  airYardsShare: number;
  yardsPerTarget: number;
  fdPerTarget: number;
  catchRate: number;
  yacPerRec: number;
  epaPerTarget: number;
  successRate: number;
}

export interface MetricLeaderboardEntry {
  rank: number;
  playerId: string;
  playerName: string;
  team: string;
  value: number;
  gamesPlayed: number;
  targets: number;
}

const VALID_METRICS = [
  'targets', 'receptions', 'rec_yards', 'first_downs', 'tds',
  'target_share', 'air_yards_share', 'yards_per_target', 'fd_per_target',
  'catch_rate', 'yac_per_rec', 'epa_per_target', 'success_rate',
  'yprr_est', 'fd_rr_est'
] as const;

type ValidMetric = typeof VALID_METRICS[number];

export class PlayerAdvancedService {
  private static instance: PlayerAdvancedService;

  public static getInstance(): PlayerAdvancedService {
    if (!PlayerAdvancedService.instance) {
      PlayerAdvancedService.instance = new PlayerAdvancedService();
    }
    return PlayerAdvancedService.instance;
  }

  /**
   * Search players by name with optional position filter
   */
  async searchPlayers(
    query: string, 
    options: { position?: string; limit?: number } = {}
  ): Promise<Array<{
    playerId: string;
    fullName: string;
    position: string;
    team?: string;
    sleeperId?: string;
  }>> {
    const { position, limit = 10 } = options;
    
    const searchPattern = `%${query.toLowerCase()}%`;
    
    let queryBuilder = sql`
      SELECT 
        canonical_id as player_id,
        full_name,
        position,
        nfl_team as team,
        sleeper_id
      FROM player_identity_map
      WHERE LOWER(full_name) LIKE ${searchPattern}
    `;
    
    if (position) {
      queryBuilder = sql`
        SELECT 
          canonical_id as player_id,
          full_name,
          position,
          nfl_team as team,
          sleeper_id
        FROM player_identity_map
        WHERE LOWER(full_name) LIKE ${searchPattern}
          AND position = ${position.toUpperCase()}
      `;
    }
    
    const result = await db.execute(sql`
      ${queryBuilder}
      ORDER BY 
        CASE WHEN LOWER(full_name) = ${query.toLowerCase()} THEN 0 ELSE 1 END,
        full_name
      LIMIT ${limit}
    `);
    
    return (result.rows as any[]).map(row => ({
      playerId: row.player_id,
      fullName: row.full_name,
      position: row.position,
      team: row.team || undefined,
      sleeperId: row.sleeper_id || undefined,
    }));
  }

  /**
   * Get season-level advanced stats for a WR
   */
  async getWRSeasonStats(playerId: string, season: number = 2025): Promise<WRAdvancedProfile | null> {
    if (season !== 2025) {
      console.warn(`[PlayerAdvancedService] Only 2025 season supported currently`);
      return null;
    }
    
    const result = await db.execute(sql`
      SELECT 
        canonical_id,
        identity_name as player_name,
        nfl_id,
        team,
        games_played,
        targets,
        receptions,
        rec_yards,
        first_downs,
        tds,
        air_yards,
        yac,
        target_share,
        air_yards_share,
        yards_per_target,
        fd_per_target,
        catch_rate,
        yac_per_rec,
        epa_per_target,
        success_rate,
        yprr_est,
        fd_rr_est,
        sleeper_id
      FROM wr_advanced_stats_2025
      WHERE canonical_id = ${playerId}
      LIMIT 1
    `);
    
    if (!result.rows.length) {
      return null;
    }
    
    const row = result.rows[0] as any;
    
    return {
      playerId: row.canonical_id,
      playerName: row.player_name,
      team: row.team,
      gamesPlayed: row.games_played,
      targets: row.targets,
      receptions: row.receptions,
      recYards: row.rec_yards,
      firstDowns: row.first_downs,
      tds: row.tds,
      airYards: row.air_yards,
      yac: row.yac,
      targetShare: parseFloat(row.target_share) || 0,
      airYardsShare: parseFloat(row.air_yards_share) || 0,
      yardsPerTarget: parseFloat(row.yards_per_target) || 0,
      fdPerTarget: parseFloat(row.fd_per_target) || 0,
      catchRate: parseFloat(row.catch_rate) || 0,
      yacPerRec: parseFloat(row.yac_per_rec) || 0,
      epaPerTarget: parseFloat(row.epa_per_target) || 0,
      successRate: parseFloat(row.success_rate) || 0,
      yprrEst: parseFloat(row.yprr_est) || 0,
      fdRrEst: parseFloat(row.fd_rr_est) || 0,
      sleeperId: row.sleeper_id || undefined,
      nflId: row.nfl_id || undefined,
    };
  }

  /**
   * Get weekly stats for a WR
   */
  async getWRWeeklyStats(playerId: string, season: number = 2025): Promise<WRWeeklyStats[]> {
    if (season !== 2025) {
      return [];
    }
    
    const result = await db.execute(sql`
      SELECT 
        week,
        team,
        targets,
        receptions,
        rec_yards,
        first_downs,
        tds,
        air_yards,
        yac,
        target_share,
        air_yards_share,
        yards_per_target,
        fd_per_target,
        catch_rate,
        yac_per_rec,
        epa_per_target,
        success_rate
      FROM wr_advanced_weekly_2025
      WHERE canonical_id = ${playerId}
      ORDER BY week
    `);
    
    return (result.rows as any[]).map(row => ({
      week: row.week,
      team: row.team,
      targets: row.targets,
      receptions: row.receptions,
      recYards: row.rec_yards,
      firstDowns: row.first_downs,
      tds: row.tds,
      airYards: row.air_yards,
      yac: row.yac,
      targetShare: parseFloat(row.target_share) || 0,
      airYardsShare: parseFloat(row.air_yards_share) || 0,
      yardsPerTarget: parseFloat(row.yards_per_target) || 0,
      fdPerTarget: parseFloat(row.fd_per_target) || 0,
      catchRate: parseFloat(row.catch_rate) || 0,
      yacPerRec: parseFloat(row.yac_per_rec) || 0,
      epaPerTarget: parseFloat(row.epa_per_target) || 0,
      successRate: parseFloat(row.success_rate) || 0,
    }));
  }

  /**
   * Get WR metric leaderboard
   */
  async getWRMetricLeaderboard(
    metric: string,
    options: { season?: number; minTargets?: number; limit?: number } = {}
  ): Promise<MetricLeaderboardEntry[]> {
    const { season = 2025, minTargets = 20, limit = 25 } = options;
    
    if (season !== 2025) {
      return [];
    }
    
    const normalizedMetric = metric.toLowerCase().replace(/-/g, '_');
    if (!VALID_METRICS.includes(normalizedMetric as ValidMetric)) {
      throw new Error(`Invalid metric: ${metric}. Valid metrics: ${VALID_METRICS.join(', ')}`);
    }
    
    const result = await db.execute(sql.raw(`
      SELECT 
        canonical_id as player_id,
        identity_name as player_name,
        team,
        ${normalizedMetric} as value,
        games_played,
        targets
      FROM wr_advanced_stats_2025
      WHERE canonical_id IS NOT NULL
        AND targets >= ${minTargets}
      ORDER BY ${normalizedMetric} DESC NULLS LAST
      LIMIT ${limit}
    `));
    
    return (result.rows as any[]).map((row, idx) => ({
      rank: idx + 1,
      playerId: row.player_id,
      playerName: row.player_name,
      team: row.team,
      value: parseFloat(row.value) || 0,
      gamesPlayed: row.games_played,
      targets: row.targets,
    }));
  }

  /**
   * Find WRs matching a formula profile using WR Core Alpha scoring
   */
  async findMatchingWRs(
    inputs: { TS?: number; YPRR?: number; FD_RR?: number; YAC?: number; CC?: number },
    options: { season?: number; minTargets?: number; limit?: number } = {}
  ): Promise<Array<{
    rank: number;
    playerId: string;
    playerName: string;
    team: string;
    wrAlpha: number;
    chain: number;
    explosive: number;
    winSkill: number;
    similarity: number;
    rawInputs: Record<string, number>;
  }>> {
    const { season = 2025, minTargets = 30, limit = 10 } = options;
    
    if (season !== 2025) {
      return [];
    }
    
    const result = await db.execute(sql`
      SELECT 
        canonical_id as player_id,
        identity_name as player_name,
        team,
        target_share,
        yprr_est,
        fd_rr_est,
        yac_per_rec,
        catch_rate,
        targets,
        games_played
      FROM wr_advanced_stats_2025
      WHERE canonical_id IS NOT NULL
        AND targets >= ${minTargets}
    `);
    
    const userInputs = {
      TS: inputs.TS ?? 0.20,
      YPRR: inputs.YPRR ?? 2.0,
      FD_RR: inputs.FD_RR ?? 0.08,
      YAC: inputs.YAC ?? 4.0,
      CC: inputs.CC ?? 0.65,
    };
    
    const calculateSubscores = (ts: number, yprr: number, fdRr: number, yac: number, cc: number) => {
      const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
      
      const tsNorm = clamp((ts - 0.08) / (0.35 - 0.08), 0, 1);
      const fdRrNorm = clamp((fdRr - 0.03) / (0.15 - 0.03), 0, 1);
      const chain = 0.55 * fdRrNorm + 0.45 * tsNorm;
      
      const yprrNorm = clamp((yprr - 1.0) / (3.5 - 1.0), 0, 1);
      const yacNorm = clamp((yac - 2.0) / (7.0 - 2.0), 0, 1);
      const explosive = 0.60 * yprrNorm + 0.40 * yacNorm;
      
      const winSkill = cc;
      
      const wrAlpha = (chain * 0.40 + explosive * 0.35 + winSkill * 0.25) * 100;
      
      return { chain, explosive, winSkill, wrAlpha };
    };
    
    const userScores = calculateSubscores(userInputs.TS, userInputs.YPRR, userInputs.FD_RR, userInputs.YAC, userInputs.CC);
    
    const players = (result.rows as any[]).map(row => {
      const ts = parseFloat(row.target_share) || 0;
      const yprr = parseFloat(row.yprr_est) || 0;
      const fdRr = parseFloat(row.fd_rr_est) || 0;
      const yac = parseFloat(row.yac_per_rec) || 0;
      const cc = parseFloat(row.catch_rate) || 0;
      
      const scores = calculateSubscores(ts, yprr, fdRr, yac, cc);
      
      const diffs = [
        (scores.chain - userScores.chain) * 2,
        (scores.explosive - userScores.explosive) * 2,
        (scores.winSkill - userScores.winSkill) * 1,
      ];
      const distance = Math.sqrt(diffs.reduce((sum, d) => sum + d * d, 0));
      const similarity = Math.max(0, 1 - distance / 2);
      
      return {
        playerId: row.player_id,
        playerName: row.player_name,
        team: row.team,
        wrAlpha: Math.round(scores.wrAlpha * 100) / 100,
        chain: Math.round(scores.chain * 10000) / 10000,
        explosive: Math.round(scores.explosive * 10000) / 10000,
        winSkill: Math.round(scores.winSkill * 10000) / 10000,
        similarity: Math.round(similarity * 10000) / 10000,
        rawInputs: { TS: ts, YPRR: yprr, FD_RR: fdRr, YAC: yac, CC: cc },
      };
    });
    
    players.sort((a, b) => b.similarity - a.similarity);
    
    return players.slice(0, limit).map((p, idx) => ({
      rank: idx + 1,
      ...p,
    }));
  }

  /**
   * Refresh the materialized views (for weekly updates)
   */
  async refreshViews(): Promise<void> {
    await db.execute(sql`REFRESH MATERIALIZED VIEW wr_advanced_stats_2025`);
    await db.execute(sql`REFRESH MATERIALIZED VIEW wr_advanced_weekly_2025`);
    console.log('[PlayerAdvancedService] Refreshed WR advanced stats views');
  }
}
