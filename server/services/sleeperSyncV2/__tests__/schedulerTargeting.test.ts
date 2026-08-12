const mockOrderBy = jest.fn();
const mockSyncLeague = jest.fn();

jest.mock('../../../infra/db', () => ({
  db: {
    select: jest.fn(() => ({
      from: jest.fn(() => ({ orderBy: mockOrderBy })),
    })),
  },
}));
jest.mock('../syncService', () => ({
  syncLeague: mockSyncLeague,
}));

import { runSyncCycle } from '../scheduler';
import { SourceObservedTargetUnavailableError } from '../../../config/season';

describe('Sleeper Sync V2 scheduled target boundary', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    mockOrderBy.mockResolvedValue([{
      leagueId: 'league-1',
      status: 'ok',
      lastSyncedAt: null,
      changeSeq: 2,
    }]);
    mockSyncLeague.mockResolvedValue({
      success: true,
      eventsInserted: 0,
      baseline: false,
      shortCircuited: true,
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  test('January cycle passes 2026 Week 17 atomically to every league sync', async () => {
    jest.setSystemTime(new Date('2027-01-05T12:00:00.000Z'));

    await runSyncCycle();

    expect(mockSyncLeague).toHaveBeenCalledWith('league-1', {
      season: 2026,
      week: 17,
    });
  });

  test('preseason cycle remains active and attributes observations to 2026 Week 1', async () => {
    jest.setSystemTime(new Date('2026-08-12T12:00:00.000Z'));

    await runSyncCycle();

    expect(mockSyncLeague).toHaveBeenCalledWith('league-1', {
      season: 2026,
      week: 1,
    });
  });

  test('stale calendar stops the cycle before a league sync begins', async () => {
    jest.setSystemTime(new Date('2031-10-01T12:00:00.000Z'));

    await expect(runSyncCycle()).rejects.toBeInstanceOf(SourceObservedTargetUnavailableError);
    expect(mockSyncLeague).not.toHaveBeenCalled();
  });
});
