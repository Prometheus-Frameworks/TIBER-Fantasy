import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { PUBLIC_TOOL_NAMES, publicContracts } from '../server/modules/publicLeagueMcp/contracts';
import { fixture, select } from './publicLeagueFixtures';

test('fixed six-name registry declares anonymous read-only contracts and honest in-process capabilities', async () => {
  const f = fixture();
  assert.deepEqual(PUBLIC_TOOL_NAMES, ['tiber_public_capabilities', 'tiber_public_list_leagues', 'tiber_public_list_league_rosters',
    'tiber_public_get_roster_context', 'tiber_public_get_lineup_context', 'tiber_public_get_weekly_matchups']);
  for (const c of publicContracts) {
    assert.equal(c.annotations.readOnlyHint, true); assert.equal(c.annotations.destructiveHint, false);
    assert.equal(c.annotations.openWorldHint, c.name !== 'tiber_public_capabilities');
    assert.deepEqual(c.securitySchemes, [{ type: 'noauth' }]);
  }
  const r: any = await f.call('tiber_public_capabilities', {});
  assert.equal(r.schemaVersion, 'tiber_public_league_mcp_v1'); assert.equal(r.stage, 'in_process_contracts');
  assert.equal(r.hostedEndpoint, null); assert.equal(r.productionReady, false);
  for (const field of ['transport', 'sourceActivation', 'globalBudgets', 'persistentCaches']) assert.equal(r[field], 'not_implemented');
  assert.equal(r.clientAcceptance, 'not_tested');
  assert.ok(Object.values(f.calls).every(v => v === 0));
});

test('all malformed inputs and unknown/private names are refused before ANY source read', async () => {
  const f = fixture();
  const valid: Record<string, object> = {
    tiber_public_capabilities: {}, tiber_public_list_leagues: { account: 'synthetic', season: '2026' },
    tiber_public_list_league_rosters: select, tiber_public_get_roster_context: { ...select, rosterId: 1 },
    tiber_public_get_lineup_context: select, tiber_public_get_weekly_matchups: { ...select, week: '7' },
  };
  for (const name of PUBLIC_TOOL_NAMES) for (const bad of [null, [], 1, { ...valid[name], extra: true }]) {
    assert.deepEqual(await f.call(name, bad), { status: 'unavailable', reason: 'invalid_input' });
  }
  for (const bad of [{ userId: 123 }, { leagueId: 10 }, { userId: '1'.repeat(33) }, { leagueId: '' },
    { season: 2026 }, { season: '1999' }, { season: '2026 ' }, { rosterId: '1' }, { rosterId: 0 }, { rosterId: 65 }, { rosterId: 1.5 },
    { week: 8 }, { week: '0' }, { week: '19' }, { week: '08' }, { candidates: ['  '] }, { candidates: ['x'.repeat(121)] },
    { candidates: Array(6).fill('100') }, { candidates: [100] }, { candidates: null }]) {
    assert.deepEqual(await f.call('tiber_public_get_lineup_context', { ...select, ...bad }), { status: 'unavailable', reason: 'invalid_input' });
  }
  for (const key of ['userId', 'leagueId', 'season']) {
    const missing: Record<string, unknown> = { ...select }; delete missing[key];
    assert.equal((await f.call('tiber_public_get_lineup_context', missing) as any).reason, 'invalid_input');
  }
  for (const account of ['', 'a'.repeat(65), 'ümlaut', 'with space', 'https://source.invalid', 123]) {
    assert.equal((await f.call('tiber_public_list_leagues', { account, season: '2026' }) as any).reason, 'invalid_input');
  }
  for (const name of ['unknown', '__proto__', 'constructor', 'tiber_get_lineup_context', 'tiber_get_my_leagues', 'tiber_get_ros_schedule_strength', 'tiber_get_rop_history']) {
    assert.deepEqual(await f.call(name, {}), { status: 'unavailable', reason: 'unknown_tool' });
  }
  assert.ok(Object.values(f.calls).every(v => v === 0));
});

test('all six adapters execute with synthetic injected sources; inherited schema and week semantics survive', async () => {
  const f = fixture();
  const league: any = await f.call('tiber_public_list_leagues', { account: 'synthetic', season: '2026' });
  assert.equal(league.account.userId, '123'); assert.equal(league.selection.supplied.account, 'synthetic');
  const memberships: any = await f.call('tiber_public_list_league_rosters', select);
  assert.equal(memberships.rosters[0].rosterId, 1);
  const roster: any = await f.call('tiber_public_get_roster_context', { ...select, rosterId: 1 });
  assert.equal(roster.schemaVersion, 'tiber_league_roster_context_v1'); assert.equal(roster.roster.directory[0].name, 'Synthetic Starter');
  const lineup: any = await f.call('tiber_public_get_lineup_context', { ...select, candidates: [] });
  assert.equal(lineup.schemaVersion, 'tiber_public_lineup_context_v1'); assert.equal(lineup.selection.basis, 'explicit_account_and_league');
  const matchup: any = await f.call('tiber_public_get_weekly_matchups', { ...select, week: '7' });
  assert.equal(matchup.schemaVersion, 'tiber_manager_week_v1'); assert.equal(matchup.week, 7);
  assert.equal(matchup.rosters[0].points, 0); assert.equal(matchup.rosters[0].outcome, 'tie');
  assert.equal(matchup.finality, 'not_verified'); assert.equal(matchup.recordBasis, 'head_to_head_only');
  const pending: any = await f.call('tiber_public_get_weekly_matchups', { ...select, week: '8' });
  assert.equal(pending.rosters[0].outcome, 'pending');
  for (const r of [league, memberships, roster, lineup, matchup]) {
    assert.equal(r.serviceScope, 'public_explicit_selection'); assert.equal(r.accountControlVerified, false);
  }
  f.league.season = '2025';
  const historical: any = await f.call('tiber_public_get_weekly_matchups', { ...select, season: '2025', week: '7' });
  assert.equal(historical.status, 'available'); assert.equal(historical.rosters[0].outcome, 'unavailable');
  assert.equal((await f.call('tiber_public_get_roster_context', { ...select, season: '2025', rosterId: 1 }) as any).status, 'available');
});

