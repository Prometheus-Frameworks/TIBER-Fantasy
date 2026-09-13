import { sleeperClient } from '../../../integrations/sleeperClient';
import { __resetDraftReviewCacheForTests } from '../draftReviewService';
import { buildWeeklyMatchup } from '../weeklyMatchup';
import { matchupPacket } from '../../../../shared/draftReviewMatchup';
const url = 'https://sleeper.com/roster/123/1';
const rows = () => [
  { roster_id: 1, matchup_id: 1, points: 0, custom_points: null, players: ['11'], starters: ['11'], players_points: { '11': 0 } },
  { roster_id: 2, matchup_id: 1, points: 12, custom_points: null, players: ['22'], starters: ['22'], players_points: { '22': 12 } },
];
beforeEach(() => {
  __resetDraftReviewCacheForTests();
  jest.spyOn(sleeperClient, 'getLeague').mockResolvedValue({ league_id: '123', name: 'Synthetic', season: '2026', total_rosters: 2, roster_positions: ['FLEX', 'BN'], settings: { leg: 1 } });
  jest.spyOn(sleeperClient, 'getLeagueRosters').mockResolvedValue([{ roster_id: 1, owner_id: 'owner1' }, { roster_id: 2, owner_id: 'owner2' }]);
  jest.spyOn(sleeperClient, 'getLeagueUsers').mockResolvedValue([{ user_id: 'owner1', display_name: '<untrusted>' }, { user_id: 'owner2', display_name: 'Other' }]);
  jest.spyOn(sleeperClient, 'getLeagueMatchups').mockResolvedValue(rows());
  jest.spyOn(sleeperClient, 'getNflPlayers').mockResolvedValue({ '11': { full_name: 'Quarterback', team: 'PHI', position: 'QB', status: 'Active', injury_status: 'NA' }, '22': { full_name: 'Receiver', team: 'PHI', position: 'WR' } });
});
afterEach(() => jest.restoreAllMocks());
test('preserves actual zero, raw injury status, source clocks, relationships and manager intent without owner IDs', async () => {
  const result = await buildWeeklyMatchup(url, '2026', 1);
  expect(result.derived.score_margin).toBe(-12);
  expect(result.observed.you.starters[0]).toMatchObject({ points: 0, injury_status: 'NA' });
  expect(result.derived.shared_offense).toHaveLength(1);
  expect(result.unavailable).toContain('Players remaining and lineup locks');
  expect(JSON.stringify(result)).not.toContain('owner1');
  expect(matchupPacket(result, true).operator_context.lineup_settled).toBe(true);
});
test('honors zero commissioner override without rewriting individual scores', async () => {
  const data = rows(); data[1].custom_points = 0 as any;
  jest.mocked(sleeperClient.getLeagueMatchups).mockResolvedValue(data);
  const result = await buildWeeklyMatchup(url, '2026', 1);
  expect(result.observed.opponent.points).toBe(0);
  expect(result.observed.opponent.starters[0].points).toBe(12);
});
test('missing player score stays unknown and historical relationships stay unavailable', async () => {
  const data = rows(); delete (data[0] as any).players_points;
  jest.mocked(sleeperClient.getLeagueMatchups).mockResolvedValue(data);
  const result = await buildWeeklyMatchup(url, '2026', 2);
  expect(result.observed.you.starters[0].points).toBeNull();
  expect(result.derived.shared_offense).toEqual([]);
});
test.each(['season', 'missing', 'duplicate', 'unpaired', 'slots', 'membership', 'nonfinite'])('rejects %s corruption', async kind => {
  const data = rows();
  if (kind === 'missing') data.pop();
  if (kind === 'duplicate') data[1].roster_id = 1;
  if (kind === 'unpaired') data[1].matchup_id = 2;
  if (kind === 'slots') data[0].starters = [];
  if (kind === 'membership') data[0].players = [];
  if (kind === 'nonfinite') data[0].points = NaN;
  jest.mocked(sleeperClient.getLeagueMatchups).mockResolvedValue(data);
  await expect(buildWeeklyMatchup(url, kind === 'season' ? '2025' : '2026', 1)).rejects.toThrow();
});
