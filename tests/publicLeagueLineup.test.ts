import test from 'node:test';
import assert from 'node:assert/strict';
import { createPublicLeagueTools } from '../server/modules/publicLeagueMcp/tools';
import { createPersonalReaders } from '../server/modules/leagueMcp/personalContext';
import { fixture, select, NOW, deferred, schedule } from './publicLeagueFixtures';
const lineup = 'tiber_public_get_lineup_context';

test('current-season lineup preserves slots, separate buckets, scoring zeroes, FAAB and current starter meaning', async () => {
  const f = fixture();
  const r: any = await f.call(lineup, { ...select, candidates: [' 102 ', '100', '103'] });
  assert.equal(r.status, 'available'); assert.equal(r.week, 8);
  assert.equal(r.selection.basis, 'explicit_account_and_league'); assert.equal(r.selection.resolved.rosterId, 1);
  assert.equal(r.startersBasis, 'currently_observed_roster_starters'); assert.equal(r.historicalLineupVerified, false);
  assert.equal(r.lineup[1].slot, 'TE'); assert.equal(r.lineup[1].playerId, null);
  assert.deepEqual(r.roster.reserve, ['104']); assert.deepEqual(r.roster.taxi, ['105']);
  assert.equal(r.roster.directory.find((p: any) => p.playerId === '101').starting, false);
  assert.equal(r.league.scoring.bonus_rec_te, 0); assert.equal(r.waiverSettings.derived.faab_remaining, 79);
  assert.deepEqual(r.candidates.map((c: any) => c.availability), ['unrostered', 'on_selected_roster', 'rostered_elsewhere']);
  assert.deepEqual(r.candidates.map((c: any) => c.membership.status), ['not_observed_in_complete_census', 'on_selected_roster', 'rostered_elsewhere']);
  assert.equal(r.candidates[0].query, '102');
  assert.ok(r.candidates.every((c: any) => c.claimEligibility === 'unknown'));
  assert.deepEqual(f.calls, { league: 1, rosters: 1, directory: 1, state: 1, schedule: 1, user: 0, leagues: 0, matchups: 0 });
  const explicit: any = await f.call(lineup, { ...select, week: '2' });
  assert.equal(explicit.week, 2); assert.equal(explicit.historicalLineupVerified, false); assert.equal(f.calls.state, 2);
  assert.equal(f.calls.league, 2); assert.equal(f.calls.directory, 2);
});

test('fresh season state gates even explicit weeks before directory/schedule reads and never reuses prior state', async () => {
  const f = fixture();
  await f.call(lineup, { ...select, week: '8' });
  f.sources.getManagerNflState = async () => { f.calls.state++; return { season: '2027', season_type: 'regular', leg: 1 }; };
  const r: any = await f.call(lineup, { ...select, week: '8' });
  assert.equal(r.reason, 'current_season_required'); assert.equal(r.observations.nflState.season, '2027');
  assert.deepEqual(r.selection.resolved, {}); assert.equal(r.selection.supplied.week, '8');
  assert.equal(f.calls.state, 2); assert.equal(f.calls.directory, 1); assert.equal(f.calls.schedule, 1);
  f.sources.getManagerNflState = async () => { f.calls.state++; throw Error('private failure'); };
  const unavailable: any = await f.call(lineup, { ...select, week: '8' });
  assert.equal(unavailable.reason, 'nfl_state_unavailable'); assert.equal(unavailable.observations.nflState, null);
  assert.equal(f.calls.directory, 1); assert.equal(f.calls.schedule, 1); assert.equal(f.calls.state, 3);
});

