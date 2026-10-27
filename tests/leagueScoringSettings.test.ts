import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { getRosterContext } from '../server/modules/leagueMcp/rosterContext';
import { createPersonalReaders } from '../server/modules/leagueMcp/personalContext';
import { createLeagueTools, publicReaders } from '../server/modules/leagueMcp/tools';
import { SCHEDULE_URL } from '../server/modules/leagueMcp/schedule';

const input = { userId: '123', leagueId: '10', season: '2026', rosterId: 1 };

function scoringSettings(size: number): Record<string, number> {
  const entries: [string, number][] = [
    ['rec', 1], ['bonus_rec_te', 0], ['fgm_50_59', 5], ['fgm_60p', 6],
    ['fgmiss_50_59', -1], ['fgmiss_60p', 0],
  ];
  while (entries.length < size) entries.push([`synthetic_rule_${entries.length}`, entries.length % 2 ? 0 : 0.5]);
  return Object.fromEntries(entries);
}

function fixture(scoring: Record<string, unknown>) {
  const league = { league_id: '10', name: 'Synthetic league', sport: 'nfl', season: '2026', total_rosters: 2,
    roster_positions: ['TE', 'BN'], scoring_settings: scoring, settings: { waiver_type: 2, waiver_budget: 100 } };
  const rosters = [
    { roster_id: 1, owner_id: '123', players: ['100'], starters: ['100'], settings: { waiver_budget_used: 21 } },
    { roster_id: 2, owner_id: '456', players: ['103'], starters: ['103'] },
  ];
  const players = Object.fromEntries([
    ['100', 'Synthetic Starter', 'PIT'], ['102', 'Synthetic Candidate', 'ATL'], ['103', 'Synthetic Rostered', 'BUF'],
  ].map(([player_id, full_name, team]) => [player_id, { player_id, full_name, team, position: 'TE', active: true, status: 'Active' }]));
  const calls = { league: 0, rosters: 0, directory: 0 };
  const sources = {
    getLeague: async () => { calls.league++; return league; },
    getLeagueRosters: async () => { calls.rosters++; return rosters; },
    getDirectory: async () => { calls.directory++; return { fetchedAt: Date.now(), players }; },
    getUser: async () => ({ user_id: '123', display_name: 'Synthetic', username: 'synthetic' }),
    getUserLeagues: async () => [league],
    getManagerNflState: async () => ({ season: '2026', season_type: 'regular', leg: 7 }),
    getSchedule: async (season: string) => ({ season, receivedAt: new Date().toISOString(), sourceUrl: 'https://example.com/synthetic.csv',
      contentHash: '0'.repeat(64), hashConvention: 'sha256_hex_utf8_decoded_text_v1', byeWeeks: { ATL: 8 }, teamWeeks: {} }),
  };
  const personal = createPersonalReaders({ userId: '123', defaultLeagueId: '10' }, sources);
  const call = createLeagueTools({ ...publicReaders, roster: i => getRosterContext(i, sources), ...personal });
  return { call, calls, sources, league, rosters, players };
}

for (const size of [128, 132, 148, 256]) {
  test(`roster and personal lineup preserve all ${size} scoring settings and candidate context`, async () => {
    const scoring = scoringSettings(size);
    const f = fixture(scoring);
    const roster: any = await f.call('tiber_get_roster_context', input);
    assert.equal(roster.status, 'available');
    assert.deepEqual(roster.league.scoring, scoring);

    const lineup: any = await f.call('tiber_get_lineup_context', { leagueId: '10', candidates: ['Synthetic Candidate', '103', '100'] });
    assert.equal(lineup.status, 'available');
    assert.deepEqual(lineup.league.scoring, scoring);
    assert.deepEqual(lineup.candidates.map((candidate: any) => candidate.availability), ['unrostered', 'rostered_elsewhere', 'on_selected_roster']);
    assert.equal(lineup.candidates[0].claimEligibility, 'unknown');
    assert.equal(lineup.waiverSettings.derived.faab_remaining, 79);
    assert.equal(lineup.selectionBasis, 'explicit_league');
    const defaultLineup: any = await f.call('tiber_get_lineup_context', { candidates: ['Synthetic Candidate'] });
    assert.equal(defaultLineup.selectionBasis, 'configured_default_league');
    assert.deepEqual(defaultLineup.league.scoring, scoring);
    assert.equal(defaultLineup.candidates[0].availability, 'unrostered');
    assert.deepEqual(f.calls, { league: 3, rosters: 3, directory: 3 });
  });
}

