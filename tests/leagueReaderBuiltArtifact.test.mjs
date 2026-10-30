import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

test('default built Worker admits only synthetic schedule reads and cannot expose ROP input', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'tiber-default-worker-'));
  const output = join(dir, 'worker.mjs');
  const originalFetch = globalThis.fetch;
  try {
    const receipt = JSON.parse(execFileSync(process.execPath, ['scripts/buildLeagueReaderWorker.mjs', output], { encoding: 'utf8' }).trim());
    assert.equal(receipt.status, 'built');
    assert.equal(receipt.privateInput, false);
    assert.equal(createHash('sha256').update(await readFile(output)).digest('hex'), receipt.sha256);
    t.diagnostic(`Default Worker build: ${JSON.stringify(receipt)}`);
    // Fully synthetic 272-game schedule; no retained release or live provider access.
    const teams = 'ARI ATL BAL BUF CAR CHI CIN CLE DAL DEN DET GB HOU IND JAX KC LAC LAR LV MIA MIN NE NO NYG NYJ PHI PIT SEA SF TB TEN WAS'.split(' ');
    const rows = ['game_id,season,game_type,week,gameday,home_team,away_team'];
    for (let week = 1; week <= 17; week++) for (let i = 0; i < teams.length; i += 2) {
      // Move one pairing to week 18 so ARI has a bye inside next3, not just at its end.
      const fixtureWeek = week === 8 && i === 0 ? 18 : week;
      rows.push(`SYNTHETIC_${week}_${i},2026,REG,${fixtureWeek},2026-10-01,${teams[i]},${teams[i + 1]}`);
    }
    const csv = rows.join('\n');
    const csvHash = createHash('sha256').update(csv).digest('hex');
    const reads = [];
    const stateUrl = 'https://api.sleeper.app/v1/state/nfl';
    const scheduleUrl = 'https://raw.githubusercontent.com/nflverse/nfldata/master/data/games.csv';
    const leagueUrl = 'https://api.sleeper.app/v1/league/10';
    const directoryUrl = 'https://api.sleeper.app/v1/players/nfl';
    const allowedUrls = [stateUrl, scheduleUrl, leagueUrl, `${leagueUrl}/rosters`, directoryUrl];
    let scheduleResponse = () => new Response(csv);
    // Install the deny-by-default provider stub before importing the built module.
    globalThis.fetch = async (input, init) => {
      const url = String(input); reads.push(url);
      assert.equal(init?.redirect, 'manual');
      if (url === stateUrl) return Response.json({ season: '2026', season_type: 'regular', leg: 7 });
      if (url === scheduleUrl) return scheduleResponse();
      if (url === leagueUrl) return Response.json({ league_id: '10', sport: 'nfl', season: '2026', total_rosters: 1,
        roster_positions: ['WR'], scoring_settings: { rec: 1, bonus_rec_te: 0 }, settings: { playoff_week_start: 15 } });
      if (url === `${leagueUrl}/rosters`) return Response.json([{ roster_id: 1, owner_id: '123', players: [], starters: [] }]);
      if (url === directoryUrl) return Response.json({});
      throw Error('Unexpected provider in synthetic test');
    };
    const worker = (await import(pathToFileURL(output).href)).default;
    assert.equal(reads.length, 0, 'module import must not read providers');
    const env = { TIBER_LEAGUE_SOURCE: 'public-sleeper', TIBER_PROFILE_USER_ID: '123', TIBER_ROP_SOURCE: 'private-frozen-w01-w05-v2' };
    const request = (method, params, { identity = 'synthetic-owner', origin = 'https://chatgpt.com' } = {}) => new Request('https://private.invalid/mcp', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', Origin: origin,
        'mcp-protocol-version': '2025-11-25', ...(identity === null ? {} : { 'oai-authenticated-user-id': identity }) },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, ...(params ? { params } : {}) }),
    });
    const callRequest = (name, args, options) => request('tools/call', { name, arguments: args }, options);
    const call = async (name, args, runtime = env, target = worker) => {
      const response = await target.fetch(callRequest(name, args), runtime);
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('cache-control'), 'no-store');
      const envelope = await response.json();
      assert.equal(envelope.error, undefined);
      assert.ok(envelope.result);
      return envelope.result;
    };

    for (const options of [{ identity: null }, { identity: '   ' }, { origin: 'https://untrusted.invalid' }]) {
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
    assert.equal(reads.length, 0, 'discovery must not read providers');

    const ros = async (args, runtime = env, target = worker) =>
      (await call('tiber_get_ros_schedule_strength', { team: 'ARI', window: 'next3', ...args }, runtime, target)).structuredContent;
    const witness = (result, metric, reason, weeks) => {
      const item = result.missingWitnesses.find(w => w.scope.metric === metric);
      assert.ok(item, `missing witness: ${metric}`);
      assert.equal(item.reason, reason);
      assert.deepEqual(item.scope.weeks, weeks);
      assert.equal(item.sourceRef, null);
      assert.ok(item.evidenceNeeded.length > 0);
    };
    const unknowns = window => {
      // Prevent vacuous every() assertions over an empty fixture list.
      assert.deepEqual(window.fixtures.map(f => f.week), window.weeks);
      assert.ok(window.fixtures.length > 0);
      assert.equal(window.counts.eligibleGames, null);
      assert.equal(window.counts.ratedGames, null);
      for (const fixture of window.fixtures) {
        for (const key of ['lockState', 'completion', 'postponement', 'venue']) assert.equal(fixture[key], 'unknown');
        assert.equal(fixture.kickoff, null);
        assert.deepEqual(fixture.opponentDefense, fixture.bye ? null
          : { rating: null, reason: 'no_qualified_defensive_evidence', cutoff: null });
      }
    };

    const next = await ros({});
    assert.equal(next.status, 'available');
    assert.equal(next.capability, 'schedule_only');
    assert.equal(next.window.status, 'available');
    assert.deepEqual(next.window.weeks, [7, 8, 9]);
    assert.deepEqual(next.window.fixtures.map(f => f.bye), [false, true, false]);
    assert.deepEqual(next.window.counts, { weeks: 3, scheduledGames: 2, byes: 1, eligibleGames: null, ratedGames: null });
    assert.equal(next.window.fixtures[1].opponent, null);
    assert.equal(next.window.fixtures[1].gameId, null);
    assert.equal(next.source.contentHash, csvHash);
    assert.equal(next.source.url, scheduleUrl);
    assert.equal(next.source.hashConvention, 'sha256_hex_utf8_decoded_text_v1');
    assert.equal(next.source.retrievedAt, next.clocks.scheduleRetrievedAt);
    for (const key of ['decisionTime', 'scheduleRetrievedAt', 'nflStateReceivedAt']) assert.ok(Number.isFinite(Date.parse(next.clocks[key])));
    assert.equal(next.clocks.defensiveStatisticsCutoff, null);
    assert.deepEqual(next.ratings, { source: null, status: 'unavailable', reason: 'no_qualified_defensive_evidence', cutoff: null, methodVersion: null });
    unknowns(next.window);
    witness(next, 'opponent_defense_rating', 'no_qualified_defensive_evidence', [7, 9]);
    witness(next, 'lock_state', 'not_inspected', [7, 9]);
    const missing = await ros({ window: 'ros' });
    assert.equal(missing.window.status, 'unavailable');
    assert.equal(missing.window.reason, 'league_final_week_required');
    assert.deepEqual(missing.window.weeks, []);
    assert.deepEqual(missing.window.fixtures, []);
    assert.equal(missing.calendar.finalWeek, null);
    witness(missing, 'league_final_week', 'not_inspected', null);
    assert.equal(missing.regularSeasonRemainder.basis, 'decision_week_through_regular_season_end_not_league_final');
    assert.deepEqual(missing.regularSeasonRemainder.weeks, Array.from({ length: 12 }, (_, i) => i + 7));
    unknowns(missing.regularSeasonRemainder);
    const bounded = await ros({ window: 'ros', finalWeek: '10' });
    assert.deepEqual(bounded.window.weeks, [7, 8, 9, 10]);
    unknowns(bounded.window);
    assert.equal(bounded.calendar.finalWeekBasis, 'caller_supplied');
    const clipped = await ros({ finalWeek: '8' });
    assert.deepEqual(clipped.window.weeks, [7, 8]);
    assert.equal(clipped.window.clampedBy, 'caller_supplied_final_week');
    const late = await ros({ week: '17' });
    assert.deepEqual(late.window.weeks, [17, 18]);
    assert.equal(late.window.clampedBy, 'regular_season_end');
    const bye = await ros({ window: 'custom', startWeek: '8', endWeek: '8' });
    assert.deepEqual(bye.window.weeks, [8]);
    assert.equal(bye.window.fixtures[0].bye, true);
    unknowns(bye.window);
    const unknownPlayoffs = await ros({ window: 'playoffs', finalWeek: '17' });
    assert.equal(unknownPlayoffs.window.reason, 'playoff_start_unknown');
    witness(unknownPlayoffs, 'league_playoff_start', 'not_inspected', null);
    const playoffs = await ros({ window: 'playoffs', leagueId: '10', finalWeek: '17' });
    assert.deepEqual(playoffs.window.weeks, [15, 16, 17]);
    assert.deepEqual(playoffs.calendar.playoffStart, { status: 'verified', value: 15 });
    assert.deepEqual(playoffs.scoring.settings, { rec: 1, bonus_rec_te: 0 });
    unknowns(playoffs.window);
    const missingPlayoffFinal = await ros({ window: 'playoffs', leagueId: '10' });
    assert.equal(missingPlayoffFinal.window.reason, 'league_final_week_required');
    witness(missingPlayoffFinal, 'league_final_week', 'not_inspected', null);

    const beforeRefusals = reads.length;
    for (const source of ['disabled', undefined]) {
      assert.equal((await ros({}, { ...env, TIBER_LEAGUE_SOURCE: source })).reason, 'source_disabled');
      assert.equal(reads.length, beforeRefusals, 'disabled source must not read providers');
    }
    for (const args of [{ sourceUrl: 'https://untrusted.invalid' }, { userId: '456' }, { finalWeek: '19' }]) {
      assert.equal((await call('tiber_get_ros_schedule_strength', { team: 'ARI', window: 'next3', ...args })).isError, true);
      assert.equal(reads.length, beforeRefusals, 'invalid selectors must not read providers');
    }
    for (const marker of [env.TIBER_ROP_SOURCE, undefined]) {
      const runtime = { ...env, TIBER_ROP_SOURCE: marker };
      const listed = await (await worker.fetch(request('tools/list'), runtime)).json();
      assert.equal(listed.result.tools.length, 8);
      assert.ok(!listed.result.tools.some(t => t.name === 'tiber_get_rop_role_history'));
      assert.equal((await call('tiber_get_rop_role_history', { subject: { namespace: 'nflverse:gsis', id: '00-0000001' }, season: 2026, seasonType: 'REG', weeks: [1] }, runtime)).isError, true);
      assert.equal(reads.length, beforeRefusals, 'absent ROP must not fall through to providers');
    }

    // Fresh bundle instances prevent a previously cached complete schedule from masking failures.
    for (const [name, response] of [
      ['incomplete', () => new Response(rows.slice(0, -1).join('\n'))],
      ['redirect', () => new Response(null, { status: 302, headers: { Location: 'https://untrusted.invalid/schedule' } })],
    ]) {
      scheduleResponse = response;
      const fresh = (await import(`${pathToFileURL(output).href}?case=${name}`)).default;
      const before = reads.length;
      const refused = await ros({}, env, fresh);
      assert.equal(refused.reason, 'schedule_unavailable');
      assert.equal(refused.window, undefined, 'unverified coverage must not invent fixtures or byes');
      assert.deepEqual(reads.slice(before), [stateUrl, scheduleUrl]);
    }
    assert.ok(reads.includes(stateUrl));
    assert.ok(reads.includes(scheduleUrl));
    assert.ok(reads.every(url => allowedUrls.includes(url)));
  } finally {
    globalThis.fetch = originalFetch;
    await rm(dir, { recursive: true, force: true });
  }
});
