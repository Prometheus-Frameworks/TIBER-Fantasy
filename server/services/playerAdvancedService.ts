/**
 * Player Advanced Service
 * 
 * Provides access to WR and RB advanced stats derived from NFLfastR play-by-play data.
 * Designed for use by chat/gateway components and API endpoints.
 */

import { db } from '../infra/db';
import { sql } from 'drizzle-orm';

export interface RBAdvancedProfile {
  playerId: string;
  playerName: string;
  team: string;
  gamesPlayed: number;
  
  // Volume / Role
  carries: number;
  targets: number;
  receptions: number;
  carryShare: number;
  targetShare: number;
  carriesPerGame: number;
  targetsPerGame: number;
  
  // Rushing Efficiency
  rushYards: number;
  yardsPerCarry: number;
  explosiveRushRate: number;
  rushSuccessRate: number;
  rushEpaPerAtt: number;
  rushFdRate: number;
  
  // Receiving
  recYards: number;
  yardsPerTarget: number;
  catchRate: number;
  yacPerRec: number;
  recEpaPerTarget: number;
  recSuccessRate: number;
  
  // Scoring & High-Value Usage
  totalTds: number;
  rushTds: number;
  recTds: number;
  goalLineCarries: number;
  redzoneCarries: number;
  redzoneTargets: number;
  
  // Totals
  totalYards: number;
  totalOpportunities: number;
  yardsPerGame: number;
  
  // Identity
  sleeperId?: string;
}

export interface RBWeeklyStats {
  week: number;
  team: string;
  carries: number;
  rushYards: number;
  yardsPerCarry: number;
  explosiveRushRate: number;
  rushSuccessRate: number;
  rushEpaPerAtt: number;
  rushTds: number;
  goalLineCarries: number;
  redzoneCarries: number;
  targets: number;
  receptions: number;
  recYards: number;
  yardsPerTarget: number;
  catchRate: number;
  recTds: number;
  totalTds: number;
  totalYards: number;
  totalOpportunities: number;
}

export interface RBMetricLeaderboardEntry {
  rank: number;
  playerId: string;
  playerName: string;
  team: string;
  value: number;
  gamesPlayed: number;
  carries: number;
  totalYards: number;
}

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

const VALID_WR_METRICS = [
  'targets', 'receptions', 'rec_yards', 'first_downs', 'tds',
  'target_share', 'air_yards_share', 'yards_per_target', 'fd_per_target',
  'catch_rate', 'yac_per_rec', 'epa_per_target', 'success_rate',
  'yprr_est', 'fd_rr_est'
] as const;

const VALID_RB_METRICS = [
  'carries', 'rush_yards', 'yards_per_carry', 'explosive_rush_rate',
  'rush_success_rate', 'rush_epa_per_att', 'rush_fd_rate',
  'carry_share', 'target_share', 'targets', 'receptions', 'rec_yards',
  'yards_per_target', 'catch_rate', 'yac_per_rec', 'rec_epa_per_target',
  'total_tds', 'rush_tds', 'rec_tds', 'goal_line_carries', 'redzone_carries',
  'total_yards', 'total_opportunities', 'carries_per_game', 'targets_per_game', 'yards_per_game'
] as const;

