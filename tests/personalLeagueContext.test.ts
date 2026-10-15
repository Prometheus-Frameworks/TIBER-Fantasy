import test from 'node:test';
import assert from 'node:assert/strict';
import { createPersonalReaders } from '../server/modules/leagueMcp/personalContext';
import { createLeagueTools, publicReaders } from '../server/modules/leagueMcp/tools';
import { compileSchedule } from '../server/modules/leagueMcp/schedule';
import { readBoundedText } from '../server/integrations/boundedFetch';
import worker from '../server/mcp/leagueReaderWorker';
import { sleeperClient } from '../server/integrations/sleeperClient';
import { getSchedule } from '../server/modules/leagueMcp/schedule';

test('Worker-compatible fetch refuses redirects without following or parsing them', async () => {
  const original = globalThis.fetch;
  const calls: string[] = [];
  globalThis.fetch = async (input, init) => {
    assert.equal(init?.redirect, 'manual');
    calls.push(String(input));
    return new Response('redirect body must not be parsed', { status: 302, headers: { Location: 'https://untrusted.example/redirect' } });
  };
  try {
    await assert.rejects(sleeperClient.getManagerNflState());
    await assert.rejects(getSchedule('2026'));
    assert.equal(calls.length, 2);
    assert.equal(calls.some(url => url.includes('untrusted.example')), false);
  } finally { globalThis.fetch = original; }
});

