import test from 'node:test';
import assert from 'node:assert/strict';
import { compileRosterCensus, candidateMembership } from '../server/modules/draftReview/rosterCensus';
import { readLeagueAvailabilityForSelection } from '../server/modules/draftReview/leagueAvailability';
import { compileWaiverCandidates } from '../server/modules/draftReview/waiverCandidateCompiler';
import { fixture, select, NOW } from './publicLeagueFixtures';
const time = new Date(NOW).toISOString();
function census(f: ReturnType<typeof fixture>) {
  return compileRosterCensus({ ...select, rosterId: 1 }, { value: f.league, receivedAt: time }, { value: f.rosters, receivedAt: time });
}
test('complete census covers all legitimate buckets without directory, including same-roster repetitions', () => {
  const f = fixture(); f.rosters[1].reserve = ['106']; f.rosters[1].taxi = ['107']; f.rosters[1].starters = ['108', '0', ''];
  const c = census(f); assert.equal(c.status, 'available');
  for (const id of ['100', '101', '104', '105']) assert.equal(candidateMembership(id, c).status, 'on_selected_roster');
  for (const id of ['103', '106', '107', '108']) assert.equal(candidateMembership(id, c).status, 'rostered_elsewhere');
  assert.deepEqual(candidateMembership('102', c), { status: 'not_observed_in_complete_census', rostersReceivedAt: time });
  for (const name of ['Synthetic Starter', '1'.repeat(25), 'PIT', ' 100']) assert.deepEqual(candidateMembership(name, c), { status: 'unknown', rostersReceivedAt: null });
  assert.ok(Object.values(f.calls).every(v => v === 0));
});
test('incomplete coverage, invalid scope/IDs and distinct-roster conflicts invalidate EVERY membership inference', () => {
  const mutations = [
    (f: ReturnType<typeof fixture>) => { f.league.total_rosters = 3; },
    (f: ReturnType<typeof fixture>) => { f.league.total_rosters = 0; },
    (f: ReturnType<typeof fixture>) => { f.rosters.length = 0; },
    (f: ReturnType<typeof fixture>) => { f.rosters[0].roster_id = 3; },
    (f: ReturnType<typeof fixture>) => { f.rosters[1].roster_id = 1; },
    (f: ReturnType<typeof fixture>) => { f.rosters[1].league_id = '20'; },
    (f: ReturnType<typeof fixture>) => { f.league.season = '2025'; },
    (f: ReturnType<typeof fixture>) => { f.rosters[1].players = undefined as any; },
    (f: ReturnType<typeof fixture>) => { f.rosters[1].players = ['invalid']; },
    (f: ReturnType<typeof fixture>) => { f.rosters[1].players.push('100'); },
    (f: ReturnType<typeof fixture>) => { f.rosters[1].reserve = ['100']; },
    (f: ReturnType<typeof fixture>) => { f.rosters[1].taxi = ['104']; },
  ];
  for (const mutate of mutations) {
    const f = fixture(); mutate(f); const c = census(f); assert.equal(c.status, 'unknown');
    for (const id of ['100', '103', '102']) assert.equal(candidateMembership(id, c).status, 'unknown');
  }
});
test('legacy availability retains auxiliary-only exclusions and raw FAAB settings', async () => {
  const f = fixture(); f.rosters[1].reserve = ['102'];
  const availability = await readLeagueAvailabilityForSelection({ leagueId: '10', rosterId: 1, canonicalUrl: 'https://sleeper.com/roster/10/1' }, f.sources);
  const result = compileWaiverCandidates(availability);
  assert.equal(result.candidates.some(p => p.player_id === '102'), false);
  assert.equal(result.waiver_settings.derived.faab_remaining, 79);
});