test('semantic mismatches and provider failures are bounded and never expose source payloads', async () => {
  const f = fixture();
  for (const args of [{ ...select, season: '2025' }, { ...select, leagueId: '20' }]) {
    assert.equal((await f.call('tiber_public_list_league_rosters', args) as any).reason, 'source_unavailable');
  }
  assert.equal((await f.call('tiber_public_get_roster_context', { ...select, rosterId: 2 }) as any).reason, 'source_unavailable');
  assert.equal((await f.call('tiber_public_list_leagues', { account: '999', season: '2026' }) as any).reason, 'source_unavailable');
  f.sources.getLeague = async () => { throw Error('PRIVATE_PROVIDER_PAYLOAD'); };
  const r = await f.call('tiber_public_get_roster_context', { ...select, rosterId: 1 });
  assert.equal((r as any).reason, 'source_unavailable'); assert.ok(!JSON.stringify(r).includes('PRIVATE_PROVIDER_PAYLOAD'));
});

test('public runtime module graph cannot reach private wrappers, registries, artifacts or app/database startup', async () => {
  const result = await build({ entryPoints: ['server/modules/publicLeagueMcp/tools.ts'], bundle: true, write: false,
    metafile: true, platform: 'browser', format: 'esm', logLevel: 'silent' });
  const paths = Object.keys(result.metafile!.inputs).filter(p => !p.includes('node_modules'));
  assert.ok(paths.includes('server/modules/leagueMcp/lineupContext.ts'));
  for (const path of paths) assert.doesNotMatch(path,
    /personalContext|leagueMcp\/tools|scheduleStrength|roleEvidence|\/artifacts\/|server\/mcp\/|server\/(?:index|routes|storage)\.|\/db\.|\/init\//);
});

test('missing/null/incomplete runtime source dependencies never activate inherited live defaults', async () => {
  const { createPublicLeagueTools } = await import('../server/modules/publicLeagueMcp/tools');
  const original = globalThis.fetch;
  let fetches = 0;
  globalThis.fetch = async () => { fetches++; throw Error('intercepted forbidden live read'); };
  try {
    const f = fixture();
    const missing = Object.keys(f.sources).map(method => ({ ...f.sources, [method]: undefined }));
    for (const sources of [undefined, null, {}, ...missing]) {
      const call = createPublicLeagueTools(sources as any);
      assert.equal((await call('tiber_public_capabilities', {}) as any).status, 'available');
      for (const [name, args] of [
        ['tiber_public_list_leagues', { account: 'synthetic', season: '2026' }],
        ['tiber_public_list_league_rosters', select],
        ['tiber_public_get_roster_context', { ...select, rosterId: 1 }],
        ['tiber_public_get_lineup_context', select],
        ['tiber_public_get_weekly_matchups', { ...select, week: '7' }],
      ] as const) assert.equal((await call(name, args) as any).reason, 'source_unavailable');
      assert.equal((await call('tiber_public_get_lineup_context', {}) as any).reason, 'invalid_input');
      assert.equal((await call('tiber_get_my_leagues', {}) as any).reason, 'unknown_tool');
    }
    assert.equal(fetches, 0); assert.ok(Object.values(f.calls).every(count => count === 0));
  } finally { globalThis.fetch = original; }
});

test('public username identity is raw ASCII case-insensitive and verified before league expansion', async () => {
  const f = fixture();
  const mismatch: any = await f.call('tiber_public_list_leagues', { account: 'other_manager', season: '2026' });
  assert.equal(mismatch.reason, 'source_unavailable'); assert.equal(f.calls.leagues, 0);
  for (const username of [undefined, null, 'synthetic ', 'synthetic\n', 'synthetic\u202e', 'other_manager']) {
    f.sources.getUser = async () => ({ user_id: '123', display_name: 'synthetic', username } as any);
    assert.equal((await f.call('tiber_public_list_leagues', { account: 'synthetic', season: '2026' }) as any).reason, 'source_unavailable');
    assert.equal(f.calls.leagues, 0);
  }
  f.sources.getUser = async () => ({ user_id: '123', display_name: 'Synthetic', username: 'SyNtHeTiC' });
  assert.equal((await f.call('tiber_public_list_leagues', { account: 'sYnThEtIc', season: '2026' }) as any).status, 'available');
  assert.equal(f.calls.leagues, 1);
});
