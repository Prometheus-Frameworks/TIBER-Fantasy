import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../server/mcp/leagueReaderWorker';
import { readBoundedText } from '../server/integrations/boundedFetch';
import { compileSchedule } from '../server/modules/leagueMcp/schedule';
import { sleeperClient } from '../server/integrations/sleeperClient';
import { getSchedule } from '../server/modules/leagueMcp/schedule';
import { createPersonalReaders } from '../server/modules/leagueMcp/personalContext';
import { createLeagueTools, publicReaders } from '../server/modules/leagueMcp/tools';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { buildLeagueReaderServer } from '../server/mcp/leagueReaderServer';

const request = (body: unknown, headers: Record<string, string> = {}) => new Request('https://private.example/mcp', {
  method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', ...headers }, body: JSON.stringify(body),
});
const call = (name = 'tiber_get_my_leagues', args = {}) => ({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } });

test('installed SDK negotiation preserves the accepted discovery and initialize fallback', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => { throw Error('Discovery must not fetch'); };
  try {
    const response = await worker.fetch(request({ jsonrpc: '2.0', id: 1, method: 'server/discover' }), {});
    const body = await response.json() as any;
    assert.equal(response.status, 200);
    assert.equal(body.error.code, -32601);
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
    const initialized = await worker.fetch(request({ jsonrpc: '2.0', id: 2, method: 'initialize', params: {
      protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'synthetic-test', version: '1' },
    } }), {});
    assert.equal((await initialized.json() as any).result.protocolVersion, '2025-11-25');
    const listed = await worker.fetch(request({ jsonrpc: '2.0', id: 3, method: 'tools/list' }, { 'mcp-protocol-version': '2025-11-25' }), {});
    assert.equal((await listed.json() as any).result.tools.length, 7);
  } finally { globalThis.fetch = original; }
});

test('stalled decoded bodies expire and cancel the stream', async () => {
  let canceled = false;
  const stream = new ReadableStream({ cancel() { canceled = true; } });
  await assert.rejects(readBoundedText(new Response(stream), 100, 5), /deadline/i);
  assert.equal(canceled, true);
});

test('hosted stalled upload returns a no-store deadline response without source reads', async () => {
  let canceled = false;
  const stream = new ReadableStream<Uint8Array>({ cancel() { canceled = true; } });
  const upload = new Request('https://private.example/mcp', { method: 'POST', body: stream, duplex: 'half' } as RequestInit);
  const response = await worker.fetch(upload, { TIBER_LEAGUE_SOURCE: 'public-sleeper', TIBER_PROFILE_USER_ID: '123' });
  assert.equal(response.status, 408); assert.equal(canceled, true);
  assert.deepEqual(await response.json(), { error: 'request_body_deadline' });
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
});

test('decoded limits count UTF-8 bytes, reject invalid encoding and do not wait for cancellation hooks', async () => {
  await assert.rejects(readBoundedText(new Response('ééé'), 5), /limit/);
  await assert.rejects(readBoundedText(new Response(new Uint8Array([0xc3, 0x28])), 10));
  const stream = new ReadableStream({ start(c) { c.enqueue(new Uint8Array(20)); }, cancel() { return new Promise(() => {}); } });
  await assert.rejects(readBoundedText(new Response(stream), 10, 20), /limit/);
});

