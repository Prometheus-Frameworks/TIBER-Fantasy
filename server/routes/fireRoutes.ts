import { Router, type Request, type Response } from "express";
import { sql } from "drizzle-orm";
import { db } from "../infra/db";

const router = Router();

type Position = "RB" | "WR" | "TE";
const SUPPORTED_POSITIONS: Position[] = ["RB", "WR", "TE"];

type Confidence = "HIGH" | "MED" | "LOW";

const SNAP_THRESHOLDS: Record<Position, number> = { RB: 50, WR: 80, TE: 80 };

interface RollingRow {
  player_id: string;
  player_name: string | null;
  position: Position;
  team: string | null;
  snaps_r: number | null;
  snap_avg: number | null;
  targets_r: number | null;
  target_avg: number | null;
  routes_r: number | null;
  route_avg: number | null;
  carries_r: number | null;
  rz_avg: number | null;
  xfp_r: number | null;
  xfpgoe_r: number | null;
  window_games_played: number;
  weeks_present: number[] | null;
}

interface FirePlayer {
  playerId: string;
  playerName: string | null;
  team: string | null;
  position: Position;
  season: number;
  weekAnchor: number;
  rollingWeeks: number[];
  eligible: boolean;
  fireScore: number | null;
  windowGamesPlayed: number;
  games_played_window: number;
  weeks_present: number[];
  confidence: Confidence;
  pillars: { opportunity: number | null; role: number | null; conversion: number | null };
  raw: {
    xfp_R: number | null;
    xfpgoe_R: number | null;
    snaps_R: number | null;
    snap_avg: number | null;
    target_avg: number | null;
    route_avg: number | null;
    carries_R: number | null;
    rz_avg: number | null;
  };
  roleMeta: {
    targetSource: "target_share" | "targets_per_snap" | "targets_per_route" | "none";
    routeSource: "route_participation" | "routes" | "none";
    redistributedRouteWeight: boolean;
    usedColumns: string[];
  };
}

function percentileRank(sortedVals: number[], value: number): number {
  if (sortedVals.length <= 1) return 50;
  let lessCount = 0;
  let equalCount = 0;
  for (const v of sortedVals) {
    if (v < value) lessCount += 1;
    else if (v === value) equalCount += 1;
  }
  const p = (lessCount + (equalCount - 1) / 2) / (sortedVals.length - 1);
  return Math.max(0, Math.min(100, p * 100));
}

function mean(vals: Array<number | null | undefined>): number | null {
  const filtered = vals.filter((v): v is number => Number.isFinite(v as number));
  if (!filtered.length) return null;
  return filtered.reduce((a, b) => a + b, 0) / filtered.length;
}

function stdev(vals: number[]): number {
  if (vals.length <= 1) return 0;
  const m = vals.reduce((a, b) => a + b, 0) / vals.length;
  const variance = vals.reduce((acc, v) => acc + (v - m) ** 2, 0) / vals.length;
  return Math.sqrt(variance);
}

