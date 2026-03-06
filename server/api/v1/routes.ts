import { Router, type Request } from "express";
import { v1Success } from "./contracts/response";
import { requestId } from "./middleware/requestId";
import { auth } from "./middleware/auth";
import { rateLimit } from "./middleware/rateLimit";
import { requestLogger } from "./middleware/requestLogger";
import { errorFormat, ApiError } from "./middleware/errorFormat";
import { ErrorCodes } from "./errors/codes";
import { db, dbPool } from "../../infra/db";
import { sql, ilike, or } from "drizzle-orm";
import { storage } from "../../storage";
import { normalizeScoringSettings } from "../../services/normalizeScoringSettings";
import { evaluateAgingCurve } from "../../doctrine/positional_aging_curves";
import { detectTeamWindow } from "../../doctrine/team_window_detection";
import { evaluateAssetInsulation } from "../../doctrine/asset_insulation_model";
import { evaluateMarketPosition } from "../../doctrine/league_market_model";
import { evaluateRosterConstruction } from "../../doctrine/roster_construction_heuristics";
import { sleeperClient, deriveSleeperScoringFormat } from "../../integrations/sleeperClient";
import type { SleeperLeagueDetail } from "../../integrations/sleeperClient";
import type { Position } from "../../doctrine/types";
import { comparePlayers } from "../../services/playerComparisonService";
import { toComparisonResponse } from "./mappers/toComparisonResponse";
import { evaluateTradePackage, type TradeInput, type TradePlayer } from "../../services/trade/tradeLogic";
import { toTradeAnalysisResponse } from "./mappers/toTradeAnalysisResponse";
import { playerIdentityMap } from "../../../shared/schema";

const router = Router();

function getBaseUrl(req: Request) {
  const host = req.get("host") ?? `127.0.0.1:${process.env.PORT ?? "5000"}`;
  const protocol = req.protocol || "http";
  return `${protocol}://${host}`;
}

function toQueryString(input: Record<string, unknown>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined || value === null || value === "") continue;
    params.set(key, String(value));
  }
  const rendered = params.toString();
  return rendered ? `?${rendered}` : "";
}

