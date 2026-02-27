/**
 * FORGE Alpha Engine Unit Tests
 *
 * Tests calculateAlphaScore as a pure, synchronous function with
 * heavy dependencies mocked at module level.
 */

// Prevent db.ts from throwing when DATABASE_URL is not set
jest.mock('../../../infra/db', () => ({ db: {} }));

// Mock FPR so it returns a neutral output and doesn't need DB
jest.mock('../fibonacciPatternResonance', () => ({
  computeFPR: jest.fn(() => ({
    score: 50,
    pattern: 'FIB_STABLE',
    band: 'MEDIUM',
    forgeConfidenceModifier: 0,
    forgeVolatilityIndex: 0.5,
  })),
}));

// Mock applyForgeModifiers so modifier logic is isolated
jest.mock('../forgeAlphaModifiers', () => ({
  applyForgeModifiers: jest.fn((rawAlpha: number) => rawAlpha),
}));

import { calculateAlphaScore } from '../alphaEngine';
import { applyForgeModifiers } from '../forgeAlphaModifiers';
import type { ForgeContext, ForgeFeatureBundle, PlayerPosition } from '../types';

function makeContext(overrides: Partial<ForgeContext> = {}): ForgeContext {
  const base: ForgeContext = {
    playerId: 'player-1',
    playerName: 'Test Player',
    position: 'WR',
    season: 2024,
    asOfWeek: 10,
    age: 25,
    identity: {
      canonicalId: 'player-1',
      isActive: true,
    },
    seasonStats: {
      gamesPlayed: 10,
      gamesStarted: 10,
      snapCount: 500,
      snapShare: 0.8,
      fantasyPointsPpr: 150,
      fantasyPointsHalfPpr: 130,
      targets: 80,
      receptions: 55,
      redZoneTargets: 8,
      redZoneCarries: 0,
    },
    weeklyStats: [
      { week: 8, fantasyPointsPpr: 14, targets: 8, receptions: 6, snapShare: 78 },
      { week: 9, fantasyPointsPpr: 16, targets: 9, receptions: 6, snapShare: 82 },
      { week: 10, fantasyPointsPpr: 18, targets: 10, receptions: 7, snapShare: 84 },
    ],
  };

  return {
    ...base,
    ...overrides,
    identity: {
      ...base.identity,
      ...overrides.identity,
    },
    seasonStats: {
      ...base.seasonStats,
      ...overrides.seasonStats,
    },
    weeklyStats: overrides.weeklyStats ?? base.weeklyStats,
  };
}

function makeFeatures(
  overrides: Partial<ForgeFeatureBundle> = {},
  scores: { volume?: number; efficiency?: number; teamContext?: number; stability?: number } = {}
): ForgeFeatureBundle {
  const base: ForgeFeatureBundle = {
    position: 'WR',
    gamesPlayed: 10,
    volumeFeatures: {
      raw: {},
      normalized: {},
      score: scores.volume ?? 70,
    },
    efficiencyFeatures: {
      raw: {},
      normalized: {},
      score: scores.efficiency ?? 65,
      capped: false,
    },
    stabilityFeatures: {
      floorWeekRate: 0.5,
      boomWeekRate: 0.3,
      score: scores.stability ?? 55,
    },
    contextFitFeatures: {
      raw: {},
      normalized: {},
      score: scores.teamContext ?? 60,
      isNeutral: false,
    },
    dataQuality: {
      hasAdvancedStats: true,
      hasSnapData: true,
      hasDvPData: true,
      hasEnvironmentData: true,
    },
  };

  const merged: ForgeFeatureBundle = {
    ...base,
    ...overrides,
    volumeFeatures: {
      ...base.volumeFeatures,
      ...overrides.volumeFeatures,
    },
    efficiencyFeatures: {
      ...base.efficiencyFeatures,
      ...overrides.efficiencyFeatures,
    },
    stabilityFeatures: {
      ...base.stabilityFeatures,
      ...overrides.stabilityFeatures,
    },
    contextFitFeatures: {
      ...base.contextFitFeatures,
      ...overrides.contextFitFeatures,
    },
    dataQuality: {
      ...base.dataQuality,
      ...overrides.dataQuality,
    },
  };

  return merged;
}

