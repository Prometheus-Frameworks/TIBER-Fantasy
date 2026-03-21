import { adaptForgeEvaluation } from '../forgeAdapter';
import { ForgeIntegrationError } from '../types';

const canonicalResponse = {
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
        alpha: 82.37,
        tier: 'T1',
        tier_rank: 2,
        confidence: 0.913,
      },
      components: {
        volume: 88.21,
        efficiency: 79.54,
        team_context: 71.22,
        stability: 84.12,
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

describe('forgeAdapter', () => {
  it('maps a valid external FORGE response into the stable TIBER-facing type', () => {
    const result = adaptForgeEvaluation(canonicalResponse);

    expect(result).toMatchObject({
      playerId: '00-0036322',
      playerName: 'Justin Jefferson',
      position: 'WR',
      team: 'MIN',
      score: {
        alpha: 82.4,
        tier: 'T1',
        tierRank: 2,
        confidence: 0.913,
      },
      components: {
        volume: 88.2,
        efficiency: 79.5,
        teamContext: 71.2,
        stability: 84.1,
      },
      source: {
        provider: 'external-forge',
        contractVersion: '1.0.0',
        modelVersion: '2026.03.0',
      },
    });
  });

  it('rejects malformed external payloads with a stable invalid_payload error', () => {
    expect(() => adaptForgeEvaluation({ ...canonicalResponse, results: [{ bad: true }] })).toThrow(ForgeIntegrationError);

    try {
      adaptForgeEvaluation({ ...canonicalResponse, results: [{ bad: true }] });
    } catch (error) {
      expect(error).toBeInstanceOf(ForgeIntegrationError);
      expect((error as ForgeIntegrationError).code).toBe('invalid_payload');
    }
  });
});
