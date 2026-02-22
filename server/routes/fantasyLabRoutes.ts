import { Router, type Request, type Response } from "express";
import { sql } from "drizzle-orm";
import { db } from "../infra/db";
import { requireAdminAuth } from "../middleware/adminAuth";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const router = Router();

const execFileAsync = promisify(execFile);

async function refreshQbXfpWeekly(season: number): Promise<void> {
  await execFileAsync("python3", ["scripts/etl/qb_xfp_weekly.py", "--season", String(season)]);
}

const SORT_COLUMN_MAP: Record<string, string> = {
  season: "season",
  week: "week",
  player_id: "player_id",
  player_name: "player_name",
  position: "position",
  snaps: "snaps",
  targets: "targets",
  routes: "routes",
  carries: "carries",
  air_yards: "air_yards",
  red_zone_touches: "red_zone_touches",
  x_ppr_v2: "x_ppr_v2",
  xfpgoe_ppr_v2: "xfpgoe_ppr_v2",
  adp_latest: "adp_latest",
  rostered_pct_latest: "rostered_pct_latest",
};

function parseSort(sort?: string): { column: string; direction: "ASC" | "DESC" } {
  if (!sort) return { column: "x_ppr_v2", direction: "DESC" };

  const [rawColumn, rawDirection] = sort.split(":");
  const normalizedColumn = SORT_COLUMN_MAP[(rawColumn || "").trim().toLowerCase()] || "x_ppr_v2";
  const normalizedDirection = (rawDirection || "desc").trim().toLowerCase() === "asc" ? "ASC" : "DESC";

  return { column: normalizedColumn, direction: normalizedDirection };
}

router.get("/weekly", async (req: Request, res: Response) => {
  try {
    const season = Number(req.query.season);
    if (!Number.isInteger(season)) {
      return res.status(400).json({ error: "season is required and must be an integer" });
    }

    const week = req.query.week ? Number(req.query.week) : undefined;
    const weekMin = req.query.week_min ? Number(req.query.week_min) : undefined;
    const weekMax = req.query.week_max ? Number(req.query.week_max) : undefined;
    const position = typeof req.query.position === "string" ? req.query.position.toUpperCase() : undefined;

    const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 500);
    const offset = Math.max(Number(req.query.offset) || 0, 0);

    const { column: sortColumn, direction: sortDirection } = parseSort(req.query.sort as string | undefined);

    const whereClauses = [sql`season = ${season}`];
    if (Number.isInteger(week)) {
      whereClauses.push(sql`week = ${week}`);
    } else {
      if (Number.isInteger(weekMin)) whereClauses.push(sql`week >= ${weekMin}`);
      if (Number.isInteger(weekMax)) whereClauses.push(sql`week <= ${weekMax}`);
    }
    if (position) whereClauses.push(sql`position = ${position}`);

    const whereSql = whereClauses.length
      ? sql`WHERE ${sql.join(whereClauses, sql` AND `)}`
      : sql``;

    const dataQuery = sql`
      SELECT *
      FROM fantasy_metrics_weekly_mv
      ${whereSql}
      ORDER BY ${sql.raw(sortColumn)} ${sql.raw(sortDirection)}, player_id ASC
      LIMIT ${limit}
      OFFSET ${offset}
    `;

    const countQuery = sql`
      SELECT COUNT(*)::int AS total_count,
             MIN(week)::int AS min_week,
             MAX(week)::int AS max_week
      FROM fantasy_metrics_weekly_mv
      ${whereSql}
    `;

    const [rowsResult, countResult] = await Promise.all([
      db.execute(dataQuery),
      db.execute(countQuery),
    ]);

    const countRow = (countResult.rows as any[])[0] || {
      total_count: 0,
      min_week: null,
      max_week: null,
    };

    return res.json({
      metadata: {
        season,
        requestedWeek: Number.isInteger(week) ? week : null,
        weeksReturned: {
          min: countRow.min_week,
          max: countRow.max_week,
        },
        totalCount: countRow.total_count,
        limit,
        offset,
        sort: `${sortColumn}:${sortDirection.toLowerCase()}`,
      },
      data: rowsResult.rows,
    });
  } catch (error: any) {
    console.error("[FantasyLab] /weekly failed", error);
    return res.status(500).json({ error: error?.message ?? "Unknown error" });
  }
});

router.get("/player", async (req: Request, res: Response) => {
  try {
    const playerId = String(req.query.playerId || "").trim();
    const season = Number(req.query.season);

    if (!playerId) {
      return res.status(400).json({ error: "playerId is required" });
    }
    if (!Number.isInteger(season)) {
      return res.status(400).json({ error: "season is required and must be an integer" });
    }

    const result = await db.execute(sql`
      SELECT *
      FROM fantasy_metrics_weekly_mv
      WHERE player_id = ${playerId}
        AND season = ${season}
      ORDER BY week ASC
    `);

    return res.json({
      metadata: {
        playerId,
        season,
        weekCount: result.rows.length,
      },
      data: result.rows,
    });
  } catch (error: any) {
    console.error("[FantasyLab] /player failed", error);
    return res.status(500).json({ error: error?.message ?? "Unknown error" });
  }
});

router.post("/refresh", requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const seasonFromBody = Number(req.body?.season);
    const seasonResult = await db.execute(sql`SELECT MAX(season)::int AS season FROM datadive_snapshot_meta`);
    const inferredSeason = Number((seasonResult.rows as any[])[0]?.season) || 2025;
    const season = Number.isInteger(seasonFromBody) ? seasonFromBody : inferredSeason;

    await refreshQbXfpWeekly(season);
    await db.execute(sql`REFRESH MATERIALIZED VIEW fantasy_metrics_weekly_mv`);
    await db.execute(sql`REFRESH MATERIALIZED VIEW CONCURRENTLY team_weekly_totals_mv`);

    const statResult = await db.execute(sql`
      SELECT COUNT(*)::int AS row_count,
             MAX(season)::int AS latest_season,
             MAX(week)::int AS latest_week
      FROM fantasy_metrics_weekly_mv
    `);

    const stats = (statResult.rows as any[])[0] || { row_count: 0, latest_season: null, latest_week: null };

    return res.json({
      success: true,
      refreshedAt: new Date().toISOString(),
      stats,
    });
  } catch (error: any) {
    console.error("[FantasyLab] refresh failed", error);
    return res.status(500).json({ success: false, error: error?.message ?? "Unknown error" });
  }
});

export default router;
