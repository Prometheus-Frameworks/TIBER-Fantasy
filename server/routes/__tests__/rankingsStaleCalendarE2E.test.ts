/**
 * Fantasy #307 Phase A — mounted Rankings v2 route regressions.
 *
 * These tests exercise the real Express router. Client URL construction and
 * mounted-state transitions live in TiberTiers.container.test.ts; no production
 * selector or query-string builder is mirrored here.
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
  toLeagueContextInput: jest.fn(() => ({})),
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
import {
  buildRankingsScoringInputs,
  hasMeaningfulScoringInputs,
} from '../../modules/externalModels/scoring/scoringRequestMappers';

const { resolveSeasonPhase: actualResolveSeasonPhase } =
  jest.requireActual<typeof import('@shared/weekDetection')>('@shared/weekDetection');

const mockedCache = getGradesFromCache as jest.MockedFunction<typeof getGradesFromCache>;
const mockedBuild = buildRankingsScoringInputs as jest.MockedFunction<typeof buildRankingsScoringInputs>;
const mockedMeaningful = hasMeaningfulScoringInputs as jest.MockedFunction<typeof hasMeaningfulScoringInputs>;

const STALE = actualResolveSeasonPhase(new Date('2031-10-01T12:00:00Z'));
const POSTSEASON_2025 = actualResolveSeasonPhase(new Date('2026-01-20T12:00:00Z'));

async function callRankings(path: string) {
  const app = express();
  app.use('/api/rankings/v2', createRankingsV2Router());
  const server = app.listen(0);
  const { port } = server.address() as AddressInfo;
  try {
    const response = await fetch(`http://127.0.0.1:${port}${path}`);
    return { status: response.status, body: await response.json() };
  } finally {
    server.close();
  }
}

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

describe('Rankings v2 route stale-calendar gate', () => {
  it('returns a typed items:[] calendar-unavailable payload when season is omitted', async () => {
    mockResolveSeasonPhase.mockReturnValue(STALE);

    const { status, body } = await callRankings('/api/rankings/v2/weekly?position=WR');

    expect(status).toBe(200);
    expect(body.items).toEqual([]);
    expect(body.sourceStack).toEqual([]);
    expect(body.seasonMeta.configStatus).toBe('stale_calendar_config');
    expect(body.seasonMeta.status).toBe('season_calendar_config_stale');
    expect(body.seasonMeta.evidenceSeason).toBeNull();
    expect(mockedCache).not.toHaveBeenCalled();
    expect(mockedBuild).not.toHaveBeenCalled();
  });

  it.each([2024, 2027, 2031])(
    'rejects explicit unconfigured season %s before cache or scoring reads',
    async (season) => {
      mockResolveSeasonPhase.mockReturnValue(STALE);

      const { status, body } = await callRankings(
        `/api/rankings/v2/weekly?position=WR&season=${season}&asOfWeek=1`,
      );

      expect(status).toBe(200);
      expect(body.items).toEqual([]);
      expect(body.seasonMeta.configStatus).toBe('stale_calendar_config');
      expect(body.seasonMeta.status).toBe('season_calendar_config_stale');
      expect(body.seasonMeta.statusDetail).toContain(`Season ${season} is not present`);
      expect(mockedCache).not.toHaveBeenCalled();
      expect(mockedBuild).not.toHaveBeenCalled();
    },
  );

  it.each([2025, 2026])(
    'still permits explicitly requested configured historical season %s',
    async (season) => {
      mockResolveSeasonPhase.mockReturnValue(STALE);

      const { status, body } = await callRankings(
        `/api/rankings/v2/weekly?position=WR&season=${season}&asOfWeek=18`,
      );

      expect(status).toBe(200);
      expect(mockedCache).toHaveBeenCalledWith(season, 18, 'WR', 100, 'test-version');
      expect(mockedBuild).toHaveBeenCalledWith(expect.objectContaining({ season, throughWeek: 18 }));
      expect(body.items).toHaveLength(1);
      expect(body.seasonMeta.evidenceSeason).toBe(season);
    },
  );
});

describe('Rankings v2 route forward-season default', () => {
  it('defaults a parameterless postseason request to the configured target season', async () => {
    mockResolveSeasonPhase.mockReturnValue(POSTSEASON_2025);
    mockedCache.mockResolvedValue({
      players: [cacheRow],
      computedAt: new Date('2026-01-20T00:00:00.000Z'),
      asOfWeek: 1,
    } as any);

    const { status, body } = await callRankings('/api/rankings/v2/weekly?position=WR');

    expect(status).toBe(200);
    expect(mockedCache).toHaveBeenCalledWith(2026, undefined, 'WR', 100, 'test-version');
    expect(mockedBuild).toHaveBeenCalledWith(
      expect.objectContaining({ season: 2026, throughWeek: 0 }),
    );
    expect(body.seasonMeta.currentSeason).toBe(2025);
    expect(body.seasonMeta.forwardRankingSeason).toBe(2026);
    expect(body.seasonMeta.evidenceSeason).toBe(2026);
    expect(body.seasonMeta.evidenceWeek).toBe(1);
    expect(body.seasonMeta.isArchiveView).toBe(false);
  });
});