test('fixed upstream origins reject every redirect status and declared body oversize without a follow-up', async () => {
  const original = globalThis.fetch;
  let reads = 0;
  try {
    for (const status of [301, 302, 303, 307, 308]) {
      globalThis.fetch = async (url, init) => {
        reads++; assert.equal(init?.redirect, 'manual');
        assert.match(String(url), /^https:\/\/(api\.sleeper\.app|raw\.githubusercontent\.com)\//);
        return new Response('untrusted body', { status, headers: { Location: 'https://evil.example/secret' } });
      };
      await assert.rejects(sleeperClient.getManagerNflState());
      await assert.rejects(getSchedule('2026'));
    }
    assert.equal(reads, 10);
    globalThis.fetch = async () => new Response('not parsed', { headers: { 'Content-Length': String(24 * 1024 * 1024 + 1) } });
    await assert.rejects(sleeperClient.getNflPlayers(), /limit/);
    await assert.rejects(sleeperClient.getManagerNflState(), /limit/);
    await assert.rejects(getSchedule('2026'), /limit/);
  } finally { globalThis.fetch = original; }
});

test('complete MCP envelope size includes duplicated text and structured content', async () => {
  const readers = { ...publicReaders, leagues: async () => ({ status: 'available', payload: 'x'.repeat(600_000) }) };
  const server = buildLeagueReaderServer(readers);
  const client = new Client({ name: 'synthetic', version: '1' });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await server.connect(a); await client.connect(b);
  try {
    const result = await client.callTool({ name: 'tiber_list_leagues', arguments: { account: 'synthetic', season: '2026' } });
    assert.equal(result.isError, true);
    assert.deepEqual(result.structuredContent, { status: 'unavailable', reason: 'response_too_large' });
  } finally { await client.close(); await server.close(); }
});

test('non-success cancellation hooks cannot pin the MCP busy slot or schedule in-flight state', async () => {
  const original = globalThis.fetch;
  let reads = 0;
  globalThis.fetch = async () => {
    reads++;
    return new Response(new ReadableStream({ cancel() { return new Promise(() => {}); } }), { status: 503 });
  };
  const read = createLeagueTools({ ...publicReaders, leagues: () => sleeperClient.getManagerNflState() }, 100);
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    for (let i = 0; i < 2; i++) {
      assert.equal((await read('tiber_list_leagues', { account: 'synthetic', season: '2026' })).reason, 'source_unavailable');
      await Promise.race([assert.rejects(getSchedule('2026'), /Schedule unavailable/), new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(Error('Schedule cancellation held the source slot')), 100);
      })]);
      clearTimeout(timer);
    }
    assert.equal(reads, 4);
  } finally { globalThis.fetch = original; if (timer) clearTimeout(timer); }
});

test('personal scope failures reject before directory reads and retain the busy slot while a sibling is pending', async () => {
  const league = { league_id: '10', sport: 'nfl', season: '2026', total_rosters: 1 };
  const rosters = [{ roster_id: 1, owner_id: '123', players: ['100'], starters: ['100'] }];
  let directoryReads = 0;
  const sources: any = { ...publicReaders, getLeague: async () => league, getLeagueRosters: async () => rosters,
    getManagerNflState: async () => ({ season: '2026', season_type: 'regular', leg: 6 }),
    getDirectory: async () => { directoryReads++; throw Error('Must not fetch'); }, getSchedule: async () => { throw Error('Must not fetch'); } };
  const personal = () => createPersonalReaders({ userId: '123', defaultLeagueId: '10' }, sources);
  for (const bad of [{ ...league, league_id: '20' }, { ...league, season: '2025' }, { ...league, total_rosters: 2 }]) {
    sources.getLeague = async () => bad;
    await assert.rejects(personal().lineup({}));
  }
  sources.getLeague = async () => league;
  sources.getLeagueRosters = async () => [{ ...rosters[0], owner_id: '456' }];
  assert.equal((await personal().lineup({})).reason, 'roster_selection_required');
  assert.equal(directoryReads, 0);
  let finish!: (value: unknown) => void;
  sources.getLeague = async () => { throw Error('synthetic failure'); };
  sources.getLeagueRosters = () => new Promise(resolve => { finish = resolve; });
  const read = createLeagueTools({ ...publicReaders, ...personal() }, 5);
  assert.equal((await read('tiber_get_lineup_context', {})).reason, 'deadline');
  assert.equal((await read('tiber_get_lineup_context', {})).reason, 'busy');
  finish(rosters);
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(directoryReads, 0);
});

test('schedule refuses impossible calendar dates before claiming complete coverage', () => {
  const teams = 'ARI ATL BAL BUF CAR CHI CIN CLE DAL DEN DET GB HOU IND JAX KC LAC LAR LV MIA MIN NE NO NYG NYJ PHI PIT SEA SF TB TEN WAS'.split(' ');
  const rows = ['game_id,season,game_type,week,gameday,home_team,away_team'];
  for (let week = 1; week <= 17; week++) for (let i = 0; i < 32; i += 2) {
    rows.push(`SYNTHETIC_${week}_${i},2026,REG,${week},2026-10-01,${teams[i]},${teams[i + 1]}`);
  }
  const csv = rows.join('\n');
  for (const invalid of ['2026-99-99', '2026-02-30', '2026-02-29']) {
    assert.throws(() => compileSchedule(csv.replace('2026-10-01', invalid), '2026', new Date().toISOString()));
  }
});

