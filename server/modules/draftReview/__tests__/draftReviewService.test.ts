import { afterEach, describe, expect, jest, test } from '@jest/globals';
import { buildDraftReview, parseSleeperRosterUrl } from '../draftReviewService';

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
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
  test('accepts only an exact public Sleeper roster URL', () => {
    expect(parseSleeperRosterUrl('https://sleeper.com/roster/1392906445938266112/7')).toEqual({
      leagueId: '1392906445938266112',
      rosterId: 7,
      canonicalUrl: 'https://sleeper.com/roster/1392906445938266112/7',
    });
    expect(() => parseSleeperRosterUrl('https://example.com/roster/123/7')).toThrow('Only public Sleeper');
    expect(() => parseSleeperRosterUrl('1392906445938266112')).toThrow('complete Sleeper roster URL');
  });

  test('keeps observed roster state, deterministic geometry, and unavailable Forecast separate', async () => {
    global.fetch = jest.fn(async (input) => {
      const url = String(input);
      if (url.endsWith('/league/123')) return response({
        league_id: '123',
        name: 'Redraft Test',
        season: '2026',
        total_rosters: 10,
        settings: { type: 0 },
        scoring_settings: { rec: 1 },
        roster_positions: ['QB', 'RB', 'WR', 'TE', 'FLEX', 'BN', 'BN'],
        draft_id: 'draft-1',
      });
      if (url.endsWith('/league/123/users')) return response([{ user_id: 'u1', display_name: 'Manager' }]);
      if (url.endsWith('/league/123/rosters')) return response([{
        roster_id: 7,
        owner_id: 'u1',
        players: ['qb1', 'qb2', 'rb1', 'wr1', 'te1'],
        starters: ['qb1', 'rb1', 'wr1', 'te1'],
      }]);
      if (url.endsWith('/players/nfl')) return response({
        qb1: { full_name: 'Quarterback One', position: 'QB', team: 'AAA' },
        qb2: { full_name: 'Quarterback Two', position: 'QB', team: 'BBB' },
        rb1: { full_name: 'Running Back', position: 'RB', team: 'CCC' },
        wr1: { full_name: 'Wide Receiver', position: 'WR', team: 'DDD' },
        te1: { full_name: 'Tight End', position: 'TE', team: 'EEE' },
      });
      if (url.endsWith('/draft/draft-1/picks')) return response([
        { player_id: 'qb1', roster_id: 7, round: 1, pick_no: 10 },
      ]);
      throw new Error(`Unexpected URL: ${url}`);
    }) as typeof fetch;

    const result = await buildDraftReview('https://sleeper.com/roster/123/7');

    expect(result.observed.league.league_mode).toBe('redraft');
    expect(result.observed.team.display_name).toBe('Manager');
    expect(result.derived.position_counts).toEqual({ QB: 2, RB: 1, WR: 1, TE: 1 });
    expect(result.derived.roster_flags).toEqual(['2 quarterbacks rostered for 1 weekly QB slot.']);
    expect(result.observed.draft.picks).toHaveLength(1);
    expect(result.forecast).toMatchObject({ status: 'unavailable', fabricated_values: false });
    expect(result.provenance.disclosures.join(' ')).toContain('does not use FFC ADP');
  });
});
