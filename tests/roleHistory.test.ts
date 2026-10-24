import test from 'node:test';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createRoleTools, ROLE_TOOL } from '../server/modules/roleEvidence/roleHistory';
import { createLeagueTools } from '../server/modules/leagueMcp/tools';
import { buildLeagueReaderServer } from '../server/mcp/leagueReaderServer';

// Entirely invented subjects and values. No retained rows or bindings in fixtures.
function synthetic() {
  const id = '00-0000001';
  const rows = [1, 2, 3, 4, 5].map(week => ({ player_id: id, namespace: 'nflverse:gsis',
    season: 2026, season_type: 'REG', week, coverage_status: week === 3 ? 'missing_source_evidence' : 'observed',
    fields: { carries: { value: week === 3 ? null : week === 2 ? 0 : 7,
      status: week === 3 ? 'missing' : 'observed', reason: week === 3 ? 'synthetic_gap' : null } },
    observed_zero_fields: week === 2 ? ['carries'] : [], segments: [],
    state_path: week === 3 ? null : `synthetic/${week}`, finality: 'unknown', correction: 'open', evidence_cutoff: null,
    extra: { clock: '2026-10-01T00:00:00Z', unavailableAdvanced: null } }));
  return { schemaVersion: 'tiber_private_rop_input_v1',
    release: { id: 'TIBER-ROP-2026-W01-W05-Private-Release', version: 2,
      archiveSha256: 'd2bb08b185c7ec73d80480ccc7cbc234ce02d89ac6d57308f6bcfa34ff69af13',
      outputSha256: '7cdfdb96fa5bbb1f6703698b83fe0f142c7498f74043be7bad72d6f5f3e91c49' },
    metadata: { mode: 'synthetic_test_only', limitation: 'not_evidence' },
    catalogue: [{ player_id: id, namespace: 'nflverse:gsis', player_name: 'Synthetic Subject' }], rows,
    states: Object.fromEntries(rows.filter(r => r.state_path).map(r => [r.state_path!, {
      reference: { path: r.state_path, sha256: 'synthetic' }, retained: { state: { subject: 'synthetic' }, binding: { source: 'synthetic' } },
    }])) };
}
const request = { subject: { namespace: 'nflverse:gsis', id: '00-0000001' }, season: 2026, seasonType: 'REG', weeks: [1, 2, 3, 6] };

test('five states: observed, observed zero field, missing source, outside catalogue and outside scope', () => {
  const reader = createRoleTools(synthetic(), true, () => 'synthetic-retrieval');
  const result: any = reader.call(ROLE_TOOL, request);
  assert.deepEqual(result.weeks.map((w: any) => w.status), ['observed', 'observed', 'missing_source_evidence', 'outside_release_scope']);
  assert.equal(result.weeks[0].record.fields.carries.value, 7);
  assert.equal(result.weeks[1].record.fields.carries.value, 0);
  assert.deepEqual(result.weeks[1].observedZeroFields, ['carries']);
  assert.equal(result.weeks[2].record.fields.carries.value, null);
  assert.equal(result.weeks[2].state, null);
  assert.equal(result.weeks[3].record, null);
  const absent: any = reader.call(ROLE_TOOL, { ...request, subject: { namespace: 'nflverse:gsis', id: '00-0000009' } });
  assert.deepEqual(absent.weeks.map((w: any) => w.status), ['outside_catalogue', 'outside_catalogue', 'outside_catalogue', 'outside_release_scope']);
  for (const scope of [{ season: 2025 }, { seasonType: 'POST' }]) {
    const outside: any = reader.call(ROLE_TOOL, { ...request, ...scope });
    assert.ok(outside.weeks.every((w: any) => w.status === 'outside_release_scope'));
  }
});

test('GSIS-only strict schema rejects names, joins, unknown keys, duplicate and excessive weeks', () => {
  const reader = createRoleTools(synthetic(), true);
  for (const raw of [undefined, { ...request, subject: { name: 'Synthetic Subject' } },
    { ...request, subject: { namespace: 'sleeper', id: '1' } },
    { ...request, subject: { ...request.subject, id: '../path' } }, { ...request, sleeperId: '1' },
    { ...request, weeks: [1, 1] }, { ...request, weeks: [1, 2, 3, 4, 5, 6] },
    { ...request, weeks: [0] }, { ...request, weeks: ['1'] }, { ...request, note: 'x'.repeat(3000) }]) {
    assert.equal(reader.call(ROLE_TOOL, raw).reason, 'invalid_input');
  }
});

