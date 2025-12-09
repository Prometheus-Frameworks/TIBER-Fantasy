/**
 * FORGE Engine (E) - Data fetching, metric normalization, and pillar score computation
 * 
 * Handles:
 * - Fetching context from DB (snapshots, role banks, SoS, etc.)
 * - Building metric lookup function
 * - Computing 4 pillars: volume, efficiency, teamContext, stability (0-100)
 */

import { db } from '../../infra/db';
import { sql } from 'drizzle-orm';

export type Position = 'QB' | 'RB' | 'WR' | 'TE';

export type MetricSource =
  | 'snapshot_player_week'
  | 'snapshot_team_context'
  | 'sos_table'
  | 'role_bank'
  | 'qb_alpha'
  | 'recursion';

export type PillarMetricConfig = {
  metricKey: string;
  source: MetricSource;
  weight: number;
  invert?: boolean;
  cap?: { min?: number; max?: number };
};

export type PillarConfig = {
  metrics: PillarMetricConfig[];
};

export type PositionPillarConfig = {
  volume: PillarConfig;
  efficiency: PillarConfig;
  teamContext: PillarConfig;
  stability: PillarConfig;
};

export type ForgePillarScores = {
  volume: number;
  efficiency: number;
  teamContext: number;
  stability: number;
};

export type ForgeEngineOutput = {
  playerId: string;
  playerName: string;
  position: Position;
  nflTeam?: string;
  season: number;
  week: number | 'season';
  gamesPlayed: number;
  pillars: ForgePillarScores;
  priorAlpha?: number;
  alphaMomentum?: number;
  rawMetrics: Record<string, number | null>;
};

export type MetricLookupFn = (
  metricKey: string,
  source: MetricSource
) => number | null;

export type ForgeContext = {
  playerId: string;
  playerName: string;
  position: Position;
  nflTeam?: string;
  season: number;
  week: number | 'season';
  gamesPlayed: number;
  roleBank: Record<string, number | null>;
  teamContext: Record<string, number | null>;
  sosData: Record<string, number | null>;
  recursion: {
    priorAlpha?: number;
    alphaMomentum?: number;
  };
};

const WR_PILLARS: PositionPillarConfig = {
  volume: {
    metrics: [
      { metricKey: 'volume_score', source: 'role_bank', weight: 0.35 },
      { metricKey: 'targets_per_game', source: 'role_bank', weight: 0.25 },
      { metricKey: 'target_share_avg', source: 'role_bank', weight: 0.20 },
      { metricKey: 'routes_per_game', source: 'role_bank', weight: 0.10 },
      { metricKey: 'deep_targets_per_game', source: 'role_bank', weight: 0.10 },
    ],
  },
  efficiency: {
    metrics: [
      { metricKey: 'efficiency_score', source: 'role_bank', weight: 0.30 },
      { metricKey: 'efficiency_index', source: 'role_bank', weight: 0.25 },
      { metricKey: 'ppr_per_target', source: 'role_bank', weight: 0.25 },
      { metricKey: 'deep_target_rate', source: 'role_bank', weight: 0.20 },
    ],
  },
  teamContext: {
    metrics: [
      { metricKey: 'team_pass_volume', source: 'snapshot_team_context', weight: 0.40 },
      { metricKey: 'team_pace', source: 'snapshot_team_context', weight: 0.30 },
      { metricKey: 'pass_defense_sos', source: 'sos_table', weight: 0.30 },
    ],
  },
  stability: {
    metrics: [
      { metricKey: 'consistency_score', source: 'role_bank', weight: 0.35 },
      { metricKey: 'stability_index', source: 'role_bank', weight: 0.25 },
      { metricKey: 'target_std_dev', source: 'role_bank', weight: 0.20, invert: true },
      { metricKey: 'fantasy_std_dev', source: 'role_bank', weight: 0.20, invert: true },
    ],
  },
};

const RB_PILLARS: PositionPillarConfig = {
  volume: {
    metrics: [
      { metricKey: 'volume_score', source: 'role_bank', weight: 0.30 },
      { metricKey: 'opportunities_per_game', source: 'role_bank', weight: 0.25 },
      { metricKey: 'carries_per_game', source: 'role_bank', weight: 0.20 },
      { metricKey: 'targets_per_game', source: 'role_bank', weight: 0.15 },
      { metricKey: 'red_zone_touches_per_game', source: 'role_bank', weight: 0.10 },
    ],
  },
  efficiency: {
    metrics: [
      { metricKey: 'high_value_usage_score', source: 'role_bank', weight: 0.40 },
      { metricKey: 'ppr_per_opportunity', source: 'role_bank', weight: 0.35 },
      { metricKey: 'red_zone_touches_per_game', source: 'role_bank', weight: 0.25 },
    ],
  },
  teamContext: {
    metrics: [
      { metricKey: 'team_run_volume', source: 'snapshot_team_context', weight: 0.40 },
      { metricKey: 'team_red_zone_drives', source: 'snapshot_team_context', weight: 0.30 },
      { metricKey: 'run_defense_sos', source: 'sos_table', weight: 0.30 },
    ],
  },
  stability: {
    metrics: [
      { metricKey: 'consistency_score', source: 'role_bank', weight: 0.40 },
      { metricKey: 'opp_std_dev', source: 'role_bank', weight: 0.30, invert: true },
      { metricKey: 'fantasy_std_dev', source: 'role_bank', weight: 0.30, invert: true },
    ],
  },
};