async function proxyToExisting(req: Request, path: string, method: "GET" | "POST" = "GET", body?: unknown) {
  const response = await fetch(`${getBaseUrl(req)}${path}`, {
    method,
    headers: { "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    if (response.status === 404) {
      throw new ApiError(404, ErrorCodes.NOT_FOUND, "Resource not found", payload);
    }
    if (response.status === 504) {
      throw new ApiError(504, ErrorCodes.UPSTREAM_TIMEOUT, "Upstream service timeout", payload);
    }
    throw new ApiError(response.status, ErrorCodes.INTERNAL_ERROR, "Upstream service error", payload);
  }

  return payload;
}

router.use(requestId);
router.use(auth);
router.use(rateLimit);

router.get("/players/search", async (req, res, next) => {
  try {
    const name = (req.query.name as string ?? "").trim();
    if (!name || name.length < 2) {
      throw new ApiError(400, ErrorCodes.VALIDATION_ERROR, "name query param required (min 2 chars)");
    }
    const rows = await db.execute(sql`
      SELECT
        gsis_id,
        full_name,
        position,
        nfl_team,
        is_active
      FROM player_identity_map
      WHERE full_name ILIKE ${"%" + name + "%"}
        AND is_active = true
        AND position IN ('QB','RB','WR','TE')
      ORDER BY
        CASE WHEN LOWER(full_name) = LOWER(${name}) THEN 0 ELSE 1 END,
        full_name
      LIMIT 10
    `);
    res.json(v1Success({ players: rows.rows }, req.requestId!));
  } catch (err) {
    next(err);
  }
});

router.get("/forge/player/:playerId", async (req, res, next) => {
  try {
    const { playerId } = req.params;
    const queryParams = req.query as Record<string, unknown>;

    if (!queryParams.position) {
      const rows = await db.execute(sql`
        SELECT position FROM player_identity_map
        WHERE (gsis_id = ${playerId} OR nflfastr_gsis_id = ${playerId})
          AND position IN ('QB','RB','WR','TE')
        LIMIT 1
      `);
      const resolved = (rows.rows[0] as { position?: string } | undefined)?.position;
      if (resolved) queryParams.position = resolved;
    }

    const query = toQueryString(queryParams);
    const payload = await proxyToExisting(req, `/api/forge/eg/player/${playerId}${query}`);
    res.json(v1Success(payload, req.requestId!));
  } catch (err) {
    next(err);
  }
});

router.post("/forge/batch", async (req, res, next) => {
  try {
    const source = { ...(req.query as Record<string, unknown>), ...(req.body as Record<string, unknown>) };
    const query = toQueryString(source);
    const payload = await proxyToExisting(req, `/api/forge/batch${query}`);
    res.json(v1Success(payload, req.requestId!));
  } catch (err) {
    next(err);
  }
});

router.get("/fire/player/:playerId", async (req, res, next) => {
  try {
    const currentMonth = new Date().getMonth() + 1;
    const defaultSeason = currentMonth >= 8 ? new Date().getFullYear() : new Date().getFullYear() - 1;
    const defaultWeek = 18;
    const params = {
      season: defaultSeason,
      week: defaultWeek,
      ...req.query,
      playerId: req.params.playerId,
    };
    const query = toQueryString(params as Record<string, unknown>);
    const payload = await proxyToExisting(req, `/api/fire/eg/player${query}`);
    res.json(v1Success(payload, req.requestId!));
  } catch (err) {
    next(err);
  }
});

router.get("/catalyst/player/:playerId", async (req, res, next) => {
  try {
    const query = toQueryString(req.query as Record<string, unknown>);
    const payload = await proxyToExisting(req, `/api/catalyst/player/${req.params.playerId}${query}`);
    res.json(v1Success(payload, req.requestId!));
  } catch (err) {
    next(err);
  }
});

router.get("/fire/batch", async (req, res, next) => {
  try {
    const currentMonth = new Date().getMonth() + 1;
    const defaultSeason = currentMonth >= 8 ? new Date().getFullYear() : new Date().getFullYear() - 1;
    const defaultWeek = 18;
    const params = {
      season: defaultSeason,
      week: defaultWeek,
      ...req.query,
    };
    const query = toQueryString(params as Record<string, unknown>);
    const payload = await proxyToExisting(req, `/api/fire/eg/batch${query}`);
    res.json(v1Success(payload, req.requestId!));
  } catch (err) {
    next(err);
  }
});

router.get("/health", async (req, res) => {
  const dbOk = await db.execute(sql`SELECT 1`).then(() => true).catch(() => false);
  res.json(v1Success({
    ok: dbOk,
    version: "v1",
    commit: process.env.REPL_ID ?? "local",
    time: new Date().toISOString(),
    db: dbOk ? "connected" : "unreachable",
    uptime_seconds: Math.floor(process.uptime()),
  }, req.requestId!));
});

router.get("/diagnostic", (req, res) => {
  const proto = req.get("x-forwarded-proto") ?? req.protocol;
  const host = req.get("host") ?? "unknown";
  res.json(v1Success({
    baseUrlSeen: `${proto}://${host}`,
    hostHeader: host,
    xForwardedForPresent: !!req.get("x-forwarded-for"),
    xForwardedFor: req.get("x-forwarded-for") ?? null,
    xForwardedProto: req.get("x-forwarded-proto") ?? null,
    env: process.env.NODE_ENV ?? "unknown",
    commit: process.env.REPL_ID ?? "local",
    requestId: req.requestId,
  }, req.requestId!));
});

// ─── Rookie Endpoints (FORGE-R) ────────────────────────────────────────────

const VALID_POSITIONS = new Set(["QB", "RB", "WR", "TE"]);
const VALID_SORT_FIELDS = new Set(["tiber_ras_v1", "tiber_ras_v2", "player_name", "proj_round", "rookie_alpha", "production_score", "dominator_rating"]);

router.get("/rookies/2026/leaderboard", async (req, res, next) => {
  try {
    const sortBy = (req.query.sort_by as string) || "tiber_ras_v2";
    const pos = (req.query.position as string || "").toUpperCase();
    if (!VALID_SORT_FIELDS.has(sortBy)) {
      throw new ApiError(400, ErrorCodes.VALIDATION_ERROR, `Invalid sort_by. Valid: ${[...VALID_SORT_FIELDS].join(", ")}`);
    }
    const posFilter = pos && VALID_POSITIONS.has(pos) ? sql`AND position = ${pos}` : sql``;
    const rows = await db.execute(sql`
      SELECT
        ROW_NUMBER() OVER (ORDER BY ${sql.raw(sortBy)} DESC NULLS LAST) AS rank,
        player_name, position, school, proj_round,
        forty_yard_dash, vertical_jump, broad_jump,
        ROUND(tiber_ras_v1::numeric, 2) AS tiber_ras_v1,
        ROUND(tiber_ras_v2::numeric, 2) AS tiber_ras_v2,
        ROUND(rookie_alpha::numeric, 0) AS rookie_alpha,
        rookie_tier,
        ROUND(production_score::numeric, 1) AS production_score,
        ROUND(dominator_rating::numeric, 1) AS dominator_rating,
        ROUND(college_target_share::numeric, 1) AS college_target_share,
        ROUND(college_ypc::numeric, 2) AS college_ypc,
        ROUND(athleticism_score::numeric, 0) AS athleticism_score,
        ROUND(draft_capital_score::numeric, 0) AS draft_capital_score
      FROM rookie_profiles
      WHERE 1=1 ${posFilter}
      ORDER BY ${sql.raw(sortBy)} DESC NULLS LAST
      LIMIT 100
    `);
    res.json(v1Success({
      season: 2026,
      sort_by: sortBy,
      position: pos || "ALL",
      count: rows.rows.length,
      players: rows.rows,
    }, req.requestId!));
  } catch (err) { next(err); }
});

router.get("/rookies/2026/position/:pos", async (req, res, next) => {
  try {
    const pos = req.params.pos.toUpperCase();
    if (!VALID_POSITIONS.has(pos)) {
      throw new ApiError(400, ErrorCodes.VALIDATION_ERROR, `Invalid position. Valid: QB, RB, WR, TE`);
    }
    const rows = await db.execute(sql`
      SELECT
        ROW_NUMBER() OVER (ORDER BY tiber_ras_v2 DESC NULLS LAST) AS rank,
        player_name, position, school, proj_round,
        forty_yard_dash, vertical_jump, broad_jump,
        ROUND(tiber_ras_v1::numeric, 2) AS tiber_ras_v1,
        ROUND(tiber_ras_v2::numeric, 2) AS tiber_ras_v2,
        ROUND(rookie_alpha::numeric, 0) AS rookie_alpha,
        rookie_tier,
        ROUND(production_score::numeric, 1) AS production_score,
        ROUND(dominator_rating::numeric, 1) AS dominator_rating,
        ROUND(college_target_share::numeric, 1) AS college_target_share,
        ROUND(college_ypc::numeric, 2) AS college_ypc,
        ROUND(athleticism_score::numeric, 0) AS athleticism_score,
        ROUND(draft_capital_score::numeric, 0) AS draft_capital_score
      FROM rookie_profiles
      WHERE position = ${pos}
      ORDER BY tiber_ras_v2 DESC NULLS LAST
    `);
    res.json(v1Success({
      season: 2026,
      position: pos,
      count: rows.rows.length,
      players: rows.rows,
    }, req.requestId!));
  } catch (err) { next(err); }
});

router.get("/rookies/2026", async (req, res, next) => {
  try {
    const pos = (req.query.position as string || "").toUpperCase();
    const sortBy = (req.query.sort_by as string) || "tiber_ras_v2";
    if (sortBy && !VALID_SORT_FIELDS.has(sortBy)) {
      throw new ApiError(400, ErrorCodes.VALIDATION_ERROR, `Invalid sort_by. Valid: ${[...VALID_SORT_FIELDS].join(", ")}`);
    }
    const posFilter = pos && VALID_POSITIONS.has(pos) ? sql`AND position = ${pos}` : sql``;
    const rows = await db.execute(sql`
      SELECT
        ROW_NUMBER() OVER (ORDER BY ${sql.raw(sortBy)} DESC NULLS LAST) AS rank,
        player_name, position, school, proj_round,
        forty_yard_dash, vertical_jump, broad_jump,
        ROUND(tiber_ras_v1::numeric, 2) AS tiber_ras_v1,
        ROUND(tiber_ras_v2::numeric, 2) AS tiber_ras_v2,
        ROUND(rookie_alpha::numeric, 0) AS rookie_alpha,
        rookie_tier,
        ROUND(production_score::numeric, 1) AS production_score,
        ROUND(dominator_rating::numeric, 1) AS dominator_rating,
        ROUND(college_target_share::numeric, 1) AS college_target_share,
        ROUND(college_ypc::numeric, 2) AS college_ypc,
        ROUND(athleticism_score::numeric, 0) AS athleticism_score,
        ROUND(draft_capital_score::numeric, 0) AS draft_capital_score
      FROM rookie_profiles
      WHERE 1=1 ${posFilter}
      ORDER BY ${sql.raw(sortBy)} DESC NULLS LAST
      LIMIT 200
    `);
    res.json(v1Success({
      season: 2026,
      sort_by: sortBy,
      position: pos || "ALL",
      count: rows.rows.length,
      players: rows.rows,
    }, req.requestId!));
  } catch (err) { next(err); }
});

router.get("/rookies/2026/:playerName", async (req, res, next) => {
  try {
    const name = req.params.playerName.replace(/-/g, " ");
    const rows = await db.execute(sql`
      SELECT
        player_name, position, school, proj_round,
        forty_yard_dash, vertical_jump, broad_jump, short_shuttle, three_cone,
        height_inches, weight_lbs,
        ROUND(tiber_ras_v1::numeric, 2) AS tiber_ras_v1,
        ROUND(tiber_ras_v2::numeric, 2) AS tiber_ras_v2,
        ROUND(rookie_alpha::numeric, 0) AS rookie_alpha,
        rookie_tier,
        ROUND(athleticism_score::numeric, 0) AS athleticism_score,
        ROUND(production_score::numeric, 1) AS production_score,
        ROUND(dominator_rating::numeric, 1) AS dominator_rating,
        ROUND(college_target_share::numeric, 1) AS college_target_share,
        ROUND(college_ypc::numeric, 2) AS college_ypc,
        ROUND(draft_capital_score::numeric, 0) AS draft_capital_score,
        combine_raw, grade_raw
      FROM rookie_profiles
      WHERE LOWER(player_name) = LOWER(${name})
      LIMIT 1
    `);
    if (!rows.rows.length) {
      throw new ApiError(404, ErrorCodes.NOT_FOUND, `Rookie not found: ${name}`);
    }
    res.json(v1Success({ season: 2026, player: rows.rows[0] }, req.requestId!));
  } catch (err) { next(err); }
});

router.get("/league/:id/context", async (req, res, next) => {
  try {
    const leagueId = req.params.id;
    const raw = await storage.getLeagueWithTeams(leagueId);
    if (!raw) {
      throw new ApiError(404, ErrorCodes.NOT_FOUND, `League not found: ${leagueId}`);
    }
    const league = raw as any;

    const settings = (league.settings ?? {}) as Record<string, any>;
    const scoringProfile = settings.scoring_profile
      ? settings.scoring_profile
      : normalizeScoringSettings(settings.scoring_settings ?? {});

    const picks = await storage.getLeagueFuturePicks(leagueId);

    res.json(v1Success({
      league: {
        id: league.id,
        league_name: league.league_name ?? league.leagueName ?? null,
        platform: league.platform ?? null,
        external_league_id: league.league_id_external ?? league.leagueIdExternal ?? null,
        season: league.season ?? null,
        scoring_format: league.scoring_format ?? league.scoringFormat ?? null,
      },
      scoring_profile: scoringProfile,
      teams: (league.teams ?? []).map((t: any) => ({
        id: t.id,
        display_name: t.display_name ?? t.displayName ?? null,
        external_roster_id: t.external_roster_id ?? t.externalRosterId ?? null,
        external_user_id: t.external_user_id ?? t.externalUserId ?? null,
        is_commissioner: Boolean(t.is_commissioner ?? t.isCommissioner),
        avatar: t.avatar ?? null,
      })),
      picks_count: picks.length,
    }, req.requestId!));
  } catch (err) { next(err); }
});

router.get("/league/:id/picks", async (req, res, next) => {
  try {
    const leagueId = req.params.id;
    const raw = await storage.getLeagueWithTeams(leagueId);
    if (!raw) {
      throw new ApiError(404, ErrorCodes.NOT_FOUND, `League not found: ${leagueId}`);
    }
    const league = raw as any;

    const picks = await storage.getLeagueFuturePicks(leagueId);

    const rosterIndex = Object.fromEntries(
      (league.teams ?? []).map((t: any) => [
        (t.external_roster_id ?? t.externalRosterId ?? ''),
        { id: t.id, display_name: t.display_name ?? t.displayName },
      ])
    );

    res.json(v1Success({
      league_id: leagueId,
      season: league.season,
      picks: picks.map((p) => ({
        id: p.id,
        season: p.season,
        round: p.round,
        source: p.source,
        original_roster_id: p.originalRosterId,
        current_roster_id: p.currentRosterId,
        original_team: rosterIndex[p.originalRosterId ?? ''] ?? null,
        current_team: rosterIndex[p.currentRosterId ?? ''] ?? null,
        synced_at: p.syncedAt,
      })),
    }, req.requestId!));
  } catch (err) { next(err); }
});

router.get("/league/:id/scoring", async (req, res, next) => {
  try {
    const leagueId = req.params.id;
    const raw = await storage.getLeagueWithTeams(leagueId);
    if (!raw) {
      throw new ApiError(404, ErrorCodes.NOT_FOUND, `League not found: ${leagueId}`);
    }
    const league = raw as any;

    const settings = (league.settings ?? {}) as Record<string, any>;
    const scoringProfile = settings.scoring_profile
      ? settings.scoring_profile
      : normalizeScoringSettings(settings.scoring_settings ?? {});

    res.json(v1Success({
      league_id: leagueId,
      league_name: league.league_name ?? league.leagueName ?? null,
      season: league.season ?? null,
      scoring_profile: scoringProfile,
    }, req.requestId!));
  } catch (err) { next(err); }
});

// ─── Dynasty / GM Endpoints ────────────────────────────────────────────────

router.get("/dynasty/player/:playerId/evaluate", async (req, res, next) => {
  try {
    const { playerId } = req.params;
    const apiKey = req.header("x-tiber-key") ?? process.env.TIBER_API_KEY ?? "";
    const baseUrl = `http://127.0.0.1:${process.env.PORT ?? "5000"}`;

    const rows = await db.execute(sql`
      SELECT full_name, position, birth_date
      FROM player_identity_map
      WHERE (gsis_id = ${playerId} OR nflfastr_gsis_id = ${playerId})
        AND position IN ('QB','RB','WR','TE')
      LIMIT 1
    `);

    if (!rows.rows.length) {
      throw new ApiError(404, ErrorCodes.NOT_FOUND, `Player not found: ${playerId}`);
    }

    const row = rows.rows[0] as { full_name: string; position: string; birth_date: string | null };
    const position = row.position as "QB" | "RB" | "WR" | "TE";

    let age: number;
    if (req.query.age) {
      age = parseFloat(req.query.age as string);
      if (isNaN(age) || age < 18 || age > 55) {
        throw new ApiError(400, ErrorCodes.VALIDATION_ERROR, "age must be a decimal number between 18 and 55");
      }
    } else if (row.birth_date) {
      const birthMs = new Date(row.birth_date).getTime();
      age = (Date.now() - birthMs) / (1000 * 60 * 60 * 24 * 365.25);
    } else {
      age = 27;
    }

    let forgeAlpha = 50;
    try {
      const forgeData = await proxyToExisting(req, `/api/v1/forge/player/${playerId}?mode=dynasty`);
      const score = (forgeData as Record<string, unknown>)?.score as Record<string, unknown> | undefined;
      if (typeof score?.alpha === "number") forgeAlpha = score.alpha;
    } catch {
      // non-fatal — continue with default alpha
    }

    const [aging, insulation] = await Promise.all([
      evaluateAgingCurve(playerId, age, position, forgeAlpha, apiKey, baseUrl),
      evaluateAssetInsulation(playerId, position, apiKey, baseUrl),
    ]);

    res.json(v1Success({
      player: {
        id: playerId,
        name: row.full_name,
        position,
        age: Math.round(age * 10) / 10,
      },
      evaluations: { aging, insulation },
    }, req.requestId!));
  } catch (err) { next(err); }
});

router.post("/dynasty/roster/:leagueId/:rosterId", async (req, res, next) => {
  try {
    const { leagueId, rosterId } = req.params;
    const body = req.body as Record<string, unknown>;
    const playerIds = body.player_ids;

    if (!Array.isArray(playerIds) || playerIds.length === 0) {
      throw new ApiError(400, ErrorCodes.VALIDATION_ERROR, "player_ids must be a non-empty array of gsis_ids");
    }

    const apiKey = req.header("x-tiber-key") ?? process.env.TIBER_API_KEY ?? "";
    const baseUrl = `http://127.0.0.1:${process.env.PORT ?? "5000"}`;

    const raw = await storage.getLeagueWithTeams(leagueId);
    if (!raw) {
      throw new ApiError(404, ErrorCodes.NOT_FOUND, `League not found: ${leagueId}`);
    }
    const league = raw as Record<string, unknown>;
    const settings = (league.settings ?? {}) as Record<string, unknown>;
    const scoringProfile = (settings.scoring_profile
      ? settings.scoring_profile
      : normalizeScoringSettings((settings.scoring_settings ?? {}) as Record<string, number>)) as Parameters<typeof evaluateRosterConstruction>[3];

    const allPicks = await storage.getLeagueFuturePicks(leagueId);
    const picks = allPicks
      .filter((p) => p.currentRosterId === rosterId)
      .map((p) => ({
        id: p.id,
        season: p.season ?? 0,
        round: p.round,
        source: p.source ?? "traded",
        original_roster_id: p.originalRosterId ?? "",
        current_roster_id: p.currentRosterId ?? "",
        original_team: null,
        current_team: null,
        synced_at: typeof p.syncedAt === "string" ? p.syncedAt : new Date(p.syncedAt ?? Date.now()).toISOString(),
      }));

    const [windowEval, constructionEval] = await Promise.all([
      detectTeamWindow(leagueId, rosterId, playerIds as string[], apiKey, baseUrl),
      evaluateRosterConstruction(leagueId, rosterId, playerIds as string[], scoringProfile, picks, apiKey, baseUrl),
    ]);

    res.json(v1Success({
      league_id: leagueId,
      roster_id: rosterId,
      evaluations: { window: windowEval, construction: constructionEval },
    }, req.requestId!));
  } catch (err) { next(err); }
});

router.get("/dynasty/player/:playerId/market/:leagueId", async (req, res, next) => {
  try {
    const { playerId, leagueId } = req.params;
    const rawPool = (req.query.pool_ids as string ?? "").trim();
    if (!rawPool) {
      throw new ApiError(400, ErrorCodes.VALIDATION_ERROR, "pool_ids query param required (comma-separated gsis_ids)");
    }
    const poolIds = rawPool.split(",").map((s) => s.trim()).filter(Boolean);
    if (poolIds.length === 0) {
      throw new ApiError(400, ErrorCodes.VALIDATION_ERROR, "pool_ids must contain at least one gsis_id");
    }

    const apiKey = req.header("x-tiber-key") ?? process.env.TIBER_API_KEY ?? "";
    const baseUrl = `http://127.0.0.1:${process.env.PORT ?? "5000"}`;

    const evaluation = await evaluateMarketPosition(playerId, leagueId, poolIds, apiKey, baseUrl);

    res.json(v1Success({
      player_id: playerId,
      league_id: leagueId,
      evaluation,
    }, req.requestId!));
  } catch (err) { next(err); }
});

// ─── Phase 5: League-Wide Market Intelligence ──────────────────────────────

// Age bands where each position is considered "prime" (inclusive)
const PRIME_BANDS: Record<Position, [number, number]> = {
  QB: [24, 32],
  RB: [22, 26],
  WR: [23, 28],
  TE: [24, 29],
};

// Expected roster depth per position in dynasty (25–35 player rosters).
// [min, max] — below min = thin, above max = heavy (only flagged if very extreme)
const EXPECTED_DEPTH: Record<Position, [number, number]> = {
  QB: [2, 5],
  RB: [5, 12],
  WR: [7, 15],
  TE: [2, 5],
};

type MarketSignal = "buy" | "sell" | "hold";

function computeSignal(
  forgeAlpha: number,
  age: number,
  position: Position,
  positionMedian: number,
  position75th: number,
): MarketSignal {
  const [primeStart, primeEnd] = PRIME_BANDS[position];
  const isYoung = age <= primeEnd;
  const isPastPrime = age > primeEnd;

  if (forgeAlpha < positionMedian && isYoung) return "buy";
  if (forgeAlpha >= position75th && isPastPrime) return "sell";
  if (forgeAlpha < positionMedian * 0.6 && isPastPrime) return "sell";
  return "hold";
}

function computeImbalances(
  counts: Record<string, number>,
  avgForge: Record<string, number>,
): string[] {
  const flags: string[] = [];
  for (const pos of ["QB", "RB", "WR", "TE"] as Position[]) {
    const [lo, hi] = EXPECTED_DEPTH[pos];
    const count = counts[pos] ?? 0;
    if (count < lo) flags.push(`Thin at ${pos} (${count})`);
    else if (count > hi + 2) flags.push(`Heavy at ${pos} (${count})`);
    if (count > 0 && (avgForge[pos] ?? 0) < 35) {
      flags.push(`Weak ${pos} room (avg FORGE ${Math.round(avgForge[pos] ?? 0)})`);
    }
  }
  return flags;
}

// Concurrency limiter — run at most `limit` promises at once
async function pLimit<T>(tasks: (() => Promise<T>)[], limit: number): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let index = 0;
  async function worker() {
    while (index < tasks.length) {
      const i = index++;
      results[i] = await tasks[i]();
    }
  }
  const workers = Array.from({ length: Math.min(limit, tasks.length) }, worker);
  await Promise.all(workers);
  return results;
}

