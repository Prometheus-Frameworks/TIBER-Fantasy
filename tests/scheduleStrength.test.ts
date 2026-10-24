import test from 'node:test';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { compileSchedule, getSchedule, sha256Hex, SCHEDULE_TEAMS, SCHEDULE_HASH_CONVENTION, type Schedule } from '../server/modules/leagueMcp/schedule';
import { compileCalendar } from '../server/modules/leagueMcp/rosSchedule';
import { createScheduleStrengthReader, SCHEDULE_STRENGTH_TOOL } from '../server/modules/leagueMcp/scheduleStrength';
import { createPersonalReaders } from '../server/modules/leagueMcp/personalContext';
import { createLeagueTools, publicReaders } from '../server/modules/leagueMcp/tools';
import { getRosterContext } from '../server/modules/leagueMcp/rosterContext';
import { buildLeagueReaderServer } from '../server/mcp/leagueReaderServer';
import { ROLE_TOOL } from '../server/modules/roleEvidence/roleHistory';
import worker from '../server/mcp/leagueReaderWorker';

// Entirely synthetic schedule: 272 REG games, 32 teams, one bye each (two byes per week in weeks 1-16).
// nflverse spelling is emitted (LA for the Rams) so the LA -> LAR mapping is exercised.
const nflverseCode = (team: string) => team === 'LAR' ? 'LA' : team;
const byeOf = (team: string) => ((Math.floor(SCHEDULE_TEAMS.indexOf(team) / 2) + 7) % 16) + 1; // ARI -> 8, LAR -> 16
function syntheticRows() {
  const rows = ['game_id,season,game_type,week,gameday,home_team,away_team'];
  for (let week = 1; week <= 18; week++) {
    const active = SCHEDULE_TEAMS.filter(t => byeOf(t) !== week);
    const rotated = [...active.slice(week % active.length), ...active.slice(0, week % active.length)];
    const day = new Date(Date.UTC(2026, 8, 10 + 7 * (week - 1))).toISOString().slice(0, 10);
    for (let i = 0; i < rotated.length; i += 2) {
      rows.push(`2026_${String(week).padStart(2, '0')}_${rotated[i + 1]}_${rotated[i]},2026,REG,${week},${day},${nflverseCode(rotated[i])},${nflverseCode(rotated[i + 1])}`);
    }
  }
  return rows;
}
async function syntheticSchedule(rows = syntheticRows()) {
  const text = rows.join('\n');
  return compileSchedule(text, '2026', '2026-10-22T20:00:00.000Z', await sha256Hex(text));
}
function fixture(schedule: Schedule) {
  const league = { league_id: '10', name: 'Synthetic League', sport: 'nfl', season: '2026', total_rosters: 2,
    roster_positions: ['WR', 'BN'], scoring_settings: { rec: 1, bonus_rec_te: 0.5 }, settings: { playoff_week_start: 15, best_ball: 0 } };
  const rosters = [{ roster_id: 1, owner_id: '123', players: ['100'], starters: ['100'] }, { roster_id: 2, owner_id: '456', players: ['101'], starters: ['101'] }];
  const players: Record<string, unknown> = {
    '100': { player_id: '100', full_name: 'Synthetic Receiver', team: 'ARI', position: 'WR', active: true, status: 'Active' },
    '101': { player_id: '101', full_name: 'Synthetic Back', team: 'LAR', position: 'RB', active: true, status: 'Active' },
    '102': { player_id: '102', full_name: 'Synthetic Twin', team: 'DET', position: 'WR' },
    '103': { player_id: '103', full_name: 'Synthetic Twin', team: 'BUF', position: 'TE' },
    '104': { player_id: '104', full_name: 'Synthetic Kicker', team: 'KC', position: 'K' },
    '105': { player_id: '105', full_name: 'Synthetic Free Agent', team: null, position: 'WR' },
    '106': { player_id: '106', full_name: 'Synthetic Stranger', team: 'XX', position: 'WR' },
  };
  const calls = { league: 0, rosters: 0, directory: 0, schedule: 0, state: 0 };
  const sources = {
    getLeague: async () => { calls.league++; return structuredClone(league); },
    getLeagueRosters: async () => { calls.rosters++; return structuredClone(rosters); },
    getDirectory: async () => { calls.directory++; return { fetchedAt: Date.parse('2026-10-22T19:00:00Z'), players }; },
    getUser: async () => ({ user_id: '123', display_name: 'Synthetic', username: 'synthetic' }),
    getUserLeagues: async () => [league],
    getManagerNflState: async () => { calls.state++; return { season: '2026', season_type: 'regular', leg: 7 }; },
    getSchedule: async (season: string) => { calls.schedule++; if (season !== schedule.season) throw Error('season'); return schedule; },
  };
  return { sources, calls, league, players };
}
const reader = (f: ReturnType<typeof fixture>, profile = { userId: '123', defaultLeagueId: '10' }) =>
  createScheduleStrengthReader(profile, f.sources as any, () => '2026-10-22T21:00:00.000Z');

