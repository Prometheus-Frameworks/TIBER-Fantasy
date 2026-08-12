const mockExecute = jest.fn();
const mockValues = jest.fn();

jest.mock('../../infra/db', () => ({
  db: {
    execute: mockExecute,
    insert: jest.fn(() => ({ values: mockValues })),
  },
}));

import { SeasonService } from '../../services/SeasonService';
import { SourceObservedTargetUnavailableError } from '../season';

describe('SeasonService source-observed fallback', () => {
  const originalTiberWeek = process.env.TIBER_WEEK;

  beforeEach(() => {
    jest.useFakeTimers();
    delete process.env.TIBER_WEEK;
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    jest.spyOn(global, 'fetch').mockRejectedValue(new Error('Sleeper unavailable'));
    mockExecute.mockRejectedValue(new Error('DB unavailable'));
    mockValues.mockResolvedValue(undefined);
  });

  afterEach(() => {
    if (originalTiberWeek === undefined) {
      delete process.env.TIBER_WEEK;
    } else {
      process.env.TIBER_WEEK = originalTiberWeek;
    }
    jest.useRealTimers();
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  test('August fallback keeps valid preseason observations on 2026 Week 1', async () => {
    jest.setSystemTime(new Date('2026-08-12T12:00:00.000Z'));

    await expect(new SeasonService().current()).resolves.toEqual({
      season: 2026,
      week: 1,
      seasonType: 'pre',
      source: 'env',
    });
    expect(mockValues).toHaveBeenCalledWith(expect.objectContaining({
      source: 'env',
      season: 2026,
      week: 1,
    }));
  });

  test('January fallback keeps the football season and in-flight week together', async () => {
    jest.setSystemTime(new Date('2027-01-05T12:00:00.000Z'));

    await expect(new SeasonService().current()).resolves.toMatchObject({
      season: 2026,
      week: 17,
      seasonType: 'regular',
      source: 'env',
    });
  });

  test('stale final fallback fails before persisting an invented tuple', async () => {
    jest.setSystemTime(new Date('2031-10-01T12:00:00.000Z'));

    await expect(new SeasonService().current()).rejects.toBeInstanceOf(
      SourceObservedTargetUnavailableError,
    );
    expect(mockValues).not.toHaveBeenCalled();
  });

  test('a valid Sleeper-observed pair remains primary even beyond configured calendar time', async () => {
    jest.setSystemTime(new Date('2031-10-01T12:00:00.000Z'));
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        season: '2026',
        season_type: 'post',
        week: 18,
      }),
    });

    await expect(new SeasonService().current()).resolves.toEqual({
      season: 2026,
      week: 18,
      seasonType: 'post',
      source: 'sleeper',
    });
  });

  test('a valid database-observed pair remains the second source of truth', async () => {
    jest.setSystemTime(new Date('2031-10-01T12:00:00.000Z'));
    mockExecute.mockResolvedValue({ rows: [{ season: 2024, week: 12 }] });

    await expect(new SeasonService().current()).resolves.toEqual({
      season: 2024,
      week: 12,
      seasonType: 'regular',
      source: 'db',
    });
  });

  test('an explicit configured week is paired with the central configured season', async () => {
    jest.setSystemTime(new Date('2026-08-12T12:00:00.000Z'));
    process.env.TIBER_WEEK = '18';

    await expect(new SeasonService().current()).resolves.toMatchObject({
      season: 2026,
      week: 18,
      source: 'env',
    });
  });
});