for (const [phase, leg] of [['pre', 1], ['post', 19], ['regular', 0], ['regular', 19], ['regular', 22]] as const) {
  test(`implicit week requires a decision week for ${phase}/${leg}, explicit week remains decision context`, async () => {
    const f = fixture(); f.sources.getManagerNflState = async () => ({ season: '2026', season_type: phase, leg });
    const r: any = await f.call(lineup, select);
    assert.equal(r.reason, 'decision_week_required'); assert.equal(r.week, undefined);
    assert.equal(r.selection.resolved.week, undefined); assert.equal(f.calls.directory, 0); assert.equal(f.calls.schedule, 0);
    const explicit: any = await f.call(lineup, { ...select, week: '18' });
    assert.equal(explicit.status, 'available'); assert.equal(explicit.week, 18);
    assert.equal(explicit.roster.directory[0].onBye, true); assert.equal(explicit.historicalLineupVerified, false);
  });
}

test('owner/co-owner choices are exact, fresh, and never silently choose the first of multiple rosters', async () => {
  const f = fixture();
  const coOwner: any = await f.call(lineup, { ...select, userId: '789' });
  assert.equal(coOwner.membership, 'co_owner'); assert.equal(coOwner.rosterId, 1);
  f.rosters[1].co_owners = ['123'];
  const ambiguous: any = await f.call(lineup, select);
  assert.equal(ambiguous.reason, 'roster_selection_required'); assert.equal(ambiguous.choices.length, 2);
  assert.equal(ambiguous.selection.resolved.rosterId, undefined);
  assert.equal((await f.call(lineup, { ...select, rosterId: 2 }) as any).rosterId, 2);
  f.rosters[1].co_owners = [];
  const mismatch: any = await f.call(lineup, { ...select, rosterId: 2 });
  assert.equal(mismatch.reason, 'roster_selection_required'); assert.equal(mismatch.selection.resolved.rosterId, undefined);
  assert.equal((await f.call(lineup, { ...select, userId: '999' }) as any).choices.length, 0);
  f.league.season = '2025';
  assert.equal((await f.call(lineup, select) as any).reason, 'source_unavailable');
  assert.equal(f.calls.directory, 2); assert.equal(f.calls.schedule, 2);
});

test('interleaved managers through one adapter retain their accounts, rosters, sources and times', async () => {
  const f = fixture(), aLeague = deferred<any>(), aStarted = deferred<void>();
  f.sources.getLeague = async id => { f.calls.league++; if (id === '10') { aStarted.resolve(); return aLeague.promise; }
    return { ...f.league, league_id: '20', name: 'Synthetic B' }; };
  f.sources.getLeagueRosters = async id => { f.calls.rosters++; return id === '10' ? f.rosters
    : f.rosters.map((r, i) => ({ ...r, league_id: '20', owner_id: i ? '888' : '456', co_owners: [], players: i ? ['103'] : ['102'], starters: i ? ['103'] : ['102'], reserve: [], taxi: [] })); };
  const a = f.call(lineup, { ...select, candidates: ['100'] });
  await aStarted.promise; f.setTime(NOW + 10_000);
  const b: any = await f.call(lineup, { ...select, userId: '456', leagueId: '20', candidates: ['102'] });
  assert.equal(b.league.name, 'Synthetic B'); assert.equal(b.accountUserId, '456'); assert.equal(b.roster.players[0], '102');
  f.setTime(NOW + 20_000); aLeague.resolve(f.league);
  const resultA: any = await a;
  assert.equal(resultA.leagueId, '10'); assert.equal(resultA.accountUserId, '123'); assert.equal(resultA.roster.players[0], '100');
  assert.equal(resultA.candidates[0].membership.status, 'on_selected_roster'); assert.equal(b.candidates[0].membership.status, 'on_selected_roster');
  assert.equal(resultA.observations.leagueReceivedAt, new Date(NOW + 20_000).toISOString());
  assert.equal(b.observations.leagueReceivedAt, new Date(NOW + 10_000).toISOString());
  assert.equal(f.calls.league, 2); assert.equal(f.calls.rosters, 2); assert.equal(f.calls.directory, 2);
});

