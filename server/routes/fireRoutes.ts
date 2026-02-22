import { Router, type Request, type Response } from "express";
import { sql } from "drizzle-orm";
import { db } from "../infra/db";

const router = Router();

type Position = "QB" | "RB" | "WR" | "TE";
type SkillPosition = "RB" | "WR" | "TE";
type ScoringPreset = "redraft" | "dynasty";
const SUPPORTED_POSITIONS: Position[] = ["QB", "RB", "WR", "TE"];
const SKILL_POSITIONS: SkillPosition[] = ["RB", "WR", "TE"];

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
  qb_xfp_redraft_r: number | null;
  qb_xfp_dynasty_r: number | null;
  qb_dropbacks_r: number | null;
  qb_rush_attempts_r: number | null;
  inside10_dropbacks_r: number | null;
  qb_exp_pass_yards_r: number | null;
  qb_exp_pass_td_r: number | null;
  qb_exp_int_r: number | null;
  qb_exp_rush_yards_r: number | null;
  qb_exp_rush_td_r: number | null;
  games_played_window: number | null;
  weeks_present: number[] | null;
  rushing_yards_r: number | null;
  receiving_yards_r: number | null;
  receptions_r: number | null;
  rushing_tds_r: number | null;
  receiving_tds_r: number | null;
  rush_share_avg: number | null;
  rz_rush_att_r: number | null;
  rz_targets_r: number | null;
  team_snaps_avg: number | null;
}

type Confidence = "HIGH" | "MED" | "LOW";

interface FirePlayer {
  playerId: string;
  playerName: string | null;
  team: string | null;
  position: Position;
  season: number;
  weekAnchor: number;
  scoringPreset: ScoringPreset;
  rollingWeeks: number[];
  games_played_window: number;
  weeks_present: number[];
  confidence: Confidence;
  eligible: boolean;
  fireScore: number | null;
  fireRank: number | null;
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
    qb_dropbacks_R: number | null;
    qb_rush_attempts_R: number | null;
    inside10_dropbacks_R: number | null;
    qb_xfp_redraft_R: number | null;
    qb_xfp_dynasty_R: number | null;
    qb_exp_pass_yards_R: number | null;
    qb_exp_pass_td_R: number | null;
    qb_exp_int_R: number | null;
    qb_exp_rush_yards_R: number | null;
    qb_exp_rush_td_R: number | null;
  };
  stats: {
    snapPct: number | null;
    carriesPerGame: number | null;
    targetsPerGame: number | null;
    touchesPerGame: number | null;
    rushSharePct: number | null;
    targetSharePct: number | null;
    ypc: number | null;
    ypr: number | null;
    rushYdsPerGame: number | null;
    recYdsPerGame: number | null;
    totalTds: number | null;
    fantasyPpg: number | null;
    fpStdDev: number | null;
    boomPct: number | null;
    xfpDiff: number | null;
    rzTouchSharePct: number | null;
  };
  roleMeta: {
    targetSource: "target_share" | "targets_per_snap" | "targets_per_route" | "none";
    routeSource: "route_participation" | "routes" | "none";
    redistributedRouteWeight: boolean;
    usedColumns: string[];
  };
}

function baseThresholdForPosition(position: Position): number {
  if (position === "RB") return 50;
  if (position === "QB") return 80;
  return 80;
}

function scaledThreshold(position: Position, windowWeeks: number): number {
  const base = baseThresholdForPosition(position);
  const scale = Math.min(windowWeeks, 4) / 4;
  return Math.max(Math.round(base * scale), position === "RB" ? 8 : 12);
}

