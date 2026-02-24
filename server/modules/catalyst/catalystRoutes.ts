import { Router, Request, Response } from "express";
import { db } from "../../infra/db";
import { catalystScores } from "@shared/schema";
import { eq, and, desc, sql } from "drizzle-orm";

const router = Router();

router.get("/api/catalyst/batch", async (req: Request, res: Response) => {
  const position = (req.query.position as string || "QB").toUpperCase();
  const season = parseInt(req.query.season as string) || 2024;
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
  const season = parseInt(req.query.season as string) || 2024;

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

export default router;
