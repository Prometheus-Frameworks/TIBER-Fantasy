import session, { type Store } from 'express-session';
import pgSession from 'connect-pg-simple';
import { Pool } from 'pg';
import type { Request, Response, RequestHandler } from 'express';
import { AUTH_POLICY, TeamAuthError, type AuthPrincipal } from '@shared/teamAuth';
import type { TeamAuthConfig } from './config';
import { assertPrincipalLifetime, PgAuthPersistence } from './teamAuthService';

declare module 'express-session' {
  interface SessionData {
    teamAuth?: { createdAt: number; csrf: string; principal?: AuthPrincipal };
  }
}

export const cookieOptions = (config: TeamAuthConfig) => ({
  secure: config.secure, httpOnly: true, sameSite: 'lax' as const, path: '/',
});

export function createSessionMiddleware(config: TeamAuthConfig, store: Store): RequestHandler {
  const middleware = session({
    name: config.cookieName, secret: config.sessionSecret, store,
    resave: false, saveUninitialized: false, rolling: false,
    cookie: { ...cookieOptions(config), maxAge: AUTH_POLICY.challengeMs },
  });
  return (req, res, next) => middleware(req, res, error => {
    if (error) return next(new TeamAuthError(503, 'AUTH_STORE_UNAVAILABLE'));
    next();
  });
}

export async function regenerateSession(req: Request): Promise<void> {
  await new Promise<void>((resolve, reject) => req.session.regenerate(error =>
    error ? reject(new TeamAuthError(503, 'AUTH_STORE_UNAVAILABLE')) : resolve()));
}

/** Explicitly persist before emitting success. End-of-response touch is inert;
 * the store's touch is disabled as well. No cookie is a substitute for a save.
 */
export async function persistSession(req: Request, now: number = Date.now()): Promise<void> {
  const data = req.session?.teamAuth;
  if (!data) throw new TeamAuthError(401, 'AUTH_REQUIRED');
  let deadline: number;
  if (data.principal) {
    assertPrincipalLifetime(data.principal, now);
    data.principal.lastSeenAt = now;
    deadline = Math.min(now + AUTH_POLICY.idleMs, data.principal.authenticatedAt + AUTH_POLICY.absoluteMs);
  } else {
    deadline = data.createdAt + AUTH_POLICY.challengeMs;
    if (now >= deadline || now < data.createdAt) throw new TeamAuthError(401, 'AUTH_REQUIRED');
  }
  req.session.cookie.expires = new Date(deadline);
  Object.defineProperty(req.session, 'touch', { value() { return this; }, configurable: true, enumerable: false });
  await new Promise<void>((resolve, reject) => req.session.save(error =>
    error ? reject(new TeamAuthError(503, 'AUTH_STORE_UNAVAILABLE')) : resolve()));
}

export async function destroySession(req: Request, res: Response, config: TeamAuthConfig): Promise<void> {
  await new Promise<void>((resolve, reject) => req.session.destroy(error =>
    error ? reject(new TeamAuthError(503, 'AUTH_STORE_UNAVAILABLE')) : resolve()));
  res.clearCookie(config.cookieName, cookieOptions(config));
}

export function discardResponseSession(req: Request, res: Response, config: TeamAuthConfig, clearCookie = true): void {
  // Prevent automatic response-end persistence after any failure.
  req.session = undefined as unknown as Request['session'];
  if (clearCookie) res.clearCookie(config.cookieName, cookieOptions(config));
}

export function createPgAuthSession(config: TeamAuthConfig, safeLog: (code: string) => void = code => console.warn(code)) {
  const pool = new Pool({
    connectionString: config.databaseUrl,
    ssl: config.secure ? { rejectUnauthorized: true, ...(config.databaseCa ? { ca: config.databaseCa } : {}) } : false,
    max: 4, connectionTimeoutMillis: 5000, idleTimeoutMillis: 30000,
    statement_timeout: 5000, query_timeout: 6000,
    options: '-c timezone=UTC -c lock_timeout=3000 -c idle_in_transaction_session_timeout=5000',
  });
  pool.on('error', () => safeLog('AUTH_POOL_ERROR'));
  const PgStore = pgSession(session);
  const store = new PgStore({ pool, tableName: 'tiber_auth_sessions', createTableIfMissing: false,
    disableTouch: true, pruneSessionInterval: 900, errorLog: () => safeLog('AUTH_STORE_ERROR') });
  store.on('error', () => safeLog('AUTH_STORE_ERROR'));
  const close = async () => { await store.close(); await pool.end(); };
  const ready = async () => {
    try {
      // Presence/shape witness only. This never creates or migrates tables.
      await pool.query('SELECT id, issuer, subject, status, session_version, sleeper_link_version, created_at, last_login_at FROM tiber_users WHERE false');
      await pool.query('SELECT sid, sess, expire FROM tiber_auth_sessions WHERE false');
      await pool.query('SELECT id, kind, binding_hash, user_id, payload, created_at, expires_at, consumed_at FROM tiber_auth_challenges WHERE false');
      await pool.query('SELECT user_id, sleeper_user_id, username, display_name, source_url, received_at, linked_at, link_method FROM tiber_sleeper_links WHERE false');
    } catch { throw new TeamAuthError(503, 'AUTH_STORE_UNAVAILABLE'); }
  };
  return { pool, store, persistence: new PgAuthPersistence(pool), middleware: createSessionMiddleware(config, store), ready, close };
}
