import { ForgeService } from '../forgeService';
import { ForgeIntegrationError } from '../types';

const validPayload = {
  request: {
    season: 2025,
    week: 17,
    mode: 'redraft',
    player_count: 1,
  },
  service_meta: {
    service: 'forge',
    contract_version: '1.0.0',
    model_version: '2026.03.0',
    calibration_version: 'alpha-redraft-2025-v1',
    generated_at: '2026-03-21T00:00:00.000Z',
  },
  results: [
    {
      player_id: '00-0036322',
      player_name: 'Justin Jefferson',
      position: 'WR',
      team: 'MIN',
      season: 2025,
      week: 17,
      mode: 'redraft',
      score: {
        alpha: 82,
        tier: 'T1',
        tier_rank: 2,
        confidence: 0.91,
      },
      components: {
        volume: 88,
        efficiency: 79,
        team_context: 71,
        stability: 84,
      },
      metadata: {
        games_sampled: 15,
        position_rank: 2,
        status: 'ok',
        issues: [],
      },
      source_meta: {
        data_window: {
          season: 2025,
          through_week: 17,
        },
        coverage: {
          advanced_metrics: true,
          snap_data: true,
          team_context: true,
          matchup_context: true,
        },
        inputs_used: {
          profile: 'wr_redraft_v1',
          source_count: 6,
        },
      },
    },
  ],
  errors: [],
};

describe('ForgeService', () => {
  it('maps a successful client payload through the adapter', async () => {
    const service = new ForgeService({
      fetchEvaluation: jest.fn().mockResolvedValue(validPayload),
      getConfig: jest.fn().mockReturnValue({
        enabled: true,
        configured: true,
        endpointPath: '/v1/forge/evaluations',
        timeoutMs: 5000,
      }),
    } as any);

    const result = await service.evaluatePlayer({
      playerId: '00-0036322',
      position: 'WR',
      season: 2025,
      week: 17,
      mode: 'redraft',
      includeSourceMeta: true,
      includeRawCanonical: false,
    });

    expect(result.playerId).toBe('00-0036322');
    expect(result.source.provider).toBe('external-forge');
  });

  it('contains upstream timeout as a stable typed error', async () => {
    const service = new ForgeService({
      fetchEvaluation: jest.fn().mockRejectedValue(
        new ForgeIntegrationError('upstream_timeout', 'External FORGE timed out after 25ms.', 504),
      ),
      getConfig: jest.fn().mockReturnValue({
        enabled: true,
        configured: true,
        endpointPath: '/v1/forge/evaluations',
        timeoutMs: 25,
      }),
    } as any);

    await expect(
      service.evaluatePlayer({
        playerId: '00-0036322',
        position: 'WR',
        season: 2025,
        week: 17,
        mode: 'redraft',
        includeSourceMeta: true,
        includeRawCanonical: false,
      }),
    ).rejects.toMatchObject({
      code: 'upstream_timeout',
      status: 504,
    });
  });
});
