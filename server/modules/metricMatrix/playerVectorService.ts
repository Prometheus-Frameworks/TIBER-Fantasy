import fs from "node:fs";
import path from "node:path";
import { and, desc, eq, lte } from "drizzle-orm";
import { db } from "../../infra/db";
import {
  weeklyStats,
  playerUsage,
  metricMatrixPlayerVectors,
} from "@shared/schema";

type AxisConfig = {
  key: string;
  label: string;
  description: string;
  inputs: string[];
  normalization: "minmax" | "percentile";
  weights: Record<string, number>;
  defaults: { value: number; reason: string };
};

type AxisMap = {
  version: string;
  axes: AxisConfig[];
};

export type PlayerVectorRequest = {
  playerId: string;
  season?: number;
  week?: number;
  mode?: "forge";
};

export type PlayerVectorResponse = {
  playerId: string;
  playerName: string | null;
  position: string | null;
  team: string | null;
  season: number | null;
  week: number | null;
  mode: "forge";
  axes: Array<{
    key: string;
    label: string;
    value: number;
    components: Array<{ key: string; value: number | null }>;
  }>;
  confidence: number;
  missingInputs: string[];
};

let cachedAxisMap: AxisMap | null = null;

function loadAxisMap(): AxisMap {
  if (cachedAxisMap) return cachedAxisMap;
  const file = path.join(process.cwd(), "docs", "metric-matrix", "axis_map.json");
  const raw = fs.readFileSync(file, "utf8");
  cachedAxisMap = JSON.parse(raw) as AxisMap;
  return cachedAxisMap;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

type PositionCaps = {
  routesPerGameCap: number;
  touchesPerGameCap: number;
  yardsPerTouchCap: number;
  fpPerTouchCap: number;
  tdsPerGameCap: number;
  tdRateCap: number;
};

const POSITION_CAPS: Record<string, PositionCaps> = {
  WR: {
    routesPerGameCap: 45,
    touchesPerGameCap: 12,
    yardsPerTouchCap: 12,
    fpPerTouchCap: 1.8,
    tdsPerGameCap: 1.5,
    tdRateCap: 0.15,
  },
  RB: {
    routesPerGameCap: 30,
    touchesPerGameCap: 25,
    yardsPerTouchCap: 6,
    fpPerTouchCap: 1.0,
    tdsPerGameCap: 1.5,
    tdRateCap: 0.08,
  },
  TE: {
    routesPerGameCap: 35,
    touchesPerGameCap: 10,
    yardsPerTouchCap: 10,
    fpPerTouchCap: 1.5,
    tdsPerGameCap: 1.0,
    tdRateCap: 0.12,
  },
  QB: {
    routesPerGameCap: 1,
    touchesPerGameCap: 35,
    yardsPerTouchCap: 8,
    fpPerTouchCap: 0.8,
    tdsPerGameCap: 2.5,
    tdRateCap: 0.10,
  },
};

const DEFAULT_CAPS: PositionCaps = POSITION_CAPS.WR;

export { POSITION_CAPS, DEFAULT_CAPS };
export type { PositionCaps };

export function getCapsForPosition(position: string | null): PositionCaps {
  if (!position) return DEFAULT_CAPS;
  const upper = position.toUpperCase();
  return POSITION_CAPS[upper] ?? DEFAULT_CAPS;
}

/**
 * Ensures a percentage value is on 0-100 scale.
 * Auto-detects if value is fraction (0-1) or already percent (0-100).
 * 
 * Rule:
 * - If value <= 1.0, treat as fraction and multiply by 100
 * - If value > 1.0, treat as already percent (0-100)
 * 
 * This guardrail prevents double-scaling issues when data sources
 * may provide percentages in different formats.
 */
export function ensurePercentScale(value: number | null | undefined): number | null {
  if (value == null || Number.isNaN(value)) return null;
  
  if (value <= 1.0) {
    return value * 100;
  }
  return value;
}

export function normalizeMetric(
  metric: string,
  value: number | null | undefined,
  caps: PositionCaps = DEFAULT_CAPS
): number | null {
  if (value == null || Number.isNaN(value)) return null;

  const normalizedByName: Record<string, () => number> = {
    snap_share_pct: () => clamp(value * 100, 0, 100),
    target_share_pct: () => clamp(value * 100, 0, 100),
    routes_per_game: () => clamp((value / caps.routesPerGameCap) * 100, 0, 100),
    touches_per_game: () => clamp((value / caps.touchesPerGameCap) * 100, 0, 100),
    fantasy_points_per_touch: () => clamp((value / caps.fpPerTouchCap) * 100, 0, 100),
    yards_per_touch: () => clamp((value / caps.yardsPerTouchCap) * 100, 0, 100),
    catch_rate: () => clamp(value * 100, 0, 100),
    td_rate: () => clamp((value / caps.tdRateCap) * 100, 0, 100),
    tds_per_game: () => clamp((value / caps.tdsPerGameCap) * 100, 0, 100),
    high_leverage_usage: () => clamp((value / caps.tdRateCap) * 100, 0, 100),
    availability: () => clamp(value * 100, 0, 100),
    fp_consistency: () => clamp(100 - clamp(value, 0, 8) * 10, 20, 100),
    sample_size: () => clamp(value * 100, 0, 100),
    recent_usage_trend: () => clamp(50 + value * 200, 0, 100),
    role_security: () => clamp(value * 100, 0, 100),
  };

  return normalizedByName[metric]?.() ?? clamp(value, 0, 100);
}

export function computeStdDev(values: number[]): number {
  if (!values.length) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, val) => sum + (val - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

async function fetchPlayerStats(playerId: string, season: number, week?: number) {
  const weeklyConditions = [eq(weeklyStats.playerId, playerId), eq(weeklyStats.season, season)];
  if (week) weeklyConditions.push(lte(weeklyStats.week, week));

  const usageConditions = [eq(playerUsage.playerId, playerId), eq(playerUsage.season, season)];
  if (week) usageConditions.push(lte(playerUsage.week, week));

  const [weeklyRows, usageRows] = await Promise.all([
    db
      .select()
      .from(weeklyStats)
      .where(and(...weeklyConditions))
      .orderBy(weeklyStats.week),
    db
      .select()
      .from(playerUsage)
      .where(and(...usageConditions))
      .orderBy(playerUsage.week),
  ]);

  return { weeklyRows, usageRows };
}

type WeeklyRow = typeof weeklyStats.$inferSelect;
type UsageRow = typeof playerUsage.$inferSelect;

export type DeriveMetricsContext = {
  resolvedWeek: number | null;
  position: string | null;
};

function deriveRawMetrics(
  weeklyRows: WeeklyRow[],
  usageRows: UsageRow[],
  ctx: DeriveMetricsContext = { resolvedWeek: null, position: null }
) {
  const games = weeklyRows.length;
  const totalSnaps = weeklyRows.reduce((sum, w) => sum + (w.snaps ?? 0), 0);
  const totalRoutes = weeklyRows.reduce((sum, w) => sum + (w.routes ?? 0), 0);
  const totalTargets = weeklyRows.reduce((sum, w) => sum + (w.targets ?? 0), 0);
  const totalRushAtt = weeklyRows.reduce((sum, w) => sum + (w.rushAtt ?? 0), 0);
  const totalTouches = totalRushAtt + weeklyRows.reduce((sum, w) => sum + (w.rec ?? 0), 0);
  const totalRec = weeklyRows.reduce((sum, w) => sum + (w.rec ?? 0), 0);
  const totalRecYd = weeklyRows.reduce((sum, w) => sum + (w.recYd ?? 0), 0);
  const totalRushYd = weeklyRows.reduce((sum, w) => sum + (w.rushYd ?? 0), 0);
  const totalRecTd = weeklyRows.reduce((sum, w) => sum + (w.recTd ?? 0), 0);
  const totalRushTd = weeklyRows.reduce((sum, w) => sum + (w.rushTd ?? 0), 0);
  const totalTd = totalRecTd + totalRushTd;
  const totalFp = weeklyRows.reduce((sum, w) => sum + (w.fantasyPointsPpr ?? 0), 0);
  const fpPerWeek = weeklyRows.map((w) => w.fantasyPointsPpr ?? 0);

  const nonNullSnapRows = usageRows.filter((u) => u.snapSharePct != null);
  const avgSnapShare = nonNullSnapRows.length > 0
    ? nonNullSnapRows.reduce((sum, u) => sum + (u.snapSharePct as number), 0) / nonNullSnapRows.length / 100
    : null;

  const nonNullTargetRows = usageRows.filter((u) => u.targetSharePct != null);
  const avgTargetShare = nonNullTargetRows.length > 0
    ? nonNullTargetRows.reduce((sum, u) => sum + (u.targetSharePct as number), 0) / nonNullTargetRows.length / 100
    : null;

  const recentTrend = (() => {
    if (nonNullSnapRows.length < 2) return null;
    const last3 = nonNullSnapRows.slice(-3);
    const first3 = nonNullSnapRows.slice(0, 3);
    const lastAvg = last3.reduce((s, u) => s + (u.snapSharePct as number), 0) / last3.length / 100;
    const firstAvg = first3.reduce((s, u) => s + (u.snapSharePct as number), 0) / first3.length / 100;
    return lastAvg - firstAvg;
  })();

  const rawMetrics: Record<string, number | null> = {
    snap_share_pct: avgSnapShare,
    routes_per_game: games ? totalRoutes / games : null,
    touches_per_game: games ? totalTouches / games : null,
    fantasy_points_per_touch: totalTouches > 0 ? totalFp / totalTouches : null,
    yards_per_touch: totalTouches > 0 ? (totalRecYd + totalRushYd) / totalTouches : null,
    catch_rate: totalTargets > 0 ? totalRec / totalTargets : null,
    td_rate: totalTouches > 0 ? totalTd / totalTouches : null,
    tds_per_game: games ? totalTd / games : null,
    high_leverage_usage: totalTouches > 0 ? totalTd / totalTouches : null,
    availability: games
      ? games / clamp(ctx.resolvedWeek ?? games, 1, 18)
      : null,
    fp_consistency: fpPerWeek.length ? computeStdDev(fpPerWeek) : null,
    sample_size: games ? clamp(games / 6, 0, 1) : null,
    target_share_pct: avgTargetShare,
    recent_usage_trend: recentTrend,
    role_security: avgSnapShare,
  };

  return rawMetrics;
}

function buildAxes(
  rawMetrics: Record<string, number | null>,
  axisMap: AxisMap,
  caps: PositionCaps = DEFAULT_CAPS
) {
  const missingInputs: string[] = [];

  const axes = axisMap.axes.map((axis) => {
    const components = axis.inputs.map((inputKey) => {
      const normalized = normalizeMetric(inputKey, rawMetrics[inputKey], caps);
      if (normalized == null) missingInputs.push(inputKey);
      return { key: inputKey, value: normalized };
    });

    const weighted = components.reduce((sum, comp) => {
      const weight = axis.weights[comp.key] ?? 0;
      const value = comp.value ?? axis.defaults.value;
      return sum + weight * value;
    }, 0);

    const normalizedWeightSum = Object.values(axis.weights).reduce((a, b) => a + b, 0) || 1;
    const value = clamp(weighted / normalizedWeightSum, 0, 100);

    return {
      key: axis.key,
      label: axis.label,
      value,
      components,
    };
  });

  const uniqueMissing = Array.from(new Set(missingInputs));
  const availableCount =
    axisMap.axes.reduce((sum, axis) => sum + axis.inputs.length, 0) - uniqueMissing.length;
  const totalInputs = axisMap.axes.reduce((sum, axis) => sum + axis.inputs.length, 0);
  const confidence = totalInputs > 0 ? clamp(availableCount / totalInputs, 0, 1) : 0;

  return { axes, missingInputs: uniqueMissing, confidence };
}

async function readCachedVector(playerId: string, season: number, week: number, mode: "forge") {
  const conditions = [
    eq(metricMatrixPlayerVectors.playerId, playerId),
    eq(metricMatrixPlayerVectors.mode, mode),
  ];

  conditions.push(eq(metricMatrixPlayerVectors.season, season));
  conditions.push(eq(metricMatrixPlayerVectors.week, week));

  const result = await db
    .select()
    .from(metricMatrixPlayerVectors)
    .where(and(...conditions))
    .limit(1);

  return result[0];
}

async function writeCachedVector(payload: PlayerVectorResponse) {
  try {
    const season = payload.season ?? 0;
    const week = payload.week ?? 0;
    await db
      .insert(metricMatrixPlayerVectors)
      .values({
        playerId: payload.playerId,
        season,
        week,
        mode: payload.mode,
        axesJson: payload.axes,
        confidence: payload.confidence,
        missingInputs: payload.missingInputs,
        computedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [metricMatrixPlayerVectors.playerId, metricMatrixPlayerVectors.season, metricMatrixPlayerVectors.week, metricMatrixPlayerVectors.mode],
        set: {
          axesJson: payload.axes,
          confidence: payload.confidence,
          missingInputs: payload.missingInputs,
          computedAt: new Date(),
        },
      });
  } catch (error) {
    console.warn("[MetricMatrix] Failed to write cache (non-fatal):", error);
  }
}

export async function getPlayerVector(
  params: PlayerVectorRequest,
): Promise<PlayerVectorResponse> {
  const mode = params.mode ?? "forge";
  const axisMap = loadAxisMap();

  if (!params.playerId) {
    throw new Error("playerId is required");
  }

  // Detect season/week if not provided
  let resolvedSeason = params.season ?? null;
  let resolvedWeek = params.week ?? null;

  if (resolvedSeason === null || resolvedWeek === null) {
    const latest = await db
      .select()
      .from(weeklyStats)
      .where(eq(weeklyStats.playerId, params.playerId))
      .orderBy(desc(weeklyStats.season), desc(weeklyStats.week))
      .limit(1);

    if (latest[0]) {
      resolvedSeason = resolvedSeason ?? latest[0].season;
      resolvedWeek = resolvedWeek ?? latest[0].week;
    }
  }

  const cacheSeason = resolvedSeason ?? 0;
  const cacheWeek = resolvedWeek ?? 0;
  const cache = await readCachedVector(params.playerId, cacheSeason, cacheWeek, mode);
  if (cache) {
    const latest = await db
      .select({
        playerName: weeklyStats.playerName,
        position: weeklyStats.position,
        team: weeklyStats.team,
      })
      .from(weeklyStats)
      .where(eq(weeklyStats.playerId, params.playerId))
      .orderBy(desc(weeklyStats.season), desc(weeklyStats.week))
      .limit(1);

    return {
      playerId: params.playerId,
      playerName: latest[0]?.playerName ?? null,
      position: latest[0]?.position ?? null,
      team: latest[0]?.team ?? null,
      season: resolvedSeason,
      week: resolvedWeek,
      mode,
      axes: cache.axesJson as PlayerVectorResponse["axes"],
      confidence: cache.confidence ?? 0,
      missingInputs: cache.missingInputs ?? [],
    };
  }

  if (resolvedSeason === null) {
    throw new Error("Unable to resolve season for player");
  }

  const { weeklyRows, usageRows } = await fetchPlayerStats(params.playerId, resolvedSeason, resolvedWeek ?? undefined);
  const position = weeklyRows[0]?.position ?? null;
  const caps = getCapsForPosition(position);
  const rawMetrics = deriveRawMetrics(weeklyRows, usageRows, { resolvedWeek, position });
  const { axes, missingInputs, confidence } = buildAxes(rawMetrics, axisMap, caps);

  const playerName = weeklyRows[0]?.playerName ?? null;
  const team = weeklyRows[0]?.team ?? null;

  const response: PlayerVectorResponse = {
    playerId: params.playerId,
    playerName,
    position,
    team,
    season: resolvedSeason,
    week: resolvedWeek,
    mode,
    axes,
    confidence,
    missingInputs,
  };

  await writeCachedVector(response);

  return response;
}
