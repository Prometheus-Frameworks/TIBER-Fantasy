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
import { getPrimaryQbContext } from './qbContextPopulator';
import { computeXfpPerGame, normalizeXfpToScore, type XfpResult } from './xfpVolumePillar';
import { computeRoleConsistency, type RoleConsistencyResult } from './roleConsistencyPillar';
import { validateSnapshotRows } from './snapshotDataValidator';
import { resolvePlayerId } from './utils/playerIdResolver';

export type Position = 'QB' | 'RB' | 'WR' | 'TE';

// Runtime position whitelist — validates before constructing table names via sql.identifier()
export const VALID_FORGE_POSITIONS: readonly Position[] = ['QB', 'RB', 'WR', 'TE'];

export function assertValidPosition(position: string): asserts position is Position {
  if (!VALID_FORGE_POSITIONS.includes(position as Position)) {
    throw new Error(`Invalid position "${position}". Must be one of: ${VALID_FORGE_POSITIONS.join(', ')}`);
  }
}

export type MetricSource =
  | 'snapshot_player_week'
  | 'snapshot_team_context'
  | 'sos_table'
  | 'role_bank'
  | 'qb_alpha'
  | 'recursion'
  | 'derived';

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
  dynastyContext?: number; // Dynasty-specific context (QB long-term + offensive continuity + career efficiency)
};

export type QbContextData = {
  qbId: string;
  qbName: string;
  qbRedraftScore: number;
  qbDynastyScore: number;
  qbSkillScore: number;
  qbStabilityScore: number;
  qbDurabilityScore: number;
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
  qbContext?: QbContextData; // QB context from qb_context_2025 table
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
  xfpData?: XfpResult;
  roleConsistency?: RoleConsistencyResult;
};

