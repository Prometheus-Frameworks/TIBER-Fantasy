import express from 'express';
import request from 'supertest';
import session from 'express-session';
import { randomUUID } from 'node:crypto';
import { AUTH_POLICY, TeamAuthError, type AuthPrincipal, type AuthUser, type SleeperLink, type SleeperLinkObservation } from '@shared/teamAuth';
import { createTeamAuthRouter } from '../teamAuthRoutes';
import { readTeamAuthConfig } from '../../modules/teamAuth/config';
import { createSessionMiddleware } from '../../modules/teamAuth/session';
import { TeamAuthService, assertPrincipalLifetime, type AuthPersistence } from '../../modules/teamAuth/teamAuthService';
import type { GoogleIdentity } from '../../modules/teamAuth/googleIdentity';

const config = readTeamAuthConfig({ NODE_ENV: 'development', TEAM_AUTH_ORIGIN: 'http://localhost',
  TEAM_AUTH_DATABASE_URL: 'postgresql://synthetic:synthetic@localhost/auth_test',
  TEAM_AUTH_SESSION_SECRET: 's'.repeat(64), TEAM_AUTH_GOOGLE_CLIENT_ID: 'synthetic.apps.googleusercontent.com' });

// Test-only storage: exercises HTTP/session ownership without a database or provider.
// PostgreSQL transaction ordering is tested separately; real lock races remain an activation gate.
function fixture() {
  let clock = Date.now(); const now = () => clock;
  const users = new Map<string, AuthUser>(); const subjects = new Map<string, string>();
  const links = new Map<string, SleeperLink>();
  const challenges = new Map<string, { id: string; binding: string; nonceHash: string; createdAt: number; consumed?: boolean;
    userId?: string; observation?: SleeperLinkObservation; version?: number }>();
  function active(auth: AuthPrincipal) {
    assertPrincipalLifetime(auth, now()); const user = users.get(auth.userId);
    if (!user || user.status !== 'active' || user.sessionVersion !== auth.sessionVersion) throw new TeamAuthError(401, 'AUTH_REQUIRED');
    return user;
  }
  function loginChallenge(id: string, binding: string) {
    const challenge = challenges.get(id);
    if (!challenge || challenge.binding !== binding || challenge.userId || challenge.consumed || now() >= challenge.createdAt + AUTH_POLICY.challengeMs)
      throw new TeamAuthError(401, 'AUTH_INVALID_CHALLENGE');
    return challenge;
  }
  const persistence: AuthPersistence = {
    async issueLogin(binding, nonceHash) {
      const challenge = { id: randomUUID(), binding, nonceHash, createdAt: now() };
      challenges.set(challenge.id, challenge); return challenge;
    },
    async peekLogin(id, binding) { return loginChallenge(id, binding); },
    async admitLogin(id, binding, identity) {
      const challenge = loginChallenge(id, binding); challenge.consumed = true;
      let userId = subjects.get(identity.subject);
      if (!userId) {
        userId = randomUUID(); subjects.set(identity.subject, userId);
        users.set(userId, { id: userId, status: 'active', sessionVersion: 0, sleeperLinkVersion: 0 });
      }
      const user = users.get(userId)!;
      if (user.status !== 'active') throw new TeamAuthError(401, 'AUTH_REQUIRED');
      return { ...user };
    },
    async inspect(auth) { return { user: { ...active(auth) }, link: links.get(auth.userId) ?? null }; },
    async issueLink(auth, binding, observation) {
      const user = active(auth);
      if (links.has(auth.userId)) throw new TeamAuthError(409, 'SLEEPER_LINK_EXISTS');
      const id = randomUUID(); challenges.set(id, { id, binding, nonceHash: '', createdAt: now(), userId: auth.userId, observation, version: user.sleeperLinkVersion });
      return { id, expectedLinkVersion: user.sleeperLinkVersion };
    },
    async confirmLink(auth, binding, id, version) {
      const user = active(auth); const challenge = challenges.get(id);
      if (!challenge || challenge.binding !== binding || challenge.userId !== auth.userId) throw new TeamAuthError(404, 'LINK_CHALLENGE_NOT_FOUND');
      if (challenge.consumed || now() >= challenge.createdAt + AUTH_POLICY.challengeMs || version !== user.sleeperLinkVersion || version !== challenge.version || links.has(auth.userId))
        throw new TeamAuthError(409, 'LINK_CONFIRMATION_STALE');
      challenge.consumed = true; user.sleeperLinkVersion++;
      links.set(auth.userId, { ...challenge.observation!, linkedAt: new Date(now()).toISOString(), linkMethod: 'operator_assertion' });
      return this.inspect(auth);
    },
    async unlink(auth, version) {
      const user = active(auth);
      if (user.sleeperLinkVersion !== version) throw new TeamAuthError(409, 'LINK_CONFIRMATION_STALE');
      links.delete(user.id); user.sleeperLinkVersion++;
      for (const [id, challenge] of Array.from(challenges)) if (challenge.userId === user.id) challenges.delete(id);
      return this.inspect(auth);
    },
    async logout(auth) { active(auth).sessionVersion++; },
  };
  const store = new session.MemoryStore();
  // Production connect-pg-simple disables touch; do not let MemoryStore mask stale JSON.
  store.touch = (_id, _data, callback) => callback?.();
  const verify = jest.fn(async (credential: string): Promise<GoogleIdentity> => ({ issuer: 'https://accounts.google.com', subject: credential, expiresAt: now() + 3600000 }));
  const source = jest.fn(async () => ({ user_id: '123456789', username: 'synthetic', display_name: 'Synthetic User' }));
  const app = express();
  app.use(createTeamAuthRouter({ config, service: new TeamAuthService(persistence, verify, source, now), sessionMiddleware: createSessionMiddleware(config, store), now }));
  const send = (agent: ReturnType<typeof request.agent>, method: 'post' | 'delete', url: string, csrf: string, body: unknown) =>
    agent[method](url).set('Origin', config.origin).set('X-CSRF-Token', csrf).send(body);
  async function login(subject = 'user-a') {
    const agent = request.agent(app); const bootstrap = await agent.get('/api/auth/bootstrap');
    expect(bootstrap.status).toBe(200);
    const response = await send(agent, 'post', '/api/auth/google', bootstrap.body.csrfToken, { challengeId: bootstrap.body.challengeId, credential: subject });
    expect(response.status).toBe(200);
    return { agent, csrf: response.body.csrfToken, userId: response.body.user.id, cookie: response.headers['set-cookie'], bootstrapCookie: bootstrap.headers['set-cookie'] };
  }
  return { app, store, persistence, source, verify, users, links, send, login, now, advance: (ms: number) => { clock += ms; } };
}

