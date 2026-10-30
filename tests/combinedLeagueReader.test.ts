import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { buildLeagueReaderServer } from '../server/mcp/leagueReaderServer';
import { createLeagueTools, type Readers } from '../server/modules/leagueMcp/tools';
import { createPersonalReaders } from '../server/modules/leagueMcp/personalContext';
import { compileSchedule, SCHEDULE_TEAMS, SCHEDULE_URL } from '../server/modules/leagueMcp/schedule';
import { createRoleTools, ROLE_TOOL } from '../server/modules/roleEvidence/roleHistory';
import publicWorker from '../server/mcp/leagueReaderWorker';

// Entirely synthetic observations. These IDs/values are not a retained private release or a player crosswalk.
function fixture() {
  const league = { league_id: '10', name: 'Synthetic league', sport: 'nfl', season: '2026', total_rosters: 2,
    roster_positions: ['TE', 'BN'], scoring_settings: { rec: 1, bonus_rec_te: 0.5 }, settings: { playoff_week_start: 15 } };
  const rosters = [
    { roster_id: 1, owner_id: '123', players: ['100'], starters: ['100'] },
    { roster_id: 2, owner_id: '456', players: ['200'], starters: ['200'] },
  ];
  const players = {
    '100': { player_id: '100', full_name: 'Synthetic current player', team: 'BUF', position: 'TE', active: true },
    '200': { player_id: '200', full_name: 'Synthetic other player', team: 'ATL', position: 'TE', active: true },
  };
  const state = { season: '2026', season_type: 'regular', leg: 7 };
  const lines = ['game_id,season,game_type,week,gameday,home_team,away_team'];
  for (let week = 1; week <= 17; week++) for (let i = 0; i < 32; i += 2) {
    lines.push(`SYNTHETIC_${week}_${i},2026,REG,${week},2026-10-01,${SCHEDULE_TEAMS[i]},${SCHEDULE_TEAMS[i + 1]}`);
  }
  const csv = lines.join('\n');
  const schedule = compileSchedule(csv, '2026', '2026-10-20T00:00:00Z', createHash('sha256').update(csv).digest('hex'));
  const rows = [1, 2, 3, 4, 5].map(week => ({
    player_id: '00-0000001', namespace: 'nflverse:gsis', season: 2026, season_type: 'REG', week,
    coverage_status: 'observed', fields: { carries: { value: 0, status: 'observed' } },
    observed_zero_fields: ['carries'], segments: [], state_path: `synthetic/${week}`,
    finality: 'unknown', correction: 'open', evidence_cutoff: null,
  }));
  const artifact = { schemaVersion: 'tiber_private_rop_input_v1',
    release: { id: 'TIBER-ROP-2026-W01-W05-Private-Release', version: 2,
      archiveSha256: 'd2bb08b185c7ec73d80480ccc7cbc234ce02d89ac6d57308f6bcfa34ff69af13',
      outputSha256: '7cdfdb96fa5bbb1f6703698b83fe0f142c7498f74043be7bad72d6f5f3e91c49' },
    metadata: { mode: 'synthetic_test_only' }, catalogue: [{ player_id: '00-0000001', namespace: 'nflverse:gsis' }], rows,
    states: Object.fromEntries(rows.map(row => [row.state_path, { reference: { path: row.state_path }, retained: { synthetic: true } }])),
  };
  const sources = {
    getLeague: async () => league, getLeagueRosters: async () => rosters,
    getDirectory: async () => ({ fetchedAt: Date.parse('2026-10-21T00:00:00Z'), players }),
    getManagerNflState: async () => state, getSchedule: async () => schedule,
    getUser: async () => ({ user_id: '123', username: 'synthetic' }), getUserLeagues: async () => [league],
  };
  const unexpected = async () => { throw Error('unexpected_dispatch'); };
  const readers: Readers = { leagues: unexpected, memberships: unexpected, roster: unexpected, matchups: unexpected,
    ...createPersonalReaders({ userId: '123', defaultLeagueId: '10' }, sources) };
  return { league, rosters, players, state, csv, schedule, artifact, readers };
}
const roleQuery = { subject: { namespace: 'nflverse:gsis', id: '00-0000001' }, season: 2026, seasonType: 'REG', weeks: [1, 5, 7] };

async function connect(readers: Readers, role: ReturnType<typeof createRoleTools>) {
  const server = buildLeagueReaderServer(readers, createLeagueTools(readers), role);
  const client = new Client({ name: 'synthetic-integration-test', version: '1' });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await server.connect(a); await client.connect(b);
  return { client, close: async () => { await client.close(); await server.close(); } };
}