test('oversized maps and non-finite or nonnumeric scoring values fail closed without leaking source data', async () => {
  const badMaps: Record<string, unknown>[] = [
    scoringSettings(257),
    ...[NaN, Infinity, -Infinity, '1', null].map(value => ({ ...scoringSettings(132), sensitive_rule: value })),
  ];
  for (const scoring of badMaps) {
    const f = fixture(scoring);
    await assert.rejects(getRosterContext(input, f.sources));
    for (const [name, args] of [
      ['tiber_get_roster_context', input],
      ['tiber_get_lineup_context', { candidates: ['Synthetic Candidate'] }],
    ] as const) {
      const result = await f.call(name, args);
      assert.deepEqual(result, { status: 'unavailable', reason: 'source_unavailable' });
      assert.equal(JSON.stringify(result).includes('sensitive_rule'), false);
    }
  }
});

test('a valid scoring map remains subject to the complete response byte limit', async () => {
  const scoring = Object.fromEntries(Array.from({ length: 256 }, (_, i) => [`${i}_${'x'.repeat(4_000)}`, 0]));
  const f = fixture(scoring);
  const direct = await getRosterContext(input, f.sources);
  assert.equal(Object.keys(direct.league.scoring!).length, 256);
  assert.deepEqual(await f.call('tiber_get_roster_context', input), { status: 'unavailable', reason: 'response_too_large' });
  assert.deepEqual(await f.call('tiber_get_lineup_context', {}), { status: 'unavailable', reason: 'response_too_large' });
});

test('bundled Worker carries large synthetic league maps through MCP and waiver context', async () => {
  const f = fixture(scoringSettings(128));
  const output = await mkdtemp(join(tmpdir(), 'tiber-scoring-worker-'));
  const originalFetch = globalThis.fetch;
  try {
    await build({ entryPoints: ['server/mcp/leagueReaderWorker.ts'], outfile: join(output, 'worker.mjs'),
      bundle: true, platform: 'browser', format: 'esm', target: 'es2022', logLevel: 'silent',
      alias: { '@shared': resolve('shared') } });
    const worker = (await import(pathToFileURL(join(output, 'worker.mjs')).href)).default;
    globalThis.fetch = async (input, init) => {
      assert.equal(init?.redirect, 'manual');
      const url = String(input);
      if (url === SCHEDULE_URL) return new Response('synthetic schedule unavailable', { status: 503 });
      const paths: Record<string, unknown> = {
        'https://api.sleeper.app/v1/state/nfl': { season: '2026', season_type: 'regular', leg: 7 },
        'https://api.sleeper.app/v1/league/10': f.league,
        'https://api.sleeper.app/v1/league/10/rosters': f.rosters,
        'https://api.sleeper.app/v1/players/nfl': f.players,
      };
      assert.ok(Object.hasOwn(paths, url), `unexpected synthetic source: ${url}`);
      return Response.json(paths[url]);
    };
    const env = { TIBER_LEAGUE_SOURCE: 'public-sleeper', TIBER_PROFILE_USER_ID: '123', TIBER_DEFAULT_LEAGUE_ID: '10' };
    const call = async (name: string, args: object) => {
      const request = new Request('https://private.invalid/mcp', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream',
          Origin: 'https://chatgpt.com', 'mcp-protocol-version': '2025-11-25', 'oai-authenticated-user-id': 'synthetic-owner' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }),
      });
      const response = await worker.fetch(request, env);
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('cache-control'), 'no-store');
      return (await response.json()).result;
    };
    for (const size of [128, 132, 148, 256]) {
      const scoring = scoringSettings(size);
      f.league.scoring_settings = scoring;
      const roster = await call('tiber_get_roster_context', input);
      assert.equal(roster.isError, false);
      assert.deepEqual(roster.structuredContent.league.scoring, scoring);
      const lineup = await call('tiber_get_lineup_context', { candidates: ['Synthetic Candidate', '103', '100'] });
      assert.equal(lineup.isError, false);
      assert.deepEqual(lineup.structuredContent.league.scoring, scoring);
      assert.deepEqual(lineup.structuredContent.candidates.map((candidate: any) => candidate.availability),
        ['unrostered', 'rostered_elsewhere', 'on_selected_roster']);
      assert.equal(lineup.structuredContent.waiverSettings.derived.faab_remaining, 79);
    }
    f.league.scoring_settings = scoringSettings(257);
    for (const [name, args] of [['tiber_get_roster_context', input], ['tiber_get_lineup_context', {}]] as const) {
      const result = await call(name, args);
      assert.equal(result.isError, true);
      assert.deepEqual(result.structuredContent, { status: 'unavailable', reason: 'source_unavailable' });
    }
  } finally {
    globalThis.fetch = originalFetch;
    await rm(output, { recursive: true, force: true });
  }
});
