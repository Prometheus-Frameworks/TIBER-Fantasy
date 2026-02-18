import { Router, Request, Response } from "express";
import { db } from "../../infra/db";
import { eq, and, desc, gte, sql } from "drizzle-orm";
import { idpPlayerSeason, idpPlayerWeek } from "@shared/schema";
import {
  IDP_POSITION_GROUPS,
  LEADERBOARD_MIN_SNAPS,
  type IdpPositionGroup,
} from "@shared/idpSchema";
import {
  aggregateAndScoreSeason,
  computePositionBaselines,
} from "./havocEngine";

const router = Router();

router.get("/rankings", async (req: Request, res: Response) => {
  try {
    const season = parseInt(req.query.season as string) || 2024;
    const posGroup = req.query.position as string | undefined;
    const minSnaps = parseInt(req.query.minSnaps as string) || LEADERBOARD_MIN_SNAPS;
    const limit = Math.min(parseInt(req.query.limit as string) || 100, 500);
    const offset = parseInt(req.query.offset as string) || 0;

    const conditions = [eq(idpPlayerSeason.season, season)];

    if (posGroup && IDP_POSITION_GROUPS.includes(posGroup as IdpPositionGroup)) {
      conditions.push(eq(idpPlayerSeason.positionGroup, posGroup));
    }

    const rows = await db
      .select()
      .from(idpPlayerSeason)
      .where(and(...conditions))
      .orderBy(desc(idpPlayerSeason.havocIndex))
      .limit(limit)
      .offset(offset);

    const total = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(idpPlayerSeason)
      .where(and(...conditions));

    const results = rows.map((r, i) => ({
      rank: offset + i + 1,
      ...r,
      lowConfidence: r.totalSnaps < minSnaps,
      meetsSnapThreshold: r.totalSnaps >= minSnaps,
    }));

    res.json({
      season,
      positionGroup: posGroup || "ALL",
      minSnaps,
      total: Number(total[0]?.count || 0),
      results,
    });
  } catch (err: any) {
    console.error("[IDP] Rankings error:", err);
    res.status(500).json({ error: "Failed to fetch rankings" });
  }
});

router.get("/player/:gsisId", async (req: Request, res: Response) => {
  try {
    const { gsisId } = req.params;
    const season = parseInt(req.query.season as string) || 2024;

    const seasonRow = await db
      .select()
      .from(idpPlayerSeason)
      .where(
        and(eq(idpPlayerSeason.gsisId, gsisId), eq(idpPlayerSeason.season, season))
      )
      .limit(1);

    if (!seasonRow.length) {
      return res.status(404).json({ error: "Player not found" });
    }

    const weeklyRows = await db
      .select()
      .from(idpPlayerWeek)
      .where(
        and(eq(idpPlayerWeek.gsisId, gsisId), eq(idpPlayerWeek.season, season))
      )
      .orderBy(idpPlayerWeek.week);

    res.json({
      season: seasonRow[0],
      weekly: weeklyRows,
      lowConfidence: seasonRow[0].totalSnaps < LEADERBOARD_MIN_SNAPS,
    });
  } catch (err: any) {
    console.error("[IDP] Player detail error:", err);
    res.status(500).json({ error: "Failed to fetch player" });
  }
});

router.get("/export/csv", async (req: Request, res: Response) => {
  try {
    const season = parseInt(req.query.season as string) || 2024;
    const posGroup = req.query.position as string | undefined;

    const conditions = [eq(idpPlayerSeason.season, season)];
    if (posGroup && IDP_POSITION_GROUPS.includes(posGroup as IdpPositionGroup)) {
      conditions.push(eq(idpPlayerSeason.positionGroup, posGroup));
    }

    const rows = await db
      .select()
      .from(idpPlayerSeason)
      .where(and(...conditions))
      .orderBy(desc(idpPlayerSeason.havocIndex));

    const headers = [
      "Rank", "Player", "Team", "Position", "PosGroup", "Games", "Snaps",
      "Solo", "Ast", "Total", "Sacks", "TFL", "INT", "PD", "FF", "FR",
      "QBHits", "HavocEvents", "HavocIndex", "Tier", "LowConfidence",
    ];

    const csvRows = rows.map((r, i) =>
      [
        i + 1, r.playerName, r.team, r.nflPosition, r.positionGroup,
        r.games, r.totalSnaps,
        r.tacklesSolo, r.tacklesAssist, r.tacklesTotal,
        r.sacks, r.tacklesForLoss, r.interceptions, r.passesDefended,
        r.forcedFumbles, r.fumbleRecoveries,
        r.qbHits ?? "", r.totalHavocEvents,
        r.havocIndex?.toFixed(1) ?? "", r.havocTier,
        r.totalSnaps < LEADERBOARD_MIN_SNAPS ? "YES" : "",
      ].join(",")
    );

    const csv = [headers.join(","), ...csvRows].join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="idp_rankings_${season}.csv"`
    );
    res.send(csv);
  } catch (err: any) {
    console.error("[IDP] CSV export error:", err);
    res.status(500).json({ error: "Failed to export" });
  }
});

router.get("/similar/:gsisId", (_req: Request, res: Response) => {
  res.status(501).json({
    error: "Not Implemented",
    message:
      "Defensive DNA vectors are not available in MVP. Similar players endpoint will be available in Phase 2.",
  });
});

router.post("/compute", async (req: Request, res: Response) => {
  try {
    const season = parseInt(req.query.season as string) || 2024;
    const result = await aggregateAndScoreSeason(season);
    res.json({
      success: true,
      scored: result.scored,
      baselines: result.baselines,
    });
  } catch (err: any) {
    console.error("[IDP] Compute error:", err);
    res.status(500).json({ error: "Failed to compute scores" });
  }
});

router.post("/baselines", async (req: Request, res: Response) => {
  try {
    const season = parseInt(req.query.season as string) || 2024;
    const baselines = await computePositionBaselines(season);
    res.json({ success: true, baselines });
  } catch (err: any) {
    console.error("[IDP] Baselines error:", err);
    res.status(500).json({ error: "Failed to compute baselines" });
  }
});

export default router;