describe('calculateAlphaScore', () => {
  const applyForgeModifiersMock = applyForgeModifiers as jest.MockedFunction<typeof applyForgeModifiers>;

  beforeEach(() => {
    applyForgeModifiersMock.mockClear();
    applyForgeModifiersMock.mockImplementation((rawAlpha: number) => rawAlpha);
  });

  it('returns a ForgeScore with alpha, subScores, trajectory, and confidence', () => {
    const result = calculateAlphaScore(makeContext(), makeFeatures());

    expect(typeof result.alpha).toBe('number');
    expect(typeof result.subScores.volume).toBe('number');
    expect(typeof result.subScores.efficiency).toBe('number');
    expect(typeof result.subScores.stability).toBe('number');
    expect(typeof result.subScores.contextFit).toBe('number');
    expect(typeof result.trajectory).toBe('string');
    expect(typeof result.confidence).toBe('number');
  });

  it('alpha is always clamped between 0 and 100', () => {
    const high = calculateAlphaScore(
      makeContext({ position: 'QB' }),
      makeFeatures({ position: 'QB' }, { volume: 500, efficiency: 500, teamContext: 500, stability: 500 })
    );

    const low = calculateAlphaScore(
      makeContext(),
      makeFeatures({}, { volume: -500, efficiency: -500, teamContext: -500, stability: -500 })
    );

    expect(high.alpha).toBeGreaterThanOrEqual(0);
    expect(high.alpha).toBeLessThanOrEqual(100);
    expect(low.alpha).toBeGreaterThanOrEqual(0);
    expect(low.alpha).toBeLessThanOrEqual(100);
  });

  it('returns a valid score for each position: QB, RB, WR, TE', () => {
    const positions: PlayerPosition[] = ['QB', 'RB', 'WR', 'TE'];

    for (const position of positions) {
      const result = calculateAlphaScore(
        makeContext({ position }),
        makeFeatures({ position })
      );

      expect(result.alpha).toBeGreaterThanOrEqual(0);
      expect(result.alpha).toBeLessThanOrEqual(100);
    }
  });

  it('dynasty mode applies age penalty for old players (age >= 30)', () => {
    const context = makeContext({ age: 31 });
    const features = makeFeatures();

    const redraft = calculateAlphaScore(context, features, undefined, { leagueType: 'redraft' });
    const dynasty = calculateAlphaScore(context, features, undefined, { leagueType: 'dynasty' });

    expect(dynasty.alpha).toBeLessThanOrEqual(redraft.alpha);
  });

  it('dynasty mode does not penalise young players (age <= 26)', () => {
    const context = makeContext({ age: 25 });
    const features = makeFeatures();

    const redraft = calculateAlphaScore(context, features, undefined, { leagueType: 'redraft' });
    const dynasty = calculateAlphaScore(context, features, undefined, { leagueType: 'dynasty' });

    expect(dynasty.alpha).toBeGreaterThanOrEqual(redraft.alpha);
  });

  it('redraft mode ignores age', () => {
    const features = makeFeatures();

    const oldRedraft = calculateAlphaScore(
      makeContext({ age: 35 }),
      features,
      undefined,
      { leagueType: 'redraft' }
    );
    const youngRedraft = calculateAlphaScore(
      makeContext({ age: 22 }),
      features,
      undefined,
      { leagueType: 'redraft' }
    );

    expect(oldRedraft.alpha).toBeCloseTo(youngRedraft.alpha, 5);
  });

  it('passes through env modifier to applyForgeModifiers when provided', () => {
    const env = { envScore100: 65, pacePct: 60, proePct: 55, olGradePct: 58, qbStabilityScore: 62 };

    calculateAlphaScore(makeContext(), makeFeatures(), { env, matchup: null });

    expect(applyForgeModifiersMock.mock.calls.length).toBe(1);
    expect(applyForgeModifiersMock.mock.calls[0][1]).toBe(env);
  });

  it('passes through matchup modifier to applyForgeModifiers when provided', () => {
    const matchup = { matchupScore100: 42, expectedGameScript: 'neutral' as const };

    calculateAlphaScore(makeContext(), makeFeatures(), { env: null, matchup });

    expect(applyForgeModifiersMock.mock.calls.length).toBe(1);
    expect(applyForgeModifiersMock.mock.calls[0][2]).toBe(matchup);
  });

  it('skips modifier call when no modifiers supplied', () => {
    calculateAlphaScore(makeContext(), makeFeatures());

    expect(applyForgeModifiersMock.mock.calls.length).toBe(0);
  });

  it('does not crash when all feature inputs are 0', () => {
    const result = calculateAlphaScore(
      makeContext(),
      makeFeatures({}, { volume: 0, efficiency: 0, teamContext: 0, stability: 0 })
    );

    expect(result.alpha).toBeGreaterThanOrEqual(0);
    expect(result.alpha).toBeLessThanOrEqual(100);
  });

  it('does not crash when all feature inputs are 100', () => {
    const result = calculateAlphaScore(
      makeContext({ position: 'QB' }),
      makeFeatures({ position: 'QB' }, { volume: 100, efficiency: 100, teamContext: 100, stability: 100 })
    );

    expect(result.alpha).toBeGreaterThanOrEqual(0);
    expect(result.alpha).toBeLessThanOrEqual(100);
  });

  it('handles gamesPlayed = 1 without NaN', () => {
    const context = makeContext({
      seasonStats: { gamesPlayed: 1 },
      weeklyStats: [{ week: 1, fantasyPointsPpr: 12, targets: 6, receptions: 4 }],
    });
    const features = makeFeatures({ gamesPlayed: 1 });

    const result = calculateAlphaScore(context, features);

    expect(Number.isNaN(result.alpha)).toBe(false);
    expect(Number.isNaN(result.confidence)).toBe(false);
    expect(result.alpha).toBeGreaterThanOrEqual(0);
    expect(result.alpha).toBeLessThanOrEqual(100);
  });
});
