import { db } from '../../../infra/db';
import { sql } from 'drizzle-orm';
import { computePillarScore, type ForgePillarScores, type MetricLookupFn } from '../forgeEngine';
import type { DefensivePosition } from '@shared/idpSchema';
import { getIdpPillarConfig, IDP_WEIGHTS } from './idpPillars';
import { calibrateIdpAlpha } from './idpCalibration';
import { mapHavocToTier, HAVOC_PRIOR_RATE, HAVOC_PRIOR_SNAPS } from '@shared/idpSchema';

export type IdpForgeOutput = {
  playerId: string;
  playerName: string;
  position: DefensivePosition;
  nflTeam?: string;
  season: number;
  week: number | 'season';
  gamesPlayed: number;
  pillars: ForgePillarScores;
  rawMetrics: Record<string, any>;
};
import { computeSchemeFitScore, deriveTeamDefenseScheme } from './idpTeamContext';

type IdpContext = {
  playerId: string;
  playerName: string;
  team: string | null;
  season: number;
  gamesPlayed: number;
  totalSnaps: number;
  seasonRow: Record<string, any>;
  weeklyRows: Array<Record<string, any>>;
  snapShareScore: number;
  opponentQualityScore: number;
  schemeFitScore: number;
  stabilityScore: number;
};

const teamDefSnapsCache = new Map<string, Map<number, number>>();

async function getTeamDefSnapsPerWeek(team: string, season: number): Promise<Map<number, number>> {
  const cacheKey = `${team}_${season}`;
  if (teamDefSnapsCache.has(cacheKey)) return teamDefSnapsCache.get(cacheKey)!;
  
  const result = await db.execute(sql`
    SELECT week, MAX(defense_snaps) as team_def_snaps
    FROM idp_player_week
    WHERE team = ${team} AND season = ${season} AND defense_snaps > 0
    GROUP BY week
  `);
  const map = new Map<number, number>();
  for (const row of result.rows as any[]) {
    map.set(Number(row.week), Number(row.team_def_snaps) || 1);
  }
  teamDefSnapsCache.set(cacheKey, map);
  return map;
}

async function computeSnapShare(
  _playerId: string,
  team: string | null,
  season: number,
  weeklyRows: Array<Record<string, any>>
): Promise<number> {
  if (!team) return 50;
  const teamSnaps = await getTeamDefSnapsPerWeek(team, season);
  const shares: number[] = [];
  for (const w of weeklyRows) {
    const playerSnaps = Number(w.defense_snaps) || 0;
    if (playerSnaps <= 0) continue;
    const teamWeekSnaps = teamSnaps.get(Number(w.week)) || 1;
    shares.push(playerSnaps / teamWeekSnaps);
  }
  if (shares.length === 0) return 50;
  const avgShare = shares.reduce((a, b) => a + b, 0) / shares.length;
  return Math.max(0, Math.min(100, avgShare * 100));
}

export async function fetchIdpForgeContext(playerId: string, position: DefensivePosition, season: number): Promise<IdpContext> {
  const s = await db.execute(sql`SELECT * FROM idp_player_season WHERE gsis_id = ${playerId} AND season = ${season} LIMIT 1`);
  if (!s.rows.length) throw new Error(`IDP season row not found for ${playerId} (${season})`);
  const seasonRow = s.rows[0] as Record<string, any>;
  const weekly = await db.execute(sql`
    SELECT * FROM idp_player_week
    WHERE gsis_id = ${playerId} AND season = ${season}
    ORDER BY week
  `);
  const weeklyRows = weekly.rows as Array<Record<string, any>>;

  const team = (seasonRow.team as string | null) ?? null;
  const gamesPlayed = Number(seasonRow.games) || 0;
  const totalSnaps = Number(seasonRow.total_snaps) || 0;

  const snapShareScore = await computeSnapShare(playerId, team, season, weeklyRows);
  const opponentQualityScore = 50;
  const scheme = team ? await deriveTeamDefenseScheme(team, season) : null;
  const schemeFitScore = computeSchemeFitScore(position, scheme, opponentQualityScore);

  const activeWeeks = weeklyRows.filter((w) => Number(w.defense_snaps) > 0);
  const stabilityScore = computeStabilityScore(position, activeWeeks);

  return {
    playerId,
    playerName: String(seasonRow.player_name || playerId),
    team,
    season,
    gamesPlayed,
    totalSnaps,
    seasonRow,
    weeklyRows,
    snapShareScore,
    opponentQualityScore,
    schemeFitScore,
    stabilityScore,
  };
}

