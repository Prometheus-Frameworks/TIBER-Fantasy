import express from 'express';
import request from 'supertest';
import { discoverTeamLeagues, findTeamLeagueRosters } from '../teamLeagues';
import { createDraftReviewRouter } from '../../../routes/draftReviewRoutes';

jest.mock('../../../middleware/rateLimit', () => ({ rateLimiters: { publicDraftReview: (_req: unknown, _res: unknown, next: () => void) => next() } }));
const league = (id = '10') => ({ league_id: id, season: '2026', name: `League ${id}`, sport: 'nfl',
  total_rosters: 2, settings: { type: 2 }, scoring_settings: { rec: 1 }, roster_positions: ['QB', 'WR', 'SUPER_FLEX'] });
function source() {
  return {
    getUser: jest.fn().mockResolvedValue({ user_id: '123', username: 'synthetic', display_name: '<untrusted>' }),
    getUserLeagues: jest.fn().mockResolvedValue([league('10'), league('20')]),
    getLeague: jest.fn().mockResolvedValue(league()),
    getLeagueRosters: jest.fn().mockResolvedValue([{ roster_id: 1, owner_id: '123' }, { roster_id: 2, owner_id: '456' }]),
  };
}
test('lists the requested season with distinct clocks, exact IDs and no all-roster fan-out', async () => {
  const sources = source(); let clock = Date.parse('2026-09-13T00:00:00Z');
  const result = await discoverTeamLeagues('synthetic', '2026', sources, () => ++clock);
  expect(result.account).toEqual({ userId: '123', username: 'synthetic', displayName: '<untrusted>' });
  expect(result.leagues[0]).toMatchObject({ leagueId: '10', mode: 'dynasty', receptionPoints: 1, superflex: true });
  expect(result.observations.accountReceivedAt).not.toBe(result.observations.leaguesReceivedAt);
  expect(result.observations.sourceUrls).toContain('https://api.sleeper.app/v1/user/123/leagues/nfl/2026');
  expect(result.accountControlVerified).toBe(false);
  expect(sources.getUserLeagues).toHaveBeenCalledWith('123', '2026');
  expect(sources.getLeagueRosters).not.toHaveBeenCalled(); expect(sources.getLeague).not.toHaveBeenCalled();
});
test('keeps empty leagues, unknown scoring and zero scoring distinct', async () => {
  const sources = source(); sources.getUserLeagues.mockResolvedValueOnce([]);
  expect((await discoverTeamLeagues('synthetic', '2026', sources)).leagues).toEqual([]);
  sources.getUserLeagues.mockResolvedValueOnce([{ league_id: '10', season: '2026' }, { ...league('20'), scoring_settings: { rec: 0 } }]);
  const result = await discoverTeamLeagues('synthetic', '2026', sources);
  expect(result.leagues[0]).toMatchObject({ mode: 'unknown', receptionPoints: null, superflex: null });
  expect(result.leagues[1].receptionPoints).toBe(0);
});
test.each([null, {}, [league(), league()], [{ ...league(), season: '2025' }], [{ ...league(), league_id: 10 }], Array.from({ length: 129 }, (_, i) => league(String(i)))])('fails closed for incomplete or malformed league lists %#', async value => {
  const sources = source(); sources.getUserLeagues.mockResolvedValue(value);
  await expect(discoverTeamLeagues('synthetic', '2026', sources)).rejects.toThrow('Sleeper league information is unavailable');
});
test('a numeric account cannot resolve to another user; malformed input never reaches the source', async () => {
  const sources = source();
  await expect(discoverTeamLeagues('456', '2026', sources)).rejects.toThrow();
  expect(sources.getUserLeagues).not.toHaveBeenCalled(); sources.getUser.mockClear();
  await expect(discoverTeamLeagues('../private', '2026', sources)).rejects.toThrow();
  expect(sources.getUser).not.toHaveBeenCalled();
});
test('checks the selected league and returns exact owner/co-owner roster memberships', async () => {
  const sources = source(); sources.getLeagueRosters.mockResolvedValue([
    { roster_id: 1, owner_id: '123', league_id: '10' }, { roster_id: 2, owner_id: '456', co_owners: ['123'], league_id: '10' },
  ]);
  const result = await findTeamLeagueRosters('123', '10', '2026', sources);
  expect(result.rosters).toEqual([
    { rosterId: 1, relationship: 'owner', canonicalUrl: 'https://sleeper.com/roster/10/1' },
    { rosterId: 2, relationship: 'co_owner', canonicalUrl: 'https://sleeper.com/roster/10/2' },
  ]);
  expect(sources.getLeagueRosters).toHaveBeenCalledWith('10'); expect(sources.getUserLeagues).not.toHaveBeenCalled();
  expect((await findTeamLeagueRosters('999', '10', '2026', sources)).rosters).toEqual([]);
});
test.each([
  null, [], [{ roster_id: 1, owner_id: '123' }],
  [{ roster_id: 1, owner_id: '123' }, { roster_id: 1, owner_id: '456' }],
  [{ roster_id: 1, owner_id: '123' }, { roster_id: 2, owner_id: '456', league_id: '20' }],
  [{ roster_id: 1, owner_id: '123' }, { roster_id: 2, owner_id: 456 }],
])('rejects incomplete/conflicting roster membership %#', async value => {
  const sources = source(); sources.getLeagueRosters.mockResolvedValue(value);
  await expect(findTeamLeagueRosters('123', '10', '2026', sources)).rejects.toThrow();
});
test('rejects mismatched selected league and season', async () => {
  await expect(findTeamLeagueRosters('123', '20', '2026', source())).rejects.toThrow();
  await expect(findTeamLeagueRosters('123', '10', '2025', source())).rejects.toThrow();
});
test('public routes reject extra/private inputs before source work and sanitize source failures', async () => {
  const original = global.fetch; global.fetch = jest.fn().mockRejectedValue(new Error('private upstream diagnostic'));
  const app = express(); app.use(createDraftReviewRouter());
  try {
    for (const query of [{ account: 'synthetic', season: '2026', userId: 'private' }, { account: '../secret', season: '2026' }, { account: 'synthetic', season: 'bad' }]) {
      expect((await request(app).get('/api/draft-review/leagues').query(query)).status).toBe(400);
    }
    expect(global.fetch).not.toHaveBeenCalled();
    const response = await request(app).get('/api/draft-review/leagues').query({ account: 'synthetic', season: '2026' }).set('Cookie', 'untrusted=private');
    expect(response.status).toBe(502); expect(response.headers['cache-control']).toBe('no-store');
    expect(response.headers['set-cookie']).toBeUndefined(); expect(JSON.stringify(response.body)).not.toContain('diagnostic');
  } finally { global.fetch = original; }
});
