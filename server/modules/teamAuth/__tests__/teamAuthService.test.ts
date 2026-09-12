import { generateKeyPairSync, sign, randomUUID } from 'node:crypto';
import { OAuth2Client } from 'google-auth-library';
import { AUTH_POLICY, TeamAuthError, type AuthPrincipal } from '@shared/teamAuth';
import { authHash, boundedGoogleClient, createGoogleVerifier } from '../googleIdentity';
import { PgAuthPersistence, TeamAuthService, assertPrincipalLifetime, type AuthPersistence } from '../teamAuthService';
import { readTeamAuthConfig } from '../config';
import { createPgAuthSession } from '../session';

const audience = 'synthetic-client.apps.googleusercontent.com';
const nonce = 'a'.repeat(64);
const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const token = (claims: Record<string, unknown>, key = privateKey) => {
  const body = [ { alg: 'RS256', kid: 'synthetic-key', typ: 'JWT' }, claims ]
    .map(part => Buffer.from(JSON.stringify(part)).toString('base64url')).join('.');
  return `${body}.${sign('RSA-SHA256', Buffer.from(body), key).toString('base64url')}`;
};
const now = Date.now();
const claims = () => ({ iss: 'https://accounts.google.com', aud: audience, sub: 'synthetic-subject',
  nonce, iat: Math.floor(now / 1000), exp: Math.floor(now / 1000) + 3600 });

describe('actual installed Google verifier with synthetic signed tokens', () => {
  function verifier() {
    const client = new OAuth2Client();
    jest.spyOn(client, 'getFederatedSignonCertsAsync').mockResolvedValue({
      certs: { 'synthetic-key': publicKey.export({ type: 'spki', format: 'pem' }) }, format: 'PEM',
    } as any);
    return createGoogleVerifier(audience, client, () => now);
  }

  test.each(['accounts.google.com', 'https://accounts.google.com'])('canonicalizes accepted issuer %s', async iss => {
    expect(await verifier()(token({ ...claims(), iss }), authHash(nonce), now - 1000))
      .toEqual({ issuer: 'https://accounts.google.com', subject: 'synthetic-subject', expiresAt: claims().exp * 1000 });
  });
  test.each([
    ['wrong audience', { aud: 'another-client' }], ['wrong issuer', { iss: 'https://attacker.test' }],
    ['missing nonce', { nonce: undefined }], ['wrong nonce', { nonce: 'b'.repeat(64) }],
    ['recently expired within library skew', { exp: Math.floor(now / 1000) - 1 }],
    ['string expiry', { exp: String(Math.floor(now / 1000) + 3600) }],
    ['string issued-at', { iat: String(Math.floor(now / 1000)) }],
    ['future issued-at within library skew', { iat: Math.floor(now / 1000) + 60 }],
    ['issued before challenge', { iat: Math.floor(now / 1000) - 120 }],
    ['wrong authorized party', { azp: 'another-client' }], ['non-string subject', { sub: 123 }],
  ])('rejects %s', async (_label, change) => {
    await expect(verifier()(token({ ...claims(), ...change }), authHash(nonce), now - 1000))
      .rejects.toMatchObject({ status: 401, code: 'AUTH_INVALID_CREDENTIAL' });
  });
  test('rejects a forged signature and an expired challenge', async () => {
    const other = generateKeyPairSync('rsa', { modulusLength: 2048 });
    await expect(verifier()(token(claims(), other.privateKey), authHash(nonce), now - 1000)).rejects.toMatchObject({ status: 401 });
    await expect(verifier()(token(claims()), authHash(nonce), now - AUTH_POLICY.challengeMs)).rejects.toMatchObject({ status: 401 });
  });
  test('certificate transport is abortable, bounded, and disables retry', async () => {
    const client = boundedGoogleClient();
    const interceptor = Array.from(client.transporter.interceptors.request).find(item => item?.resolved)!;
    const options = await interceptor!.resolved!({ url: new URL('https://www.googleapis.com/oauth2/v1/certs') } as any);
    expect(options.timeout).toBe(10000); expect(options.retry).toBe(false);
    expect(options.retryConfig?.retry).toBe(0); expect(options.signal).toBeInstanceOf(AbortSignal);
  });
  test('certificate failures expose an unavailable code without raw diagnostics', async () => {
    const client = { verifyIdToken: jest.fn().mockRejectedValue(new Error('Failed to retrieve verification certificates: sensitive transport data')) };
    await expect(createGoogleVerifier(audience, client as any)(token(claims()), authHash(nonce), now))
      .rejects.toMatchObject({ status: 503, message: 'AUTH_IDENTITY_UNAVAILABLE' });
  });
});

