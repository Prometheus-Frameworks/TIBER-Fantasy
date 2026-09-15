import express from 'express';
import request from 'supertest';
import { buildManagerResult } from '../teamManager';
import { summarizeManagerWeek } from '@shared/teamManager';
import { createDraftReviewRouter } from '../../../routes/draftReviewRoutes';
jest.mock('../../../middleware/rateLimit', () => ({ rateLimiters: { publicDraftReview: (_req: unknown, _res: unknown, next: () => void) => next() } }));
const input = { userId: '123', leagueId: '10', season: '2026', week: '1' };
const league = { league_id: '10', season: '2026', sport: 'nfl', status: 'in_season', total_rosters: 2,
  settings: { best_ball: 0, playoff_week_start: 15 } };
const rows = [{ roster_id: 1, matchup_id: 1, points: 100.25, custom_points: null }, { roster_id: 2, matchup_id: 1, points: 90, custom_points: null }];
function source() { return {
  getLeague: jest.fn().mockResolvedValue(league), getLeagueRosters: jest.fn().mockResolvedValue([{ roster_id: 1, owner_id: '123' }, { roster_id: 2, owner_id: '456' }]),
  getManagerMatchups: jest.fn().mockResolvedValue(rows), getManagerNflState: jest.fn().mockResolvedValue({ season: '2026', season_type: 'regular', leg: 2 }),
}; }
test('prior week result is provisional, exact roster scoped, source attributed and median excluded', async () => {
  const sources = source(); let clock = Date.parse('2026-09-15T12:00:00Z');
  const result = await buildManagerResult(input, sources, () => ++clock);
  expect(result).toMatchObject({ status: 'available', finality: 'not_verified', recordBasis: 'head_to_head_only', accountControlVerified: false });
  expect(result.rosters).toEqual([{ rosterId: 1, canonicalUrl: 'https://sleeper.com/roster/10/1', opponentRosterId: 2,
    points: 100.25, opponentPoints: 90, scoreBasis: 'reported', opponentScoreBasis: 'reported', outcome: 'win' }]);
  expect(new Set([result.observations.leagueReceivedAt, result.observations.rostersReceivedAt, result.observations.matchupsReceivedAt, result.observations.nflStateReceivedAt]).size).toBe(4);
  expect(result.observations.sourceUrls).toContain('https://api.sleeper.app/v1/league/10/matchups/1');
  expect(JSON.stringify(result)).not.toContain('owner_id');
});
test('zero override wins precedence and negative scores remain valid; corrections recompute', async () => {
  const sources = source(); sources.getManagerMatchups.mockResolvedValue([{ ...rows[0], custom_points: 0 }, { ...rows[1], points: -1 }]);
  expect((await buildManagerResult(input, sources)).rosters[0]).toMatchObject({ points: 0, outcome: 'win', scoreBasis: 'commissioner_override' });
  sources.getManagerMatchups.mockResolvedValue([{ ...rows[0], points: 90 }, rows[1]]);
  expect((await buildManagerResult(input, sources)).rosters[0].outcome).toBe('tie');
  sources.getManagerMatchups.mockResolvedValue([{ ...rows[0], points: 80 }, rows[1]]);
  expect((await buildManagerResult(input, sources)).rosters[0].outcome).toBe('loss');
});
test.each([{ season: '2026', season_type: 'regular', leg: 1 }, { season: '2025', season_type: 'regular', leg: 2 },
  { season: '2026', season_type: 'pre', leg: 2 }])('does not infer finality from a lead or wall clock %#', async state => {
  const sources = source(); sources.getManagerNflState.mockResolvedValue(state);
  expect((await buildManagerResult(input, sources)).rosters[0].outcome).toBe('pending');
});
test('state outage preserves observed scores while withholding result; missing scores are not zero', async () => {
  const sources = source(); sources.getManagerNflState.mockRejectedValue(new Error('outage'));
  expect((await buildManagerResult(input, sources)).rosters[0]).toMatchObject({ points: 100.25, outcome: 'unavailable' });
  sources.getManagerNflState.mockResolvedValue({ season: '2026', season_type: 'regular', leg: 2 });
  sources.getManagerMatchups.mockResolvedValue([{ ...rows[0], points: null }, rows[1]]);
  expect((await buildManagerResult(input, sources)).rosters[0]).toMatchObject({ points: null, outcome: 'pending' });
});
test.each([[], [rows[0]], [rows[0], rows[0]], [{ ...rows[0], roster_id: 3 }, rows[1]], [{ ...rows[0], points: '100' }, rows[1]]].map(value => [value]))('incomplete/invalid weekly coverage is unavailable %#', async matchups => {
  const sources = source(); sources.getManagerMatchups.mockResolvedValue(matchups);
  expect((await buildManagerResult(input, sources)).status).toBe('unavailable');
});
test('null/unpaired matchup is excluded, never a win against zero', async () => {
  const sources = source(); sources.getManagerMatchups.mockResolvedValue([{ ...rows[0], matchup_id: null }, rows[1]]);
  expect((await buildManagerResult(input, sources)).rosters[0]).toMatchObject({ outcome: 'unavailable', opponentPoints: null });
});
test('multiple memberships are returned for explicit choice; absent membership does not read scores', async () => {
  const sources = source(); sources.getLeagueRosters.mockResolvedValue([{ roster_id: 1, owner_id: '123' }, { roster_id: 2, owner_id: '456', co_owners: ['123'] }]);
  expect((await buildManagerResult(input, sources)).rosters).toHaveLength(2);
  sources.getManagerMatchups.mockClear();
  expect((await buildManagerResult({ ...input, userId: '999' }, sources)).rosters).toEqual([]);
  expect(sources.getManagerMatchups).not.toHaveBeenCalled();
});
test.each([{ ...league, season: '2025' }, { ...league, league_id: '20' }, { ...league, total_rosters: 3 }])('rejects scope/coverage mismatch %#', async value => {
  const sources = source(); sources.getLeague.mockResolvedValue(value); await expect(buildManagerResult(input, sources)).rejects.toThrow();
});
test.each([{ ...league, settings: {} }, { ...league, settings: { ...league.settings, best_ball: 1 } }, { ...league, settings: { ...league.settings, playoff_week_start: 1 } }])('unsupported league settings never invent a record %#', async value => {
  const sources = source(); sources.getLeague.mockResolvedValue(value);
  expect((await buildManagerResult(input, sources)).status).toBe('unavailable'); expect(sources.getManagerMatchups).not.toHaveBeenCalled();
});
test('aggregate keeps every missing state out of W/L/T', () => {
  expect(summarizeManagerWeek(['win', 'loss', 'tie', 'pending', 'unavailable'])).toEqual({ win: 1, loss: 1, tie: 1, pending: 1, unavailable: 1 });
});
test('HTTP strict input, sanitized failures and no-store', async () => {
  const original = global.fetch; global.fetch = jest.fn().mockRejectedValue(new Error('secret upstream detail'));
  const app = express(); app.use(createDraftReviewRouter());
  try {
    for (const invalid of [{ ...input, week: '0' }, { ...input, week: '19' }, { ...input, owner: 'private' }, { ...input, leagueId: '../x' }]) {
      expect((await request(app).get('/api/draft-review/manager-week').query(invalid)).status).toBe(400);
    }
    expect(global.fetch).not.toHaveBeenCalled();
    const res = await request(app).get('/api/draft-review/manager-week').query(input);
    expect(res.status).toBe(502); expect(res.headers['cache-control']).toBe('no-store');
    expect(res.headers['set-cookie']).toBeUndefined(); expect(JSON.stringify(res.body)).not.toContain('secret');
  } finally { global.fetch = original; }
});

test.each([null, {}, { season: '2026', season_type: 'regular', leg: '2' },
  { season: '2026', season_type: 'garbage', leg: 2 }, { season: '2026', season_type: '', leg: 2 }])('invalid state preserves scores with unavailable outcome and truthful reason %#', async state => {
  const sources = source(); sources.getManagerNflState.mockResolvedValue(state);
  const result = await buildManagerResult(input, sources);
  expect(result.rosters[0]).toMatchObject({ points: 100.25, opponentPoints: 90, outcome: 'unavailable' });
  expect(result.reason).toContain('NFL week state is unavailable or invalid');
  expect(result.reason).not.toContain('has not established');
  expect(result.observations.nflStateReceivedAt).toBeNull();
});

test.each(['pre', 'post'])('recognized %s state stays pending with validated observation', async season_type => {
  const sources = source(); sources.getManagerNflState.mockResolvedValue({ season: '2026', season_type, leg: 2 });
  const result = await buildManagerResult(input, sources);
  expect(result.rosters[0]).toMatchObject({ points: 100.25, outcome: 'pending' });
  expect(result.observations.nflStateReceivedAt).not.toBeNull();
});
