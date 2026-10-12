import express, { type ErrorRequestHandler, type Request, type RequestHandler, type Response } from 'express';
import { randomBytes } from 'node:crypto';
import { AUTH_POLICY, TeamAuthError, googleLoginSchema, sleeperResolveSchema, sleeperConfirmSchema,
  sleeperUnlinkSchema, emptyAuthBodySchema, type AuthPrincipal } from '@shared/teamAuth';
import { readTeamAuthConfig, type TeamAuthConfig } from '../modules/teamAuth/config';
import { authHash, constantEqual, createGoogleVerifier } from '../modules/teamAuth/googleIdentity';
import { TeamAuthService } from '../modules/teamAuth/teamAuthService';
import { createPgAuthSession, destroySession, discardResponseSession, persistSession, regenerateSession } from '../modules/teamAuth/session';
import { sleeperClient } from '../integrations/sleeperClient';
import { discoverTeamLeagues, findTeamLeagueRosters } from '../modules/draftReview/teamLeagues';
import { privateLeaguesInput, privateLeagueRosterInput } from '@shared/teamLeagues';

export const TEAM_AUTH_ROUTES = Object.freeze([
  'GET /api/auth/bootstrap', 'POST /api/auth/google', 'GET /api/auth/session', 'POST /api/auth/logout',
  'GET /api/team-private/sleeper-link', 'POST /api/team-private/sleeper-link/resolve',
  'POST /api/team-private/sleeper-link', 'DELETE /api/team-private/sleeper-link',
  'POST /api/team-private/leagues', 'POST /api/team-private/league-rosters',
]);

function boundedLimiter(now: () => number) {
  const entries = new Map<string, { count: number; until: number }>();
  return (key: string, max: number) => {
    const clock = now();
    for (const [stored, value] of Array.from(entries)) if (value.until <= clock) entries.delete(stored);
    let entry = entries.get(key);
    if (!entry) {
      if (entries.size >= 10000) throw new TeamAuthError(429, 'AUTH_RATE_LIMIT');
      entry = { count: 0, until: clock + 60_000 }; entries.set(key, entry);
    }
    if (++entry.count > max) throw new TeamAuthError(429, 'AUTH_RATE_LIMIT');
  };
}

