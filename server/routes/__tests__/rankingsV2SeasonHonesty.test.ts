/**
 * Fantasy #307 Phase A — Rankings v2 season/phase contract.
 *
 * Locks out two behaviours:
 *  - the route defaulting season/week to 2025/18;
 *  - a response that cannot distinguish "when the score was computed" from
 *    "what football the score is about".
 */

import express from 'express';
import { AddressInfo } from 'net';

jest.mock('../../modules/externalModels/scoring/scoringService', () => ({
  scoringService: { getWeeklyRankings: jest.fn() },
}));
jest.mock('../../modules/forge/forgeGradeCache', () => ({
  CACHE_VERSION: 'test-version',
  getGradesFromCache: jest.fn(),
}));
jest.mock('../../modules/externalModels/scoring/scoringRequestMappers', () => ({
  toLeagueContextInput: jest.fn((input) => ({ season: input.season, week: input.week, scoringFormat: 'ppr', teams: 12 })),
  buildRankingsScoringInputs: jest.fn(),
  hasMeaningfulScoringInputs: jest.fn(),
}));

const mockResolveSeasonPhase = jest.fn();
jest.mock('@shared/weekDetection', () => ({
  ...jest.requireActual('@shared/weekDetection'),
  resolveSeasonPhase: (...args: unknown[]) => mockResolveSeasonPhase(...args),
}));

import { createRankingsV2Router } from '../rankingsV2Routes';
import { getGradesFromCache } from '../../modules/forge/forgeGradeCache';
import { buildRankingsScoringInputs, hasMeaningfulScoringInputs } from '../../modules/externalModels/scoring/scoringRequestMappers';

// Must come from requireActual: the module mock above replaces the named export,
// so importing it normally would hand back the mock and produce undefined phases.
const { resolveSeasonPhase: actualResolveSeasonPhase } =
  jest.requireActual<typeof import('@shared/weekDetection')>('@shared/weekDetection');

const mockedCache = getGradesFromCache as jest.MockedFunction<typeof getGradesFromCache>;
const mockedBuild = buildRankingsScoringInputs as jest.MockedFunction<typeof buildRankingsScoringInputs>;
const mockedMeaningful = hasMeaningfulScoringInputs as jest.MockedFunction<typeof hasMeaningfulScoringInputs>;

async function call(path: string) {
  const app = express();
  app.use('/api/rankings/v2', createRankingsV2Router());
  const server = app.listen(0);
  const { port } = server.address() as AddressInfo;
  try {
    const res = await fetch(`http://127.0.0.1:${port}${path}`);
    return { status: res.status, body: await res.json() };
  } finally {
    server.close();
  }
}

const PRESEASON_2026 = actualResolveSeasonPhase(new Date('2026-08-09T12:00:00Z'));
const MIDSEASON_2025 = actualResolveSeasonPhase(new Date('2025-11-16T18:00:00Z'));
const STALE = actualResolveSeasonPhase(new Date('2031-10-01T12:00:00Z'));

const cacheRow = {
  playerId: '00-0036963',
  playerName: 'Amon-Ra St. Brown',
  position: 'WR',
  nflTeam: 'DET',
  alpha: 95,
  rawAlpha: 95,
  tier: 'T1',
  confidence: 0.9,
  gamesPlayed: 16,
  trajectory: 'flat',
  footballLensIssues: [],
  lensAdjustment: 0,
  volumeScore: 90,
  efficiencyScore: 88,
  teamContextScore: 80,
  stabilityScore: 85,
};