const EXPECTED_CV: Record<DefensivePosition, number> = {
  EDGE: 1.1,
  DI: 1.0,
  LB: 0.55,
  CB: 0.9,
  S: 0.7,
};

function computeStabilityScore(position: DefensivePosition, weeks: Array<Record<string, any>>): number {
  if (weeks.length < 4) return 50;
  const m1 = (w: Record<string, any>) => Number(w.havoc_events) || 0;
  const m2 = (w: Record<string, any>) => {
    if (position === 'EDGE' || position === 'DI') return (Number(w.sacks) || 0) + (Number(w.qb_hits) || 0);
    if (position === 'LB') return Number(w.tackles_total) || 0;
    if (position === 'CB') return Number(w.passes_defended) || 0;
    return Number(w.tackles_total) || 0;
  };
  const cv = (arr: number[]) => {
    const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
    if (mean <= 0) return 1;
    const variance = arr.reduce((a, b) => a + (b - mean) ** 2, 0) / arr.length;
    return Math.sqrt(variance) / mean;
  };
  const combinedCv = (cv(weeks.map(m1)) + cv(weeks.map(m2))) / 2;
  const expectedCv = EXPECTED_CV[position];
  const relativeCv = combinedCv / expectedCv;
  return Math.max(0, Math.min(100, 100 - Math.max(0, relativeCv - 0.5) * 100));
}

export function createIdpMetricLookup(context: IdpContext, position: DefensivePosition): MetricLookupFn {
  const snaps = Math.max(1, context.totalSnaps);
  const games = Math.max(1, context.gamesPlayed);
  const s = context.seasonRow;

  const pressureRate = ((Number(s.sacks) || 0) + (Number(s.qb_hits) || 0)) / snaps;
  const sackRate = (Number(s.sacks) || 0) / snaps;
  const tflRate = (Number(s.tackles_for_loss) || 0) / snaps;
  const tacklesPerSnap = (Number(s.tackles_total) || 0) / snaps;
  const pdRate = (Number(s.passes_defended) || 0) / snaps;
  const intRate = (Number(s.interceptions) || 0) / snaps;
  const ffRate = (Number(s.forced_fumbles) || 0) / snaps;

  return (metricKey: string) => {
    switch (metricKey) {
      case 'defense_snaps_per_game': return (Number(s.total_snaps) || 0) / games;
      case 'snap_share': return context.snapShareScore;
      case 'tackles_total_per_game': return (Number(s.tackles_total) || 0) / games;
      case 'passes_defended_per_game': return (Number(s.passes_defended) || 0) / games;
      case 'havoc_index': return Number(s.havoc_index) || Math.max(0, Math.min(100, (Number(s.havoc_smoothed_rate) || 0) * 1000));
      case 'rate_1':
        if (position === 'EDGE') return pressureRate * 100;
        if (position === 'DI') return tflRate * 100;
        if (position === 'LB') return tflRate * 100;
        if (position === 'CB') return pdRate * 100;
        return intRate * 100;
      case 'rate_2':
        if (position === 'EDGE') return sackRate * 100;
        if (position === 'DI') return pressureRate * 100;
        if (position === 'LB') return tacklesPerSnap * 100;
        if (position === 'CB') return intRate * 100;
        return ffRate * 100;
      case 'snap_share_score': return context.snapShareScore;
      case 'opponent_quality_score': return context.opponentQualityScore;
      case 'scheme_fit_score': return context.schemeFitScore;
      case 'stability_score': return context.stabilityScore;
      default: return null;
    }
  };
}

export async function runIdpForgeEngine(playerId: string, position: DefensivePosition, season: number, week: number | 'season'): Promise<IdpForgeOutput> {
  const context = await fetchIdpForgeContext(playerId, position, season);
  const config = getIdpPillarConfig(position);
  const lookup = createIdpMetricLookup(context, position);

  const pillars: ForgePillarScores = {
    volume: computePillarScore(config.volume, lookup),
    efficiency: computePillarScore(config.efficiency, lookup),
    teamContext: computePillarScore(config.teamContext, lookup),
    stability: computePillarScore(config.stability, lookup),
  };

  const weights = IDP_WEIGHTS[position];
  const rawComposite = pillars.volume * weights.volume + pillars.efficiency * weights.efficiency + pillars.teamContext * weights.teamContext + pillars.stability * weights.stability;
  const alpha = calibrateIdpAlpha(rawComposite, position);

  return {
    playerId,
    playerName: context.playerName,
    position,
    nflTeam: context.team ?? undefined,
    season,
    week,
    gamesPlayed: context.gamesPlayed,
    pillars,
    rawMetrics: {
      ...context.seasonRow,
      calibrated_alpha: alpha,
      tier_numeric: Number((mapHavocToTier(alpha) || 'T5').replace('T', '')),
    },
  };
}

