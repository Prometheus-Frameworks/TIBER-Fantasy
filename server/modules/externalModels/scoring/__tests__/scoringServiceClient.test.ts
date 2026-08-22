import { readFileSync } from 'node:fs';
import path from 'node:path';
import { ScoringService } from '../scoringService';
import { ScoringServiceClient } from '../scoringServiceClient';
import { ScoringServiceIntegrationError } from '../types';

describe('ScoringServiceClient', () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    jest.resetAllMocks();
    (global as any).fetch = fetchMock;
  });

  const frozenValidCardResponse = () =>
    JSON.parse(
      readFileSync(
        path.join(__dirname, '..', 'contracts', 'fantasyForecastWeeklyPlayerV1', 'fixtures', 'valid_weekly_player_card_response.json'),
        'utf8',
      ),
    );

  // Matches the frozen golden fixture's player identity so the exchange rule
  // (card must echo the requested player and horizon) is satisfied.
  const fixturePlayerRequest = {
    leagueContext: {
      season: 2026,
      week: 1,
      scoringFormat: 'ppr',
      teams: 12,
      starters: { QB: 1, RB: 2, WR: 2, TE: 1, FLEX: 1 },
    },
    player: {
      player_id: 'TIBER-FIXTURE-WR-0001',
      player_name: 'Fixture Wideout',
      team: 'TST',
      position: 'WR',
      games_sampled: 16,
      routes_pg: 34,
      targets_pg: 8.2,
      snap_share: 0.9,
    },
  };

  it('posts a v1 weekly player-card request and preserves the full card semantics', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => frozenValidCardResponse() });

    const client = new ScoringServiceClient({ baseUrl: 'http://scoring.test' });
    const result = await client.getWeeklyPlayerCard(fixturePlayerRequest);

    expect(result.playerName).toBe('Fixture Wideout');
    expect(result.expectedPoints).toBe(15.43);
    expect(result.replacementPoints).toBe(8.68);
    expect(result.scoringMode).toBe('weekly');
    expect(result.generatedAt).toBe('2026-08-22T00:00:00.000Z');
    expect(result.confidenceBand).toBe('MEDIUM');

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://scoring.test/api/tiber/weekly/player-card');
    const sentBody = JSON.parse((init as { body: string }).body);
    expect(sentBody.contract).toBe('fantasy_forecast.weekly_player_request');
    expect(sentBody.horizon).toBe('weekly');
    expect(sentBody.league_context.starters).toEqual({ QB: 1, RB: 2, WR: 2, TE: 1, FLEX: 1 });
    expect(JSON.stringify(sentBody)).not.toContain('snap_share');
  });

  it('fails closed with invalid_request before any network call when identity is incomplete', async () => {
    const client = new ScoringServiceClient({ baseUrl: 'http://scoring.test' });

    await expect(
      client.getWeeklyPlayerCard({ leagueContext: { season: 2025, week: 12 }, player: { player_id: '00-0036322' } }),
    ).rejects.toMatchObject<Partial<ScoringServiceIntegrationError>>({ code: 'invalid_request' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('maps a v1 unavailable envelope to weekly_card_unavailable, distinct from invalid payloads', async () => {
    const unavailable = JSON.parse(
      readFileSync(
        path.join(
          __dirname,
          '..',
          'contracts',
          'fantasyForecastWeeklyPlayerV1',
          'fixtures',
          'weekly_player_card_unavailable_or_stale_state.json',
        ),
        'utf8',
      ),
    );
    fetchMock.mockResolvedValue({ ok: false, status: 400, json: async () => unavailable });

    const client = new ScoringServiceClient({ baseUrl: 'http://scoring.test' });
    await expect(client.getWeeklyPlayerCard(fixturePlayerRequest)).rejects.toMatchObject<
      Partial<ScoringServiceIntegrationError>
    >({ code: 'weekly_card_unavailable' });
  });

  it('rejects an HTTP 400 that carries a v1 success envelope (status/envelope mismatch)', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 400, json: async () => frozenValidCardResponse() });

    const client = new ScoringServiceClient({ baseUrl: 'http://scoring.test' });
    await expect(client.getWeeklyPlayerCard(fixturePlayerRequest)).rejects.toMatchObject<
      Partial<ScoringServiceIntegrationError>
    >({ code: 'invalid_payload' });
  });

  it('classifies a non-JSON body on a received response as invalid_payload, not connectivity failure', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError('Unexpected token < in JSON at position 0');
      },
    });

    const client = new ScoringServiceClient({ baseUrl: 'http://scoring.test' });
    await expect(client.getWeeklyPlayerCard(fixturePlayerRequest)).rejects.toMatchObject<
      Partial<ScoringServiceIntegrationError>
    >({ code: 'invalid_payload' });
  });

  it('carries failure warnings through ScoringService into the ScoringResult the routes consume', async () => {
    const unavailable = JSON.parse(
      readFileSync(
        path.join(
          __dirname,
          '..',
          'contracts',
          'fantasyForecastWeeklyPlayerV1',
          'fixtures',
          'weekly_player_card_unavailable_or_stale_state.json',
        ),
        'utf8',
      ),
    );
    // Attach schema-permitted structured details to the error entry too:
    unavailable.errors[0].details = { requested_week: 1, reason: 'no_admissible_sample' };
    fetchMock.mockResolvedValue({ ok: false, status: 400, json: async () => unavailable });

    const service = new ScoringService(new ScoringServiceClient({ baseUrl: 'http://scoring.test' }));
    const result = await service.getWeeklyPlayerCard(fixturePlayerRequest);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('weekly_card_unavailable');
    expect(result.warnings).toEqual([expect.objectContaining({ code: 'STALE_SOURCE_WINDOW' })]);
    // Structured error entries (with details) survive the service wrapper:
    expect(result.errors).toEqual([
      expect.objectContaining({
        code: 'WEEKLY_PLAYER_CARD_UNAVAILABLE',
        details: { requested_week: 1, reason: 'no_admissible_sample' },
      }),
    ]);
  });

  it('classifies the pre-contract alias card shape as invalid_payload now', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        data: { card: { player_id: '00-0036322', player_name: 'Justin Jefferson', expected_points: null, vorp: null } },
      }),
    });

    const client = new ScoringServiceClient({ baseUrl: 'http://scoring.test' });
    await expect(client.getWeeklyPlayerCard(fixturePlayerRequest)).rejects.toMatchObject<
      Partial<ScoringServiceIntegrationError>
    >({ code: 'invalid_payload' });
  });

  it('fails with config_error when base url is missing', async () => {
    const client = new ScoringServiceClient({ baseUrl: '' });
    await expect(
      client.getWeeklyRankings({ leagueContext: { season: 2025, week: 3 }, players: [] }),
    ).rejects.toMatchObject<ScoringServiceIntegrationError>({ code: 'config_error' });
  });

  it('maps non-200 responses to upstream_error', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 502 });
    const client = new ScoringServiceClient({ baseUrl: 'http://scoring.test' });

    await expect(
      client.getWeeklyRankings({ leagueContext: { season: 2025, week: 9 }, players: [] }),
    ).rejects.toMatchObject<ScoringServiceIntegrationError>({ code: 'upstream_error' });
  });

  it('classifies a schema-invalid weekly rankings payload as invalid_payload, not upstream_unavailable', async () => {
    // Malformed upstream data (e.g. a garbage rank) must be distinguishable from the
    // scoring service simply being down — collapsing both into the same error code would
    // make a real data-integrity problem indistinguishable from a connectivity outage.
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        data: {
          view: {
            asOf: '2026-04-12T00:00:00.000Z',
            items: [{ rank: 'not-a-number', playerId: '00-1', playerName: 'Bad Row' }],
          },
        },
      }),
    });

    const client = new ScoringServiceClient({ baseUrl: 'http://scoring.test' });

    await expect(
      client.getWeeklyRankings({ leagueContext: { season: 2025, week: 9 }, players: [] }),
    ).rejects.toMatchObject<Partial<ScoringServiceIntegrationError>>({ code: 'invalid_payload' });
  });

  it.each([
    ['missing entirely', {}],
    ['null', { items: null }],
    ['a non-array value', { items: 'garbage' }],
  ])('rejects with invalid_payload when the weekly rankings collection is %s', async (_label, viewOverrides) => {
    // Missing/null/non-array items must be malformed data (invalid_payload), not a
    // genuine empty ranking — collapsing the two would render a broken upstream response
    // as "0 players" instead of surfacing as an error.
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        data: { view: { asOf: '2026-04-12T00:00:00.000Z', ...viewOverrides } },
      }),
    });

    const client = new ScoringServiceClient({ baseUrl: 'http://scoring.test' });

    await expect(
      client.getWeeklyRankings({ leagueContext: { season: 2025, week: 9 }, players: [] }),
    ).rejects.toMatchObject<Partial<ScoringServiceIntegrationError>>({ code: 'invalid_payload' });
  });

  it('treats an explicit empty items array as a genuine empty result, not an error', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        data: { view: { asOf: '2026-04-12T00:00:00.000Z', items: [] } },
      }),
    });

    const client = new ScoringServiceClient({ baseUrl: 'http://scoring.test' });
    const result = await client.getWeeklyRankings({ leagueContext: { season: 2025, week: 9 }, players: [] });

    expect(result.items).toEqual([]);
  });

  it('falls back to default timeout when env timeout is non-numeric', () => {
    const client = new ScoringServiceClient({ baseUrl: 'http://scoring.test', timeoutMs: Number('5s') as any });
    expect(client.getConfig().timeoutMs).toBe(5000);
  });
});
