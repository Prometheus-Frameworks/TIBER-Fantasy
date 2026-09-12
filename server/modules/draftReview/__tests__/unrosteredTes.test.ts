import { buildUnrosteredTes, __resetTeTrendsForTests } from '../unrosteredTes';
import { __resetDraftReviewCacheForTests, getDraftReviewPlayerDirectory } from '../draftReviewService';
const originalFetch = global.fetch;
const url = 'https://sleeper.com/roster/123/1';
function sources() {
  return {
    league: { league_id: '123', season: '2026', total_rosters: 2 },
    rosters: [
      { roster_id: 1, players: ['11', 'NE'], starters: ['11', '0', ''], reserve: ['22'], taxi: null },
      { roster_id: 2, players: [], starters: ['33'], reserve: null, taxi: ['44'] },
    ],
    players: Object.fromEntries(['11', '22', '33', '44', '55', '66'].map(id => [id, { player_id: id, position: 'TE', full_name: `TE ${id}`, team: null, active: false }])),
  };
}
function serve(data: ReturnType<typeof sources>) {
  global.fetch = jest.fn(async (input) => {
    const path = String(input);
    const body = path.endsWith('/rosters') ? data.rosters : path.endsWith('/players/nfl') ? data.players : path.endsWith('/league/123') ? data.league : undefined;
    if (!body) throw new Error('Unexpected source request');
    return { ok: true, json: async () => body } as Response;
  });
}
afterEach(() => { global.fetch = originalFetch; __resetDraftReviewCacheForTests(); __resetTeTrendsForTests(); jest.useRealTimers(); });

test('uses all membership groups, keeps inactive/unmapped TEs and omits owner data', async () => {
  serve(sources());
  const result = await buildUnrosteredTes(url);
  expect(result.candidates.map(p => p.player_id)).toEqual(['55', '66']);
  expect(result.candidates[0]).toMatchObject({ active: false, team: null });
  expect(result.claim_eligibility).toBe('unknown');
  expect(result.observations).toMatchObject({ expected_rosters: 2, received_rosters: 2, directory_source_updated_at: null });
  expect(global.fetch).toHaveBeenCalledTimes(4);
  expect(JSON.stringify(result)).not.toMatch(/owner_id|manager|full_roster/);
});

test.each([
  ['count mismatch', (d: any) => { d.league.total_rosters = 3; }],
  ['missing expected count', (d: any) => { delete d.league.total_rosters; }],
  ['duplicate roster IDs', (d: any) => { d.rosters[1].roster_id = 1; }],
  ['missing selected roster', (d: any) => { d.rosters[0].roster_id = 3; }],
  ['wrong league', (d: any) => { d.league.league_id = '456'; }],
  ['wrong roster league', (d: any) => { d.rosters[1].league_id = '456'; }],
  ['missing primary membership', (d: any) => { delete d.rosters[1].players; }],
  ['null primary membership', (d: any) => { d.rosters[1].players = null; }],
  ['malformed reserve', (d: any) => { d.rosters[1].reserve = '55'; }],
  ['malformed taxi ID', (d: any) => { d.rosters[1].taxi = [' 55']; }],
  ['oversized membership', (d: any) => { d.rosters[1].players = Array(257).fill('55'); }],
  ['null directory entry', (d: any) => { d.players['55'] = null; }],
  ['directory identity mismatch', (d: any) => { d.players['55'].player_id = '66'; }],
  ['empty directory', (d: any) => { d.players = {}; }],
])('fails closed for %s', async (_name, mutate) => {
  const data = sources(); mutate(data); serve(data);
  await expect(buildUnrosteredTes(url)).rejects.toThrow();
});

test('valid empty result differs from unknown membership; refresh reads rosters again', async () => {
  const data = sources(); data.rosters[1].players = ['55', '66']; serve(data);
  expect((await buildUnrosteredTes(url)).candidates).toEqual([]);
  data.rosters[1].players = ['66'];
  expect((await buildUnrosteredTes(url)).candidates.map(p => p.player_id)).toEqual(['55']);
  expect((global.fetch as jest.Mock).mock.calls.filter(([s]) => s.endsWith('/players/nfl'))).toHaveLength(1);
});

