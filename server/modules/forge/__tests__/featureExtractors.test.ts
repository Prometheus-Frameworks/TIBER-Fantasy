/**
 * Position Feature Extractor Tests
 *
 * Verifies that each position feature builder:
 *   1. Returns a bundle with the expected shape and metric keys
 *   2. Handles missing / null stats gracefully (no crashes)
 *   3. Produces values that are finite numbers in reasonable ranges
 */

import { buildWRFeatures } from '../features/wrFeatures';
import { buildRBFeatures } from '../features/rbFeatures';
import { buildTEFeatures } from '../features/teFeatures';
import { buildQBFeatures } from '../features/qbFeatures';
import type { ForgeContext } from '../types';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function makeWeeklyStats(weeks: number, ppg = 12): ForgeContext['weeklyStats'] {
  return Array.from({ length: weeks }, (_, i) => ({
    week: i + 1,
    fantasyPointsPpr: ppg,
    snapShare: 0.85,
    targets: 6,
    receptions: 4,
    rushAttempts: 3,
  }));
}

/** A minimal, fully-populated ForgeContext usable by every position builder. */
function baseContext(
  position: ForgeContext['position'],
  overrides: Partial<ForgeContext> = {}
): ForgeContext {
  return {
    playerId: 'test-player',
    playerName: 'Test Player',
    position,
    nflTeam: 'KC',
    season: 2025,
    asOfWeek: 10,
    age: 26,
    identity: { canonicalId: 'test-player', isActive: true },
    seasonStats: {
      gamesPlayed: 10,
      gamesStarted: 10,
      snapCount: 600,
      snapShare: 0.85,
      fantasyPointsPpr: 140,
      fantasyPointsHalfPpr: 120,
      targets: 80,
      receptions: 60,
      receivingYards: 750,
      receivingTds: 5,
      rushAttempts: 40,
      rushYards: 200,
      rushTds: 2,
      passingAttempts: 300,
      passingYards: 3200,
      passingTds: 22,
      interceptions: 8,
      targetShare: 0.25,
      airYards: 900,
      redZoneTargets: 12,
      redZoneCarries: 8,
    },
    advancedMetrics: {
      yprr: 2.1,
      epaPerTarget: 0.18,
      epaPerRush: 0.08,
      epaPerPlay: 0.15,
      cpoe: 3.5,
      aypa: 7.5,
      yardsPerCarry: 4.8,
      yardsAfterContact: 2.8,
      missedTacklesForced: 0.12,
    },
    weeklyStats: makeWeeklyStats(10),
    roleMetrics: {
      routeRate: 0.88,
      slotRate: 0.45,
      backfieldTouchShare: 0.70,
    },
    teamEnvironment: {
      team: 'KC',
      passAttemptsPerGame: 36,
      rushAttemptsPerGame: 22,
      pace: 0.75,
      proePct: 60,
      pacePct: 70,
    },
    dvpData: { position, fantasyPtsAllowedPpr: 22, rank: 15 },
    ...overrides,
  };
}

/** Assert all sub-scores in the bundle are finite numbers in [0, 100]. */
function expectValidBundle(bundle: ReturnType<typeof buildWRFeatures>): void {
  const scores = [
    bundle.volumeFeatures.score,
    bundle.efficiencyFeatures.score,
    bundle.stabilityFeatures.score,
    bundle.contextFitFeatures.score,
  ];

  for (const score of scores) {
    expect(typeof score).toBe('number');
    expect(Number.isFinite(score)).toBe(true);
    expect(score).not.toBeNaN();
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  }

  // Normalized sub-maps should only contain finite numbers in [0, 100]
  for (const val of Object.values(bundle.volumeFeatures.normalized)) {
    expect(Number.isFinite(val)).toBe(true);
    expect(val).toBeGreaterThanOrEqual(0);
    expect(val).toBeLessThanOrEqual(100);
  }
}

// ---------------------------------------------------------------------------
// WR Feature Builder
// ---------------------------------------------------------------------------

