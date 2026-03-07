import { Router, Request, Response } from "express";
import { db } from "../../infra/db";
import { catalystScores } from "@shared/schema";
import { eq, and, desc, sql } from "drizzle-orm";

const router = Router();

router.get("/api/catalyst/batch", async (req: Request, res: Response) => {
  const position = (req.query.position as string || "QB").toUpperCase();
  const season = parseInt(req.query.season as string) || 2025;
  const limit = Math.min(parseInt(req.query.limit as string) || 100, 200);

  const validPositions = ["QB", "RB", "WR", "TE"];
  if (!validPositions.includes(position)) {
    return res.status(400).json({ error: `Invalid position. Must be one of: ${validPositions.join(", ")}` });
  }

  const maxWeekResult = await db.execute(
    sql`SELECT MAX(week) as max_week FROM catalyst_scores WHERE season = ${season} AND position = ${position}`
  );
  const maxWeek = maxWeekResult.rows?.[0]?.max_week;
  if (!maxWeek) {
    return res.json({ players: [], season, position, week: 0 });
  }

  const players = await db
    .select()
    .from(catalystScores)
    .where(
      and(
        eq(catalystScores.season, season),
        eq(catalystScores.position, position),
        eq(catalystScores.week, Number(maxWeek))
      )
    )
    .orderBy(desc(catalystScores.catalystAlpha))
    .limit(limit);

  res.json({
    players: players.map((p: typeof catalystScores.$inferSelect) => ({
      gsis_id: p.gsisId,
      player_name: p.playerName,
      position: p.position,
      team: p.team,
      catalyst_raw: p.catalystRaw,
      catalyst_alpha: p.catalystAlpha,
      components: p.components,
    })),
    season,
    position,
    week: Number(maxWeek),
    total: players.length,
  });
});

router.get("/api/catalyst/player/:gsisId", async (req: Request, res: Response) => {
  const { gsisId } = req.params;
  const season = parseInt(req.query.season as string) || 2025;

  const weeklyScores = await db
    .select()
    .from(catalystScores)
    .where(
      and(
        eq(catalystScores.gsisId, gsisId),
        eq(catalystScores.season, season)
      )
    )
    .orderBy(catalystScores.week);

  if (weeklyScores.length === 0) {
    return res.status(404).json({ error: "Player not found for this season" });
  }

  const latest = weeklyScores[weeklyScores.length - 1];

  res.json({
    gsis_id: gsisId,
    player_name: latest.playerName,
    position: latest.position,
    team: latest.team,
    season,
    catalyst_raw: latest.catalystRaw,
    catalyst_alpha: latest.catalystAlpha,
    components: latest.components,
    weekly: weeklyScores.map((w: typeof catalystScores.$inferSelect) => ({
      week: w.week,
      catalyst_raw: w.catalystRaw,
      catalyst_alpha: w.catalystAlpha,
      components: w.components,
    })),
  });
});

router.get("/api/catalyst/yoy", async (req: Request, res: Response) => {
  const position = (req.query.position as string || "QB").toUpperCase();
  const limit = Math.min(parseInt(req.query.limit as string) || 25, 50);

  const validPositions = ["QB", "RB", "WR", "TE"];
  if (!validPositions.includes(position)) {
    return res.status(400).json({ error: `Invalid position. Must be one of: ${validPositions.join(", ")}` });
  }

  const result = await db.execute(sql`
    WITH base_2024 AS (
      SELECT
        cs.gsis_id,
        cs.player_name,
        cs.position,
        cs.team AS team_2024,
        cs.catalyst_alpha AS alpha_2024,
        cs.catalyst_raw AS raw_2024
      FROM catalyst_scores cs
      WHERE cs.season = 2024
        AND cs.position = ${position}
        AND cs.week = (
          SELECT MAX(week) FROM catalyst_scores
          WHERE season = 2024 AND position = ${position}
        )
      ORDER BY cs.catalyst_alpha DESC
      LIMIT ${limit}
    ),
    base_2025 AS (
      SELECT
        cs.gsis_id,
        cs.team AS team_2025,
        cs.catalyst_alpha AS alpha_2025,
        cs.catalyst_raw AS raw_2025
      FROM catalyst_scores cs
      WHERE cs.season = 2025
        AND cs.position = ${position}
        AND cs.week = (
          SELECT MAX(week) FROM catalyst_scores
          WHERE season = 2025 AND position = ${position}
        )
    )
    SELECT
      b24.gsis_id,
      b24.player_name,
      b24.position,
      b24.team_2024,
      COALESCE(b25.team_2025, b24.team_2024) AS team_2025,
      b24.alpha_2024,
      b24.raw_2024,
      b25.alpha_2025,
      b25.raw_2025,
      CASE WHEN b25.alpha_2025 IS NOT NULL
        THEN ROUND((b25.alpha_2025 - b24.alpha_2024)::numeric, 1)
        ELSE NULL
      END AS delta
    FROM base_2024 b24
    LEFT JOIN base_2025 b25 ON b24.gsis_id = b25.gsis_id
    ORDER BY b24.alpha_2024 DESC
  `);

  res.json({
    position,
    players: result.rows.map((r: Record<string, unknown>) => ({
      gsis_id: r.gsis_id,
      player_name: r.player_name,
      position: r.position,
      team_2024: r.team_2024,
      team_2025: r.team_2025,
      alpha_2024: r.alpha_2024 != null ? Number(r.alpha_2024) : null,
      alpha_2025: r.alpha_2025 != null ? Number(r.alpha_2025) : null,
      delta: r.delta != null ? Number(r.delta) : null,
    })),
  });
});

export default router;