export function createTeamAuthRouter(deps: {
  config: TeamAuthConfig; service: TeamAuthService; sessionMiddleware: RequestHandler; now?: () => number;
}) {
  const { config, service } = deps; const now = deps.now ?? Date.now;
  const router = express.Router(); const limit = boundedLimiter(now);
  const binding = (req: Request) => authHash(req.sessionID);
  const principal = (req: Request): AuthPrincipal => {
    const auth = req.session?.teamAuth?.principal;
    if (!auth) throw new TeamAuthError(401, 'AUTH_REQUIRED');
    return auth;
  };
  const run = (handler: (req: Request, res: Response) => Promise<void>): RequestHandler =>
    (req, res, next) => { handler(req, res).catch(next); };
  const finish = async (req: Request, res: Response, body: unknown) => {
    await persistSession(req, now());
    res.json(body);
  };
  const accountBody = (account: Awaited<ReturnType<typeof service.persistence.inspect>>) => ({
    status: 'authenticated', user: { id: account.user.id },
    sleeperLink: account.link, linkVersion: account.user.sleeperLinkVersion,
    sleeperAccountControlVerified: false,
  });

  router.use((req, res, next) => {
    res.set('Cache-Control', 'private, no-store');
    res.set('X-Content-Type-Options', 'nosniff');
    if (!TEAM_AUTH_ROUTES.includes(`${req.method} ${req.path}`)) return res.status(404).json({ error: 'Not found' });
    try {
      // No caller owner or credential can be smuggled via a query string.
      if (Object.keys(req.query).length) throw new TeamAuthError(400, 'AUTH_INVALID_INPUT');
      if (req.get('Origin') && req.get('Origin') !== config.origin) throw new TeamAuthError(403, 'AUTH_ORIGIN_REJECTED');
      if (req.get('Sec-Fetch-Site') === 'cross-site') throw new TeamAuthError(403, 'AUTH_ORIGIN_REJECTED');
      if (req.method !== 'GET') {
        if (req.get('Origin') !== config.origin) throw new TeamAuthError(403, 'AUTH_ORIGIN_REJECTED');
        if (!req.is('application/json')) throw new TeamAuthError(415, 'AUTH_JSON_REQUIRED');
      }
      limit(`ip:${req.ip ?? 'unknown'}`, 60);
      next();
    } catch (error) { next(error); }
  });
  router.use(express.json({ limit: '16kb', strict: true }));
  router.use(deps.sessionMiddleware);
  router.use((req, _res, next) => {
    try {
      if (req.method !== 'GET') {
        const token = req.get('X-CSRF-Token');
        const expected = req.session?.teamAuth?.csrf;
        if (!token || !expected || token.length > 128 || !constantEqual(token, expected)) throw new TeamAuthError(403, 'AUTH_CSRF_REJECTED');
      }
      limit(`session:${req.sessionID}`, 40);
      if (req.session?.teamAuth?.principal) limit(`user:${req.session.teamAuth.principal.userId}`, 40);
      next();
    } catch (error) { next(error); }
  });

  router.get('/api/auth/bootstrap', run(async (req, res) => {
    const current = req.session?.teamAuth?.principal;
    if (current) {
      await service.persistence.inspect(current);
      await finish(req, res, { status: 'authenticated', csrfToken: req.session.teamAuth!.csrf });
      return;
    }
    // Replace expired pre-auth state; starting sign-in cannot renew a user session.
    await regenerateSession(req);
    req.session.teamAuth = { createdAt: now(), csrf: randomBytes(32).toString('hex') };
    const challenge = await service.bootstrap(binding(req));
    await finish(req, res, { status: 'signed_out', csrfToken: req.session.teamAuth.csrf,
      googleClientId: config.googleClientId, ...challenge });
  }));

  router.post('/api/auth/google', run(async (req, res) => {
    const input = googleLoginSchema.parse(req.body);
    if (req.session.teamAuth?.principal) throw new TeamAuthError(409, 'AUTH_ALREADY_SIGNED_IN');
    const data = req.session.teamAuth;
    if (!data || now() >= data.createdAt + AUTH_POLICY.challengeMs) throw new TeamAuthError(401, 'AUTH_REQUIRED');
    const user = await service.login(binding(req), input.challengeId, input.credential);
    await regenerateSession(req);
    const clock = now();
    req.session.teamAuth = { createdAt: clock, csrf: randomBytes(32).toString('hex'),
      principal: { userId: user.id, sessionVersion: user.sessionVersion, authenticatedAt: clock, lastSeenAt: clock } };
    await finish(req, res, { status: 'authenticated', user: { id: user.id }, csrfToken: req.session.teamAuth.csrf });
  }));

  router.get('/api/auth/session', run(async (req, res) => {
    if (!req.session.teamAuth?.principal) { discardResponseSession(req, res, config); res.status(401).json({ status: 'signed_out' }); return; }
    const account = await service.persistence.inspect(principal(req));
    await finish(req, res, { status: 'authenticated', user: { id: account.user.id } });
  }));

  router.post('/api/auth/logout', run(async (req, res) => {
    emptyAuthBodySchema.parse(req.body);
    await service.persistence.logout(principal(req));
    await destroySession(req, res, config);
    res.json({ status: 'signed_out', scope: 'all_tiber_sessions' });
  }));

  router.get('/api/team-private/sleeper-link', run(async (req, res) => {
    await finish(req, res, accountBody(await service.persistence.inspect(principal(req))));
  }));
  router.post('/api/team-private/sleeper-link/resolve', run(async (req, res) => {
    const input = sleeperResolveSchema.parse(req.body);
    const result = await service.resolveLink(principal(req), binding(req), input.usernameOrUserId);
    await finish(req, res, result);
  }));
  router.post('/api/team-private/sleeper-link', run(async (req, res) => {
    const input = sleeperConfirmSchema.parse(req.body);
    await finish(req, res, accountBody(await service.persistence.confirmLink(principal(req), binding(req), input.challengeId, input.expectedLinkVersion)));
  }));
  router.delete('/api/team-private/sleeper-link', run(async (req, res) => {
    const input = sleeperUnlinkSchema.parse(req.body);
    await finish(req, res, accountBody(await service.persistence.unlink(principal(req), input.expectedLinkVersion)));
  }));

  // These POSTs are read-only. Strict bodies preserve the no-query-string
  // private boundary; the caller never supplies a TIBER or Sleeper user ID.
  router.post(['/api/team-private/leagues', '/api/team-private/league-rosters'], run(async (req, res) => {
    const listing = req.path === '/api/team-private/leagues';
    const input = (listing ? privateLeaguesInput : privateLeagueRosterInput).parse(req.body);
    const leagueId = listing ? null : privateLeagueRosterInput.parse(req.body).leagueId;
    const auth = principal(req);
    const before = await service.persistence.inspect(auth);
    if (!before.link) throw new TeamAuthError(409, 'AUTH_SLEEPER_LINK_REQUIRED');
    let result;
    try {
      result = listing ? await discoverTeamLeagues(before.link.sleeperUserId, input.season)
        : await findTeamLeagueRosters(before.link.sleeperUserId, leagueId!, input.season);
    } catch { throw new TeamAuthError(502, 'TEAM_LEAGUES_UNAVAILABLE'); }
    // Slow upstream work must not return an old account after unlink/logout.
    const after = await service.persistence.inspect(auth);
    if (after.user.sleeperLinkVersion !== before.user.sleeperLinkVersion || after.link?.sleeperUserId !== before.link.sleeperUserId) {
      throw new TeamAuthError(409, 'AUTH_LINK_CHANGED');
    }
    await finish(req, res, result);
  }));

  const sanitize: ErrorRequestHandler = (error, req, res, _next) => {
    res.set('Cache-Control', 'private, no-store');
    const status = error instanceof TeamAuthError ? error.status : error?.type === 'entity.too.large' ? 413 :
      error?.type === 'entity.parse.failed' || error?.name === 'ZodError' ? 400 : 503;
    // A rejected cross-site navigation must not clear a valid browser cookie.
    // Conflicts/input errors likewise preserve login without renewing activity.
    discardResponseSession(req, res, config, status === 401 || status === 503);
    const code = error instanceof TeamAuthError ? error.code : status === 413 ? 'AUTH_BODY_TOO_LARGE' :
      status === 400 ? 'AUTH_INVALID_INPUT' : 'AUTH_UNAVAILABLE';
    if (status === 429) res.set('Retry-After', '60');
    res.status(status).json({ error: code });
  };
  router.use(sanitize);
  return router;
}

export async function loadTeamAuthRouter(): Promise<RequestHandler> {
  const config = readTeamAuthConfig();
  const runtime = createPgAuthSession(config);
  try {
    await runtime.ready();
    const service = new TeamAuthService(runtime.persistence, createGoogleVerifier(config.googleClientId), input => sleeperClient.getUser(input));
    return createTeamAuthRouter({ config, service, sessionMiddleware: runtime.middleware });
  } catch {
    await runtime.close().catch(() => undefined);
    throw new TeamAuthError(503, 'AUTH_UNAVAILABLE');
  }
}
