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
import { runAutoWeeklySnapshotForSeason, getAutoSnapshotStatus } from "../services/datadiveAuto";

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

/**
 * Normalize a search query for flexible matching.
 * Handles: casing, spaces, periods, dashes, and common name variations.
 */
function normalizeSearchQuery(query: string): string {
  return query
    .toLowerCase()
    .replace(/[.\-']/g, '') // Remove periods, dashes, apostrophes
    .replace(/\s+/g, ' ')   // Normalize multiple spaces
    .trim();
}

/**
 * Check if a player name matches a search term.
 * Uses normalized comparison for flexible matching.
 */
function playerNameMatches(playerName: string, searchTerm: string): boolean {
  const normalizedName = normalizeSearchQuery(playerName);
  const normalizedSearch = normalizeSearchQuery(searchTerm);
  
  // Direct substring match
  if (normalizedName.includes(normalizedSearch)) {
    return true;
  }
  
  // Split search into words and check if all words appear in name
  const searchWords = normalizedSearch.split(' ').filter(w => w.length > 0);
  if (searchWords.length > 1) {
    return searchWords.every(word => normalizedName.includes(word));
  }
  
  return false;
}

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

    // Apply search filter with flexible matching
    if (q && (q as string).trim().length > 0) {
      const searchTerm = (q as string).trim();
      results = results.filter(
        (r) =>
          playerNameMatches(r.playerName, searchTerm) ||
          r.teamId?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply position filter - skip if 'ALL' or empty
    if (position && (position as string).toUpperCase() !== 'ALL') {
      const pos = (position as string).toUpperCase();
      results = results.filter((r) => r.position?.toUpperCase() === pos);
    }

    // Apply minimum routes filter - only if > 0
    if (min_routes && Number(min_routes) > 0) {
      const minRoutes = Number(min_routes);
      results = results.filter((r) => (r.routes || 0) >= minRoutes);
    }

    // Apply minimum snaps filter - only if > 0
    if (min_snaps && Number(min_snaps) > 0) {
      const minSnaps = Number(min_snaps);
      results = results.filter((r) => (r.snaps || 0) >= minSnaps);
    }

    // Sort by PPR fantasy points descending
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

router.post("/admin/auto-run", async (req: Request, res: Response) => {
  try {
    const { season } = req.body;
    const targetSeason = season ?? new Date().getFullYear();

    console.log(`🚀 [DataLab Admin] Auto-run triggered for season ${targetSeason}`);

    const result = await runAutoWeeklySnapshotForSeason(targetSeason);
    
    if (!result) {
      return res.json({
        status: 'NO_NEW_WEEK',
        message: 'No newer week found in weekly_stats',
        season: targetSeason,
      });
    }
    
    res.json({
      status: 'SNAPSHOT_CREATED',
      message: `Snapshot ${result.snapshotId} created for Week ${result.week}`,
      ...result,
    });
  } catch (error: any) {
    console.error("[DataLab Admin] Auto-run failed:", error);
    res.status(500).json({
      status: 'ERROR',
      message: error.message ?? String(error),
    });
  }
});

router.get("/admin/auto-status", async (req: Request, res: Response) => {
  try {
    const { season } = req.query;
    const targetSeason = season ? Number(season) : new Date().getFullYear();

    const status = await getAutoSnapshotStatus(targetSeason);
    
    res.json({
      status: 'OK',
      ...status,
    });
  } catch (error: any) {
    console.error("[DataLab Admin] Auto-status failed:", error);
    res.status(500).json({
      status: 'ERROR',
      message: error.message ?? String(error),
    });
  }
});

export default router;