router.get("/dynasty/league/:leagueId/market", async (req, res, next) => {
  try {
    const { leagueId } = req.params;
    const apiKey = req.header("x-tiber-key") ?? process.env.TIBER_API_KEY ?? "";
    const baseUrl = `http://127.0.0.1:${process.env.PORT ?? "5000"}`;

    // 1. Fetch our league record to get the external (Sleeper) league ID
    const leagueRow = await db.execute(sql`
      SELECT id, league_id_external, settings
      FROM leagues
      WHERE id = ${leagueId}
      LIMIT 1
    `);
    if (!leagueRow.rows.length) {
      throw new ApiError(404, ErrorCodes.NOT_FOUND, `League not found: ${leagueId}`);
    }
    const leagueRecord = leagueRow.rows[0] as {
      id: string;
      league_id_external: string | null;
      settings: Record<string, unknown> | null;
    };
    const externalLeagueId = leagueRecord.league_id_external;
    if (!externalLeagueId) {
      throw new ApiError(400, ErrorCodes.VALIDATION_ERROR, "League has no external Sleeper ID — run a sync first");
    }

    // 2. In parallel: fetch Sleeper rosters + our DB team names
    const [sleeperRosters, leagueWithTeams] = await Promise.all([
      sleeperClient.getLeagueRosters(externalLeagueId),
      storage.getLeagueWithTeams(leagueId),
    ]);

    // Build roster_id → team_name map
    const teamNameMap: Record<number, string> = {};
    if (leagueWithTeams) {
      for (const team of leagueWithTeams.teams as unknown as Record<string, unknown>[]) {
        // Raw db.execute() returns snake_case columns, not camelCase
        const rid = parseInt((team.external_roster_id ?? team.externalRosterId ?? "") as string, 10);
        const name = (team.display_name ?? team.displayName ?? "") as string;
        if (!isNaN(rid) && name) teamNameMap[rid] = name;
      }
    }

    // 3. Collect all unique Sleeper player IDs and build sleeperId → roster_id map
    const sleeperRosterMap: Record<string, number> = {};
    for (const roster of sleeperRosters) {
      for (const pid of roster.players ?? []) {
        if (pid) sleeperRosterMap[pid] = roster.roster_id;
      }
    }
    const allSleeperIds = Object.keys(sleeperRosterMap);

    if (allSleeperIds.length === 0) {
      return res.json(v1Success({
        league_id: leagueId,
        external_league_id: externalLeagueId,
        generated_at: new Date().toISOString(),
        player_pool: [],
        team_summaries: [],
        position_rankings: { QB: [], RB: [], WR: [], TE: [] },
        meta: { total_players: 0, rosters_scanned: sleeperRosters.length },
      }, req.requestId!));
    }

    // 4. Look up player identity by sleeper_id — also fetches gsis_id for FORGE calls.
    // Use dbPool.query() directly (drizzle sql template doesn't support array params).
    const placeholders = allSleeperIds.map((_, i) => `$${i + 1}`).join(", ");
    const identityRows = await dbPool.query(
      `SELECT sleeper_id, gsis_id, full_name, position, birth_date
       FROM player_identity_map
       WHERE sleeper_id IN (${placeholders})
         AND position IN ('QB','RB','WR','TE')`,
      allSleeperIds,
    );

    // sleeperId → { gsis_id, full_name, position, birth_date }
    type IdentityRecord = { gsis_id: string | null; full_name: string; position: Position; birth_date: string | null };
    const identityMap: Record<string, IdentityRecord> = {};
    for (const row of identityRows.rows) {
      const r = row as { sleeper_id: string; gsis_id: string | null; full_name: string; position: string; birth_date: string | null };
      identityMap[r.sleeper_id] = {
        gsis_id: r.gsis_id,
        full_name: r.full_name,
        position: r.position as Position,
        birth_date: r.birth_date,
      };
    }

    // Scorable = Sleeper IDs that have a matched identity row
    const scorableSleeperIds = allSleeperIds.filter((id) => identityMap[id]);

    // 5. Fan-out FORGE calls concurrently (cap at 10) using gsis_id
    const forgeTasks = scorableSleeperIds.map((sleeperId) => async () => {
      const gsisId = identityMap[sleeperId]?.gsis_id;
      if (!gsisId) return { sleeperId, alpha: null as number | null };
      try {
        const url = `${baseUrl}/api/v1/forge/player/${gsisId}?mode=dynasty`;
        const res = await fetch(url, { headers: { "x-tiber-key": apiKey } });
        if (!res.ok) return { sleeperId, alpha: null as number | null };
        const json = await res.json() as Record<string, unknown>;
        const data = (json.data ?? json) as Record<string, unknown>;
        const score = data?.score as Record<string, unknown> | undefined;
        const alpha = typeof score?.alpha === "number" ? score.alpha : null;
        return { sleeperId, alpha };
      } catch {
        return { sleeperId, alpha: null as number | null };
      }
    });

    const forgeResults = await pLimit(forgeTasks, 10);
    // forgeMap keyed by sleeperId for consistent join with identityMap
    const forgeMap: Record<string, number> = {};
    for (const r of forgeResults) {
      if (r.alpha !== null) forgeMap[r.sleeperId] = r.alpha;
    }

    // 6. Build player records with position rank and signals
    // First compute per-position stats for signal thresholds
    const positionAlphas: Record<Position, number[]> = { QB: [], RB: [], WR: [], TE: [] };
    for (const pid of scorableSleeperIds) {
      const alpha = forgeMap[pid];
      if (alpha !== undefined) {
        positionAlphas[identityMap[pid].position].push(alpha);
      }
    }

    function median(arr: number[]): number {
      if (!arr.length) return 50;
      const sorted = [...arr].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
    }
    function percentile75(arr: number[]): number {
      if (!arr.length) return 75;
      const sorted = [...arr].sort((a, b) => a - b);
      return sorted[Math.floor(sorted.length * 0.75)] ?? sorted[sorted.length - 1];
    }

    const posStats: Record<Position, { median: number; p75: number }> = {
      QB: { median: median(positionAlphas.QB), p75: percentile75(positionAlphas.QB) },
      RB: { median: median(positionAlphas.RB), p75: percentile75(positionAlphas.RB) },
      WR: { median: median(positionAlphas.WR), p75: percentile75(positionAlphas.WR) },
      TE: { median: median(positionAlphas.TE), p75: percentile75(positionAlphas.TE) },
    };

    // Build player pool entries
    type PlayerEntry = {
      gsis_id: string;
      name: string;
      position: Position;
      age: number;
      roster_id: number;
      team_name: string;
      forge_alpha: number | null;
      position_rank: number;
      signal: MarketSignal;
      signal_reason: string;
    };

    const playerEntries: PlayerEntry[] = scorableSleeperIds.map((sleeperId) => {
      const identity = identityMap[sleeperId];
      const rosterId = sleeperRosterMap[sleeperId];
      const alpha = forgeMap[sleeperId] ?? null;

      let age = 27;
      if (identity.birth_date) {
        age = (Date.now() - new Date(identity.birth_date).getTime()) / (1000 * 60 * 60 * 24 * 365.25);
        age = Math.round(age * 10) / 10;
      }

      const pos = identity.position;
      const { median: med, p75 } = posStats[pos];
      const signal: MarketSignal = alpha !== null
        ? computeSignal(alpha, age, pos, med, p75)
        : "hold";

      let signal_reason = "Insufficient data to evaluate";
      if (alpha !== null) {
        const [primeStart, primeEnd] = PRIME_BANDS[pos];
        if (signal === "buy") {
          signal_reason = `Below-median FORGE (${alpha.toFixed(1)}) with ${age <= primeStart ? "pre-prime" : "prime"} age — potential value add`;
        } else if (signal === "sell") {
          signal_reason = `${age > primeEnd ? "Post-prime age" : "Weak production"} with FORGE ${alpha.toFixed(1)} — consider moving`;
        } else {
          signal_reason = `FORGE ${alpha.toFixed(1)} near position median (${med.toFixed(1)}) — hold and monitor`;
        }
      }

      return {
        gsis_id: identity.gsis_id ?? sleeperId,
        name: identity.full_name,
        position: pos,
        age,
        roster_id: rosterId,
        team_name: teamNameMap[rosterId] ?? `Roster ${rosterId}`,
        forge_alpha: alpha !== null ? Math.round(alpha * 10) / 10 : null,
        position_rank: 0, // filled in next step
        signal,
        signal_reason,
      };
    });

    // 7. Assign position ranks (sorted by forge_alpha desc, nulls last)
    const positionRankings: Record<Position, PlayerEntry[]> = { QB: [], RB: [], WR: [], TE: [] };
    for (const entry of playerEntries) {
      positionRankings[entry.position].push(entry);
    }
    for (const pos of ["QB", "RB", "WR", "TE"] as Position[]) {
      positionRankings[pos].sort((a, b) => {
        if (a.forge_alpha === null && b.forge_alpha === null) return 0;
        if (a.forge_alpha === null) return 1;
        if (b.forge_alpha === null) return -1;
        return b.forge_alpha - a.forge_alpha;
      });
      positionRankings[pos].forEach((p, i) => { p.position_rank = i + 1; });
    }

    // 8. Build team summaries
    const teamSummaries = sleeperRosters.map((roster) => {
      const rosterEntries = playerEntries.filter((p) => p.roster_id === roster.roster_id);
      const positionCounts: Record<string, number> = { QB: 0, RB: 0, WR: 0, TE: 0 };
      const positionForge: Record<string, number[]> = { QB: [], RB: [], WR: [], TE: [] };

      for (const entry of rosterEntries) {
        positionCounts[entry.position] = (positionCounts[entry.position] ?? 0) + 1;
        if (entry.forge_alpha !== null) {
          positionForge[entry.position].push(entry.forge_alpha);
        }
      }

      const avgForgeByPos: Record<string, number> = {};
      for (const pos of ["QB", "RB", "WR", "TE"]) {
        const vals = positionForge[pos] ?? [];
        avgForgeByPos[pos] = vals.length ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10 : 0;
      }

      const allAlphas = rosterEntries.filter((e) => e.forge_alpha !== null).map((e) => e.forge_alpha as number);
      const rosterAvgForge = allAlphas.length
        ? Math.round((allAlphas.reduce((a, b) => a + b, 0) / allAlphas.length) * 10) / 10
        : null;

      const imbalances = computeImbalances(positionCounts, avgForgeByPos);

      const buys = rosterEntries.filter((e) => e.signal === "buy").length;
      const sells = rosterEntries.filter((e) => e.signal === "sell").length;

      return {
        roster_id: roster.roster_id,
        team_name: teamNameMap[roster.roster_id] ?? `Roster ${roster.roster_id}`,
        player_count: rosterEntries.length,
        position_counts: positionCounts,
        avg_forge: rosterAvgForge,
        avg_forge_by_position: avgForgeByPos,
        imbalances,
        signal_summary: { buy: buys, sell: sells, hold: rosterEntries.length - buys - sells },
        top_assets: rosterEntries
          .filter((e) => e.forge_alpha !== null)
          .sort((a, b) => (b.forge_alpha ?? 0) - (a.forge_alpha ?? 0))
          .slice(0, 3)
          .map((e) => ({ gsis_id: e.gsis_id, name: e.name, position: e.position, forge_alpha: e.forge_alpha, signal: e.signal })),
      };
    });

    res.json(v1Success({
      league_id: leagueId,
      external_league_id: externalLeagueId,
      generated_at: new Date().toISOString(),
      player_pool: playerEntries.sort((a, b) => {
        const posOrder: Record<Position, number> = { QB: 0, RB: 1, WR: 2, TE: 3 };
        const posDiff = posOrder[a.position] - posOrder[b.position];
        if (posDiff !== 0) return posDiff;
        return a.position_rank - b.position_rank;
      }),
      team_summaries: teamSummaries.sort((a, b) => (b.avg_forge ?? 0) - (a.avg_forge ?? 0)),
      position_rankings: {
        QB: positionRankings.QB,
        RB: positionRankings.RB,
        WR: positionRankings.WR,
        TE: positionRankings.TE,
      },
      meta: {
        total_players: playerEntries.length,
        forge_scored: Object.keys(forgeMap).length,
        rosters_scanned: sleeperRosters.length,
        position_thresholds: posStats,
      },
    }, req.requestId!));
  } catch (err) { next(err); }
});

