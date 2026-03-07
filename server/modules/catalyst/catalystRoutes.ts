import { Router, Request, Response } from "express";
import { db } from "../../infra/db";
import { catalystScores } from "@shared/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import type { CatalystBatchResponse, CatalystErrorResponse, CatalystPlayerResponse, CatalystYoYResponse, CatalystYoYPlayer } from "@shared/types/catalyst";

const router = Router();

const VALID_CATALYST_POSITIONS = ["QB", "RB", "WR", "TE"] as const;
type CatalystPosition = (typeof VALID_CATALYST_POSITIONS)[number];
type CatalystScoreRow = typeof catalystScores.$inferSelect;

class ValidationError extends Error {
  status = 400;
  code: string;
  details?: Record<string, unknown>;

  constructor(code: string, message: string, details?: Record<string, unknown>) {
    super(message);
    this.code = code;
    this.details = details;
  }
}

const parseCatalystPosition = (positionQuery: unknown): CatalystPosition => {
  const parsedPosition = String(positionQuery ?? "QB").toUpperCase();

  if (!VALID_CATALYST_POSITIONS.includes(parsedPosition as CatalystPosition)) {
    throw new ValidationError(
      "INVALID_POSITION",
      "Invalid position query parameter",
      {
        field: "position",
        allowed: VALID_CATALYST_POSITIONS,
      }
    );
  }

  return parsedPosition as CatalystPosition;
};

const parseCatalystSeason = (seasonQuery: unknown, fallback?: number): number => {
  if (seasonQuery == null || seasonQuery === "") {
    if (fallback != null) return fallback;
    throw new ValidationError("MISSING_SEASON", "Missing required season query parameter", {
      field: "season",
    });
  }

  const season = Number(seasonQuery);
  if (!Number.isInteger(season) || season < 1900) {
    throw new ValidationError("INVALID_SEASON", "Invalid season query parameter", {
      field: "season",
      value: seasonQuery,
    });
  }

  return season;
};

const parseLimit = (limitQuery: unknown, max: number, fallback: number): number => {
  if (limitQuery == null || limitQuery === "") {
    return fallback;
  }

  const limit = Number(limitQuery);
  if (!Number.isInteger(limit) || limit <= 0) {
    throw new ValidationError("INVALID_LIMIT", "Invalid limit query parameter", {
      field: "limit",
      value: limitQuery,
      max,
    });
  }

  return Math.min(limit, max);
};

const buildValidationErrorResponse = (error: ValidationError): CatalystErrorResponse => ({
  error: {
    code: error.code,
    message: error.message,
    details: error.details ?? null,
  },
});

const buildBatchResponse = (
  players: CatalystScoreRow[],
  season: number,
  position: CatalystPosition,
  week: number
): CatalystBatchResponse => ({
  players: players.map((player) => ({
    gsis_id: player.gsisId,
    player_name: player.playerName,
    position: player.position,
    team: player.team,
    catalyst_raw: player.catalystRaw,
    catalyst_alpha: player.catalystAlpha,
    components: player.components,
  })),
  season,
  position,
  week,
  total: players.length,
});

const buildPlayerDetailResponse = (
  gsisId: string,
  season: number,
  weeklyScores: CatalystScoreRow[]
): CatalystPlayerResponse => {
  const latest = weeklyScores[weeklyScores.length - 1];

  return {
    gsis_id: gsisId,
    player_name: latest.playerName,
    position: latest.position,
    team: latest.team,
    season,
    catalyst_raw: latest.catalystRaw,
    catalyst_alpha: latest.catalystAlpha,
    components: latest.components,
    weekly: weeklyScores.map((weekly) => ({
      week: weekly.week,
      catalyst_raw: weekly.catalystRaw,
      catalyst_alpha: weekly.catalystAlpha,
      components: weekly.components,
    })),
  };
};

const buildYoyResponse = (position: CatalystPosition, rows: Record<string, unknown>[]): CatalystYoYResponse => ({
  position,
  players: rows.map((row): CatalystYoYPlayer => ({
    gsis_id: String(row.gsis_id ?? ""),
    player_name: String(row.player_name ?? ""),
    position: String(row.position ?? ""),
    team_2024: String(row.team_2024 ?? ""),
    team_2025: String(row.team_2025 ?? ""),
    alpha_2024: row.alpha_2024 != null ? Number(row.alpha_2024) : null,
    alpha_2025: row.alpha_2025 != null ? Number(row.alpha_2025) : null,
    delta: row.delta != null ? Number(row.delta) : null,
  })),
});

const handleRouteError = (error: unknown, res: Response) => {
  if (error instanceof ValidationError) {
    return res.status(error.status).json(buildValidationErrorResponse(error));
  }

  console.error("Catalyst route error", error);
  const internalErrorResponse: CatalystErrorResponse = {
    error: {
      code: "INTERNAL_ERROR",
      message: "Unexpected error while processing request",
    },
  };
  return res.status(500).json(internalErrorResponse);
};

router.get("/api/catalyst/batch", async (req: Request, res: Response) => {
  try {
    const position = parseCatalystPosition(req.query.position);
    const season = parseCatalystSeason(req.query.season, 2025);
    const limit = parseLimit(req.query.limit, 200, 100);

    const maxWeekResult = await db.execute(
      sql`SELECT MAX(week) as max_week FROM catalyst_scores WHERE season = ${season} AND position = ${position}`
    );
    const maxWeek = maxWeekResult.rows?.[0]?.max_week;

    if (!maxWeek) {
      return res.json(buildBatchResponse([], season, position, 0));
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

    return res.json(buildBatchResponse(players, season, position, Number(maxWeek)));
  } catch (error) {
    return handleRouteError(error, res);
  }
});

router.get("/api/catalyst/player/:gsisId", async (req: Request, res: Response) => {
  try {
    const { gsisId } = req.params;
    const season = parseCatalystSeason(req.query.season, 2025);

    const weeklyScores = await db
      .select()
      .from(catalystScores)
      .where(and(eq(catalystScores.gsisId, gsisId), eq(catalystScores.season, season)))
      .orderBy(catalystScores.week);

    if (weeklyScores.length === 0) {
      const notFoundResponse: CatalystErrorResponse = {
        error: {
          code: "PLAYER_NOT_FOUND",
          message: "Player not found for this season",
          details: { gsisId, season },
        },
      };
      return res.status(404).json(notFoundResponse);
    }

    return res.json(buildPlayerDetailResponse(gsisId, season, weeklyScores));
  } catch (error) {
    return handleRouteError(error, res);
  }
});

router.get("/api/catalyst/yoy", async (req: Request, res: Response) => {
  try {
    const position = parseCatalystPosition(req.query.position);
    const limit = parseLimit(req.query.limit, 50, 25);

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

    return res.json(buildYoyResponse(position, result.rows as Record<string, unknown>[]));
  } catch (error) {
    return handleRouteError(error, res);
  }
});

export default router;