async function fetchRollingRows(season: number, week: number, position?: Position, playerIds?: string[]): Promise<{ rows: RollingRow[]; rollingWeeks: number[] }> {
  const weekStart = Math.max(1, week - 3);
  const where: any[] = [sql`season = ${season}`, sql`week BETWEEN ${weekStart} AND ${week}`, sql`position IN ('RB','WR','TE')`];
  if (position) where.push(sql`position = ${position}`);
  if (playerIds?.length) where.push(sql`player_id = ANY(${playerIds})`);

  const rollingWeeksResult = await db.execute(sql`
    SELECT DISTINCT week
    FROM fantasy_metrics_weekly_mv
    WHERE ${sql.join(where, sql` AND `)}
    ORDER BY week ASC
  `);

  const rowsResult = await db.execute(sql`
    SELECT
      player_id,
      MAX(player_name) AS player_name,
      MAX(position)::text AS position,
      MAX(team) AS team,
      SUM(COALESCE(snaps, 0))::real AS snaps_r,
      AVG(snap_share)::real AS snap_avg,
      SUM(COALESCE(targets, 0))::real AS targets_r,
      AVG(target_share)::real AS target_avg,
      SUM(COALESCE(routes, 0))::real AS routes_r,
      AVG(route_participation)::real AS route_avg,
      SUM(COALESCE(carries, 0))::real AS carries_r,
      AVG(red_zone_touches)::real AS rz_avg,
      SUM(x_ppr_v2)::real AS xfp_r,
      SUM(xfpgoe_ppr_v2)::real AS xfpgoe_r,
      COUNT(DISTINCT CASE WHEN COALESCE(snaps,0) > 0 OR COALESCE(targets,0) + COALESCE(carries,0) > 0 THEN week END)::int AS window_games_played,
      ARRAY_AGG(DISTINCT week ORDER BY week) FILTER (
        WHERE COALESCE(snaps, 0) > 0
          OR (snaps IS NULL AND (COALESCE(targets, 0) + COALESCE(carries, 0)) > 0)
      )::int[] AS weeks_present
    FROM fantasy_metrics_weekly_mv
    WHERE ${sql.join(where, sql` AND `)}
    GROUP BY player_id
  `);

  return {
    rows: rowsResult.rows as unknown as RollingRow[],
    rollingWeeks: (rollingWeeksResult.rows as any[]).map((r) => Number(r.week)).filter(Number.isFinite),
  };
}

function computeConfidence(pos: Position, snapsR: number, gamesPlayed: number, routeSource: string): Confidence {
  const threshold = SNAP_THRESHOLDS[pos];
  if (gamesPlayed <= 2 || snapsR < threshold * 1.05) return "LOW";
  if (gamesPlayed >= 4 && snapsR >= threshold * 1.5 && routeSource !== "none") return "HIGH";
  if (gamesPlayed >= 3 && snapsR >= threshold) return "MED";
  return "LOW";
}

