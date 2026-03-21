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
    generateReport: jest.fn().mockResolvedValue({
      generatedAt: '2026-03-21T00:00:00.000Z',
      integration: {
        enabled: true,
        baseUrlConfigured: true,
        endpointPath: '/v1/forge/evaluations',
        timeoutMs: 5000,
        readiness: 'ready',
        startupConfigLogged: true,
        harnessRan: true,
        skippedReason: null,
      },
      summary: {
        totalFixtures: 2,
        comparableCount: 2,
        closeCount: 1,
        driftCount: 1,
        unavailableCount: 0,
        notComparableCount: 0,
        averageAbsoluteScoreDelta: 3.75,
        worstScoreDelta: {
          fixtureId: 'fixture-drift',
          fixtureName: 'Fixture drift',
          delta: 6.5,
          absoluteDelta: 6.5,
        },
      },
      results: [
        {
          fixtureId: 'fixture-close',
          fixtureName: 'Fixture close',
          fixtureNote: 'close',
          request: {
            playerId: '00-0036322',
            position: 'WR',
            season: 2025,
            week: 'season',
            mode: 'redraft',
            includeSourceMeta: true,
            includeRawCanonical: false,
          },
          parityStatus: 'close',
          comparable: true,
          scoreDelta: 1,
          absoluteScoreDelta: 1,
          confidenceDelta: 0.01,
          componentDeltas: { volume: 1, efficiency: 1, teamContext: 0, stability: 1 },
          notes: ['Within tolerance.'],
          legacyAvailable: true,
          externalAvailable: true,
          legacyStatus: 'ok',
          externalStatus: 'ok',
        },
      ],
    }),
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
    app.use(createForgeIntegrationRouter(service as any, service as any, service as any));

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
    app.use(createForgeIntegrationRouter(service as any, service as any, service as any));

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


  it('returns a deterministic parity report contract for migration inspection', async () => {
    const service = buildService();
    const app = express();
    app.use(express.json());
    app.use(createForgeIntegrationRouter(service as any, service as any, service as any));

    const res = await call(app, '/api/integrations/forge/parity-report');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      data: {
        generatedAt: '2026-03-21T00:00:00.000Z',
        integration: {
          enabled: true,
          baseUrlConfigured: true,
          readiness: 'ready',
          harnessRan: true,
          skippedReason: null,
        },
        summary: {
          totalFixtures: 2,
          comparableCount: 2,
          closeCount: 1,
          driftCount: 1,
          unavailableCount: 0,
          notComparableCount: 0,
          averageAbsoluteScoreDelta: 3.75,
        },
        results: [
          expect.objectContaining({ fixtureId: 'fixture-close', parityStatus: 'close', scoreDelta: 1 }),
        ],
      },
      meta: expect.objectContaining({
        integration: 'forge',
        mode: 'migration_parity_report',
      }),
    });
  });

  it('returns a clear disabled parity report when external FORGE is unavailable by config', async () => {
    const service = buildService({
      generateReport: jest.fn().mockResolvedValue({
        generatedAt: '2026-03-21T00:00:00.000Z',
        integration: {
          enabled: false,
          baseUrlConfigured: false,
          endpointPath: '/v1/forge/evaluations',
          timeoutMs: 5000,
          readiness: 'not_ready',
          startupConfigLogged: true,
          harnessRan: false,
          skippedReason: 'integration_disabled',
        },
        summary: {
          totalFixtures: 2,
          comparableCount: 0,
          closeCount: 0,
          driftCount: 0,
          unavailableCount: 2,
          notComparableCount: 0,
          averageAbsoluteScoreDelta: null,
          worstScoreDelta: null,
        },
        results: [
          {
            fixtureId: 'fixture-close',
            fixtureName: 'Fixture close',
            fixtureNote: 'close',
            request: {
              playerId: '00-0036322',
              position: 'WR',
              season: 2025,
              week: 'season',
              mode: 'redraft',
              includeSourceMeta: true,
              includeRawCanonical: false,
            },
            parityStatus: 'unavailable',
            comparable: false,
            scoreDelta: null,
            absoluteScoreDelta: null,
            confidenceDelta: null,
            componentDeltas: null,
            notes: ['External FORGE parity report skipped because the integration is disabled.'],
            legacyAvailable: false,
            externalAvailable: false,
            legacyStatus: null,
            externalStatus: null,
            externalErrorCategory: 'config_error',
          },
        ],
      }),
    });
    const app = express();
    app.use(express.json());
    app.use(createForgeIntegrationRouter(service as any, service as any, service as any));

    const res = await call(app, '/api/integrations/forge/parity-report');

    expect(res.status).toBe(200);
    expect(res.body.data.integration).toMatchObject({
      enabled: false,
      baseUrlConfigured: false,
      harnessRan: false,
      skippedReason: 'integration_disabled',
    });
    expect(res.body.data.summary).toMatchObject({ unavailableCount: 2, comparableCount: 0 });
    expect(res.body.data.results[0]).toMatchObject({
      parityStatus: 'unavailable',
      externalErrorCategory: 'config_error',
    });
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
    app.use(createForgeIntegrationRouter(service as any, service as any, service as any));

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
