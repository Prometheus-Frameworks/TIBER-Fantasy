import express, { type Express, type Request, type Response, type RequestHandler } from "express";

export const PUBLIC_DRAFT_REVIEW_PROFILE = "public-draft-review" as const;
export const FULL_RUNTIME_PROFILE = "full" as const;
export const TEAM_AUTH_PROFILE = "team-auth" as const;

export type RuntimeProfile =
  | typeof PUBLIC_DRAFT_REVIEW_PROFILE
  | typeof TEAM_AUTH_PROFILE
  | typeof FULL_RUNTIME_PROFILE;

export function resolveRuntimeProfile(
  configured = process.env.TIBER_RUNTIME_PROFILE,
): RuntimeProfile {
  if (configured == null || configured.trim() === "") {
    return FULL_RUNTIME_PROFILE;
  }
  if (configured === FULL_RUNTIME_PROFILE || configured === PUBLIC_DRAFT_REVIEW_PROFILE || configured === TEAM_AUTH_PROFILE) {
    return configured;
  }
  throw new Error(
    `Unsupported TIBER_RUNTIME_PROFILE ${JSON.stringify(configured)}; ` +
      `expected ${FULL_RUNTIME_PROFILE}, ${PUBLIC_DRAFT_REVIEW_PROFILE} or ${TEAM_AUTH_PROFILE}`,
  );
}

export function createRuntimeProfileRouter(profile: RuntimeProfile) {
  const router = express.Router();
  router.get("/api/runtime-profile", (_req, res) => {
    res.set("Cache-Control", "no-store");
    res.json({ profile });
  });
  return router;
}

/**
 * Terminate every API request that was not mounted before this boundary.
 *
 * In the public Draft Review profile, only /api/runtime-profile and
 * /api/draft-review are mounted first. The full database-backed router, v1
 * router, schedulers, migrations, and cron jobs are never loaded. Returning one
 * generic 404 for every other method/path avoids resource-existence disclosure
 * and guarantees the request cannot reach a lookup or mutation handler.
 */
export function installPublicApiBoundary(app: Express): void {
  app.all("/api/*", (_req: Request, res: Response) => {
    res.status(404).json({ error: "Not found" });
  });
}

const authRoutes = new Set([
  'GET /api/auth/bootstrap', 'POST /api/auth/google', 'GET /api/auth/session', 'POST /api/auth/logout',
  'GET /api/team-private/sleeper-link', 'POST /api/team-private/sleeper-link/resolve',
  'POST /api/team-private/sleeper-link', 'DELETE /api/team-private/sleeper-link',
  'POST /api/team-private/leagues', 'POST /api/team-private/league-rosters',
]);

/** Installed synchronously, before any asynchronous auth loading. This gate
 * owns every remaining API; no failed/pending load can fall into legacy routes.
 */
export function installTeamAuthApiBoundary(app: Express, safeLog: (line: string) => void = console.log) {
  let handler: RequestHandler | undefined;
  let starting: Promise<void> | undefined;
  app.all('/api/*', (req, res, next) => {
    const route = `${req.method} ${req.path}`;
    const known = authRoutes.has(route);
    const label = known ? route : 'unknown_api';
    const started = Date.now();
    res.set('Cache-Control', 'private, no-store');
    res.on('finish', () => safeLog(`team-auth ${label} ${res.statusCode} ${Date.now() - started}ms`));
    if (!known) return res.status(404).json({ error: 'Not found' });
    if (!handler) return res.status(503).json({ error: 'AUTH_UNAVAILABLE' });
    handler(req, res, next);
  });
  app.use(((error: unknown, _req: Request, res: Response, _next: unknown) => {
    // Last-resort protection for loader/handler errors before the local router.
    res.set('Cache-Control', 'private, no-store');
    res.status(503).json({ error: 'AUTH_UNAVAILABLE' });
  }) as express.ErrorRequestHandler);
  return {
    start(loader: () => Promise<RequestHandler>): Promise<void> {
      starting ??= Promise.resolve().then(loader).then(loaded => { handler = loaded; }).catch(() => { safeLog('AUTH_INITIALIZATION_UNAVAILABLE'); });
      return starting;
    },
  };
}