test('disabled/missing/invalid artifacts fail closed and preserve distinct reason codes', () => {
  assert.equal(createRoleTools(synthetic()).call(ROLE_TOOL, request).reason, 'source_disabled');
  assert.equal(createRoleTools(null, true).call(ROLE_TOOL, request).reason, 'artifact_missing');
  for (const change of [(f: any) => f.release.outputSha256 = 'wrong', (f: any) => f.rows.pop(),
    (f: any) => f.rows.push(f.rows[0]), (f: any) => f.states = {},
    (f: any) => f.rows[0].player_id = '00-0000009']) {
    const f = synthetic(); change(f);
    assert.equal(createRoleTools(f, true).call(ROLE_TOOL, request).reason, 'artifact_invalid');
  }
});

test('retained input, nested fields, state bindings and capability cannot be mutated by callers', () => {
  const f = synthetic(), reader = createRoleTools(f, true);
  const before: any = reader.call(ROLE_TOOL, request);
  assert.deepEqual(before.weeks[0].record, f.rows[0]);
  assert.deepEqual(before.weeks[0].state, f.states['synthetic/1']);
  f.rows[0].fields.carries.value = 99;
  before.weeks[0].record.extra.unavailableAdvanced = 123;
  before.weeks[0].state.retained.binding.source = 'changed';
  (reader.capability as any).release.outputSha256 = 'changed';
  const after: any = reader.call(ROLE_TOOL, request);
  assert.equal(after.weeks[0].record.fields.carries.value, 7);
  assert.equal(after.weeks[0].record.extra.unavailableAdvanced, null);
  assert.equal(after.weeks[0].state.retained.binding.source, 'synthetic');
  assert.equal(after.release.outputSha256, synthetic().release.outputSha256);
});

test('unknown and ROP names never reach matchup reader, even with valid matchup args', async () => {
  let calls = 0;
  const league = createLeagueTools({ leagues: async () => ({}), memberships: async () => ({}), roster: async () => ({}),
    matchups: async () => { calls++; return { status: 'available' }; } });
  const args = { userId: '123', leagueId: '10', season: '2026', week: '1' };
  for (const name of [ROLE_TOOL, 'unknown', '__proto__', 'constructor', 'toString']) {
    assert.equal((await league(name, args)).reason, 'unknown_tool');
  }
  assert.equal(createRoleTools(synthetic(), true).call('tiber_get_weekly_matchups', args).reason, 'unknown_tool');
  assert.equal(calls, 0);
  await league('tiber_get_weekly_matchups', args);
  assert.equal(calls, 1);
});

test('real MCP discovers separate read-only ROP schema, GSIS-only call and accurate capabilities', async () => {
  let matchupCalls = 0;
  const server = buildLeagueReaderServer(null, async name => {
    if (name === 'tiber_get_weekly_matchups') matchupCalls++;
    return { status: 'available', sourceMode: 'disabled', withheld: ['ROP', 'TTS', 'Forecast'] };
  }, createRoleTools(synthetic(), true));
  const client = new Client({ name: 'synthetic-role-test', version: '1' });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await server.connect(a); await client.connect(b);
  try {
    const list = await client.listTools();
    const tool = list.tools.find(t => t.name === ROLE_TOOL)!;
    assert.equal(list.tools.length, 9);
    assert.equal(tool.annotations?.readOnlyHint, true);
    assert.equal(tool.inputSchema.additionalProperties, false);
    const result = await client.callTool({ name: ROLE_TOOL, arguments: request });
    assert.equal(result.isError, false);
    assert.deepEqual(JSON.parse((result.content as any)[0].text), result.structuredContent);
    const caps: any = (await client.callTool({ name: 'tiber_league_capabilities', arguments: {} })).structuredContent;
    assert.equal(caps.families.ROP.sourceMode, 'private_frozen_release');
    assert.deepEqual(caps.withheld, ['TTS', 'Forecast']);
    for (const name of ['unknown', 'constructor']) assert.equal((await client.callTool({ name, arguments: request })).isError, true);
    assert.equal((await client.callTool({ name: ROLE_TOOL, arguments: { ...request, name: 'someone' } })).isError, true);
    assert.equal(matchupCalls, 0);
  } finally { await client.close(); await server.close(); }
});

