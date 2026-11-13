import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getRosterContext } from '../server/modules/leagueMcp/rosterContext';
import { parseCompleteRosterCoverage } from '../server/modules/draftReview/leagueAvailability';
import { createPersonalReaders } from '../server/modules/leagueMcp/personalContext';

// Synthetic elimination ("chopped") league in the shape Sleeper returns: an eliminated roster keeps
// its row and owner, has `players: null`, all-"0" starters and `settings.eliminated` = week cut.
function fixture() {
  const league = { league_id: '10', name: 'Synthetic Chopped', sport: 'nfl', season: '2026', total_rosters: 3,
    roster_positions: ['TE', 'FLEX', 'BN'], scoring_settings: { rec: 1 },
    settings: { type: 3, playoff_week_start: 0, last_chopped_leg: 9, waiver_type: 2, waiver_budget: 1000 } };
  const rosters: any[] = [
    { roster_id: 1, owner_id: '123', players: ['100', '101'], starters: ['100', '0'], reserve: null, taxi: null, settings: { waiver_budget_used: 697 } },
    { roster_id: 2, owner_id: '456', players: ['103'], starters: ['103', '0'], reserve: null, taxi: null, settings: { waiver_budget_used: 0 } },
    { roster_id: 3, owner_id: '789', players: null, starters: ['0', '0'], reserve: null, taxi: null, settings: { eliminated: 8, locked: 1, waiver_budget_used: 0 } },
  ];
  const players = Object.fromEntries([
    ['100', 'Synthetic Starter'], ['101', 'Synthetic Bench'], ['102', 'Synthetic Candidate'], ['103', 'Synthetic Rostered'],
  ].map(([player_id, full_name]) => [player_id, { player_id, full_name, team: 'PIT', position: 'TE', active: true, status: 'Active' }]));
  const sources: any = {
    getLeague: async () => structuredClone(league), getLeagueRosters: async () => structuredClone(rosters),
    getDirectory: async () => ({ fetchedAt: Date.now(), players }),
    getUser: async () => ({ user_id: '123', display_name: 'Synthetic', username: 'synthetic' }),
    getUserLeagues: async () => [league],
    getManagerNflState: async () => ({ season: '2026', season_type: 'regular', leg: 10 }),
    getSchedule: async (season: string) => ({ season, receivedAt: new Date().toISOString(), sourceUrl: 'https://example.com/synthetic.csv',
      contentHash: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef', hashConvention: 'sha256_hex_utf8_decoded_text_v1', byeWeeks: { PIT: 9 }, teamWeeks: {} }),
  };
  return { league, rosters, sources };
}
const select = { userId: '123', leagueId: '10', season: '2026', rosterId: 1 };

test('surviving roster reads in a league containing witnessed eliminated rosters', async () => {
  const f = fixture();
  const r = await getRosterContext(select, f.sources);
  assert.equal(r.status, 'available'); assert.deepEqual(r.roster.players, ['100', '101']);
  assert.equal(r.league.type, 3); assert.equal(r.league.playoffWeekStart, 0);
});

test('null membership without the elimination witness still refuses', async () => {
  for (const settings of [undefined, null, {}, { eliminated: null }, { eliminated: 0 }, { eliminated: '8' }, { locked: 1 }]) {
    const f = fixture(); f.rosters[2].settings = settings;
    await assert.rejects(getRosterContext(select, f.sources));
    assert.throws(() => parseCompleteRosterCoverage({ leagueId: '10', rosterId: 1 }, f.league, f.rosters));
  }
  const f = fixture(); delete f.rosters[2].players; // missing key is never an elimination
  await assert.rejects(getRosterContext(select, f.sources));
  assert.throws(() => parseCompleteRosterCoverage({ leagueId: '10', rosterId: 1 }, f.league, f.rosters));
});

test('an eliminated selected roster refuses instead of presenting an empty lineup', async () => {
  const f = fixture();
  await assert.rejects(getRosterContext({ ...select, userId: '789', rosterId: 3 }, f.sources));
  assert.throws(() => parseCompleteRosterCoverage({ leagueId: '10', rosterId: 3 }, f.league, f.rosters));
});

test('eliminated rosters contribute no rostered players and coverage stays complete', () => {
  const f = fixture();
  const coverage = parseCompleteRosterCoverage({ leagueId: '10', rosterId: 1 }, f.league, f.rosters);
  assert.equal(coverage.rosters.length, 3);
  assert.deepEqual([...coverage.rostered].sort(), ['100', '101', '103']);
  assert.deepEqual(coverage.rosters.map(r => r.eliminated), [false, false, true]);
});

test('personal lineup context resolves candidates and FAAB in an elimination league', async () => {
  const f = fixture();
  const readers = createPersonalReaders({ userId: '123', defaultLeagueId: '10' }, f.sources);
  const r: any = await readers.lineup({ candidates: ['Synthetic Candidate', 'Synthetic Rostered'] });
  assert.equal(r.status, 'available'); assert.equal(r.week, 10);
  assert.deepEqual(r.lineup.map((s: any) => s.playerId), ['100', null]);
  assert.deepEqual(r.candidates.map((c: any) => c.availability), ['unrostered', 'rostered_elsewhere']);
  assert.equal(r.waiverSettings.derived.faab_remaining, 303);
  assert.equal(r.observations.availability.expected_rosters, 3); assert.equal(r.observations.availability.received_rosters, 3);
});
