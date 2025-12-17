import { playerIdentityMap } from '@shared/schema';

let computeLeagueDashboard: typeof import('../leagueDashboardService').computeLeagueDashboard;

function createDbMock({ identities = [], forgeRows = [], insertSpy }: { identities?: any[]; forgeRows?: any[]; insertSpy?: jest.Mock }) {
  return {
    select: jest.fn(() => ({
      from: (table: any) => ({
        where: () => {
          if (table === playerIdentityMap) {
            return Promise.resolve(identities);
          }
          return {
            orderBy: () => Promise.resolve(forgeRows),
          };
        },
        orderBy: () => Promise.resolve(forgeRows),
      }),
    })),
    insert: jest.fn(() => ({
      values: (rows: any) => {
        insertSpy?.(rows);
        return {
          onConflictDoUpdate: jest.fn().mockResolvedValue(undefined),
        };
      },
    })),
  } as any;
}

jest.mock('../../infra/db', () => ({ db: {} }));
jest.mock('../../storage', () => ({ storage: {} }));

describe('computeLeagueDashboard', () => {
  beforeAll(async () => {
    process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgres://example.com/testdb';
    computeLeagueDashboard = (await import('../leagueDashboardService')).computeLeagueDashboard;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const baseLeague = {
    id: 'league1',
    season: 2024,
    userId: 'u1',
    leagueIdExternal: 'ext1',
    teams: [
      { id: 'team1', externalUserId: 'owner1', displayName: 'Team One' },
    ],
  } as any;

  const sleeperDeps = {
    getLeagueRosters: jest.fn().mockResolvedValue([{ owner_id: 'owner1', players: ['s1'] }]),
    getLeague: jest.fn().mockResolvedValue({ season: 2024, week: 1 }),
  };

  const storageDeps = {
    getLeagueWithTeams: jest.fn().mockResolvedValue(baseLeague),
    getLeagueDashboardSnapshot: jest.fn().mockResolvedValue(null),
    saveLeagueDashboardSnapshot: jest.fn().mockResolvedValue(undefined),
  };

  const forgeScore = {
    playerId: 'p1',
    playerName: 'Player One',
    position: 'WR',
    season: 2024,
    asOfWeek: 1,
    alpha: 50,
    rawAlpha: 48,
    subScores: {} as any,
    trajectory: 'up',
    confidence: 90,
    gamesPlayed: 1,
    dataQuality: {
      hasAdvancedStats: true,
      hasSnapData: true,
      hasDvPData: true,
      hasEnvironmentData: true,
      cappedDueToMissingData: false,
    },
    scoredAt: new Date(),
  };

  it('computes FORGE on cache miss when identities resolve', async () => {
    const dbMock = createDbMock({ identities: [{ sleeperId: 's1', canonicalId: 'p1', position: 'WR', fullName: 'Player One' }] });
    const insertSpy = jest.fn();
    (dbMock.insert as jest.Mock).mockImplementation(() => ({
      values: (rows: any) => {
        insertSpy(rows);
        return { onConflictDoUpdate: jest.fn().mockResolvedValue(undefined) };
      },
    }));

    const result = await computeLeagueDashboard(
      { userId: 'u1', leagueId: 'league1', week: 1, season: 2024 },
      {
        storage: storageDeps as any,
        sleeperClient: sleeperDeps as any,
        db: dbMock,
        forgeService: { getForgeScoresForPlayers: jest.fn().mockResolvedValue([forgeScore]) } as any,
      }
    );

    expect(result.teams[0].overall_total).toBeGreaterThan(0);
    expect(result.unresolvedPlayers).toEqual([]);
    expect(result.diagnostics?.computedForgeCount).toBe(1);
    expect(insertSpy).toHaveBeenCalled();
  });

  it('surfaces unmapped sleeper ids without synthetic canonical ids', async () => {
    const forgeServiceMock = { getForgeScoresForPlayers: jest.fn().mockResolvedValue([]) };
    const result = await computeLeagueDashboard(
      { userId: 'u1', leagueId: 'league1', week: 1, season: 2024 },
      {
        storage: storageDeps as any,
        sleeperClient: sleeperDeps as any,
        db: createDbMock({ identities: [] }),
        forgeService: forgeServiceMock as any,
      }
    );

    expect(result.unresolvedPlayers.length).toBe(1);
    expect(result.unresolvedPlayers[0]).toEqual({ sleeperId: 's1', reason: 'unmapped_sleeper_id' });
    expect(forgeServiceMock.getForgeScoresForPlayers).not.toHaveBeenCalled();
    const rosterPlayer = result.teams[0].roster[0];
    expect(rosterPlayer.canonicalId).toBeNull();
    expect(rosterPlayer.alpha).toBeNull();
    expect(rosterPlayer.missingReason).toBe('unmapped_sleeper_id');
  });

  it('defaults week to latest league week when not provided', async () => {
    const dbMock = createDbMock({
      identities: [{ sleeperId: 's1', canonicalId: 'p1', position: 'WR', fullName: 'Player One' }],
      forgeRows: [{ playerId: 'p1', alphaFinal: 55, alphaRaw: 55, season: 2024, week: 3, computedAt: new Date() }],
    });

    const storageMock = {
      ...storageDeps,
      getLeagueDashboardSnapshot: jest.fn().mockResolvedValue(null),
      saveLeagueDashboardSnapshot: jest.fn().mockResolvedValue(undefined),
    };

    const result = await computeLeagueDashboard(
      { userId: 'u1', leagueId: 'league1', season: 2024 },
      {
        storage: storageMock as any,
        sleeperClient: {
          ...sleeperDeps,
          getLeague: jest.fn().mockResolvedValue({ season: 2024, week: 3 }),
        } as any,
        db: dbMock,
        forgeService: { getForgeScoresForPlayers: jest.fn().mockResolvedValue([]) } as any,
      }
    );

    expect(result.meta.week).toBe(3);
    expect(storageMock.saveLeagueDashboardSnapshot).toHaveBeenCalled();
    const callArgs = (storageMock.saveLeagueDashboardSnapshot as jest.Mock).mock.calls[0][0];
    expect(callArgs.week).toBe(3);
  });
});
