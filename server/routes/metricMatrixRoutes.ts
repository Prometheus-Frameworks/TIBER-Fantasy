import { Router } from "express";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { getPlayerVector } from "../modules/metricMatrix/playerVectorService";
import { db } from "../infra/db";

const router = Router();

const QuerySchema = z.object({
  playerId: z.string().min(1, "playerId is required"),
  season: z.coerce.number().min(2000).max(2100).optional(),
  week: z.coerce.number().min(1).max(18).optional(),
  mode: z.enum(["forge"]).optional().default("forge"),
});

const CoverageQuerySchema = z.object({
  season: z.coerce.number().min(2000).max(2100),
  week: z.coerce.number().min(1).max(18).optional(),
});

router.get("/coverage", async (req, res) => {
  try {
    const parsed = CoverageQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
    }

    const { season, week } = parsed.data;

    const weekFilter = week ? sql`AND pu.week = ${week}` : sql``;

    const coverageResultRaw = await db.execute(sql`
      SELECT 
        COUNT(*) as total_rows,
        COUNT(snap_share_pct) as snap_share_non_null,
        COUNT(target_share_pct) as target_share_non_null
      FROM player_usage pu
      WHERE pu.season = ${season} ${weekFilter}
    `);
    const coverageRows = (coverageResultRaw as any).rows || [];
    const coverageResult = coverageRows[0] as { total_rows: string; snap_share_non_null: string; target_share_non_null: string } | undefined;

    const total = parseInt(coverageResult?.total_rows || "0");
    const snapNonNull = parseInt(coverageResult?.snap_share_non_null || "0");
    const targetNonNull = parseInt(coverageResult?.target_share_non_null || "0");

    const missingSnapShareRowsRaw = await db.execute(sql`
      SELECT DISTINCT pu.player_id, ws.team, ws.position, pu.week
      FROM player_usage pu
      LEFT JOIN weekly_stats ws ON pu.player_id = ws.player_id AND pu.season = ws.season AND pu.week = ws.week
      WHERE pu.season = ${season} ${weekFilter}
        AND pu.snap_share_pct IS NULL
      ORDER BY ws.team, ws.position, pu.player_id
      LIMIT 20
    `);
    const missingSnapShareRows = ((missingSnapShareRowsRaw as any).rows || []) as Array<{ player_id: string; team: string | null; position: string | null; week: number }>;

    const missingByTeamPosition: Record<string, string[]> = {};
    for (const row of missingSnapShareRows) {
      const key = `${row.team || "UNK"}_${row.position || "UNK"}`;
      if (!missingByTeamPosition[key]) missingByTeamPosition[key] = [];
      missingByTeamPosition[key].push(`${row.player_id} (wk${row.week})`);
    }

    res.json({
      success: true,
      data: {
        season,
        week: week || "all",
        totalRows: total,
        coverage: {
          snap_share_pct: {
            count: snapNonNull,
            pct: total > 0 ? Math.round((snapNonNull / total) * 10000) / 100 : 0,
          },
          target_share_pct: {
            count: targetNonNull,
            pct: total > 0 ? Math.round((targetNonNull / total) * 10000) / 100 : 0,
          },
        },
        missingSnapShareSample: missingByTeamPosition,
        missingCount: total - snapNonNull,
      },
    });
  } catch (error) {
    console.error("[MetricMatrix] coverage error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to compute coverage stats",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

router.get("/player-vector", async (req, res) => {
  try {
    const parsed = QuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
    }

    const payload = await getPlayerVector(parsed.data);
    res.json({ success: true, data: payload });
  } catch (error) {
    console.error("[MetricMatrix] player-vector error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to compute player vector",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

export default router;
