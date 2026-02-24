/**
 * FORGE Engine Unit Tests
 *
 * Tests pure math utility functions extracted from forgeEngine.ts and
 * roleConsistencyPillar.ts. All functions under test are stateless and
 * DB-free. The DB module is mocked to avoid the DATABASE_URL check at
 * import time.
 */

// Prevent db.ts from throwing when DATABASE_URL is not set.
// Path is relative to this test file (server/modules/forge/__tests__/) → server/infra/db
jest.mock('../../../infra/db', () => ({ db: {} }));

import {
  computePillarScore,
  normalizeRange,
  applyGamesPlayedDampening,
  type PillarConfig,
  type MetricLookupFn,
  type ForgePillarScores,
} from '../forgeEngine';

import { cvToScore } from '../roleConsistencyPillar';

// ---------------------------------------------------------------------------
// computePillarScore
// ---------------------------------------------------------------------------

describe('computePillarScore', () => {
  function makeLookup(map: Record<string, number | null>): MetricLookupFn {
    return (key) => map[key] ?? null;
  }

  it('returns weighted average for normal inputs', () => {
    const config: PillarConfig = {
      metrics: [
        { metricKey: 'a', source: 'role_bank', weight: 0.7 },
        { metricKey: 'b', source: 'role_bank', weight: 0.3 },
      ],
    };
    const lookup = makeLookup({ a: 80, b: 40 });
    // 80*0.7 + 40*0.3 = 56 + 12 = 68
    expect(computePillarScore(config, lookup)).toBeCloseTo(68, 5);
  });

  it('returns 50 when pillar config has no metrics', () => {
    const config: PillarConfig = { metrics: [] };
    const lookup = makeLookup({});
    expect(computePillarScore(config, lookup)).toBe(50);
  });

  it('returns 50 when all metrics are missing from lookup', () => {
    const config: PillarConfig = {
      metrics: [
        { metricKey: 'missing_a', source: 'role_bank', weight: 0.5 },
        { metricKey: 'missing_b', source: 'role_bank', weight: 0.5 },
      ],
    };
    const lookup = makeLookup({});
    expect(computePillarScore(config, lookup)).toBe(50);
  });

  it('skips null metrics but still weights non-null correctly', () => {
    const config: PillarConfig = {
      metrics: [
        { metricKey: 'present', source: 'role_bank', weight: 0.6 },
        { metricKey: 'absent', source: 'role_bank', weight: 0.4 },
      ],
    };
    const lookup = makeLookup({ present: 80, absent: null });
    // Only 'present' contributes; total=80*0.6=48, weightSum=0.6 → 48/0.6=80
    expect(computePillarScore(config, lookup)).toBeCloseTo(80, 5);
  });

  it('clamps output to [0, 100]', () => {
    const config: PillarConfig = {
      metrics: [{ metricKey: 'x', source: 'role_bank', weight: 1.0 }],
    };
    // A value > 100 passed in should still come out at 100
    const lookup = makeLookup({ x: 150 });
    expect(computePillarScore(config, lookup)).toBe(100);

    const lookupNeg = makeLookup({ x: -50 });
    expect(computePillarScore(config, lookupNeg)).toBe(0);
  });

  it('inverts metric when invert flag is set', () => {
    const config: PillarConfig = {
      metrics: [{ metricKey: 'sack', source: 'role_bank', weight: 1.0, invert: true }],
    };
    const lookup = makeLookup({ sack: 30 });
    // inverted: 100 - 30 = 70
    expect(computePillarScore(config, lookup)).toBeCloseTo(70, 5);
  });

  it('applies cap.min and cap.max to raw values', () => {
    const config: PillarConfig = {
      metrics: [
        { metricKey: 'v', source: 'role_bank', weight: 1.0, cap: { min: 20, max: 80 } },
      ],
    };
    expect(computePillarScore(config, makeLookup({ v: 5 }))).toBeCloseTo(20, 5);
    expect(computePillarScore(config, makeLookup({ v: 99 }))).toBeCloseTo(80, 5);
  });
});

// ---------------------------------------------------------------------------
// normalizeRange
// ---------------------------------------------------------------------------

describe('normalizeRange', () => {
  it('maps min to 0', () => {
    expect(normalizeRange(0, 0, 100)).toBe(0);
  });

  it('maps max to 100', () => {
    expect(normalizeRange(100, 0, 100)).toBe(100);
  });

  it('maps midpoint correctly', () => {
    expect(normalizeRange(50, 0, 100)).toBeCloseTo(50, 5);
  });

  it('returns 50 when min === max (avoids NaN)', () => {
    expect(normalizeRange(42, 42, 42)).toBe(50);
  });

  it('clamps values below min to 0', () => {
    expect(normalizeRange(-10, 0, 100)).toBe(0);
  });

  it('clamps values above max to 100', () => {
    expect(normalizeRange(200, 0, 100)).toBe(100);
  });

  it('handles negative ranges correctly', () => {
    // val=-0.1 in range [-0.2, 0.3] → ((-0.1 - -0.2) / 0.5) * 100 = 20
    expect(normalizeRange(-0.1, -0.2, 0.3)).toBeCloseTo(20, 4);
  });

  it('clamps to 0 when normalisation falls below 0 (inverted range edge)', () => {
    // With min=100, max=0 and val=200: norm = ((200-100)/(0-100))*100 = -100 → clamped to 0
    const result = normalizeRange(200, 100, 0);
    expect(result).toBe(0);
  });

  it('result is always a finite number', () => {
    const result = normalizeRange(0, 0, 0);
    expect(Number.isFinite(result)).toBe(true);
    expect(result).not.toBeNaN();
  });
});

