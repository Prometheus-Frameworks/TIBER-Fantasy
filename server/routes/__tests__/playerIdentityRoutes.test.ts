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
jest.mock('../../modules/externalModels/scoring/scoringService', () => ({
  scoringService: {
    getWeeklyPlayerCard: jest.fn(),
    getRosPlayerCard: jest.fn(),
  },
}));
jest.mock('../../modules/externalModels/scoring/scoringRequestMappers', () => ({
  toLeagueContextInput: jest.fn((input) => ({ season: input.season, week: input.week, scoringFormat: 'ppr', teams: 12 })),
  toScoringPlayerInput: jest.fn((player) => ({ player_id: player.canonicalId, player_name: player.fullName })),
  buildScoringPlayerInputFromData: jest.fn().mockResolvedValue({
    player_id: '00-0036322',
    player_name: 'Justin Jefferson',
    team: 'MIN',
    position: 'WR',
    games_sampled: 4,
    routes_pg: 36.5,
    targets_pg: 9.5,
    carries_pg: 0.4,
    fantasy_points_ppr_pg: 19.1,
    snap_share: 0.89,
  }),
}));

import router from '../playerIdentityRoutes';
import { playerIdentityService } from '../../services/PlayerIdentityService';
import { orchestratePlayerDetailEnrichment } from '../../modules/externalModels/playerDetailEnrichment/playerDetailEnrichmentOrchestrator';
import { scoringService } from '../../modules/externalModels/scoring/scoringService';
import { buildScoringPlayerInputFromData } from '../../modules/externalModels/scoring/scoringRequestMappers';

