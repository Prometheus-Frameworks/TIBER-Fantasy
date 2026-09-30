import { inspectPaperLeagueRosters, inspectProductionLeagueRosters } from '../screening';
import type { PaperLeagueScreenInput } from '../schemas';

const input = (): PaperLeagueScreenInput => ({
  schema_id: 'tiber.trade-study.paper-league-screen-input.v0', mode: 'isolated_paper',
  league_id: 'fixture:league', operator_roster_id: 'fixture:own',
  filter: { position: 'RB', minimum_ordinary_players: 2 },
  rosters: [
    { roster_id: 'fixture:own', players: [{ player_id: 'fixture:a', position: 'WR', container: 'starter' }] },
    { roster_id: 'fixture:deep', players: [{ player_id: 'fixture:b', position: 'RB', container: 'starter' }, { player_id: 'fixture:c', position: 'RB', container: 'bench' }] },
    { roster_id: 'fixture:shallow', players: [{ player_id: 'fixture:d', position: 'RB', container: 'starter' }, { player_id: 'fixture:e', position: 'RB', container: 'reserve' }, { player_id: 'fixture:f', position: 'RB', container: 'taxi' }] },
    { roster_id: 'fixture:unknown', players: [{ player_id: 'fixture:g', position: null, container: 'bench' }] },
  ],
});
function available(value = input()) {
  const result = inspectPaperLeagueRosters(value);
  if (result.status !== 'paper_roster_inspection_available') throw new Error(result.reason);
  return result;
}
it('shows every other roster against an explicit count filter without ranking or willingness', () => {
  const result = available();
  expect(result.roster_views.map(r => [r.roster_id, r.count_filter_status, r.matching_ordinary_count])).toEqual([
    ['fixture:deep', 'meets', 2], ['fixture:shallow', 'below', 1], ['fixture:unknown', 'unknown', 0],
  ]);
  expect(result).toMatchObject({ ordering: 'none', willingness: 'unavailable', expendability: 'not_evaluated', durable_records: 0, execution: { performed: false, authorized: false } });
  expect(result.roster_views.some(r => r.roster_id === 'fixture:own')).toBe(false);
  expect(result).not.toHaveProperty('recommendation');
});
it('does not need unknown positions to disprove already observed matching players', () => {
  const value = input(); value.rosters[1].players.push({ player_id: 'fixture:h', position: null, container: 'bench' });
  expect(available(value).roster_views[0].count_filter_status).toBe('meets');
});
it('preserves snapshot input and is byte-stable under roster and player permutations', () => {
  const value = input(); const original = JSON.stringify(value);
  const expected = JSON.stringify(available(value));
  expect(JSON.stringify(value)).toBe(original);
  value.rosters.reverse(); value.rosters.forEach(r => r.players.reverse());
  expect(JSON.stringify(available(value))).toBe(expected);
});
it.each([
  ['manager attribute', (v: any) => { v.rosters[1].acceptance_probability = 0.9; }, 'invalid_paper_input'],
  ['ranking', (v: any) => { v.filter.sort = 'best'; }, 'invalid_paper_input'],
  ['invalid filter', (v: any) => { v.filter.minimum_ordinary_players = 0; }, 'invalid_paper_input'],
  ['duplicate roster', (v: any) => { v.rosters[1].roster_id = 'fixture:own'; }, 'duplicate_roster_identity'],
  ['duplicate player', (v: any) => { v.rosters[1].players.push(v.rosters[0].players[0]); }, 'duplicate_player_identity'],
  ['missing operator', (v: any) => { v.operator_roster_id = 'fixture:absent'; }, 'operator_roster_missing'],
  ['real league', (v: any) => { v.league_id = '12345'; }, 'invalid_paper_input'],
] as const)('refuses %s', (_name, mutate, reason) => {
  const value = input(); mutate(value);
  expect(inspectPaperLeagueRosters(value)).toEqual({ status: 'refused', reason, roster_views: null, durable_records: 0 });
});
it('production refuses even a well-formed paper league', () => {
  expect(inspectProductionLeagueRosters(input())).toEqual({ status: 'refused', reason: 'production_contract_unavailable', roster_views: null, durable_records: 0 });
});
