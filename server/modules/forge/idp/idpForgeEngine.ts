import { db } from '../../../infra/db';
import { sql } from 'drizzle-orm';
import { computePillarScore, type ForgeEngineOutput, type ForgePillarScores, type MetricLookupFn } from '../forgeEngine';
import type { DefensivePosition } from '@shared/idpSchema';
import { getIdpPillarConfig, IDP_WEIGHTS } from './idpPillars';
import { calibrateIdpAlpha } from './idpCalibration';
import { mapHavocToTier } from '@shared/idpSchema';
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
  const gamesPlayed = Number(seasonRow.games_played) || 0;
  const totalSnaps = Number(seasonRow.total_snaps) || 0;

  const snapShareScore = Math.max(0, Math.min(100, Number(seasonRow.snap_share_score) || 50));
  const opponentQualityScore = Math.max(0, Math.min(100, Number(seasonRow.opponent_quality_score) || 50));
  const scheme = team ? await deriveTeamDefenseScheme(team, season) : null;
  const schemeFitScore = computeSchemeFitScore(position, scheme, opponentQualityScore);

  const activeWeeks = weeklyRows.filter((w) => Number(w.def_snaps) > 0);
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
  return Math.max(0, Math.min(100, 100 - combinedCv * 100));
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

export async function runIdpForgeEngine(playerId: string, position: DefensivePosition, season: number, week: number | 'season'): Promise<ForgeEngineOutput> {
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