const mockedPlayerIdentityService = playerIdentityService as jest.Mocked<typeof playerIdentityService>;
const mockedOrchestratePlayerDetailEnrichment = orchestratePlayerDetailEnrichment as jest.MockedFunction<typeof orchestratePlayerDetailEnrichment>;
const mockedScoringService = scoringService as jest.Mocked<typeof scoringService>;
const mockedBuildScoringPlayerInputFromData = buildScoringPlayerInputFromData as jest.MockedFunction<typeof buildScoringPlayerInputFromData>;

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
    mockedScoringService.getWeeklyPlayerCard.mockResolvedValue({
      ok: true,
      data: {
        playerId: '00-0036322',
        playerName: 'Justin Jefferson',
        team: 'MIN',
        position: 'WR',
        expectedPoints: 19.4,
        vorp: 2.9,
        floor: 12.1,
        median: 17.8,
        ceiling: 28.3,
        confidence: 'high',
        volatility: 'medium',
        fragility: 'low',
        weeklyOutlook: 'Strong WR1 profile.',
        roleSummary: 'Primary perimeter alpha.',
        valueSummary: 'Start with confidence.',
        roleNotes: ['Dominant route share'],
      },
    } as any);
    mockedScoringService.getRosPlayerCard.mockResolvedValue({ ok: false, code: 'config_error', message: 'not configured' } as any);
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

  it('returns scoring payloads when includeScoringWeekly/includeScoringRos are requested', async () => {
    const res = await call('/player/00-0036322?includeScoringWeekly=true&includeScoringRos=true&season=2025&week=4');

    expect(res.status).toBe(200);
    expect(res.body.data.scoring.weekly.ok).toBe(true);
    expect(res.body.data.scoring.weekly.data.expectedPoints).toBe(19.4);
    expect(res.body.data.scoring.ros.ok).toBe(false);
    expect(mockedScoringService.getWeeklyPlayerCard).toHaveBeenCalled();
    expect(mockedScoringService.getRosPlayerCard).toHaveBeenCalled();
    expect(mockedBuildScoringPlayerInputFromData).toHaveBeenCalled();
    expect(mockedScoringService.getWeeklyPlayerCard).toHaveBeenCalledWith(
      expect.objectContaining({
        player: expect.objectContaining({
          games_sampled: 4,
          routes_pg: 36.5,
          targets_pg: 9.5,
        }),
      }),
    );
  });

  it('validates scoring weekly query requirements', async () => {
    const res = await call('/player/00-0036322?includeScoringWeekly=true');
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('includeScoringWeekly');
  });

  it('returns the normal player payload when enrichment is not requested', async () => {
    const res = await call('/player/00-0036322');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.canonicalId).toBe('00-0036322');
    expect(res.body.data.roleOpportunityInsight).toBeUndefined();
    expect(res.body.data.externalForgeInsight).toBeUndefined();
    expect(res.body.data.forgeComparison).toBeUndefined();
    expect(mockedOrchestratePlayerDetailEnrichment).toHaveBeenCalledWith({
      playerId: '00-0036322',
      playerPosition: 'WR',
      season: undefined,
      week: undefined,
      includeRoleOpportunity: false,
      includeExternalForge: false,
      includeForgeComparison: false,
      includeSelectedForge: false,
      externalForgeMode: undefined,
      forgeSourceMode: undefined,
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
      includeForgeComparison: false,
      includeSelectedForge: false,
      externalForgeMode: undefined,
      forgeSourceMode: undefined,
    });
  });

  it('returns selected FORGE insight metadata when includeSelectedForge=true is requested', async () => {
    mockedOrchestratePlayerDetailEnrichment.mockResolvedValue({
      selectedForgeInsight: {
        available: true,
        fetchedAt: '2026-03-21T00:00:00.000Z',
        selection: {
          requestedMode: 'auto_with_legacy_fallback',
          selectedSource: 'legacy',
          fallbackOccurred: true,
          fallbackReason: 'upstream_timeout',
        },
        data: {
          playerId: '00-0036322',
          playerName: 'Justin Jefferson',
          position: 'WR',
          team: 'MIN',
          season: 2025,
          week: 'season',
          mode: 'redraft',
          score: {
            alpha: 80,
            tier: 'T2',
            tierRank: 2,
          },
          components: {
            volume: 82,
            efficiency: 77,
            teamContext: 70,
            stability: 79,
          },
          confidence: 0.8,
          metadata: {
            gamesSampled: 15,
            positionRank: 2,
            status: 'ok',
            issues: [],
          },
          source: {
            provider: 'legacy-forge',
            modelVersion: 'legacy-eg-v2',
            generatedAt: '2026-03-21T00:00:00.000Z',
          },
        },
      },
    });

    const res = await call(
      '/player/00-0036322?includeSelectedForge=true&season=2025&forgeSourceMode=auto_with_legacy_fallback',
    );

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.selectedForgeInsight).toMatchObject({
      available: true,
      selection: {
        requestedMode: 'auto_with_legacy_fallback',
        selectedSource: 'legacy',
        fallbackOccurred: true,
        fallbackReason: 'upstream_timeout',
      },
      data: {
        score: {
          alpha: 80,
        },
      },
    });
    expect(mockedOrchestratePlayerDetailEnrichment).toHaveBeenCalledWith({
      playerId: '00-0036322',
      playerPosition: 'WR',
      season: 2025,
      week: undefined,
      includeRoleOpportunity: false,
      includeExternalForge: false,
      includeForgeComparison: false,
      includeSelectedForge: true,
      externalForgeMode: undefined,
      forgeSourceMode: 'auto_with_legacy_fallback',
    });
  });

  it('returns both sides plus parity metadata when includeForgeComparison=true is requested', async () => {
    mockedOrchestratePlayerDetailEnrichment.mockResolvedValue({
      forgeComparison: {
        available: true,
        fetchedAt: '2026-03-21T00:00:00.000Z',
        legacy: {
          available: true,
          data: {
            playerId: '00-0036322',
            playerName: 'Justin Jefferson',
            position: 'WR',
            team: 'MIN',
            season: 2025,
            week: 'season',
            mode: 'redraft',
            score: {
              alpha: 80,
              tier: 'T2',
              tierRank: 2,
            },
            components: {
              volume: 82,
              efficiency: 77,
              teamContext: 70,
              stability: 79,
            },
            confidence: 0.8,
            metadata: {
              gamesSampled: 15,
              positionRank: 2,
              status: 'ok',
              issues: [],
            },
            source: {
              provider: 'legacy-forge',
              modelVersion: 'legacy-eg-v2',
              generatedAt: '2026-03-21T00:00:00.000Z',
            },
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
        comparison: {
          scoreDelta: 1.5,
          componentDeltas: {
            volume: 2,
            efficiency: 1,
            teamContext: 2,
            stability: 1,
          },
          confidenceDelta: 0.02,
          parityStatus: 'close',
          notes: ['Alpha delta stayed within migration tolerance at 1.5 points.'],
        },
      },
    });

    const res = await call('/player/00-0036322?includeForgeComparison=true&season=2025');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.forgeComparison).toMatchObject({
      available: true,
      legacy: {
        available: true,
        data: {
          score: {
            alpha: 80,
          },
        },
      },
      external: {
        available: true,
        data: {
          score: {
            alpha: 81.5,
          },
        },
      },
      comparison: {
        parityStatus: 'close',
        scoreDelta: 1.5,
        confidenceDelta: 0.02,
      },
    });
    expect(mockedOrchestratePlayerDetailEnrichment).toHaveBeenCalledWith({
      playerId: '00-0036322',
      playerPosition: 'WR',
      season: 2025,
      week: undefined,
      includeRoleOpportunity: false,
      includeExternalForge: false,
      includeForgeComparison: true,
      includeSelectedForge: false,
      externalForgeMode: undefined,
      forgeSourceMode: undefined,
    });
  });

  it('keeps player detail successful when comparison mode has a one-side failure', async () => {
    mockedOrchestratePlayerDetailEnrichment.mockResolvedValue({
      forgeComparison: {
        available: true,
        fetchedAt: '2026-03-21T00:00:00.000Z',
        legacy: {
          available: true,
          data: {
            playerId: '00-0036322',
            playerName: 'Justin Jefferson',
            position: 'WR',
            team: 'MIN',
            season: 2025,
            week: 'season',
            mode: 'redraft',
            score: {
              alpha: 80,
              tier: 'T2',
              tierRank: 2,
            },
            components: {
              volume: 82,
              efficiency: 77,
              teamContext: 70,
              stability: 79,
            },
            confidence: 0.8,
            metadata: {
              gamesSampled: 15,
              positionRank: 2,
              status: 'ok',
              issues: [],
            },
            source: {
              provider: 'legacy-forge',
              modelVersion: 'legacy-eg-v2',
              generatedAt: '2026-03-21T00:00:00.000Z',
            },
          },
        },
        external: {
          available: false,
          error: {
            category: 'upstream_timeout',
            message: 'External FORGE timed out.',
          },
        },
        comparison: {
          parityStatus: 'unavailable',
          notes: ['Only one FORGE implementation returned data for this request.'],
        },
      },
    });

    const res = await call('/player/00-0036322?includeForgeComparison=true&season=2025');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.canonicalId).toBe('00-0036322');
    expect(res.body.data.forgeComparison).toEqual({
      available: true,
      fetchedAt: '2026-03-21T00:00:00.000Z',
      legacy: expect.objectContaining({
        available: true,
      }),
      external: {
        available: false,
        error: {
          category: 'upstream_timeout',
          message: 'External FORGE timed out.',
        },
      },
      comparison: {
        parityStatus: 'unavailable',
        notes: ['Only one FORGE implementation returned data for this request.'],
      },
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