function fixture() {
  const league = { league_id: '10', name: 'Synthetic PPR', sport: 'nfl', season: '2026', total_rosters: 2,
    roster_positions: ['TE', 'BN'], scoring_settings: { rec: 1, bonus_rec_te: 0 }, settings: { waiver_type: 2, waiver_budget: 100 } };
  const rosters = [
    { roster_id: 1, owner_id: '123', players: ['100', '101'], starters: ['100'], reserve: null, taxi: null, settings: { waiver_budget_used: 21 } },
    { roster_id: 2, owner_id: '456', players: ['103'], starters: ['103'] },
  ];
  const players = Object.fromEntries([
    ['100', 'Synthetic Starter', 'PIT'], ['101', 'Synthetic Bench', 'DET'],
    ['102', 'Synthetic Candidate', 'ATL'], ['103', 'Synthetic Rostered', 'BUF'],
  ].map(([player_id, full_name, team]) => [player_id, { player_id, full_name, team, position: 'TE', active: true, status: 'Active' }]));
  const calls = { league: 0, rosters: 0, directory: 0 };
  const sources = {
    getLeague: async () => { calls.league++; return league; },
    getLeagueRosters: async () => { calls.rosters++; return rosters; },
    getDirectory: async () => { calls.directory++; return { fetchedAt: Date.now(), players }; },
    getUser: async () => ({ user_id: '123', display_name: 'Synthetic', username: 'synthetic' }),
    getUserLeagues: async () => [league],
    getManagerNflState: async () => ({ season: '2026', season_type: 'regular', leg: 6 }),
    getSchedule: async (season: string) => ({ season, receivedAt: new Date().toISOString(), sourceUrl: 'https://example.com/synthetic.csv', byeWeeks: { PIT: 9, DET: 6, ATL: 7 } }),
  };
  return { sources, calls, rosters, players };
}
test('one personal call verifies membership and returns lineup, PPR, byes and candidate availability', async () => {
  const f = fixture();
  const personal = createPersonalReaders({ userId: '123', defaultLeagueId: '10' }, f.sources);
  const call = createLeagueTools({ ...publicReaders, ...personal });
  const result: any = await call('tiber_get_lineup_context', { candidates: ['Synthetic Candidate', '103', 'Synthetic Starter'] });
  assert.equal(result.schemaVersion, 'tiber_personal_lineup_context_v1');
  assert.equal(result.week, 6); assert.equal(result.league.scoring.rec, 1); assert.equal(result.league.scoring.bonus_rec_te, 0);
  assert.equal(result.lineup[0].slot, 'TE'); assert.equal(result.lineup[0].player.name, 'Synthetic Starter');
  assert.equal(result.roster.directory.find((p: any) => p.playerId === '101').onBye, true);
  assert.deepEqual(result.candidates.map((c: any) => c.availability), ['unrostered', 'rostered_elsewhere', 'on_selected_roster']);
  assert.equal(result.candidates[0].claimEligibility, 'unknown');
  assert.equal(result.waiverSettings.derived.faab_remaining, 79);
  assert.deepEqual(f.calls, { league: 1, rosters: 1, directory: 1 });
  assert.equal(JSON.stringify(result).includes('owner_id'), false);
  assert.deepEqual(result.roster.players, ['100', '101']);
  assert.equal((await personal.myLeagues({})).season, '2026');
});
test('strict personal selectors cannot override the configured account or source', async () => {
  const f = fixture(), personal = createPersonalReaders({ userId: '123', defaultLeagueId: '10' }, f.sources);
  const call = createLeagueTools({ ...publicReaders, ...personal });
  for (const args of [{ userId: '456' }, { url: 'https://example.com' }, { week: 6 }, { candidates: Array(6).fill('102') }]) {
    assert.equal((await call('tiber_get_lineup_context', args)).reason, 'invalid_input');
  }
  assert.deepEqual(f.calls, { league: 0, rosters: 0, directory: 0 });
  assert.equal((await personal.lineup({ rosterId: 2 })).reason, 'roster_selection_required');
  assert.equal(f.calls.directory, 0);
  f.rosters[1].owner_id = '123';
  assert.equal((await personal.lineup({})).reason, 'roster_selection_required');
});
test('missing or conflicting sources preserve roster facts without inventing byes or waiver status', async () => {
  const f = fixture();
  f.sources.getSchedule = async () => { throw Error('outage'); };
  let personal = createPersonalReaders({ userId: '123', defaultLeagueId: '10' }, f.sources);
  let result: any = await personal.lineup({ candidates: ['Unknown Player'] });
  assert.equal(result.roster.directory[0].onBye, null);
  assert.equal(result.observations.schedule.status, 'unavailable');
  assert.equal(result.candidates[0].reason, 'player_not_found');
  f.sources.getDirectory = async () => { throw Error('directory outage'); };
  personal = createPersonalReaders({ userId: '123', defaultLeagueId: '10' }, f.sources);
  result = await personal.lineup({ candidates: ['102'] });
  assert.equal(result.roster.players[0], '100'); assert.equal(result.roster.directory[0].name, null);
  assert.equal(result.candidates[0].status, 'unavailable'); assert.equal(result.waiverSettings, null);
});
test('historical season does not inherit the current NFL week, and ambiguous names require an ID', async () => {
  const f = fixture();
  f.sources.getLeague = async () => ({ ...await fixture().sources.getLeague(), season: '2025' });
  f.players['103'].full_name = 'Synthetic Candidate';
  const result: any = await createPersonalReaders({ userId: '123', defaultLeagueId: '10' }, f.sources).lineup({ season: '2025', candidates: ['Synthetic Candidate'] });
  assert.equal(result.week, null); assert.equal(result.roster.directory[0].onBye, null);
  assert.equal(result.candidates[0].reason, 'ambiguous_player');
});
function completeCsv() {
  const teams = 'ARI ATL BAL BUF CAR CHI CIN CLE DAL DEN DET GB HOU IND JAX KC LAC LAR LV MIA MIN NE NO NYG NYJ PHI PIT SEA SF TB TEN WAS'.split(' ');
  const rows = ['game_id,season,game_type,week,gameday,home_team,away_team'];
  for (let week = 1; week <= 17; week++) for (let i = 0; i < 32; i += 2) rows.push(`SYNTHETIC_${week}_${i},2026,REG,${week},2026-10-01,${teams[i]},${teams[i + 1]}`);
  return rows;
}
test('bye derivation requires full 272-game, 32-team coverage and rejects missing/duplicate/team-week conflicts', () => {
  const rows = completeCsv();
  assert.equal(compileSchedule(rows.join('\n'), '2026', new Date().toISOString()).byeWeeks.DET, 18);
  for (const csv of [rows.slice(0, -1).join('\n'), [...rows.slice(0, -1), rows[1]].join('\n'), rows.join('\n').replace('SYNTHETIC_2_0,2026,REG,2', 'SYNTHETIC_2_0,2026,REG,1')]) {
    assert.throws(() => compileSchedule(csv, '2026', new Date().toISOString()));
  }
});
test('decoded body limits stop chunked upstream and inbound bodies before parsing', async () => {
  let canceled = false;
  const body = new ReadableStream({ start(c) { c.enqueue(new Uint8Array(8)); c.enqueue(new Uint8Array(8)); }, cancel() { canceled = true; } });
  await assert.rejects(readBoundedText(new Response(body), 10)); assert.equal(canceled, true);
  await assert.rejects(readBoundedText(new Response('x', { headers: { 'Content-Length': '100' } }), 10));
});
test('hosted discovery contains no profile, data calls require identity, and disabled source never reads', async () => {
  const env = { TIBER_PROFILE_USER_ID: '123', TIBER_DEFAULT_LEAGUE_ID: '10' };
  const request = (body: unknown, headers = {}) => new Request('https://private.example/mcp', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', ...headers }, body: JSON.stringify(body) });
  const discovery = await worker.fetch(request({ jsonrpc: '2.0', id: 1, method: 'tools/list' }), env);
  assert.equal(discovery.status, 200); const text = await discovery.text();
  assert.match(text, /tiber_get_lineup_context/); assert.equal(text.includes('"defaultLeagueId"'), false);
  const call = { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'tiber_get_lineup_context', arguments: {} } };
  assert.equal((await worker.fetch(request(call), env)).status, 403);
  const disabled = await worker.fetch(request(call, { 'oai-authenticated-user-id': 'synthetic' }), env);
  assert.match(await disabled.text(), /source_disabled/);
  assert.equal((await worker.fetch(request(call, { Origin: 'https://evil.example' }), env)).status, 403);
  assert.equal((await worker.fetch(request([{ jsonrpc: '2.0', id: 1, method: 'tools/list' }]), env)).status, 400);
  assert.equal((await worker.fetch(new Request('https://private.example/mcp', { method: 'POST', body: 'x'.repeat(17_000) }), env)).status, 413);
});
