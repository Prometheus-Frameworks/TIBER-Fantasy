import { findRookieAsset, RookieArtifactService } from '../rookieArtifactService';

describe('RookieArtifactService', () => {
  it('hydrates rookie alpha/tier/rank and score components from nested promoted fields', async () => {
    const service = new RookieArtifactService({
      loadPromotedRookieArtifact: jest.fn().mockResolvedValue({
        sourcePath: '/tmp/promoted_rookies_nested.json',
        payload: {
          meta: { season: 2026, model_name: 'TIBER-Rookies promoted board' },
          rows: [
            {
              playerName: 'Composite Rookie',
              position: 'WR',
              scores: {
                rookieAlpha: 82.2,
                rookieTier: 'T1',
                rank: 4,
                components: {
                  athleticismScore: 90,
                  productionScore: 74.2,
                  draftCapitalScore: 100,
                },
              },
            },
          ],
        },
      }),
      getConfig: jest.fn().mockReturnValue({
        enabled: true,
        configured: true,
        artifactPath: '/tmp/promoted_rookies_nested.json',
      }),
    } as any);

    const board = await service.getRookieBoard({ season: 2026, sortBy: 'rookie_alpha' });
    expect(board.players[0]).toEqual(
      expect.objectContaining({
        player_name: 'Composite Rookie',
        rookie_alpha: 82,
        rookie_tier: 'T1',
        rookie_rank: 4,
        athleticism_score: 90,
        production_score: 74.2,
        draft_capital_score: 100,
      }),
    );
  });

  it('builds management lookup context without blending Rookie Alpha into FORGE', async () => {
    const service = new RookieArtifactService({
      loadPromotedRookieArtifact: jest.fn().mockResolvedValue({
        sourcePath: '/tmp/promoted/2026_rookie_alpha_predraft_v0.json',
        payload: {
          meta: { season: 2026 },
          players: [
            { name: 'Jeremiyah Love', pos: 'RB', rookie_rank: 1, tiber_rookie_alpha: 83, talent_score: 91, consensus_delta: 4.2 },
          ],
        },
      }),
      getConfig: jest.fn().mockReturnValue({ enabled: true, configured: true, artifactPath: '/tmp/promoted' }),
    } as any);

    const lookup = await service.getRookieAssetLookup(2026);
    expect(findRookieAsset(lookup, { name: 'Jeremiyah Love' })).toEqual({
      source: 'rookie_alpha_promoted_artifact',
      playerName: 'Jeremiyah Love',
      position: 'RB',
      alphaRank: 1,
      positionRank: 'RB1',
      rookieAlphaScore: 83,
      talentScore: 91,
      consensusDelta: 4.2,
      interpretation: 'High-value rookie asset currently outside FORGE coverage.',
    });
  });
});