function buildVirtualSeasonRow(weeklyRows: Array<Record<string, any>>): Record<string, any> {
  const sum = (key: string) => weeklyRows.reduce((a, w) => a + (Number(w[key]) || 0), 0);
  const totalSnaps = sum('defense_snaps');
  const havocEvents = sum('havoc_events');
  const smoothed = (havocEvents + HAVOC_PRIOR_RATE * HAVOC_PRIOR_SNAPS) / (totalSnaps + HAVOC_PRIOR_SNAPS);
  const havocIndex = Math.max(0, Math.min(100, smoothed * 1000));
  return {
    player_name: weeklyRows[0]?.player_name ?? 'Unknown',
    team: weeklyRows[weeklyRows.length - 1]?.team ?? null,
    position_group: weeklyRows[0]?.position_group ?? 'EDGE',
    games: weeklyRows.length,
    total_snaps: totalSnaps,
    tackles_total: sum('tackles_total'),
    sacks: sum('sacks'),
    tackles_for_loss: sum('tackles_for_loss'),
    qb_hits: sum('qb_hits'),
    passes_defended: sum('passes_defended'),
    forced_fumbles: sum('forced_fumbles'),
    interceptions: sum('interceptions'),
    fumble_recoveries: sum('fumble_recoveries'),
    total_havoc_events: havocEvents,
    havoc_smoothed_rate: smoothed,
    havoc_index: havocIndex,
    havoc_tier: mapHavocToTier(havocIndex),
    low_confidence: totalSnaps < HAVOC_PRIOR_SNAPS ? 1 : 0,
  };
}

export async function runIdpForgeThroughWeek(
  playerId: string,
  position: DefensivePosition,
  season: number,
  throughWeek: number
): Promise<{ alpha: number; tier: string; pillars: ForgePillarScores; gamesPlayed: number; totalSnaps: number } | null> {
  const weekly = await db.execute(sql`
    SELECT * FROM idp_player_week
    WHERE gsis_id = ${playerId} AND season = ${season} AND week <= ${throughWeek}
    ORDER BY week
  `);
  const weeklyRows = weekly.rows as Array<Record<string, any>>;
  if (weeklyRows.length === 0) return null;

  const virtualSeason = buildVirtualSeasonRow(weeklyRows);
  const team = virtualSeason.team;

  const snapShareScore = await computeSnapShare(playerId, team, season, weeklyRows);
  const opponentQualityScore = 50;
  const scheme = team ? await deriveTeamDefenseScheme(team, season) : null;
  const schemeFitScore = computeSchemeFitScore(position, scheme, opponentQualityScore);
  const activeWeeks = weeklyRows.filter((w) => Number(w.defense_snaps) > 0);
  const stabilityScore = computeStabilityScore(position, activeWeeks);

  const context: IdpContext = {
    playerId,
    playerName: String(virtualSeason.player_name),
    team,
    season,
    gamesPlayed: weeklyRows.length,
    totalSnaps: Number(virtualSeason.total_snaps),
    seasonRow: virtualSeason,
    weeklyRows,
    snapShareScore,
    opponentQualityScore,
    schemeFitScore,
    stabilityScore,
  };

  const config = getIdpPillarConfig(position);
  const lookup = createIdpMetricLookup(context, position);
  const pillars: ForgePillarScores = {
    volume: computePillarScore(config.volume, lookup),
    efficiency: computePillarScore(config.efficiency, lookup),
    teamContext: computePillarScore(config.teamContext, lookup),
    stability: computePillarScore(config.stability, lookup),
  };

  const weights = IDP_WEIGHTS[position];
  const rawComposite = pillars.volume * weights.volume + pillars.efficiency * weights.efficiency + pillars.teamContext * weights.teamContext + pillars.stability * weights.stability;
  const alpha = calibrateIdpAlpha(rawComposite, position);

  return {
    alpha: Math.round(alpha * 10) / 10,
    tier: mapHavocToTier(alpha),
    pillars,
    gamesPlayed: weeklyRows.length,
    totalSnaps: Number(virtualSeason.total_snaps),
  };
}
