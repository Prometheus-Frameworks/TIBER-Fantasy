import { Router, Request, Response } from "express";
import { db } from "../infra/db";
import { eq, and, like, gte, lte, desc, or, ilike } from "drizzle-orm";
import {
  datadiveSnapshotMeta,
  datadiveSnapshotPlayerWeek,
  datadiveSnapshotPlayerSeason,
  type DatadiveSnapshotMeta,
  type DatadiveSnapshotPlayerWeek,
  type DatadiveSnapshotPlayerSeason,
} from "@shared/schema";
import { datadiveSnapshotService } from "../services/datadiveSnapshot";

const router = Router();

router.get("/meta/current", async (req: Request, res: Response) => {
  try {
    const latestSnapshot = await datadiveSnapshotService.getLatestOfficialSnapshot();

    if (!latestSnapshot) {
      return res.status(404).json({
        error: "No official snapshot found",
        message: "Run a snapshot first using POST /admin/datadive/run",
      });
    }

    res.json({
      snapshotId: latestSnapshot.id,
      season: latestSnapshot.season,
      week: latestSnapshot.week,
      snapshotAt: latestSnapshot.snapshotAt,
      dataVersion: latestSnapshot.dataVersion,
      rowCount: latestSnapshot.rowCount,
      teamCount: latestSnapshot.teamCount,
      validationPassed: latestSnapshot.validationPassed,
    });
  } catch (error: any) {
    console.error("[DataLab] Error fetching current meta:", error);
    res.status(500).json({ error: error.message });
  }
});

router.get("/player-week", async (req: Request, res: Response) => {
  try {
    const {
      player_id,
      name,
      team_id,
      position,
      season,
      week,
      min_routes,
      min_snaps,
    } = req.query;

    if (!season || !week) {
      return res.status(400).json({
        error: "Missing required parameters",
        required: ["season", "week"],
      });
    }

    const latestSnapshot = await db
      .select()
      .from(datadiveSnapshotMeta)
      .where(
        and(
          eq(datadiveSnapshotMeta.season, Number(season)),
          eq(datadiveSnapshotMeta.week, Number(week)),
          eq(datadiveSnapshotMeta.isOfficial, true)
        )
      )
      .orderBy(desc(datadiveSnapshotMeta.snapshotAt))
      .limit(1);

    if (!latestSnapshot.length) {
      return res.status(404).json({
        error: `No snapshot found for ${season} Week ${week}`,
      });
    }

    const snapshotId = latestSnapshot[0].id;

    const results = await datadiveSnapshotService.getSnapshotPlayerWeek(
      snapshotId,
      {
        playerId: player_id as string | undefined,
        playerName: name as string | undefined,
        teamId: team_id as string | undefined,
        position: position as string | undefined,
        minRoutes: min_routes ? Number(min_routes) : undefined,
        minSnaps: min_snaps ? Number(min_snaps) : undefined,
      }
    );

    res.json({
      snapshotId,
      season: Number(season),
      week: Number(week),
      count: results.length,
      data: results,
    });
  } catch (error: any) {
    console.error("[DataLab] Error fetching player-week:", error);
    res.status(500).json({ error: error.message });
  }
});

router.get("/player-season", async (req: Request, res: Response) => {
  try {
    const { player_id, season } = req.query;

    if (!player_id || !season) {
      return res.status(400).json({
        error: "Missing required parameters",
        required: ["player_id", "season"],
      });
    }

    const result = await datadiveSnapshotService.getSnapshotPlayerSeason(
      player_id as string,
      Number(season)
    );

    if (!result) {
      return res.status(404).json({
        error: `No season data found for player ${player_id} in ${season}`,
      });
    }

    res.json(result);
  } catch (error: any) {
    console.error("[DataLab] Error fetching player-season:", error);
    res.status(500).json({ error: error.message });
  }
});

router.get("/team-week", async (req: Request, res: Response) => {
  try {
    const { team_id, season, week, position } = req.query;

    if (!team_id || !season || !week) {
      return res.status(400).json({
        error: "Missing required parameters",
        required: ["team_id", "season", "week"],
      });
    }

    const latestSnapshot = await db
      .select()
      .from(datadiveSnapshotMeta)
      .where(
        and(
          eq(datadiveSnapshotMeta.season, Number(season)),
          eq(datadiveSnapshotMeta.week, Number(week)),
          eq(datadiveSnapshotMeta.isOfficial, true)
        )
      )
      .orderBy(desc(datadiveSnapshotMeta.snapshotAt))
      .limit(1);

    if (!latestSnapshot.length) {
      return res.status(404).json({
        error: `No snapshot found for ${season} Week ${week}`,
      });
    }

    const snapshotId = latestSnapshot[0].id;

    let query = db
      .select()
      .from(datadiveSnapshotPlayerWeek)
      .where(
        and(
          eq(datadiveSnapshotPlayerWeek.snapshotId, snapshotId),
          eq(datadiveSnapshotPlayerWeek.teamId, team_id as string)
        )
      );

    let results = await query;

    if (position) {
      results = results.filter(
        (r) => r.position?.toUpperCase() === (position as string).toUpperCase()
      );
    }

    res.json({
      snapshotId,
      teamId: team_id,
      season: Number(season),
      week: Number(week),
      count: results.length,
      data: results,
    });
  } catch (error: any) {
    console.error("[DataLab] Error fetching team-week:", error);
    res.status(500).json({ error: error.message });
  }
});

