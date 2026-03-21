import express from 'express';
import { AddressInfo } from 'net';
import { createForgeIntegrationRouter } from '../forgeIntegrationRoutes';

function buildCompareResponse(overrides: Partial<any> = {}) {
  return {
    request: {
      playerId: '00-0036322',
      position: 'WR',
      season: 2025,
      week: 17,
      mode: 'redraft',
      includeSourceMeta: true,
      includeRawCanonical: false,
    },
    legacy: {
      available: true,
      data: {
        playerId: '00-0036322',
        playerName: 'Justin Jefferson',
        position: 'WR',
        team: 'MIN',
        season: 2025,
        week: 17,
        mode: 'redraft',
        score: { alpha: 80, tier: 'T2', tierRank: 2, confidence: 0.8 },
        components: { volume: 82, efficiency: 77, teamContext: 70, stability: 79 },
        metadata: { gamesSampled: 15, positionRank: 2, status: 'ok', issues: [] },
        source: { provider: 'legacy-forge', modelVersion: 'legacy-eg-v2', generatedAt: '2026-03-21T00:00:00.000Z' },
      },
    },
    external: {
      available: true,
      data: {
        playerId: '00-0036322',
        playerName: 'Justin Jefferson',
        position: 'WR',
        team: 'MIN',
        season: 2025,
        week: 17,
        mode: 'redraft',
        score: { alpha: 81.5, tier: 'T2', tierRank: 2, confidence: 0.82 },
        components: { volume: 84, efficiency: 78, teamContext: 72, stability: 80 },
        metadata: { gamesSampled: 15, positionRank: 2, status: 'ok', issues: [] },
        source: {
          provider: 'external-forge',
          modelVersion: '2026.03.0',
          contractVersion: '1.0.0',
          calibrationVersion: 'alpha-redraft-2025-v1',
          generatedAt: '2026-03-21T00:00:00.000Z',
        },
      },
    },
    comparison: {
      scoreDelta: 1.5,
      componentDeltas: { volume: 2, efficiency: 1, teamContext: 2, stability: 1 },
      confidenceDelta: 0.02,
      notes: ['Alpha delta stayed within migration tolerance at 1.5 points.'],
      parityStatus: 'close',
    },
    ...overrides,
  };
}

function buildService(overrides: Partial<any> = {}) {
  return {
    getStatus: jest.fn().mockReturnValue({
      enabled: true,
      configured: true,
      endpointPath: '/v1/forge/evaluations',
      timeoutMs: 5000,
      readiness: 'ready',
      startupConfigLogged: true,
    }),
    compare: jest.fn().mockResolvedValue(buildCompareResponse()),
    ...overrides,
  };
}

async function call(app: express.Express, path: string, init?: RequestInit) {
  const server = app.listen(0);
  const { port } = server.address() as AddressInfo;

  try {
    const response = await fetch(`http://127.0.0.1:${port}${path}`, init);
    return {
      status: response.status,
      body: await response.json(),
    };
  } finally {
    server.close();
  }
}

describe('forge integration routes', () => {
  it('returns both sides when compare succeeds', async () => {
    const service = buildService();
    const app = express();
    app.use(express.json());
    app.use(createForgeIntegrationRouter(service as any, service as any));

    const res = await call(app, '/api/integrations/forge/compare', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        playerId: '00-0036322',
        position: 'WR',
        season: 2025,
        week: 17,
        mode: 'redraft',
      }),
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.legacy.available).toBe(true);
    expect(res.body.data.external.available).toBe(true);
    expect(res.body.data.comparison.parityStatus).toBe('close');
  });

  it('returns a useful partial result when one side fails', async () => {
    const service = buildService({
      compare: jest.fn().mockResolvedValue(
        buildCompareResponse({
          external: {
            available: false,
            error: {
              category: 'upstream_timeout',
              message: 'External FORGE timed out after 5000ms.',
            },
          },
          comparison: {
            notes: ['Only one FORGE implementation returned data for this request.'],
            parityStatus: 'unavailable',
          },
        }),
      ),
    });

    const app = express();
    app.use(express.json());
    app.use(createForgeIntegrationRouter(service as any, service as any));

    const res = await call(app, '/api/integrations/forge/compare', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        playerId: '00-0036322',
        position: 'WR',
        season: 2025,
        week: 17,
        mode: 'redraft',
      }),
    });

    expect(res.status).toBe(200);
    expect(res.body.data.external.available).toBe(false);
    expect(res.body.data.external.error.category).toBe('upstream_timeout');
    expect(res.body.data.comparison.parityStatus).toBe('unavailable');
  });

  it('returns sensible health/config output', async () => {
    const service = buildService({
      getStatus: jest.fn().mockReturnValue({
        enabled: false,
        configured: false,
        endpointPath: '/v1/forge/evaluations',
        timeoutMs: 5000,
        readiness: 'not_ready',
        startupConfigLogged: true,
      }),
    });

    const app = express();
    app.use(express.json());
    app.use(createForgeIntegrationRouter(service as any, service as any));

    const res = await call(app, '/api/integrations/forge/health');

    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({
      success: false,
      integration: 'forge',
      migrationMode: 'dual_run_compare_only',
      readiness: 'not_ready',
    });
  });
});