test('source errors settle started siblings before returning a failure', async () => {
  const f = fixture(), rosters = deferred<any>(), started = deferred<void>();
  f.sources.getLeague = async () => { throw Error('outage'); };
  f.sources.getLeagueRosters = async () => { started.resolve(); return rosters.promise; };
  let finished = false;
  const pending = f.call(lineup, select).then(r => { finished = true; return r; });
  await started.promise; await new Promise(resolve => setImmediate(resolve));
  assert.equal(finished, false); rosters.resolve(f.rosters);
  assert.equal((await pending as any).reason, 'source_unavailable'); assert.equal(f.calls.directory, 0);
});

test('numeric membership survives directory failure; names and census absence never become unrostered', async () => {
  const f = fixture(); f.sources.getDirectory = async () => { f.calls.directory++; throw Error('outage'); };
  const r: any = await f.call(lineup, { ...select, candidates: ['100', '103', '102', 'Synthetic Starter', '1'.repeat(25)] });
  assert.equal(r.status, 'available'); assert.equal(r.roster.directory[0].name, null);
  assert.deepEqual(r.candidates.map((c: any) => c.membership.status), ['on_selected_roster', 'rostered_elsewhere', 'not_observed_in_complete_census', 'unknown', 'unknown']);
  assert.ok(r.candidates.every((c: any) => c.status === 'unavailable' && c.availability === undefined));
  assert.equal(r.waiverSettings, null); assert.equal(f.calls.directory, 1);
});

test('conflicting ownership or incomplete census never yields public positive/absence classification', async () => {
  const f = fixture(); f.rosters[1].players.push('100');
  let r: any = await f.call(lineup, { ...select, candidates: ['100', '102', '103'] });
  assert.equal(r.status, 'available'); assert.equal(r.observations.census.reason, 'conflicting_ownership');
  assert.ok(r.candidates.every((c: any) => c.membership.status === 'unknown' && c.availability === undefined));
  assert.equal(r.roster.players[0], '100');
  f.rosters[1].players = undefined as any;
  r = await f.call(lineup, { ...select, candidates: ['100', '102', '103'] });
  assert.equal(r.status, 'unavailable'); assert.ok(r.candidates.every((c: any) => c.membership.status === 'unknown'));
  f.league.total_rosters = 3;
  r = await f.call(lineup, { ...select, candidates: ['100', '102'] });
  assert.ok(r.candidates.every((c: any) => c.membership.status === 'unknown')); assert.equal(r.selection.resolved.rosterId, undefined);
});

test('candidate identity requires exact ID/outer-key agreement, active pool and bounded name resolution', async () => {
  const f = fixture(); f.players['102'].player_id = '999';
  let r: any = await f.call(lineup, { ...select, candidates: ['102'] });
  assert.equal(r.candidates[0].status, 'unavailable'); assert.equal(r.candidates[0].membership.status, 'not_observed_in_complete_census');
  f.players['102'].player_id = '102'; f.players['102'].active = false;
  r = await f.call(lineup, { ...select, candidates: ['102'] }); assert.equal(r.candidates[0].availability, 'not_in_active_candidate_pool');
  f.players['102'].active = true;
  for (let i = 200; i < 212; i++) f.players[String(i)] = { ...f.players['102'], player_id: String(i) };
  r = await f.call(lineup, { ...select, candidates: ['synthetic-candidate', 'Synthetic Cand', '102'] });
  assert.equal(r.candidates[0].reason, 'ambiguous_player'); assert.equal(r.candidates[0].matchCount, 13); assert.equal(r.candidates[0].matches.length, 10);
  assert.equal(r.candidates[1].reason, 'player_not_found'); assert.equal(r.candidates[2].availability, 'unrostered');
  f.players['102'].full_name = 'Synthetic\u202e Candidate';
  r = await f.call(lineup, { ...select, candidates: ['102'] }); assert.equal(r.candidates[0].name, 'Synthetic Candidate');
});