// ─── User / Team Sync Endpoints ────────────────────────────────────────────

router.get("/user/:username/leagues", async (req, res, next) => {
  try {
    const { username } = req.params;
    const season = (req.query.season as string) || "2025";

    let sleeperUser: any;
    try {
      sleeperUser = await sleeperClient.getUser(username);
    } catch {
      throw new ApiError(404, ErrorCodes.NOT_FOUND, `Sleeper user not found: ${username}`);
    }
    if (!sleeperUser?.user_id) {
      throw new ApiError(404, ErrorCodes.NOT_FOUND, `Sleeper user not found: ${username}`);
    }

    let allLeagues: SleeperLeagueDetail[] = [];
    try {
      allLeagues = await sleeperClient.getUserLeagues(sleeperUser.user_id, season);
    } catch {
      allLeagues = [];
    }

    const LEAGUE_TYPE_MAP: Record<number, string> = { 0: "redraft", 1: "keeper", 2: "dynasty" };
    const formatted = allLeagues.map((l) => {
      const typeNum = l.settings?.type ?? 0;
      const typeStr = LEAGUE_TYPE_MAP[typeNum] ?? "redraft";
      return {
        league_id: l.league_id,
        name: l.name,
        season: l.season,
        type: typeStr,
        is_dynasty: typeNum === 2,
        scoring_format: deriveSleeperScoringFormat(l.scoring_settings ?? {}),
        total_rosters: l.total_rosters ?? null,
        status: l.status ?? null,
      };
    });

    res.json(v1Success({
      user: {
        user_id: sleeperUser.user_id,
        display_name: sleeperUser.display_name,
        username: sleeperUser.username ?? username,
        avatar: sleeperUser.avatar ?? null,
      },
      leagues: formatted,
      meta: {
        season,
        total_leagues: formatted.length,
        dynasty_leagues: formatted.filter((l) => l.is_dynasty).length,
      },
    }, req.requestId!));
  } catch (err) { next(err); }
});