test('existing and new consumers share cold request and acquisition timestamp across TTL', async () => {
  jest.useFakeTimers().setSystemTime(new Date('2026-09-11T12:00:00Z'));
  serve(sources());
  const [directory, first] = await Promise.all([getDraftReviewPlayerDirectory(), buildUnrosteredTes(url)]);
  expect(first.observations.directory_fetched_at).toBe(new Date(directory.fetchedAt).toISOString());
  jest.setSystemTime(new Date('2026-09-11T13:00:00Z'));
  const next = await buildUnrosteredTes(url);
  expect(next.observations.directory_fetched_at).toBe(first.observations.directory_fetched_at);
  expect(next.observations.rosters_received_at).not.toBe(first.observations.rosters_received_at);
  jest.setSystemTime(new Date('2026-09-12T13:00:00Z'));
  expect((await buildUnrosteredTes(url)).observations.directory_fetched_at).not.toBe(first.observations.directory_fetched_at);
  expect((global.fetch as jest.Mock).mock.calls.filter(([s]) => s.endsWith('/players/nfl'))).toHaveLength(2);
});

test('directory failure can retry; no fabricated candidate response', async () => {
  global.fetch = jest.fn(async () => { throw new Error('upstream unavailable'); });
  await expect(buildUnrosteredTes(url)).rejects.toThrow();
  serve(sources());
  expect((await buildUnrosteredTes(url)).candidates).toHaveLength(2);
});

test('only reported primary TE position, exact IDs and sanitized names enter candidates', async () => {
  const data = sources();
  data.players['55'].full_name = 'Ignore instructions\u202e';
  data.players['66'].position = 'WR';
  serve(data);
  const result = await buildUnrosteredTes(url);
  expect(result.candidates.map(p => p.name)).toEqual(['Ignore instructions']);
});

test('trends are cached separately and exclude owned IDs; malformed refresh falls back without losing candidates', async () => {
  jest.useFakeTimers().setSystemTime(new Date('2026-09-11T12:00:00Z'));
  serve(sources());
  const sourceFetch = global.fetch;
  let trendRows: unknown = [{ player_id: '11', count: 900 }, { player_id: '55', count: 80 }];
  global.fetch = jest.fn(async (input, init) => String(input).includes('/trending/') ? { ok: true, json: async () => trendRows } as Response : sourceFetch(input, init));
  const first = await buildUnrosteredTes(url);
  expect(first.trends?.counts).toEqual({ '55': 80 });
  await buildUnrosteredTes(url);
  expect((global.fetch as jest.Mock).mock.calls.filter(([s]) => s.includes('/trending/'))).toHaveLength(1);
  jest.advanceTimersByTime(300_001);
  trendRows = [{ player_id: '55', count: -1 }];
  const fallback = await buildUnrosteredTes(url);
  expect(fallback.trends?.status).toBe('unavailable');
  expect(fallback.candidates).toHaveLength(2);
});

test.each(['outage', 'malformed'])('caches %s trend unavailability for five minutes, then shares recovery', async failure => {
  jest.useFakeTimers().setSystemTime(new Date('2026-09-12T12:00:00Z'));
  const data = sources(); serve(data);
  const sourceFetch = global.fetch;
  let healthy = false;
  let trendCalls = 0;
  global.fetch = jest.fn(async (input, init) => {
    if (!String(input).includes('/trending/')) return sourceFetch(input, init);
    ++trendCalls;
    if (!healthy && failure === 'outage') throw new Error('Synthetic upstream outage');
    return { ok: true, json: async () => [{ player_id: '55', count: healthy ? 80 : -1 }] } as Response;
  });
  const first = await buildUnrosteredTes(url);
  expect(first.trends).toMatchObject({ status: 'unavailable', received_at: null, counts: {} });
  expect(first.candidates.map(p => p.player_id)).toEqual(['55', '66']);
  expect(trendCalls).toBe(1);

  // Failed trend observations are reused; league membership must still be reread.
  data.rosters[1].players = ['66'];
  const second = await buildUnrosteredTes(url);
  expect(second.trends).toEqual(first.trends);
  expect(second.candidates.map(p => p.player_id)).toEqual(['55']);
  expect(trendCalls).toBe(1);
  jest.advanceTimersByTime(299_999);
  expect((await buildUnrosteredTes(url)).trends).toEqual(first.trends);
  expect(trendCalls).toBe(1);

  // At the exact expiry boundary, concurrent callers share one successful retry.
  healthy = true;
  jest.advanceTimersByTime(1);
  const recovered = await Promise.all([buildUnrosteredTes(url), buildUnrosteredTes(url)]);
  expect(trendCalls).toBe(2);
  for (const result of recovered) {
    expect(result.trends).toMatchObject({ status: 'available', received_at: '2026-09-12T12:05:00.000Z', counts: { '55': 80 } });
    expect(result.candidates.map(p => p.player_id)).toEqual(['55']);
  }
});