function buildFire(rows: RollingRow[], season: number, week: number, rollingWeeks: number[]): FirePlayer[] {
  const basePlayers: FirePlayer[] = rows.map((row) => {
    const targetShare = row.target_avg;
    const routesR = row.routes_r;
    const snapsR = row.snaps_r;
    const targetsR = row.targets_r;
    const routePart = row.route_avg;

    let targetSource: FirePlayer["roleMeta"]["targetSource"] = "none";
    let targetComponent: number | null = null;
    if (targetShare != null) {
      targetSource = "target_share";
      targetComponent = targetShare;
    } else if ((snapsR ?? 0) > 0 && targetsR != null) {
      targetSource = "targets_per_snap";
      targetComponent = targetsR / Math.max(snapsR as number, 1);
    } else if ((routesR ?? 0) > 0 && targetsR != null) {
      targetSource = "targets_per_route";
      targetComponent = targetsR / Math.max(routesR as number, 1);
    }

    let routeSource: FirePlayer["roleMeta"]["routeSource"] = "none";
    let routeComponent: number | null = null;
    if (routePart != null) {
      routeSource = "route_participation";
      routeComponent = routePart;
    } else if (routesR != null) {
      routeSource = "routes";
      routeComponent = routesR;
    }

    const eligible = row.position === "RB"
      ? (row.snaps_r ?? 0) >= 50
      : (row.snaps_r ?? 0) >= 80;

    const gamesPlayed = Number(row.window_games_played) || 0;
    const weeksPresent = (row.weeks_present ?? []).map((w: any) => Number(w)).filter((w: number) => Number.isFinite(w)).sort((a: number, b: number) => a - b);
    const confidence = computeConfidence(row.position, snapsR ?? 0, gamesPlayed, routeSource);

    return {
      playerId: row.player_id,
      playerName: row.player_name,
      team: row.team,
      position: row.position,
      season,
      weekAnchor: week,
      rollingWeeks,
      eligible,
      fireScore: null,
      windowGamesPlayed: gamesPlayed,
      games_played_window: gamesPlayed,
      weeks_present: weeksPresent,
      confidence,
      pillars: { opportunity: null, role: null, conversion: null },
      raw: {
        xfp_R: row.xfp_r,
        xfpgoe_R: row.xfpgoe_r,
        snaps_R: row.snaps_r,
        snap_avg: row.snap_avg,
        target_avg: row.target_avg,
        route_avg: row.route_avg,
        carries_R: row.carries_r,
        rz_avg: row.rz_avg,
      },
      roleMeta: {
        targetSource,
        routeSource,
        redistributedRouteWeight: false,
        usedColumns: [],
      },
    };
  });

  for (const position of SUPPORTED_POSITIONS) {
    const pool = basePlayers.filter((p) => p.position === position && p.eligible);
    if (!pool.length) continue;

    const oppValues = pool.map((p) => p.raw.xfp_R ?? 0).sort((a, b) => a - b);
    const convValues = pool.map((p) => p.raw.xfpgoe_R ?? 0).sort((a, b) => a - b);

    const roleIndexRaw: number[] = [];
    const roleMap = new Map<string, number>();

    for (const p of pool) {
      const isRB = p.position === "RB";
      let wRoute = isRB ? 0 : 0.35;
      let wTarget = isRB ? 0.25 : 0.35;
      let wSnap = isRB ? 0.25 : 0.20;
      const wRz = isRB ? 0.15 : 0.10;
      const wCarries = isRB ? 0.35 : 0;

      if (!isRB && p.roleMeta.routeSource === "none") {
        p.roleMeta.redistributedRouteWeight = true;
        wTarget += 0.20;
        wSnap += 0.15;
        wRoute = 0;
      }

      const targetComp = p.roleMeta.targetSource === "target_share"
        ? p.raw.target_avg
        : p.roleMeta.targetSource === "targets_per_snap"
        ? ((p.raw.target_avg ?? 0) || ((p.raw.snaps_R ?? 0) > 0 ? (rows.find(r => r.player_id === p.playerId)?.targets_r ?? 0) / Math.max(p.raw.snaps_R ?? 1, 1) : 0))
        : p.roleMeta.targetSource === "targets_per_route"
        ? ((rows.find(r => r.player_id === p.playerId)?.targets_r ?? 0) / Math.max((rows.find(r => r.player_id === p.playerId)?.routes_r ?? 1), 1))
        : null;

      const routeComp = p.roleMeta.routeSource === "route_participation" ? p.raw.route_avg : rows.find(r => r.player_id === p.playerId)?.routes_r ?? null;
      const snapComp = p.raw.snap_avg;
      const rzComp = p.raw.rz_avg;
      const carriesComp = p.raw.carries_R;

      const roleNumerator =
        (wRoute > 0 && routeComp != null ? wRoute * routeComp : 0) +
        (wTarget > 0 && targetComp != null ? wTarget * targetComp : 0) +
        (wSnap > 0 && snapComp != null ? wSnap * snapComp : 0) +
        (wRz > 0 && rzComp != null ? wRz * rzComp : 0) +
        (wCarries > 0 && carriesComp != null ? wCarries * carriesComp : 0);

      const weightDenominator =
        (wRoute > 0 && routeComp != null ? wRoute : 0) +
        (wTarget > 0 && targetComp != null ? wTarget : 0) +
        (wSnap > 0 && snapComp != null ? wSnap : 0) +
        (wRz > 0 && rzComp != null ? wRz : 0) +
        (wCarries > 0 && carriesComp != null ? wCarries : 0);

      const roleRaw = weightDenominator > 0 ? roleNumerator / weightDenominator : 0;
      roleMap.set(p.playerId, roleRaw);
      roleIndexRaw.push(roleRaw);

      const used = [] as string[];
      if (routeComp != null && wRoute > 0) used.push(p.roleMeta.routeSource === "route_participation" ? "route_participation" : "routes");
      if (targetComp != null && wTarget > 0) used.push(p.roleMeta.targetSource);
      if (snapComp != null && wSnap > 0) used.push("snap_share");
      if (rzComp != null && wRz > 0) used.push("red_zone_touches");
      if (carriesComp != null && wCarries > 0) used.push("carries");
      p.roleMeta.usedColumns = used;
    }

    const sortedRole = roleIndexRaw.sort((a, b) => a - b);

    for (const p of pool) {
      const opp = percentileRank(oppValues, p.raw.xfp_R ?? 0);
      const conv = percentileRank(convValues, p.raw.xfpgoe_R ?? 0);
      const role = percentileRank(sortedRole, roleMap.get(p.playerId) ?? 0);
      p.pillars = { opportunity: opp, conversion: conv, role };
      p.fireScore = 0.6 * opp + 0.25 * role + 0.15 * conv;
    }
  }

  return basePlayers;
}

