import { ScoringLeagueContextInput, ScoringPlayerInput } from './types';
import { db } from '../../../infra/db';
import { playerUsage, weeklyStats } from '@shared/schema';
import { and, eq, lte, sql } from 'drizzle-orm';

interface TiberPlayerLike {
  canonicalId: string;
  fullName: string;
  position: string;
  nflTeam: string | null;
}

export function toScoringPlayerInput(player: TiberPlayerLike): ScoringPlayerInput {
  return {
    player_id: player.canonicalId,
    player_name: player.fullName,
    team: player.nflTeam,
    position: player.position,
  };
}

export function toLeagueContextInput(input: {
  season?: number;
  week?: number;
  scoringFormat?: string;
  teams?: number;
}): ScoringLeagueContextInput {
  return {
    season: Number.isInteger(input.season) ? input.season : undefined,
    week: Number.isInteger(input.week) ? input.week : undefined,
    scoringFormat: input.scoringFormat ?? 'ppr',
    teams: Number.isInteger(input.teams) ? input.teams : 12,
  };
}

function toFiniteOrNull(value: unknown): number | null {
  if (value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function hasMeaningfulScoringInputs(player: ScoringPlayerInput): boolean {
  const games = toFiniteOrNull((player as any).games_sampled);
  const hasOpportunitySignal = ['routes_pg', 'targets_pg', 'carries_pg', 'fantasy_points_ppr_pg'].some((key) => {
    const value = toFiniteOrNull((player as any)[key]);
    return value != null && value > 0;
  });
  return (games ?? 0) >= 2 && hasOpportunitySignal;
}

export async function buildScoringPlayerInputFromData(input: {
  playerId: string;
  playerName: string;
  position: string;
  team: string | null;
  season: number;
  throughWeek: number;
}): Promise<ScoringPlayerInput> {
  const [agg] = await db
    .select({
      gamesSampled: sql<number>`count(*)`,
      routesPg: sql<number>`avg(${weeklyStats.routes})`,
      targetsPg: sql<number>`avg(${weeklyStats.targets})`,
      carriesPg: sql<number>`avg(${weeklyStats.rushAtt})`,
      pointsPprPg: sql<number>`avg(${weeklyStats.fantasyPointsPpr})`,
    })
    .from(weeklyStats)
    .where(
      and(
        eq(weeklyStats.playerId, input.playerId),
        eq(weeklyStats.season, input.season),
        lte(weeklyStats.week, input.throughWeek),
      ),
    );

  const [usageAgg] = await db
    .select({
      snapShare: sql<number>`avg(${playerUsage.snapSharePct})`,
      targetShare: sql<number>`avg(${playerUsage.targetSharePct})`,
    })
    .from(playerUsage)
    .where(
      and(
        eq(playerUsage.playerId, input.playerId),
        eq(playerUsage.season, input.season),
        lte(playerUsage.week, input.throughWeek),
      ),
    );

  const gamesSampled = toFiniteOrNull(agg?.gamesSampled) ?? 0;
  const pointsPprPg = toFiniteOrNull(agg?.pointsPprPg);
  const volatilityIndex =
    pointsPprPg != null && pointsPprPg > 0
      ? Math.min(1, Math.abs((toFiniteOrNull(agg?.targetsPg) ?? 0) - (toFiniteOrNull(agg?.carriesPg) ?? 0)) / (pointsPprPg * 4))
      : null;

  return {
    player_id: input.playerId,
    player_name: input.playerName,
    team: input.team,
    position: input.position,
    games_sampled: gamesSampled,
    routes_pg: toFiniteOrNull(agg?.routesPg),
    targets_pg: toFiniteOrNull(agg?.targetsPg),
    carries_pg: toFiniteOrNull(agg?.carriesPg),
    fantasy_points_ppr_pg: pointsPprPg,
    snap_share: toFiniteOrNull(usageAgg?.snapShare),
    target_share: toFiniteOrNull(usageAgg?.targetShare),
    volatility_index: volatilityIndex,
  } as ScoringPlayerInput;
}

/**
 * The governed result of the rankings input build.
 *
 * `maxRepresentedWeek` is the source-declared evidence extent: the greatest
 * `weekly_stats.week` actually aggregated into these inputs. It is measured
 * from the admitted rows, never taken from a calendar, a clock, or the query
 * ceiling — `throughWeek` is only a filter, and a filter says what was ASKED
 * FOR, not what the source contained. Null when the source held nothing, which
 * must never be rendered as "full season".
 */
export interface RankingsScoringInputsResult {
  players: ScoringPlayerInput[];
  maxRepresentedWeek: number | null;
}

export async function buildRankingsScoringInputs(input: {
  season: number;
  throughWeek: number;
  position: 'QB' | 'RB' | 'WR' | 'TE' | 'ALL';
  limit: number;
}): Promise<RankingsScoringInputsResult> {
  const rows = await db
    .select({
      playerId: weeklyStats.playerId,
      playerName: sql<string>`max(${weeklyStats.playerName})`,
      team: sql<string | null>`max(${weeklyStats.team})`,
      position: sql<string | null>`max(${weeklyStats.position})`,
      gamesSampled: sql<number>`count(*)`,
      routesPg: sql<number>`avg(${weeklyStats.routes})`,
      targetsPg: sql<number>`avg(${weeklyStats.targets})`,
      carriesPg: sql<number>`avg(${weeklyStats.rushAtt})`,
      pointsPprPg: sql<number>`avg(${weeklyStats.fantasyPointsPpr})`,
      // The extent this player's aggregates actually reach, read from the rows
      // themselves so the declared evidence can never exceed the data.
      maxWeek: sql<number | null>`max(${weeklyStats.week})`,
    })
    .from(weeklyStats)
    .where(
      and(
        eq(weeklyStats.season, input.season),
        lte(weeklyStats.week, input.throughWeek),
        input.position === 'ALL' ? sql`true` : eq(weeklyStats.position, input.position),
      ),
    )
    .groupBy(weeklyStats.playerId)
    .orderBy(sql`avg(${weeklyStats.fantasyPointsPpr}) desc`)
    .limit(input.limit);

  const players = rows.map((row) => ({
    player_id: row.playerId,
    player_name: row.playerName,
    team: row.team,
    position: row.position,
    games_sampled: toFiniteOrNull(row.gamesSampled),
    routes_pg: toFiniteOrNull(row.routesPg),
    targets_pg: toFiniteOrNull(row.targetsPg),
    carries_pg: toFiniteOrNull(row.carriesPg),
    fantasy_points_ppr_pg: toFiniteOrNull(row.pointsPprPg),
  })) as ScoringPlayerInput[];

  const weekValues = rows
    .map((row) => toFiniteOrNull(row.maxWeek))
    .filter((week): week is number => week !== null);

  return {
    players,
    maxRepresentedWeek: weekValues.length ? Math.max(...weekValues) : null,
  };
}
