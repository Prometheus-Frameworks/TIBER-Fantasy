import { buildExternalForgeInsightStatus } from '../playerDetailEnrichment';
import { ForgeService } from '../forgeService';
import { ForgeIntegrationError } from '../types';

const validEvaluation = {
  playerId: '00-0036322',
  playerName: 'Justin Jefferson',
  position: 'WR',
  team: 'MIN',
  season: 2025,
  week: 17,
  mode: 'redraft',
  score: {
    alpha: 81.5,
    tier: 'T2',
    tierRank: 2,
    confidence: 0.82,
  },
  components: {
    volume: 84,
    efficiency: 78,
    teamContext: 72,
    stability: 80,
  },
  metadata: {
    gamesSampled: 15,
    positionRank: 2,
    status: 'ok',
    issues: [],
  },
  source: {
    provider: 'external-forge',
    contractVersion: '1.0.0',
    modelVersion: '2026.03.0',
    calibrationVersion: 'alpha-redraft-2025-v1',
    generatedAt: '2026-03-21T00:00:00.000Z',
    dataWindow: {
      season: 2025,
      throughWeek: 17,
    },
    coverage: {
      advancedMetrics: true,
      snapData: true,
      teamContext: true,
      matchupContext: true,
    },
    inputsUsed: {
      profile: 'wr_redraft_v1',
      sourceCount: 6,
    },
  },
} as const;

describe('buildExternalForgeInsightStatus', () => {
  it('maps external FORGE success into a stable player-detail insight envelope', async () => {
    const service = {
      evaluatePlayer: jest.fn().mockResolvedValue(validEvaluation),
    } as unknown as ForgeService;

    const result = await buildExternalForgeInsightStatus(
      {
        playerId: '00-0036322',
        position: 'WR',
        season: 2025,
        week: 17,
        mode: 'redraft',
        includeSourceMeta: true,
        includeRawCanonical: false,
      },
      service,
    );

    expect(result).toMatchObject({
      available: true,
      data: {
        playerId: '00-0036322',
        position: 'WR',
        score: {
          alpha: 81.5,
          tier: 'T2',
          tierRank: 2,
        },
        confidence: 0.82,
        source: {
          provider: 'external-forge',
          modelVersion: '2026.03.0',
        },
      },
    });
    expect(result.fetchedAt).toEqual(expect.any(String));
  });

  it('contains disabled/unavailable external FORGE failures without throwing top-level route errors', async () => {
    const service = {
      evaluatePlayer: jest.fn().mockRejectedValue(
        new ForgeIntegrationError('config_error', 'External FORGE integration is disabled by configuration.', 503),
      ),
    } as unknown as ForgeService;

    const result = await buildExternalForgeInsightStatus(
      {
        playerId: '00-0036322',
        position: 'WR',
        season: 2025,
        week: 17,
        mode: 'redraft',
        includeSourceMeta: true,
        includeRawCanonical: false,
      },
      service,
    );

    expect(result).toEqual({
      available: false,
      fetchedAt: expect.any(String),
      error: {
        category: 'config_error',
        message: 'External FORGE integration is disabled by configuration.',
      },
    });
  });

  it('contains malformed upstream payload failures as a stable unavailable envelope', async () => {
    const service = {
      evaluatePlayer: jest.fn().mockRejectedValue(
        new ForgeIntegrationError(
          'invalid_payload',
          'External FORGE returned a payload that does not match the canonical contract.',
          502,
        ),
      ),
    } as unknown as ForgeService;

    const result = await buildExternalForgeInsightStatus(
      {
        playerId: '00-0036322',
        position: 'WR',
        season: 2025,
        week: 17,
        mode: 'redraft',
        includeSourceMeta: true,
        includeRawCanonical: false,
      },
      service,
    );

    expect(result.available).toBe(false);
    expect(result.error).toEqual({
      category: 'invalid_payload',
      message: 'External FORGE returned a payload that does not match the canonical contract.',
    });
  });
});