function parsePlayerIds(raw: unknown): string[] | undefined {
  if (typeof raw !== "string" || !raw.trim()) return undefined;
  return raw.split(",").map((v) => v.trim()).filter(Boolean);
}

router.get('/fire/eg/batch', async (req: Request, res: Response) => {
  try {
    const season = Number(req.query.season);
    const week = Number(req.query.week);
    const position = typeof req.query.position === "string" ? req.query.position.toUpperCase() as Position : undefined;
    const playerIds = parsePlayerIds(req.query.playerIds);

    if (!Number.isInteger(season) || !Number.isInteger(week)) {
      return res.status(400).json({ error: 'season and week are required integers' });
    }
    if (position && !SUPPORTED_POSITIONS.includes(position)) {
      return res.status(400).json({ error: 'position must be RB, WR, or TE' });
    }

    const { rows, rollingWeeks } = await fetchRollingRows(season, week, position, playerIds);
    const data = buildFire(rows, season, week, rollingWeeks);

    return res.json({
      metadata: {
        season,
        weekAnchor: week,
        rollingWeeks,
        positions: position ? [position] : SUPPORTED_POSITIONS,
        eligibilityThresholds: { RB: 50, WR: 80, TE: 80 },
        notes: ['QB FIRE not available yet (QB xFP gap).'],
      },
      data,
    });
  } catch (error: any) {
    console.error('[FIRE] batch error', error);
    return res.status(500).json({ error: error?.message ?? 'Unknown error' });
  }
});

router.get('/fire/eg/player', async (req: Request, res: Response) => {
  try {
    const season = Number(req.query.season);
    const week = Number(req.query.week);
    const playerId = String(req.query.playerId || '').trim();

    if (!playerId || !Number.isInteger(season) || !Number.isInteger(week)) {
      return res.status(400).json({ error: 'playerId, season, and week are required' });
    }

    const { rows: rowLookup } = await fetchRollingRows(season, week, undefined, [playerId]);
    const pos = rowLookup[0]?.position;
    if (!pos || !SUPPORTED_POSITIONS.includes(pos)) {
      return res.json({
        playerId,
        season,
        weekAnchor: week,
        eligible: false,
        fireScore: null,
        notes: ['Player not found in RB/WR/TE weekly MV window or QB FIRE unavailable.'],
      });
    }

    const { rows, rollingWeeks } = await fetchRollingRows(season, week, pos, undefined);
    const data = buildFire(rows, season, week, rollingWeeks);
    const found = data.find((p) => p.playerId === playerId);

    return res.json(found ?? { playerId, season, weekAnchor: week, eligible: false, fireScore: null });
  } catch (error: any) {
    console.error('[FIRE] player error', error);
    return res.status(500).json({ error: error?.message ?? 'Unknown error' });
  }
});