type ValidWRMetric = typeof VALID_WR_METRICS[number];
type ValidRBMetric = typeof VALID_RB_METRICS[number];

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
    if (!VALID_WR_METRICS.includes(normalizedMetric as ValidWRMetric)) {
      throw new Error(`Invalid metric: ${metric}. Valid metrics: ${VALID_WR_METRICS.join(', ')}`);
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

  // ============================================
  // RB Advanced Stats Methods
  // ============================================

  /**
   * Get season-level advanced stats for an RB
   */
  async getRBSeasonStats(playerId: string, season: number = 2025): Promise<RBAdvancedProfile | null> {
    if (season !== 2025) {
      console.warn(`[PlayerAdvancedService] Only 2025 season supported currently`);
      return null;
    }
    
    const result = await db.execute(sql`
      SELECT 
        canonical_id,
        full_name,
        team,
        sleeper_id,
        games_played,
        carries,
        targets,
        receptions,
        carry_share,
        target_share,
        carries_per_game,
        targets_per_game,
        rush_yards,
        yards_per_carry,
        explosive_rush_rate,
        rush_success_rate,
        rush_epa_per_att,
        rush_fd_rate,
        rec_yards,
        yards_per_target,
        catch_rate,
        yac_per_rec,
        rec_epa_per_target,
        rec_success_rate,
        total_tds,
        rush_tds,
        rec_tds,
        goal_line_carries,
        redzone_carries,
        redzone_targets,
        total_yards,
        total_opportunities,
        yards_per_game
      FROM rb_advanced_stats_2025
      WHERE canonical_id = ${playerId}
      LIMIT 1
    `);
    
    if (!result.rows.length) {
      return null;
    }
    
    const row = result.rows[0] as any;
    
    return {
      playerId: row.canonical_id,
      playerName: row.full_name,
      team: row.team,
      gamesPlayed: row.games_played,
      carries: row.carries,
      targets: row.targets,
      receptions: row.receptions,
      carryShare: parseFloat(row.carry_share) || 0,
      targetShare: parseFloat(row.target_share) || 0,
      carriesPerGame: parseFloat(row.carries_per_game) || 0,
      targetsPerGame: parseFloat(row.targets_per_game) || 0,
      rushYards: row.rush_yards,
      yardsPerCarry: parseFloat(row.yards_per_carry) || 0,
      explosiveRushRate: parseFloat(row.explosive_rush_rate) || 0,
      rushSuccessRate: parseFloat(row.rush_success_rate) || 0,
      rushEpaPerAtt: parseFloat(row.rush_epa_per_att) || 0,
      rushFdRate: parseFloat(row.rush_fd_rate) || 0,
      recYards: row.rec_yards,
      yardsPerTarget: parseFloat(row.yards_per_target) || 0,
      catchRate: parseFloat(row.catch_rate) || 0,
      yacPerRec: parseFloat(row.yac_per_rec) || 0,
      recEpaPerTarget: parseFloat(row.rec_epa_per_target) || 0,
      recSuccessRate: parseFloat(row.rec_success_rate) || 0,
      totalTds: row.total_tds,
      rushTds: row.rush_tds,
      recTds: row.rec_tds,
      goalLineCarries: row.goal_line_carries,
      redzoneCarries: row.redzone_carries,
      redzoneTargets: row.redzone_targets,
      totalYards: row.total_yards,
      totalOpportunities: row.total_opportunities,
      yardsPerGame: parseFloat(row.yards_per_game) || 0,
      sleeperId: row.sleeper_id || undefined,
    };
  }

  /**
   * Get weekly stats for an RB
   */
  async getRBWeeklyStats(playerId: string, season: number = 2025): Promise<RBWeeklyStats[]> {
    if (season !== 2025) {
      return [];
    }
    
    const result = await db.execute(sql`
      SELECT 
        week,
        team,
        carries,
        rush_yards,
        yards_per_carry,
        explosive_rush_rate,
        rush_success_rate,
        rush_epa_per_att,
        rush_tds,
        goal_line_carries,
        redzone_carries,
        targets,
        receptions,
        rec_yards,
        yards_per_target,
        catch_rate,
        rec_tds,
        total_tds,
        total_yards,
        total_opportunities
      FROM rb_weekly_stats_2025
      WHERE canonical_id = ${playerId}
      ORDER BY week
    `);
    
    return (result.rows as any[]).map(row => ({
      week: row.week,
      team: row.team,
      carries: row.carries,
      rushYards: row.rush_yards,
      yardsPerCarry: parseFloat(row.yards_per_carry) || 0,
      explosiveRushRate: parseFloat(row.explosive_rush_rate) || 0,
      rushSuccessRate: parseFloat(row.rush_success_rate) || 0,
      rushEpaPerAtt: parseFloat(row.rush_epa_per_att) || 0,
      rushTds: row.rush_tds,
      goalLineCarries: row.goal_line_carries,
      redzoneCarries: row.redzone_carries,
      targets: row.targets,
      receptions: row.receptions,
      recYards: row.rec_yards,
      yardsPerTarget: parseFloat(row.yards_per_target) || 0,
      catchRate: parseFloat(row.catch_rate) || 0,
      recTds: row.rec_tds,
      totalTds: row.total_tds,
      totalYards: row.total_yards,
      totalOpportunities: row.total_opportunities,
    }));
  }

  /**
   * Get RB metric leaderboard
   */
  async getRBMetricLeaderboard(
    metric: string,
    options: { season?: number; minCarries?: number; limit?: number } = {}
  ): Promise<RBMetricLeaderboardEntry[]> {
    const { season = 2025, minCarries = 50, limit = 25 } = options;
    
    if (season !== 2025) {
      return [];
    }
    
    const normalizedMetric = metric.toLowerCase().replace(/-/g, '_');
    if (!VALID_RB_METRICS.includes(normalizedMetric as ValidRBMetric)) {
      throw new Error(`Invalid metric: ${metric}. Valid metrics: ${VALID_RB_METRICS.join(', ')}`);
    }
    
    const result = await db.execute(sql.raw(`
      SELECT 
        canonical_id as player_id,
        full_name as player_name,
        team,
        ${normalizedMetric} as value,
        games_played,
        carries,
        total_yards
      FROM rb_advanced_stats_2025
      WHERE canonical_id IS NOT NULL
        AND carries >= ${minCarries}
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
      carries: row.carries,
      totalYards: row.total_yards,
    }));
  }

  /**
   * Find RBs matching a formula profile using RB Core Alpha scoring
   * 
   * Dimensions:
   * - Volume (carry share, snap share, opportunities)
   * - Efficiency (YPC, success rate, EPA)
   * - Receiving (targets, YPRR, catch rate)
   * - Explosive (explosive rush rate, YAC/att)
   * - Scoring (goal line, redzone usage)
   */
  async findMatchingRBs(
    weights: {
      volume?: number;      // Weight for volume dimension (default 0.25)
      efficiency?: number;  // Weight for efficiency dimension (default 0.30)
      receiving?: number;   // Weight for receiving dimension (default 0.15)
      explosive?: number;   // Weight for explosive dimension (default 0.15)
      scoring?: number;     // Weight for scoring dimension (default 0.15)
    },
    targetProfile: {
      carryShare?: number;
      rushSuccessRate?: number;
      explosiveRushRate?: number;
      yardsPerCarry?: number;
      targetsPerGame?: number;
      catchRate?: number;
      goalLineCarriesPerGame?: number;
    },
    options: { season?: number; minCarries?: number; minOpportunities?: number; limit?: number } = {}
  ): Promise<Array<{
    rank: number;
    playerId: string;
    playerName: string;
    team: string;
    rbAlpha: number;
    volumeScore: number;
    efficiencyScore: number;
    receivingScore: number;
    explosiveScore: number;
    scoringScore: number;
    similarity: number;
    coreStats: {
      carryShare: number;
      rushSuccessRate: number;
      explosiveRushRate: number;
      yardsPerCarry: number;
      targetsPerGame: number;
      catchRate: number;
      goalLineCarriesPerGame: number;
    };
  }>> {
    const { season = 2025, minCarries = 50, limit = 10 } = options;
    
    if (season !== 2025) {
      return [];
    }
    
    const result = await db.execute(sql`
      SELECT 
        canonical_id as player_id,
        full_name as player_name,
        team,
        games_played,
        carries,
        carry_share,
        target_share,
        rush_success_rate,
        explosive_rush_rate,
        yards_per_carry,
        rush_epa_per_att,
        targets_per_game,
        catch_rate,
        yac_per_rec,
        goal_line_carries,
        redzone_carries,
        total_yards
      FROM rb_advanced_stats_2025
      WHERE canonical_id IS NOT NULL
        AND carries >= ${minCarries}
    `);
    
    const w = {
      volume: weights.volume ?? 0.25,
      efficiency: weights.efficiency ?? 0.30,
      receiving: weights.receiving ?? 0.15,
      explosive: weights.explosive ?? 0.15,
      scoring: weights.scoring ?? 0.15,
    };
    
    const target = {
      carryShare: targetProfile.carryShare ?? 0.50,
      rushSuccessRate: targetProfile.rushSuccessRate ?? 0.45,
      explosiveRushRate: targetProfile.explosiveRushRate ?? 0.12,
      yardsPerCarry: targetProfile.yardsPerCarry ?? 4.5,
      targetsPerGame: targetProfile.targetsPerGame ?? 3.0,
      catchRate: targetProfile.catchRate ?? 0.75,
      goalLineCarriesPerGame: targetProfile.goalLineCarriesPerGame ?? 0.5,
    };
    
    const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
    
    const calculateScores = (row: any) => {
      const gp = row.games_played || 1;
      
      const carryShare = parseFloat(row.carry_share) || 0;
      const rushSuccess = parseFloat(row.rush_success_rate) || 0;
      const explosiveRate = parseFloat(row.explosive_rush_rate) || 0;
      const ypc = parseFloat(row.yards_per_carry) || 0;
      const rushEpa = parseFloat(row.rush_epa_per_att) || 0;
      const tpg = parseFloat(row.targets_per_game) || 0;
      const catchRate = parseFloat(row.catch_rate) || 0;
      const yacPerRec = parseFloat(row.yac_per_rec) || 0;
      const goalLine = row.goal_line_carries / gp;
      const redzone = row.redzone_carries / gp;
      
      const volumeScore = clamp(carryShare / 0.70, 0, 1);
      
      const successNorm = clamp((rushSuccess - 0.30) / (0.55 - 0.30), 0, 1);
      const ypcNorm = clamp((ypc - 3.0) / (6.0 - 3.0), 0, 1);
      const epaNorm = clamp((rushEpa + 0.15) / (0.25 + 0.15), 0, 1);
      const efficiencyScore = 0.40 * successNorm + 0.35 * ypcNorm + 0.25 * epaNorm;
      
      const tpgNorm = clamp(tpg / 6.0, 0, 1);
      const catchNorm = clamp(catchRate, 0, 1);
      const receivingScore = 0.60 * tpgNorm + 0.40 * catchNorm;
      
      const explosiveNorm = clamp((explosiveRate - 0.05) / (0.20 - 0.05), 0, 1);
      const yacNorm = clamp((yacPerRec - 3.0) / (8.0 - 3.0), 0, 1);
      const explosiveScore = 0.70 * explosiveNorm + 0.30 * yacNorm;
      
      const goalLineNorm = clamp(goalLine / 1.5, 0, 1);
      const redzoneNorm = clamp(redzone / 5.0, 0, 1);
      const scoringScore = 0.60 * goalLineNorm + 0.40 * redzoneNorm;
      
      const rbAlpha = (
        w.volume * volumeScore +
        w.efficiency * efficiencyScore +
        w.receiving * receivingScore +
        w.explosive * explosiveScore +
        w.scoring * scoringScore
      ) * 100;
      
      return {
        volumeScore,
        efficiencyScore,
        receivingScore,
        explosiveScore,
        scoringScore,
        rbAlpha,
        coreStats: {
          carryShare,
          rushSuccessRate: rushSuccess,
          explosiveRushRate: explosiveRate,
          yardsPerCarry: ypc,
          targetsPerGame: tpg,
          catchRate,
          goalLineCarriesPerGame: goalLine,
        },
      };
    };
    
    const calcSimilarity = (stats: { carryShare: number; rushSuccessRate: number; explosiveRushRate: number; yardsPerCarry: number; targetsPerGame: number; catchRate: number; goalLineCarriesPerGame: number }) => {
      const diffs = [
        (stats.carryShare - target.carryShare) / 0.30,
        (stats.rushSuccessRate - target.rushSuccessRate) / 0.15,
        (stats.explosiveRushRate - target.explosiveRushRate) / 0.10,
        (stats.yardsPerCarry - target.yardsPerCarry) / 2.0,
        (stats.targetsPerGame - target.targetsPerGame) / 3.0,
        (stats.catchRate - target.catchRate) / 0.30,
        (stats.goalLineCarriesPerGame - target.goalLineCarriesPerGame) / 1.0,
      ];
      const distance = Math.sqrt(diffs.reduce((sum, d) => sum + d * d, 0) / diffs.length);
      return Math.max(0, Math.round((1 - distance) * 10000) / 10000);
    };
    
    const players = (result.rows as any[]).map(row => {
      const scores = calculateScores(row);
      const similarity = calcSimilarity(scores.coreStats);
      
      return {
        playerId: row.player_id,
        playerName: row.player_name,
        team: row.team,
        rbAlpha: Math.round(scores.rbAlpha * 100) / 100,
        volumeScore: Math.round(scores.volumeScore * 10000) / 10000,
        efficiencyScore: Math.round(scores.efficiencyScore * 10000) / 10000,
        receivingScore: Math.round(scores.receivingScore * 10000) / 10000,
        explosiveScore: Math.round(scores.explosiveScore * 10000) / 10000,
        scoringScore: Math.round(scores.scoringScore * 10000) / 10000,
        similarity,
        coreStats: {
          carryShare: Math.round(scores.coreStats.carryShare * 1000) / 1000,
          rushSuccessRate: Math.round(scores.coreStats.rushSuccessRate * 1000) / 1000,
          explosiveRushRate: Math.round(scores.coreStats.explosiveRushRate * 1000) / 1000,
          yardsPerCarry: Math.round(scores.coreStats.yardsPerCarry * 100) / 100,
          targetsPerGame: Math.round(scores.coreStats.targetsPerGame * 100) / 100,
          catchRate: Math.round(scores.coreStats.catchRate * 1000) / 1000,
          goalLineCarriesPerGame: Math.round(scores.coreStats.goalLineCarriesPerGame * 100) / 100,
        },
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
    await db.execute(sql`REFRESH MATERIALIZED VIEW rb_advanced_stats_2025`);
    await db.execute(sql`REFRESH MATERIALIZED VIEW rb_weekly_stats_2025`);
    console.log('[PlayerAdvancedService] Refreshed WR and RB advanced stats views');
  }
}
