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
        tiber_ras_v2: 9.11,
        profile_summary: 'Explosive separator',
      }),
    );
  });

  it('fails when artifact contract is missing season or rows', () => {
    expect(() => mapRookieArtifactToFantasySurface({ meta: {}, players: [] }, '/tmp/bad.json')).toThrow(RookieIntegrationError);
  });
});
