import { RookieArtifactService } from '../rookieArtifactService';

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
});
