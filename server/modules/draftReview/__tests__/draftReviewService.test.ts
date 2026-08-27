import { afterEach, describe, expect, jest, test } from '@jest/globals';
import { sleeperClient } from '../../../integrations/sleeperClient';
import {
  __resetDraftReviewCacheForTests,
  buildDraftReview,
  parseSleeperRosterUrl,
  resolveDraftReviewInput,
} from '../draftReviewService';

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
  jest.useRealTimers();
  __resetDraftReviewCacheForTests();
});

function response(body: unknown) {
  return {
    ok: true,
    status: 200,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as Response;
}

describe('Draft Review Sleeper context compiler', () => {
  test('accepts only an exact public Sleeper roster URL at the build boundary', () => {
    expect(parseSleeperRosterUrl('https://sleeper.com/roster/1392906445938266112/7')).toEqual({
      leagueId: '1392906445938266112',
      rosterId: 7,
      canonicalUrl: 'https://sleeper.com/roster/1392906445938266112/7',
    });
    expect(() => parseSleeperRosterUrl('https://example.com/roster/123/7')).toThrow('Only exact public HTTPS Sleeper');
    expect(() => parseSleeperRosterUrl('http://sleeper.com/roster/123/7')).toThrow('Only exact public HTTPS Sleeper');
    expect(() => parseSleeperRosterUrl('https://sleeper.com/foo/roster/123/7')).toThrow('Use a numeric Sleeper league ID');
    expect(() => parseSleeperRosterUrl('https://sleeper.com/roster/123/0')).toThrow('positive integer');
    expect(() => parseSleeperRosterUrl('1392906445938266112')).toThrow('ending in');
    expect(() => parseSleeperRosterUrl('https://sleeper.com/roster/123/7?redirect=https://evil.test')).toThrow('Only exact public HTTPS');
    expect(() => parseSleeperRosterUrl('https://sleeper.com.evil.test/roster/123/7')).toThrow('Only exact public HTTPS');
    expect(() => parseSleeperRosterUrl('https://user@sleeper.com/roster/123/7')).toThrow('Only exact public HTTPS');
    expect(() => parseSleeperRosterUrl(`https://sleeper.com/roster/${'1'.repeat(33)}/7`)).toThrow('Use a numeric Sleeper league ID');
  });

  test('resolves roster links directly and requires public team selection for league and draft inputs', async () => {
    global.fetch = jest.fn(async (input) => {
      const url = String(input);
      if (url.endsWith('/draft/900')) return response({ draft_id: '900', league_id: '123' });
      if (url.endsWith('/league/123')) return response({
        league_id: '123', name: 'Select League', season: '2026', total_rosters: 2,
      });
      if (url.endsWith('/league/123/users')) return response([
        { user_id: 'secret-owner-1', display_name: 'Manager One', metadata: { team_name: 'Team One' } },
        { user_id: 'secret-owner-2', display_name: 'Manager Two' },
      ]);
      if (url.endsWith('/league/123/rosters')) return response([
        { roster_id: 2, owner_id: 'secret-owner-2' },
        { roster_id: 1, owner_id: 'secret-owner-1' },
      ]);
      throw new Error(`Unexpected URL: ${url}`);
    }) as typeof fetch;

    await expect(resolveDraftReviewInput('https://sleeper.com/roster/123/2')).resolves.toEqual({
      status: 'roster_resolved',
      input_type: 'roster_url',
      league_id: '123',
      roster_id: 2,
      canonicalUrl: 'https://sleeper.com/roster/123/2',
    });

    const leagueResult = await resolveDraftReviewInput('123');
    expect(leagueResult).toMatchObject({
      status: 'team_selection_required',
      input_type: 'league_id',
      league: { league_id: '123', name: 'Select League' },
      teams: [
        { roster_id: 1, display_name: 'Team One', canonicalUrl: 'https://sleeper.com/roster/123/1' },
        { roster_id: 2, display_name: 'Manager Two', canonicalUrl: 'https://sleeper.com/roster/123/2' },
      ],
    });
    expect(JSON.stringify(leagueResult)).not.toContain('secret-owner');

    const draftResult = await resolveDraftReviewInput('https://sleeper.app/draft/nfl/900');
    expect(draftResult).toMatchObject({
      status: 'team_selection_required',
      input_type: 'draft_url',
      league: { league_id: '123' },
    });
  });

  test('keeps observed roster state, deterministic geometry, and unavailable Forecast separate', async () => {
    global.fetch = jest.fn(async (input) => {
      const url = String(input);
      if (url.endsWith('/league/123')) return response({
        league_id: '123',
        name: 'Redraft Test',
        season: '2026',
        total_rosters: 10,
        scoring_settings: { rec: 1, pass_td: 4, rec_40p: 2, pts_allow_35p: -4, bonus_rec_yd_100: 3, fgmiss: 0 },
        roster_positions: ['QB', 'RB', 'WR', 'TE', 'FLEX', 'K', 'BN', 'BN'],
        settings: {
          type: 0,
          reserve_slots: 1,
          reserve_allow_out: 1,
          reserve_allow_doubtful: 0,
        },
        draft_id: '9001',
      });
      if (url.endsWith('/league/123/users')) return response([{ user_id: 'u1', display_name: 'Manager' }]);
      if (url.endsWith('/league/123/rosters')) return response([{
        roster_id: 7,
        owner_id: 'u1',
        players: ['qb1', 'qb2', 'rb1', 'wr1', 'te1'],
        starters: ['qb1', 'rb1', 'wr1', 'te1'],
        reserve: ['qb2'],
      }]);
      if (url.endsWith('/players/nfl')) return response({
        qb1: { full_name: 'Quarterback One', position: 'QB', team: 'AAA' },
        qb2: { full_name: 'Quarterback Two', position: 'QB', team: 'BBB' },
        rb1: { full_name: 'Running Back', position: 'RB', team: 'CCC' },
        wr1: { full_name: 'Wide Receiver', position: 'WR', team: 'DDD' },
        te1: { full_name: 'Tight End', position: 'TE', team: 'EEE' },
      });
      if (url.endsWith('/draft/9001')) return response({
        draft_id: '9001',
        league_id: '123',
        settings: { pick_timer: 120, teams: 10 },
        slot_to_roster_id: { '10': 7, '1': 1 },
      });
      if (url.endsWith('/draft/9001/picks')) return response([
        { player_id: 'rb1', roster_id: 1, draft_slot: 1, round: 1, pick_no: 1 },
        // The roster acquired this selection from slot 4; its native slot remains 10.
        { player_id: 'qb1', roster_id: 7, draft_slot: 4, round: 1, pick_no: 10 },
        { player_id: 'wr1', roster_id: 7, draft_slot: 10, round: 2, pick_no: 11 },
        { player_id: 'te1', roster_id: 1, draft_slot: 1, round: 2, pick_no: 20 },
      ]);
      throw new Error(`Unexpected URL: ${url}`);
    }) as typeof fetch;

    const result = await buildDraftReview('https://sleeper.com/roster/123/7');

    expect(result.observed.league.league_mode).toBe('redraft');
    expect(result.observed.team.display_name).toBe('Manager');
    expect(result.derived.position_counts).toEqual({ QB: 2, RB: 1, WR: 1, TE: 1 });
    expect(result.schema_version).toBe('tiber_draft_review_v0_1');
    expect(result.derived.roster_flags).toContain('2 quarterbacks rostered for 1 QB-eligible weekly slot.');
    expect(result.derived.roster_flags).toContain('1 required K starting slot is currently unfilled.');
    expect(result.derived.roster_flags).toContain('0 K players currently available for 1 required K slot.');
    expect(result.observed.league.reserve).toMatchObject({
      configured_slots: 1,
      occupied_slots: 1,
      open_slots: 0,
      configured_eligibility: { out: true, doubtful: false },
      current_player_eligibility: { status: 'unavailable' },
    });
    expect(result.observed.league).not.toHaveProperty('scoring_settings');
    expect(result.observed.league.scoring_summary).toMatchObject({
      format: 'ppr',
      reception_points: 1,
      passing: { touchdown_points: 4 },
      additional_nonzero_rule_count: 3,
      additional_rules_truncated: false,
      additional_nonzero_rules: [
        { rule: 'bonus_rec_yd_100', label: '100 receiving yards', points: 3 },
        { rule: 'pts_allow_35p', label: 'Points allowed: 35+', points: -4 },
        { rule: 'rec_40p', label: 'Reception of 40+ yards', points: 2 },
      ],
    });
    expect(result.observed.draft.picks).toHaveLength(2);
    expect(result.observed.draft.full_board).toHaveLength(4);
    expect(result.observed.draft.full_board_status).toBe('available');
    expect(result.observed.draft.pick_timer_seconds).toBe(120);
    expect(result.observed.draft.team_draft_slot).toBe(10);
    expect(result.observed.draft.picks[0].draft_slot).toBe(4);
    expect(result.observed.draft.picks[0]).toMatchObject({ pick_no: 10, next_turn_distance: 0 });
    expect(result.observed.draft.reason).toBeNull();
    expect(result.forecast).toMatchObject({ status: 'unavailable', fabricated_values: false });
    expect(result.provenance.disclosures.join(' ')).toContain('does not use FFC ADP');
    expect(result.provenance.source_urls).toContain('https://api.sleeper.app/v1/draft/9001/picks');
    expect(result.provenance.source_urls).toContain('https://api.sleeper.app/v1/draft/9001');
    expect(result.observed.team).not.toHaveProperty('owner_id');
    expect(JSON.stringify(result.observed.draft)).not.toContain('roster_id');
    expect(JSON.stringify(result.observed.draft)).not.toContain('picked_by');
    expect(result.derived.bye_week_geometry).toMatchObject({ status: 'unavailable', fabricated_values: false });
  });

  test('does not call flex-eligible quarterbacks or tight ends duplicated', async () => {
    global.fetch = jest.fn(async (input) => {
      const url = String(input);
      if (url.endsWith('/league/456')) return response({
        league_id: '456',
        name: 'Flex Test',
        season: '2026',
        settings: { type: 0 },
        scoring_settings: { rec: 1 },
        roster_positions: ['QB', 'SUPER_FLEX', 'TE', 'FLEX', 'BN'],
      });
      if (url.endsWith('/league/456/users')) return response([{ user_id: 'u1', display_name: 'Manager' }]);
      if (url.endsWith('/league/456/rosters')) return response([{
        roster_id: 1,
        owner_id: 'u1',
        players: ['qb1', 'qb2', 'te1', 'te2'],
        starters: ['qb1', 'qb2', 'te1', 'te2'],
      }]);
      if (url.endsWith('/players/nfl')) return response({
        qb1: { full_name: 'QB One', position: 'QB' },
        qb2: { full_name: 'QB Two', position: 'QB' },
        te1: { full_name: 'TE One', position: 'TE' },
        te2: { full_name: 'TE Two', position: 'TE' },
      });
      throw new Error(`Unexpected URL: ${url}`);
    }) as typeof fetch;

    const result = await buildDraftReview('https://sleeper.com/roster/456/1');

    expect(result.derived.roster_flags).toEqual([]);
    expect(result.observed.draft).toMatchObject({
      status: 'unavailable',
      reason: 'Sleeper did not expose a draft ID for this league.',
    });
    expect(result.provenance.source_urls.some((url) => url.includes('/draft/'))).toBe(false);
  });

  test('does not request a draft when Sleeper exposes an invalid upstream draft ID', async () => {
    const fetchMock = jest.fn(async (input) => {
      const url = String(input);
      if (url.endsWith('/league/789')) return response({
        league_id: '789',
        name: 'Invalid Draft ID',
        season: '2026',
        settings: { type: 0 },
        roster_positions: ['QB'],
        draft_id: 'not-a-numeric-id',
      });
      if (url.endsWith('/league/789/users')) return response([{ user_id: 'u1', display_name: 'Manager' }]);
      if (url.endsWith('/league/789/rosters')) return response([{
        roster_id: 1, owner_id: 'u1', players: ['qb1'], starters: ['qb1'],
      }]);
      if (url.endsWith('/players/nfl')) return response({ qb1: { full_name: 'QB One', position: 'QB' } });
      throw new Error(`Unexpected URL: ${url}`);
    });
    global.fetch = fetchMock as typeof fetch;

    const result = await buildDraftReview('https://sleeper.com/roster/789/1');

    expect(result.observed.draft).toMatchObject({
      status: 'unavailable',
      draft_id: null,
      reason: 'Sleeper exposed an invalid draft ID; draft evidence was not requested.',
    });
    expect(fetchMock.mock.calls.some(([input]) => String(input).includes('/draft/'))).toBe(false);
  });

  test('fails closed when Sleeper returns an oversized roster payload', async () => {
    const oversizedPlayers = Array.from({ length: 257 }, (_, index) => `player-${index}`);
    global.fetch = jest.fn(async (input) => {
      const url = String(input);
      if (url.endsWith('/league/321')) return response({
        league_id: '321',
        name: 'Oversized roster',
        season: '2026',
        settings: { type: 0 },
        roster_positions: ['QB'],
      });
      if (url.endsWith('/league/321/users')) return response([{ user_id: 'u1', display_name: 'Manager' }]);
      if (url.endsWith('/league/321/rosters')) return response([{
        roster_id: 1,
        owner_id: 'u1',
        players: oversizedPlayers,
        starters: [],
      }]);
      if (url.endsWith('/players/nfl')) return response({});
      throw new Error(`Unexpected URL: ${url}`);
    }) as typeof fetch;

    await expect(buildDraftReview('https://sleeper.com/roster/321/1'))
      .rejects.toThrow('oversized player collection');
  });

  test('deduplicates concurrent cold player-directory requests', async () => {
    const fetchMock = jest.fn(async (input) => {
      const url = String(input);
      const leagueId = url.includes('/league/111') ? '111' : '222';
      if (url.endsWith(`/league/${leagueId}`)) return response({
        league_id: leagueId,
        name: `League ${leagueId}`,
        season: '2026',
        settings: { type: 0 },
        roster_positions: ['QB'],
      });
      if (url.endsWith(`/league/${leagueId}/users`)) return response([{ user_id: 'u1', display_name: 'Manager' }]);
      if (url.endsWith(`/league/${leagueId}/rosters`)) return response([{
        roster_id: 1,
        owner_id: 'u1',
        players: ['qb1'],
        starters: ['qb1'],
      }]);
      if (url.endsWith('/players/nfl')) return response({ qb1: { full_name: 'QB One', position: 'QB' } });
      throw new Error(`Unexpected URL: ${url}`);
    });
    global.fetch = fetchMock as typeof fetch;

    await Promise.all([
      buildDraftReview('https://sleeper.com/roster/111/1'),
      buildDraftReview('https://sleeper.com/roster/222/1'),
    ]);

    expect(fetchMock.mock.calls.filter(([input]) => String(input).endsWith('/players/nfl'))).toHaveLength(1);
  });

  test('aborts a stalled Sleeper request at the integration boundary', async () => {
    jest.useFakeTimers();
    global.fetch = jest.fn((_input, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
    })) as typeof fetch;

    const request = sleeperClient.getLeague('stalled');
    const rejection = expect(request).rejects.toMatchObject({ name: 'AbortError' });
    await jest.advanceTimersByTimeAsync(10_000);

    await rejection;
  });
});