router.get("/search", async (req: Request, res: Response) => {
  try {
    const {
      q,
      season,
      week,
      position,
      min_routes,
      min_snaps,
      limit = "50",
      offset = "0",
    } = req.query;

    if (!season || !week) {
      return res.status(400).json({
        error: "Missing required parameters",
        required: ["season", "week"],
      });
    }

    const latestSnapshot = await db
      .select()
      .from(datadiveSnapshotMeta)
      .where(
        and(
          eq(datadiveSnapshotMeta.season, Number(season)),
          eq(datadiveSnapshotMeta.week, Number(week)),
          eq(datadiveSnapshotMeta.isOfficial, true)
        )
      )
      .orderBy(desc(datadiveSnapshotMeta.snapshotAt))
      .limit(1);

    if (!latestSnapshot.length) {
      return res.status(404).json({
        error: `No snapshot found for ${season} Week ${week}`,
      });
    }

    const snapshotId = latestSnapshot[0].id;

    let results = await db
      .select()
      .from(datadiveSnapshotPlayerWeek)
      .where(eq(datadiveSnapshotPlayerWeek.snapshotId, snapshotId));

    if (q) {
      const searchTerm = (q as string).toLowerCase();
      results = results.filter(
        (r) =>
          r.playerName.toLowerCase().includes(searchTerm) ||
          r.teamId?.toLowerCase().includes(searchTerm)
      );
    }

    if (position) {
      const pos = (position as string).toUpperCase();
      results = results.filter((r) => r.position?.toUpperCase() === pos);
    }

    if (min_routes) {
      const minRoutes = Number(min_routes);
      results = results.filter((r) => (r.routes || 0) >= minRoutes);
    }

    if (min_snaps) {
      const minSnaps = Number(min_snaps);
      results = results.filter((r) => (r.snaps || 0) >= minSnaps);
    }

    results.sort((a, b) => (b.fptsPpr || 0) - (a.fptsPpr || 0));

    const total = results.length;
    const limitNum = Math.min(Number(limit), 100);
    const offsetNum = Number(offset);
    const paginatedResults = results.slice(offsetNum, offsetNum + limitNum);

    res.json({
      snapshotId,
      season: Number(season),
      week: Number(week),
      total,
      limit: limitNum,
      offset: offsetNum,
      data: paginatedResults,
    });
  } catch (error: any) {
    console.error("[DataLab] Error in search:", error);
    res.status(500).json({ error: error.message });
  }
});

router.post("/admin/run", async (req: Request, res: Response) => {
  try {
    const { season, week, dataVersion = "v1", triggeredBy = "admin" } = req.body;

    if (!season || !week) {
      return res.status(400).json({
        error: "Missing required parameters",
        required: ["season", "week"],
        optional: ["dataVersion", "triggeredBy"],
      });
    }

    console.log(
      `🚀 [DataLab Admin] Triggering snapshot for ${season} Week ${week}...`
    );

    const result = await datadiveSnapshotService.runWeeklySnapshot(
      Number(season),
      Number(week),
      dataVersion,
      triggeredBy
    );

    res.json({
      success: true,
      message: `Snapshot ${result.snapshotId} created successfully`,
      ...result,
    });
  } catch (error: any) {
    console.error("[DataLab Admin] Snapshot failed:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

router.get("/health", async (req: Request, res: Response) => {
  try {
    const latestSnapshot = await datadiveSnapshotService.getLatestOfficialSnapshot();
    const counts = await datadiveSnapshotService.getTableCounts();

    res.json({
      status: "healthy",
      latestSnapshot: latestSnapshot
        ? {
            id: latestSnapshot.id,
            season: latestSnapshot.season,
            week: latestSnapshot.week,
            snapshotAt: latestSnapshot.snapshotAt,
            rowCount: latestSnapshot.rowCount,
          }
        : null,
      tableCounts: counts,
    });
  } catch (error: any) {
    console.error("[DataLab] Health check error:", error);
    res.status(500).json({
      status: "error",
      error: error.message,
    });
  }
});

export default router;
