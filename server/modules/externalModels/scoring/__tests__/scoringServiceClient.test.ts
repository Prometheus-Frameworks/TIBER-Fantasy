import { ScoringServiceClient } from '../scoringServiceClient';
import { ScoringServiceIntegrationError } from '../types';

describe('ScoringServiceClient', () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    jest.resetAllMocks();
    (global as any).fetch = fetchMock;
  });

  it('posts weekly player-card requests and normalizes payload aliases', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        data: {
          card: {
            player_id: '00-0036322',
            player_name: 'Justin Jefferson',
            team_abbr: 'MIN',
            pos: 'WR',
            expected_points: 19.6,
            vorp: 3.1,
            floor: 12.4,
            median: 18.2,
            ceiling: 27.9,
            confidence: 'high',
            volatility: 'medium',
            fragility: 'low',
            weekly_outlook: 'Strong WR1 projection.',
            role_summary: 'Primary perimeter target earner.',
            value_summary: 'Clear start in all formats.',
            role_notes: ['Full-route role'],
          },
        },
      }),
    });

    const client = new ScoringServiceClient({ baseUrl: 'http://scoring.test' });
    const result = await client.getWeeklyPlayerCard({
      leagueContext: { season: 2025, week: 12 },
      player: { player_id: '00-0036322' },
    });

    expect(result.playerName).toBe('Justin Jefferson');
    expect(result.expectedPoints).toBe(19.6);
    expect(fetchMock).toHaveBeenCalledWith(
      'http://scoring.test/api/tiber/weekly/player-card',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('preserves null numeric fields instead of coercing to zero', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        data: { card: { player_id: '00-0036322', player_name: 'Justin Jefferson', expected_points: null, vorp: null } },
      }),
    });

    const client = new ScoringServiceClient({ baseUrl: 'http://scoring.test' });
    const result = await client.getWeeklyPlayerCard({
      leagueContext: { season: 2025, week: 12 },
      player: { player_id: '00-0036322' },
    });

    expect(result.expectedPoints).toBeNull();
    expect(result.vorp).toBeNull();
  });

  it('fails with config_error when base url is missing', async () => {
    const client = new ScoringServiceClient({ baseUrl: '' });
    await expect(
      client.getWeeklyRankings({ leagueContext: { season: 2025, week: 3 } }),
    ).rejects.toMatchObject<ScoringServiceIntegrationError>({ code: 'config_error' });
  });

  it('maps non-200 responses to upstream_error', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 502 });
    const client = new ScoringServiceClient({ baseUrl: 'http://scoring.test' });

    await expect(
      client.getWeeklyRankings({ leagueContext: { season: 2025, week: 9 }, players: [] }),
    ).rejects.toMatchObject<ScoringServiceIntegrationError>({ code: 'upstream_error' });
  });

  it('falls back to default timeout when env timeout is non-numeric', () => {
    const client = new ScoringServiceClient({ baseUrl: 'http://scoring.test', timeoutMs: Number('5s') as any });
    expect(client.getConfig().timeoutMs).toBe(5000);
  });
});
