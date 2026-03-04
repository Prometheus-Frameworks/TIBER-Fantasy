import { Router, type Request } from "express";
import { v1Success } from "./contracts/response";
import { requestId } from "./middleware/requestId";
import { auth } from "./middleware/auth";
import { rateLimit } from "./middleware/rateLimit";
import { requestLogger } from "./middleware/requestLogger";
import { errorFormat, ApiError } from "./middleware/errorFormat";
import { ErrorCodes } from "./errors/codes";
import { db } from "../../infra/db";
import { sql } from "drizzle-orm";
import { storage } from "../../storage";
import { normalizeScoringSettings } from "../../services/normalizeScoringSettings";

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

router.use(requestLogger);
router.use(errorFormat);

export default router;
