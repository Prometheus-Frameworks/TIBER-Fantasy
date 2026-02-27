import { Router, Request, Response } from "express";
import { db } from "../../../infra/db";
import { eq, and, like, gte, lte, desc, or, ilike, sql } from "drizzle-orm";
import {
  datadiveSnapshotMeta,
  datadiveSnapshotPlayerWeek,
  datadiveSnapshotPlayerSeason,
  type DatadiveSnapshotMeta,
  type DatadiveSnapshotPlayerWeek,
  type DatadiveSnapshotPlayerSeason,
} from "@shared/schema";
import { datadiveSnapshotService } from "../../../services/datadiveSnapshot";
import { runAutoWeeklySnapshotForSeason, getAutoSnapshotStatus } from "../../../services/datadiveAuto";
import { getAggregatedExpectedFantasy } from "../../../services/xFptsService";
import { getDSTStreamer } from "../../dstStreamer";

const router = Router();

/**
 * Performance Tag Configuration for xFPGoe Analysis
 * Used to classify players as RISER, FALLER, or NEUTRAL based on actual vs expected performance
 */
const performanceTagConfig = {
  minGames: 3,           // Minimum games for stable tag
  riserThreshold: 3.0,   // +3 PPR/G over expectation = RISER
  fallerThreshold: -3.0, // -3 PPR/G under expectation = FALLER
  neutralBand: 1.0,      // -1 < Δ < +1 = explicit NEUTRAL
};

/**
 * Expected Points Per Opportunity coefficients by position (PPR scoring)
 * Based on league-average production rates
 * ppt = points per target, ppr = points per rush
 */
const xFptsCoefficients = {
  WR: { ppt: 1.85, ppr: 0.0 },   // WRs: high target value, no rush expectation
  TE: { ppt: 1.65, ppr: 0.0 },   // TEs: slightly lower target value, no rush expectation
  RB: { ppt: 1.50, ppr: 0.85 },  // RBs: targets + rushes (1.50 PPT + 0.85 PPR)
  QB: { ppt: 0.0, ppr: 0.0 },    // QBs: different scoring model (passing excluded)
};

// Whitelisted positions for all snapshot query parameters — never use raw user input in SQL
const VALID_SNAPSHOT_POSITIONS = ['QB', 'RB', 'WR', 'TE'] as const;

export type PerformanceTag = "RISER" | "FALLER" | "NEUTRAL" | null;

/**
 * Calculate expected PPR fantasy points based on opportunity volume
 * xPPR = (targets × ppt) + (rush_attempts × ppr)
 */
export function calculateXFptsPpr(
  targets: number,
  rushAttempts: number,
  position: string
): number {
  const coeffs = xFptsCoefficients[position as keyof typeof xFptsCoefficients];
  if (!coeffs) return 0;
  
  return (targets * coeffs.ppt) + (rushAttempts * coeffs.ppr);
}

/**
 * Determine performance tag based on xFPGoe (actual vs expected PPR/G)
 * Returns null if insufficient games for stable classification
 */
export function getPerformanceTag(
  xfpgoe: number,
  gamesPlayed: number
): PerformanceTag {
  if (gamesPlayed < performanceTagConfig.minGames) return null;

  if (xfpgoe >= performanceTagConfig.riserThreshold) return "RISER";
  if (xfpgoe <= performanceTagConfig.fallerThreshold) return "FALLER";
  if (Math.abs(xfpgoe) < performanceTagConfig.neutralBand) return "NEUTRAL";

  return "NEUTRAL";
}

