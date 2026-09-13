import express from 'express';
import request from 'supertest';
import { installTeamAuthApiBoundary } from '../runtimeProfile';
import { createDraftReviewRouter } from '../routes/draftReviewRoutes';

describe('team-auth runtime boundary', () => {
  test('installs before loading; unknown routes never reach auth or legacy handlers', async () => {
    const app = express(); const safeLog = jest.fn(); const privateHandler = jest.fn((_req, res) => res.json({ status: 'synthetic' }));
    app.use(createDraftReviewRouter()); const boundary = installTeamAuthApiBoundary(app, safeLog);
    const legacy = jest.fn((_req, res) => res.sendStatus(418)); app.all('/api/*', legacy);
    let loaded!: (handler: typeof privateHandler) => void;
    const loading = boundary.start(() => new Promise(resolve => { loaded = resolve; }));
    const pending = await request(app).get('/api/auth/bootstrap');
    expect(pending.status).toBe(503); expect(pending.headers['cache-control']).toBe('private, no-store');
    expect((await request(app).post('/api/team-private/leagues').send({ season: '2026' })).status).toBe(503);
    expect((await request(app).post('/api/team-private/league-rosters').send({ season: '2026', leagueId: '123' })).status).toBe(503);
    const secret = 'synthetic-sensitive-value';
    for (const path of [`/api/${secret}`, `/api/management?user_id=${secret}`, '/api/v1/health', '/api/sleeper/sync']) {
      expect((await request(app).post(path).send({ credential: secret })).status).toBe(404);
    }
    const publicResult = await request(app).get('/api/draft-review/evidence?player_ids=7526,9997').set('Cookie', 'tiber_local_session=untrusted');
    expect(publicResult.status).toBe(200); expect(publicResult.headers['set-cookie']).toBeUndefined();
    expect(privateHandler).not.toHaveBeenCalled(); expect(legacy).not.toHaveBeenCalled();
    loaded(privateHandler); await loading;
    expect((await request(app).get('/api/auth/bootstrap')).status).toBe(200);
    expect(privateHandler).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(safeLog.mock.calls)).not.toContain(secret);
    expect(safeLog.mock.calls.some(([line]) => line.includes('unknown_api 404'))).toBe(true);
  });
  test.each(['sync', 'async'])('%s loader failure remains sanitized and unavailable', async kind => {
    const app = express(); const log = jest.fn(); const boundary = installTeamAuthApiBoundary(app, log);
    await boundary.start(() => {
      if (kind === 'sync') throw new Error('sensitive connection detail');
      return Promise.reject(new Error('sensitive connection detail'));
    });
    const response = await request(app).get('/api/auth/bootstrap');
    expect(response.status).toBe(503); expect(response.body).toEqual({ error: 'AUTH_UNAVAILABLE' });
    expect(response.headers['cache-control']).toBe('private, no-store'); expect(JSON.stringify(log.mock.calls)).not.toContain('sensitive');
  });
  test('actual bootstrap excludes the legacy import graph and keeps the compiler independent', async () => {
    const previous = process.env.TIBER_RUNTIME_PROFILE; process.env.TIBER_RUNTIME_PROFILE = 'team-auth';
    const forbidden = ['../routes', '../api/v1/routes', '../infra/db', '../services/sleeperSyncV2/scheduler', '../cron/weeklyUpdate', '../llm'];
    const imports = jest.fn(); const loader = jest.fn(async () => { throw new Error('synthetic missing private configuration'); });
    const log = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    jest.resetModules();
    for (const name of forbidden) jest.doMock(name, () => { imports(name); throw new Error('Forbidden legacy import'); });
    jest.doMock('../routes/teamAuthRoutes', () => ({ loadTeamAuthRouter: loader }));
    try {
      const runtime = await import('../index');
      expect((await request(runtime.app).get('/api/auth/bootstrap')).status).toBe(503);
      await runtime.initBackground();
      expect(loader).toHaveBeenCalledTimes(1); expect(imports).not.toHaveBeenCalled();
      expect((await request(runtime.app).get('/api/runtime-profile')).body).toEqual({ profile: 'team-auth' });
      expect((await request(runtime.app).get('/api/auth/bootstrap')).status).toBe(503);
      expect((await request(runtime.app).get('/api/management')).status).toBe(404);
      const publicResult = await request(runtime.app).get('/api/draft-review/evidence?player_ids=7526,9997').set('Cookie', '__Host-tiber_session=untrusted');
      expect(publicResult.status).toBe(200); expect(publicResult.headers['set-cookie']).toBeUndefined();
      expect(imports).not.toHaveBeenCalled();
    } finally {
      if (previous === undefined) delete process.env.TIBER_RUNTIME_PROFILE; else process.env.TIBER_RUNTIME_PROFILE = previous;
      for (const name of [...forbidden, '../routes/teamAuthRoutes']) jest.dontMock(name);
      jest.resetModules(); log.mockRestore();
    }
  });
});
