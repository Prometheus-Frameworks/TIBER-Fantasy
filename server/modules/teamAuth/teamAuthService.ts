import { randomBytes, randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { z } from 'zod';
import { AUTH_POLICY, TeamAuthError, type AuthPrincipal, type AuthUser, type SleeperLink, type SleeperLinkObservation } from '@shared/teamAuth';
import { authHash, type GoogleIdentity, type GoogleVerifier } from './googleIdentity';

interface LoginChallenge { id: string; nonceHash: string; createdAt: number }
export interface PrivateAccount { user: AuthUser; link: SleeperLink | null }
export interface AuthPersistence {
  issueLogin(binding: string, nonceHash: string): Promise<LoginChallenge>;
  peekLogin(id: string, binding: string): Promise<LoginChallenge>;
  admitLogin(id: string, binding: string, identity: GoogleIdentity): Promise<AuthUser>;
  inspect(auth: AuthPrincipal): Promise<PrivateAccount>;
  issueLink(auth: AuthPrincipal, binding: string, observation: SleeperLinkObservation): Promise<{ id: string; expectedLinkVersion: number }>;
  confirmLink(auth: AuthPrincipal, binding: string, id: string, version: number): Promise<PrivateAccount>;
  unlink(auth: AuthPrincipal, version: number): Promise<PrivateAccount>;
  logout(auth: AuthPrincipal): Promise<void>;
}

export function assertPrincipalLifetime(auth: AuthPrincipal, now: number): void {
  if (!auth || !Number.isSafeInteger(auth.authenticatedAt) || !Number.isSafeInteger(auth.lastSeenAt) ||
      auth.authenticatedAt > now || auth.lastSeenAt > now || auth.lastSeenAt < auth.authenticatedAt ||
      now >= auth.authenticatedAt + AUTH_POLICY.absoluteMs || now >= auth.lastSeenAt + AUTH_POLICY.idleMs ||
      !Number.isSafeInteger(auth.sessionVersion) || auth.sessionVersion < 0 ||
      !z.string().uuid().safeParse(auth.userId).success) throw new TeamAuthError(401, 'AUTH_REQUIRED');
}

type Queryable = Pick<PoolClient, 'query'>;
type UserRow = { id: string; status: 'active' | 'disabled'; session_version: number; sleeper_link_version: number };
const asUser = (row: UserRow): AuthUser => ({
  id: row.id, status: row.status, sessionVersion: row.session_version, sleeperLinkVersion: row.sleeper_link_version,
});
const iso = (value: Date | string) => new Date(value).toISOString();

/** Parameterized SQL keeps the row locks and their mutation in one transaction.
 * No query uses legacy tables, and no user-scoped query accepts a caller owner.
 */
export class PgAuthPersistence implements AuthPersistence {
  constructor(private readonly pool: Pick<Pool, 'connect'>, private readonly now: () => number = Date.now) {}

  private async transaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
    let client: PoolClient | undefined;
    try {
      client = await this.pool.connect();
      await client.query('BEGIN');
      const value = await work(client);
      await client.query('COMMIT');
      return value;
    } catch (error) {
      if (client) await client.query('ROLLBACK').catch(() => undefined);
      if (error instanceof TeamAuthError) throw error;
      throw new TeamAuthError(503, 'AUTH_STORE_UNAVAILABLE');
    } finally { client?.release(); }
  }

  private async activeUser(client: Queryable, auth: AuthPrincipal): Promise<AuthUser> {
    assertPrincipalLifetime(auth, this.now());
    const result = await client.query<UserRow>('SELECT id, status, session_version, sleeper_link_version FROM tiber_users WHERE id = $1 FOR UPDATE', [auth.userId]);
    assertPrincipalLifetime(auth, this.now()); // lock acquisition may cross expiry
    const user = result.rows[0] && asUser(result.rows[0]);
    if (!user || user.status !== 'active' || user.sessionVersion !== auth.sessionVersion) throw new TeamAuthError(401, 'AUTH_REQUIRED');
    return user;
  }

  private async linkFor(client: Queryable, userId: string): Promise<SleeperLink | null> {
    const result = await client.query('SELECT sleeper_user_id, username, display_name, source_url, received_at, linked_at FROM tiber_sleeper_links WHERE user_id = $1', [userId]);
    const row = result.rows[0];
    return row ? { sleeperUserId: row.sleeper_user_id, username: row.username, displayName: row.display_name,
      sourceUrl: row.source_url, receivedAt: iso(row.received_at), linkedAt: iso(row.linked_at), linkMethod: 'operator_assertion' } : null;
  }

  private async prune(client: Queryable): Promise<void> {
    // Login locks challenge then user; link operations lock user first. Never
    // wait for a challenge held by another transaction during global cleanup.
    await client.query('DELETE FROM tiber_auth_challenges WHERE id IN (SELECT id FROM tiber_auth_challenges WHERE expires_at <= $1 ORDER BY expires_at LIMIT 100 FOR UPDATE SKIP LOCKED)', [new Date(this.now())]);
  }

  async issueLogin(binding: string, nonceHash: string): Promise<LoginChallenge> {
    return this.transaction(async client => {
      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [binding]);
      await this.prune(client);
      await client.query("DELETE FROM tiber_auth_challenges WHERE binding_hash = $1 AND kind = 'google_login'", [binding]);
      const createdAt = this.now(); const id = randomUUID();
      await client.query("INSERT INTO tiber_auth_challenges (id, kind, binding_hash, user_id, payload, created_at, expires_at) VALUES ($1, 'google_login', $2, NULL, $3, $4, $5)",
        [id, binding, JSON.stringify({ nonceHash }), new Date(createdAt), new Date(createdAt + AUTH_POLICY.challengeMs)]);
      return { id, nonceHash, createdAt };
    });
  }

  private async loginChallenge(client: Queryable, id: string, binding: string): Promise<LoginChallenge> {
    const result = await client.query("SELECT id, payload, created_at, expires_at, consumed_at FROM tiber_auth_challenges WHERE id = $1 AND binding_hash = $2 AND kind = 'google_login' AND user_id IS NULL FOR UPDATE", [id, binding]);
    const row = result.rows[0];
    if (!row || row.consumed_at || this.now() >= new Date(row.expires_at).getTime() ||
        !/^[a-f0-9]{64}$/.test(row.payload?.nonceHash ?? '')) throw new TeamAuthError(401, 'AUTH_INVALID_CHALLENGE');
    return { id: row.id, nonceHash: row.payload.nonceHash, createdAt: new Date(row.created_at).getTime() };
  }

  async peekLogin(id: string, binding: string): Promise<LoginChallenge> {
    return this.transaction(client => this.loginChallenge(client, id, binding));
  }

  async admitLogin(id: string, binding: string, identity: GoogleIdentity): Promise<AuthUser> {
    return this.transaction(async client => {
      const challenge = await this.loginChallenge(client, id, binding);
      const clock = new Date(this.now());
      const result = await client.query<UserRow>(`INSERT INTO tiber_users (id, issuer, subject, status, session_version, sleeper_link_version, created_at, last_login_at)
        VALUES ($1, $2, $3, 'active', 0, 0, $4, $4)
        ON CONFLICT (issuer, subject) DO UPDATE SET last_login_at = EXCLUDED.last_login_at
        RETURNING id, status, session_version, sleeper_link_version`, [randomUUID(), identity.issuer, identity.subject, clock]);
      // Recheck after the user-row lock: another login/logout may have held it.
      if (this.now() >= challenge.createdAt + AUTH_POLICY.challengeMs) throw new TeamAuthError(401, 'AUTH_INVALID_CHALLENGE');
      if (!Number.isSafeInteger(identity.expiresAt) || this.now() >= identity.expiresAt) throw new TeamAuthError(401, 'AUTH_INVALID_CREDENTIAL');
      const user = asUser(result.rows[0]);
      if (user.status !== 'active') throw new TeamAuthError(401, 'AUTH_REQUIRED');
      await client.query('UPDATE tiber_auth_challenges SET consumed_at = $1 WHERE id = $2', [new Date(this.now()), id]);
      return user;
    });
  }

  async inspect(auth: AuthPrincipal): Promise<PrivateAccount> {
    return this.transaction(async client => ({ user: await this.activeUser(client, auth), link: await this.linkFor(client, auth.userId) }));
  }

  async issueLink(auth: AuthPrincipal, binding: string, observation: SleeperLinkObservation): Promise<{ id: string; expectedLinkVersion: number }> {
    return this.transaction(async client => {
      const user = await this.activeUser(client, auth);
      if (await this.linkFor(client, auth.userId)) throw new TeamAuthError(409, 'SLEEPER_LINK_EXISTS');
      await this.prune(client);
      await client.query("DELETE FROM tiber_auth_challenges WHERE user_id = $1 AND binding_hash = $2 AND kind = 'sleeper_link'", [auth.userId, binding]);
      const id = randomUUID(); const clock = this.now();
      await client.query("INSERT INTO tiber_auth_challenges (id, kind, binding_hash, user_id, payload, created_at, expires_at) VALUES ($1, 'sleeper_link', $2, $3, $4, $5, $6)",
        [id, binding, auth.userId, JSON.stringify({ observation, expectedLinkVersion: user.sleeperLinkVersion }), new Date(clock), new Date(clock + AUTH_POLICY.challengeMs)]);
      return { id, expectedLinkVersion: user.sleeperLinkVersion };
    });
  }

  async confirmLink(auth: AuthPrincipal, binding: string, id: string, version: number): Promise<PrivateAccount> {
    return this.transaction(async client => {
      const user = await this.activeUser(client, auth);
      const result = await client.query("SELECT payload, expires_at, consumed_at FROM tiber_auth_challenges WHERE id = $1 AND binding_hash = $2 AND user_id = $3 AND kind = 'sleeper_link' FOR UPDATE", [id, binding, auth.userId]);
      const challenge = result.rows[0];
      if (!challenge) throw new TeamAuthError(404, 'LINK_CHALLENGE_NOT_FOUND');
      assertPrincipalLifetime(auth, this.now());
      if (challenge.consumed_at || this.now() >= new Date(challenge.expires_at).getTime() ||
          version !== user.sleeperLinkVersion || version !== challenge.payload.expectedLinkVersion ||
          await this.linkFor(client, auth.userId)) throw new TeamAuthError(409, 'LINK_CONFIRMATION_STALE');
      const observation = observationSchema.parse(challenge.payload.observation);
      const clock = new Date(this.now());
      await client.query("INSERT INTO tiber_sleeper_links (user_id, sleeper_user_id, username, display_name, source_url, received_at, linked_at, link_method) VALUES ($1, $2, $3, $4, $5, $6, $7, 'operator_assertion')",
        [auth.userId, observation.sleeperUserId, observation.username, observation.displayName, observation.sourceUrl, observation.receivedAt, clock]);
      await client.query('UPDATE tiber_users SET sleeper_link_version = sleeper_link_version + 1 WHERE id = $1', [auth.userId]);
      await client.query('UPDATE tiber_auth_challenges SET consumed_at = $1 WHERE id = $2 AND user_id = $3', [clock, id, auth.userId]);
      return { user: { ...user, sleeperLinkVersion: version + 1 }, link: await this.linkFor(client, auth.userId) };
    });
  }

  async unlink(auth: AuthPrincipal, version: number): Promise<PrivateAccount> {
    return this.transaction(async client => {
      const user = await this.activeUser(client, auth);
      if (user.sleeperLinkVersion !== version) throw new TeamAuthError(409, 'LINK_CONFIRMATION_STALE');
      await client.query('DELETE FROM tiber_sleeper_links WHERE user_id = $1', [auth.userId]);
      await client.query('UPDATE tiber_users SET sleeper_link_version = sleeper_link_version + 1 WHERE id = $1', [auth.userId]);
      await client.query("DELETE FROM tiber_auth_challenges WHERE user_id = $1 AND kind = 'sleeper_link'", [auth.userId]);
      return { user: { ...user, sleeperLinkVersion: version + 1 }, link: null };
    });
  }

  async logout(auth: AuthPrincipal): Promise<void> {
    return this.transaction(async client => {
      await this.activeUser(client, auth);
      await client.query('UPDATE tiber_users SET session_version = session_version + 1 WHERE id = $1', [auth.userId]);
      await client.query('DELETE FROM tiber_auth_challenges WHERE user_id = $1', [auth.userId]);
    });
  }
}