test('combined MCP keeps current lineup/ROS observations consistent and frozen GSIS history separate and lazy', async () => {
  const f = fixture(); let loads = 0;
  const role = createRoleTools({ release: f.artifact.release, load: () => { loads++; return structuredClone(f.artifact); } }, true);
  const session = await connect(f.readers, role);
  const call = async (name: string, args = {}) => (await session.client.callTool({ name, arguments: args })).structuredContent as any;
  try {
    assert.equal((await session.client.listTools()).tools.length, 9);
    assert.equal((await call('tiber_league_capabilities')).families.ROP.validation, 'deferred');
    const lineup = await call('tiber_get_lineup_context');
    const ros = await call('tiber_get_ros_schedule_strength', { player: '100', window: 'next3' });
    assert.equal(lineup.week, 7); assert.equal(ros.calendar.decisionWeek, 7);
    assert.equal(ros.resolvedIdentity.playerId, lineup.lineup[0].playerId);
    assert.equal(ros.resolvedIdentity.team, lineup.lineup[0].player.team);
    assert.equal(ros.source.contentHash, lineup.observations.schedule.contentHash);
    assert.deepEqual(ros.scoring.settings, lineup.league.scoring);
    assert.deepEqual(ros.window.weeks, [7, 8, 9]);
    assert.equal(ros.ratings.reason, 'no_qualified_defensive_evidence');
    assert.ok(ros.window.fixtures.every((r: any) => r.opponentDefense.rating === null && r.lockState === 'unknown'));
    const bye = await call('tiber_get_ros_schedule_strength', { player: '100', window: 'custom', startWeek: '18', endWeek: '18' });
    assert.equal(bye.window.fixtures[0].bye, true);
    assert.equal(bye.window.fixtures[0].week, lineup.roster.directory[0].byeWeek);
    assert.equal(loads, 0);
    const history = await call(ROLE_TOOL, roleQuery);
    assert.deepEqual(history.weeks.map((w: any) => w.status), ['observed', 'observed', 'outside_release_scope']);
    assert.deepEqual(history.weeks[0].record, f.artifact.rows[0]);
    assert.equal(history.weeks[0].record.player_id, roleQuery.subject.id);
    assert.equal(history.weeks[0].record.team, undefined);
    assert.equal(history.weeks[2].record, null);
    assert.equal((await call('tiber_league_capabilities')).families.ROP.validation, 'passed');
    await call('tiber_get_lineup_context'); await call(ROLE_TOOL, roleQuery);
    assert.equal(loads, 1);
    const foreign = await call('tiber_get_lineup_context', { rosterId: 2 });
    assert.equal(foreign.reason, 'roster_selection_required');
    assert.equal((await session.client.callTool({ name: ROLE_TOOL, arguments: { ...roleQuery, subject: { namespace: 'sleeper', id: '100' } } })).isError, true);
  } finally { await session.close(); }
});

test('lineup and ROS share the source busy slot while local frozen ROP remains independent', async () => {
  const f = fixture(); let release!: () => void, entered!: () => void;
  const hold = new Promise<void>(resolve => { release = resolve; });
  const started = new Promise<void>(resolve => { entered = resolve; });
  const readers = { ...f.readers, lineup: async (args: any) => { entered(); await hold; return f.readers.lineup!(args); } };
  const session = await connect(readers, createRoleTools(f.artifact, true));
  const pending = session.client.callTool({ name: 'tiber_get_lineup_context', arguments: {} });
  try {
    await started;
    const ros = await session.client.callTool({ name: 'tiber_get_ros_schedule_strength', arguments: { team: 'BUF', window: 'next3' } });
    assert.equal((ros.structuredContent as any).reason, 'busy');
    assert.equal((await session.client.callTool({ name: ROLE_TOOL, arguments: roleQuery })).isError, false);
    release(); assert.equal((await pending).isError, false);
    assert.equal((await session.client.callTool({ name: 'tiber_get_ros_schedule_strength', arguments: { team: 'BUF', window: 'next3' } })).isError, false);
  } finally { release(); await pending; await session.close(); }
});

