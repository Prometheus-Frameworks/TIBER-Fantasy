jest.mock('../../services/forgeRebuildService', () => ({
  rebuildForgeContext: jest.fn(),
}));

const mockExecute = jest.fn();
jest.mock('../../infra/db', () => ({
  db: {
    execute: mockExecute,
  },
}));

import express from 'express';
import request from 'supertest';
import adminForgeRouter from '../adminForge';

const originalForgeAdminKey = process.env.FORGE_ADMIN_KEY;

describe('FORGE admin status authentication', () => {
  function buildApp() {
    const app = express();
    app.use(express.json());
    app.use(adminForgeRouter);
    return app;
  }

  beforeEach(() => {
    process.env.FORGE_ADMIN_KEY = 'forge-admin-secret';
    mockExecute.mockReset();
    mockExecute
      .mockResolvedValueOnce({ rows: [{ season: 2025, week: 18, teams: 32 }] })
      .mockResolvedValueOnce({ rows: [{ season: 2025, week: 18, teams: 32, last_refresh: '2026-01-01' }] })
      .mockResolvedValueOnce({ rows: [{ season: 2025, latest_week: 18, plays: 1000 }] });
  });

  afterAll(() => {
    if (originalForgeAdminKey === undefined) {
      delete process.env.FORGE_ADMIN_KEY;
    } else {
      process.env.FORGE_ADMIN_KEY = originalForgeAdminKey;
    }
  });

  it.each([
    ['missing', undefined],
    ['invalid', 'wrong-secret'],
  ])('rejects a %s FORGE admin key before querying status data', async (_label, providedKey) => {
    const statusRequest = request(buildApp()).get('/api/admin/forge/status');
    if (providedKey) {
      statusRequest.set('x-forge-admin-key', providedKey);
    }

    const response = await statusRequest;

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      ok: false,
      error: 'Unauthorized - invalid or missing X-FORGE-ADMIN-KEY header',
    });
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it('rejects status when FORGE admin authentication is not configured', async () => {
    delete process.env.FORGE_ADMIN_KEY;

    const response = await request(buildApp()).get('/api/admin/forge/status');

    expect(response.status).toBe(401);
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it('returns status to a valid FORGE admin key', async () => {
    const response = await request(buildApp())
      .get('/api/admin/forge/status')
      .set('x-forge-admin-key', 'forge-admin-secret');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      ok: true,
      offensiveContext: [{ season: 2025, week: 18, teams: 32 }],
      forgeEnvironment: [{ season: 2025, week: 18, teams: 32, last_refresh: '2026-01-01' }],
      pbpData: [{ season: 2025, latest_week: 18, plays: 1000 }],
    });
    expect(mockExecute).toHaveBeenCalledTimes(3);
  });
});