test('schedule compiler retains reciprocal fixtures, maps LA to LAR, keeps byes, and binds the content hash', async () => {
  const schedule = await syntheticSchedule();
  assert.equal(schedule.hashConvention, SCHEDULE_HASH_CONVENTION);
  assert.equal(schedule.contentHash, await sha256Hex(syntheticRows().join('\n')));
  assert.equal('LA' in schedule.teamWeeks, false);
  assert.equal(schedule.teamWeeks.LAR.length, 17); assert.equal(schedule.byeWeeks.LAR, byeOf('LAR'));
  for (const team of SCHEDULE_TEAMS) {
    assert.equal(schedule.teamWeeks[team].length, 17);
    assert.deepEqual(schedule.teamWeeks[team].map(f => f.week), Array.from({ length: 18 }, (_, i) => i + 1).filter(w => w !== schedule.byeWeeks[team]));
    for (const f of schedule.teamWeeks[team]) {
      const mirror = schedule.teamWeeks[f.opponent].find(m => m.week === f.week)!;
      assert.equal(mirror.gameId, f.gameId); assert.equal(mirror.opponent, team); assert.equal(mirror.gameday, f.gameday);
      assert.notEqual(mirror.designation, f.designation);
    }
  }
  const ramsRow = syntheticRows().find(r => r.includes(',LA,') || r.endsWith(',LA'))!;
  assert.ok(ramsRow.includes(',LA'));
  // Duplicate, conflicting and incomplete schedules still fail closed; a missing hash is refused before parsing.
  const rows = syntheticRows();
  for (const csv of [rows.slice(0, -1), [...rows.slice(0, -1), rows[1]], rows.map(r => r.replace(',2026,REG,2,', ',2026,REG,1,'))]) {
    await assert.rejects(syntheticSchedule(csv));
  }
  assert.throws(() => compileSchedule(rows.join('\n'), '2026', '2026-10-22T20:00:00.000Z', 'not-a-hash'), /hash/);
});

test('getSchedule hashes the exact fetched text and caches hash and fixtures together', async () => {
  const original = globalThis.fetch;
  const text = syntheticRows().join('\n');
  let reads = 0;
  globalThis.fetch = async () => { reads++; return new Response(text); };
  try {
    const first = await getSchedule('2026');
    assert.equal(first.contentHash, await sha256Hex(text));
    assert.equal(first.teamWeeks.ARI.length, 17);
    const again = await getSchedule('2026');
    assert.equal(again, first); assert.equal(reads, 1);
    assert.equal(again.contentHash, first.contentHash);
  } finally { globalThis.fetch = original; }
});

test('next3 includes the decision week, keeps a bye inside the window and never extends it', async () => {
  const schedule = await syntheticSchedule();
  const r = compileCalendar({ schedule, team: 'ARI', decisionWeek: 7, window: { kind: 'next3', finalWeek: null }, playoffStart: { status: 'unavailable', reason: 'no_league_selected' } });
  assert.equal(r.window.status, 'available');
  assert.deepEqual(r.window.weeks, [7, 8, 9]);
  assert.deepEqual(r.window.fixtures.map(f => f.bye), [false, true, false]);
  assert.deepEqual(r.window.fixtures.map(f => f.relativeToDecisionWeek), ['decision_week', 'after', 'after']);
  const bye = r.window.fixtures[1];
  assert.equal(bye.status, 'bye'); assert.equal(bye.opponent, null); assert.equal(bye.gameId, null); assert.equal(bye.opponentDefense, null);
  assert.deepEqual(r.window.counts, { weeks: 3, scheduledGames: 2, byes: 1, eligibleGames: null, ratedGames: null });
  assert.equal(r.window.clampedBy, null); assert.equal(r.regularSeasonRemainder, null);
  assert.equal(r.window.fixtures[0].teamHistoryOnly, false);
});

