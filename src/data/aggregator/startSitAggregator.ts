// src/data/aggregator/startSitAggregator.ts
import { PlayerInput } from "../../../server/modules/startSitEngine";
import {
  LivePlayerContext, StartSitLiveQuery, NFLTeam, VolatilityMeta
} from "../interfaces";
import { fetchSleeperUsage, fetchSleeperProjection } from "../providers/sleeper";
import { fetchOasisMatchup } from "../providers/oasis";
import { fetchVegasLine } from "../providers/vegas";
import { fetchNewsSignal } from "../providers/news";
import { calcWeightedTouches } from "../normalizers/usage";
import { mergeMatchup } from "../normalizers/matchup";
import { normalizeVolatility } from "../normalizers/volatility";
import { normalizeNews } from "../normalizers/news";

async function buildLiveContext(player: { id: string; position: PlayerInput["position"]; team?: NFLTeam; name?: string }, week?: number): Promise<LivePlayerContext> {
  const [usage, proj, oasis, vegas, news] = await Promise.all([
    fetchSleeperUsage(player.id, week),
    fetchSleeperProjection(player.id, week),
    fetchOasisMatchup(player.team as NFLTeam, player.position),
    player.team ? fetchVegasLine(player.team) : Promise.resolve({ team: undefined as any, opponent: undefined as any }),
    fetchNewsSignal(player.id),
  ]);

  const matchup = mergeMatchup(oasis, vegas);
  const volMeta: VolatilityMeta = normalizeVolatility({
    // You'll likely compute stdev from last 5 games via your stats service
    stdevLast5: undefined,
    injuryTag: null,         // wire to your injury feed
    committeeRisk: undefined, // wire from depth/usage heuristics
    depthChartThreats: undefined, // wire from target competition calc
  });

  const newsNorm = normalizeNews(news);

  return {
    id: player.id,
    name: player.name ?? player.id,
    position: player.position,
    team: player.team,
    projPoints: proj.projPoints,
    projFloor: proj.floor ?? null,
    projCeiling: proj.ceiling ?? null,
    usage: {
      ...usage,
      rzTouches: usage.rzTouches ?? 0,
      insideTenTouches: usage.insideTenTouches ?? 0,
    },
    matchup,
    volatility: volMeta,
    news: newsNorm,
  };
}

export async function toEngineInput(player: { id: string; position: PlayerInput["position"]; team?: NFLTeam; name?: string }, week?: number): Promise<PlayerInput> {
  const ctx = await buildLiveContext(player, week);

  return {
    id: ctx.id,
    name: ctx.name,
    team: ctx.team,
    position: ctx.position,

    projPoints: ctx.projPoints,
    projFloor: ctx.projFloor ?? undefined,
    projCeiling: ctx.projCeiling ?? undefined,

    // Usage
    snapPct: ctx.usage.snapPct,
    routeParticipation: ctx.usage.routeParticipation,
    targetShare: ctx.usage.targetShare,
    weightedTouches: calcWeightedTouches(ctx.usage),
    rzTouches: ctx.usage.rzTouches,
    insideTenTouches: ctx.usage.insideTenTouches,

    // Matchup
    defRankVsPos: ctx.matchup.defRankVsPos,
    oasisMatchupScore: ctx.matchup.oasisMatchupScore,
    impliedTeamTotal: ctx.matchup.impliedTeamTotal,
    olHealthIndex: ctx.matchup.olHealthIndex,
    weatherImpact: ctx.matchup.weatherImpact,

    // Volatility / Trust
    stdevLast5: ctx.volatility.stdevLast5,
    injuryTag: ctx.volatility.injuryTag,
    committeeRisk: ctx.volatility.committeeRisk,
    depthChartThreats: ctx.volatility.depthChartThreats,

    // News
    newsHeat: ctx.news.newsHeat,
    ecrDelta: ctx.news.ecrDelta,
  };
}

export async function buildStartSitInputs(q: StartSitLiveQuery) {
  const [a, b] = await Promise.all([
    toEngineInput(q.playerA, q.week),
    toEngineInput(q.playerB, q.week),
  ]);
  return { a, b };
}