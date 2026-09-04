import { calculateTrailingVor, type TrailingProductionArtifact } from '../draftContextTrailingVor';

const artifact: TrailingProductionArtifact = {
  schema_version: 'draft_trailing_production_v0',
  authority: 'promoted_governed_historical_evidence',
  season: 2025,
  scoring: 'ppr',
  source: {
    repository: 'Prometheus-Frameworks/TIBER-Data',
    commit_sha: 'test-commit',
    path: 'exports/promoted/nfl/player_season_coverage_v0.json',
    blob_sha: 'test-blob',
    artifact_id: 'player_season_coverage_v0',
    source_status: 'promoted_governed_artifact',
    promotion_review: 'TIBER-Data#202',
    promoted_at: '2026-07-06T00:00:00Z',
  },
  player_count: 8,
  players: [
    { player_id: 'qb-a', player_name: 'QB Alpha', position: 'QB', primary_team: 'A', games_played: 17, season_ppr: 300, season_ppg: 17.65 },
    { player_id: 'qb-b', player_name: 'QB Beta', position: 'QB', primary_team: 'B', games_played: 17, season_ppr: 250, season_ppg: 14.71 },
    { player_id: 'rb-a', player_name: 'RB Alpha', position: 'RB', primary_team: 'A', games_played: 12, season_ppr: 220, season_ppg: 18.33 },
    { player_id: 'rb-b', player_name: 'RB Beta', position: 'RB', primary_team: 'B', games_played: 17, season_ppr: 170, season_ppg: 10 },
    { player_id: 'wr-a', player_name: 'WR Alpha', position: 'WR', primary_team: 'A', games_played: 17, season_ppr: 240, season_ppg: 14.12 },
    { player_id: 'wr-b', player_name: 'WR Beta', position: 'WR', primary_team: 'B', games_played: 17, season_ppr: 160, season_ppg: 9.41 },
    { player_id: 'te-a', player_name: 'TE Alpha', position: 'TE', primary_team: 'A', games_played: 10, season_ppr: 150, season_ppg: 15 },
    { player_id: 'te-b', player_name: 'TE Beta', position: 'TE', primary_team: 'B', games_played: 17, season_ppr: 100, season_ppg: 5.88 },
  ],
};

describe('draft-context trailing VOR', () => {
  test('uses season-total PPR as the registered VOR metric and exposes PPG only as context', () => {
    const result = calculateTrailingVor(
      artifact,
      { QB: 2, RB: 2, WR: 2, TE: 2 },
      ['RB Alpha', 'TE Alpha'],
    );

    expect(result.status).toBe('available');
    if (result.status !== 'available') throw new Error('expected available result');

    expect(result.replacement.RB).toMatchObject({ rank: 2, player_name: 'RB Beta', season_ppr: 170, season_ppg: 10 });
    expect(result.candidates[0]).toMatchObject({
      player_name: 'RB Alpha',
      position_rank_by_2025_season_ppr: 1,
      trailing_vor_season_ppr: 50,
      ppg_delta_vs_replacement_context: 8.33,
      games_played_2025: 12,
    });
    expect(result.candidates[1]).toMatchObject({
      player_name: 'TE Alpha',
      trailing_vor_season_ppr: 50,
      ppg_delta_vs_replacement_context: 9.12,
      games_played_2025: 10,
    });
  });

  test('reports unmatched candidates instead of silently dropping them', () => {
    const result = calculateTrailingVor(
      artifact,
      { QB: 2, RB: 2, WR: 2, TE: 2 },
      ['RB Alpha', '2026 Rookie'],
    );

    expect(result.status).toBe('available');
    if (result.status !== 'available') throw new Error('expected available result');
    expect(result.candidates).toHaveLength(1);
    expect(result.unmatched_candidates).toEqual(['2026 Rookie']);
  });

  test('reports zero-game candidates as unmatched instead of returning numeric VOR', () => {
    const result = calculateTrailingVor(
      {
        ...artifact,
        player_count: artifact.player_count + 1,
        players: [
          ...artifact.players,
          {
            player_id: 'rb-zero',
            player_name: 'RB Zero',
            position: 'RB',
            primary_team: 'Z',
            games_played: 0,
            season_ppr: 0,
            season_ppg: 0,
          },
        ],
      },
      { QB: 2, RB: 2, WR: 2, TE: 2 },
      ['RB Zero'],
    );

    expect(result.status).toBe('available');
    if (result.status !== 'available') throw new Error('expected available result');
    expect(result.candidates).toEqual([]);
    expect(result.unmatched_candidates).toEqual(['RB Zero']);
  });

  test('fails closed when a requested replacement rank exceeds the historical population', () => {
    const result = calculateTrailingVor(artifact, { QB: 3, RB: 2, WR: 2, TE: 2 });
    expect(result).toEqual({
      status: 'insufficient_population',
      position: 'QB',
      requested_replacement_rank: 3,
      eligible_player_count: 2,
    });
  });
});
