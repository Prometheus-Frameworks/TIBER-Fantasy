import {
  adaptSignalValidationExports,
  normalizeWrBestRecipeSummary,
} from '../signalValidationAdapter';
import { SignalValidationIntegrationError } from '../types';

const playerSignalCardsCsv = `candidate_rank,final_signal_score,player_name,player_id,team,season,best_recipe_name,usage_signal,efficiency_signal,development_signal,stability_signal,cohort_signal,role_signal,penalty_signal,breakout_label_default,breakout_context\n1,92.4,Malik Nabers,00-0042051,NYG,2025,Second-Year Surge,96,91,89,82,85,88,-3,Priority breakout,Elite rookie route command with more downfield volume expected\n2,88.1,Rome Odunze,00-0042048,CHI,2025,Second-Year Surge,90,84,87,80,82,81,-4,Strong candidate,Target share runway if route tree expands`;

const bestRecipeSummary = {
  best_recipe_name: 'Second-Year Surge',
  season: 2025,
  validation_score: 0.78,
  win_rate: 0.64,
  hit_rate: 0.58,
  candidate_count: 12,
  summary: 'Targets ascending second-year WRs with strong usage and efficiency baselines.',
  generated_at: '2026-03-23T00:00:00.000Z',
  model_version: 'svm-2026.03.1',
};

describe('signalValidationAdapter', () => {
  it('maps Signal Validation exports into the stable TIBER-facing breakout lab shape', () => {
    const result = adaptSignalValidationExports(
      {
        season: 2025,
        availableSeasons: [2025, 2024],
        playerSignalCardsCsv,
        bestRecipeSummary,
      },
      { exportDirectory: '/tmp/signal-validation' },
    );

    expect(result.availableSeasons).toEqual([2025, 2024]);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]).toMatchObject({
      candidateRank: 1,
      finalSignalScore: 92.4,
      playerName: 'Malik Nabers',
      playerId: '00-0042051',
      team: 'NYG',
      bestRecipeName: 'Second-Year Surge',
      breakoutLabelDefault: 'Priority breakout',
      breakoutContext: 'Elite rookie route command with more downfield volume expected',
      components: {
        usage: 96,
        efficiency: 91,
        development: 89,
        stability: 82,
        cohort: 85,
        role: 88,
        penalty: -3,
      },
    });
    expect(result.bestRecipeSummary).toMatchObject({
      bestRecipeName: 'Second-Year Surge',
      validationScore: 0.78,
      winRate: 0.64,
      hitRate: 0.58,
      candidateCount: 12,
    });
    expect(result.source.provider).toBe('signal-validation-model');
  });

  it('rejects malformed best-recipe payloads with a stable invalid_payload error', () => {
    expect(() => normalizeWrBestRecipeSummary({ season: 2025 }, 2025)).toThrow(SignalValidationIntegrationError);

    try {
      normalizeWrBestRecipeSummary({ season: 2025 }, 2025);
    } catch (error) {
      expect(error).toBeInstanceOf(SignalValidationIntegrationError);
      expect((error as SignalValidationIntegrationError).code).toBe('invalid_payload');
    }
  });
});