describe('Rankings v2 season/phase contract', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedBuild.mockResolvedValue([]);
    mockedMeaningful.mockReturnValue(false);
    mockedCache.mockResolvedValue({
      players: [cacheRow],
      computedAt: new Date('2026-08-08T19:04:15.325Z'),
      asOfWeek: 18,
    } as any);
  });

  test('during the 2026 preseason it does not default to season 2025 / week 18', async () => {
    mockResolveSeasonPhase.mockReturnValue(PRESEASON_2026);

    const { status, body } = await call('/api/rankings/v2/weekly?position=WR');

    expect(status).toBe(200);
    // The cache is queried for the *current* season, not a hardcoded 2025.
    expect(mockedCache).toHaveBeenCalledWith(2026, undefined, 'WR', 100, 'test-version');
    // And the scoring inputs are not pinned to `throughWeek: 18`.
    expect(mockedBuild).toHaveBeenCalledWith(expect.objectContaining({ season: 2026, throughWeek: 0 }));
    expect(body.seasonMeta.currentSeason).toBe(2026);
    expect(body.seasonMeta.currentPhase).toBe('preseason');
    expect(body.seasonMeta.currentPhaseLabel).toBe('2026 · Preseason');
    expect(body.seasonMeta.targetWeek).toBe(1);
    expect(body.seasonMeta.currentRegularSeasonWeek).toBeNull();
  });

  test('generated-at and evidence season/week are separate fields', async () => {
    mockResolveSeasonPhase.mockReturnValue(PRESEASON_2026);

    const { body } = await call('/api/rankings/v2/weekly?position=WR&season=2025&asOfWeek=18');

    expect(body.seasonMeta.generatedAt).toBe('2026-08-08T19:04:15.325Z');
    expect(body.seasonMeta.evidenceSeason).toBe(2025);
    expect(body.seasonMeta.evidenceWeek).toBe(18);
    // A 2026 computation over 2025 evidence must not read as current-season evidence.
    expect(body.seasonMeta.generatedAt.startsWith('2026')).toBe(true);
    expect(body.seasonMeta.evidenceSeason).not.toBe(body.seasonMeta.currentSeason);
  });

  test('2025 rows served during the 2026 preseason are flagged as an archive view', async () => {
    mockResolveSeasonPhase.mockReturnValue(PRESEASON_2026);

    const { body } = await call('/api/rankings/v2/weekly?position=WR&season=2025&asOfWeek=18');

    expect(body.seasonMeta.isArchiveView).toBe(true);
    expect(body.seasonMeta.status).toBe('archive_season_not_current');
    // The detail now names the board's target season, not just the phase, so a
    // 2026 forward board during the 2025 postseason is not mislabelled.
    expect(body.seasonMeta.statusDetail).toMatch(/2025 evidence while the forward board targets 2026/);
    expect(body.seasonMeta.forwardRankingSeason).toBe(2026);
  });

  test('current-season rows in season are not flagged as an archive', async () => {
    mockResolveSeasonPhase.mockReturnValue(MIDSEASON_2025);
    mockedCache.mockResolvedValue({
      players: [cacheRow],
      computedAt: new Date('2025-11-17T00:00:00.000Z'),
      asOfWeek: 11,
    } as any);

    const { body } = await call('/api/rankings/v2/weekly?position=WR');

    expect(mockedCache).toHaveBeenCalledWith(2025, 11, 'WR', 100, 'test-version');
    expect(body.seasonMeta.isArchiveView).toBe(false);
    expect(body.seasonMeta.status).toBeNull();
    expect(body.seasonMeta.currentPhaseLabel).toBe('2025 · Week 11');
  });

  test('an explicit season query parameter still wins', async () => {
    mockResolveSeasonPhase.mockReturnValue(PRESEASON_2026);

    await call('/api/rankings/v2/weekly?position=RB&season=2024&asOfWeek=7');

    expect(mockedCache).toHaveBeenCalledWith(2024, 7, 'RB', 100, 'test-version');
  });

  test('a stale calendar fails closed into a typed unavailable state', async () => {
    mockResolveSeasonPhase.mockReturnValue(STALE);

    const { status, body } = await call('/api/rankings/v2/weekly?position=WR');

    expect(status).toBe(200);
    expect(body.items).toEqual([]);
    expect(body.seasonMeta.configStatus).toBe('stale_calendar_config');
    expect(body.seasonMeta.status).toBe('season_calendar_config_stale');
    expect(body.seasonMeta.statusDetail).toMatch(/calendar ends after/i);
    // Fail closed: no cache read, no invented season.
    expect(mockedCache).not.toHaveBeenCalled();
  });

  test('a stale calendar still serves an explicitly requested archive season', async () => {
    mockResolveSeasonPhase.mockReturnValue(STALE);

    const { body } = await call('/api/rankings/v2/weekly?position=WR&season=2025&asOfWeek=18');

    expect(mockedCache).toHaveBeenCalledWith(2025, 18, 'WR', 100, 'test-version');
    expect(body.items.length).toBe(1);
  });

  test('the response validates against the canonical contract', async () => {
    mockResolveSeasonPhase.mockReturnValue(PRESEASON_2026);
    const { body } = await call('/api/rankings/v2/weekly?position=WR');
    // safeParse strips unknown keys, so seasonMeta surviving proves it is part
    // of the contract rather than an untyped extra.
    expect(body.seasonMeta).toBeDefined();
    expect(body.contractVersion).toBeDefined();
  });
});