router.get('/delta/eg/batch', async (req: Request, res: Response) => {
  try {
    const season = Number(req.query.season);
    const week = Number(req.query.week);
    const position = typeof req.query.position === "string" ? req.query.position.toUpperCase() as Position : undefined;
    const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 500);
    const offset = Math.max(Number(req.query.offset) || 0, 0);

    if (!Number.isInteger(season) || !Number.isInteger(week)) {
      return res.status(400).json({ error: 'season and week are required integers' });
    }
    if (position && !SUPPORTED_POSITIONS.includes(position)) {
      return res.status(400).json({ error: 'position must be RB, WR, or TE' });
    }

    const mode = typeof req.query.mode === "string" ? req.query.mode.toLowerCase() : "redraft";
    const positions = position ? [position] : SUPPORTED_POSITIONS;
    const allRows: any[] = [];

    const forgeWhere = [
      sql`season = ${season}`,
      sql`position IN ('RB','WR','TE')`,
    ];
    if (position) forgeWhere.push(sql`position = ${position}`);

    const hasVersionCol = await db.execute(sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'forge_grade_cache' AND column_name = 'version'
      LIMIT 1
    `);
    if (hasVersionCol.rows.length > 0) {
      const versionValues = await db.execute(sql`SELECT DISTINCT version FROM forge_grade_cache WHERE version IS NOT NULL LIMIT 10`);
      const versions = (versionValues.rows as any[]).map((r: any) => r.version);
      if (versions.length === 1 && versions[0] === "v1") {
        forgeWhere.push(sql`version = 'v1'`);
      } else if (versions.includes(mode)) {
        forgeWhere.push(sql`(version IS NULL OR version = ${mode})`);
      }
    }

    const forgeCacheRows = await db.execute(sql`
      SELECT player_id, position, alpha, player_name, nfl_team
      FROM forge_grade_cache
      WHERE ${sql.join(forgeWhere, sql` AND `)}
      ORDER BY alpha DESC
    `);
    const forgeById = new Map(
      (forgeCacheRows.rows as any[]).map((r: any) => [r.player_id, { playerId: r.player_id, alpha: Number(r.alpha) }])
    );

    for (const pos of positions) {
      const { rows, rollingWeeks } = await fetchRollingRows(season, week, pos, undefined);
      const fireRows = buildFire(rows, season, week, rollingWeeks).filter((p) => p.eligible && p.fireScore != null);
      if (!fireRows.length) continue;

      const fireByPos = fireRows;

      const posMedianTargets = mean(fireByPos.map(p => p.raw.target_avg).filter((v): v is number => v != null));
      const posMedianRoutes = mean(fireByPos.map(p => p.raw.route_avg).filter((v): v is number => v != null));
      const posMedianSnaps = mean(fireByPos.map(p => p.raw.snap_avg).filter((v): v is number => v != null));

      const joined = fireRows
        .map((fire) => {
          const f = forgeById.get(fire.playerId);
          if (!f) return null;
          return {
            playerId: fire.playerId,
            playerName: fire.playerName,
            team: fire.team,
            position: pos,
            season,
            weekAnchor: week,
            alpha: f.alpha,
            fireScore: Number(fire.fireScore),
            confidence: fire.confidence,
            windowGamesPlayed: fire.windowGamesPlayed,
            xfpR: fire.raw.xfp_R,
            snapsR: fire.raw.snaps_R,
            targetAvg: fire.raw.target_avg,
            routeAvg: fire.raw.route_avg,
            snapAvg: fire.raw.snap_avg,
            rollingWeeks,
          };
        })
        .filter(Boolean) as Array<{
          playerId: string; playerName: string | null; team: string | null; position: Position;
          season: number; weekAnchor: number; alpha: number; fireScore: number;
          confidence: Confidence; windowGamesPlayed: number;
          xfpR: number | null; snapsR: number | null; targetAvg: number | null;
          routeAvg: number | null; snapAvg: number | null; rollingWeeks: number[];
        }>;

      const alphaVals = joined.map((j) => j.alpha);
      const fireVals = joined.map((j) => j.fireScore);
      const alphaSorted = [...alphaVals].sort((a, b) => a - b);
      const fireSorted = [...fireVals].sort((a, b) => a - b);
      const alphaMean = mean(alphaVals) ?? 0;
      const fireMean = mean(fireVals) ?? 0;
      const alphaStd = stdev(alphaVals) || 1;
      const fireStd = stdev(fireVals) || 1;

      for (const row of joined) {
        const forgePct = percentileRank(alphaSorted, row.alpha);
        const firePct = percentileRank(fireSorted, row.fireScore);
        const forgeZ = (row.alpha - alphaMean) / alphaStd;
        const fireZ = (row.fireScore - fireMean) / fireStd;
        const rankZ = forgeZ - fireZ;
        const displayPct = forgePct - firePct;

        const conf = row.confidence;
        const direction = rankZ >= 1 || (displayPct >= 20 && conf !== 'LOW')
          ? 'BUY_LOW'
          : rankZ <= -1 || (displayPct <= -20 && conf !== 'LOW')
          ? 'SELL_HIGH'
          : 'NEUTRAL';

        let topRoleDriver: string | null = null;
        if (posMedianTargets != null && row.targetAvg != null && row.targetAvg < posMedianTargets * 0.7) {
          topRoleDriver = "targets down";
        } else if (posMedianRoutes != null && row.routeAvg != null && row.routeAvg < posMedianRoutes * 0.7) {
          topRoleDriver = "routes down";
        } else if (posMedianSnaps != null && row.snapAvg != null && row.snapAvg < posMedianSnaps * 0.7) {
          topRoleDriver = "snap share down";
        } else if (posMedianTargets != null && row.targetAvg != null && row.targetAvg > posMedianTargets * 1.3) {
          topRoleDriver = "targets up";
        } else if (posMedianRoutes != null && row.routeAvg != null && row.routeAvg > posMedianRoutes * 1.3) {
          topRoleDriver = "routes up";
        }

        const windowLabel = row.rollingWeeks.length > 0
          ? `W${row.rollingWeeks[0]}\u2013W${row.rollingWeeks[row.rollingWeeks.length - 1]}`
          : `W${Math.max(1, week - 3)}\u2013W${week}`;

        allRows.push({
          playerId: row.playerId,
          playerName: row.playerName,
          team: row.team,
          position: row.position,
          season: row.season,
          weekAnchor: row.weekAnchor,
          windowGamesPlayed: row.windowGamesPlayed,
          games_played_window: row.windowGamesPlayed,
          confidence: conf,
          forge: { alpha: row.alpha, pct: forgePct, z: forgeZ },
          fire: { score: row.fireScore, pct: firePct, z: fireZ },
          delta: { displayPct, rankZ, direction },
          why: {
            forge_vs_fire: displayPct > 0
              ? "High FORGE%, low FIRE% over rolling 4w"
              : displayPct < 0
              ? "Low FORGE%, high FIRE% over rolling 4w"
              : "FORGE and FIRE aligned",
            window: windowLabel,
            xfp_r: row.xfpR,
            snaps_r: row.snapsR,
            window_games_played: row.windowGamesPlayed,
            top_role_driver: topRoleDriver,
          },
        });
      }
    }

    const sorted = allRows.sort((a, b) => Math.abs(b.delta.rankZ) - Math.abs(a.delta.rankZ));
    const paged = sorted.slice(offset, offset + limit);

    const countsByPos = SUPPORTED_POSITIONS.reduce((acc, p) => {
      acc[p] = sorted.filter((r) => r.position === p).length;
      return acc;
    }, {} as Record<Position, number>);

    return res.json({
      metadata: {
        season,
        weekAnchor: week,
        mode,
        position: position ?? 'ALL',
        countsByPosition: countsByPos,
        eligibilityThresholds: SNAP_THRESHOLDS,
        notes: [
          'Hybrid delta: display uses percentile delta, ranking uses z-score delta.',
          'Label logic: rankZ primary, percentile gated by confidence (LOW excluded from pct-only triggers).',
          'QB excluded until QB FIRE exists.',
        ],
        limit,
        offset,
        total: sorted.length,
      },
      data: paged,
    });
  } catch (error: any) {
    console.error('[DELTA] batch error', error);
    return res.status(500).json({ error: error?.message ?? 'Unknown error' });
  }
});

router.get('/delta/eg/player-trend', async (req: Request, res: Response) => {
  try {
    const season = Number(req.query.season);
    const playerId = String(req.query.playerId || '').trim();
    const weekFrom = Number(req.query.weekFrom);
    const weekTo = Number(req.query.weekTo);

    if (!Number.isInteger(season) || !playerId || !Number.isInteger(weekFrom) || !Number.isInteger(weekTo)) {
      return res.status(400).json({ error: 'season, playerId, weekFrom, and weekTo are required' });
    }

    const minWeek = Math.max(1, Math.min(weekFrom, weekTo));
    const maxWeek = Math.min(18, Math.max(weekFrom, weekTo));

    const posResult = await db.execute(sql`
      SELECT MAX(position)::text AS position
      FROM fantasy_metrics_weekly_mv
      WHERE season = ${season} AND player_id = ${playerId} AND position IN ('RB','WR','TE')
    `);

    const position = posResult.rows[0]?.position as Position | undefined;
    if (!position || !SUPPORTED_POSITIONS.includes(position)) {
      return res.json({ season, playerId, weekFrom: minWeek, weekTo: maxWeek, data: [] });
    }

    const { runForgeEngineBatch } = await import('../modules/forge/forgeEngine');
    const { gradeForgeWithMeta } = await import('../modules/forge/forgeGrading');

    const trendRows: any[] = [];

    for (let anchorWeek = minWeek; anchorWeek <= maxWeek; anchorWeek += 1) {
      const { rows, rollingWeeks } = await fetchRollingRows(season, anchorWeek, position, undefined);
      const fireRows = buildFire(rows, season, anchorWeek, rollingWeeks).filter((p) => p.eligible && p.fireScore != null);
      const fireById = new Map(fireRows.map((r) => [r.playerId, r]));
      if (!fireById.has(playerId)) continue;

      const forgeRaw = await runForgeEngineBatch(position, season, anchorWeek, 400);
      const forge = forgeRaw.map((r: any) => gradeForgeWithMeta(r, { mode: 'redraft' }));

      const joined = fireRows
        .map((fire) => {
          const f = forge.find((g: any) => g.playerId === fire.playerId);
          if (!f) return null;
          return { playerId: fire.playerId, alpha: Number(f.alpha), fireScore: Number(fire.fireScore), confidence: fire.confidence };
        })
        .filter(Boolean) as Array<{ playerId: string; alpha: number; fireScore: number; confidence: Confidence }>;
      if (!joined.length) continue;

      const alphaVals = joined.map((j) => j.alpha);
      const fireVals = joined.map((j) => j.fireScore);
      const alphaSorted = [...alphaVals].sort((a, b) => a - b);
      const fireSorted = [...fireVals].sort((a, b) => a - b);
      const alphaMean = mean(alphaVals) ?? 0;
      const fireMean = mean(fireVals) ?? 0;
      const alphaStd = stdev(alphaVals) || 1;
      const fireStd = stdev(fireVals) || 1;

      const playerJoined = joined.find((j) => j.playerId === playerId);
      if (!playerJoined) continue;

      const forgePct = percentileRank(alphaSorted, playerJoined.alpha);
      const firePct = percentileRank(fireSorted, playerJoined.fireScore);
      const rankZ = (playerJoined.alpha - alphaMean) / alphaStd - (playerJoined.fireScore - fireMean) / fireStd;
      const displayPct = forgePct - firePct;

      trendRows.push({
        weekAnchor: anchorWeek,
        forgePct,
        firePct,
        rankZ,
        displayPct,
        confidence: fireById.get(playerId)?.confidence ?? playerJoined.confidence,
      });
    }

    return res.json({
      season,
      playerId,
      weekFrom: minWeek,
      weekTo: maxWeek,
      data: trendRows.sort((a, b) => a.weekAnchor - b.weekAnchor),
    });
  } catch (error: any) {
    console.error('[DELTA] trend error', error);
    return res.status(500).json({ error: error?.message ?? 'Unknown error' });
  }
});

export default router;