function classifyConfidence(position: Position, gamesPlayedWindow: number, snapsR: number, qbDropbacksR: number, windowWeeks: number): Confidence {
  const threshold = scaledThreshold(position, windowWeeks);
  const workload = position === "QB" ? qbDropbacksR : snapsR;
  if (gamesPlayedWindow >= 4 && workload >= threshold * 1.5) return "HIGH";
  if (gamesPlayedWindow <= 2 || workload < threshold) return "LOW";
  if (gamesPlayedWindow >= 3 && workload >= threshold) return "MED";
  return "LOW";
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

interface WeeklyFpRow {
  player_id: string;
  week: number;
  fp_ppr: number;
  fp_hppr: number;
}

interface WeeklyPlayerStatRow {
  player_id: string;
  team: string;
  week: number;
  rush_attempts: number;
  targets: number;
  snaps: number;
  rz_rush_att: number;
  rz_targets: number;
}

interface TeamWeeklyTotals {
  team: string;
  week: number;
  team_rush_att: number;
  team_targets: number;
  team_snaps: number;
  team_rz_rush_att: number;
  team_rz_targets: number;
}

async function fetchRollingRows(season: number, week: number, position?: Position, playerIds?: string[]): Promise<{ rows: RollingRow[]; rollingWeeks: number[]; weeklyFp: WeeklyFpRow[]; teamTotals: TeamWeeklyTotals[]; playerWeeklyStats: WeeklyPlayerStatRow[] }> {
  const weekStart = Math.max(1, week - 3);
  const baseWhere: any[] = [sql`season = ${season}`, sql`week BETWEEN ${weekStart} AND ${week}`, sql`position IN ('QB','RB','WR','TE')`];
  if (position) baseWhere.push(sql`position = ${position}`);
  if (playerIds?.length) baseWhere.push(sql`player_id = ANY(${sql.raw(`ARRAY[${playerIds.map(id => `'${id.replace(/'/g, "''")}'`).join(',')}]`)})`);

  const fmWhere: any[] = [sql`fm.season = ${season}`, sql`fm.week BETWEEN ${weekStart} AND ${week}`, sql`fm.position IN ('QB','RB','WR','TE')`];
  if (position) fmWhere.push(sql`fm.position = ${position}`);
  if (playerIds?.length) fmWhere.push(sql`fm.player_id = ANY(${sql.raw(`ARRAY[${playerIds.map(id => `'${id.replace(/'/g, "''")}'`).join(',')}]`)})`);

  const rollingWeeksResult = await db.execute(sql`
    SELECT DISTINCT week
    FROM fantasy_metrics_weekly_mv
    WHERE ${sql.join(baseWhere, sql` AND `)}
    ORDER BY week ASC
  `);

  const rowsResult = await db.execute(sql`
    SELECT
      fm.player_id,
      MAX(fm.player_name) AS player_name,
      MAX(fm.position)::text AS position,
      MAX(fm.team) AS team,
      SUM(COALESCE(fm.snaps, 0))::real AS snaps_r,
      AVG(fm.snap_share)::real AS snap_avg,
      SUM(COALESCE(fm.targets, 0))::real AS targets_r,
      AVG(fm.target_share)::real AS target_avg,
      SUM(COALESCE(fm.routes, 0))::real AS routes_r,
      AVG(fm.route_participation)::real AS route_avg,
      SUM(COALESCE(fm.carries, 0))::real AS carries_r,
      AVG(fm.red_zone_touches)::real AS rz_avg,
      SUM(fm.x_ppr_v2)::real AS xfp_r,
      SUM(fm.xfpgoe_ppr_v2)::real AS xfpgoe_r,
      SUM(COALESCE(fm.qb_xfp_redraft, 0))::real AS qb_xfp_redraft_r,
      SUM(COALESCE(fm.qb_xfp_dynasty, 0))::real AS qb_xfp_dynasty_r,
      SUM(COALESCE(fm.qb_dropbacks, 0))::real AS qb_dropbacks_r,
      SUM(COALESCE(fm.qb_rush_attempts, 0))::real AS qb_rush_attempts_r,
      SUM(COALESCE(fm.inside10_dropbacks, 0))::real AS inside10_dropbacks_r,
      SUM(COALESCE(fm.exp_pass_yards, 0))::real AS qb_exp_pass_yards_r,
      SUM(COALESCE(fm.qb_exp_pass_td, 0))::real AS qb_exp_pass_td_r,
      SUM(COALESCE(fm.qb_exp_int, 0))::real AS qb_exp_int_r,
      SUM(COALESCE(fm.exp_rush_yards, 0))::real AS qb_exp_rush_yards_r,
      SUM(COALESCE(fm.qb_exp_rush_td, 0))::real AS qb_exp_rush_td_r,
      COUNT(*) FILTER (
        WHERE COALESCE(fm.snaps, 0) > 0
          OR COALESCE(fm.qb_dropbacks, 0) > 0
          OR (fm.snaps IS NULL AND (COALESCE(fm.targets, 0) + COALESCE(fm.carries, 0)) > 0)
      )::int AS games_played_window,
      ARRAY_AGG(DISTINCT fm.week ORDER BY fm.week) FILTER (
        WHERE COALESCE(fm.snaps, 0) > 0
          OR COALESCE(fm.qb_dropbacks, 0) > 0
          OR (fm.snaps IS NULL AND (COALESCE(fm.targets, 0) + COALESCE(fm.carries, 0)) > 0)
      )::int[] AS weeks_present,
      SUM(COALESCE(s.rushing_yards, 0))::real AS rushing_yards_r,
      SUM(COALESCE(s.receiving_yards, 0))::real AS receiving_yards_r,
      SUM(COALESCE(s.receptions, 0))::real AS receptions_r,
      SUM(COALESCE(s.rushing_tds, 0))::real AS rushing_tds_r,
      SUM(COALESCE(s.receiving_tds, 0))::real AS receiving_tds_r,
      AVG(fm.rush_share)::real AS rush_share_avg,
      SUM(COALESCE(fm.rz_rushes, 0) + COALESCE(fm.rz_targets, 0))::real AS rz_rush_att_r,
      SUM(COALESCE(fm.rz_targets, 0))::real AS rz_targets_r,
      AVG(CASE WHEN fm.snap_share IS NOT NULL AND fm.snap_share > 0
           THEN fm.snaps / NULLIF(fm.snap_share, 0) ELSE NULL END)::real AS team_snaps_avg
    FROM fantasy_metrics_weekly_mv fm
    LEFT JOIN silver_player_weekly_stats s
      ON s.player_id = fm.player_id AND s.season = fm.season AND s.week = fm.week
    WHERE ${sql.join(fmWhere, sql` AND `)}
    GROUP BY fm.player_id
  `);

  const fpResult = await db.execute(sql`
    SELECT
      player_id,
      week,
      (COALESCE(rushing_yards, 0) * 0.1
       + COALESCE(receiving_yards, 0) * 0.1
       + COALESCE(receptions, 0) * 1.0
       + COALESCE(rushing_tds, 0) * 6
       + COALESCE(receiving_tds, 0) * 6
       + COALESCE(passing_yards, 0) * 0.04
       + COALESCE(passing_tds, 0) * 4
       + COALESCE(interceptions, 0) * (-2)
      )::real AS fp_ppr,
      (COALESCE(rushing_yards, 0) * 0.1
       + COALESCE(receiving_yards, 0) * 0.1
       + COALESCE(receptions, 0) * 0.5
       + COALESCE(rushing_tds, 0) * 6
       + COALESCE(receiving_tds, 0) * 6
       + COALESCE(passing_yards, 0) * 0.04
       + COALESCE(passing_tds, 0) * 4
       + COALESCE(interceptions, 0) * (-2)
      )::real AS fp_hppr
    FROM silver_player_weekly_stats
    WHERE season = ${season}
      AND week BETWEEN ${weekStart} AND ${week}
      ${position ? sql`AND position = ${position}` : sql``}
  `);

  const teamTotalsResult = await db.execute(sql`
    SELECT team, week, team_rush_att, team_targets, team_snaps, team_rz_rush_att, team_rz_targets
    FROM team_weekly_totals_mv
    WHERE season = ${season} AND week BETWEEN ${weekStart} AND ${week}
  `);

  const playerWeeklyResult = await db.execute(sql`
    SELECT player_id, team, week,
      COALESCE(rush_attempts, 0)::int AS rush_attempts,
      COALESCE(targets, 0)::int AS targets,
      COALESCE(snaps, 0)::int AS snaps,
      COALESCE(rz_rush_att, 0)::int AS rz_rush_att,
      COALESCE(rz_targets, 0)::int AS rz_targets
    FROM silver_player_weekly_stats
    WHERE season = ${season} AND week BETWEEN ${weekStart} AND ${week}
      ${position ? sql`AND position = ${position}` : sql``}
  `);

  return {
    rows: rowsResult.rows as unknown as RollingRow[],
    rollingWeeks: (rollingWeeksResult.rows as any[]).map((r) => Number(r.week)).filter(Number.isFinite),
    weeklyFp: fpResult.rows as unknown as WeeklyFpRow[],
    teamTotals: teamTotalsResult.rows as unknown as TeamWeeklyTotals[],
    playerWeeklyStats: playerWeeklyResult.rows as unknown as WeeklyPlayerStatRow[],
  };
}

function buildFire(rows: RollingRow[], season: number, week: number, rollingWeeks: number[], scoringPreset: ScoringPreset, weeklyFp: WeeklyFpRow[], teamTotals: TeamWeeklyTotals[], playerWeeklyStats: WeeklyPlayerStatRow[]): FirePlayer[] {
  const fpByPlayer = new Map<string, number[]>();
  const fpHpprByPlayer = new Map<string, number[]>();
  for (const wf of weeklyFp) {
    if (!fpByPlayer.has(wf.player_id)) fpByPlayer.set(wf.player_id, []);
    if (!fpHpprByPlayer.has(wf.player_id)) fpHpprByPlayer.set(wf.player_id, []);
    fpByPlayer.get(wf.player_id)!.push(wf.fp_ppr);
    fpHpprByPlayer.get(wf.player_id)!.push(wf.fp_hppr);
  }

  const teamTotalsByKey = new Map<string, TeamWeeklyTotals>();
  for (const tt of teamTotals) {
    teamTotalsByKey.set(`${tt.team}_${tt.week}`, tt);
  }

  const playerShareData = new Map<string, { rushShare: number | null; targetShare: number | null; rzTouchShare: number | null }>();
  const statsByPlayer = new Map<string, WeeklyPlayerStatRow[]>();
  for (const ps of playerWeeklyStats) {
    if (!statsByPlayer.has(ps.player_id)) statsByPlayer.set(ps.player_id, []);
    statsByPlayer.get(ps.player_id)!.push(ps);
  }

  for (const [playerId, weeklyRows] of Array.from(statsByPlayer.entries())) {
    let playerRushTotal = 0, playerTargetTotal = 0, playerRzTouchTotal = 0;
    let teamRushTotal = 0, teamTargetTotal = 0, teamRzTouchTotal = 0;
    let rushWeeks = 0, targetWeeks = 0, rzWeeks = 0;

    for (const pw of weeklyRows) {
      const tt = teamTotalsByKey.get(`${pw.team}_${pw.week}`);
      if (!tt) continue;

      if (tt.team_rush_att > 0) {
        playerRushTotal += pw.rush_attempts;
        teamRushTotal += tt.team_rush_att;
        rushWeeks++;
      }
      if (tt.team_targets > 0) {
        playerTargetTotal += pw.targets;
        teamTargetTotal += tt.team_targets;
        targetWeeks++;
      }
      const teamRzTouch = tt.team_rz_rush_att + tt.team_rz_targets;
      const playerRzTouch = pw.rz_rush_att + pw.rz_targets;
      if (teamRzTouch > 0) {
        playerRzTouchTotal += playerRzTouch;
        teamRzTouchTotal += teamRzTouch;
        rzWeeks++;
      }
    }

    playerShareData.set(playerId, {
      rushShare: rushWeeks > 0 && teamRushTotal > 0 ? (playerRushTotal / teamRushTotal) * 100 : null,
      targetShare: targetWeeks > 0 && teamTargetTotal > 0 ? (playerTargetTotal / teamTargetTotal) * 100 : null,
      rzTouchShare: rzWeeks > 0 && teamRzTouchTotal > 0 ? (playerRzTouchTotal / teamRzTouchTotal) * 100 : null,
    });
  }

  const basePlayers: FirePlayer[] = rows.map((row) => {
    const targetShare = row.target_avg;
    const routesR = row.routes_r;
    const targetsR = row.targets_r;
    const routePart = row.route_avg;
    const snapsR = row.snaps_r;

    let targetSource: FirePlayer["roleMeta"]["targetSource"] = "none";
    if (targetShare != null) {
      targetSource = "target_share";
    } else if ((snapsR ?? 0) > 0 && targetsR != null) {
      targetSource = "targets_per_snap";
    } else if ((routesR ?? 0) > 0 && targetsR != null) {
      targetSource = "targets_per_route";
    }

    let routeSource: FirePlayer["roleMeta"]["routeSource"] = "none";
    if (routePart != null) {
      routeSource = "route_participation";
    } else if (routesR != null) {
      routeSource = "routes";
    }

    const qbDropbacksR = row.qb_dropbacks_r ?? 0;
    const windowWeeks = rollingWeeks.length || 1;
    const posThreshold = scaledThreshold(row.position, windowWeeks);
    const qbThreshold = scaledThreshold("QB", windowWeeks);
    const eligible = row.position === "RB"
      ? (row.snaps_r ?? 0) >= posThreshold
      : row.position === "QB"
      ? (qbDropbacksR >= qbThreshold || (row.snaps_r ?? 0) >= Math.round(100 * Math.min(windowWeeks, 4) / 4))
      : (row.snaps_r ?? 0) >= posThreshold;

    const gamesPlayedWindow = row.games_played_window ?? 0;
    const weeksPresent = (row.weeks_present ?? []).map((w) => Number(w)).filter((w) => Number.isFinite(w)).sort((a, b) => a - b);
    const confidence = classifyConfidence(row.position, gamesPlayedWindow, row.snaps_r ?? 0, qbDropbacksR, windowWeeks);

    const g = Math.max(gamesPlayedWindow, 1);
    const sCarries = row.carries_r ?? 0;
    const sTargets = row.targets_r ?? 0;
    const rushYds = row.rushing_yards_r ?? 0;
    const recYds = row.receiving_yards_r ?? 0;
    const recs = row.receptions_r ?? 0;
    const rushTds = row.rushing_tds_r ?? 0;
    const recTds = row.receiving_tds_r ?? 0;
    const totalTds = rushTds + recTds;
    const xfpTotal = row.xfp_r ?? 0;

    const fpWeeklyPpr = fpByPlayer.get(row.player_id) ?? [];
    const fpWeeklyHppr = fpHpprByPlayer.get(row.player_id) ?? [];
    const fpArr = fpWeeklyPpr.length ? fpWeeklyPpr : fpWeeklyHppr;
    const fpPprSum = fpWeeklyPpr.reduce((a, b) => a + b, 0);
    const fpHpprSum = fpWeeklyHppr.reduce((a, b) => a + b, 0);
    const fantasyPpg = fpWeeklyPpr.length ? fpPprSum / fpWeeklyPpr.length : null;
    const fpStdDevVal = fpArr.length > 1 ? stdev(fpArr) : null;
    const boomThreshold = 18;
    const boomPctVal = fpWeeklyPpr.length ? (fpWeeklyPpr.filter((v) => v >= boomThreshold).length / fpWeeklyPpr.length) * 100 : null;
    const xfpDiffVal = fpWeeklyPpr.length && xfpTotal ? fpPprSum - xfpTotal : null;

    const shares = playerShareData.get(row.player_id);
    const rushSharePct = shares?.rushShare ?? null;
    const targetSharePct = shares?.targetShare ?? null;
    const rzTouchSharePct = shares?.rzTouchShare ?? null;

    return {
      playerId: row.player_id,
      playerName: row.player_name,
      team: row.team,
      position: row.position,
      season,
      weekAnchor: week,
      scoringPreset,
      rollingWeeks,
      games_played_window: gamesPlayedWindow,
      weeks_present: weeksPresent,
      confidence,
      eligible,
      fireScore: null,
      fireRank: null,
      pillars: { opportunity: null, role: null, conversion: row.position === "QB" ? null : null },
      raw: {
        xfp_R: row.xfp_r,
        xfpgoe_R: row.xfpgoe_r,
        snaps_R: row.snaps_r,
        snap_avg: row.snap_avg,
        target_avg: row.target_avg,
        route_avg: row.route_avg,
        carries_R: row.carries_r,
        rz_avg: row.rz_avg,
        qb_dropbacks_R: row.qb_dropbacks_r,
        qb_rush_attempts_R: row.qb_rush_attempts_r,
        inside10_dropbacks_R: row.inside10_dropbacks_r,
        qb_xfp_redraft_R: row.qb_xfp_redraft_r,
        qb_xfp_dynasty_R: row.qb_xfp_dynasty_r,
        qb_exp_pass_yards_R: row.qb_exp_pass_yards_r,
        qb_exp_pass_td_R: row.qb_exp_pass_td_r,
        qb_exp_int_R: row.qb_exp_int_r,
        qb_exp_rush_yards_R: row.qb_exp_rush_yards_r,
        qb_exp_rush_td_R: row.qb_exp_rush_td_r,
      },
      stats: {
        snapPct: row.snap_avg != null ? row.snap_avg * 100 : null,
        carriesPerGame: sCarries / g,
        targetsPerGame: sTargets / g,
        touchesPerGame: (sCarries + sTargets) / g,
        rushSharePct,
        targetSharePct,
        ypc: sCarries > 0 ? rushYds / sCarries : null,
        ypr: recs > 0 ? recYds / recs : null,
        rushYdsPerGame: rushYds / g,
        recYdsPerGame: recYds / g,
        totalTds,
        fantasyPpg,
        fpStdDev: fpStdDevVal,
        boomPct: boomPctVal,
        xfpDiff: xfpDiffVal,
        rzTouchSharePct,
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

    if (position === "QB") {
      const oppValues = pool.map((p) => scoringPreset === "dynasty" ? (p.raw.qb_xfp_dynasty_R ?? 0) : (p.raw.qb_xfp_redraft_R ?? 0)).sort((a, b) => a - b);
      const dbValues = pool.map((p) => p.raw.qb_dropbacks_R ?? 0).sort((a, b) => a - b);
      const rushValues = pool.map((p) => p.raw.qb_rush_attempts_R ?? 0).sort((a, b) => a - b);
      const i10Values = pool.map((p) => p.raw.inside10_dropbacks_R ?? 0).sort((a, b) => a - b);
      const roleRawValues: number[] = [];
      const roleById = new Map<string, number>();

      for (const p of pool) {
        const roleIdx =
          0.60 * (percentileRank(dbValues, p.raw.qb_dropbacks_R ?? 0) / 100) +
          0.25 * (percentileRank(rushValues, p.raw.qb_rush_attempts_R ?? 0) / 100) +
          0.15 * (percentileRank(i10Values, p.raw.inside10_dropbacks_R ?? 0) / 100);
        roleById.set(p.playerId, roleIdx);
        roleRawValues.push(roleIdx);
      }

      const sortedRoleRaw = [...roleRawValues].sort((a, b) => a - b);

      for (const p of pool) {
        const opp = percentileRank(oppValues, scoringPreset === "dynasty" ? (p.raw.qb_xfp_dynasty_R ?? 0) : (p.raw.qb_xfp_redraft_R ?? 0));
        const role = percentileRank(sortedRoleRaw, roleById.get(p.playerId) ?? 0);
        p.pillars = { opportunity: opp, role, conversion: null };
        p.fireScore = 0.75 * opp + 0.25 * role;
        p.roleMeta.usedColumns = ["qb_dropbacks", "qb_rush_attempts", "inside10_dropbacks"];
      }
      continue;
    }

    const oppValues = pool.map((p) => p.raw.xfp_R ?? 0).sort((a, b) => a - b);
    const convValues = pool.map((p) => p.raw.xfpgoe_R ?? 0).sort((a, b) => a - b);
    const roleIndexRaw: number[] = [];
    const roleMap = new Map<string, number>();

    for (const p of pool) {
      const row = rows.find((r) => r.player_id === p.playerId);
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
        ? ((p.raw.target_avg ?? 0) || ((p.raw.snaps_R ?? 0) > 0 ? (row?.targets_r ?? 0) / Math.max(p.raw.snaps_R ?? 1, 1) : 0))
        : p.roleMeta.targetSource === "targets_per_route"
        ? ((row?.targets_r ?? 0) / Math.max((row?.routes_r ?? 1), 1))
        : null;

      const routeComp = p.roleMeta.routeSource === "route_participation" ? p.raw.route_avg : row?.routes_r ?? null;
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

  for (const pos of SUPPORTED_POSITIONS) {
    const eligible = basePlayers.filter((p) => p.position === pos && p.eligible && p.fireScore != null);
    eligible.sort((a, b) => (b.fireScore ?? 0) - (a.fireScore ?? 0));
    eligible.forEach((p, i) => { p.fireRank = i + 1; });
  }

  return basePlayers;
}

function parsePlayerIds(raw: unknown): string[] | undefined {
  if (typeof raw !== "string" || !raw.trim()) return undefined;
  return raw.split(",").map((v) => v.trim()).filter(Boolean);
}

function parseScoringPreset(raw: unknown): ScoringPreset {
  if (typeof raw !== "string") return "redraft";
  const normalized = raw.toLowerCase();
  return normalized === "dynasty" ? "dynasty" : "redraft";
}

router.get('/fire/eg/batch', async (req: Request, res: Response) => {
  try {
    const season = Number(req.query.season);
    const week = Number(req.query.week);
    const position = typeof req.query.position === "string" ? req.query.position.toUpperCase() as Position : undefined;
    const playerIds = parsePlayerIds(req.query.playerIds);
    const scoringPreset = parseScoringPreset(req.query.scoringPreset);

    if (!Number.isInteger(season) || !Number.isInteger(week)) {
      return res.status(400).json({ error: 'season and week are required integers' });
    }
    if (position && !SUPPORTED_POSITIONS.includes(position)) {
      return res.status(400).json({ error: 'position must be QB, RB, WR, or TE' });
    }

    const { rows, rollingWeeks, weeklyFp, teamTotals, playerWeeklyStats } = await fetchRollingRows(season, week, position, playerIds);
    const data = buildFire(rows, season, week, rollingWeeks, scoringPreset, weeklyFp, teamTotals, playerWeeklyStats);

    return res.json({
      metadata: {
        season,
        weekAnchor: week,
        rollingWeeks,
        scoringPreset,
        positions: position ? [position] : SUPPORTED_POSITIONS,
        eligibilityThresholds: {
          QB: scaledThreshold("QB", rollingWeeks.length || 1),
          RB: scaledThreshold("RB", rollingWeeks.length || 1),
          WR: scaledThreshold("WR", rollingWeeks.length || 1),
          TE: scaledThreshold("TE", rollingWeeks.length || 1),
          windowWeeks: rollingWeeks.length || 1,
        },
        notes: ['QB FIRE v1 uses Opportunity + Role only; Conversion is deferred to v1.1.'],
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
    const scoringPreset = parseScoringPreset(req.query.scoringPreset);

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
        notes: ['Player not found in weekly MV window.'],
      });
    }

    const { rows, rollingWeeks, weeklyFp, teamTotals, playerWeeklyStats } = await fetchRollingRows(season, week, pos, undefined);
    const data = buildFire(rows, season, week, rollingWeeks, scoringPreset, weeklyFp, teamTotals, playerWeeklyStats);
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
    const position = typeof req.query.position === "string" ? req.query.position.toUpperCase() as SkillPosition : undefined;
    const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 500);
    const offset = Math.max(Number(req.query.offset) || 0, 0);

    if (!Number.isInteger(season) || !Number.isInteger(week)) {
      return res.status(400).json({ error: 'season and week are required integers' });
    }
    if (position && !SKILL_POSITIONS.includes(position)) {
      return res.status(400).json({ error: 'Delta requires FORGE + FIRE; only RB, WR, TE supported (QB FORGE not yet available)' });
    }

    const { runForgeEngineBatch } = await import('../modules/forge/forgeEngine');
    const { gradeForgeWithMeta } = await import('../modules/forge/forgeGrading');

    const positions = position ? [position] : SKILL_POSITIONS;
    const allRows: any[] = [];

    for (const pos of positions) {
      const { rows, rollingWeeks, weeklyFp, teamTotals, playerWeeklyStats } = await fetchRollingRows(season, week, pos, undefined);
      const fireRows = buildFire(rows, season, week, rollingWeeks, 'redraft', weeklyFp, teamTotals, playerWeeklyStats).filter((p) => p.eligible && p.fireScore != null);
      if (!fireRows.length) continue;

      const forgeRaw = await runForgeEngineBatch(pos, season, week, 400);
      const forge = forgeRaw.map((r: any) => gradeForgeWithMeta(r, { mode: 'redraft' }));
      const forgeById = new Map(forge.map((f: any) => [f.playerId, f]));

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
            alpha: Number(f.alpha),
            fireScore: Number(fire.fireScore),
          };
        })
        .filter(Boolean) as Array<{ playerId: string; playerName: string | null; team: string | null; position: SkillPosition; season: number; weekAnchor: number; alpha: number; fireScore: number }>;

      const alphaVals = joined.map((j) => j.alpha);
      const fireVals = joined.map((j) => j.fireScore);
      const alphaSorted = [...alphaVals].sort((a, b) => a - b);
      const fireSorted = [...fireVals].sort((a, b) => a - b);
      const alphaMean = mean(alphaVals) ?? 0;
      const fireMean = mean(fireVals) ?? 0;
      const alphaStd = stdev(alphaVals) || 1;
      const fireStd = stdev(fireVals) || 1;

      for (const row of joined) {
        const fireData = fireRows.find((f) => f.playerId === row.playerId);
        if (!fireData) continue;
        const forgePct = percentileRank(alphaSorted, row.alpha);
        const firePct = percentileRank(fireSorted, row.fireScore);
        const forgeZ = (row.alpha - alphaMean) / alphaStd;
        const fireZ = (row.fireScore - fireMean) / fireStd;
        const rankZ = forgeZ - fireZ;
        const displayPct = forgePct - firePct;

        const directionalStrength = Math.max(Math.abs(rankZ), Math.abs(displayPct) / 20);
        const whyNote = rankZ >= 0.75 || displayPct >= 15
          ? 'High FORGE%, low FIRE% (recent opportunity dip)'
          : rankZ <= -0.75 || displayPct <= -15
          ? 'Low FORGE%, high FIRE% (recent spike)'
          : directionalStrength < 0.75
          ? 'Near alignment'
          : rankZ >= 0
          ? 'High FORGE%, low FIRE% (recent opportunity dip)'
          : 'Low FORGE%, high FIRE% (recent spike)';

        const direction = rankZ >= 1 || (displayPct >= 20 && fireData.confidence !== 'LOW')
          ? 'BUY_LOW'
          : rankZ <= -1 || (displayPct <= -20 && fireData.confidence !== 'LOW')
          ? 'SELL_HIGH'
          : 'NEUTRAL';

        allRows.push({
          playerId: row.playerId,
          playerName: row.playerName,
          team: row.team,
          position: row.position,
          season: row.season,
          weekAnchor: row.weekAnchor,
          games_played_window: fireData.games_played_window,
          weeks_present: fireData.weeks_present,
          confidence: fireData.confidence,
          forge: { alpha: row.alpha, pct: forgePct, z: forgeZ },
          fire: { score: row.fireScore, pct: firePct, z: fireZ },
          delta: { displayPct, rankZ, direction },
          why: {
            window: `W${Math.max(1, row.weekAnchor - 3)}–W${row.weekAnchor}`,
            gamesPlayed: fireData.games_played_window,
            xfp_R: fireData.raw.xfp_R,
            snaps_R: fireData.raw.snaps_R,
            note: whyNote,
          },
        });
      }
    }

    const sorted = allRows.sort((a, b) => Math.abs(b.delta.rankZ) - Math.abs(a.delta.rankZ));
    const paged = sorted.slice(offset, offset + limit);

    const countsByPos = SKILL_POSITIONS.reduce((acc, p) => {
      acc[p] = sorted.filter((r) => r.position === p).length;
      return acc;
    }, {} as Record<SkillPosition, number>);

    return res.json({
      metadata: {
        season,
        weekAnchor: week,
        position: position ?? 'ALL',
        countsByPosition: countsByPos,
        eligibilityThresholds: { RB: 50, WR: 80, TE: 80 },
        notes: ['Hybrid delta: display uses percentile delta, ranking uses z-score delta.', 'QB excluded from DELTA until QB conversion pillar exists.'],
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

    const position = posResult.rows[0]?.position as SkillPosition | undefined;
    if (!position || !SKILL_POSITIONS.includes(position)) {
      return res.json({ season, playerId, weekFrom: minWeek, weekTo: maxWeek, data: [] });
    }

    const { runForgeEngineBatch } = await import('../modules/forge/forgeEngine');
    const { gradeForgeWithMeta } = await import('../modules/forge/forgeGrading');

    const trendRows: any[] = [];

    for (let anchorWeek = minWeek; anchorWeek <= maxWeek; anchorWeek += 1) {
      const { rows, rollingWeeks, weeklyFp, teamTotals, playerWeeklyStats } = await fetchRollingRows(season, anchorWeek, position, undefined);
      const fireRows = buildFire(rows, season, anchorWeek, rollingWeeks, 'redraft', weeklyFp, teamTotals, playerWeeklyStats).filter((p) => p.eligible && p.fireScore != null);
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
