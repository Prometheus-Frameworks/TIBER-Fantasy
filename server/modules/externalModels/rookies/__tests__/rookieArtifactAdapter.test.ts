import { mapRookieArtifactToFantasySurface } from '../rookieArtifactAdapter';
import { RookieIntegrationError } from '../types';

describe('rookie artifact adapter', () => {
  it('maps promoted rookie artifact rows into fantasy surface rows', () => {
    const mapped = mapRookieArtifactToFantasySurface(
      {
        meta: {
          season: 2026,
          model_name: 'Rookie Alpha',
          model_version: 'v2.1',
          promoted_at: '2026-03-25T00:00:00.000Z',
        },
        players: [
          {
            name: 'Test Rookie',
            pos: 'WR',
            school: 'State U',
            tiber_rookie_alpha: 84.6,
            tiber_ras_v2: 9.11,
            production_score: 72.4,
            profile_summary: 'Explosive separator',
            rookie_tier: 'T1',
            rookie_rank: 3,
          },
        ],
      },
      '/tmp/promoted_rookie.json',
    );

    expect(mapped.season).toBe(2026);
    expect(mapped.model.name).toBe('Rookie Alpha');
    expect(mapped.players[0]).toEqual(
      expect.objectContaining({
        player_name: 'Test Rookie',
        position: 'WR',
        rookie_alpha: 85,
        rookie_tier: 'T1',
        rookie_rank: 3,
        tiber_ras_v2: 9.11,
        profile_summary: 'Explosive separator',
      }),
    );
  });

  it('maps tier from alternative field name', () => {
    const mapped = mapRookieArtifactToFantasySurface(
      {
        meta: { season: 2026 },
        players: [
          { name: 'Alt Tier Rookie', pos: 'RB', tier: 'T2', rank: 5 },
        ],
      },
      '/tmp/alt.json',
    );

    expect(mapped.players[0]).toEqual(
      expect.objectContaining({
        player_name: 'Alt Tier Rookie',
        rookie_tier: 'T2',
        rookie_rank: 5,
      }),
    );
  });

  it('fails when artifact contract is missing season or rows', () => {
    expect(() => mapRookieArtifactToFantasySurface({ meta: {}, players: [] }, '/tmp/bad.json')).toThrow(RookieIntegrationError);
  });

  it('maps nested promoted score/tier fields from producer score objects', () => {
    const mapped = mapRookieArtifactToFantasySurface(
      {
        meta: { season: 2026, model_name: 'Rookie Alpha Nested' },
        board: {
          players: [
            {
              playerName: 'Nested Rookie',
              position: 'RB',
              scores: {
                rookieAlpha: 77.8,
                rookieTier: 'T2',
                rank: 12,
                components: {
                  athleticismScore: 89,
                  productionScore: 68.4,
                  draftCapitalScore: 78,
                },
              },
            },
          ],
        },
      },
      '/tmp/promoted_nested_rookie.json',
    );

    expect(mapped.players[0]).toEqual(
      expect.objectContaining({
        player_name: 'Nested Rookie',
        position: 'RB',
        rookie_alpha: 78,
        rookie_tier: 'T2',
        rookie_rank: 12,
        athleticism_score: 89,
        production_score: 68.4,
        draft_capital_score: 78,
      }),
    );
  });
});
