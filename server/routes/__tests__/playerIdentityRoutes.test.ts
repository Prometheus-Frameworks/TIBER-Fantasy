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

describe('playerIdentityRoutes player detail enrichment', () => {
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
    expect(res.body.data.externalForgeInsight).toBeUndefined();
    expect(mockedOrchestratePlayerDetailEnrichment).toHaveBeenCalledWith({
      playerId: '00-0036322',
      playerPosition: 'WR',
      season: undefined,
      week: undefined,
      includeRoleOpportunity: false,
      includeExternalForge: false,
      externalForgeMode: undefined,
    });
  });

  it('returns an enriched player payload when includeExternalForge=true is requested', async () => {
    mockedOrchestratePlayerDetailEnrichment.mockResolvedValue({
      externalForgeInsight: {
        available: true,
        fetchedAt: '2026-03-21T00:00:00.000Z',
        data: {
          playerId: '00-0036322',
          playerName: 'Justin Jefferson',
          position: 'WR',
          team: 'MIN',
          season: 2025,
          week: 'season',
          mode: 'redraft',
          score: {
            alpha: 81.5,
            tier: 'T2',
            tierRank: 2,
          },
          components: {
            volume: 84,
            efficiency: 78,
            teamContext: 72,
            stability: 80,
          },
          confidence: 0.82,
          metadata: {
            gamesSampled: 15,
            positionRank: 2,
            status: 'ok',
            issues: [],
          },
          source: {
            provider: 'external-forge',
            modelVersion: '2026.03.0',
            generatedAt: '2026-03-21T00:00:00.000Z',
          },
        },
      },
    });

    const res = await call('/player/00-0036322?includeExternalForge=true&season=2025');

    expect(res.status).toBe(200);
    expect(res.body.data.externalForgeInsight).toMatchObject({
      available: true,
      data: {
        score: {
          alpha: 81.5,
        },
        confidence: 0.82,
      },
    });
    expect(mockedOrchestratePlayerDetailEnrichment).toHaveBeenCalledWith({
      playerId: '00-0036322',
      playerPosition: 'WR',
      season: 2025,
      week: undefined,
      includeRoleOpportunity: false,
      includeExternalForge: true,
      externalForgeMode: undefined,
    });
  });

  it('returns the same stable unavailable insight payload semantics when external FORGE preview is unavailable', async () => {
    mockedOrchestratePlayerDetailEnrichment.mockResolvedValue({
      externalForgeInsight: {
        available: false,
        fetchedAt: '2026-03-21T00:00:00.000Z',
        error: {
          category: 'config_error',
          message: 'External FORGE integration is disabled by configuration.',
        },
      },
    });

    const res = await call('/player/00-0036322?includeExternalForge=true&season=2025');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.externalForgeInsight).toEqual({
      available: false,
      fetchedAt: '2026-03-21T00:00:00.000Z',
      error: {
        category: 'config_error',
        message: 'External FORGE integration is disabled by configuration.',
      },
    });
  });

  it('keeps the route non-fatal when the preview insight reports a malformed payload', async () => {
    mockedOrchestratePlayerDetailEnrichment.mockResolvedValue({
      externalForgeInsight: {
        available: false,
        fetchedAt: '2026-03-21T00:00:00.000Z',
        error: {
          category: 'invalid_payload',
          message: 'External FORGE returned a payload that does not match the canonical contract.',
        },
      },
    });

    const res = await call('/player/00-0036322?includeExternalForge=true&season=2025');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.canonicalId).toBe('00-0036322');
    expect(res.body.data.externalForgeInsight).toEqual({
      available: false,
      fetchedAt: '2026-03-21T00:00:00.000Z',
      error: {
        category: 'invalid_payload',
        message: 'External FORGE returned a payload that does not match the canonical contract.',
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
