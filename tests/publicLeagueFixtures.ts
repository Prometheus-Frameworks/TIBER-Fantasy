import { compileSchedule, SCHEDULE_TEAMS } from '../server/modules/leagueMcp/schedule';
import type { PublicSources } from '../server/modules/publicLeagueMcp/sources';
import { createPublicLeagueTools } from '../server/modules/publicLeagueMcp/tools';
export const NOW = Date.parse('2026-10-28T16:00:00Z');
export const select = { userId: '123', leagueId: '10', season: '2026' };
export function schedule(season = '2026', receivedAt = new Date(NOW - 1000).toISOString()) {
  const rows = ['game_id,season,game_type,week,gameday,home_team,away_team'];
  for (let week = 1; week <= 17; week++) for (let i = 0; i < 32; i += 2) {
    rows.push(`synthetic_${week}_${i},${season},REG,${week},${season}-10-01,${SCHEDULE_TEAMS[i]},${SCHEDULE_TEAMS[i + 1]}`);
  }
  return compileSchedule(rows.join('\n'), season, receivedAt, '0'.repeat(64));
}
export function fixture() {
  let clock = NOW;
  const now = () => clock;
  const league = { league_id: '10', name: 'Synthetic league', sport: 'nfl', season: '2026', status: 'in_season', total_rosters: 2,
    roster_positions: ['TE', 'TE', 'BN', 'IR', 'TAXI'], scoring_settings: { rec: 1, bonus_rec_te: 0 },
    settings: { waiver_type: 2, waiver_budget: 100, best_ball: 0, playoff_week_start: 15 } };
  const rosters = [
    { roster_id: 1, league_id: '10', owner_id: '123', co_owners: ['789'], players: ['100', '101', '104', '105'], starters: ['100', '0'],
      reserve: ['104'], taxi: ['105'], settings: { waiver_budget_used: 21 } },
    { roster_id: 2, league_id: '10', owner_id: '456', co_owners: [] as string[], players: ['103'], starters: ['103'], reserve: [] as string[], taxi: [] as string[], settings: {} },
  ];
  const players: Record<string, any> = Object.fromEntries([
    ['100', 'Synthetic Starter', 'PIT'], ['101', 'Synthetic Bench', 'DET'], ['102', 'Synthetic Candidate', 'ATL'],
    ['103', 'Synthetic Rostered', 'BUF'], ['104', 'Synthetic Reserve', 'PIT'], ['105', 'Synthetic Taxi', 'PIT'],
  ].map(([player_id, full_name, team]) => [player_id, { player_id, full_name, team, position: 'TE', active: true, status: 'Active' }]));
  const calls = { league: 0, rosters: 0, directory: 0, state: 0, schedule: 0, user: 0, leagues: 0, matchups: 0 };
  const sources: PublicSources = {
    getLeague: async () => { calls.league++; return league; },
    getLeagueRosters: async () => { calls.rosters++; return rosters; },
    getDirectory: async () => { calls.directory++; return { fetchedAt: NOW - 2000, players }; },
    getUser: async () => { calls.user++; return { user_id: '123', display_name: 'Synthetic', username: 'synthetic' }; },
    getUserLeagues: async () => { calls.leagues++; return [league]; },
    getManagerNflState: async () => { calls.state++; return { season: '2026', season_type: 'regular', leg: 8 }; },
    getManagerMatchups: async (_id, week) => { calls.matchups++; if (typeof week !== 'number') throw Error('Expected conversion');
      return [{ roster_id: 1, matchup_id: 1, points: 99, custom_points: 0 }, { roster_id: 2, matchup_id: 1, points: 0 }]; },
    getSchedule: async season => { calls.schedule++; return schedule(season); },
  };
  return { sources, calls, league, rosters, players, now, setTime: (value: number) => { clock = value; },
    call: createPublicLeagueTools(sources, now) };
}
export function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((a, b) => { resolve = a; reject = b; });
  return { promise, resolve, reject };
}