router.get("/user/:username/leagues/:leagueId/roster", async (req, res, next) => {
  try {
    const { username, leagueId } = req.params;
    const apiKey = req.headers["x-tiber-key"] as string;
    const baseUrl = getBaseUrl(req);

    let sleeperUser: any;
    try {
      sleeperUser = await sleeperClient.getUser(username);
    } catch {
      throw new ApiError(404, ErrorCodes.NOT_FOUND, `Sleeper user not found: ${username}`);
    }
    if (!sleeperUser?.user_id) {
      throw new ApiError(404, ErrorCodes.NOT_FOUND, `Sleeper user not found: ${username}`);
    }

    const [sleeperLeague, allRosters] = await Promise.all([
      sleeperClient.getLeague(leagueId),
      sleeperClient.getLeagueRosters(leagueId),
    ]);

    const myRoster = allRosters.find((r) => r.owner_id === sleeperUser.user_id);
    if (!myRoster) {
      throw new ApiError(404, ErrorCodes.NOT_FOUND, `User ${username} has no roster in league ${leagueId}`);
    }

    const sleeperIds = (myRoster.players ?? []).filter(Boolean);
    if (sleeperIds.length === 0) {
      return res.json(v1Success({
        user: { user_id: sleeperUser.user_id, display_name: sleeperUser.display_name },
        league: { league_id: sleeperLeague.league_id, name: sleeperLeague.name, season: sleeperLeague.season },
        roster: { roster_id: myRoster.roster_id, players: [] },
        meta: { total_players: 0, forge_scored: 0 },
      }, req.requestId!));
    }

    const idRows = await dbPool.query(
      `SELECT sleeper_id, nflfastr_gsis_id AS gsis_id, full_name AS display_name, position, birth_date
       FROM player_identity_map
       WHERE sleeper_id = ANY($1::text[])`,
      [sleeperIds]
    );
    const identityMap: Record<string, { gsis_id: string; display_name: string; position: string; birth_date: string | null }> = {};
    for (const row of idRows.rows) {
      identityMap[row.sleeper_id] = row;
    }

    const playersWithGsis = sleeperIds
      .map((sid) => ({ sleeper_id: sid, ...identityMap[sid] }))
      .filter((p) => p.gsis_id);

    const forgeMap: Record<string, any> = {};
    const CONCURRENCY = 10;
    for (let i = 0; i < playersWithGsis.length; i += CONCURRENCY) {
      const batch = playersWithGsis.slice(i, i + CONCURRENCY);
      await Promise.allSettled(
        batch.map(async (p) => {
          const data = await fetch(`${baseUrl}/api/v1/forge/player/${p.gsis_id}?mode=dynasty`, {
            headers: { "x-tiber-key": apiKey },
          }).then((r) => r.json()).catch(() => null);
          if (data?.data?.score?.alpha != null) {
            forgeMap[p.gsis_id] = data.data;
          }
        })
      );
    }

    const posOrder: Record<string, number> = { QB: 0, RB: 1, WR: 2, TE: 3 };
    const players = sleeperIds.map((sid) => {
      const identity = identityMap[sid];
      const forge = identity?.gsis_id ? forgeMap[identity.gsis_id] : null;
      let age: number | null = null;
      if (identity?.birth_date) {
        const born = new Date(identity.birth_date);
        age = Math.floor((Date.now() - born.getTime()) / (365.25 * 24 * 3600 * 1000));
      }
      return {
        sleeper_id: sid,
        gsis_id: identity?.gsis_id ?? null,
        display_name: identity?.display_name ?? null,
        position: identity?.position ?? null,
        age,
        forge_alpha: forge?.score?.alpha ?? null,
        forge_tier: forge?.score?.tier ?? null,
        forge_label: forge?.score?.label ?? null,
      };
    }).sort((a, b) => {
      const posDiff = (posOrder[a.position ?? ""] ?? 9) - (posOrder[b.position ?? ""] ?? 9);
      if (posDiff !== 0) return posDiff;
      return (b.forge_alpha ?? -1) - (a.forge_alpha ?? -1);
    });

    res.json(v1Success({
      user: {
        user_id: sleeperUser.user_id,
        display_name: sleeperUser.display_name,
        username: sleeperUser.username ?? username,
      },
      league: {
        league_id: sleeperLeague.league_id,
        name: sleeperLeague.name,
        season: sleeperLeague.season,
        type: (sleeperLeague as any).type ?? "redraft",
      },
      roster: {
        roster_id: myRoster.roster_id,
        players,
      },
      meta: {
        total_players: players.length,
        forge_scored: players.filter((p) => p.forge_alpha !== null).length,
      },
    }, req.requestId!));
  } catch (err) { next(err); }
});