describe('buildWRFeatures', () => {
  it('returns a bundle with position WR and expected keys', () => {
    const bundle = buildWRFeatures(baseContext('WR'));
    expect(bundle.position).toBe('WR');
    expect(typeof bundle.gamesPlayed).toBe('number');

    // Volume normalized keys
    expect(bundle.volumeFeatures.normalized).toHaveProperty('targetsPerGame');
    expect(bundle.volumeFeatures.normalized).toHaveProperty('targetShare');
    expect(bundle.volumeFeatures.normalized).toHaveProperty('rzTargetsPerGame');

    // Efficiency normalized keys
    expect(bundle.efficiencyFeatures.normalized).toHaveProperty('yardsPerTarget');
    expect(bundle.efficiencyFeatures.normalized).toHaveProperty('catchRateOE');

    // Stability keys
    expect(bundle.stabilityFeatures).toHaveProperty('score');
    expect(bundle.stabilityFeatures).toHaveProperty('floorWeekRate');
    expect(bundle.stabilityFeatures).toHaveProperty('boomWeekRate');

    // dataQuality flags
    expect(bundle.dataQuality).toHaveProperty('hasAdvancedStats');
    expect(bundle.dataQuality).toHaveProperty('hasSnapData');
  });

  it('produces valid scores for a fully-populated context', () => {
    expectValidBundle(buildWRFeatures(baseContext('WR')));
  });

  it('handles completely empty stats without crashing', () => {
    const ctx = baseContext('WR', {
      seasonStats: {
        gamesPlayed: 0,
        gamesStarted: 0,
        snapCount: 0,
        snapShare: 0,
        fantasyPointsPpr: 0,
        fantasyPointsHalfPpr: 0,
      },
      advancedMetrics: undefined,
      weeklyStats: [],
      roleMetrics: undefined,
      teamEnvironment: undefined,
      dvpData: undefined,
    });
    expect(() => buildWRFeatures(ctx)).not.toThrow();
    const bundle = buildWRFeatures(ctx);
    expectValidBundle(bundle);
  });

  it('caps scores at LESS_THAN_3_GAMES when gamesPlayed < 3', () => {
    const ctx = baseContext('WR', {
      seasonStats: {
        gamesPlayed: 2,
        gamesStarted: 2,
        snapCount: 100,
        snapShare: 0.8,
        fantasyPointsPpr: 30,
        fantasyPointsHalfPpr: 25,
        targets: 10,
        receptions: 8,
        receivingYards: 90,
        receivingTds: 1,
      },
      weeklyStats: makeWeeklyStats(2),
    });
    const bundle = buildWRFeatures(ctx);
    // MISSING_DATA_CAPS.LESS_THAN_3_GAMES = 75
    expect(bundle.volumeFeatures.score).toBeLessThanOrEqual(75);
    expect(bundle.efficiencyFeatures.score).toBeLessThanOrEqual(75);
    expect(bundle.stabilityFeatures.score).toBeLessThanOrEqual(75);
  });

  it('sets isNeutral=true when no environment or DvP data', () => {
    const ctx = baseContext('WR', {
      teamEnvironment: undefined,
      dvpData: undefined,
    });
    const bundle = buildWRFeatures(ctx);
    expect(bundle.contextFitFeatures.isNeutral).toBe(true);
    expect(bundle.contextFitFeatures.score).toBe(50);
  });
});

// ---------------------------------------------------------------------------
// RB Feature Builder
// ---------------------------------------------------------------------------

describe('buildRBFeatures', () => {
  it('returns a bundle with position RB and expected keys', () => {
    const bundle = buildRBFeatures(baseContext('RB'));
    expect(bundle.position).toBe('RB');
    expect(bundle.volumeFeatures.normalized).toHaveProperty('touchesPerGame');
    expect(bundle.volumeFeatures.normalized).toHaveProperty('opportunityShare');
    expect(bundle.efficiencyFeatures.normalized).toHaveProperty('ypc');
  });

  it('produces valid scores for a fully-populated context', () => {
    expectValidBundle(buildRBFeatures(baseContext('RB')));
  });

  it('handles completely empty stats without crashing', () => {
    const ctx = baseContext('RB', {
      seasonStats: {
        gamesPlayed: 0,
        gamesStarted: 0,
        snapCount: 0,
        snapShare: 0,
        fantasyPointsPpr: 0,
        fantasyPointsHalfPpr: 0,
      },
      advancedMetrics: undefined,
      weeklyStats: [],
    });
    expect(() => buildRBFeatures(ctx)).not.toThrow();
    expectValidBundle(buildRBFeatures(ctx));
  });

  it('caps scores at LESS_THAN_3_GAMES when gamesPlayed < 3', () => {
    const ctx = baseContext('RB', {
      seasonStats: {
        gamesPlayed: 1,
        gamesStarted: 1,
        snapCount: 50,
        snapShare: 0.6,
        fantasyPointsPpr: 12,
        fantasyPointsHalfPpr: 10,
        rushAttempts: 15,
        rushYards: 65,
      },
      weeklyStats: makeWeeklyStats(1),
    });
    const bundle = buildRBFeatures(ctx);
    expect(bundle.volumeFeatures.score).toBeLessThanOrEqual(75);
    expect(bundle.efficiencyFeatures.score).toBeLessThanOrEqual(75);
  });
});