describe('persistence authorization and transaction boundaries without a database', () => {
  const userId = randomUUID();
  const auth: AuthPrincipal = { userId, sessionVersion: 2, authenticatedAt: now - 1000, lastSeenAt: now - 1000 };
  function repository(userVersion = 2, clock = () => now) {
    const query = jest.fn(async (sql: string) => ({ rows: sql.includes('FROM tiber_users') ?
      [{ id: userId, status: 'active', session_version: userVersion, sleeper_link_version: 4 }] : [] }));
    const release = jest.fn();
    const client = { query, release };
    const repo = new PgAuthPersistence({ connect: jest.fn(async () => client) } as any, clock);
    return { repo, query, release };
  }
  test('revoked session cannot read or mutate links', async () => {
    const { repo, query } = repository(3);
    await expect(repo.inspect(auth)).rejects.toMatchObject({ status: 401 });
    await expect(repo.unlink(auth, 4)).rejects.toMatchObject({ status: 401 });
    expect(query.mock.calls.some(([sql]) => sql.includes('tiber_sleeper_links'))).toBe(false);
    expect(query.mock.calls.filter(([sql]) => sql === 'ROLLBACK')).toHaveLength(2);
  });
  test('logout locks the authenticated user then advances its version', async () => {
    const { repo, query, release } = repository();
    await repo.logout(auth);
    expect(query).toHaveBeenCalledWith(expect.stringContaining('WHERE id = $1 FOR UPDATE'), [userId]);
    expect(query).toHaveBeenCalledWith('UPDATE tiber_users SET session_version = session_version + 1 WHERE id = $1', [userId]);
    expect(query.mock.calls.at(-1)).toEqual(['COMMIT']); expect(release).toHaveBeenCalledTimes(1);
  });
  test('expiry is rechecked after acquiring the user lock', async () => {
    const clock = jest.fn().mockReturnValueOnce(now).mockReturnValue(now + AUTH_POLICY.absoluteMs);
    const { repo, query } = repository(2, clock);
    await expect(repo.unlink(auth, 4)).rejects.toMatchObject({ status: 401 });
    expect(query.mock.calls.some(([sql]) => sql.startsWith('DELETE'))).toBe(false);
  });
  test('stale unlink version cannot delete a new link', async () => {
    const { repo, query } = repository();
    await expect(repo.unlink(auth, 3)).rejects.toMatchObject({ status: 409 });
    expect(query.mock.calls.some(([sql]) => sql.startsWith('DELETE'))).toBe(false);
  });
  test('token expiry during the login user lock rolls back without consuming the challenge', async () => {
    const query = jest.fn(async (sql: string) => ({ rows: sql.includes('SELECT id, payload') ?
      [{ id: randomUUID(), payload: { nonceHash: authHash(nonce) }, created_at: new Date(now), expires_at: new Date(now + 300000), consumed_at: null }] :
      sql.includes('INSERT INTO tiber_users') ? [{ id: userId, status: 'active', session_version: 2, sleeper_link_version: 4 }] : [] }));
    const repo = new PgAuthPersistence({ connect: async () => ({ query, release: jest.fn() }) } as any, () => now);
    await expect(repo.admitLogin(randomUUID(), 'binding', { issuer: 'https://accounts.google.com', subject: 'synthetic', expiresAt: now }))
      .rejects.toMatchObject({ status: 401, code: 'AUTH_INVALID_CREDENTIAL' });
    expect(query.mock.calls.some(([sql]) => sql.includes('SET consumed_at'))).toBe(false);
    expect(query.mock.calls.at(-1)).toEqual(['ROLLBACK']);
  });
  test('bounded challenge cleanup cannot wait for a concurrently held login challenge', async () => {
    const { repo, query } = repository();
    await repo.issueLogin('binding', authHash(nonce));
    expect(query).toHaveBeenCalledWith(expect.stringContaining('ORDER BY expires_at LIMIT 100 FOR UPDATE SKIP LOCKED'), [new Date(now)]);
  });
  test('pool failure exposes only the safe store error', async () => {
    const repo = new PgAuthPersistence({ connect: jest.fn().mockRejectedValue(new Error('password=synthetic-secret')) } as any);
    await expect(repo.inspect(auth)).rejects.toMatchObject({ status: 503, message: 'AUTH_STORE_UNAVAILABLE' });
  });
  test('idle and absolute expiry reject independently', () => {
    expect(() => assertPrincipalLifetime({ ...auth, lastSeenAt: now - AUTH_POLICY.idleMs }, now)).toThrow('AUTH_REQUIRED');
    expect(() => assertPrincipalLifetime({ ...auth, authenticatedAt: now - AUTH_POLICY.absoluteMs, lastSeenAt: now - 1 }, now)).toThrow('AUTH_REQUIRED');
  });
});