test('identity-free data calls reject service credentials, email-only and whitespace IDs without fetching', async () => {
  const original = globalThis.fetch;
  let reads = 0;
  globalThis.fetch = async () => { reads++; throw Error('Must not fetch'); };
  const env = { TIBER_LEAGUE_SOURCE: 'public-sleeper', TIBER_PROFILE_USER_ID: '123' };
  try {
    for (const headers of [{}, { 'OAI-Sites-Authorization': 'Bearer synthetic' }, { 'oai-authenticated-user-email': 'synthetic@example.com' }, { 'oai-authenticated-user-id': '   ' }]) {
      const response = await worker.fetch(request(call(), headers), env);
      assert.equal(response.status, 403);
      assert.equal(response.headers.get('Cache-Control'), 'no-store');
    }
    assert.equal(reads, 0);
  } finally { globalThis.fetch = original; }
});

test('same-isolate configuration changes do not reuse a different personal profile', async () => {
  const original = globalThis.fetch;
  const urls: string[] = [];
  globalThis.fetch = async input => {
    const url = String(input); urls.push(url);
    const id = url.match(/\/user\/(\d+)/)?.[1];
    return Response.json(url.endsWith('/leagues/nfl/2026') ? [] : { user_id: id, display_name: `Synthetic ${id}` });
  };
  try {
    for (const userId of ['123', '456', '123']) {
      const response = await worker.fetch(request(call('tiber_get_my_leagues', { season: '2026' }), { 'oai-authenticated-user-id': 'synthetic-owner' }),
        { TIBER_LEAGUE_SOURCE: 'public-sleeper', TIBER_PROFILE_USER_ID: userId });
      const body = await response.json() as any;
      assert.equal(body.result.structuredContent.account.userId, userId);
    }
    assert.equal(urls.length, 6);
    const before = urls.length;
    for (const args of [{ userId: '456' }, { account: '456' }, { profile: { userId: '456' } }, { url: 'https://evil.example' }]) {
      const response = await worker.fetch(request(call('tiber_get_my_leagues', args), { 'oai-authenticated-user-id': 'synthetic-owner' }),
        { TIBER_LEAGUE_SOURCE: 'public-sleeper', TIBER_PROFILE_USER_ID: '123' });
      assert.equal((await response.json() as any).result.isError, true);
    }
    assert.equal(urls.length, before);
  } finally { globalThis.fetch = original; }
});

test('source kill switch, source errors and malformed profile never expose provider error details', async () => {
  const original = globalThis.fetch;
  let reads = 0;
  globalThis.fetch = async () => { reads++; return new Response('synthetic-private-error', { status: 503 }); };
  const headers = { 'oai-authenticated-user-id': 'synthetic-owner' };
  try {
    for (const marker of [undefined, 'disabled', 'public_sleeper']) {
      const response = await worker.fetch(request(call(), headers), { TIBER_LEAGUE_SOURCE: marker, TIBER_PROFILE_USER_ID: '123' });
      assert.equal((await response.json() as any).result.structuredContent.reason, 'source_disabled');
    }
    assert.equal(reads, 0);
    const malformed = await worker.fetch(request(call(), headers), { TIBER_LEAGUE_SOURCE: 'public-sleeper', TIBER_PROFILE_USER_ID: '../other' });
    assert.equal(malformed.status, 503); assert.equal(reads, 0);
    const failed = await worker.fetch(request(call('tiber_get_my_leagues', { season: '2026' }), headers), { TIBER_LEAGUE_SOURCE: 'public-sleeper', TIBER_PROFILE_USER_ID: '123' });
    const body = await failed.json() as any;
    assert.deepEqual(body.result.structuredContent, { status: 'unavailable', reason: 'source_unavailable' });
    assert.equal(JSON.stringify(body).includes('synthetic-private-error'), false);
    assert.equal(reads, 1);
  } finally { globalThis.fetch = original; }
});

test('per-isolate limit admits exactly thirty calls and recovers in a new minute', async () => {
  const original = Date.now;
  let now = original() + 120_000;
  Date.now = () => now;
  try {
    for (let i = 0; i < 30; i++) assert.equal((await worker.fetch(request(call(), { 'oai-authenticated-user-id': 'synthetic-owner' }), {})).status, 200);
    const limited = await worker.fetch(request(call(), { 'oai-authenticated-user-id': 'synthetic-owner' }), {});
    assert.equal(limited.status, 429);
    assert.equal(limited.headers.get('Cache-Control'), 'no-store');
    now += 60_000;
    assert.equal((await worker.fetch(request(call(), { 'oai-authenticated-user-id': 'synthetic-owner' }), {})).status, 200);
    assert.equal((await worker.fetch(request({ jsonrpc: '2.0', id: 1, method: 'tools/list' }), {})).status, 200);
  } finally { Date.now = original; }
});
