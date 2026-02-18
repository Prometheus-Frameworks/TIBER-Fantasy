import { db } from "../../infra/db";
import { sql, eq, and, gte } from "drizzle-orm";
import {
  idpPlayerWeek,
  idpPlayerSeason,
  idpPositionBaselines,
} from "@shared/schema";
import {
  HAVOC_PRIOR_SNAPS,
  LEADERBOARD_MIN_SNAPS,
  IDP_POSITION_GROUPS,
  IDP_TIERS,
  mapHavocToTier,
  type IdpPositionGroup,
} from "@shared/idpSchema";

interface PositionBaseline {
  meanRate: number;
  stdDev: number;
  sampleSize: number;
}

export async function computePositionBaselines(season: number) {
  const baselines: Record<string, PositionBaseline> = {};

  for (const pg of IDP_POSITION_GROUPS) {
    const rows = await db
      .select({
        totalSnaps: sql<number>`SUM(${idpPlayerWeek.defenseSnaps})`,
        totalHavoc: sql<number>`SUM(${idpPlayerWeek.havocEvents})`,
        playerCount: sql<number>`COUNT(DISTINCT ${idpPlayerWeek.gsisId})`,
      })
      .from(idpPlayerWeek)
      .where(
        and(
          eq(idpPlayerWeek.season, season),
          eq(idpPlayerWeek.positionGroup, pg),
        )
      );

    const totalSnaps = Number(rows[0]?.totalSnaps || 0);
    const totalHavoc = Number(rows[0]?.totalHavoc || 0);
    const playerCount = Number(rows[0]?.playerCount || 0);

    const meanRate = totalSnaps > 0 ? totalHavoc / totalSnaps : 0;

    const perPlayerRates = await db
      .select({
        gsisId: idpPlayerWeek.gsisId,
        snaps: sql<number>`SUM(${idpPlayerWeek.defenseSnaps})`,
        havoc: sql<number>`SUM(${idpPlayerWeek.havocEvents})`,
      })
      .from(idpPlayerWeek)
      .where(
        and(
          eq(idpPlayerWeek.season, season),
          eq(idpPlayerWeek.positionGroup, pg),
        )
      )
      .groupBy(idpPlayerWeek.gsisId);

    const rates = perPlayerRates
      .filter((r) => Number(r.snaps) > 0)
      .map((r) => Number(r.havoc) / Number(r.snaps));

    let stdDev = 0;
    if (rates.length > 1) {
      const variance =
        rates.reduce((sum, r) => sum + (r - meanRate) ** 2, 0) /
        (rates.length - 1);
      stdDev = Math.sqrt(variance);
    }

    baselines[pg] = { meanRate, stdDev, sampleSize: playerCount };

    await db
      .insert(idpPositionBaselines)
      .values({
        season,
        positionGroup: pg,
        metricName: "havoc_rate",
        meanValue: meanRate,
        stdDev: stdDev || 0.01,
        sampleSize: playerCount,
      })
      .onConflictDoUpdate({
        target: [
          idpPositionBaselines.season,
          idpPositionBaselines.positionGroup,
          idpPositionBaselines.metricName,
        ],
        set: {
          meanValue: sql`EXCLUDED.mean_value`,
          stdDev: sql`EXCLUDED.std_dev`,
          sampleSize: sql`EXCLUDED.sample_size`,
          updatedAt: sql`NOW()`,
        },
      });
  }

  return baselines;
}

export async function loadBaselines(
  season: number
): Promise<Record<string, PositionBaseline>> {
  const rows = await db
    .select()
    .from(idpPositionBaselines)
    .where(
      and(
        eq(idpPositionBaselines.season, season),
        eq(idpPositionBaselines.metricName, "havoc_rate")
      )
    );

  const baselines: Record<string, PositionBaseline> = {};
  for (const row of rows) {
    baselines[row.positionGroup] = {
      meanRate: row.meanValue,
      stdDev: row.stdDev,
      sampleSize: row.sampleSize,
    };
  }
  return baselines;
}

export function computeHavocIndex(
  totalHavocEvents: number,
  totalSnaps: number,
  baseline: PositionBaseline
): {
  smoothedRate: number;
  zScore: number;
  havocIndex: number;
  tier: string;
} {
  const priorRate = baseline.meanRate;
  const smoothedRate =
    (totalHavocEvents + HAVOC_PRIOR_SNAPS * priorRate) /
    (totalSnaps + HAVOC_PRIOR_SNAPS);

  const std = baseline.stdDev > 0 ? baseline.stdDev : 0.01;
  const rawZ = (smoothedRate - priorRate) / std;

  const zClamped = Math.max(-3, Math.min(3, rawZ));

  const havocIndex = Math.round(((zClamped + 3) / 6) * 100);
  const clampedIndex = Math.max(0, Math.min(100, havocIndex));

  const tier = mapHavocToTier(clampedIndex);

  return {
    smoothedRate,
    zScore: zClamped,
    havocIndex: clampedIndex,
    tier,
  };
}