test('full MCP envelope bound includes duplicated text/structured ROP data', async () => {
  const f = synthetic(); (f.rows[0].extra as any).large = 'x'.repeat(510000);
  const server = buildLeagueReaderServer(null, createLeagueTools(), createRoleTools(f, true));
  const client = new Client({ name: 'synthetic-size-test', version: '1' });
  const [a, b] = InMemoryTransport.createLinkedPair(); await server.connect(a); await client.connect(b);
  try {
    const r: any = await client.callTool({ name: ROLE_TOOL, arguments: { ...request, weeks: [1] } });
    assert.equal(r.isError, true); assert.equal(r.structuredContent.reason, 'response_too_large');
    assert.ok(JSON.stringify(r).length < 1000);
  } finally { await client.close(); await server.close(); }
});

// Build-bound source shape with a counting loader; same synthetic data only.
function source(make: () => unknown = synthetic, release: Record<string, unknown> = synthetic().release) {
  const s = { loads: 0, release, load: () => { s.loads++; return make(); } };
  return s;
}

test('module construction, disabled, discovery, league, unknown and invalid calls never load the artifact', async () => {
  const on = source(), off = source();
  const role = createRoleTools(on, true), disabled = createRoleTools(off, false);
  assert.equal(role.capability.status, 'available'); assert.equal(role.capability.validation, 'deferred');
  assert.equal(role.capability.release.outputSha256, synthetic().release.outputSha256);
  assert.equal(disabled.call(ROLE_TOOL, request).reason, 'source_disabled');
  assert.equal(disabled.capability.status, 'unavailable');
  assert.equal(role.call(ROLE_TOOL, { ...request, weeks: [1, 1] }).reason, 'invalid_input');
  assert.equal(role.call('tiber_get_weekly_matchups', request).reason, 'unknown_tool');
  const server = buildLeagueReaderServer(null, createLeagueTools(), role);
  const client = new Client({ name: 'synthetic-lazy-test', version: '1' });
  const [a, b] = InMemoryTransport.createLinkedPair(); await server.connect(a); await client.connect(b);
  try {
    await client.listTools();
    const c: any = (await client.callTool({ name: 'tiber_league_capabilities', arguments: {} })).structuredContent;
    assert.equal(c.families.ROP.status, 'available'); assert.equal(c.families.ROP.validation, 'deferred');
    await client.callTool({ name: 'tiber_get_weekly_matchups', arguments: { userId: '123', leagueId: '10', season: '2026', week: '1' } });
    for (const name of ['unknown', 'constructor']) await client.callTool({ name, arguments: request });
    await client.callTool({ name: ROLE_TOOL, arguments: { ...request, name: 'someone' } });
  } finally { await client.close(); await server.close(); }
  assert.equal(on.loads + off.loads, 0);
});

test('first valid enabled call initializes once, later calls reuse it and the kill switch still refuses', () => {
  const s = source(), role = createRoleTools(s, true, () => 'synthetic-retrieval');
  const first: any = role.call(ROLE_TOOL, request);
  first.weeks[0].record.fields.carries.value = 99;
  const second: any = role.call(ROLE_TOOL, request);
  assert.equal(s.loads, 1); assert.equal(second.weeks[0].record.fields.carries.value, 7);
  assert.equal(role.capability.validation, 'passed');
  assert.equal(createRoleTools(s, false).call(ROLE_TOOL, request).reason, 'source_disabled');
  assert.equal(s.loads, 1);
});

test('initialization errors and a release differing from the build binding fail closed without retry', () => {
  const truncated = () => { const f = synthetic(); f.rows.pop(); return f; };
  for (const s of [source(() => { throw Error('synthetic'); }), source(truncated),
    source(synthetic, { ...synthetic().release, version: 3 })]) {
    const role = createRoleTools(s, true);
    for (let i = 0; i < 2; i++) assert.equal(role.call(ROLE_TOOL, request).reason, 'artifact_invalid');
    assert.equal(s.loads, 1);
    assert.equal(role.capability.status, 'unavailable'); assert.equal(role.capability.validation, 'failed');
    assert.equal('release' in role.capability, false);
  }
});

test('disabled ROP remains withheld in composed discovery', async () => {
  const server = buildLeagueReaderServer(null, createLeagueTools(), createRoleTools(synthetic(), false));
  const client = new Client({ name: 'synthetic-disabled-test', version: '1' });
  const [a, b] = InMemoryTransport.createLinkedPair(); await server.connect(a); await client.connect(b);
  try {
    const r: any = await client.callTool({ name: ROLE_TOOL, arguments: request });
    assert.equal(r.structuredContent.reason, 'source_disabled');
    const c: any = (await client.callTool({ name: 'tiber_league_capabilities', arguments: {} })).structuredContent;
    assert.ok(c.withheld.includes('ROP')); assert.equal(c.families.ROP.status, 'unavailable');
  } finally { await client.close(); await server.close(); }
});
