import express from 'express';
import { AddressInfo } from 'net';
import { createDataLabRoleOpportunityRouter } from '../dataLabRoleOpportunityRoutes';
import { RoleOpportunityIntegrationError } from '../../modules/externalModels/roleOpportunity/types';

function buildService(overrides: Partial<any> = {}) {
  return {
    getRoleOpportunityLab: jest.fn().mockResolvedValue({
      season: 2025,
      week: 17,
      seasonScopeMarker: null,
      availableSeasons: [2025, 2024],
      rows: [
        {
          playerId: '00-0036322',
          playerName: 'Justin Jefferson',
          team: 'MIN',
          position: 'WR',
          season: 2025,
          week: 17,
          seasonScopeMarker: null,
          primaryRole: 'alpha_x',
          roleTags: ['boundary', 'downfield'],
          usage: {
            routeParticipation: 0.96,
            targetShare: 0.31,
            airYardShare: 0.42,
            snapShare: 0.93,
            usageRate: 0.28,
          },
          confidence: {
            score: 0.91,
            tier: 'featured',
          },
          source: {
            sourceName: 'tiber-data',
            sourceType: 'compatibility-view',
            modelVersion: 'role-opportunity-v1',
            generatedAt: '2026-03-23T00:00:00.000Z',
          },
          insights: ['High route participation'],
          rawFields: {
            primary_role: 'alpha_x',
          },
        },
      ],
      source: {
        provider: 'tiber-data',
        location: '/compatibility/role_opportunity_lab',
        mode: 'artifact',
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

describe('data lab role opportunity routes', () => {
  it('returns a ready payload with normalized role and opportunity rows', async () => {
    const service = buildService();
    const app = express();
    app.use('/api/data-lab', createDataLabRoleOpportunityRouter(service as any));

    const res = await call(app, '/api/data-lab/role-opportunity?season=2025&week=17');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.state).toBe('ready');
    expect(res.body.data.rows[0]).toEqual(
      expect.objectContaining({
        playerName: 'Justin Jefferson',
        primaryRole: 'alpha_x',
      }),
    );
    expect(service.getRoleOpportunityLab).toHaveBeenCalledWith(
      { season: 2025, week: 17 },
      { includeRawCanonical: false },
    );
  });

  it('returns an empty state when the upstream payload is valid but empty', async () => {
    const service = buildService({
      getRoleOpportunityLab: jest.fn().mockResolvedValue({
        season: 2025,
        week: null,
        seasonScopeMarker: 'season',
        availableSeasons: [2025],
        rows: [],
        source: {
          provider: 'tiber-data',
          location: '/compatibility/role_opportunity_lab',
          mode: 'artifact',
        },
      }),
    });
    const app = express();
    app.use('/api/data-lab', createDataLabRoleOpportunityRouter(service as any));

    const res = await call(app, '/api/data-lab/role-opportunity?season=2025');

    expect(res.status).toBe(200);
    expect(res.body.data.state).toBe('empty');
    expect(res.body.data.rows).toEqual([]);
  });

  it('surfaces malformed upstream payload failures with a stable code', async () => {
    const service = buildService({
      getRoleOpportunityLab: jest.fn().mockRejectedValue(
        new RoleOpportunityIntegrationError('invalid_payload', 'malformed payload', 502),
      ),
    });
    const app = express();
    app.use('/api/data-lab', createDataLabRoleOpportunityRouter(service as any));

    const res = await call(app, '/api/data-lab/role-opportunity?season=2025');

    expect(res.status).toBe(502);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe('invalid_payload');
  });
});