// ── Canonical Intelligence: Compare ─────────────────────────────────────────
//
// POST /api/v1/intelligence/compare
//
// Returns a canonical ComparisonResponse (shared/types/intelligence.ts).
// This is the blessed v1 comparison endpoint. The existing
// POST /api/player-comparison/compare route remains live as a transitional
// surface until all consumers are migrated.
//
// Body: {
//   player_a: string  — player name or canonical ID
//   player_b: string  — player name or canonical ID
//   week: number      — target week for matchup context
//   season?: number   — defaults to 2025
// }
//
router.post("/intelligence/compare", async (req, res, next) => {
  try {
    const { player_a, player_b, player1, player2, week, season = 2025 } = req.body as {
      player_a?: string;
      player_b?: string;
      player1?: string;
      player2?: string;
      week?: number;
      season?: number;
    };

    const sideA = (player_a ?? player1)?.trim();
    const sideB = (player_b ?? player2)?.trim();

    if (!sideA || !sideB || !week) {
      throw new ApiError(400, ErrorCodes.VALIDATION_ERROR, "player_a, player_b, and week are required");
    }
    if (typeof week !== "number" || week < 1 || week > 22) {
      throw new ApiError(400, ErrorCodes.VALIDATION_ERROR, "week must be a number between 1 and 22");
    }

    // Resolve player name or canonical-id slug to canonical ID.
    // A canonical slug has no spaces and uses hyphens (e.g. "justin-jefferson").
    // A player name always contains at least one space.
    const resolveId = async (input: string): Promise<string | null> => {
      if (!input.includes(" ")) return input; // looks like a slug ID — pass through
      const rows = await db
        .select({ id: playerIdentityMap.canonicalId })
        .from(playerIdentityMap)
        .where(ilike(playerIdentityMap.fullName, `%${input}%`))
        .limit(1);
      return rows.length > 0 ? rows[0].id : null;
    };

    const [idA, idB] = await Promise.all([resolveId(sideA), resolveId(sideB)]);

    if (!idA) throw new ApiError(404, ErrorCodes.NOT_FOUND, `Player not found: ${sideA}`);
    if (!idB) throw new ApiError(404, ErrorCodes.NOT_FOUND, `Player not found: ${sideB}`);

    const raw = await comparePlayers(idA, idB, week, season);

    if (!raw) {
      throw new ApiError(404, ErrorCodes.NOT_FOUND, "No comparison data available — check that both players have recent usage data and a valid schedule matchup for the requested week");
    }

    const canonical = toComparisonResponse(raw, {
      week,
      season,
      traceId: req.requestId,
      source: "api_v1",
    });

    res.json(v1Success(canonical, req.requestId!));
  } catch (err) {
    next(err);
  }
});