export async function aggregateAndScoreSeason(season: number) {
  let baselines = await loadBaselines(season);
  if (Object.keys(baselines).length < IDP_POSITION_GROUPS.length) {
    baselines = await computePositionBaselines(season);
  }

  const playerAggs = await db
    .select({
      gsisId: idpPlayerWeek.gsisId,
      playerName: sql<string>`MAX(${idpPlayerWeek.playerName})`,
      team: sql<string>`MAX(${idpPlayerWeek.team})`,
      nflPosition: sql<string>`MAX(${idpPlayerWeek.nflPosition})`,
      positionGroup: idpPlayerWeek.positionGroup,
      games: sql<number>`COUNT(DISTINCT ${idpPlayerWeek.week})`,
      totalSnaps: sql<number>`COALESCE(SUM(${idpPlayerWeek.defenseSnaps}), 0)`,
      tacklesSolo: sql<number>`COALESCE(SUM(${idpPlayerWeek.tacklesSolo}), 0)`,
      tacklesAssist: sql<number>`COALESCE(SUM(${idpPlayerWeek.tacklesAssist}), 0)`,
      tacklesTotal: sql<number>`COALESCE(SUM(${idpPlayerWeek.tacklesTotal}), 0)`,
      sacks: sql<number>`COALESCE(SUM(${idpPlayerWeek.sacks}), 0)`,
      tacklesForLoss: sql<number>`COALESCE(SUM(${idpPlayerWeek.tacklesForLoss}), 0)`,
      interceptions: sql<number>`COALESCE(SUM(${idpPlayerWeek.interceptions}), 0)`,
      passesDefended: sql<number>`COALESCE(SUM(${idpPlayerWeek.passesDefended}), 0)`,
      forcedFumbles: sql<number>`COALESCE(SUM(${idpPlayerWeek.forcedFumbles}), 0)`,
      fumbleRecoveries: sql<number>`COALESCE(SUM(${idpPlayerWeek.fumbleRecoveries}), 0)`,
      qbHits: sql<number>`SUM(${idpPlayerWeek.qbHits})`,
      pressures: sql<number>`SUM(${idpPlayerWeek.pressures})`,
      totalHavocEvents: sql<number>`COALESCE(SUM(${idpPlayerWeek.havocEvents}), 0)`,
    })
    .from(idpPlayerWeek)
    .where(eq(idpPlayerWeek.season, season))
    .groupBy(idpPlayerWeek.gsisId, idpPlayerWeek.positionGroup);

  let scored = 0;

  for (const p of playerAggs) {
    const baseline = baselines[p.positionGroup];
    if (!baseline) continue;

    const totalSnaps = Number(p.totalSnaps);
    const totalHavoc = Number(p.totalHavocEvents);

    const { smoothedRate, zScore, havocIndex, tier } = computeHavocIndex(
      totalHavoc,
      totalSnaps,
      baseline
    );

    const lowConfidence = totalSnaps < LEADERBOARD_MIN_SNAPS ? 1 : 0;

    const havocRawRate = totalSnaps > 0 ? totalHavoc / totalSnaps : null;

    await db
      .insert(idpPlayerSeason)
      .values({
        gsisId: p.gsisId,
        playerName: p.playerName,
        team: p.team,
        nflPosition: p.nflPosition,
        positionGroup: p.positionGroup,
        season,
        games: Number(p.games),
        totalSnaps,
        tacklesSolo: Number(p.tacklesSolo),
        tacklesAssist: Number(p.tacklesAssist),
        tacklesTotal: Number(p.tacklesTotal),
        sacks: Number(p.sacks),
        tacklesForLoss: Number(p.tacklesForLoss),
        interceptions: Number(p.interceptions),
        passesDefended: Number(p.passesDefended),
        forcedFumbles: Number(p.forcedFumbles),
        fumbleRecoveries: Number(p.fumbleRecoveries),
        qbHits: p.qbHits != null ? Number(p.qbHits) : null,
        pressures: p.pressures != null ? Number(p.pressures) : null,
        totalHavocEvents: totalHavoc,
        havocRawRate: havocRawRate,
        havocSmoothedRate: smoothedRate,
        havocZScore: zScore,
        havocIndex,
        havocTier: tier,
        lowConfidence,
      })
      .onConflictDoUpdate({
        target: [idpPlayerSeason.gsisId, idpPlayerSeason.season],
        set: {
          playerName: sql`EXCLUDED.player_name`,
          team: sql`EXCLUDED.team`,
          nflPosition: sql`EXCLUDED.nfl_position`,
          positionGroup: sql`EXCLUDED.position_group`,
          games: sql`EXCLUDED.games`,
          totalSnaps: sql`EXCLUDED.total_snaps`,
          tacklesSolo: sql`EXCLUDED.tackles_solo`,
          tacklesAssist: sql`EXCLUDED.tackles_assist`,
          tacklesTotal: sql`EXCLUDED.tackles_total`,
          sacks: sql`EXCLUDED.sacks`,
          tacklesForLoss: sql`EXCLUDED.tackles_for_loss`,
          interceptions: sql`EXCLUDED.interceptions`,
          passesDefended: sql`EXCLUDED.passes_defended`,
          forcedFumbles: sql`EXCLUDED.forced_fumbles`,
          fumbleRecoveries: sql`EXCLUDED.fumble_recoveries`,
          qbHits: sql`EXCLUDED.qb_hits`,
          pressures: sql`EXCLUDED.pressures`,
          totalHavocEvents: sql`EXCLUDED.total_havoc_events`,
          havocRawRate: sql`EXCLUDED.havoc_raw_rate`,
          havocSmoothedRate: sql`EXCLUDED.havoc_smoothed_rate`,
          havocZScore: sql`EXCLUDED.havoc_z_score`,
          havocIndex: sql`EXCLUDED.havoc_index`,
          havocTier: sql`EXCLUDED.havoc_tier`,
          lowConfidence: sql`EXCLUDED.low_confidence`,
          updatedAt: sql`NOW()`,
        },
      });

    scored++;
  }

  return { scored, baselines };
}
