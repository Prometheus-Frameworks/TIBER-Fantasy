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
    const query = toQueryString(req.query as Record<string, unknown>);
    const payload = await proxyToExisting(req, `/api/forge/eg/player/${req.params.playerId}${query}`);
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

router.use(requestLogger);
router.use(errorFormat);

export default router;