// ── Canonical Intelligence: Trade Analysis ───────────────────────────────────
//
// POST /api/v1/intelligence/trade/analyze
//
// Returns a canonical TradeAnalysisResponse (shared/types/intelligence.ts)
// while delegating value/scoring logic to the existing transitional
// evaluateTradePackage() service to avoid introducing new football logic.
//
// Body (canonical):
// {
//   side_a: TradePlayer[]
//   side_b: TradePlayer[]
// }
//
// Compatibility aliases are accepted:
// - teamA -> side_a
// - teamB -> side_b
//
router.post("/intelligence/trade/analyze", async (req, res, next) => {
  try {
    const { side_a, side_b, teamA, teamB } = req.body as {
      side_a?: TradePlayer[];
      side_b?: TradePlayer[];
      teamA?: TradePlayer[];
      teamB?: TradePlayer[];
    };

    const resolvedSideA = side_a ?? teamA;
    const resolvedSideB = side_b ?? teamB;

    if (!Array.isArray(resolvedSideA) || !Array.isArray(resolvedSideB)) {
      throw new ApiError(400, ErrorCodes.VALIDATION_ERROR, "side_a and side_b must be arrays");
    }
    if (resolvedSideA.length === 0 || resolvedSideB.length === 0) {
      throw new ApiError(400, ErrorCodes.VALIDATION_ERROR, "Both sides must include at least one asset");
    }

    const validateAsset = (asset: TradePlayer, sideLabel: string, index: number) => {
      if (!asset?.id && !asset?.name) {
        throw new ApiError(400, ErrorCodes.VALIDATION_ERROR, `${sideLabel}[${index}] must include id or name`);
      }
      if (typeof asset?.prometheusScore !== "number" || Number.isNaN(asset.prometheusScore)) {
        throw new ApiError(400, ErrorCodes.VALIDATION_ERROR, `${sideLabel}[${index}] must include numeric prometheusScore`);
      }
    };

    resolvedSideA.forEach((asset, idx) => validateAsset(asset, "side_a", idx));
    resolvedSideB.forEach((asset, idx) => validateAsset(asset, "side_b", idx));

    const tradeInput: TradeInput = {
      teamA: resolvedSideA,
      teamB: resolvedSideB,
    };

    const raw = evaluateTradePackage(tradeInput);
    const canonical = toTradeAnalysisResponse(raw, tradeInput, {
      traceId: req.requestId,
      source: "api_v1",
    });

    res.json(v1Success(canonical, req.requestId!));
  } catch (err) {
    next(err);
  }
});

router.use(requestLogger);
router.use(errorFormat);

export default router;
