import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

test('default built Worker admits only synthetic schedule reads and cannot expose ROP input', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'tiber-default-worker-'));
  const output = join(dir, 'worker.mjs');
  const originalFetch = globalThis.fetch;
  try {
    const receipt = JSON.parse(execFileSync(process.execPath, ['scripts/buildLeagueReaderWorker.mjs', output], { encoding: 'utf8' }).trim());
    assert.equal(receipt.status, 'built');
    assert.equal(receipt.privateInput, false);
    assert.equal(createHash('sha256').update(await readFile(output)).digest('hex'), receipt.sha256);
    const worker = (await import(pathToFileURL(output).href)).default;

    // Fully synthetic 272-game schedule; no retained release or live provider access.
    const teams = 'ARI ATL BAL BUF CAR CHI CIN CLE DAL DEN DET GB HOU IND JAX KC LAC LAR LV MIA MIN NE NO NYG NYJ PHI PIT SEA SF TB TEN WAS'.split(' ');
    const rows = ['game_id,season,game_type,week,gameday,home_team,away_team'];
    for (let week = 1; week <= 17; week++) for (let i = 0; i < teams.length; i += 2) {
      rows.push(`SYNTHETIC_${week}_${i},2026,REG,${week},2026-10-01,${teams[i]},${teams[i + 1]}`);
    }
    const csv = rows.join('\n');
    const csvHash = createHash('sha256').update(csv).digest('hex');
    const reads = [];
    globalThis.fetch = async (input, init) => {
      const url = String(input); reads.push(url);
      assert.equal(init?.redirect, 'manual');
      if (url === 'https://api.sleeper.app/v1/state/nfl') return Response.json({ season: '2026', season_type: 'regular', leg: 7 });
      if (url === 'https://raw.githubusercontent.com/nflverse/nfldata/master/data/games.csv') return new Response(csv);
      throw Error('Unexpected provider in synthetic test');
    };
    const env = { TIBER_LEAGUE_SOURCE: 'public-sleeper', TIBER_PROFILE_USER_ID: '123', TIBER_ROP_SOURCE: 'private-frozen-w01-w05-v2' };
    const request = (method, params, { identity = true, origin = 'https://chatgpt.com' } = {}) => new Request('https://private.invalid/mcp', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', Origin: origin,
        'mcp-protocol-version': '2025-11-25', ...(identity ? { 'oai-authenticated-user-id': 'synthetic-owner' } : {}) },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, ...(params ? { params } : {}) }),
    });
    const callRequest = (name, args, options) => request('tools/call', { name, arguments: args }, options);
    const call = async (name, args, runtime = env) => {
      const response = await worker.fetch(callRequest(name, args), runtime);
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('cache-control'), 'no-store');
      return (await response.json()).result;
    };

    for (const options of [{ identity: false }, { origin: 'https://untrusted.invalid' }]) {
      const refused = await worker.fetch(callRequest('tiber_get_ros_schedule_strength', { team: 'ARI', window: 'next3' }, options), env);
      assert.equal(refused.status, 403);
      assert.equal(refused.headers.get('cache-control'), 'no-store');
    }
    assert.equal(reads.length, 0);
    const list = await (await worker.fetch(request('tools/list'), env)).json();
    assert.equal(list.result.tools.length, 8);
    assert.ok(list.result.tools.some(t => t.name === 'tiber_get_ros_schedule_strength'));
    assert.ok(!list.result.tools.some(t => t.name === 'tiber_get_rop_role_history'));
    assert.ok(list.result.tools.every(t => t.annotations.readOnlyHint === true));
    assert.ok((await call('tiber_league_capabilities', {})).structuredContent.withheld.includes('ROP'));

    const next = (await call('tiber_get_ros_schedule_strength', { team: 'ARI', window: 'next3' })).structuredContent;
    assert.equal(next.capability, 'schedule_only');
    assert.deepEqual(next.window.weeks, [7, 8, 9]);
    assert.equal(next.source.contentHash, csvHash);
    assert.equal(next.ratings.reason, 'no_qualified_defensive_evidence');
    assert.ok(next.window.fixtures.every(f => f.lockState === 'unknown' && f.opponentDefense.rating === null));
    const missing = (await call('tiber_get_ros_schedule_strength', { team: 'ARI', window: 'ros' })).structuredContent;
    assert.equal(missing.window.reason, 'league_final_week_required');
    assert.equal(missing.regularSeasonRemainder.basis, 'decision_week_through_regular_season_end_not_league_final');
    const bounded = (await call('tiber_get_ros_schedule_strength', { team: 'ARI', window: 'ros', finalWeek: '10' })).structuredContent;
    assert.deepEqual(bounded.window.weeks, [7, 8, 9, 10]);
    const bye = (await call('tiber_get_ros_schedule_strength', { team: 'ARI', window: 'custom', startWeek: '18', endWeek: '18' })).structuredContent;
    assert.equal(bye.window.fixtures[0].bye, true);
    assert.equal((await call('tiber_get_ros_schedule_strength', { team: 'ARI', window: 'next3' }, { ...env, TIBER_LEAGUE_SOURCE: 'disabled' })).structuredContent.reason, 'source_disabled');
    assert.equal((await call('tiber_get_rop_role_history', { subject: { namespace: 'nflverse:gsis', id: '00-0000001' }, season: 2026, seasonType: 'REG', weeks: [1] })).isError, true);
    assert.ok(reads.includes('https://api.sleeper.app/v1/state/nfl'));
    assert.ok(reads.includes('https://raw.githubusercontent.com/nflverse/nfldata/master/data/games.csv'));
    assert.ok(reads.every(url => ['https://api.sleeper.app/v1/state/nfl', 'https://raw.githubusercontent.com/nflverse/nfldata/master/data/games.csv'].includes(url)));
  } finally {
    globalThis.fetch = originalFetch;
    await rm(dir, { recursive: true, force: true });
  }
});
