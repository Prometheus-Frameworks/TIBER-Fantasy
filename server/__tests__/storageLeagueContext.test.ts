jest.mock('../infra/db', () => ({
  db: {
    execute: jest.fn(),
    select: jest.fn(() => ({ from: jest.fn().mockResolvedValue([{ id: 1 }]) })),
    insert: jest.fn(() => ({ values: jest.fn(() => ({ returning: jest.fn().mockResolvedValue([]) })) })),
  },
}));

import { db } from '../infra/db';
import { DatabaseStorage } from '../storage';

const executeMock = db.execute as jest.Mock;

describe('DatabaseStorage league context raw row normalization', () => {
  let storage: DatabaseStorage;

  beforeEach(() => {
    storage = new DatabaseStorage();
    executeMock.mockReset();
  });

  it('sets active league context when the team row only has snake_case league_id', async () => {
    executeMock
      .mockResolvedValueOnce({ rows: [{ id: 'league-1' }] })
      .mockResolvedValueOnce({ rows: [{ id: 'team-1', league_id: 'league-1', display_name: 'H4MMER' }] })
      .mockResolvedValueOnce({
        rows: [{
          user_id: 'default_user',
          active_league_id: 'league-1',
          active_team_id: 'team-1',
          updated_at: new Date('2026-01-01T00:00:00.000Z'),
        }],
      });

    const preference = await storage.setUserLeagueContext({
      userId: 'default_user',
      leagueId: 'league-1',
      teamId: 'team-1',
    });

    expect(preference.activeLeagueId).toBe('league-1');
    expect(preference.activeTeamId).toBe('team-1');
    expect(executeMock).toHaveBeenCalledTimes(3);
  });

  it('loads active context when the preference row only has snake_case active ids', async () => {
    executeMock
      .mockResolvedValueOnce({
        rows: [{
          user_id: 'default_user',
          active_league_id: 'league-1',
          active_team_id: 'team-1',
        }],
      })
      .mockResolvedValueOnce({ rows: [{ id: 'league-1', league_name: 'Sleeper League' }] })
      .mockResolvedValueOnce({ rows: [{ id: 'team-1', league_id: 'league-1', display_name: 'H4MMER' }] });

    const context = await storage.getUserLeagueContext('default_user');

    expect(context.preference?.activeLeagueId).toBe('league-1');
    expect(context.preference?.activeTeamId).toBe('team-1');
    expect(context.activeLeague?.id).toBe('league-1');
    expect(context.activeTeam?.id).toBe('team-1');
    expect(context.activeTeam?.displayName ?? (context.activeTeam as any)?.display_name).toBe('H4MMER');
  });
});