const TE_PILLARS: PositionPillarConfig = {
  volume: {
    metrics: [
      { metricKey: 'volume_score', source: 'role_bank', weight: 0.35 },
      { metricKey: 'targets_per_game', source: 'role_bank', weight: 0.25 },
      { metricKey: 'target_share_avg', source: 'role_bank', weight: 0.20 },
      { metricKey: 'routes_per_game', source: 'role_bank', weight: 0.10 },
      { metricKey: 'red_zone_targets_per_game', source: 'role_bank', weight: 0.10 },
    ],
  },
  efficiency: {
    metrics: [
      { metricKey: 'high_value_usage_score', source: 'role_bank', weight: 0.40 },
      { metricKey: 'ppr_per_target', source: 'role_bank', weight: 0.35 },
      { metricKey: 'red_zone_targets_per_game', source: 'role_bank', weight: 0.25 },
    ],
  },
  teamContext: {
    metrics: [
      { metricKey: 'team_pass_volume', source: 'snapshot_team_context', weight: 0.40 },
      { metricKey: 'team_red_zone_drives', source: 'snapshot_team_context', weight: 0.30 },
      { metricKey: 'te_defense_sos', source: 'sos_table', weight: 0.30 },
    ],
  },
  stability: {
    metrics: [
      { metricKey: 'consistency_score', source: 'role_bank', weight: 0.40 },
      { metricKey: 'target_std_dev', source: 'role_bank', weight: 0.30, invert: true },
      { metricKey: 'fantasy_std_dev', source: 'role_bank', weight: 0.30, invert: true },
    ],
  },
};

const QB_PILLARS: PositionPillarConfig = {
  volume: {
    metrics: [
      { metricKey: 'volume_score', source: 'role_bank', weight: 0.35 },
      { metricKey: 'dropbacks_per_game', source: 'role_bank', weight: 0.25 },
      { metricKey: 'passing_attempts', source: 'role_bank', weight: 0.20 },
      { metricKey: 'rush_attempts_per_game', source: 'role_bank', weight: 0.10 },
      { metricKey: 'red_zone_dropbacks_per_game', source: 'role_bank', weight: 0.10 },
    ],
  },
  efficiency: {
    metrics: [
      { metricKey: 'efficiency_score', source: 'role_bank', weight: 0.30 },
      { metricKey: 'epa_per_play', source: 'role_bank', weight: 0.25 },
      { metricKey: 'cpoe', source: 'role_bank', weight: 0.20 },
      { metricKey: 'yards_per_attempt', source: 'role_bank', weight: 0.15 },
      { metricKey: 'sack_rate', source: 'role_bank', weight: 0.10, invert: true },
    ],
  },
  teamContext: {
    metrics: [
      { metricKey: 'alpha_context_score', source: 'role_bank', weight: 0.50 },
      { metricKey: 'pass_defense_sos', source: 'sos_table', weight: 0.50 },
    ],
  },
  stability: {
    metrics: [
      { metricKey: 'momentum_score', source: 'role_bank', weight: 0.50 },
      { metricKey: 'completion_percentage', source: 'role_bank', weight: 0.30 },
      { metricKey: 'sack_rate', source: 'role_bank', weight: 0.20, invert: true },
    ],
  },
};

export function getPositionPillarConfig(position: Position): PositionPillarConfig {
  switch (position) {
    case 'WR':
      return WR_PILLARS;
    case 'RB':
      return RB_PILLARS;
    case 'TE':
      return TE_PILLARS;
    case 'QB':
      return QB_PILLARS;
  }
}

