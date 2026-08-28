import express, { type Express, type Request, type Response } from "express";

export const PUBLIC_DRAFT_REVIEW_PROFILE = "public-draft-review" as const;
export const FULL_RUNTIME_PROFILE = "full" as const;

export type RuntimeProfile =
  | typeof PUBLIC_DRAFT_REVIEW_PROFILE
  | typeof FULL_RUNTIME_PROFILE;

export function resolveRuntimeProfile(
  configured = process.env.TIBER_RUNTIME_PROFILE,
): RuntimeProfile {
  if (configured == null || configured.trim() === "") {
    return FULL_RUNTIME_PROFILE;
  }
  if (configured === FULL_RUNTIME_PROFILE || configured === PUBLIC_DRAFT_REVIEW_PROFILE) {
    return configured;
  }
  throw new Error(
    `Unsupported TIBER_RUNTIME_PROFILE ${JSON.stringify(configured)}; ` +
      `expected ${FULL_RUNTIME_PROFILE} or ${PUBLIC_DRAFT_REVIEW_PROFILE}`,
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
