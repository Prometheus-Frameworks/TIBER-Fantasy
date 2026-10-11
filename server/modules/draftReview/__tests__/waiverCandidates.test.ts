import express from 'express';
import request from 'supertest';
import { buildWaiverCandidates } from '../waiverCandidates';
import { buildDraftReview, __resetDraftReviewCacheForTests } from '../draftReviewService';
import { createDraftReviewRouter } from '../../../routes/draftReviewRoutes';
import { deriveWaiverSettings, selectWaiverCandidates } from '../../../../shared/teamWaiverContext';
import { draftReviewAgentPacket, reviewScope } from '../../../../shared/draftReviewStudy';
const originalFetch = global.fetch;
const url = 'https://sleeper.com/roster/123/1';
function sources(): any {
  return {
    league: { league_id: '123', season: '2026', total_rosters: 2, settings: { waiver_type: 2, waiver_budget: 100 } },
    rosters: [{ roster_id: 1, owner_id: 'private', players: ['11'], reserve: ['22'], settings: { waiver_position: 4, waiver_budget_used: 13 } }, { roster_id: 2, players: [], starters: ['33'], taxi: ['44'] }],
    players: Object.fromEntries(['11', '22', '33', '44', '55', '66'].map(id => [id, { player_id: id, full_name: `Player ${id}`, position: 'WR', active: true, team: 'NO' }])),
  };
}
function serve(data: any) {
  global.fetch = jest.fn(async input => {
    const path = String(input);
    const body = path.endsWith('/rosters') ? data.rosters : path.endsWith('/players/nfl') ? data.players : path.endsWith('/users') ? [] : data.league;
    return { ok: true, json: async () => body } as Response;
  });
}
afterEach(() => { global.fetch = originalFetch; __resetDraftReviewCacheForTests(); });
test.each([[0, 'rolling'], [1, 'reverse_standings'], [2, 'faab'], [7, 'unknown'], [undefined, 'unknown'], ['2', 'unknown']])('waiver type %s maps conservatively', (type, expected) => {
  const result = deriveWaiverSettings({ waiver_type: type, waiver_budget: 100 }, { waiver_budget_used: 10, waiver_position: 0 });
  expect(result.derived.system).toBe(expected);
  expect(result.derived.faab_remaining).toBe(expected === 'faab' ? 90 : null);
  expect(result.observed.waiver_position).toBeNull();
});
test.each([[100, 100, 0], [100, undefined, null], [100, 101, null], [100, -10, 110], [undefined, 0, null], ['100', 0, null], [100, 0.5, null]])('budget %s used %s remains truthful', (budget, used, expected) => {
  expect(deriveWaiverSettings({ waiver_type: 2, waiver_budget: budget }, { waiver_budget_used: used }).derived.faab_remaining).toBe(expected);
});
test('checks every membership group, filters directory, carries clocks and selected-only handoff', async () => {
  const data = sources(); data.players['66'].active = false; serve(data);
  const result = await buildWaiverCandidates(url);
  expect(result.candidates.map(p => p.player_id)).toEqual(['55']);
  expect(result.waiver_settings.derived).toEqual({ system: 'faab', faab_remaining: 87 });
  expect(result.observations.directory_source_updated_at).toBeNull();
  expect(result.claim_eligibility).toBe('unknown');
  expect(JSON.stringify(result)).not.toMatch(/owner_id|private/);
  const review = { input: result.input, generated_at: '2026-09-16T00:00:00Z' };
  const attachment = selectWaiverCandidates(reviewScope(review), result, ['55']);
  const packet = draftReviewAgentPacket(review, null, attachment);
  expect(packet.waiver_exploration).toHaveProperty('selected_candidates', [result.candidates[0]]);
  expect(packet.waiver_exploration).not.toHaveProperty('candidates');
  expect(draftReviewAgentPacket({ ...review, generated_at: '2026-09-16T01:00:00Z' }, null, attachment).waiver_exploration).toHaveProperty('status', 'unavailable');
  expect(() => selectWaiverCandidates(reviewScope(review), result, ['11'])).toThrow();
  expect(() => selectWaiverCandidates(reviewScope(review), result, ['55', '55'])).toThrow();
  expect((await buildDraftReview(url)).waiver_context.derived.faab_remaining).toBe(87);
});
test.each([
  (d: any) => { d.rosters[1].players = null; },
  (d: any) => { d.rosters.pop(); },
  (d: any) => { d.rosters[1].roster_id = 1; },
  (d: any) => { d.players['55'].player_id = '66'; },
  (d: any) => { d.league.league_id = '999'; },
])('incomplete or conflicting sources fail closed', async mutate => {
  const data = sources(); mutate(data); serve(data);
  await expect(buildWaiverCandidates(url)).rejects.toThrow();
});
test('GET route validates scope, preserves no-store and sanitizes failure', async () => {
  serve(sources()); const app = express(); app.use(createDraftReviewRouter());
  const good = await request(app).get('/api/draft-review/waiver-candidates').query({ sleeper_url: url });
  expect(good.status).toBe(200); expect(good.headers['cache-control']).toBe('no-store');
  expect((await request(app).get('/api/draft-review/waiver-candidates').query({ sleeper_url: 'https://evil.test' })).status).toBe(400);
  const data = sources(); data.rosters[1].players = null; serve(data);
  const bad = await request(app).get('/api/draft-review/waiver-candidates').query({ sleeper_url: url });
  expect(bad.status).toBe(502); expect(bad.body).not.toHaveProperty('candidates');
});