const sleeperUserSchema = z.object({
  user_id: z.string().regex(/^\d{1,32}$/),
  username: z.string().min(1).max(128).nullable().optional(),
  display_name: z.string().min(1).max(256).nullable().optional(),
});
const observationSchema = z.object({
  sleeperUserId: z.string().regex(/^\d{1,32}$/), username: z.string().max(128).nullable(),
  displayName: z.string().max(256).nullable(), sourceUrl: z.string().url(), receivedAt: z.string().datetime(),
}).strict();

export class TeamAuthService {
  constructor(
    readonly persistence: AuthPersistence,
    private readonly verifyGoogle: GoogleVerifier,
    private readonly getSleeperUser: (input: string) => Promise<unknown>,
    private readonly now: () => number = Date.now,
  ) {}

  async bootstrap(binding: string) {
    const nonce = randomBytes(32).toString('hex');
    const challenge = await this.persistence.issueLogin(binding, authHash(nonce));
    return { challengeId: challenge.id, nonce, expiresAt: new Date(challenge.createdAt + AUTH_POLICY.challengeMs).toISOString() };
  }

  async login(binding: string, id: string, credential: string): Promise<AuthUser> {
    const challenge = await this.persistence.peekLogin(id, binding);
    const identity = await this.verifyGoogle(credential, challenge.nonceHash, challenge.createdAt);
    return this.persistence.admitLogin(id, binding, identity);
  }

  async resolveLink(auth: AuthPrincipal, binding: string, input: string) {
    await this.persistence.inspect(auth); // deny before external work
    let observation: SleeperLinkObservation;
    try {
      const user = sleeperUserSchema.parse(await this.getSleeperUser(encodeURIComponent(input)));
      if (/^\d+$/.test(input) && user.user_id !== input) throw new Error('mismatched identity');
      observation = { sleeperUserId: user.user_id, username: user.username ?? null, displayName: user.display_name ?? null,
        sourceUrl: `https://api.sleeper.app/v1/user/${encodeURIComponent(input)}`, receivedAt: new Date(this.now()).toISOString() };
    } catch { throw new TeamAuthError(502, 'SLEEPER_IDENTITY_UNAVAILABLE'); }
    // A session may expire or be revoked during source retrieval.
    const challenge = await this.persistence.issueLink(auth, binding, observation);
    return { challengeId: challenge.id, expectedLinkVersion: challenge.expectedLinkVersion, observation,
      linkMethod: 'operator_assertion' as const, accountControlVerified: false as const };
  }
}