// ---------------------------------------------------------------------------
// cvToScore
// ---------------------------------------------------------------------------

describe('cvToScore', () => {
  it('returns DEFAULT_LOW_SCORE (25) for fewer than 2 values', () => {
    expect(cvToScore([], 0.5)).toBe(25);
    expect(cvToScore([10], 0.5)).toBe(25);
  });

  it('returns DEFAULT_LOW_SCORE when mean is 0 or negative', () => {
    expect(cvToScore([0, 0, 0], 0.5)).toBe(25);
    expect(cvToScore([-1, -2, -3], 0.5)).toBe(25);
  });

  it('returns 100 for a perfectly consistent series (zero stdev)', () => {
    const result = cvToScore([10, 10, 10, 10], 0.5);
    expect(result).toBe(100);
  });

  it('returns 0 when CV is at or above the cap', () => {
    // stdev=10, mean=10 → cv=1.0; cap=0.5 → min(1.0/0.5,1)=1 → score=0
    const result = cvToScore([0, 10, 0, 10, 0, 10], 0.5);
    expect(result).toBe(0);
  });

  it('is monotone: higher CV produces lower score', () => {
    const consistentValues = [10, 11, 9, 10.5, 9.5]; // low CV
    const volatileValues = [2, 20, 2, 20, 2];          // high CV
    const consistent = cvToScore(consistentValues, 0.6);
    const volatile = cvToScore(volatileValues, 0.6);
    expect(consistent).toBeGreaterThan(volatile);
  });

  it('result is always in [0, 100]', () => {
    const result = cvToScore([1, 100, 1, 100, 50], 0.5);
    expect(result).toBeGreaterThanOrEqual(0);
    expect(result).toBeLessThanOrEqual(100);
  });

  it('result is always finite and not NaN', () => {
    const result = cvToScore([5, 10, 15, 20], 0.65);
    expect(Number.isFinite(result)).toBe(true);
    expect(result).not.toBeNaN();
  });
});

// ---------------------------------------------------------------------------
// applyGamesPlayedDampening
// ---------------------------------------------------------------------------

describe('applyGamesPlayedDampening', () => {
  const basePillars: ForgePillarScores = {
    volume: 80,
    efficiency: 70,
    teamContext: 60,
    stability: 90,
  };

  it('returns pillars unchanged when gamesPlayed >= minGames threshold', () => {
    // WR/RB/TE minGames = 10; QB minGames = 12
    const result = applyGamesPlayedDampening(basePillars, 10, 'WR');
    expect(result.volume).toBe(80);
    expect(result.efficiency).toBe(70);
    expect(result.teamContext).toBe(60);
    expect(result.stability).toBe(90);
  });

  it('pulls scores toward BASELINE_PILLAR (40) with low games played', () => {
    const result = applyGamesPlayedDampening(basePillars, 2, 'WR');
    // All scores > 40 should be pulled down toward 40
    expect(result.volume).toBeLessThan(80);
    expect(result.efficiency).toBeLessThan(70);
    expect(result.stability).toBeLessThan(90);
  });

  it('does not change rank order of pillars after dampening', () => {
    const result = applyGamesPlayedDampening(basePillars, 3, 'WR');
    // stability (90) > volume (80) > efficiency (70) > teamContext (60) before dampening
    expect(result.stability).toBeGreaterThan(result.volume);
    expect(result.volume).toBeGreaterThan(result.efficiency);
    expect(result.efficiency).toBeGreaterThan(result.teamContext);
  });

  it('dampens dynastyContext when present', () => {
    const withDynasty: ForgePillarScores = { ...basePillars, dynastyContext: 85 };
    const result = applyGamesPlayedDampening(withDynasty, 2, 'WR');
    expect(result.dynastyContext).toBeDefined();
    expect(result.dynastyContext!).toBeLessThan(85);
  });

  it('keeps dynastyContext undefined when not present', () => {
    const result = applyGamesPlayedDampening(basePillars, 2, 'WR');
    expect(result.dynastyContext).toBeUndefined();
  });

  it('all dampened scores are finite and in [0, 100]', () => {
    const result = applyGamesPlayedDampening(basePillars, 1, 'QB');
    for (const score of [result.volume, result.efficiency, result.teamContext, result.stability]) {
      expect(Number.isFinite(score)).toBe(true);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    }
  });
});
