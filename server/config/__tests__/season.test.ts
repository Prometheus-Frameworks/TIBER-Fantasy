import {
  getNewestCacheTimestamp,
  resolveCurrentSeason,
  warnIfCacheStale,
} from '../season';

const DAY_MS = 24 * 60 * 60 * 1000;

describe('season configuration', () => {
  test('defaults to 2026 and accepts a four-digit TIBER_SEASON override', () => {
    expect(resolveCurrentSeason(undefined)).toBe(2026);
    expect(resolveCurrentSeason('2027')).toBe(2027);
  });

  test('falls back to 2026 for malformed overrides', () => {
    expect(resolveCurrentSeason('')).toBe(2026);
    expect(resolveCurrentSeason('next-season')).toBe(2026);
    expect(resolveCurrentSeason('27')).toBe(2026);
  });

  test('reads TIBER_SEASON when CURRENT_SEASON is initialized', async () => {
    const previousSeason = process.env.TIBER_SEASON;

    try {
      process.env.TIBER_SEASON = '2027';
      jest.resetModules();

      const { CURRENT_SEASON } = await import('../season');
      expect(CURRENT_SEASON).toBe(2027);
    } finally {
      if (previousSeason === undefined) {
        delete process.env.TIBER_SEASON;
      } else {
        process.env.TIBER_SEASON = previousSeason;
      }
      jest.resetModules();
    }
  });

  test('selects the newest valid cache timestamp', () => {
    expect(getNewestCacheTimestamp([
      1_762_000_000_000,
      null,
      'not-a-date',
      '2025-11-02T12:30:04.229Z',
      new Date('2025-10-01T00:00:00.000Z'),
    ])?.toISOString()).toBe('2025-11-02T12:30:04.229Z');
  });
});

describe('warnIfCacheStale', () => {
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  test.each([
    new Date('2026-08-10T00:00:00.000Z'),
    new Date('2027-01-10T00:00:00.000Z'),
  ])('warns for caches older than seven days in Aug-Jan (%s)', (now) => {
    const newestTimestamp = new Date(now.getTime() - 8 * DAY_MS);

    expect(warnIfCacheStale('server/data/cache.json', newestTimestamp, now)).toBe(true);
    expect(warnSpy).toHaveBeenCalledTimes(1);

    const warning = JSON.parse(warnSpy.mock.calls[0][0]);
    expect(warning).toMatchObject({
      level: 'warn',
      src: 'SeasonConfig',
      cache_file: 'server/data/cache.json',
      newest_timestamp: newestTimestamp.toISOString(),
      age_days: 8,
      threshold_days: 7,
    });
  });

  test.each([
    new Date('2026-02-10T00:00:00.000Z'),
    new Date('2026-07-10T00:00:00.000Z'),
  ])('does not warn outside Aug-Jan (%s)', (now) => {
    const newestTimestamp = new Date(now.getTime() - 30 * DAY_MS);

    expect(warnIfCacheStale('server/data/cache.json', newestTimestamp, now)).toBe(false);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  test('uses a strict greater-than-seven-days boundary', () => {
    const now = new Date('2026-09-10T00:00:00.000Z');

    expect(warnIfCacheStale('cache.json', now.getTime() - 7 * DAY_MS, now)).toBe(false);
    expect(warnIfCacheStale('cache.json', now.getTime() - 7 * DAY_MS - 1, now)).toBe(true);
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  test.each([null, undefined, 'not-a-date', Number.NaN, Number.POSITIVE_INFINITY, -1e20])(
    'does not warn for an unusable timestamp (%s)',
    (newestTimestamp) => {
      const now = new Date('2026-10-10T00:00:00.000Z');

      expect(warnIfCacheStale('cache.json', newestTimestamp, now)).toBe(false);
      expect(warnSpy).not.toHaveBeenCalled();
    },
  );

  test('does not warn for a future timestamp', () => {
    const now = new Date('2026-11-10T00:00:00.000Z');

    expect(warnIfCacheStale('cache.json', new Date(now.getTime() + DAY_MS), now)).toBe(false);
    expect(warnSpy).not.toHaveBeenCalled();
  });
});