router.get("/meta/current", async (req: Request, res: Response) => {
  try {
    const latestSnapshot = await datadiveSnapshotService.getLatestOfficialSnapshot();

    if (!latestSnapshot) {
      return res.status(404).json({
        error: "No official snapshot found",
        message: "Run a snapshot first using POST /admin/datadive/run",
      });
    }

    // Get available weeks for the current season
    const availableWeeksResult = await db.execute(sql`
      SELECT DISTINCT week
      FROM datadive_snapshot_meta
      WHERE season = ${latestSnapshot.season}
        AND is_official = true
        AND validation_passed = true
      ORDER BY week
    `);
    const availableWeeks = (availableWeeksResult.rows as any[]).map(r => r.week);

    res.json({
      snapshotId: latestSnapshot.id,
      season: latestSnapshot.season,
      week: latestSnapshot.week,
      snapshotAt: latestSnapshot.snapshotAt,
      dataVersion: latestSnapshot.dataVersion,
      rowCount: latestSnapshot.rowCount,
      teamCount: latestSnapshot.teamCount,
      validationPassed: latestSnapshot.validationPassed,
      availableWeeks,
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

    // Use valid snapshot selection - pick snapshot with most players having routes > 0
    const validSnapshotResult = await db.execute(sql`
      WITH snapshot_quality AS (
        SELECT sm.id, sm.snapshot_at,
               (SELECT COUNT(*) FROM datadive_snapshot_player_week spw 
                WHERE spw.snapshot_id = sm.id AND spw.week = sm.week AND spw.routes > 0) as player_count
        FROM datadive_snapshot_meta sm
        WHERE sm.season = ${Number(season)}
          AND sm.week = ${Number(week)}
          AND sm.is_official = true
      )
      SELECT id FROM snapshot_quality
      WHERE player_count > 0
      ORDER BY player_count DESC, snapshot_at DESC
      LIMIT 1
    `);

    const snapshotRows = validSnapshotResult.rows as any[];
    if (!snapshotRows.length) {
      return res.status(404).json({
        error: `No valid snapshot found for ${season} Week ${week}`,
      });
    }

    const snapshotId = snapshotRows[0].id;

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

    // Use valid snapshot selection - pick snapshot with most players having routes > 0
    const validSnapshotResult = await db.execute(sql`
      WITH snapshot_quality AS (
        SELECT sm.id, sm.snapshot_at,
               (SELECT COUNT(*) FROM datadive_snapshot_player_week spw 
                WHERE spw.snapshot_id = sm.id AND spw.week = sm.week AND spw.routes > 0) as player_count
        FROM datadive_snapshot_meta sm
        WHERE sm.season = ${Number(season)}
          AND sm.week = ${Number(week)}
          AND sm.is_official = true
      )
      SELECT id FROM snapshot_quality
      WHERE player_count > 0
      ORDER BY player_count DESC, snapshot_at DESC
      LIMIT 1
    `);

    const snapshotRows = validSnapshotResult.rows as any[];
    if (!snapshotRows.length) {
      return res.status(404).json({
        error: `No valid snapshot found for ${season} Week ${week}`,
      });
    }

    const snapshotId = snapshotRows[0].id;

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

    // Use valid snapshot selection - pick snapshot with most players having routes > 0
    const validSnapshotResult = await db.execute(sql`
      WITH snapshot_quality AS (
        SELECT sm.id, sm.snapshot_at,
               (SELECT COUNT(*) FROM datadive_snapshot_player_week spw 
                WHERE spw.snapshot_id = sm.id AND spw.week = sm.week AND spw.routes > 0) as player_count
        FROM datadive_snapshot_meta sm
        WHERE sm.season = ${Number(season)}
          AND sm.week = ${Number(week)}
          AND sm.is_official = true
      )
      SELECT id FROM snapshot_quality
      WHERE player_count > 0
      ORDER BY player_count DESC, snapshot_at DESC
      LIMIT 1
    `);

    const snapshotRows = validSnapshotResult.rows as any[];
    if (!snapshotRows.length) {
      return res.status(404).json({
        error: `No valid snapshot found for ${season} Week ${week}`,
      });
    }

    const snapshotId = snapshotRows[0].id;

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

/**
 * Usage Aggregation Endpoint
 * Supports: single week, season-to-date, and custom week ranges
 * 
 * Query params:
 * - season (required): The NFL season year
 * - weekMode: "single" | "range" | "season" (default: "single")
 * - week: For single mode (required if weekMode=single)
 * - weekFrom, weekTo: For range mode
 * - position: Filter by position (WR, RB, TE, QB)
 * - minRoutes: Minimum routes to include (default: 10 for aggregates)
 * - performanceFilter: "RISER" | "FALLER" | "NEUTRAL" - Filter by xFPGoe performance tag
 * 
 * New fields (season/range modes):
 * - xPprPerGame: Expected PPR points per game based on opportunity volume
 * - xFPGoePprPerGame: Actual PPR/G minus expected (positive = outperforming)
 * - performanceTag: "RISER" | "FALLER" | "NEUTRAL" | null (min 3 games required)
 */
router.get("/usage-agg", async (req: Request, res: Response) => {
  try {
    const {
      season,
      weekMode = "single",
      week,
      weekFrom,
      weekTo,
      position,
      minRoutes = "10",
      limit = "100",
      performanceFilter,
    } = req.query;

    if (!season) {
      return res.status(400).json({
        error: "Missing required parameter: season",
        required: ["season"],
        optional: ["weekMode", "week", "weekFrom", "weekTo", "position", "minRoutes"],
      });
    }

    const seasonNum = Number(season);
    const minRoutesNum = Number(minRoutes);
    const limitNum = Math.min(Number(limit), 200);

    // Determine week range based on mode
    let startWeek: number;
    let endWeek: number;
    let modeLabel: string;

    if (weekMode === "season") {
      // Season mode: Week 1 to latest snapshot week
      const latestSnapshot = await datadiveSnapshotService.getLatestOfficialSnapshot();
      if (!latestSnapshot || latestSnapshot.season !== seasonNum) {
        return res.status(404).json({
          error: `No snapshot found for season ${seasonNum}`,
        });
      }
      startWeek = 1;
      endWeek = latestSnapshot.week;
      modeLabel = `Season ${seasonNum} (Weeks 1-${endWeek})`;
    } else if (weekMode === "range") {
      if (!weekFrom || !weekTo) {
        return res.status(400).json({
          error: "Range mode requires weekFrom and weekTo parameters",
        });
      }
      startWeek = Number(weekFrom);
      endWeek = Number(weekTo);
      modeLabel = `Weeks ${startWeek}-${endWeek}`;
    } else {
      // Single week mode (default)
      if (!week) {
        return res.status(400).json({
          error: "Single week mode requires week parameter",
        });
      }
      startWeek = Number(week);
      endWeek = Number(week);
      modeLabel = `Week ${week}`;
    }

    // Parameterized position filter — whitelist prevents SQL injection
    const posUpper = position ? (position as string).toUpperCase() : null;
    const positionFilter = posUpper && posUpper !== 'ALL' && VALID_SNAPSHOT_POSITIONS.includes(posUpper as any)
      ? sql`AND spw.position = ${posUpper}`
      : sql``;

    const result = await db.execute(sql`
      WITH valid_snapshots AS (
        SELECT sm.id, sm.week, sm.snapshot_at,
               (SELECT COUNT(*) FROM datadive_snapshot_player_week spw 
                WHERE spw.snapshot_id = sm.id AND spw.week = sm.week AND spw.routes > 0) as player_count
        FROM datadive_snapshot_meta sm
        WHERE sm.season = ${seasonNum}
          AND sm.week BETWEEN ${startWeek} AND ${endWeek}
          AND sm.is_official = true
      ),
      snapshot_weeks AS (
        SELECT DISTINCT ON (week) id as snapshot_id, week
        FROM valid_snapshots
        WHERE player_count > 0
        ORDER BY week, player_count DESC, snapshot_at DESC
      ),
      player_agg AS (
        SELECT 
          spw.player_id,
          MAX(spw.player_name) as player_name,
          MAX(spw.team_id) as team_id,
          MAX(spw.position) as position,
          COUNT(DISTINCT sw.week) FILTER (WHERE COALESCE(spw.snaps, 0) > 0 OR COALESCE(spw.routes, 0) > 0) as games_played,
          SUM(COALESCE(spw.snaps, 0)) as total_snaps,
          AVG(spw.snap_share) as avg_snap_share,
          SUM(COALESCE(spw.routes, 0)) as total_routes,
          AVG(spw.route_rate) as avg_route_rate,
          SUM(COALESCE(spw.targets, 0)) as total_targets,
          AVG(spw.target_share) as avg_target_share,
          SUM(COALESCE(spw.receptions, 0)) as total_receptions,
          SUM(COALESCE(spw.rec_yards, 0)) as total_rec_yards,
          SUM(COALESCE(spw.rec_tds, 0)) as total_rec_tds,
          AVG(spw.adot) as avg_adot,
          SUM(COALESCE(spw.air_yards, 0)) as total_air_yards,
          SUM(COALESCE(spw.yac, 0)) as total_yac,
          AVG(spw.epa_per_target) as avg_epa_per_target,
          AVG(spw.success_rate) as avg_success_rate,
          SUM(COALESCE(spw.rush_attempts, 0)) as total_rush_attempts,
          SUM(COALESCE(spw.rush_yards, 0)) as total_rush_yards,
          SUM(COALESCE(spw.rush_tds, 0)) as total_rush_tds,
          AVG(spw.yards_per_carry) as avg_ypc,
          AVG(spw.rush_epa_per_play) as avg_rush_epa,
          SUM(COALESCE(spw.fpts_std, 0)) as total_fpts_std,
          SUM(COALESCE(spw.fpts_half, 0)) as total_fpts_half,
          SUM(COALESCE(spw.fpts_ppr, 0)) as total_fpts_ppr
        FROM snapshot_weeks sw
        JOIN datadive_snapshot_player_week spw ON spw.snapshot_id = sw.snapshot_id AND spw.week = sw.week
        WHERE 1=1 ${positionFilter}
        GROUP BY spw.player_id
      )
      SELECT 
        player_id,
        player_name,
        team_id,
        position,
        games_played,
        total_snaps,
        ROUND(avg_snap_share::numeric, 3) as avg_snap_share,
        total_routes,
        ROUND(avg_route_rate::numeric, 3) as avg_route_rate,
        total_targets,
        total_receptions,
        total_rec_yards,
        total_rec_tds,
        ROUND(avg_adot::numeric, 2) as avg_adot,
        total_air_yards,
        total_yac,
        ROUND(avg_epa_per_target::numeric, 4) as avg_epa_per_target,
        ROUND(avg_success_rate::numeric, 3) as avg_success_rate,
        total_rush_attempts,
        total_rush_yards,
        total_rush_tds,
        ROUND(avg_ypc::numeric, 2) as avg_ypc,
        ROUND(avg_rush_epa::numeric, 4) as avg_rush_epa,
        ROUND(total_fpts_std::numeric, 1) as total_fpts_std,
        ROUND(total_fpts_half::numeric, 1) as total_fpts_half,
        ROUND(total_fpts_ppr::numeric, 1) as total_fpts_ppr,
        CASE WHEN total_routes > 0 THEN ROUND((total_targets::numeric / total_routes), 4) ELSE 0 END as tprr,
        CASE WHEN total_routes > 0 THEN ROUND((total_rec_yards::numeric / total_routes), 2) ELSE 0 END as yprr,
        CASE WHEN games_played > 0 THEN ROUND((total_routes::numeric / games_played), 1) ELSE 0 END as routes_per_game,
        CASE WHEN games_played > 0 THEN ROUND((total_targets::numeric / games_played), 1) ELSE 0 END as targets_per_game,
        CASE WHEN games_played > 0 THEN ROUND((total_fpts_ppr::numeric / games_played), 1) ELSE 0 END as fpts_ppr_per_game
      FROM player_agg
      WHERE total_routes >= ${minRoutesNum}
      ORDER BY total_fpts_ppr DESC
      LIMIT ${limitNum}
    `);
    const rows = (result as any).rows || [];

    // Fetch xFPTS v2 aggregated data for season/range modes
    const xFptsV2Map = (weekMode === 'season' || weekMode === 'range') 
      ? await getAggregatedExpectedFantasy(seasonNum, startWeek, endWeek, position as string | undefined)
      : new Map();

    // Map rows and calculate xFPTS metrics (use v2 with v1 fallback)
    let mappedData = rows.map((row: any) => {
      const gamesPlayed = Number(row.games_played) || 0;
      const totalTargets = Number(row.total_targets) || 0;
      const totalRushAttempts = Number(row.total_rush_attempts) || 0;
      const totalFptsPpr = Number(row.total_fpts_ppr) || 0;
      const pos = row.position || 'WR';
      
      // Get v2 data if available, otherwise use v1 calculation
      const v2Data = xFptsV2Map.get(row.player_id);
      let xPprPerGame: number;
      let xFPGoePprPerGame: number;
      
      if (v2Data && v2Data.gamesWithData > 0) {
        // Use v2 aggregated data from datadive_expected_fantasy_week
        xPprPerGame = v2Data.xPpr / v2Data.gamesWithData;
        xFPGoePprPerGame = v2Data.xfpgoe / v2Data.gamesWithData;
      } else {
        // Fallback to v1 calculation if no v2 data available
        const xFptsPprTotal = calculateXFptsPpr(totalTargets, totalRushAttempts, pos);
        const pprPerGame = gamesPlayed > 0 ? totalFptsPpr / gamesPlayed : 0;
        xPprPerGame = gamesPlayed > 0 ? xFptsPprTotal / gamesPlayed : 0;
        xFPGoePprPerGame = pprPerGame - xPprPerGame;
      }
      
      const pprPerGame = gamesPlayed > 0 ? totalFptsPpr / gamesPlayed : 0;
      
      // Get performance tag for season/range modes
      const performanceTag = (weekMode === 'season' || weekMode === 'range')
        ? getPerformanceTag(xFPGoePprPerGame, gamesPlayed)
        : null;
      
      return {
        playerId: row.player_id,
        playerName: row.player_name,
        teamId: row.team_id,
        position: row.position,
        gamesPlayed,
        totalSnaps: Number(row.total_snaps) || 0,
        avgSnapShare: row.avg_snap_share ? Number(row.avg_snap_share) : null,
        totalRoutes: Number(row.total_routes) || 0,
        avgRouteRate: row.avg_route_rate ? Number(row.avg_route_rate) : null,
        totalTargets,
        totalReceptions: Number(row.total_receptions) || 0,
        totalRecYards: Number(row.total_rec_yards) || 0,
        totalRecTds: Number(row.total_rec_tds) || 0,
        avgAdot: row.avg_adot ? Number(row.avg_adot) : null,
        totalAirYards: Number(row.total_air_yards) || 0,
        totalYac: Number(row.total_yac) || 0,
        avgEpaPerTarget: row.avg_epa_per_target ? Number(row.avg_epa_per_target) : null,
        avgSuccessRate: row.avg_success_rate ? Number(row.avg_success_rate) : null,
        totalRushAttempts,
        totalRushYards: Number(row.total_rush_yards) || 0,
        totalRushTds: Number(row.total_rush_tds) || 0,
        avgYpc: row.avg_ypc ? Number(row.avg_ypc) : null,
        avgRushEpa: row.avg_rush_epa ? Number(row.avg_rush_epa) : null,
        totalFptsStd: Number(row.total_fpts_std) || 0,
        totalFptsHalf: Number(row.total_fpts_half) || 0,
        totalFptsPpr,
        avgTprr: Number(row.tprr) || 0,
        yprr: Number(row.yprr) || 0,
        routesPerGame: Number(row.routes_per_game) || 0,
        targetsPerGame: Number(row.targets_per_game) || 0,
        fptsPprPerGame: Math.round(pprPerGame * 10) / 10,
        xPprPerGame: Math.round(xPprPerGame * 10) / 10,
        xFPGoePprPerGame: Math.round(xFPGoePprPerGame * 10) / 10,
        performanceTag,
      };
    });

    // Apply performanceFilter if provided
    if (performanceFilter && (weekMode === 'season' || weekMode === 'range')) {
      const filterValue = (performanceFilter as string).toUpperCase();
      if (['RISER', 'FALLER', 'NEUTRAL'].includes(filterValue)) {
        mappedData = mappedData.filter((r: { performanceTag: PerformanceTag }) => r.performanceTag === filterValue);
      }
    }

    res.json({
      season: seasonNum,
      weekMode,
      weekRange: { from: startWeek, to: endWeek },
      modeLabel,
      position: position || 'ALL',
      minRoutes: minRoutesNum,
      performanceFilter: performanceFilter || null,
      count: mappedData.length,
      data: mappedData,
    });
  } catch (error: any) {
    console.error("[DataLab] Error in usage-agg:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Fantasy Logs Endpoint
 * Returns fantasy points from Sleeper game logs or weekly_stats
 * 
 * Query params:
 * - season (required)
 * - week (optional): Filter to specific week
 * - weekFrom, weekTo (optional): Week range
 * - position (optional): Filter by position
 * - player_id (optional): Filter to specific player
 */
/**
 * xFPTS v2 Admin Endpoint
 * Triggers computation of context-aware expected fantasy points
 * 
 * POST body:
 * - season (required): NFL season year
 * - week (optional): Specific week to compute. If omitted, processes all available weeks.
 * - extractMetrics (optional, default: true): Extract nflfastR metrics from snapshots first
 */
router.post("/admin/xfpts-run", async (req: Request, res: Response) => {
  try {
    const { season, week, extractMetrics = true } = req.body;

    if (!season) {
      return res.status(400).json({
        error: "Missing required parameter: season",
        required: ["season"],
        optional: ["week", "extractMetrics"],
      });
    }

    const seasonNum = Number(season);

    // Import xFpts service dynamically to avoid circular deps
    const { 
      computeExpectedFantasyForWeek, 
      computeExpectedFantasyForSeason,
      extractNflfastrMetricsFromSnapshots 
    } = await import("../../../services/xFptsService");

    if (week !== undefined) {
      const weekNum = Number(week);
      console.log(`[xFPTS Admin] Running v2 computation for ${seasonNum} Week ${weekNum}`);

      // Optionally extract metrics first
      let metricsExtracted = null;
      if (extractMetrics) {
        metricsExtracted = await extractNflfastrMetricsFromSnapshots(seasonNum, weekNum);
      }

      const result = await computeExpectedFantasyForWeek(seasonNum, weekNum);

      return res.json({
        success: true,
        message: `xFPTS v2 computed for ${seasonNum} Week ${weekNum}`,
        metricsExtracted: metricsExtracted?.processed || null,
        ...result,
      });
    } else {
      console.log(`[xFPTS Admin] Running v2 computation for entire season ${seasonNum}`);

      // For full season, extract metrics for each week first if requested
      const latestSnapshot = await datadiveSnapshotService.getLatestOfficialSnapshot();
      const maxWeek = latestSnapshot?.season === seasonNum ? latestSnapshot.week : 18;

      if (extractMetrics) {
        console.log(`[xFPTS Admin] Extracting nflfastR metrics for weeks 1-${maxWeek}...`);
        for (let w = 1; w <= maxWeek; w++) {
          await extractNflfastrMetricsFromSnapshots(seasonNum, w);
        }
      }

      const result = await computeExpectedFantasyForSeason(seasonNum, 1, maxWeek);

      return res.json({
        success: true,
        message: `xFPTS v2 computed for ${seasonNum} (Weeks 1-${maxWeek})`,
        metricsExtracted: extractMetrics,
        ...result,
      });
    }
  } catch (error: any) {
    console.error("[xFPTS Admin] Error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * xFPTS v2 Player Endpoint
 * Get expected fantasy data for a specific player
 * 
 * Query params:
 * - player_id (required)
 * - season (required)
 * - weekFrom, weekTo (optional)
 */
router.get("/xfpts/player", async (req: Request, res: Response) => {
  try {
    const { player_id, season, weekFrom, weekTo } = req.query;

    if (!player_id || !season) {
      return res.status(400).json({
        error: "Missing required parameters",
        required: ["player_id", "season"],
      });
    }

    const { getPlayerExpectedFantasy } = await import("../../../services/xFptsService");
    
    const data = await getPlayerExpectedFantasy(
      player_id as string,
      Number(season),
      weekFrom ? Number(weekFrom) : undefined,
      weekTo ? Number(weekTo) : undefined
    );

    res.json({
      playerId: player_id,
      season: Number(season),
      weekRange: weekFrom && weekTo ? { from: Number(weekFrom), to: Number(weekTo) } : null,
      count: data.length,
      data,
    });
  } catch (error: any) {
    console.error("[xFPTS] Player query error:", error);
    res.status(500).json({ error: error.message });
  }
});

router.get("/fantasy-logs", async (req: Request, res: Response) => {
  try {
    const {
      season,
      week,
      weekFrom,
      weekTo,
      weekMode = "single",
      position,
      player_id,
      limit = "100",
    } = req.query;

    if (!season) {
      return res.status(400).json({
        error: "Missing required parameter: season",
      });
    }

    const seasonNum = Number(season);
    const limitNum = Math.min(Number(limit), 200);

    // For season/range modes, return aggregated data
    if (weekMode === 'season' || weekMode === 'range') {
      // Get latest snapshot week for season mode
      let startWeek = 1;
      let endWeek = 18;
      
      if (weekMode === 'season') {
        const latestSnapshot = await datadiveSnapshotService.getLatestOfficialSnapshot();
        if (latestSnapshot && latestSnapshot.season === seasonNum) {
          endWeek = latestSnapshot.week;
        }
      } else if (weekFrom && weekTo) {
        startWeek = Number(weekFrom);
        endWeek = Number(weekTo);
      }

      // Parameterized filters — whitelist/binding prevents SQL injection
      const posUpperAgg = position ? (position as string).toUpperCase() : null;
      const positionFilter = posUpperAgg && posUpperAgg !== 'ALL' && VALID_SNAPSHOT_POSITIONS.includes(posUpperAgg as any)
        ? sql`AND spw.position = ${posUpperAgg}`
        : sql``;

      const playerFilter = player_id
        ? sql`AND spw.player_id = ${player_id as string}`
        : sql``;

      // Aggregated query for season/range mode
      const result = await db.execute(sql`
        WITH player_agg AS (
          SELECT 
            spw.player_id,
            MAX(spw.player_name) as player_name,
            MAX(spw.team_id) as team_id,
            MAX(spw.position) as position,
            COUNT(DISTINCT spw.week) FILTER (WHERE COALESCE(spw.snaps, 0) > 0 OR COALESCE(spw.routes, 0) > 0) as games_played,
            SUM(COALESCE(spw.targets, 0)) as total_targets,
            SUM(COALESCE(spw.receptions, 0)) as total_receptions,
            SUM(COALESCE(spw.rec_yards, 0)) as total_rec_yards,
            SUM(COALESCE(spw.rec_tds, 0)) as total_rec_tds,
            SUM(COALESCE(spw.rush_attempts, 0)) as total_rush_attempts,
            SUM(COALESCE(spw.rush_yards, 0)) as total_rush_yards,
            SUM(COALESCE(spw.rush_tds, 0)) as total_rush_tds,
            SUM(COALESCE(spw.fpts_std, 0)) as total_fpts_std,
            SUM(COALESCE(spw.fpts_half, 0)) as total_fpts_half,
            SUM(COALESCE(spw.fpts_ppr, 0)) as total_fpts_ppr,
            SUM(COALESCE(spw.routes, 0)) as total_routes,
            -- xFPTS aggregations
            SUM(COALESCE(efw.x_ppr_v2, efw.x_ppr_v1, 0)) as total_x_ppr,
            SUM(COALESCE(efw.xfpgoe_ppr_v2, efw.xfpgoe_ppr_v1, 0)) as total_xfpgoe_ppr
          FROM datadive_snapshot_player_week spw
          JOIN datadive_snapshot_meta sm ON sm.id = spw.snapshot_id
          LEFT JOIN datadive_expected_fantasy_week efw 
            ON efw.player_id = spw.player_id 
            AND efw.season = sm.season
            AND efw.week = spw.week
          WHERE sm.season = ${seasonNum}
            AND sm.is_official = true
            AND spw.week BETWEEN ${startWeek} AND ${endWeek}
            ${positionFilter}
            ${playerFilter}
          GROUP BY spw.player_id
        )
        SELECT 
          player_id,
          player_name,
          team_id,
          position,
          games_played,
          total_targets,
          total_receptions,
          total_rec_yards,
          total_rec_tds,
          total_rush_attempts,
          total_rush_yards,
          total_rush_tds,
          ROUND(total_fpts_std::numeric, 1) as total_fpts_std,
          ROUND(total_fpts_half::numeric, 1) as total_fpts_half,
          ROUND(total_fpts_ppr::numeric, 1) as total_fpts_ppr,
          total_routes,
          ROUND(total_x_ppr::numeric, 1) as total_x_ppr,
          ROUND(total_xfpgoe_ppr::numeric, 1) as total_xfpgoe_ppr,
          CASE WHEN games_played > 0 THEN ROUND((total_fpts_ppr / games_played)::numeric, 1) ELSE 0 END as ppr_per_game,
          CASE WHEN games_played > 0 THEN ROUND((total_x_ppr / games_played)::numeric, 1) ELSE 0 END as x_ppr_per_game,
          CASE WHEN games_played > 0 THEN ROUND((total_xfpgoe_ppr / games_played)::numeric, 1) ELSE 0 END as xfpgoe_per_game
        FROM player_agg
        WHERE games_played > 0
        ORDER BY total_fpts_ppr DESC
        LIMIT ${limitNum}
      `);
      const rows = (result as any).rows || [];

      return res.json({
        mode: 'fantasy-agg',
        season: seasonNum,
        weekMode,
        weekRange: { from: startWeek, to: endWeek },
        modeLabel: weekMode === 'season' ? `Season ${seasonNum} (Weeks 1-${endWeek})` : `Weeks ${startWeek}-${endWeek}`,
        position: position || 'ALL',
        count: rows.length,
        data: rows.map((row: any) => ({
          playerId: row.player_id,
          playerName: row.player_name,
          teamId: row.team_id,
          position: row.position,
          gamesPlayed: Number(row.games_played) || 0,
          totalTargets: Number(row.total_targets) || 0,
          totalReceptions: Number(row.total_receptions) || 0,
          totalRecYards: Number(row.total_rec_yards) || 0,
          totalRecTds: Number(row.total_rec_tds) || 0,
          totalRushAttempts: Number(row.total_rush_attempts) || 0,
          totalRushYards: Number(row.total_rush_yards) || 0,
          totalRushTds: Number(row.total_rush_tds) || 0,
          totalFptsPpr: Number(row.total_fpts_ppr) || 0,
          totalRoutes: Number(row.total_routes) || 0,
          pprPerGame: Number(row.ppr_per_game) || 0,
          xPprPerGame: Number(row.x_ppr_per_game) || 0,
          xFpgoePerGame: Number(row.xfpgoe_per_game) || 0,
        })),
      });
    }

    // Parameterized filters — all user values are bound, never interpolated
    let weekFilter = sql``;
    if (week) {
      weekFilter = sql`AND spw.week = ${Number(week)}`;
    } else if (weekFrom && weekTo) {
      weekFilter = sql`AND spw.week BETWEEN ${Number(weekFrom)} AND ${Number(weekTo)}`;
    }

    const posUpperSingle = position ? (position as string).toUpperCase() : null;
    const positionFilter = posUpperSingle && posUpperSingle !== 'ALL' && VALID_SNAPSHOT_POSITIONS.includes(posUpperSingle as any)
      ? sql`AND spw.position = ${posUpperSingle}`
      : sql``;

    const playerFilter = player_id
      ? sql`AND spw.player_id = ${player_id as string}`
      : sql``;

    // Get fantasy-focused data from snapshots, joined with xFPTS v2 data
    const result = await db.execute(sql`
      SELECT 
        spw.player_id,
        spw.player_name,
        spw.team_id,
        spw.position,
        spw.season,
        spw.week,
        COALESCE(spw.targets, 0) as targets,
        COALESCE(spw.receptions, 0) as receptions,
        COALESCE(spw.rec_yards, 0) as rec_yards,
        COALESCE(spw.rec_tds, 0) as rec_tds,
        COALESCE(spw.rush_attempts, 0) as rush_attempts,
        COALESCE(spw.rush_yards, 0) as rush_yards,
        COALESCE(spw.rush_tds, 0) as rush_tds,
        ROUND(COALESCE(spw.fpts_std, 0)::numeric, 1) as fpts_std,
        ROUND(COALESCE(spw.fpts_half, 0)::numeric, 1) as fpts_half,
        ROUND(COALESCE(spw.fpts_ppr, 0)::numeric, 1) as fpts_ppr,
        COALESCE(spw.routes, 0) as routes,
        spw.tprr,
        spw.target_share,
        spw.adot,
        COALESCE(spw.air_yards, 0) as air_yards,
        -- xFPTS v2 fields (with v1 fallback)
        COALESCE(efw.x_ppr_v2, efw.x_ppr_v1) as x_ppr,
        COALESCE(efw.xfpgoe_ppr_v2, efw.xfpgoe_ppr_v1) as xfpgoe_ppr,
        -- v2 context fields for drawer
        COALESCE(efw.rz_share, 0) as rz_share,
        COALESCE(efw.yac_ratio, 1) as yac_ratio,
        COALESCE(efw.rush_epa_ctx, 0) as rush_epa_ctx,
        COALESCE(efw.rush_success_ctx, 0) as rush_success_ctx
      FROM datadive_snapshot_player_week spw
      JOIN datadive_snapshot_meta sm ON sm.id = spw.snapshot_id
      LEFT JOIN datadive_expected_fantasy_week efw 
        ON efw.player_id = spw.player_id 
        AND efw.season = sm.season
        AND efw.week = spw.week
      WHERE sm.season = ${seasonNum}
        AND sm.is_official = true
        ${weekFilter}
        ${positionFilter}
        ${playerFilter}
      ORDER BY spw.fpts_ppr DESC
      LIMIT ${limitNum}
    `);
    const rows = (result as any).rows || [];

    res.json({
      mode: 'fantasy',
      season: seasonNum,
      week: week ? Number(week) : null,
      weekRange: weekFrom && weekTo ? { from: Number(weekFrom), to: Number(weekTo) } : null,
      position: position || 'ALL',
      count: rows.length,
      data: rows.map((row: any) => ({
        playerId: row.player_id,
        playerName: row.player_name,
        teamId: row.team_id,
        position: row.position,
        season: row.season,
        week: row.week,
        targets: Number(row.targets) || 0,
        receptions: Number(row.receptions) || 0,
        recYards: Number(row.rec_yards) || 0,
        recTds: Number(row.rec_tds) || 0,
        rushAttempts: Number(row.rush_attempts) || 0,
        rushYards: Number(row.rush_yards) || 0,
        rushTds: Number(row.rush_tds) || 0,
        fptsStd: Number(row.fpts_std) || 0,
        fptsHalf: Number(row.fpts_half) || 0,
        fptsPpr: Number(row.fpts_ppr) || 0,
        routes: Number(row.routes) || 0,
        tprr: row.tprr ? Number(row.tprr) : null,
        targetShare: row.target_share ? Number(row.target_share) : null,
        adot: row.adot ? Number(row.adot) : null,
        airYards: Number(row.air_yards) || 0,
        // xFPTS v2 fields (v2 with v1 fallback)
        xPpr: row.x_ppr != null ? Math.round(Number(row.x_ppr) * 10) / 10 : null,
        xFpgoePpr: row.xfpgoe_ppr != null ? Math.round(Number(row.xfpgoe_ppr) * 10) / 10 : null,
        // v2Context for drawer display
        v2Context: row.x_ppr != null ? {
          rzShare: Math.round(Number(row.rz_share) * 100) / 100,
          yacRatio: Math.round(Number(row.yac_ratio) * 100) / 100,
          rushEpaContribution: Math.round(Number(row.rush_epa_ctx) * 100) / 100,
          rushSuccessContribution: Math.round(Number(row.rush_success_ctx) * 100) / 100,
        } : null,
      })),
    });
  } catch (error: any) {
    console.error("[DataLab] Error in fantasy-logs:", error);
    res.status(500).json({ error: error.message });
  }
});

router.get("/lab-agg", async (req: Request, res: Response) => {
  try {
    const {
      season,
      weekMode = "season",
      week,
      weekFrom,
      weekTo,
      position,
      module: moduleName,
      minOpps = "5",
      limit = "150",
      sortBy = "fpts_ppr",
      sortDir = "desc",
    } = req.query;

    if (!season) {
      return res.status(400).json({ error: "Missing required parameter: season" });
    }

    const seasonNum = Number(season);
    const limitNum = Math.min(Number(limit), 300);
    const minOppsNum = Number(minOpps);

    let startWeek: number;
    let endWeek: number;

    if (weekMode === "season") {
      const latestSnapshot = await datadiveSnapshotService.getLatestOfficialSnapshot();
      if (!latestSnapshot || latestSnapshot.season !== seasonNum) {
        return res.status(404).json({ error: `No snapshot found for season ${seasonNum}` });
      }
      startWeek = 1;
      endWeek = latestSnapshot.week;
    } else if (weekMode === "range") {
      startWeek = Number(weekFrom);
      endWeek = Number(weekTo);
    } else {
      startWeek = Number(week);
      endWeek = Number(week);
    }

    const allowedPositions = ['QB', 'RB', 'WR', 'TE'];
    const posUpper = position ? (position as string).toUpperCase() : 'ALL';
    const positionFilter = posUpper !== 'ALL' && allowedPositions.includes(posUpper)
      ? sql`AND spw.position = ${posUpper}`
      : sql``;

    const validSortColumns: Record<string, string> = {
      fpts_ppr: 'total_fpts_ppr',
      targets: 'total_targets',
      rush_attempts: 'total_rush_attempts',
      epa_per_target: 'avg_epa_per_target',
      rush_epa: 'avg_rush_epa',
      cpoe: 'avg_cpoe',
      rz_targets: 'total_rz_targets',
      rz_snaps: 'total_rz_snaps',
      third_down_snaps: 'total_third_down_snaps',
      dropbacks: 'total_dropbacks',
      snaps: 'total_snaps',
    };
    const sortCol = validSortColumns[sortBy as string] || 'total_fpts_ppr';
    const sortDirection = (sortDir as string) === 'asc' ? 'ASC' : 'DESC';

    const result = await db.execute(sql`
      WITH valid_snapshots AS (
        SELECT sm.id, sm.week, sm.snapshot_at,
               (SELECT COUNT(*) FROM datadive_snapshot_player_week spw 
                WHERE spw.snapshot_id = sm.id AND spw.week = sm.week AND spw.snaps > 0) as player_count
        FROM datadive_snapshot_meta sm
        WHERE sm.season = ${seasonNum}
          AND sm.week BETWEEN ${startWeek} AND ${endWeek}
          AND sm.is_official = true
      ),
      snapshot_weeks AS (
        SELECT DISTINCT ON (week) id as snapshot_id, week
        FROM valid_snapshots
        WHERE player_count > 0
        ORDER BY week, player_count DESC, snapshot_at DESC
      ),
      player_agg AS (
        SELECT 
          spw.player_id,
          MAX(spw.player_name) as player_name,
          MAX(spw.team_id) as team_id,
          MAX(spw.position) as position,
          COUNT(DISTINCT sw.week) FILTER (WHERE COALESCE(spw.snaps, 0) > 0) as games_played,
          -- Core usage
          SUM(COALESCE(spw.snaps, 0)) as total_snaps,
          AVG(spw.snap_share) as avg_snap_share,
          SUM(COALESCE(spw.routes, 0)) as total_routes,
          AVG(spw.route_rate) as avg_route_rate,
          -- Receiving
          SUM(COALESCE(spw.targets, 0)) as total_targets,
          AVG(spw.target_share) as avg_target_share,
          SUM(COALESCE(spw.receptions, 0)) as total_receptions,
          SUM(COALESCE(spw.rec_yards, 0)) as total_rec_yards,
          SUM(COALESCE(spw.rec_tds, 0)) as total_rec_tds,
          AVG(spw.adot) as avg_adot,
          SUM(COALESCE(spw.air_yards, 0)) as total_air_yards,
          SUM(COALESCE(spw.yac, 0)) as total_yac,
          AVG(spw.epa_per_target) as avg_epa_per_target,
          AVG(spw.epa_per_play) as avg_epa_per_play,
          AVG(spw.success_rate) as avg_success_rate,
          -- xYAC
          AVG(spw.x_yac) as avg_x_yac,
          AVG(spw.yac_over_expected) as avg_yac_over_expected,
          AVG(spw.x_yac_success_rate) as avg_x_yac_success_rate,
          -- WR/TE efficiency
          CASE WHEN SUM(COALESCE(spw.targets, 0)) > 0
            THEN SUM(COALESCE(spw.receptions, 0))::numeric / SUM(COALESCE(spw.targets, 0))::numeric
            ELSE NULL END as avg_catch_rate,
          AVG(spw.yards_per_target) as avg_yards_per_target,
          AVG(spw.racr) as avg_racr,
          AVG(spw.wopr) as avg_wopr,
          AVG(spw.slot_rate) as avg_slot_rate,
          AVG(spw.inline_rate) as avg_inline_rate,
          AVG(spw.avg_air_epa) as avg_air_epa,
          AVG(spw.avg_comp_air_epa) as avg_comp_air_epa,
          -- Target depth/location
          AVG(spw.deep_target_rate) as avg_deep_target_rate,
          AVG(spw.intermediate_target_rate) as avg_intermediate_target_rate,
          AVG(spw.short_target_rate) as avg_short_target_rate,
          AVG(spw.left_target_rate) as avg_left_target_rate,
          AVG(spw.middle_target_rate) as avg_middle_target_rate,
          AVG(spw.right_target_rate) as avg_right_target_rate,
          -- RB receiving
          AVG(spw.yac_per_rec) as avg_yac_per_rec,
          SUM(COALESCE(spw.rec_first_downs, 0)) as total_rec_first_downs,
          AVG(spw.first_downs_per_route) as avg_first_downs_per_route,
          AVG(spw.fpts_per_route) as avg_fpts_per_route,
          -- Rushing
          SUM(COALESCE(spw.rush_attempts, 0)) as total_rush_attempts,
          SUM(COALESCE(spw.rush_yards, 0)) as total_rush_yards,
          SUM(COALESCE(spw.rush_tds, 0)) as total_rush_tds,
          AVG(spw.yards_per_carry) as avg_ypc,
          AVG(spw.rush_epa_per_play) as avg_rush_epa,
          SUM(COALESCE(spw.stuffed, 0)) as total_stuffed,
          AVG(spw.stuff_rate) as avg_stuff_rate,
          SUM(COALESCE(spw.rush_first_downs, 0)) as total_rush_first_downs,
          AVG(spw.rush_first_down_rate) as avg_rush_first_down_rate,
          -- Run gap/location
          AVG(spw.inside_run_rate) as avg_inside_run_rate,
          AVG(spw.outside_run_rate) as avg_outside_run_rate,
          AVG(spw.inside_success_rate) as avg_inside_success_rate,
          AVG(spw.outside_success_rate) as avg_outside_success_rate,
          AVG(spw.left_run_rate) as avg_left_run_rate,
          AVG(spw.middle_run_rate) as avg_middle_run_rate,
          AVG(spw.right_run_rate) as avg_right_run_rate,
          -- QB
          AVG(spw.cpoe) as avg_cpoe,
          SUM(COALESCE(spw.sacks, 0)) as total_sacks,
          AVG(spw.sack_rate) as avg_sack_rate,
          SUM(COALESCE(spw.sack_yards, 0)) as total_sack_yards,
          SUM(COALESCE(spw.qb_hits, 0)) as total_qb_hits,
          AVG(spw.qb_hit_rate) as avg_qb_hit_rate,
          SUM(COALESCE(spw.scrambles, 0)) as total_scrambles,
          SUM(COALESCE(spw.scramble_yards, 0)) as total_scramble_yards,
          SUM(COALESCE(spw.scramble_tds, 0)) as total_scramble_tds,
          SUM(COALESCE(spw.pass_first_downs, 0)) as total_pass_first_downs,
          AVG(spw.pass_first_down_rate) as avg_pass_first_down_rate,
          SUM(COALESCE(spw.deep_pass_attempts, 0)) as total_deep_pass_attempts,
          AVG(spw.deep_pass_rate) as avg_deep_pass_rate,
          AVG(spw.pass_adot) as avg_pass_adot,
          AVG(spw.shotgun_rate) as avg_shotgun_rate,
          AVG(spw.no_huddle_rate) as avg_no_huddle_rate,
          AVG(spw.shotgun_success_rate) as avg_shotgun_success_rate,
          AVG(spw.under_center_success_rate) as avg_under_center_success_rate,
          SUM(COALESCE(spw.dropbacks, 0)) as total_dropbacks,
          AVG(spw.any_a) as avg_any_a,
          AVG(spw.fp_per_dropback) as avg_fp_per_dropback,
          -- Red Zone
          SUM(COALESCE(spw.rz_snaps, 0)) as total_rz_snaps,
          AVG(spw.rz_snap_rate) as avg_rz_snap_rate,
          AVG(spw.rz_success_rate) as avg_rz_success_rate,
          SUM(COALESCE(spw.rz_pass_attempts, 0)) as total_rz_pass_attempts,
          SUM(COALESCE(spw.rz_pass_tds, 0)) as total_rz_pass_tds,
          AVG(spw.rz_td_rate) as avg_rz_td_rate,
          SUM(COALESCE(spw.rz_interceptions, 0)) as total_rz_interceptions,
          SUM(COALESCE(spw.rz_rush_attempts, 0)) as total_rz_rush_attempts,
          SUM(COALESCE(spw.rz_rush_tds, 0)) as total_rz_rush_tds,
          AVG(spw.rz_rush_td_rate) as avg_rz_rush_td_rate,
          SUM(COALESCE(spw.rz_targets, 0)) as total_rz_targets,
          SUM(COALESCE(spw.rz_receptions, 0)) as total_rz_receptions,
          SUM(COALESCE(spw.rz_rec_tds, 0)) as total_rz_rec_tds,
          AVG(spw.rz_target_share) as avg_rz_target_share,
          AVG(spw.rz_catch_rate) as avg_rz_catch_rate,
          -- Situational
          SUM(COALESCE(spw.third_down_snaps, 0)) as total_third_down_snaps,
          SUM(COALESCE(spw.third_down_conversions, 0)) as total_third_down_conversions,
          AVG(spw.third_down_conversion_rate) as avg_third_down_conversion_rate,
          AVG(spw.early_down_success_rate) as avg_early_down_success_rate,
          AVG(spw.late_down_success_rate) as avg_late_down_success_rate,
          SUM(COALESCE(spw.short_yardage_attempts, 0)) as total_short_yardage_attempts,
          SUM(COALESCE(spw.short_yardage_conversions, 0)) as total_short_yardage_conversions,
          AVG(spw.short_yardage_rate) as avg_short_yardage_rate,
          SUM(COALESCE(spw.third_down_targets, 0)) as total_third_down_targets,
          SUM(COALESCE(spw.third_down_receptions, 0)) as total_third_down_receptions,
          SUM(COALESCE(spw.third_down_rec_conversions, 0)) as total_third_down_rec_conversions,
          -- Two-minute / hurry-up
          SUM(COALESCE(spw.two_minute_snaps, 0)) as total_two_minute_snaps,
          SUM(COALESCE(spw.two_minute_successful, 0)) as total_two_minute_successful,
          AVG(spw.two_minute_success_rate) as avg_two_minute_success_rate,
          SUM(COALESCE(spw.hurry_up_snaps, 0)) as total_hurry_up_snaps,
          SUM(COALESCE(spw.hurry_up_successful, 0)) as total_hurry_up_successful,
          AVG(spw.hurry_up_success_rate) as avg_hurry_up_success_rate,
          SUM(COALESCE(spw.two_minute_targets, 0)) as total_two_minute_targets,
          SUM(COALESCE(spw.two_minute_receptions, 0)) as total_two_minute_receptions,
          -- Fantasy
          SUM(COALESCE(spw.fpts_std, 0)) as total_fpts_std,
          SUM(COALESCE(spw.fpts_half, 0)) as total_fpts_half,
          SUM(COALESCE(spw.fpts_ppr, 0)) as total_fpts_ppr
        FROM snapshot_weeks sw
        JOIN datadive_snapshot_player_week spw ON spw.snapshot_id = sw.snapshot_id AND spw.week = sw.week
        WHERE 1=1 ${positionFilter}
        GROUP BY spw.player_id
      )
      SELECT *
      FROM player_agg
      WHERE total_snaps >= ${minOppsNum}
      ORDER BY ${sql.raw(sortCol)} ${sql.raw(sortDirection)} NULLS LAST /* sortCol/sortDirection are whitelist-validated above */
      LIMIT ${limitNum}
    `);

    const rows = (result as any).rows || [];
    const n = (v: any) => v !== null && v !== undefined ? Number(v) : null;

    const mappedData = rows.map((row: any) => ({
      playerId: row.player_id,
      playerName: row.player_name,
      teamId: row.team_id,
      position: row.position,
      gamesPlayed: Number(row.games_played) || 0,
      totalSnaps: Number(row.total_snaps) || 0,
      avgSnapShare: n(row.avg_snap_share),
      totalRoutes: Number(row.total_routes) || 0,
      avgRouteRate: n(row.avg_route_rate),
      totalTargets: Number(row.total_targets) || 0,
      avgTargetShare: n(row.avg_target_share),
      totalReceptions: Number(row.total_receptions) || 0,
      totalRecYards: Number(row.total_rec_yards) || 0,
      totalRecTds: Number(row.total_rec_tds) || 0,
      avgAdot: n(row.avg_adot),
      totalAirYards: Number(row.total_air_yards) || 0,
      totalYac: Number(row.total_yac) || 0,
      avgEpaPerTarget: n(row.avg_epa_per_target),
      avgEpaPerPlay: n(row.avg_epa_per_play),
      avgSuccessRate: n(row.avg_success_rate),
      avgXYac: n(row.avg_x_yac),
      avgYacOverExpected: n(row.avg_yac_over_expected),
      avgXYacSuccessRate: n(row.avg_x_yac_success_rate),
      avgCatchRate: n(row.avg_catch_rate),
      avgYardsPerTarget: n(row.avg_yards_per_target),
      avgRacr: n(row.avg_racr),
      avgWopr: n(row.avg_wopr),
      avgSlotRate: n(row.avg_slot_rate),
      avgInlineRate: n(row.avg_inline_rate),
      avgAirEpa: n(row.avg_air_epa),
      avgCompAirEpa: n(row.avg_comp_air_epa),
      avgDeepTargetRate: n(row.avg_deep_target_rate),
      avgIntermediateTargetRate: n(row.avg_intermediate_target_rate),
      avgShortTargetRate: n(row.avg_short_target_rate),
      avgLeftTargetRate: n(row.avg_left_target_rate),
      avgMiddleTargetRate: n(row.avg_middle_target_rate),
      avgRightTargetRate: n(row.avg_right_target_rate),
      avgYacPerRec: n(row.avg_yac_per_rec),
      totalRecFirstDowns: Number(row.total_rec_first_downs) || 0,
      avgFirstDownsPerRoute: n(row.avg_first_downs_per_route),
      avgFptsPerRoute: n(row.avg_fpts_per_route),
      totalRushAttempts: Number(row.total_rush_attempts) || 0,
      totalRushYards: Number(row.total_rush_yards) || 0,
      totalRushTds: Number(row.total_rush_tds) || 0,
      avgYpc: n(row.avg_ypc),
      avgRushEpa: n(row.avg_rush_epa),
      totalStuffed: Number(row.total_stuffed) || 0,
      avgStuffRate: n(row.avg_stuff_rate),
      totalRushFirstDowns: Number(row.total_rush_first_downs) || 0,
      avgRushFirstDownRate: n(row.avg_rush_first_down_rate),
      avgInsideRunRate: n(row.avg_inside_run_rate),
      avgOutsideRunRate: n(row.avg_outside_run_rate),
      avgInsideSuccessRate: n(row.avg_inside_success_rate),
      avgOutsideSuccessRate: n(row.avg_outside_success_rate),
      avgLeftRunRate: n(row.avg_left_run_rate),
      avgMiddleRunRate: n(row.avg_middle_run_rate),
      avgRightRunRate: n(row.avg_right_run_rate),
      avgCpoe: n(row.avg_cpoe),
      totalSacks: Number(row.total_sacks) || 0,
      avgSackRate: n(row.avg_sack_rate),
      totalSackYards: Number(row.total_sack_yards) || 0,
      totalQbHits: Number(row.total_qb_hits) || 0,
      avgQbHitRate: n(row.avg_qb_hit_rate),
      totalScrambles: Number(row.total_scrambles) || 0,
      totalScrambleYards: Number(row.total_scramble_yards) || 0,
      totalScrambleTds: Number(row.total_scramble_tds) || 0,
      totalPassFirstDowns: Number(row.total_pass_first_downs) || 0,
      avgPassFirstDownRate: n(row.avg_pass_first_down_rate),
      totalDeepPassAttempts: Number(row.total_deep_pass_attempts) || 0,
      avgDeepPassRate: n(row.avg_deep_pass_rate),
      avgPassAdot: n(row.avg_pass_adot),
      avgShotgunRate: n(row.avg_shotgun_rate),
      avgNoHuddleRate: n(row.avg_no_huddle_rate),
      avgShotgunSuccessRate: n(row.avg_shotgun_success_rate),
      avgUnderCenterSuccessRate: n(row.avg_under_center_success_rate),
      totalDropbacks: Number(row.total_dropbacks) || 0,
      avgAnyA: n(row.avg_any_a),
      avgFpPerDropback: n(row.avg_fp_per_dropback),
      totalRzSnaps: Number(row.total_rz_snaps) || 0,
      avgRzSnapRate: n(row.avg_rz_snap_rate),
      avgRzSuccessRate: n(row.avg_rz_success_rate),
      totalRzPassAttempts: Number(row.total_rz_pass_attempts) || 0,
      totalRzPassTds: Number(row.total_rz_pass_tds) || 0,
      avgRzTdRate: n(row.avg_rz_td_rate),
      totalRzInterceptions: Number(row.total_rz_interceptions) || 0,
      totalRzRushAttempts: Number(row.total_rz_rush_attempts) || 0,
      totalRzRushTds: Number(row.total_rz_rush_tds) || 0,
      avgRzRushTdRate: n(row.avg_rz_rush_td_rate),
      totalRzTargets: Number(row.total_rz_targets) || 0,
      totalRzReceptions: Number(row.total_rz_receptions) || 0,
      totalRzRecTds: Number(row.total_rz_rec_tds) || 0,
      avgRzTargetShare: n(row.avg_rz_target_share),
      avgRzCatchRate: n(row.avg_rz_catch_rate),
      totalThirdDownSnaps: Number(row.total_third_down_snaps) || 0,
      totalThirdDownConversions: Number(row.total_third_down_conversions) || 0,
      avgThirdDownConversionRate: n(row.avg_third_down_conversion_rate),
      avgEarlyDownSuccessRate: n(row.avg_early_down_success_rate),
      avgLateDownSuccessRate: n(row.avg_late_down_success_rate),
      totalShortYardageAttempts: Number(row.total_short_yardage_attempts) || 0,
      totalShortYardageConversions: Number(row.total_short_yardage_conversions) || 0,
      avgShortYardageRate: n(row.avg_short_yardage_rate),
      totalThirdDownTargets: Number(row.total_third_down_targets) || 0,
      totalThirdDownReceptions: Number(row.total_third_down_receptions) || 0,
      totalThirdDownRecConversions: Number(row.total_third_down_rec_conversions) || 0,
      totalTwoMinuteSnaps: Number(row.total_two_minute_snaps) || 0,
      totalTwoMinuteSuccessful: Number(row.total_two_minute_successful) || 0,
      avgTwoMinuteSuccessRate: n(row.avg_two_minute_success_rate),
      totalHurryUpSnaps: Number(row.total_hurry_up_snaps) || 0,
      totalHurryUpSuccessful: Number(row.total_hurry_up_successful) || 0,
      avgHurryUpSuccessRate: n(row.avg_hurry_up_success_rate),
      totalTwoMinuteTargets: Number(row.total_two_minute_targets) || 0,
      totalTwoMinuteReceptions: Number(row.total_two_minute_receptions) || 0,
      totalFptsStd: Number(row.total_fpts_std) || 0,
      totalFptsHalf: Number(row.total_fpts_half) || 0,
      totalFptsPpr: Number(row.total_fpts_ppr) || 0,
      tprr: Number(row.total_routes) > 0 ? Number(row.total_targets) / Number(row.total_routes) : null,
      yprr: Number(row.total_routes) > 0 ? Number(row.total_rec_yards) / Number(row.total_routes) : null,
    }));

    res.json({
      season: seasonNum,
      weekMode,
      weekRange: { from: startWeek, to: endWeek },
      position: position || 'ALL',
      module: moduleName || 'all',
      count: mappedData.length,
      data: mappedData,
    });
  } catch (error: any) {
    console.error("[DataLab] Error in lab-agg:", error);
    res.status(500).json({ error: error.message });
  }
});

router.get("/dst-streamer", async (req: Request, res: Response) => {
  try {
    const week = Number(req.query.week) || 14;
    const season = Number(req.query.season) || 2025;
    
    console.log(`[DataLab] DST Streamer request for Week ${week}, Season ${season}`);
    
    const result = await getDSTStreamer(week, season);
    res.json(result);
  } catch (error: any) {
    console.error("[DataLab] Error in dst-streamer:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