test('all source acquisition times survive reuse and compilation independently', async () => {
  const f = fixture();
  const league = deferred<any>(), rosters = deferred<any>(), started = deferred<void>();
  f.sources.getLeague = () => league.promise;
  f.sources.getLeagueRosters = () => { started.resolve(); return rosters.promise; };
  const pending = f.call(lineup, { ...select, candidates: ['102'] });
  await started.promise;
  f.setTime(NOW + 1000); league.resolve(f.league); await new Promise(resolve => setImmediate(resolve));
  f.setTime(NOW + 2000); rosters.resolve(f.rosters);
  f.sources.getSchedule = async () => { f.setTime(NOW + 10_000); return schedule(); };
  const r: any = await pending;
  assert.equal(r.observations.nflState.receivedAt, new Date(NOW).toISOString());
  assert.equal(r.observations.leagueReceivedAt, new Date(NOW + 1000).toISOString());
  assert.equal(r.observations.rostersReceivedAt, new Date(NOW + 2000).toISOString());
  assert.equal(r.observations.availability.league_received_at, r.observations.leagueReceivedAt);
  assert.equal(r.observations.availability.rosters_received_at, r.observations.rostersReceivedAt);
  assert.equal(r.observations.directoryReceivedAt, new Date(NOW - 2000).toISOString());
  assert.equal(r.observations.schedule.receivedAt, new Date(NOW - 1000).toISOString());
  assert.equal(r.candidates[0].membership.rostersReceivedAt, r.observations.rostersReceivedAt);
});

for (const acquired of [NOW - 86_400_000, NOW - 86_400_001, NOW + 1, NaN, Infinity]) {
  test(`invalid/stale directory clock ${acquired} withholds enrichment, preserves numeric census`, async () => {
    const f = fixture(); f.sources.getDirectory = async () => ({ fetchedAt: acquired, players: f.players });
    const r: any = await f.call(lineup, { ...select, candidates: ['100', '102', 'Synthetic Starter'] });
    assert.equal(r.roster.directory[0].name, null); assert.equal(r.observations.references.directory.status, 'unavailable');
    assert.equal(r.candidates[0].membership.status, 'on_selected_roster'); assert.equal(r.candidates[1].membership.status, 'not_observed_in_complete_census');
    assert.equal(r.candidates[2].membership.status, 'unknown'); assert.equal(r.candidates[1].availability, undefined);
  });
}
for (const mode of ['expired', 'future', 'bad_clock', 'partial', 'bye_conflict', 'reciprocal_conflict', 'calendar_conflict']) {
  test(`schedule ${mode} leaves byes unknown and independent roster/candidate facts usable`, async () => {
    const f = fixture(), value = schedule();
    if (mode === 'expired') value.receivedAt = new Date(NOW - 3_600_000).toISOString();
    if (mode === 'future') value.receivedAt = new Date(NOW + 1).toISOString();
    if (mode === 'bad_clock') value.receivedAt = 'invalid';
    if (mode === 'partial') value.teamWeeks.PIT.pop();
    if (mode === 'bye_conflict') value.byeWeeks.PIT = 1;
    if (mode === 'reciprocal_conflict') value.teamWeeks.PIT[0].opponent = 'PIT';
    if (mode === 'calendar_conflict') value.teamWeeks.PIT[0].gameday = '2026-02-30';
    f.sources.getSchedule = async () => value;
    const r: any = await f.call(lineup, { ...select, week: '18', candidates: ['102'] });
    assert.equal(r.status, 'available'); assert.equal(r.roster.directory[0].onBye, null);
    assert.equal(r.candidates[0].onBye, null); assert.equal(r.candidates[0].availability, 'unrostered');
    assert.equal(r.observations.references.schedule.status, 'unavailable');
  });
}

test('public scoring boundary preserves 256 entries including zeroes and refuses 257', async () => {
  const f = fixture();
  const scoring = Object.fromEntries(Array.from({ length: 256 }, (_, i) => [`rule_${i}`, i % 2 ? 0 : 0.5]));
  f.league.scoring_settings = scoring as any;
  const r: any = await f.call(lineup, select); assert.deepEqual(r.league.scoring, scoring);
  scoring.extra = 0; assert.equal((await f.call(lineup, select) as any).reason, 'source_unavailable');
});

