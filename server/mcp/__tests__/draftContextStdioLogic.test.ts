import {
  isExpectedTrailingProductionArtifact,
  selectAdpCandidates,
  TRAILING_PRODUCTION_SOURCE_REFERENCE,
  unavailableInsufficientPopulation,
} from '../draftContextStdioLogic';
import type { TrailingProductionArtifact } from '../draftContextTrailingVor';

function validArtifact(): TrailingProductionArtifact {
  return {
    schema_version: 'draft_trailing_production_v0',
    authority: 'promoted_governed_historical_evidence',
    season: 2025,
    scoring: 'ppr',
    source: {
      ...TRAILING_PRODUCTION_SOURCE_REFERENCE,
      promotion_review: 'TIBER-Data#202',
      promoted_at: '2026-07-06T00:00:00Z',
    },
    player_count: 0,
    players: [],
  };
}

describe('draft-context stdio pure logic', () => {
  test('accepts only the exact source identity pinned by the cache builder', () => {
    expect(isExpectedTrailingProductionArtifact(validArtifact())).toBe(true);

    const sourceFields = ['repository', 'commit_sha', 'path', 'blob_sha', 'artifact_id', 'source_status'] as const;
    for (const field of sourceFields) {
      const artifact = validArtifact();
      artifact.source[field] = `wrong-${field}`;
      expect(isExpectedTrailingProductionArtifact(artifact)).toBe(false);
    }
  });

  test('computes unmatched candidates from every match before limiting returned rows', () => {
    const result = selectAdpCandidates(
      [{ name: 'Alpha' }, { name: 'Beta' }, { name: 'Gamma' }],
      ['Alpha', 'Beta', 'Gamma', 'Missing'],
      2,
    );

    expect(result.players).toEqual([{ name: 'Alpha' }, { name: 'Beta' }]);
    expect(result.unmatchedCandidates).toEqual(['Missing']);
  });

  test('preserves the adapter unavailable status for insufficient populations', () => {
    expect(
      unavailableInsufficientPopulation({
        status: 'insufficient_population',
        position: 'QB',
        requested_replacement_rank: 3,
        eligible_player_count: 2,
      }),
    ).toEqual({
      status: 'unavailable_insufficient_population',
      position: 'QB',
      requested_replacement_rank: 3,
      eligible_player_count: 2,
    });
  });
});