describe('explicit public Sleeper resolution', () => {
  const auth: AuthPrincipal = { userId: randomUUID(), sessionVersion: 0, authenticatedAt: now, lastSeenAt: now };
  const repository = () => ({ inspect: jest.fn().mockResolvedValue({}), issueLink: jest.fn().mockResolvedValue({ id: randomUUID(), expectedLinkVersion: 0 }) });
  test.each([null, {}, { user_id: 123 }, { user_id: 'different' }, { user_id: '456' }])('rejects malformed/mismatched numeric identity %#', async result => {
    const repo = repository(); const get = jest.fn().mockResolvedValue(result);
    const service = new TeamAuthService(repo as unknown as AuthPersistence, jest.fn(), get, () => now);
    await expect(service.resolveLink(auth, 'binding', '123')).rejects.toMatchObject({ status: 502 });
    expect(get).toHaveBeenCalledWith('123'); expect(repo.issueLink).not.toHaveBeenCalled();
  });
  test('resolution creates a confirmation preview and does not assert account control', async () => {
    const repo = repository(); const get = jest.fn().mockResolvedValue({ user_id: '123', username: 'synthetic', display_name: '<untrusted>' });
    const service = new TeamAuthService(repo as unknown as AuthPersistence, jest.fn(), get, () => now);
    const result = await service.resolveLink(auth, 'binding', 'synthetic');
    expect(result).toMatchObject({ accountControlVerified: false, linkMethod: 'operator_assertion',
      observation: { sleeperUserId: '123', sourceUrl: 'https://api.sleeper.app/v1/user/synthetic', receivedAt: new Date(now).toISOString() } });
    expect(repo.issueLink).toHaveBeenCalledWith(auth, 'binding', result.observation);
  });
  test('revocation rejects before source retrieval', async () => {
    const repo = repository(); repo.inspect.mockRejectedValue(new TeamAuthError(401, 'AUTH_REQUIRED'));
    const get = jest.fn(); const service = new TeamAuthService(repo as unknown as AuthPersistence, jest.fn(), get);
    await expect(service.resolveLink(auth, 'binding', 'synthetic')).rejects.toMatchObject({ status: 401 });
    expect(get).not.toHaveBeenCalled();
  });
});

describe('configuration and asynchronous store errors', () => {
  const env = { NODE_ENV: 'production', TEAM_AUTH_ORIGIN: 'https://team.example.test',
    TEAM_AUTH_GOOGLE_CLIENT_ID: audience, TEAM_AUTH_DATABASE_URL: 'postgresql://auth:synthetic@database.example.test/auth',
    TEAM_AUTH_SESSION_SECRET: 's'.repeat(64) };
  test.each([
    { TEAM_AUTH_DATABASE_URL: '' }, { TEAM_AUTH_DATABASE_URL: `${env.TEAM_AUTH_DATABASE_URL}?sslmode=no-verify` },
    { TEAM_AUTH_ORIGIN: 'http://team.example.test' }, { TEAM_AUTH_SESSION_SECRET: 'short' },
  ])('rejects missing/unsafe settings without legacy fallback %#', change => {
    expect(() => readTeamAuthConfig({ ...env, ...change, DATABASE_URL: env.TEAM_AUTH_DATABASE_URL, SESSION_SECRET: 'legacy' }))
      .toThrow('AUTH_NOT_CONFIGURED');
  });
  test('pool, store and pruning failures are logged as fixed codes', async () => {
    const log = jest.fn(); const runtime = createPgAuthSession(readTeamAuthConfig(env), log);
    const query = jest.spyOn(runtime.pool, 'query').mockRejectedValue(new Error('synthetic private connection details') as never);
    runtime.pool.emit('error', new Error('secret'));
    runtime.store.emit('error', new Error('secret'));
    runtime.store.pruneSessions();
    await new Promise(resolve => setImmediate(resolve));
    await new Promise(resolve => setImmediate(resolve));
    expect(log.mock.calls.flat()).toEqual(expect.arrayContaining(['AUTH_POOL_ERROR', 'AUTH_STORE_ERROR']));
    expect(JSON.stringify(log.mock.calls)).not.toContain('secret');
    await expect(runtime.ready()).rejects.toMatchObject({ message: 'AUTH_STORE_UNAVAILABLE' });
    expect(query.mock.calls.some(([sql]) => /CREATE|ALTER|INSERT/.test(String(sql)))).toBe(false);
    await runtime.close();
  });
});
