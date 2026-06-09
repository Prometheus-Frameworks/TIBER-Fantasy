import {
  DEFAULT_ARTIFACT_MAX_AGE_DAYS,
  assessAndLogArtifactFreshness,
  assessArtifactFreshness,
  pickNewestTimestamp,
  resetArtifactFreshnessLogThrottle,
} from '../artifactFreshness';

const NOW = new Date('2026-06-09T12:00:00.000Z');

function daysAgo(days: number): string {
  return new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
}

describe('assessArtifactFreshness', () => {
  it('returns fresh when age is within maxAgeDays', () => {
    const result = assessArtifactFreshness({ artifact: 'test', generatedAt: daysAgo(10), now: NOW });
    expect(result).toEqual({
      status: 'fresh',
      ageDays: 10,
      timestamp: daysAgo(10),
      maxAgeDays: DEFAULT_ARTIFACT_MAX_AGE_DAYS,
    });
  });

  it('returns warning when age is between maxAgeDays and 2x maxAgeDays', () => {
    const result = assessArtifactFreshness({ artifact: 'test', generatedAt: daysAgo(60), now: NOW });
    expect(result.status).toBe('warning');
    expect(result.ageDays).toBe(60);
  });

  it('returns stale when age exceeds 2x maxAgeDays', () => {
    const result = assessArtifactFreshness({ artifact: 'test', generatedAt: daysAgo(120), now: NOW });
    expect(result.status).toBe('stale');
    expect(result.ageDays).toBe(120);
  });

  it('respects a custom maxAgeDays', () => {
    const result = assessArtifactFreshness({ artifact: 'test', generatedAt: daysAgo(10), maxAgeDays: 7, now: NOW });
    expect(result.status).toBe('warning');
    expect(result.maxAgeDays).toBe(7);
  });

  it('prefers generatedAt over promotedAt', () => {
    const result = assessArtifactFreshness({
      artifact: 'test',
      generatedAt: daysAgo(10),
      promotedAt: daysAgo(2),
      now: NOW,
    });
    expect(result.timestamp).toBe(daysAgo(10));
    expect(result.ageDays).toBe(10);
  });

  it('falls back to promotedAt when generatedAt is missing or malformed', () => {
    const missing = assessArtifactFreshness({ artifact: 'test', promotedAt: daysAgo(3), now: NOW });
    expect(missing.status).toBe('fresh');
    expect(missing.ageDays).toBe(3);

    const malformed = assessArtifactFreshness({
      artifact: 'test',
      generatedAt: 'not-a-date',
      promotedAt: daysAgo(3),
      now: NOW,
    });
    expect(malformed.timestamp).toBe(daysAgo(3));
  });

  it('returns unknown (and never throws) for missing or malformed timestamps', () => {
    expect(assessArtifactFreshness({ artifact: 'test', now: NOW }).status).toBe('unknown');
    expect(assessArtifactFreshness({ artifact: 'test', generatedAt: null, now: NOW }).status).toBe('unknown');
    expect(assessArtifactFreshness({ artifact: 'test', generatedAt: '', now: NOW }).status).toBe('unknown');
    const malformed = assessArtifactFreshness({ artifact: 'test', generatedAt: 'garbage', promotedAt: 'x', now: NOW });
    expect(malformed).toEqual({
      status: 'unknown',
      ageDays: null,
      timestamp: null,
      maxAgeDays: DEFAULT_ARTIFACT_MAX_AGE_DAYS,
    });
  });

  it('treats future timestamps (clock skew) as age 0 / fresh', () => {
    const result = assessArtifactFreshness({ artifact: 'test', generatedAt: daysAgo(-2), now: NOW });
    expect(result.status).toBe('fresh');
    expect(result.ageDays).toBe(0);
  });
});

describe('pickNewestTimestamp', () => {
  it('picks the newest parseable timestamp and ignores junk', () => {
    expect(pickNewestTimestamp([daysAgo(30), 'garbage', null, undefined, daysAgo(5), daysAgo(10)])).toBe(daysAgo(5));
  });

  it('returns null when nothing is parseable', () => {
    expect(pickNewestTimestamp([null, undefined, '', 'garbage'])).toBeNull();
  });
});

describe('assessAndLogArtifactFreshness', () => {
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    resetArtifactFreshnessLogThrottle();
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('does not log for fresh artifacts', () => {
    assessAndLogArtifactFreshness({ artifact: 'fresh_artifact', generatedAt: daysAgo(1), now: NOW });
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('logs metadata (not payloads) for stale and unknown artifacts', () => {
    assessAndLogArtifactFreshness({ artifact: 'stale_artifact', generatedAt: daysAgo(200), now: NOW });
    assessAndLogArtifactFreshness({ artifact: 'unknown_artifact', generatedAt: null, now: NOW });
    expect(warnSpy).toHaveBeenCalledTimes(2);
    expect(warnSpy.mock.calls[0][0]).toContain('stale_artifact: status=stale ageDays=200');
    expect(warnSpy.mock.calls[1][0]).toContain('unknown_artifact: status=unknown');
  });

  it('throttles repeated warnings for the same artifact and status', () => {
    for (let i = 0; i < 5; i++) {
      assessAndLogArtifactFreshness({ artifact: 'hot_path', generatedAt: daysAgo(200), now: NOW });
    }
    expect(warnSpy).toHaveBeenCalledTimes(1);

    // After the throttle window elapses, it logs again.
    const later = new Date(NOW.getTime() + 7 * 60 * 60 * 1000);
    assessAndLogArtifactFreshness({ artifact: 'hot_path', generatedAt: daysAgo(200), now: later });
    expect(warnSpy).toHaveBeenCalledTimes(2);
  });

  it('still returns the assessment when log is throttled', () => {
    const first = assessAndLogArtifactFreshness({ artifact: 'a', generatedAt: daysAgo(200), now: NOW });
    const second = assessAndLogArtifactFreshness({ artifact: 'a', generatedAt: daysAgo(200), now: NOW });
    expect(first.status).toBe('stale');
    expect(second).toEqual(first);
  });
});