// ---------------------------------------------------------------------------
// TE Feature Builder
// ---------------------------------------------------------------------------

describe('buildTEFeatures', () => {
  it('returns a bundle with position TE and expected keys', () => {
    const bundle = buildTEFeatures(baseContext('TE'));
    expect(bundle.position).toBe('TE');
    expect(bundle.volumeFeatures.normalized).toHaveProperty('targetsPerGame');
    expect(bundle.efficiencyFeatures.normalized).toHaveProperty('yardsPerTarget');
  });

  it('produces valid scores for a fully-populated context', () => {
    expectValidBundle(buildTEFeatures(baseContext('TE')));
  });

  it('handles completely empty stats without crashing', () => {
    const ctx = baseContext('TE', {
      seasonStats: {
        gamesPlayed: 0,
        gamesStarted: 0,
        snapCount: 0,
        snapShare: 0,
        fantasyPointsPpr: 0,
        fantasyPointsHalfPpr: 0,
      },
      advancedMetrics: undefined,
      weeklyStats: [],
    });
    expect(() => buildTEFeatures(ctx)).not.toThrow();
    expectValidBundle(buildTEFeatures(ctx));
  });
});

// ---------------------------------------------------------------------------
// QB Feature Builder
// ---------------------------------------------------------------------------

describe('buildQBFeatures', () => {
  it('returns a bundle with position QB and expected keys', () => {
    const bundle = buildQBFeatures(baseContext('QB'));
    expect(bundle.position).toBe('QB');
    expect(bundle.volumeFeatures.normalized).toHaveProperty('passAttemptsPerGame');
    expect(bundle.efficiencyFeatures).toHaveProperty('score');
  });

  it('produces valid scores for a fully-populated context', () => {
    expectValidBundle(buildQBFeatures(baseContext('QB')));
  });

  it('handles completely empty stats without crashing', () => {
    const ctx = baseContext('QB', {
      seasonStats: {
        gamesPlayed: 0,
        gamesStarted: 0,
        snapCount: 0,
        snapShare: 0,
        fantasyPointsPpr: 0,
        fantasyPointsHalfPpr: 0,
      },
      advancedMetrics: undefined,
      weeklyStats: [],
    });
    expect(() => buildQBFeatures(ctx)).not.toThrow();
    expectValidBundle(buildQBFeatures(ctx));
  });

  it('caps scores at LESS_THAN_3_GAMES when gamesPlayed < 3', () => {
    const ctx = baseContext('QB', {
      seasonStats: {
        gamesPlayed: 2,
        gamesStarted: 2,
        snapCount: 120,
        snapShare: 1.0,
        fantasyPointsPpr: 40,
        fantasyPointsHalfPpr: 38,
        passingAttempts: 70,
        passingYards: 650,
        passingTds: 4,
        interceptions: 1,
      },
      weeklyStats: makeWeeklyStats(2, 20),
    });
    const bundle = buildQBFeatures(ctx);
    expect(bundle.volumeFeatures.score).toBeLessThanOrEqual(75);
    expect(bundle.efficiencyFeatures.score).toBeLessThanOrEqual(75);
  });

  it('dataQuality.hasAdvancedStats is true when epaPerPlay is provided', () => {
    const bundle = buildQBFeatures(baseContext('QB'));
    expect(bundle.dataQuality.hasAdvancedStats).toBe(true);
  });

  it('dataQuality.hasAdvancedStats is false when no advanced metrics', () => {
    const ctx = baseContext('QB', { advancedMetrics: undefined });
    const bundle = buildQBFeatures(ctx);
    expect(bundle.dataQuality.hasAdvancedStats).toBe(false);
  });
});