export function computePillarScore(
  pillarConfig: PillarConfig,
  lookup: MetricLookupFn
): number {
  let total = 0;
  let weightSum = 0;

  for (const metric of pillarConfig.metrics) {
    let value = lookup(metric.metricKey, metric.source);
    if (value == null) continue;

    if (metric.invert) {
      value = 100 - value;
    }

    if (metric.cap) {
      if (metric.cap.min !== undefined) value = Math.max(metric.cap.min, value);
      if (metric.cap.max !== undefined) value = Math.min(metric.cap.max, value);
    }

    total += value * metric.weight;
    weightSum += metric.weight;
  }

  if (weightSum === 0) {
    return 50;
  }

  return Math.max(0, Math.min(100, total / weightSum));
}

function normalizeMetric(value: number | null, metricKey: string): number | null {
  if (value === null || value === undefined) return null;
  
  const normalizationRanges: Record<string, { min: number; max: number }> = {
    targets_per_game: { min: 0, max: 12 },
    target_share_avg: { min: 0, max: 0.35 },
    routes_per_game: { min: 0, max: 40 },
    deep_targets_per_game: { min: 0, max: 3 },
    ppr_per_target: { min: 0, max: 3 },
    deep_target_rate: { min: 0, max: 0.3 },
    target_std_dev: { min: 0, max: 5 },
    fantasy_std_dev: { min: 0, max: 10 },
    opportunities_per_game: { min: 0, max: 25 },
    carries_per_game: { min: 0, max: 20 },
    red_zone_touches_per_game: { min: 0, max: 5 },
    ppr_per_opportunity: { min: 0, max: 2 },
    opp_std_dev: { min: 0, max: 8 },
    red_zone_targets_per_game: { min: 0, max: 3 },
    dropbacks_per_game: { min: 0, max: 45 },
    passing_attempts: { min: 0, max: 45 },
    rush_attempts_per_game: { min: 0, max: 10 },
    red_zone_dropbacks_per_game: { min: 0, max: 8 },
    epa_per_play: { min: -0.3, max: 0.4 },
    cpoe: { min: -10, max: 10 },
    yards_per_attempt: { min: 4, max: 10 },
    sack_rate: { min: 0, max: 15 },
    completion_percentage: { min: 50, max: 75 },
  };

  const range = normalizationRanges[metricKey];
  if (!range) {
    return Math.max(0, Math.min(100, value));
  }

  const normalized = ((value - range.min) / (range.max - range.min)) * 100;
  return Math.max(0, Math.min(100, normalized));
}

export function createMetricLookup(context: ForgeContext): MetricLookupFn {
  return (metricKey: string, source: MetricSource): number | null => {
    let rawValue: number | null = null;

    switch (source) {
      case 'role_bank':
        rawValue = context.roleBank[metricKey] ?? null;
        break;
      case 'snapshot_team_context':
        rawValue = context.teamContext[metricKey] ?? null;
        break;
      case 'sos_table':
        rawValue = context.sosData[metricKey] ?? null;
        break;
      case 'recursion':
        if (metricKey === 'prior_alpha') rawValue = context.recursion.priorAlpha ?? null;
        if (metricKey === 'alpha_momentum') rawValue = context.recursion.alphaMomentum ?? null;
        break;
      default:
        rawValue = null;
    }

    if (rawValue === null) return null;

    const scoreMetrics = [
      'volume_score', 'consistency_score', 'high_value_usage_score', 
      'momentum_score', 'role_score', 'efficiency_score', 'alpha_score',
      'volume_index', 'production_index', 'efficiency_index', 'stability_index',
      'alpha_context_score', 'rushing_score'
    ];
    
    if (scoreMetrics.includes(metricKey)) {
      return Math.max(0, Math.min(100, rawValue));
    }

    return normalizeMetric(rawValue, metricKey);
  };
}

export function extractRecursionSignals(context: ForgeContext): {
  priorAlpha?: number;
  alphaMomentum?: number;
} {
  return {
    priorAlpha: context.recursion.priorAlpha,
    alphaMomentum: context.recursion.alphaMomentum,
  };
}

async function fetchRoleBankData(
  playerId: string,
  position: Position,
  season: number
): Promise<Record<string, number | null>> {
  const tableName = `${position.toLowerCase()}_role_bank`;
  
  try {
    const result = await db.execute(sql`
      SELECT * FROM ${sql.identifier(tableName)}
      WHERE player_id = ${playerId} AND season = ${season}
      LIMIT 1
    `);

    if (result.rows.length === 0) {
      console.log(`[ForgeEngine] No role bank data for ${playerId} in ${tableName}`);
      return {};
    }

    const row = result.rows[0] as Record<string, any>;
    const metrics: Record<string, number | null> = {};
    
    for (const [key, value] of Object.entries(row)) {
      if (typeof value === 'number') {
        metrics[key] = value;
      }
    }
    
    return metrics;
  } catch (error) {
    console.error(`[ForgeEngine] Error fetching role bank:`, error);
    return {};
  }
}