test('private wrapper keeps defaults, early failures, older seasons, unknown weeks and output shape', async () => {
  const f = fixture(); const p = createPersonalReaders({ userId: '123', defaultLeagueId: '10' }, f.sources);
  let r: any = await p.lineup({ candidates: ['102'] });
  assert.equal(r.schemaVersion, 'tiber_personal_lineup_context_v1'); assert.equal(r.selectionBasis, 'configured_default_league');
  assert.equal(r.candidates[0].membership, undefined); assert.equal(r.serviceScope, undefined);
  assert.equal(r.observations.references, undefined); assert.equal(typeof p.scheduleStrength, 'function');
  assert.equal((await p.myLeagues({ season: '2026' }) as any).season, '2026');
  f.league.season = '2025'; r = await p.lineup({ season: '2025', leagueId: '10' });
  assert.equal(r.week, null); assert.equal(r.selectionBasis, 'explicit_league');
  r = await p.lineup({ season: '2025', week: '3' }); assert.equal(r.week, 3);
  f.sources.getManagerNflState = async () => { throw Error('state unavailable'); };
  r = await p.lineup({ season: '2025' }); assert.equal(r.status, 'available'); assert.equal(r.week, null);
  assert.deepEqual(await p.lineup({}), { status: 'unavailable', reason: 'league_and_season_required', nextTool: 'tiber_get_my_leagues' });
});

test('a reference expiring during compilation cannot retain enriched names, availability or byes', async () => {
  const f = fixture();
  f.sources.getDirectory = async () => ({ fetchedAt: NOW - 86_399_000, players: f.players });
  f.sources.getSchedule = async () => { f.setTime(NOW + 2000); return schedule(); };
  const r: any = await f.call(lineup, { ...select, candidates: ['100', 'Synthetic Starter'] });
  assert.equal(r.observations.references.directory.reason, 'expired_reference');
  assert.equal(r.roster.directory[0].name, null); assert.equal(r.lineup[0].player.name, null);
  assert.equal(r.candidates[0].membership.status, 'on_selected_roster'); assert.equal(r.candidates[0].availability, undefined);
  assert.equal(r.candidates[1].membership.status, 'unknown');
});

for (const [tool, args] of [
  ['tiber_public_list_league_rosters', select],
  ['tiber_public_get_roster_context', { ...select, rosterId: 1 }],
  ['tiber_public_get_weekly_matchups', { ...select, week: '7' }],
  ['tiber_public_get_lineup_context', select],
] as const) {
  test(`${tool} drains a pending league when its roster sibling throws synchronously`, async () => {
    const f = fixture(), league = deferred<any>(), started = deferred<void>();
    f.sources.getLeague = () => { started.resolve(); return league.promise; };
    f.sources.getLeagueRosters = () => { throw Error('synchronous source failure'); };
    let finished = false;
    const pending = f.call(tool, args).then(result => { finished = true; return result; });
    await started.promise; await new Promise(resolve => setImmediate(resolve));
    assert.equal(finished, false); league.resolve(f.league);
    assert.equal((await pending as any).reason, 'source_unavailable'); assert.equal(f.calls.directory, 0);
  });
}

test('weekly matchup read drains pending scores when NFL state throws synchronously', async () => {
  const f = fixture(), scores = deferred<unknown>(), started = deferred<void>();
  f.sources.getManagerMatchups = () => { started.resolve(); return scores.promise; };
  f.sources.getManagerNflState = () => { throw Error('synchronous state failure'); };
  let finished = false;
  const pending = f.call('tiber_public_get_weekly_matchups', { ...select, week: '7' }).then(result => { finished = true; return result; });
  await started.promise; await new Promise(resolve => setImmediate(resolve));
  assert.equal(finished, false);
  scores.resolve([{ roster_id: 1, matchup_id: 1, points: 10 }, { roster_id: 2, matchup_id: 1, points: 5 }]);
  const r: any = await pending;
  assert.equal(r.status, 'available'); assert.equal(r.rosters[0].points, 10); assert.equal(r.rosters[0].outcome, 'unavailable');
});
