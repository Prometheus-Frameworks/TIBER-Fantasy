import {
  EvidenceIngestionTargetUnavailableError,
  getNewestCacheTimestamp,
  requireScheduleSyncDefaultSeason,
  resolveEvidenceIngestionDefaultTarget,
  resolveEvidenceIngestionTarget,
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

      const { CURRENT_SEASON, INGESTION_DEFAULT_SEASON } = await import('../season');
      expect(CURRENT_SEASON).toBe(2027);
      // The agreement endpoint and active no-argument ingestion paths consume
      // this exact alias, so an environment rollover cannot leave either job
      // pinned to a different hard-coded year.
      expect(INGESTION_DEFAULT_SEASON).toBe(CURRENT_SEASON);
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

describe('governed ingestion targets', () => {
  test('preseason planning Week 1 is not mislabelled as an evidence week', () => {
    expect(
      resolveEvidenceIngestionDefaultTarget(new Date('2026-08-12T12:00:00.000Z'), 2026),
    ).toEqual({
      available: false,
      code: 'no_evidence_week',
      reason: 'No regular-season evidence week is available for 2026 during 2026 · Preseason.',
      configuredSeason: 2026,
      phaseSeason: 2026,
    });

    // Schedule ingestion is explicitly forward-looking, so the same phase may
    // truthfully select the configured 2026 schedule without inventing stats.
    expect(requireScheduleSyncDefaultSeason(new Date('2026-08-12T12:00:00.000Z'), 2026)).toBe(2026);
  });

  test('January wall-clock rollover keeps the football season and week together', () => {
    expect(
      resolveEvidenceIngestionDefaultTarget(new Date('2027-01-05T12:00:00.000Z'), 2026),
    ).toEqual({
      available: true,
      target: { season: 2026, week: 17 },
    });
  });

  test('configured-season mismatch and stale calendar both fail closed', () => {
    expect(
      // A prematurely rolled TIBER_SEASON must not turn football-season 2026
      // evidence into a wall-clock 2027 write.
      resolveEvidenceIngestionDefaultTarget(new Date('2027-01-05T12:00:00.000Z'), 2027),
    ).toMatchObject({ available: false, code: 'season_mismatch' });

    expect(
      resolveEvidenceIngestionDefaultTarget(new Date('2031-10-01T12:00:00.000Z'), 2031),
    ).toMatchObject({ available: false, code: 'calendar_unavailable', phaseSeason: null });

    expect(
      resolveEvidenceIngestionDefaultTarget(new Date('2027-01-05T12:00:00.000Z'), Number.NaN),
    ).toMatchObject({ available: false, code: 'season_mismatch', phaseSeason: null });
  });

  test('fully explicit pairs remain usable while half-explicit archives cannot borrow a live week', () => {
    const preseason = new Date('2026-08-12T12:00:00.000Z');
    expect(resolveEvidenceIngestionTarget({ season: 2025, week: 18, now: preseason })).toEqual({
      season: 2025,
      week: 18,
    });

    expect(() =>
      resolveEvidenceIngestionTarget({
        season: 2025,
        now: new Date('2027-01-05T12:00:00.000Z'),
        configuredSeason: 2026,
      }),
    ).toThrow(/provide both season and week/);

    expect(() =>
      resolveEvidenceIngestionTarget({
        week: 5,
        now: new Date('2027-01-05T12:00:00.000Z'),
        configuredSeason: 2026,
      }),
    ).toThrow(/provide both season and week/);

    expect(resolveEvidenceIngestionTarget({
      week: 17,
      now: new Date('2027-01-05T12:00:00.000Z'),
      configuredSeason: 2026,
    })).toEqual({ season: 2026, week: 17 });
  });

  test('an unavailable default throws a typed 503 error', () => {
    expect(() =>
      resolveEvidenceIngestionTarget({
        now: new Date('2026-08-12T12:00:00.000Z'),
        configuredSeason: 2026,
      }),
    ).toThrow(EvidenceIngestionTargetUnavailableError);
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
