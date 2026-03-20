import express from 'express';
import { AddressInfo } from 'net';
import { createRoleOpportunityIntegrationRouter } from '../roleOpportunityIntegrationRoutes';
import { RoleOpportunityIntegrationError } from '../../modules/externalModels/roleOpportunity/types';

function buildService(overrides: Partial<any> = {}) {
  return {
    getStatus: jest.fn().mockReturnValue({
      enabled: true,
      configured: true,
      endpointPath: '/api/role-opportunity',
      timeoutMs: 5000,
      readiness: 'ready',
      startupConfigLogged: true,
    }),
    getRoleOpportunityInsight: jest.fn().mockResolvedValue({
      playerId: '00-0036322',
      season: 2025,
      week: 17,
      position: 'WR',
      team: 'MIN',
      primaryRole: 'alpha_x',
      roleTags: ['boundary'],
      usage: {
        snapShare: 0.93,
        routeShare: 0.96,
        targetShare: 0.31,
        usageRate: 0.28,
      },
      opportunity: {
        tier: 'featured',
        weightedOpportunityIndex: 0.88,
        insights: ['High route participation'],
      },
      confidence: 0.91,
      source: {
        provider: 'role-and-opportunity-model',
        modelVersion: 'role-opportunity-v1',
        generatedAt: '2026-03-20T00:00:00.000Z',
      },
    }),
    ...overrides,
  };
}

async function call(app: express.Express, path: string) {
  const server = app.listen(0);
  const { port } = server.address() as AddressInfo;

  try {
    const response = await fetch(`http://127.0.0.1:${port}${path}`);
    return {
      status: response.status,
      body: await response.json(),
    };
  } finally {
    server.close();
  }
}

describe('role opportunity integration routes', () => {
  it('returns the expected TIBER envelope for a valid integration request', async () => {
    const service = buildService();
    const app = express();
    app.use(createRoleOpportunityIntegrationRouter(service as any));

    const res = await call(app, '/api/integrations/role-opportunity/00-0036322?season=2025&week=17');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual(
      expect.objectContaining({
        playerId: '00-0036322',
        season: 2025,
        week: 17,
      }),
    );
    expect(res.body.data.insight.primaryRole).toBe('alpha_x');
  });

  it('returns an explicit safe response when configuration is missing or integration is disabled', async () => {
    const service = buildService({
      getStatus: jest.fn().mockReturnValue({
        enabled: false,
        configured: false,
        endpointPath: '/api/role-opportunity',
        timeoutMs: 5000,
        readiness: 'not_ready',
        startupConfigLogged: true,
      }),
      getRoleOpportunityInsight: jest.fn().mockRejectedValue(
        new RoleOpportunityIntegrationError('config_error', 'missing configuration', 503),
      ),
    });

    const app = express();
    app.use(createRoleOpportunityIntegrationRouter(service as any));

    const health = await call(app, '/api/integrations/role-opportunity/health');
    expect(health.status).toBe(503);
    expect(health.body.success).toBe(false);

    const res = await call(app, '/api/integrations/role-opportunity/00-0036322?season=2025&week=17');
    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({
      success: false,
      code: 'config_error',
    });
  });
});
