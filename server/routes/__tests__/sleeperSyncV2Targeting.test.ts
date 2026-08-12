import express from 'express';
import request from 'supertest';

const mockSyncLeague = jest.fn();

jest.mock('../../infra/db', () => ({ db: {} }));
jest.mock('../../services/sleeperSyncV2', () => ({
  syncLeague: mockSyncLeague,
  getSyncStatus: jest.fn(),
  getUnresolvedPlayerCount: jest.fn(),
  getStoredLeagues: jest.fn(),
  getSchedulerStatus: jest.fn(),
}));

import sleeperSyncV2Routes from '../sleeperSyncV2Routes';
import { SourceObservedTargetUnavailableError } from '../../config/season';

const app = express();
app.use(express.json());
app.use('/api/sleeper/sync', sleeperSyncV2Routes);

const successResult = {
  success: true,
  leagueId: 'league-1',
  eventsInserted: 0,
  shortCircuited: true,
  baseline: false,
  durationMs: 1,
  hash: 'hash',
  resolverStats: {
    total: 0,
    resolvedByGsisId: 0,
    resolvedBySleeperId: 0,
    unresolved: 0,
  },
};

describe('Sleeper Sync V2 manual target boundary', () => {
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    mockSyncLeague.mockResolvedValue(successResult);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  test('omitted pair delegates to the source-observed default resolver', async () => {
    const response = await request(app)
      .post('/api/sleeper/sync/run')
      .send({ leagueId: 'league-1' });

    expect(response.status).toBe(200);
    expect(mockSyncLeague).toHaveBeenCalledWith('league-1', {
      force: false,
      season: undefined,
      week: undefined,
    });
  });

  test('fully explicit archive pair is forwarded unchanged', async () => {
    const response = await request(app)
      .post('/api/sleeper/sync/run')
      .send({ leagueId: 'league-1', season: 2025, week: 18 });

    expect(response.status).toBe(200);
    expect(mockSyncLeague).toHaveBeenCalledWith('league-1', {
      force: false,
      season: 2025,
      week: 18,
    });
  });

  test.each([
    { season: 2026 },
    { week: 1 },
  ])('half-explicit pair is rejected before sync: %p', async (body) => {
    const response = await request(app)
      .post('/api/sleeper/sync/run')
      .send({ leagueId: 'league-1', ...body });

    expect(response.status).toBe(400);
    expect(mockSyncLeague).not.toHaveBeenCalled();
  });

  test('typed stale-calendar failure is returned as 503', async () => {
    mockSyncLeague.mockRejectedValue(new SourceObservedTargetUnavailableError({
      available: false,
      code: 'calendar_unavailable',
      reason: 'calendar stale',
      configuredSeason: 2026,
      phaseSeason: null,
    }));

    const response = await request(app)
      .post('/api/sleeper/sync/run')
      .send({ leagueId: 'league-1' });

    expect(response.status).toBe(503);
  });
});