const WR_PILLARS: PositionPillarConfig = {
  volume: {
    // xFP v3: opportunity-quality-priced expected fantasy points per game
    metrics: [
      { metricKey: 'xfp_per_game', source: 'derived', weight: 1.0 },
    ],
  },
  efficiency: {
    metrics: [
      { metricKey: 'fpoe_per_game', source: 'derived', weight: 0.70 },
      { metricKey: 'deep_target_rate', source: 'role_bank', weight: 0.15 },
      { metricKey: 'ppr_per_target', source: 'role_bank', weight: 0.15 },
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
    // Role consistency: route participation CV (60%) + target share CV (40%)
    // CV-based approach consistent with RB/TE redesign
    metrics: [
      { metricKey: 'route_participation_consistency', source: 'derived', weight: 0.60 },
      { metricKey: 'target_share_consistency', source: 'derived', weight: 0.40 },
    ],
  },
};

const RB_PILLARS: PositionPillarConfig = {
  volume: {
    // xFP v3: opportunity-quality-priced expected fantasy points per game
    metrics: [
      { metricKey: 'xfp_per_game', source: 'derived', weight: 1.0 },
    ],
  },
  efficiency: {
    metrics: [
      { metricKey: 'fpoe_per_game', source: 'derived', weight: 0.70 },
      { metricKey: 'red_zone_touches_per_game', source: 'role_bank', weight: 0.15 },
      { metricKey: 'ppr_per_opportunity', source: 'role_bank', weight: 0.15 },
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
    // Role consistency: touch share CV (60%) + snap share CV (40%)
    // Replaces scoring variance which anti-correlated with PPG (-0.668)
    metrics: [
      { metricKey: 'touch_share_consistency', source: 'derived', weight: 0.60 },
      { metricKey: 'snap_share_consistency', source: 'derived', weight: 0.40 },
    ],
  },
};

const TE_PILLARS: PositionPillarConfig = {
  volume: {
    // xFP v3: opportunity-quality-priced expected fantasy points per game
    metrics: [
      { metricKey: 'xfp_per_game', source: 'derived', weight: 1.0 },
    ],
  },
  efficiency: {
    metrics: [
      { metricKey: 'fpoe_per_game', source: 'derived', weight: 0.70 },
      { metricKey: 'ppr_per_target', source: 'role_bank', weight: 0.15 },
      { metricKey: 'red_zone_targets_per_game', source: 'role_bank', weight: 0.15 },
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
    // Role consistency: route participation CV (60%) + target share CV (40%)
    // Replaces scoring variance which anti-correlated with PPG (-0.786)
    metrics: [
      { metricKey: 'route_participation_consistency', source: 'derived', weight: 0.60 },
      { metricKey: 'target_share_consistency', source: 'derived', weight: 0.40 },
    ],
  },
};

const QB_PILLARS: PositionPillarConfig = {
  volume: {
    // Use v3 xFP/G from snapshot opportunities to avoid role-bank bucketed QB volume.
    // Matches RB/WR/TE continuous volume treatment.
    metrics: [
      { metricKey: 'xfp_per_game', source: 'derived', weight: 1.0 },
    ],
  },
  efficiency: {
    metrics: [
      { metricKey: 'fpoe_per_game', source: 'derived', weight: 0.50 },
      { metricKey: 'epa_per_play', source: 'role_bank', weight: 0.20 },
      { metricKey: 'cpoe', source: 'role_bank', weight: 0.15 },
      { metricKey: 'sack_rate', source: 'role_bank', weight: 0.15, invert: true },
    ],
  },
  teamContext: {
    // Fixed: was using alpha_context_score (self-referential QB alpha) which caused
    // elite QBs like Josh Allen to get suppressed context scores.
    // Now uses team-level environment metrics instead.
    metrics: [
      { metricKey: 'team_pass_volume', source: 'snapshot_team_context', weight: 0.35 },
      { metricKey: 'team_pace', source: 'snapshot_team_context', weight: 0.30 },
      { metricKey: 'pass_defense_sos', source: 'sos_table', weight: 0.35 },
    ],
  },
  stability: {
    // Role consistency: dropback volume CV (60%) + rush share CV (40%)
    metrics: [
      { metricKey: 'dropback_consistency', source: 'derived', weight: 0.60 },
      { metricKey: 'rush_share_consistency', source: 'derived', weight: 0.40 },
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

/**
 * Compute derived stability metrics for WRs
 * These focus on ROLE SECURITY, not scoring volatility
 * Boom-bust WRs should NOT be penalized for high fantasy variance
 */
function computeDerivedMetric(metricKey: string, context: ForgeContext): number | null {
  const roleBank = context.roleBank;
  const teamContext = context.teamContext;
  
  switch (metricKey) {
    case 'availability_score': {
      // Games played normalized to 17-game season
      // Higher = more available/durable
      const gamesPlayed = context.gamesPlayed || Number(roleBank['games_played']) || 0;
      const maxGames = 17;
      const availScore = Math.min(100, (gamesPlayed / maxGames) * 100);
      return availScore;
    }
    
    case 'route_stability': {
      // Route share consistency - consistent route runners have stable share
      // Use route_share_est as primary indicator (higher = more stable role)
      const routeShare = roleBank['route_share_est'] as number;
      if (routeShare == null) {
        // Fallback to routes_per_game normalized (30 rpg = 100)
        const routesPerGame = roleBank['routes_per_game'] as number;
        if (routesPerGame == null) return 50; // default
        return Math.min(100, (routesPerGame / 35) * 100);
      }
      // route_share_est is typically 0-1, convert to 0-100
      return Math.min(100, routeShare * 100);
    }
    
    case 'snap_floor': {
      // Minimum snap share floor - uses stability_index as proxy
      // stability_index reflects consistent playing time
      const stabilityIndex = roleBank['stability_index'] as number;
      if (stabilityIndex != null) {
        return Math.max(0, Math.min(100, stabilityIndex));
      }
      // Fallback: use consistency_score if available
      const consistencyScore = roleBank['consistency_score'] as number;
      if (consistencyScore != null) {
        return Math.max(0, Math.min(100, consistencyScore * 0.8)); // Weight it down slightly
      }
      return 50; // default
    }
    
    case 'depth_chart_insulation': {
      // Role security vs backups - high target share = insulated from competition
      // Use target_share_avg as primary indicator
      const targetShareAvg = roleBank['target_share_avg'] as number;
      if (targetShareAvg != null) {
        // target_share_avg is typically 0-0.35 for elite WRs, normalize to 0-100
        // 0.25+ target share = very insulated (100)
        // 0.10 target share = vulnerable (40)
        const normalized = Math.min(100, ((targetShareAvg - 0.05) / 0.25) * 100);
        return Math.max(20, normalized); // Floor at 20
      }
      // Fallback to role_score
      const roleScore = roleBank['role_score'] as number;
      if (roleScore != null) {
        return Math.max(0, Math.min(100, roleScore));
      }
      return 50; // default
    }
    
    case 'qb_continuity': {
      // QB situation stability - uses team context for pass volume/consistency
      // In dynasty mode, this is critical - stable QB = stable target opportunity
      const teamPassVolume = teamContext['team_pass_volume'] as number;
      const teamPace = teamContext['team_pace'] as number;

      if (teamPassVolume != null && teamPace != null) {
        // Blend pass volume (weighted 60%) and pace (weighted 40%)
        // Both are typically 0-100 normalized
        const blended = (teamPassVolume * 0.6) + (teamPace * 0.4);
        return Math.max(30, Math.min(100, blended));
      }

      if (teamPassVolume != null) return Math.max(30, Math.min(100, teamPassVolume));
      if (teamPace != null) return Math.max(30, Math.min(100, teamPace));

      return 50; // default
    }

    // xFP Volume pillar: opportunity-quality-priced expected fantasy points per game
    case 'xfp_per_game': {
      const xfpData = context.xfpData;
      if (!xfpData || xfpData.weeksUsed === 0) {
        // Fallback to role_bank volume_score if no xFP data
        const volumeScore = roleBank['volume_score'] as number;
        return volumeScore != null ? Math.max(0, Math.min(100, volumeScore)) : 50;
      }
      return normalizeXfpToScore(xfpData.xfpPerGame, context.position);
    }

    // Fantasy Points Over Expected per game (actual - xFP)
    case 'fpoe_per_game': {
      const xfpData = context.xfpData;
      if (!xfpData || xfpData.weeksUsed === 0) return 50;
      // Normalize FPOE: keep current -5 to +10 range until DB-backed percentile
      // validation can be run in an environment with DATABASE_URL configured.
      const normalized = ((xfpData.fpoePerGame - (-5)) / (10 - (-5))) * 100;
      return Math.max(0, Math.min(100, normalized));
    }

    // Role consistency derived metrics (from roleConsistencyPillar)
    case 'touch_share_consistency':
    case 'snap_share_consistency':
    case 'route_participation_consistency':
    case 'target_share_consistency':
    case 'dropback_consistency':
    case 'rush_share_consistency': {
      const rc = context.roleConsistency;
      if (!rc) return 50;

      switch (metricKey) {
        case 'touch_share_consistency':
          return rc.primaryScore;
        case 'snap_share_consistency':
          return rc.secondaryScore;
        case 'route_participation_consistency':
          return rc.primaryScore;
        case 'target_share_consistency':
          return rc.secondaryScore;
        case 'dropback_consistency':
          return rc.primaryScore;
        case 'rush_share_consistency':
          return rc.secondaryScore;
        default:
          return 50;
      }
    }

    default:
      return null;
  }
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
      case 'derived':
        rawValue = computeDerivedMetric(metricKey, context);
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
  season: number,
  resolvedStatsId?: string
): Promise<Record<string, number | null>> {
  assertValidPosition(position);
  const tableName = `${position.toLowerCase()}_role_bank`;
  const roleBankId = resolvedStatsId || playerId;
  
  try {
    const result = await db.execute(sql`
      SELECT * FROM ${sql.identifier(tableName)}
      WHERE player_id = ${roleBankId} AND season = ${season}
      LIMIT 1
    `);

    if (result.rows.length === 0) {
      console.log(`[ForgeEngine] No role bank data for ${playerId} (roleBankId=${roleBankId}) in ${tableName}`);
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
  const defaults = { 
    team_pass_volume: 50, 
    team_run_volume: 50, 
    team_pace: 50, 
    team_red_zone_drives: 50 
  };
  
  if (!nflTeam) return defaults;
  
  try {
    const result = await db.execute(sql`
      SELECT 
        pass_epa,
        rush_epa,
        ypa,
        cpoe,
        run_success_rate,
        explosive_20_plus
      FROM team_offensive_context
      WHERE team = ${nflTeam} AND season = ${season}
      ORDER BY week DESC
      LIMIT 1
    `);
    
    if (result.rows.length === 0) {
      const seasonFallback = await db.execute(sql`
        SELECT 
          pass_epa,
          rush_epa,
          ypa,
          cpoe,
          run_success_rate,
          explosive_20_plus
        FROM team_offensive_context
        WHERE team = ${nflTeam}
        ORDER BY season DESC, week DESC
        LIMIT 1
      `);
      
      if (seasonFallback.rows.length === 0) return defaults;
      
      const row = seasonFallback.rows[0] as Record<string, any>;
      return normalizeTeamContext(row);
    }
    
    const row = result.rows[0] as Record<string, any>;
    const normalized = normalizeTeamContext(row);
    console.log(`[ForgeEngine] Context debug for ${nflTeam}: passEpa=${row.pass_epa}, rushEpa=${row.rush_epa}, cpoe=${row.cpoe}, explosive=${row.explosive_20_plus} → pass_vol=${normalized.team_pass_volume?.toFixed(1)}, run_vol=${normalized.team_run_volume?.toFixed(1)}, pace=${normalized.team_pace?.toFixed(1)}, rz_drives=${normalized.team_red_zone_drives?.toFixed(1)}`);
    return normalized;
  } catch (error) {
    console.error(`[ForgeEngine] Error fetching team context for ${nflTeam}:`, error);
    return defaults;
  }
}

function normalizeTeamContext(row: Record<string, any>): Record<string, number | null> {
  const passEpa = parseFloat(row.pass_epa) || 0;
  const rushEpa = parseFloat(row.rush_epa) || 0;
  const cpoe = parseFloat(row.cpoe) || 0;
  const runSuccessRate = parseFloat(row.run_success_rate) || 0;
  const explosive = parseFloat(row.explosive_20_plus) || 0;
  
  const normalizeRange = (val: number, min: number, max: number) => {
    if (max === min) return 50;
    const norm = ((val - min) / (max - min)) * 100;
    return Math.max(0, Math.min(100, norm));
  };
  
  return {
    team_pass_volume: normalizeRange(passEpa, -0.2, 0.3),
    team_run_volume: normalizeRange(rushEpa, -0.2, 0.2),
    team_pace: normalizeRange(explosive, 3, 20),
    team_red_zone_drives: normalizeRange(cpoe, -5, 10),
  };
}

async function fetchSoSData(
  nflTeam: string | undefined,
  position: Position,
  season: number
): Promise<Record<string, number | null>> {
  const defaults = {
    pass_defense_sos: 50,
    run_defense_sos: 50,
    te_defense_sos: 50,
  };
  
  if (!nflTeam) return defaults;
  
  try {
    const result = await db.execute(sql`
      SELECT position, sos_score 
      FROM sos_scores 
      WHERE team = ${nflTeam} AND season = ${season}
    `);
    
    if (result.rows.length === 0) return defaults;
    
    const sosMap: Record<string, number> = {};
    for (const row of result.rows) {
      const r = row as Record<string, any>;
      sosMap[r.position] = parseFloat(r.sos_score) || 50;
    }
    
    return {
      pass_defense_sos: sosMap['WR'] ?? sosMap['PASS'] ?? 50,
      run_defense_sos: sosMap['RB'] ?? sosMap['RUSH'] ?? 50,
      te_defense_sos: sosMap['TE'] ?? sosMap['WR'] ?? 50,
    };
  } catch (error) {
    console.error(`[ForgeEngine] Error fetching SoS for ${nflTeam}:`, error);
    return defaults;
  }
}

/**
 * Compute dynastyContext for WRs - combines:
 * - QB long-term score (40%): QB's FORGE alpha + stability (INJURY-AWARE)
 * - Offensive continuity (30%): Team pass rate, EPA trends
 * - Career efficiency memory (30%): Historical YPRR, target share, efficiency
 * 
 * INJURY AWARENESS:
 * If QB played < 5 games this season (e.g., Burrow on IR), treat as injury outlier.
 * Don't let backup QB drag down dynastyContext.
 * Formula: 60% last healthy season + 30% career + 10% current (only if >= 5 games)
 */
async function computeDynastyContext(
  nflTeam: string | undefined,
  playerId: string,
  position: Position,
  season: number,
  teamContext: Record<string, number | null>,
  roleBank: Record<string, number | null>
): Promise<number> {
  // Only compute for WR for now
  if (position !== 'WR') return 50;
  
  let qbLongTermScore = 50;
  let offensiveContinuityScore = 50;
  let careerEfficiencyScore = 50;
  
  try {
    // 1. QB Long-Term Score: INJURY-AWARE calculation
    // Identify the FRANCHISE QB (not necessarily who played most games this season)
    if (nflTeam) {
      const QB_INJURY_THRESHOLD = 5; // Less than 5 games = injury outlier
      const QB_HEALTHY_SEASON_THRESHOLD = 8; // 8+ games = healthy season
      
      // Step 1: Find all QBs who played for this team this season
      const allQbsResult = await db.execute(sql`
        SELECT qb.player_id, qb.games_played, qb.volume_score, qb.efficiency_score, 
               qb.alpha_context_score, qb.epa_per_play, qb.cpoe
        FROM qb_role_bank qb
        JOIN (
          SELECT DISTINCT player_id 
          FROM weekly_stats 
          WHERE team = ${nflTeam} 
            AND season = ${season} 
            AND position = 'QB'
        ) ws ON qb.player_id = ws.player_id
        WHERE qb.season = ${season}
        ORDER BY qb.games_played DESC
      `);
      
      // Step 2: Determine if any QB played a "healthy" season (>= 8 games)
      const healthyStarter = allQbsResult.rows.find((r: any) => 
        (parseInt(r.games_played) || 0) >= QB_HEALTHY_SEASON_THRESHOLD
      );
      
      if (healthyStarter) {
        // Normal case: Starter is healthy, use current season data
        const qb = healthyStarter as Record<string, any>;
        const qbPlayerId = qb.player_id as string;
        const qbAlpha = parseFloat(qb.alpha_context_score) || parseFloat(qb.efficiency_score) || 50;
        const qbVolume = parseFloat(qb.volume_score) || 50;
        
        // Blend with historical data for dynasty stability
        const qbHistoryResult = await db.execute(sql`
          SELECT season, games_played, alpha_context_score, efficiency_score
          FROM qb_role_bank
          WHERE player_id = ${qbPlayerId}
            AND season < ${season}
            AND games_played >= ${QB_HEALTHY_SEASON_THRESHOLD}
          ORDER BY season DESC
          LIMIT 2
        `);
        
        let lastHealthyScore = qbAlpha;
        let careerScore = qbAlpha;
        
        if (qbHistoryResult.rows.length > 0) {
          const lastHealthy = qbHistoryResult.rows[0] as Record<string, any>;
          lastHealthyScore = parseFloat(lastHealthy.alpha_context_score) || 
                            parseFloat(lastHealthy.efficiency_score) || qbAlpha;
          
          const careerAlphas = qbHistoryResult.rows.map((r: any) => 
            parseFloat(r.alpha_context_score) || parseFloat(r.efficiency_score) || 50
          );
          careerScore = careerAlphas.reduce((a, b) => a + b, 0) / careerAlphas.length;
        }
        
        // Healthy QB formula: 10% last healthy + 30% career + 60% current
        qbLongTermScore = (0.10 * lastHealthyScore) + (0.30 * careerScore) + (0.60 * ((qbAlpha + qbVolume) / 2));
        
      } else {
        // INJURY CASE: No QB has 8+ games - find the franchise QB via historical data
        console.log(`[ForgeEngine] No healthy starter for ${nflTeam} this season - checking for injured franchise QB`);
        
        // Find the team's historical starter (most total games in last 3 seasons)
        const franchiseQbResult = await db.execute(sql`
          SELECT qb.player_id, SUM(qb.games_played) as total_games,
                 MAX(qb.alpha_context_score) as best_alpha,
                 AVG(qb.alpha_context_score) as avg_alpha
          FROM qb_role_bank qb
          JOIN (
            SELECT DISTINCT player_id 
            FROM weekly_stats 
            WHERE team = ${nflTeam} 
              AND position = 'QB'
          ) ws ON qb.player_id = ws.player_id
          WHERE qb.season >= ${season - 3}
            AND qb.games_played >= ${QB_HEALTHY_SEASON_THRESHOLD}
          GROUP BY qb.player_id
          ORDER BY total_games DESC, best_alpha DESC
          LIMIT 1
        `);
        
        if (franchiseQbResult.rows.length > 0) {
          // Found the franchise QB - use their historical performance
          const franchiseQb = franchiseQbResult.rows[0] as Record<string, any>;
          const franchiseQbId = franchiseQb.player_id as string;
          
          console.log(`[ForgeEngine] Found franchise QB ${franchiseQbId} for ${nflTeam} with ${franchiseQb.total_games} games over recent seasons`);
          
          // Check this QB's current season status
          const currentSeasonQb = allQbsResult.rows.find((r: any) => r.player_id === franchiseQbId);
          const currentGames = currentSeasonQb ? (parseInt((currentSeasonQb as any).games_played) || 0) : 0;
          
          if (currentGames < QB_INJURY_THRESHOLD) {
            // Franchise QB is INJURED this season
            console.log(`[ForgeEngine] QB injury detected for ${nflTeam}: franchise QB has ${currentGames} games < ${QB_INJURY_THRESHOLD} threshold`);
            
            // Fetch QB's healthy seasons for dynasty value
            const qbHistoryResult = await db.execute(sql`
              SELECT season, games_played, volume_score, efficiency_score, alpha_context_score
              FROM qb_role_bank
              WHERE player_id = ${franchiseQbId}
                AND games_played >= ${QB_HEALTHY_SEASON_THRESHOLD}
              ORDER BY season DESC
              LIMIT 3
            `);
            
            let lastHealthyScore = 70; // Default for elite QBs
            let careerScore = 65;
            
            if (qbHistoryResult.rows.length > 0) {
              const lastHealthy = qbHistoryResult.rows[0] as Record<string, any>;
              lastHealthyScore = parseFloat(lastHealthy.alpha_context_score) || 
                                parseFloat(lastHealthy.efficiency_score) || 70;
              
              const careerAlphas = qbHistoryResult.rows.map((r: any) => 
                parseFloat(r.alpha_context_score) || parseFloat(r.efficiency_score) || 50
              );
              careerScore = careerAlphas.reduce((a, b) => a + b, 0) / careerAlphas.length;
            }
            
            // Injury-aware formula: 60% last healthy + 30% career + 10% current (0 for injured QB)
            qbLongTermScore = (0.60 * lastHealthyScore) + (0.30 * careerScore);
            console.log(`[ForgeEngine] QB injury-aware score for ${nflTeam}: lastHealthy=${lastHealthyScore.toFixed(1)} career=${careerScore.toFixed(1)} → ${qbLongTermScore.toFixed(1)}`);
            
          } else {
            // Franchise QB played some but not enough for "healthy" - partial weight
            const qbData = currentSeasonQb as Record<string, any>;
            const currentAlpha = parseFloat(qbData.alpha_context_score) || 50;
            
            const qbHistoryResult = await db.execute(sql`
              SELECT alpha_context_score, efficiency_score
              FROM qb_role_bank
              WHERE player_id = ${franchiseQbId}
                AND games_played >= ${QB_HEALTHY_SEASON_THRESHOLD}
              ORDER BY season DESC
              LIMIT 2
            `);
            
            let historicalScore = currentAlpha;
            if (qbHistoryResult.rows.length > 0) {
              const careerAlphas = qbHistoryResult.rows.map((r: any) => 
                parseFloat(r.alpha_context_score) || parseFloat(r.efficiency_score) || 50
              );
              historicalScore = careerAlphas.reduce((a, b) => a + b, 0) / careerAlphas.length;
            }
            
            // Partial season: 40% current + 60% historical
            qbLongTermScore = (0.40 * currentAlpha) + (0.60 * historicalScore);
          }
        } else {
          // No franchise QB found - new team or young QB room, use current best
          if (allQbsResult.rows.length > 0) {
            const bestQb = allQbsResult.rows[0] as Record<string, any>;
            qbLongTermScore = parseFloat(bestQb.alpha_context_score) || 50;
          }
        }
      }
    }
    
    // 2. Offensive Continuity Score: Team pass EPA, neutral pass rate
    const passVolume = teamContext['team_pass_volume'] ?? 50;
    const teamPace = teamContext['team_pace'] ?? 50;
    offensiveContinuityScore = (0.6 * passVolume) + (0.4 * teamPace);
    
    // 3. Career Efficiency Memory: Use role bank efficiency metrics
    const efficiencyScore = roleBank['efficiency_score'] ?? 50;
    const efficiencyIndex = roleBank['efficiency_index'] ?? 50;
    const pprPerTarget = roleBank['ppr_per_target'] ?? null;
    
    // Blend available efficiency metrics
    const effMetrics: number[] = [efficiencyScore, efficiencyIndex];
    if (pprPerTarget !== null) {
      // Normalize ppr_per_target (typical range 0.8-2.0) to 0-100
      const normalizedPprPT = Math.min(100, Math.max(0, ((pprPerTarget - 0.8) / 1.2) * 100));
      effMetrics.push(normalizedPprPT);
    }
    careerEfficiencyScore = effMetrics.reduce((a, b) => a + b, 0) / effMetrics.length;
    
  } catch (error) {
    console.log(`[ForgeEngine] DynastyContext calculation partial - using defaults`);
  }
  
  // Combine with formula from spec
  const dynastyContext = 
    (0.40 * qbLongTermScore) +
    (0.30 * offensiveContinuityScore) +
    (0.30 * careerEfficiencyScore);
  
  return Math.max(0, Math.min(100, dynastyContext));
}

export async function fetchForgeContext(
  playerId: string,
  position: Position,
  season: number,
  week: number | 'season'
): Promise<ForgeContext> {
  const resolved = await resolvePlayerId(playerId);
  const statsId = resolved.statsId;
  
  const roleBank = await fetchRoleBankData(playerId, position, season, statsId);
  
  let playerName = resolved.playerName;
  let nflTeam = resolved.nflTeam;
  let gamesPlayed = 0;
  
  try {
    const playerResult = await db.execute(sql`
      SELECT DISTINCT player_name, team 
      FROM weekly_stats 
      WHERE player_id = ${statsId} AND season = ${season}
      LIMIT 1
    `);
    if (playerResult.rows.length > 0) {
      const row = playerResult.rows[0] as Record<string, any>;
      playerName = row.player_name || playerName;
      nflTeam = row.team || nflTeam;
    }
    
    const gpResult = await db.execute(sql`
      SELECT COUNT(DISTINCT week) as gp 
      FROM weekly_stats 
      WHERE player_id = ${statsId} AND season = ${season}
    `);
    if (gpResult.rows.length > 0) {
      gamesPlayed = Number((gpResult.rows[0] as any).gp) || 0;
    }

    const snapshotResult = await db.execute(sql`
      SELECT
        sm.week,
        spw.player_id,
        spw.targets,
        spw.rush_attempts,
        spw.routes,
        spw.dropbacks,
        spw.snap_share
      FROM datadive_snapshot_player_week spw
      JOIN datadive_snapshot_meta sm ON sm.id = spw.snapshot_id
      WHERE spw.player_id = ${statsId}
        AND sm.season = ${season}
        AND sm.is_official = true
      ORDER BY sm.week
    `);

    if (snapshotResult.rows.length > 0) {
      const snapshotValidation = validateSnapshotRows(
        snapshotResult.rows as Record<string, any>[],
        position,
        playerId
      );

      gamesPlayed = Math.max(gamesPlayed, snapshotValidation.cleanRows.length);
    }
  } catch (error) {
    console.error(`[ForgeEngine] Error fetching player info:`, error);
  }

  const teamContext = await fetchTeamContext(nflTeam, season);
  const sosData = await fetchSoSData(nflTeam, position, season);

  // Compute xFP data for volume pillar
  const xfpData = await computeXfpPerGame(playerId, position, season);

  // Compute role consistency for stability pillar
  const roleConsistency = await computeRoleConsistency(playerId, position, season);

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
      alphaMomentum: roleBank['momentum_score'] != null ? (Number(roleBank['momentum_score']) - 50) / 10 : undefined,
    },
    xfpData,
    roleConsistency,
  };
}

const GAMES_FULL_CREDIT: Record<Position, number> = {
  QB: 12,
  RB: 10,
  WR: 10,
  TE: 10,
};

const BASELINE_PILLAR = 40;

function applyGamesPlayedDampening(
  pillars: ForgePillarScores,
  gamesPlayed: number,
  position: Position
): ForgePillarScores {
  const minGames = GAMES_FULL_CREDIT[position];
  if (gamesPlayed >= minGames) return pillars;

  const confidence = Math.sqrt(Math.max(1, gamesPlayed) / minGames);

  const dampen = (score: number) =>
    BASELINE_PILLAR + (score - BASELINE_PILLAR) * confidence;

  return {
    volume: dampen(pillars.volume),
    efficiency: dampen(pillars.efficiency),
    teamContext: dampen(pillars.teamContext),
    stability: dampen(pillars.stability),
    dynastyContext: pillars.dynastyContext != null ? dampen(pillars.dynastyContext) : undefined,
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

  // Compute base pillars
  const basePillars: ForgePillarScores = {
    volume: computePillarScore(config.volume, lookup),
    efficiency: computePillarScore(config.efficiency, lookup),
    teamContext: computePillarScore(config.teamContext, lookup),
    stability: computePillarScore(config.stability, lookup),
  };

  // Compute dynastyContext for WRs (used in dynasty mode)
  const dynastyContext = await computeDynastyContext(
    context.nflTeam,
    playerId,
    position,
    season,
    context.teamContext,
    context.roleBank
  );

  const pillars: ForgePillarScores = {
    ...basePillars,
    dynastyContext,
  };

  const { priorAlpha, alphaMomentum } = extractRecursionSignals(context);

  // Fetch QB context from qb_context_2025 table for skill players
  let qbContext: QbContextData | undefined;
  if (position !== 'QB' && context.nflTeam) {
    const qbData = await getPrimaryQbContext(context.nflTeam, season);
    if (qbData) {
      qbContext = {
        qbId: qbData.qbId,
        qbName: qbData.qbName,
        qbRedraftScore: qbData.qbRedraftScore,
        qbDynastyScore: qbData.qbDynastyScore,
        qbSkillScore: qbData.qbSkillScore,
        qbStabilityScore: qbData.qbStabilityScore,
        qbDurabilityScore: qbData.qbDurabilityScore,
      };
    }
  }

  const dampenedPillars = applyGamesPlayedDampening(pillars, context.gamesPlayed, position);

  // QB-specific debug logging for context diagnosis
  if (position === 'QB') {
    console.log(`[ForgeEngine] QB Context for ${context.playerName}: team_pass_vol=${context.teamContext['team_pass_volume']?.toFixed(1)}, team_pace=${context.teamContext['team_pace']?.toFixed(1)}, pass_def_sos=${context.sosData['pass_defense_sos']?.toFixed(1)} → teamContext=${dampenedPillars.teamContext.toFixed(1)}`);
  }

  console.log(`[ForgeEngine] Pillars for ${context.playerName}: V=${dampenedPillars.volume.toFixed(1)} E=${dampenedPillars.efficiency.toFixed(1)} T=${dampenedPillars.teamContext.toFixed(1)} S=${dampenedPillars.stability.toFixed(1)} D=${(dampenedPillars.dynastyContext ?? dynastyContext).toFixed(1)}${context.gamesPlayed < GAMES_FULL_CREDIT[position] ? ` [GP=${context.gamesPlayed}/${GAMES_FULL_CREDIT[position]} dampened]` : ''}${qbContext ? ` | QB: ${qbContext.qbName}` : ''}`);

  const resolvedMetrics: Record<string, number | null> = { ...context.roleBank };
  if (context.xfpData && context.xfpData.weeksUsed > 0) {
    resolvedMetrics['xfp_per_game'] = Math.round(context.xfpData.xfpPerGame * 100) / 100;
    resolvedMetrics['fpoe_per_game'] = Math.round(context.xfpData.fpoePerGame * 100) / 100;
  }
  const allPillars = ['volume', 'efficiency', 'teamContext', 'stability'] as const;
  for (const pillarKey of allPillars) {
    const pillarCfg = config[pillarKey];
    if (pillarCfg?.metrics) {
      for (const m of pillarCfg.metrics) {
        if (resolvedMetrics[m.metricKey] === undefined || resolvedMetrics[m.metricKey] === null) {
          if (m.source === 'snapshot_team_context') {
            resolvedMetrics[m.metricKey] = context.teamContext[m.metricKey] ?? null;
          } else if (m.source === 'sos_table') {
            resolvedMetrics[m.metricKey] = context.sosData[m.metricKey] ?? null;
          }
        }
      }
    }
  }

  return {
    playerId,
    playerName: context.playerName,
    position,
    nflTeam: context.nflTeam,
    season,
    week,
    gamesPlayed: context.gamesPlayed,
    pillars: dampenedPillars,
    priorAlpha,
    alphaMomentum,
    rawMetrics: resolvedMetrics,
    qbContext,
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
    // Order by games_played DESC first to prioritize players with full seasons,
    // then by volume_score DESC within same games tier. This prevents low-sample
    // players (4 games, volume_score=100) from crowding out full-season starters
    // like Josh Allen (11 games, volume_score=44).
    const result = await db.execute(sql`
      SELECT player_id FROM ${sql.identifier(tableName)}
      WHERE season = ${season}
      ORDER BY games_played DESC NULLS LAST, volume_score DESC NULLS LAST
      LIMIT ${limit}
    `);

    const playerIds = result.rows
      .map((row: any) => row.player_id)
      .filter(Boolean) as string[];

    const CONCURRENCY = 10;
    const outputs: ForgeEngineOutput[] = [];

    for (let i = 0; i < playerIds.length; i += CONCURRENCY) {
      const batch = playerIds.slice(i, i + CONCURRENCY);
      const batchResults = await Promise.all(
        batch.map(pid => runForgeEngine(pid, position, season, week))
      );
      outputs.push(...batchResults);
    }

    return outputs;
  } catch (error) {
    console.error(`[ForgeEngine] Batch error:`, error);
    return [];
  }
}