describe('private HTTP and session boundaries', () => {
  test('rotates sign-in cookie and CSRF; resolve requires confirmation; unlink is owner-scoped', async () => {
    const f = fixture(); const a = await f.login();
    expect(a.cookie[0]).not.toEqual(a.bootstrapCookie[0]); expect(a.cookie[0]).toContain('HttpOnly'); expect(a.cookie[0]).toContain('SameSite=Lax');
    const preview = await f.send(a.agent, 'post', '/api/team-private/sleeper-link/resolve', a.csrf, { usernameOrUserId: 'synthetic' });
    expect(preview.status).toBe(200); expect(preview.body.accountControlVerified).toBe(false); expect(f.links.size).toBe(0);
    const linked = await f.send(a.agent, 'post', '/api/team-private/sleeper-link', a.csrf, { challengeId: preview.body.challengeId, expectedLinkVersion: 0, confirm: true });
    expect(linked.status).toBe(200); expect(linked.body.linkVersion).toBe(1); expect(linked.body.sleeperLink.sleeperUserId).toBe('123456789');
    const unlinked = await f.send(a.agent, 'delete', '/api/team-private/sleeper-link', a.csrf, { expectedLinkVersion: 1 });
    expect(unlinked.status).toBe(200); expect(unlinked.body.sleeperLink).toBeNull(); expect(unlinked.body.linkVersion).toBe(2);
  });
  test('two TIBER users can assert the same public Sleeper ID without shared ownership', async () => {
    const f = fixture(); const a = await f.login('a'); const b = await f.login('b');
    for (const user of [a, b]) {
      const preview = await f.send(user.agent, 'post', '/api/team-private/sleeper-link/resolve', user.csrf, { usernameOrUserId: '123456789' });
      expect((await f.send(user.agent, 'post', '/api/team-private/sleeper-link', user.csrf,
        { challengeId: preview.body.challengeId, expectedLinkVersion: 0, confirm: true })).status).toBe(200);
    }
    await f.send(a.agent, 'delete', '/api/team-private/sleeper-link', a.csrf, { expectedLinkVersion: 1 });
    expect((await b.agent.get('/api/team-private/sleeper-link')).body.sleeperLink.sleeperUserId).toBe('123456789');
    expect(f.links.has(a.userId)).toBe(false); expect(f.links.has(b.userId)).toBe(true);
  });
  test('foreign confirmation is unavailable and cannot transfer a link', async () => {
    const f = fixture(); const a = await f.login('a'); const b = await f.login('b');
    const preview = await f.send(a.agent, 'post', '/api/team-private/sleeper-link/resolve', a.csrf, { usernameOrUserId: 'synthetic' });
    const result = await f.send(b.agent, 'post', '/api/team-private/sleeper-link', b.csrf, { challengeId: preview.body.challengeId, expectedLinkVersion: 0, confirm: true });
    expect(result.status).toBe(404); expect(f.links.size).toBe(0);
  });
  test('concurrent confirmation admits once; replay receives a stale result', async () => {
    const f = fixture(); const a = await f.login();
    const preview = await f.send(a.agent, 'post', '/api/team-private/sleeper-link/resolve', a.csrf, { usernameOrUserId: 'synthetic' });
    const responses = await Promise.all([1, 2].map(() => f.send(a.agent, 'post', '/api/team-private/sleeper-link', a.csrf,
      { challengeId: preview.body.challengeId, expectedLinkVersion: 0, confirm: true })));
    expect(responses.map(r => r.status).sort()).toEqual([200, 409]); expect(f.links.size).toBe(1);
    expect(responses.find(r => r.status === 409)!.headers['set-cookie']).toBeUndefined();
    expect((await a.agent.get('/api/team-private/sleeper-link')).status).toBe(200);
  });
  test('logout revokes every session; a late saved copy cannot restore authority', async () => {
    const f = fixture(); const a = await f.login(); const other = await f.login();
    f.advance(1000);
    const save = f.store.set.bind(f.store); let release!: () => void;
    const entered = new Promise<void>(resolve => {
      jest.spyOn(f.store, 'set').mockImplementationOnce((sid, data, callback) => {
        release = () => save(sid, data, callback); resolve();
      });
    });
    const lateSave = Promise.resolve(other.agent.get('/api/auth/session'));
    await entered;
    const logout = await f.send(a.agent, 'post', '/api/auth/logout', a.csrf, {});
    expect(logout.body.scope).toBe('all_tiber_sessions');
    release(); const staleResponse = await lateSave;
    expect(staleResponse.status).toBe(200); // the read was admitted before logout
    const staleCookie = staleResponse.headers['set-cookie'].map((value: string) => value.split(';')[0]);
    expect((await request(f.app).get('/api/team-private/sleeper-link').set('Cookie', staleCookie)).status).toBe(401);
    expect((await other.agent.get('/api/auth/session')).status).toBe(401);
    expect((await f.login()).userId).toBe(a.userId);
  });
  test('idle activity persists in session JSON and absolute expiry is never extended', async () => {
    const f = fixture(); const a = await f.login();
    for (let day = 0; day < 13; day++) {
      f.advance(AUTH_POLICY.idleMs / 2);
      expect((await a.agent.get('/api/auth/session')).status).toBe(200);
    }
    const sessions = await new Promise<any>((resolve, reject) => f.store.all((error, value) => error ? reject(error) : resolve(value)));
    const current = Object.values(sessions).find((value: any) => value.teamAuth?.principal?.userId === a.userId) as any;
    expect(current.teamAuth.principal.lastSeenAt).toBe(f.now());
    expect(new Date(current.cookie.expires).getTime()).toBe(current.teamAuth.principal.authenticatedAt + AUTH_POLICY.absoluteMs);
    f.advance(AUTH_POLICY.idleMs / 2);
    expect((await a.agent.get('/api/auth/session')).status).toBe(401);
  });
  test.each(['query', 'owner', 'csrf', 'origin'])('rejects %s injection before source or private mutation', async variant => {
    const f = fixture(); const a = await f.login();
    const url = '/api/team-private/sleeper-link/resolve' + (variant === 'query' ? '?userId=another-user' : '');
    const result = await a.agent.post(url).set('Origin', variant === 'origin' ? 'https://attacker.test' : config.origin)
      .set('X-CSRF-Token', variant === 'csrf' ? 'forged' : a.csrf)
      .send({ usernameOrUserId: 'synthetic', ...(variant === 'owner' ? { userId: 'another-user' } : {}) });
    expect(result.status).toBe(variant === 'query' || variant === 'owner' ? 400 : 403);
    expect(result.headers['cache-control']).toBe('private, no-store'); expect(f.source).not.toHaveBeenCalled();
    expect(result.headers['set-cookie']).toBeUndefined();
    expect((await a.agent.get('/api/auth/session')).status).toBe(200);
  });
  test('cross-site navigation cannot clear the cookie or load a session', async () => {
    const f = fixture(); const a = await f.login(); const load = jest.spyOn(f.store, 'get');
    const response = await a.agent.get('/api/auth/session').set('Sec-Fetch-Site', 'cross-site');
    expect(response.status).toBe(403); expect(response.headers['set-cookie']).toBeUndefined(); expect(load).not.toHaveBeenCalled();
    expect((await a.agent.get('/api/auth/session')).status).toBe(200);
  });
  test('signed-out resolve cannot call the public source', async () => {
    const f = fixture(); const agent = request.agent(f.app); const bootstrap = await agent.get('/api/auth/bootstrap');
    expect((await f.send(agent, 'post', '/api/team-private/sleeper-link/resolve', bootstrap.body.csrfToken, { usernameOrUserId: 'synthetic' })).status).toBe(401);
    expect(f.source).not.toHaveBeenCalled();
  });
  test.each([['{raw-sensitive', 400], [JSON.stringify({ credential: 'sensitive'.repeat(3000) }), 413]])('parser errors are sanitized and no-store', async (body, status) => {
    const f = fixture(); const result = await request(f.app).post('/api/auth/google').set('Origin', config.origin).set('Content-Type', 'application/json').send(body);
    expect(result.status).toBe(status); expect(result.headers['cache-control']).toBe('private, no-store'); expect(result.text).not.toContain('sensitive');
  });
  test.each(['bootstrap', 'login', 'private'])('delayed %s save failure cannot emit success or a usable cookie', async stage => {
    const f = fixture(); let action: () => PromiseLike<any>;
    if (stage === 'private') {
      const a = await f.login(); action = () => a.agent.get('/api/auth/session');
    } else if (stage === 'login') {
      const agent = request.agent(f.app); const b = await agent.get('/api/auth/bootstrap');
      action = () => f.send(agent, 'post', '/api/auth/google', b.body.csrfToken, { challengeId: b.body.challengeId, credential: 'a' });
    } else action = () => request(f.app).get('/api/auth/bootstrap');
    let release!: () => void; const entered = new Promise<void>(resolve => {
      jest.spyOn(f.store, 'set').mockImplementation((_sid, _data, callback) => { release = () => callback?.(new Error('sensitive store error')); resolve(); });
    });
    let settled = false; const pending = Promise.resolve(action()).then(response => { settled = true; return response; });
    await entered; await new Promise(resolve => setImmediate(resolve)); expect(settled).toBe(false); release();
    const result = await pending;
    expect(result.status).toBe(503); expect(result.body).toEqual({ error: 'AUTH_STORE_UNAVAILABLE' });
    expect(result.headers['cache-control']).toBe('private, no-store');
    expect((result.headers['set-cookie'] ?? []).every((value: string) => value.startsWith('tiber_local_session=;'))).toBe(true);
  });
  test('session load failure stays unavailable and cannot log raw diagnostics', async () => {
    const f = fixture(); const a = await f.login();
    jest.spyOn(f.store, 'get').mockImplementation((_sid, callback) => callback(new Error('sensitive postgres error')));
    const result = await a.agent.get('/api/auth/session'); expect(result.status).toBe(503);
    expect(result.text).not.toContain('sensitive'); expect(result.headers['cache-control']).toBe('private, no-store');
  });
});
