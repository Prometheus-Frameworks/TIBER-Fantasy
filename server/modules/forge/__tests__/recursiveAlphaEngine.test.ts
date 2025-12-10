import { calculateRecursiveAlpha, RecursiveScoringOptions } from '../recursiveAlphaEngine';
import { calculateAlphaScore } from '../alphaEngine';
import {
  getPreviousWeekState,
  saveForgeState,
  calculateVolatility,
} from '../forgeStateService';
import { ForgeContext, ForgeFeatureBundle, ForgeScore } from '../types';

jest.mock('../alphaEngine', () => ({
  calculateAlphaScore: jest.fn(),
}));

jest.mock('../forgeStateService', () => {
  const actual = jest.requireActual('../forgeStateService');
  return {
    ...actual,
    getPreviousWeekState: jest.fn(),
    saveForgeState: jest.fn(),
  };
});

const baseContext: ForgeContext = {
  playerId: 'player-1',
  playerName: 'Test Player',
  position: 'WR',
  nflTeam: 'FA',
  season: 2024,
  asOfWeek: 2,
  age: 26,
  identity: {
    canonicalId: 'player-1',
    isActive: true,
  },
  seasonStats: {
    gamesPlayed: 1,
    gamesStarted: 1,
    snapCount: 60,
    snapShare: 0.9,
    fantasyPointsPpr: 15.5,
    fantasyPointsHalfPpr: 12.5,
  },
  weeklyStats: [
    { week: 1, fantasyPointsPpr: 15.5, snapShare: 0.9, targets: 8, receptions: 5 },
  ],
};

const baseFeatures: ForgeFeatureBundle = {
  position: 'WR',
  gamesPlayed: 1,
  volumeFeatures: { raw: {}, normalized: {}, score: 70 },
  efficiencyFeatures: { raw: {}, normalized: {}, score: 70, capped: false },
  stabilityFeatures: { weeklyPpgStdDev: 5, floorWeekRate: 0.5, boomWeekRate: 0.2, score: 70 },
  contextFitFeatures: { raw: {}, normalized: {}, score: 70, isNeutral: false },
  dataQuality: {
    hasAdvancedStats: true,
    hasSnapData: true,
    hasDvPData: true,
    hasEnvironmentData: true,
  },
};

const mockForgeScore: ForgeScore = {
  playerId: 'player-1',
  playerName: 'Test Player',
  position: 'WR',
  nflTeam: 'FA',
  season: 2024,
  asOfWeek: 2,
  alpha: 82,
  rawAlpha: 82,
  subScores: {
    volume: 70,
    efficiency: 70,
    stability: 70,
    contextFit: 70,
  },
  trajectory: 'flat',
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

const scoringOptions: RecursiveScoringOptions = { persistState: false };

const alphaMock = calculateAlphaScore as jest.MockedFunction<typeof calculateAlphaScore>;
const previousStateMock = getPreviousWeekState as jest.MockedFunction<typeof getPreviousWeekState>;
const saveStateMock = saveForgeState as jest.MockedFunction<typeof saveForgeState>;

beforeEach(() => {
  jest.clearAllMocks();

  alphaMock.mockReturnValue(mockForgeScore);

  previousStateMock.mockResolvedValue({
    alphaPrev: 70,
    tierPrev: 2,
    volatilityPrev: 4,
    momentum: 6,
    alphaHistory: [70, 68, 72],
  });

  saveStateMock.mockResolvedValue();
});

test('returns only finite alpha outputs (no NaN or Infinity)', async () => {
  const score = await calculateRecursiveAlpha(baseContext, baseFeatures, scoringOptions);

  expect(Number.isFinite(score.alpha)).toBe(true);
  expect(Number.isFinite(score.recursion.pass0Alpha)).toBe(true);
  expect(Number.isFinite(score.recursion.pass1Alpha)).toBe(true);
});

test('stability and volatility modifiers stay within +/-30% of raw alpha by default', async () => {
  const score = await calculateRecursiveAlpha(baseContext, baseFeatures, scoringOptions);

  const rawAlpha = score.recursion.pass0Alpha;
  const adjustedAlpha = score.recursion.pass1Alpha;
  const delta = adjustedAlpha - rawAlpha;
  const allowedRange = Math.abs(rawAlpha * 0.3);

  expect(delta).toBeGreaterThanOrEqual(-allowedRange);
  expect(delta).toBeLessThanOrEqual(allowedRange);

  const volatility = calculateVolatility([
    adjustedAlpha,
    ...(previousStateMock.mock.calls.length ? [70, 68, 72] : []),
  ]);
  if (volatility !== null) {
    expect(volatility).toBeLessThanOrEqual(Math.abs(rawAlpha * 0.3));
  }
});

test('handles missing or partial player data by falling back to safe defaults', async () => {
  previousStateMock.mockResolvedValue(null);
  
  const partialMockScore: ForgeScore = {
    ...mockForgeScore,
    playerName: 'Partial Player',
    nflTeam: undefined,
    alpha: 60,
    rawAlpha: 60,
    gamesPlayed: 0,
  };
  alphaMock.mockReturnValue(partialMockScore);

  const partialContext: ForgeContext = {
    ...baseContext,
    playerName: 'Partial Player',
    asOfWeek: 1,
    seasonStats: {
      ...baseContext.seasonStats,
      gamesPlayed: 0,
    },
    weeklyStats: [],
  };

  const score = await calculateRecursiveAlpha(
    partialContext,
    { ...baseFeatures, gamesPlayed: 0 },
    scoringOptions,
  );

  expect(score.recursion.isFirstWeek).toBe(true);
  expect(score.recursion.expectedAlpha).toBeGreaterThan(0);
  expect(score.alpha).toBeGreaterThan(0);
});
