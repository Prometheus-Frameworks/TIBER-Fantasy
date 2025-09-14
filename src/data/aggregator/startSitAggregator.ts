// src/data/aggregator/startSitAggregator.ts
import { PlayerInput } from "../../../server/modules/startSitEngine";
import {
  LivePlayerContext, StartSitLiveQuery, NFLTeam, VolatilityMeta,
  StartSitInputsWithProvenance, StartSitProvenanceData, ProviderPayloads
} from "../interfaces";
import { 
  fetchSleeperUsage, 
  fetchSleeperProjection,
  SleeperUsageWithProvenance,
  SleeperProjectionWithProvenance
} from "../providers/sleeper";
import { fetchOasisMatchup, OasisMatchupWithProvenance } from "../providers/oasis";
import { fetchVegasLine, VegasTeamLineWithProvenance } from "../providers/vegas";
import { fetchNewsSignal, NewsSignalWithProvenance } from "../providers/news";
import { calcWeightedTouches } from "../normalizers/usage";
import { mergeMatchup } from "../normalizers/matchup";
import { normalizeVolatility } from "../normalizers/volatility";
import { normalizeNews } from "../normalizers/news";
import { StudMeta } from "../../modules/studs";

async function buildLiveContext(player: { id: string; position: PlayerInput["position"]; team?: NFLTeam; name?: string }, week?: number): Promise<LivePlayerContext> {
  const [usage, proj, oasis, vegas, news] = await Promise.all([
    fetchSleeperUsage(player.id, week),
    fetchSleeperProjection(player.id, week),
    fetchOasisMatchup(player.team as NFLTeam, player.position),
    player.team ? fetchVegasLine(player.team) : Promise.resolve({} as any),
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
    opponent: (ctx.matchup as any)?.opponent, // <-- surfaces in reasons

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

// Build inputs with provenance tracking for debug mode
async function buildInputsWithProvenance(
  player: { id: string; position: PlayerInput["position"]; team?: NFLTeam; name?: string }, 
  week?: number
): Promise<{ input: PlayerInput; provenance: ProviderPayloads }> {
  // Fetch all provider data with provenance
  const [usage, projections, oasis, vegas, news] = await Promise.all([
    fetchSleeperUsage(player.id, week),
    fetchSleeperProjection(player.id, week),
    fetchOasisMatchup(player.team as NFLTeam, player.position),
    player.team ? fetchVegasLine(player.team) : Promise.resolve({
      team: player.team as NFLTeam,
      opponent: "JAX" as NFLTeam,
      impliedTeamTotal: 22.5,
      weatherImpact: 0.0,
      __source: "no_team_fallback",
      __mock: true,
    } as VegasTeamLineWithProvenance),
    fetchNewsSignal(player.id),
  ]);

  // Build the regular engine input
  const matchup = mergeMatchup(oasis, vegas);
  const volMeta: VolatilityMeta = normalizeVolatility({
    stdevLast5: undefined,
    injuryTag: null,
    committeeRisk: undefined,
    depthChartThreats: undefined,
  });
  const newsNorm = normalizeNews(news);

  const input: PlayerInput = {
    id: player.id,
    name: player.name ?? player.id,
    team: player.team,
    position: player.position,
    opponent: (matchup as any)?.opponent,

    projPoints: projections.projPoints,
    projFloor: projections.floor ?? undefined,
    projCeiling: projections.ceiling ?? undefined,

    // Usage
    snapPct: usage.snapPct,
    routeParticipation: usage.routeParticipation,
    targetShare: usage.targetShare,
    weightedTouches: calcWeightedTouches(usage),
    rzTouches: usage.rzTouches,
    insideTenTouches: usage.insideTenTouches,

    // Matchup
    defRankVsPos: matchup.defRankVsPos,
    oasisMatchupScore: matchup.oasisMatchupScore,
    impliedTeamTotal: matchup.impliedTeamTotal,
    olHealthIndex: matchup.olHealthIndex,
    weatherImpact: matchup.weatherImpact,

    // Volatility / Trust
    stdevLast5: volMeta.stdevLast5,
    injuryTag: volMeta.injuryTag,
    committeeRisk: volMeta.committeeRisk,
    depthChartThreats: volMeta.depthChartThreats,

    // News
    newsHeat: newsNorm.newsHeat,
    ecrDelta: newsNorm.ecrDelta,
  };

  // Capture provenance with type conversion
  const provenance: ProviderPayloads = {
    usage: usage as SleeperUsageWithProvenance,
    projections: projections as SleeperProjectionWithProvenance,
    oasis: oasis as OasisMatchupWithProvenance,
    vegas: vegas as VegasTeamLineWithProvenance,
    news: news as NewsSignalWithProvenance,
  };

  return { input, provenance };
}

export async function buildStartSitInputsWithProvenance(q: StartSitLiveQuery): Promise<StartSitInputsWithProvenance> {
  const [playerAData, playerBData] = await Promise.all([
    buildInputsWithProvenance(q.playerA, q.week),
    buildInputsWithProvenance(q.playerB, q.week),
  ]);

  const provenance: StartSitProvenanceData = {
    playerA: playerAData.provenance,
    playerB: playerBData.provenance,
    timestamp: new Date().toISOString(),
    week: q.week,
  };

  return {
    a: playerAData.input,
    b: playerBData.input,
    provenance,
  };
}

// Build a minimal StudMeta from data you likely already have
export function buildStudMetaFromContext(ctx: any): StudMeta {
  return {
    ourPosRank: ctx.ourPosRank,        // from your rankings service if available
    ecrPosRank: ctx.ecrPosRank,        // optional market
    seasonTgtShare: ctx.seasonTgtShare, // can compute from your stats blob
    seasonRoutePct: ctx.seasonRoutePct,
    yprr: ctx.yprr,
    rushShare: ctx.rushShare,
    wopr: ctx.wopr,
    boomRate: ctx.boomRate,            // compute % of 20+ (or QB 25+) last season + YTD
    top12Rate: ctx.top12Rate,
    draftCapitalScore: ctx.draftCapitalScore, // simple map: R1=90, R2=75, R3=65, Day3=45, UDFA=25
    contractAlpha: ctx.contractAlpha,  // map AAV + guarantees to 0..100
    last4RoleStability: ctx.last4RoleStability // e.g., avg(snap%, routes%, tgtShare%) trend
  };
}