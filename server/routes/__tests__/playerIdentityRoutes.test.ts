import express from 'express';
import { AddressInfo } from 'net';

jest.mock('../../infra/db', () => ({
  db: {},
}));

jest.mock('../../services/PlayerIdentityService', () => ({
  playerIdentityService: {
    getByAnyId: jest.fn(),
    getCanonicalId: jest.fn(),
    searchByName: jest.fn(),
    getSystemStats: jest.fn(),
  },
}));

jest.mock('../../modules/externalModels/playerDetailEnrichment/playerDetailEnrichmentOrchestrator', () => ({
  orchestratePlayerDetailEnrichment: jest.fn(),
}));

import router from '../playerIdentityRoutes';
import { playerIdentityService } from '../../services/PlayerIdentityService';
import { orchestratePlayerDetailEnrichment } from '../../modules/externalModels/playerDetailEnrichment/playerDetailEnrichmentOrchestrator';

const mockedPlayerIdentityService = playerIdentityService as jest.Mocked<typeof playerIdentityService>;
const mockedOrchestratePlayerDetailEnrichment = orchestratePlayerDetailEnrichment as jest.MockedFunction<typeof orchestratePlayerDetailEnrichment>;

async function call(path: string) {
  const app = express();
  app.use(router);
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

describe('playerIdentityRoutes role opportunity enrichment', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedOrchestratePlayerDetailEnrichment.mockResolvedValue({});
    mockedPlayerIdentityService.getByAnyId.mockResolvedValue({
      canonicalId: '00-0036322',
      fullName: 'Justin Jefferson',
      position: 'WR',
      nflTeam: 'MIN',
      confidence: 1,
      externalIds: {
        nfl_data_py: '00-0036322',
      },
      isActive: true,
      lastVerified: new Date('2026-03-20T00:00:00.000Z'),
    } as any);
  });

  it('returns the normal player payload when enrichment is not requested', async () => {
    const res = await call('/player/00-0036322');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.canonicalId).toBe('00-0036322');
    expect(res.body.data.roleOpportunityInsight).toBeUndefined();
    expect(mockedOrchestratePlayerDetailEnrichment).toHaveBeenCalledWith({
      playerId: '00-0036322',
      season: undefined,
      week: undefined,
      includeRoleOpportunity: false,
    });
  });

  it('returns an enriched player payload when includeRoleOpportunity=true is requested', async () => {
    mockedOrchestratePlayerDetailEnrichment.mockResolvedValue({
      roleOpportunityInsight: {
        available: true,
        fetchedAt: '2026-03-20T00:00:00.000Z',
        data: {
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
        },
      },
    });

    const res = await call('/player/00-0036322?includeRoleOpportunity=true&season=2025&week=17');

    expect(res.status).toBe(200);
    expect(res.body.data.roleOpportunityInsight).toMatchObject({
      available: true,
      data: {
        primaryRole: 'alpha_x',
      },
    });
    expect(mockedOrchestratePlayerDetailEnrichment).toHaveBeenCalledWith({
      playerId: '00-0036322',
      season: 2025,
      week: 17,
      includeRoleOpportunity: true,
    });
  });

  it('returns the same stable unavailable insight payload semantics when enrichment is unavailable', async () => {
    mockedOrchestratePlayerDetailEnrichment.mockResolvedValue({
      roleOpportunityInsight: {
        available: false,
        fetchedAt: '2026-03-20T00:00:00.000Z',
        error: {
          category: 'upstream_unavailable',
          message: 'Role opportunity service is temporarily unavailable.',
        },
      },
    });

    const res = await call('/player/00-0036322?includeRoleOpportunity=true&season=2025&week=17');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.roleOpportunityInsight).toEqual({
      available: false,
      fetchedAt: '2026-03-20T00:00:00.000Z',
      error: {
        category: 'upstream_unavailable',
        message: 'Role opportunity service is temporarily unavailable.',
      },
    });
  });

  it('preserves the PR68 validation error when includeRoleOpportunity is missing season or week', async () => {
    const res = await call('/player/00-0036322?includeRoleOpportunity=true&season=2025');

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      success: false,
      message: 'season and week are required when includeRoleOpportunity=true',
    });
    expect(mockedPlayerIdentityService.getByAnyId).not.toHaveBeenCalled();
    expect(mockedOrchestratePlayerDetailEnrichment).not.toHaveBeenCalled();
  });
});