async function fetchTeamContext(
  nflTeam: string | undefined,
  season: number
): Promise<Record<string, number | null>> {
  if (!nflTeam) return { team_pass_volume: 50, team_run_volume: 50, team_pace: 50, team_red_zone_drives: 50 };
  
  return {
    team_pass_volume: 55,
    team_run_volume: 50,
    team_pace: 52,
    team_red_zone_drives: 50,
  };
}

async function fetchSoSData(
  nflTeam: string | undefined,
  position: Position,
  season: number
): Promise<Record<string, number | null>> {
  return {
    pass_defense_sos: 50,
    run_defense_sos: 50,
    te_defense_sos: 50,
  };
}

export async function fetchForgeContext(
  playerId: string,
  position: Position,
  season: number,
  week: number | 'season'
): Promise<ForgeContext> {
  const roleBank = await fetchRoleBankData(playerId, position, season);
  
  let playerName = 'Unknown';
  let nflTeam: string | undefined;
  let gamesPlayed = 0;
  
  try {
    const playerResult = await db.execute(sql`
      SELECT DISTINCT player_name, team 
      FROM weekly_stats 
      WHERE player_id = ${playerId} AND season = ${season}
      LIMIT 1
    `);
    if (playerResult.rows.length > 0) {
      const row = playerResult.rows[0] as Record<string, any>;
      playerName = row.player_name || 'Unknown';
      nflTeam = row.team;
    }
    
    const gpResult = await db.execute(sql`
      SELECT COUNT(DISTINCT week) as gp 
      FROM weekly_stats 
      WHERE player_id = ${playerId} AND season = ${season}
    `);
    if (gpResult.rows.length > 0) {
      gamesPlayed = Number((gpResult.rows[0] as any).gp) || 0;
    }
  } catch (error) {
    console.error(`[ForgeEngine] Error fetching player info:`, error);
  }

  const teamContext = await fetchTeamContext(nflTeam, season);
  const sosData = await fetchSoSData(nflTeam, position, season);

  return {
    playerId,
    playerName,
    position,
    nflTeam,
    season,
    week,
    gamesPlayed,
    roleBank,
    teamContext,
    sosData,
    recursion: {
      priorAlpha: roleBank['alpha_score'] ?? undefined,
      alphaMomentum: roleBank['momentum_score'] ? (roleBank['momentum_score'] - 50) / 10 : undefined,
    },
  };
}

export async function runForgeEngine(
  playerId: string,
  position: Position,
  season: number,
  week: number | 'season'
): Promise<ForgeEngineOutput> {
  console.log(`[ForgeEngine] Running for ${playerId} (${position}) season=${season} week=${week}`);
  
  const context = await fetchForgeContext(playerId, position, season, week);
  const lookup = createMetricLookup(context);
  const config = getPositionPillarConfig(position);

  const pillars: ForgePillarScores = {
    volume: computePillarScore(config.volume, lookup),
    efficiency: computePillarScore(config.efficiency, lookup),
    teamContext: computePillarScore(config.teamContext, lookup),
    stability: computePillarScore(config.stability, lookup),
  };

  const { priorAlpha, alphaMomentum } = extractRecursionSignals(context);

  console.log(`[ForgeEngine] Pillars for ${context.playerName}: V=${pillars.volume.toFixed(1)} E=${pillars.efficiency.toFixed(1)} T=${pillars.teamContext.toFixed(1)} S=${pillars.stability.toFixed(1)}`);

  return {
    playerId,
    playerName: context.playerName,
    position,
    nflTeam: context.nflTeam,
    season,
    week,
    gamesPlayed: context.gamesPlayed,
    pillars,
    priorAlpha,
    alphaMomentum,
    rawMetrics: context.roleBank,
  };
}

export async function runForgeEngineBatch(
  position: Position,
  season: number,
  week: number | 'season',
  limit: number = 50
): Promise<ForgeEngineOutput[]> {
  console.log(`[ForgeEngine] Batch run for ${position} season=${season} week=${week} limit=${limit}`);
  
  const tableName = `${position.toLowerCase()}_role_bank`;
  
  try {
    const result = await db.execute(sql`
      SELECT player_id FROM ${sql.identifier(tableName)}
      WHERE season = ${season}
      ORDER BY role_score DESC NULLS LAST
      LIMIT ${limit}
    `);

    const outputs: ForgeEngineOutput[] = [];
    
    for (const row of result.rows) {
      const playerId = (row as any).player_id;
      if (playerId) {
        const output = await runForgeEngine(playerId, position, season, week);
        outputs.push(output);
      }
    }

    return outputs;
  } catch (error) {
    console.error(`[ForgeEngine] Batch error:`, error);
    return [];
  }
}