test('synthetic built Worker preserves identity/origin rejection and independent league/ROP kill switches for all three readers', async () => {
  const f = fixture(), output = await mkdtemp(join(tmpdir(), 'tiber-combined-worker-'));
  const originalFetch = globalThis.fetch; let fetches = 0;
  try {
    // Test-only injection exercises private transport composition; it is not the pinned private build or a release replay.
    await build({ entryPoints: ['server/mcp/leagueReaderWorker.ts'], outfile: join(output, 'worker.mjs'),
      bundle: true, platform: 'browser', format: 'esm', target: 'es2022', logLevel: 'silent',
      alias: { '@shared': resolve('shared') }, plugins: [{ name: 'synthetic-role-only', setup(builder) {
        builder.onLoad({ filter: /\/roleEvidence\/privateRoleEvidence\.ts$/ }, () => ({ loader: 'ts',
          contents: `const text = ${JSON.stringify(JSON.stringify(f.artifact))}; export default { release: ${JSON.stringify(f.artifact.release)}, load: () => JSON.parse(text) };` }));
      } }] });
    const worker = (await import(pathToFileURL(join(output, 'worker.mjs')).href)).default;
    globalThis.fetch = async (input, init) => {
      fetches++; assert.equal(init?.redirect, 'manual');
      const url = String(input);
      if (url === SCHEDULE_URL) return new Response(f.csv);
      const paths: Record<string, unknown> = { '/state/nfl': f.state, '/league/10': f.league,
        '/league/10/rosters': f.rosters, '/players/nfl': f.players };
      assert.ok(url.startsWith('https://api.sleeper.app/v1/'));
      const value = paths[url.slice('https://api.sleeper.app/v1'.length)];
      assert.notEqual(value, undefined, url); return Response.json(value);
    };
    const env = { TIBER_LEAGUE_SOURCE: 'public-sleeper', TIBER_PROFILE_USER_ID: '123', TIBER_DEFAULT_LEAGUE_ID: '10',
      TIBER_ROP_SOURCE: 'private-frozen-w01-w05-v2' };
    const request = (name: string, args: object, identity = true, origin = 'https://chatgpt.com') => new Request('https://private.invalid/mcp', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', Origin: origin,
        'mcp-protocol-version': '2025-11-25', ...(identity ? { 'oai-authenticated-user-id': 'synthetic-owner' } : {}) },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }),
    });
    const queries: [string, object][] = [['tiber_get_lineup_context', {}], ['tiber_get_ros_schedule_strength', { team: 'BUF', window: 'next3' }], [ROLE_TOOL, roleQuery]];
    for (const [name, args] of queries) {
      for (const response of [await worker.fetch(request(name, args, false), env), await worker.fetch(request(name, args, true, 'https://untrusted.invalid'), env)]) {
        assert.equal(response.status, 403); assert.equal(response.headers.get('cache-control'), 'no-store');
      }
    }
    assert.equal(fetches, 0);
    const call = async (name: string, args: object, runtime: object) => {
      const response = await worker.fetch(request(name, args), runtime);
      assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store');
      return (await response.json()).result;
    };
    for (const [name, args] of queries) assert.equal((await call(name, args, env)).isError, false);
    const noLeague = { ...env, TIBER_LEAGUE_SOURCE: 'disabled' }, before = fetches;
    for (const [name, args] of queries.slice(0, 2)) assert.equal((await call(name, args, noLeague)).structuredContent.reason, 'source_disabled');
    assert.equal((await call(ROLE_TOOL, roleQuery, noLeague)).isError, false);
    assert.equal(fetches, before);
    const noRole = { ...env, TIBER_ROP_SOURCE: 'disabled' };
    assert.equal((await call(ROLE_TOOL, roleQuery, noRole)).structuredContent.reason, 'source_disabled');
    for (const [name, args] of queries.slice(0, 2)) assert.equal((await call(name, args, noRole)).isError, false);
    const caps = (await call('tiber_league_capabilities', {}, noRole)).structuredContent;
    assert.equal(caps.families.ROP.status, 'unavailable'); assert.ok(caps.withheld.includes('ROP'));
    assert.ok(caps.withheld.includes('TTS')); assert.ok(caps.withheld.includes('Forecast'));
    assert.equal((await call('tiber_get_lineup_context', { userId: '456' }, env)).isError, true);
    assert.equal((await call('unknown_tool', roleQuery, env)).isError, true);
  } finally { globalThis.fetch = originalFetch; await rm(output, { recursive: true, force: true }); }
});

test('runtime ROP marker cannot populate the default Worker or expose a ninth tool', async () => {
  const originalFetch = globalThis.fetch; let fetches = 0;
  globalThis.fetch = async () => { fetches++; throw Error('network_forbidden'); };
  const request = (method: string, params?: object) => new Request('https://private.invalid/mcp', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream',
      'mcp-protocol-version': '2025-11-25', 'oai-authenticated-user-id': 'synthetic-owner' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, ...(params ? { params } : {}) }),
  });
  try {
    const env = { TIBER_ROP_SOURCE: 'private-frozen-w01-w05-v2' };
    const list = await (await publicWorker.fetch(request('tools/list'), env)).json();
    assert.equal(list.result.tools.length, 8);
    assert.equal(list.result.tools.some((t: any) => t.name === ROLE_TOOL), false);
    const caps = await (await publicWorker.fetch(request('tools/call', { name: 'tiber_league_capabilities', arguments: {} }), env)).json();
    assert.equal(caps.result.structuredContent.sourceMode, 'disabled');
    assert.ok(caps.result.structuredContent.withheld.includes('ROP'));
    const absent = await (await publicWorker.fetch(request('tools/call', { name: ROLE_TOOL, arguments: roleQuery }), env)).json();
    assert.equal(absent.result.isError, true);
    assert.equal(fetches, 0);
  } finally { globalThis.fetch = originalFetch; }
});