test('season bounds clamp next3 at week 18 and an explicit finalWeek bounds ROS and next3', async () => {
  const schedule = await syntheticSchedule();
  const none = { status: 'unavailable' as const, reason: 'no_league_selected' };
  const late = compileCalendar({ schedule, team: 'ARI', decisionWeek: 17, window: { kind: 'next3', finalWeek: null }, playoffStart: none });
  assert.deepEqual(late.window.weeks, [17, 18]); assert.equal(late.window.clampedBy, 'regular_season_end');
  assert.deepEqual(late.window.requested, { startWeek: 17, endWeek: 19 });
  const ros = compileCalendar({ schedule, team: 'ARI', decisionWeek: 7, window: { kind: 'ros', finalWeek: 16 }, playoffStart: none });
  assert.deepEqual(ros.window.weeks, [7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
  assert.equal(ros.window.basis, 'decision_week_through_caller_supplied_final_week');
  assert.equal(ros.window.counts.scheduledGames, 9); assert.equal(ros.window.counts.byes, 1);
  const bounded = compileCalendar({ schedule, team: 'ARI', decisionWeek: 7, window: { kind: 'next3', finalWeek: 8 }, playoffStart: none });
  assert.deepEqual(bounded.window.weeks, [7, 8]); assert.equal(bounded.window.clampedBy, 'caller_supplied_final_week');
  const over = compileCalendar({ schedule, team: 'ARI', decisionWeek: 17, window: { kind: 'ros', finalWeek: 16 }, playoffStart: none });
  assert.equal(over.window.reason, 'final_week_before_decision_week');
});

test('a missing final week returns an actionable witness while preserving schedule facts; week 18 is never assumed', async () => {
  const schedule = await syntheticSchedule();
  const r = compileCalendar({ schedule, team: 'ARI', decisionWeek: 7, window: { kind: 'ros', finalWeek: null }, playoffStart: { status: 'verified', value: 15 } });
  assert.equal(r.window.status, 'unavailable'); assert.equal(r.window.reason, 'league_final_week_required');
  assert.deepEqual(r.window.weeks, []); assert.deepEqual(r.window.fixtures, []);
  const witness = r.missingWitnesses.find(w => w.scope.metric === 'league_final_week')!;
  assert.equal(witness.id, 'SOS-2026-ARI-ros-league_final_week-not_inspected');
  assert.match(witness.evidenceNeeded, /finalWeek/); assert.match(witness.evidenceNeeded, /not assumed/);
  assert.equal(r.regularSeasonRemainder!.basis, 'decision_week_through_regular_season_end_not_league_final');
  assert.deepEqual(r.regularSeasonRemainder!.weeks, [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18]);
  assert.equal(r.regularSeasonRemainder!.counts.byes, 1);
  assert.ok(r.missingWitnesses.some(w => w.scope.metric === 'opponent_defense_rating' && w.id.includes('regular_season_remainder')));
});

test('playoff windows use the verified start; zero means no playoffs; unknown start is a witness', async () => {
  const schedule = await syntheticSchedule();
  const ok = compileCalendar({ schedule, team: 'LAR', decisionWeek: 7, window: { kind: 'playoffs', finalWeek: 17 }, playoffStart: { status: 'verified', value: 15 } });
  assert.deepEqual(ok.window.weeks, [15, 16, 17]); assert.equal(ok.window.counts.byes, 1);
  assert.equal(ok.window.basis, 'verified_league_playoff_start_through_caller_supplied_final_week');
  const none = compileCalendar({ schedule, team: 'LAR', decisionWeek: 7, window: { kind: 'playoffs', finalWeek: 17 }, playoffStart: { status: 'verified', value: 0 } });
  assert.equal(none.window.reason, 'no_playoffs_configured');
  assert.equal(none.missingWitnesses.some(w => w.scope.metric === 'league_playoff_start' || w.scope.metric === 'league_final_week'), false);
  assert.ok(none.regularSeasonRemainder);
  const unknown = compileCalendar({ schedule, team: 'LAR', decisionWeek: 7, window: { kind: 'playoffs', finalWeek: 17 }, playoffStart: { status: 'unavailable', reason: 'no_league_selected' } });
  assert.equal(unknown.window.reason, 'playoff_start_unknown');
  assert.equal(unknown.missingWitnesses.find(w => w.scope.metric === 'league_playoff_start')!.reason, 'not_inspected');
  const noFinal = compileCalendar({ schedule, team: 'LAR', decisionWeek: 7, window: { kind: 'playoffs', finalWeek: null }, playoffStart: { status: 'verified', value: 15 } });
  assert.equal(noFinal.window.reason, 'league_final_week_required');
  assert.ok(noFinal.missingWitnesses.some(w => w.id === 'SOS-2026-LAR-playoffs-league_final_week-not_inspected'));
  const inverted = compileCalendar({ schedule, team: 'LAR', decisionWeek: 7, window: { kind: 'playoffs', finalWeek: 14 }, playoffStart: { status: 'verified', value: 15 } });
  assert.equal(inverted.window.reason, 'final_week_before_playoff_start');
});

test('custom reader windows reject a conflicting finalWeek before source reads', async () => {
  const f = fixture(await syntheticSchedule());
  const rejected: any = await reader(f)({ team: 'ARI', window: 'custom', startWeek: '15', endWeek: '18', finalWeek: '17' });
  assert.equal(rejected.status, 'unavailable');
  assert.equal(rejected.reason, 'invalid_window');
  assert.match(rejected.detail, /finalWeek/);
  assert.deepEqual(f.calls, { league: 0, rosters: 0, directory: 0, schedule: 0, state: 0 });
  const bounded: any = await reader(f)({ team: 'ARI', window: 'custom', startWeek: '15', endWeek: '17', finalWeek: '17' });
  assert.equal(bounded.calendar.finalWeek, 17);
  assert.deepEqual(bounded.window.weeks, [15, 16, 17]);
  const explicit: any = await reader(f)({ team: 'ARI', window: 'custom', startWeek: '15', endWeek: '18' });
  assert.equal(explicit.calendar.finalWeek, null);
  assert.deepEqual(explicit.window.weeks, [15, 16, 17, 18]);
});

test('playoff witnesses distinguish unread settings from a successfully inspected missing field', async () => {
  const schedule = await syntheticSchedule();
  for (const cause of ['no_league_selected', 'source_unavailable', 'membership_not_verified', 'absent']) {
    const f = fixture(schedule);
    if (cause === 'source_unavailable') f.sources.getLeague = async () => { throw Error('synthetic outage'); };
    if (cause === 'membership_not_verified') f.sources.getLeagueRosters = async () => [
      { roster_id: 1, owner_id: '999', players: ['100'], starters: ['100'] },
      { roster_id: 2, owner_id: '456', players: ['101'], starters: ['101'] },
    ];
    if (cause === 'absent') delete (f.league.settings as any).playoff_week_start;
    const profile = cause === 'no_league_selected' ? { userId: '123' } : { userId: '123', defaultLeagueId: '10' };
    const result: any = await createScheduleStrengthReader(profile, f.sources as any)({ team: 'ARI', window: 'playoffs', finalWeek: '17' });
    assert.equal(result.window.reason, 'playoff_start_unknown', cause);
    assert.ok(result.regularSeasonRemainder.fixtures.length > 0, cause);
    const witness = result.missingWitnesses.find((w: any) => w.scope.metric === 'league_playoff_start');
    assert.equal(witness.reason, cause === 'absent' ? 'absent_from_inspected_source' : 'not_inspected', cause);
    if (cause === 'absent') assert.equal(result.league.status, 'available');
    else assert.equal(result.league.reason, cause);
    assert.ok(witness.evidenceNeeded.includes(result.calendar.playoffStart.reason), cause);
  }
});

test('locks stay unknown, ratings stay null and past fixtures are labeled team history', async () => {
  const schedule = await syntheticSchedule();
  const r = compileCalendar({ schedule, team: 'ARI', decisionWeek: 7, window: { kind: 'custom', startWeek: 5, endWeek: 9 }, playoffStart: { status: 'unavailable', reason: 'no_league_selected' } });
  assert.deepEqual(r.window.weeks, [5, 6, 7, 8, 9]);
  for (const f of r.window.fixtures) {
    assert.equal(f.lockState, 'unknown'); assert.equal(f.completion, 'unknown'); assert.equal(f.kickoff, null); assert.equal(f.venue, 'unknown');
    if (!f.bye) { assert.equal(f.opponentDefense!.rating, null); assert.equal(f.opponentDefense!.reason, 'no_qualified_defensive_evidence'); assert.equal(f.opponentDefense!.cutoff, null); }
  }
  assert.deepEqual(r.window.fixtures.map(f => f.teamHistoryOnly), [true, true, false, false, false]);
  assert.equal(r.window.counts.eligibleGames, null); assert.equal(r.window.counts.ratedGames, null);
  const history = r.missingWitnesses.find(w => w.scope.metric === 'historical_player_membership')!;
  assert.deepEqual(history.scope.weeks, [5, 6]);
  const lock = r.missingWitnesses.find(w => w.scope.metric === 'lock_state')!;
  assert.deepEqual(lock.scope.weeks, [5, 6, 7, 9]); assert.equal(lock.reason, 'not_inspected');
  const text = JSON.stringify(r);
  for (const banned of ['"rank"', '"tier"', '"color"', '"average"', '"rating":0', '"rating":50']) assert.equal(text.includes(banned), false, banned);
});

test('reader resolves one player on its current team and returns a schedule-only contract with separate clocks', async () => {
  const f = fixture(await syntheticSchedule());
  const r: any = await reader(f)({ player: 'Synthetic Receiver', window: 'next3' });
  assert.equal(r.status, 'available'); assert.equal(r.schemaVersion, 'tiber_ros_schedule_strength_v1'); assert.equal(r.capability, 'schedule_only');
  assert.deepEqual({ ...r.resolvedIdentity, directoryReceivedAt: undefined }, { kind: 'player', playerId: '100', name: 'Synthetic Receiver', position: 'WR', team: 'ARI',
    playerStatus: 'Active', active: true, membershipBasis: 'current_directory_team', directoryReceivedAt: undefined });
  assert.deepEqual(r.window.weeks, [7, 8, 9]);
  assert.equal(r.calendar.decisionWeek, 7); assert.equal(r.calendar.decisionWeekBasis, 'nfl_state'); assert.equal(r.calendar.finalWeekBasis, 'not_supplied');
  assert.deepEqual(r.calendar.playoffStart, { status: 'verified', value: 15 });
  assert.equal(r.clocks.decisionTime, '2026-10-22T21:00:00.000Z'); assert.equal(r.clocks.scheduleRetrievedAt, '2026-10-22T20:00:00.000Z');
  assert.equal(r.clocks.directoryReceivedAt, '2026-10-22T19:00:00.000Z'); assert.equal(r.clocks.defensiveStatisticsCutoff, null);
  assert.equal(r.scoring.basis, 'league'); assert.equal(r.scoring.settings.rec, 1); assert.match(r.scoring.note, /no rating was computed/);
  assert.equal(r.league.status, 'available'); assert.equal(r.league.selectionBasis, 'configured_default_league');
  assert.deepEqual(r.ratings, { source: null, status: 'unavailable', reason: 'no_qualified_defensive_evidence', cutoff: null, methodVersion: null });
  assert.equal(r.source.contentHash, f.sources.getSchedule ? (await f.sources.getSchedule('2026')).contentHash : null);
  assert.equal(r.source.replay, 'content_hash_only_source_bytes_not_retained');
  assert.deepEqual(f.calls, { league: 1, rosters: 1, directory: 1, schedule: 2, state: 1 });
  assert.equal(JSON.stringify(r).includes('owner_id'), false);
  const ros: any = await reader(f)({ player: '100', window: 'ros', finalWeek: '16', week: '9' });
  assert.deepEqual(ros.window.weeks, [9, 10, 11, 12, 13, 14, 15, 16]); assert.equal(ros.calendar.decisionWeekBasis, 'explicit'); assert.equal(ros.calendar.finalWeekBasis, 'caller_supplied');
});

test('ambiguous identity, unsupported players, unknown teams and invalid selectors refuse before schedule facts', async () => {
  const f = fixture(await syntheticSchedule());
  const call = reader(f);
  const twin: any = await call({ player: 'Synthetic Twin', window: 'next3' });
  assert.equal(twin.reason, 'ambiguous_player'); assert.equal(twin.matchCount, 2);
  assert.deepEqual(twin.matches.map((m: any) => m.playerId), ['102', '103']);
  assert.equal((await call({ player: 'synthetic twin', window: 'next3' })).reason, 'ambiguous_player');
  assert.equal((await call({ player: 'Nobody Here', window: 'next3' })).reason, 'player_not_found');
  assert.equal((await call({ player: 'Synthetic Kicker', window: 'next3' })).reason, 'unsupported_player');
  assert.equal((await call({ player: 'Synthetic Free Agent', window: 'next3' })).reason, 'player_team_unknown');
  assert.equal((await call({ player: 'Synthetic Stranger', window: 'next3' })).reason, 'player_team_unknown');
  assert.equal((await call({ player: 'Synthetic Receiver', position: 'RB', window: 'next3' })).reason, 'invalid_selector');
  for (const raw of [{ window: 'next3' }, { player: 'Synthetic Receiver', team: 'ARI', window: 'next3' }, { team: 'LA', window: 'next3' }, { team: 'ZZZ', window: 'next3' }] as const) {
    assert.equal((await call(raw as any)).reason, 'invalid_selector');
  }
  for (const raw of [{ team: 'ARI', window: 'custom' }, { team: 'ARI', window: 'custom', startWeek: '9', endWeek: '7' }, { team: 'ARI', window: 'next3', startWeek: '7' }] as const) {
    assert.equal((await call(raw as any)).reason, 'invalid_window');
  }
  assert.equal(f.calls.schedule, 0);
  // Strict schema at the dispatcher: foreign keys, URLs, numeric weeks and producer instructions are refused.
  const tools = createLeagueTools({ ...publicReaders, scheduleStrength: call as any });
  for (const raw of [{ team: 'ARI', window: 'next3', url: 'https://evil.example' }, { team: 'ARI', window: 'next3', week: 7 }, { team: 'ARI', window: 'ros', finalWeek: '19' },
    { team: 'ARI', window: 'next3', sourceUrl: 'x' }, { team: 'ARI', window: 'weekly' }, { team: 'ari', window: 'next3' }, { team: 'ARI', window: 'next3', note: 'x'.repeat(3000) }]) {
    assert.equal((await tools(SCHEDULE_STRENGTH_TOOL, raw)).reason, 'invalid_input');
  }
  assert.equal(f.calls.schedule, 0);
});

test('team selector, scenario scoring, league outages and missing playoff settings keep schedule facts honest', async () => {
  const f = fixture(await syntheticSchedule());
  const scenario: any = await reader(f, { userId: '123' })({ team: 'LAR', position: 'RB', window: 'next3', scoringScenario: 'half-ppr-scenario' });
  assert.equal(scenario.status, 'available'); assert.equal(scenario.resolvedIdentity.membershipBasis, 'team_selector');
  assert.deepEqual(scenario.scoring, { basis: 'scenario', scenario: 'half-ppr-scenario', settings: null, note: 'context only; no rating was computed under this scoring' });
  assert.equal(scenario.league.reason, 'no_league_selected'); assert.deepEqual(scenario.calendar.playoffStart, { status: 'unavailable', reason: 'no_league_selected' });
  assert.deepEqual(f.calls, { league: 0, rosters: 0, directory: 0, schedule: 1, state: 1 });
  const noScenario: any = await reader(f, { userId: '123' })({ team: 'LAR', window: 'playoffs', finalWeek: '17' });
  assert.equal(noScenario.scoring.basis, 'none'); assert.equal(noScenario.window.reason, 'playoff_start_unknown');
  f.sources.getLeague = async () => { throw Error('secret outage'); };
  const outage: any = await reader(f)({ team: 'ARI', window: 'playoffs', finalWeek: '17' });
  assert.equal(outage.status, 'available'); assert.equal(outage.league.reason, 'source_unavailable'); assert.equal(outage.scoring.basis, 'none');
  assert.equal(outage.window.reason, 'playoff_start_unknown'); assert.equal(JSON.stringify(outage).includes('secret outage'), false);
  assert.ok(outage.regularSeasonRemainder.fixtures.length);
  const g = fixture(await syntheticSchedule());
  g.sources.getLeague = async () => ({ ...g.league, settings: { best_ball: 0 } });
  const unset: any = await reader(g)({ team: 'ARI', window: 'playoffs', finalWeek: '17' });
  assert.equal(unset.league.playoffWeekStart, null); assert.equal(unset.window.reason, 'playoff_start_unknown');
  assert.equal(unset.missingWitnesses.find((w: any) => w.scope.metric === 'league_playoff_start').evidenceNeeded.includes('playoff_week_start_absent_from_league_settings'), true);
  const h = fixture(await syntheticSchedule());
  h.sources.getLeague = async () => ({ ...h.league, settings: { playoff_week_start: 0 } });
  assert.equal(((await reader(h)({ team: 'ARI', window: 'playoffs', finalWeek: '17' })) as any).window.reason, 'no_playoffs_configured');
  const stranger = fixture(await syntheticSchedule());
  stranger.sources.getLeagueRosters = async () => [{ roster_id: 1, owner_id: '999', players: [] }, { roster_id: 2, owner_id: '456', players: [] }];
  const member: any = await reader(stranger)({ team: 'ARI', window: 'next3' });
  assert.equal(member.league.reason, 'membership_not_verified'); assert.equal(member.window.status, 'available');
});

test('decision week and season come from explicit arguments or regular-season NFL state only', async () => {
  const f = fixture(await syntheticSchedule());
  f.sources.getManagerNflState = async () => ({ season: '2026', season_type: 'post', leg: 1 });
  assert.equal((await reader(f)({ team: 'ARI', window: 'next3' })).reason, 'decision_week_required');
  assert.equal(((await reader(f)({ team: 'ARI', window: 'next3', week: '7' })) as any).calendar.decisionWeekBasis, 'explicit');
  f.sources.getManagerNflState = async () => { throw Error('outage'); };
  assert.equal((await reader(f)({ team: 'ARI', window: 'next3' })).reason, 'season_required');
  assert.equal((await reader(f)({ team: 'ARI', window: 'next3', season: '2026' })).reason, 'decision_week_required');
  const r: any = await reader(f)({ team: 'ARI', window: 'next3', season: '2026', week: '7' });
  assert.equal(r.status, 'available'); assert.equal(r.clocks.nflStateReceivedAt, null);
  assert.equal((await reader(f)({ team: 'ARI', window: 'next3', season: '2025', week: '7' })).reason, 'schedule_unavailable');
});

test('invalid, incomplete or mismatched schedules return schedule_unavailable with the resolved identity', async () => {
  const f = fixture(await syntheticSchedule());
  f.sources.getSchedule = async () => { throw Error('Conflicting schedule coverage'); };
  const r: any = await reader(f)({ player: 'Synthetic Receiver', window: 'next3' });
  assert.equal(r.status, 'unavailable'); assert.equal(r.reason, 'schedule_unavailable'); assert.equal(r.detail, 'complete_schedule_not_verified');
  assert.equal(r.resolvedIdentity.playerId, '100'); assert.equal(r.decisionWeek, 7);
  assert.equal(JSON.stringify(r).includes('fixtures'), false);
  const wrong = await syntheticSchedule();
  f.sources.getSchedule = async () => ({ ...wrong, season: '2025' });
  assert.equal((await reader(f)({ player: 'Synthetic Receiver', window: 'next3' })).reason, 'schedule_unavailable');
});

test('unknown and ROP names never reach the schedule reader or the matchup reader', async () => {
  let scheduleCalls = 0, matchupCalls = 0;
  const tools = createLeagueTools({ leagues: async () => ({}), memberships: async () => ({}), roster: async () => ({}),
    matchups: async () => { matchupCalls++; return { status: 'available' }; },
    scheduleStrength: async () => { scheduleCalls++; return { status: 'available' }; } });
  const args = { team: 'ARI', window: 'next3' };
  for (const name of [ROLE_TOOL, 'tiber_get_ros_schedule', 'tiber_get_schedule_strength', 'unknown', '__proto__', 'constructor']) {
    assert.equal((await tools(name, args)).reason, 'unknown_tool');
  }
  assert.equal((await tools('tiber_get_weekly_matchups', args)).reason, 'invalid_input');
  assert.equal(scheduleCalls, 0); assert.equal(matchupCalls, 0);
  assert.equal((await tools(SCHEDULE_STRENGTH_TOOL, args)).status, 'available');
  assert.equal(scheduleCalls, 1); assert.equal(matchupCalls, 0);
  assert.equal((await createLeagueTools({ ...publicReaders })(SCHEDULE_STRENGTH_TOOL, args)).reason, 'profile_not_configured');
  assert.equal((await createLeagueTools()(SCHEDULE_STRENGTH_TOOL, args)).reason, 'source_disabled');
  // The shared result bound, deadline and error sanitization apply to this branch like every other.
  const oversized = createLeagueTools({ ...publicReaders, scheduleStrength: async () => ({ payload: 'x'.repeat(1_000_001) }) });
  assert.equal((await oversized(SCHEDULE_STRENGTH_TOOL, args)).reason, 'response_too_large');
  const failing = createLeagueTools({ ...publicReaders, scheduleStrength: async () => { throw Error('secret provider detail'); } });
  assert.deepEqual(await failing(SCHEDULE_STRENGTH_TOOL, args), { status: 'unavailable', reason: 'source_unavailable' });
  const slow = createLeagueTools({ ...publicReaders, scheduleStrength: () => new Promise(() => {}) }, 5);
  assert.equal((await slow(SCHEDULE_STRENGTH_TOOL, args)).reason, 'deadline');
  assert.equal((await slow(SCHEDULE_STRENGTH_TOOL, args)).reason, 'busy');
});

test('existing personal tools stay compatible and now expose the schedule hash and playoff start', async () => {
  const f = fixture(await syntheticSchedule());
  const personal = createPersonalReaders({ userId: '123', defaultLeagueId: '10' }, f.sources as any);
  const lineup: any = await personal.lineup({ candidates: ['Synthetic Twin', '101'] });
  assert.equal(lineup.schemaVersion, 'tiber_personal_lineup_context_v1'); assert.equal(lineup.week, 7);
  assert.equal(lineup.roster.directory[0].byeWeek, byeOf('ARI'));
  assert.equal(lineup.observations.schedule.contentHash, (await f.sources.getSchedule('2026')).contentHash);
  assert.equal(lineup.observations.schedule.hashConvention, SCHEDULE_HASH_CONVENTION);
  assert.equal(lineup.candidates[0].reason, 'ambiguous_player'); assert.equal(lineup.candidates[1].availability, 'rostered_elsewhere');
  assert.equal(lineup.league.playoffWeekStart, 15);
  const context: any = await getRosterContext({ userId: '123', leagueId: '10', season: '2026', rosterId: 1 }, f.sources as any);
  assert.equal(context.league.playoffWeekStart, 15);
  assert.equal(typeof personal.scheduleStrength, 'function');
});

test('real MCP discovers the strict schedule-only schema; the largest 18-week envelope stays far below the bound', async () => {
  const f = fixture(await syntheticSchedule());
  const server = buildLeagueReaderServer({ ...publicReaders, scheduleStrength: reader(f) as any });
  const client = new Client({ name: 'synthetic-schedule-test', version: '1' });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await server.connect(a); await client.connect(b);
  try {
    const list = await client.listTools();
    const tool = list.tools.find(t => t.name === SCHEDULE_STRENGTH_TOOL)!;
    assert.equal(list.tools.length, 8); assert.equal(tool.annotations?.readOnlyHint, true); assert.equal(tool.inputSchema.additionalProperties, false);
    assert.match(tool.description!, /Schedule-only/);
    const full = await client.callTool({ name: SCHEDULE_STRENGTH_TOOL, arguments: { team: 'ARI', window: 'custom', startWeek: '1', endWeek: '18', week: '1' } });
    assert.equal(full.isError, false);
    assert.deepEqual(JSON.parse((full.content as any)[0].text), full.structuredContent);
    const body: any = full.structuredContent;
    assert.equal(body.window.fixtures.length, 18); assert.equal(body.window.counts.scheduledGames, 17);
    const bytes = new TextEncoder().encode(JSON.stringify(full)).byteLength;
    assert.ok(bytes < 100_000, `envelope ${bytes} bytes`);
    const bad = await client.callTool({ name: SCHEDULE_STRENGTH_TOOL, arguments: { team: 'ARI', window: 'next3', url: 'evil' } });
    assert.equal(bad.isError, true);
    const twin = await client.callTool({ name: SCHEDULE_STRENGTH_TOOL, arguments: { player: 'Synthetic Twin', window: 'next3' } });
    assert.equal(twin.isError, true); assert.equal((twin.structuredContent as any).reason, 'ambiguous_player');
  } finally { await client.close(); await server.close(); }
});

test('hosted Worker requires identity, reads only fixed origins and returns the schedule-only tool end to end', async () => {
  const original = globalThis.fetch;
  const urls: string[] = [];
  globalThis.fetch = async input => {
    const url = String(input); urls.push(url);
    assert.match(url, /^https:\/\/(api\.sleeper\.app|raw\.githubusercontent\.com)\//);
    if (url.endsWith('/state/nfl')) return Response.json({ season: '2026', season_type: 'regular', leg: 7 });
    if (url.endsWith('/games.csv')) return new Response(syntheticRows().join('\n'));
    throw Error('unexpected read');
  };
  const request = (body: unknown, headers: Record<string, string> = {}) => new Request('https://private.example/mcp', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', ...headers }, body: JSON.stringify(body) });
  const call = { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: SCHEDULE_STRENGTH_TOOL, arguments: { team: 'ARI', window: 'next3' } } };
  const env = { TIBER_LEAGUE_SOURCE: 'public-sleeper', TIBER_PROFILE_USER_ID: '123' };
  try {
    assert.equal((await worker.fetch(request(call), env)).status, 403);
    assert.equal(urls.length, 0);
    const response = await worker.fetch(request(call, { 'oai-authenticated-user-id': 'synthetic-owner' }), env);
    assert.equal(response.status, 200); assert.equal(response.headers.get('Cache-Control'), 'no-store');
    const body = (await response.json() as any).result;
    assert.equal(body.isError, false);
    assert.deepEqual(body.structuredContent.window.weeks, [7, 8, 9]);
    assert.equal(body.structuredContent.capability, 'schedule_only');
    assert.equal(body.structuredContent.ratings.reason, 'no_qualified_defensive_evidence');
    assert.equal(body.structuredContent.league.reason, 'no_league_selected');
    // The schedule may be served from the one-hour module cache; whatever was read came only from fixed origins.
    assert.ok(urls.some(u => u.endsWith('/state/nfl')));
    assert.equal(body.structuredContent.source.url, 'https://raw.githubusercontent.com/nflverse/nfldata/master/data/games.csv');
    assert.equal(body.structuredContent.source.contentHash, await sha256Hex(syntheticRows().join('\n')));
    const rop = await worker.fetch(request({ ...call, params: { name: ROLE_TOOL, arguments: {} } }, { 'oai-authenticated-user-id': 'synthetic-owner' }), env);
    assert.equal((await rop.json() as any).result.isError, true);
  } finally { globalThis.fetch = original; }
});
