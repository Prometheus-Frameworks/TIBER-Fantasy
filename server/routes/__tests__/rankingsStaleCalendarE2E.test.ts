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
// The route now resolves ranking identities (#313); the resolver pulls in the
// real db module, which throws at import time without DATABASE_URL. Identity
// behaviour is not under test here — every id resolves to nothing, which the
// route tolerates by emitting unresolved, non-linkable rows.
jest.mock('../../infra/db', () => ({ db: {} }));
jest.mock('../../services/identity/rankingIdentityResolver', () => ({
  resolveRankingIdentities: async (sourceIds: string[]) => ({
    identities: new Map(
      sourceIds.map((sourceId) => [sourceId, {
        status: 'unresolved',
        canonicalId: null,
        sourceId,
        sourceType: 'gsis',
        reason: 'not_in_identity_map',
        linkable: false,
      }]),
    ),
    coverage: {
      total: sourceIds.length,
      canonical: 0,
      resolved: 0,
      unresolved: sourceIds.length,
      ambiguous: 0,
      coverageRatio: 0,
      byReason: sourceIds.length ? { not_in_identity_map: sourceIds.length } : {},
    },
  }),
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
import { elapsedRegularSeasonWeeks } from '@shared/nflSeasonCalendar';
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
  mockedBuild.mockResolvedValue({ players: [], maxRepresentedWeek: null } as any);
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
    // No source was admitted, so this stays non-archive regardless of the
    // stale calendar (Fantasy #307 correction round 5).
    expect(body.seasonMeta.isArchiveView).toBe(false);
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
    'still permits explicitly requested configured historical season %s, and marks it as archive',
    async (season) => {
      mockResolveSeasonPhase.mockReturnValue(STALE);

      const { status, body } = await callRankings(
        `/api/rankings/v2/weekly?position=WR&season=${season}&asOfWeek=18`,
      );

      expect(status).toBe(200);
      expect(mockedCache).toHaveBeenCalledWith(season, 18, 'WR', 100, 'test-version', { exactWeek: true });
      expect(mockedBuild).toHaveBeenCalledWith(expect.objectContaining({ season, throughWeek: 18 }));
      expect(body.items).toHaveLength(1);
      expect(body.seasonMeta.evidenceSeason).toBe(season);
      // The route's own stale-calendar gate above already proved this can
      // only be an explicitly requested, configured historical season —
      // that alone is enough to classify it as an archive (Fantasy #307
      // correction round 5), without pretending a live forward target is
      // known.
      expect(body.seasonMeta.isArchiveView).toBe(true);
      expect(body.seasonMeta.status).toBe('archive_season_not_current');
      expect(body.seasonMeta.statusDetail).toBe(
        `Showing configured historical ${season} evidence while live season state is unavailable.`,
      );
      // Must not compare to, or claim, the synthetic stale live target.
      expect(body.seasonMeta.statusDetail).not.toMatch(/forward board targets/);
      expect(body.seasonMeta.statusDetail).not.toContain(String(body.seasonMeta.currentSeason));
    },
  );

  it('marks a configured historical season with an unknown extent as archive too', async () => {
    // `source_extent_unknown`: the cache admitted rows for the configured
    // season but did not declare its week extent. Still an admitted source —
    // the archive classification does not depend on the extent being known.
    mockResolveSeasonPhase.mockReturnValue(STALE);
    mockedCache.mockResolvedValue({
      players: [cacheRow],
      computedAt: new Date('2026-08-08T19:04:15.325Z'),
      asOfWeek: undefined,
    } as any);

    const { status, body } = await callRankings(
      '/api/rankings/v2/weekly?position=WR&season=2025&asOfWeek=18',
    );

    expect(status).toBe(200);
    expect(body.seasonMeta.evidenceProvenance).toBe('source_extent_unknown');
    expect(body.seasonMeta.evidenceSeason).toBe(2025);
    expect(body.seasonMeta.isArchiveView).toBe(true);
    expect(body.seasonMeta.status).toBe('archive_season_not_current');
  });
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
    // The forward-season default also carries the forward TARGET WEEK, so the
    // requested board matches the advertised target rather than being weekless.
    expect(mockedCache).toHaveBeenCalledWith(2026, 1, 'WR', 100, 'test-version', { exactWeek: false });
    // Derived, not a literal: the bound is 2026's own elapsed week count, which
    // is 0 today but will not be forever. A hardcoded 0 here would quietly
    // start asserting the wrong thing once 2026 Week 1 kicks off.
    expect(mockedBuild).toHaveBeenCalledWith(
      expect.objectContaining({ season: 2026, throughWeek: elapsedRegularSeasonWeeks(2026) }),
    );
    expect(body.seasonMeta.currentSeason).toBe(2025);
    expect(body.seasonMeta.forwardRankingSeason).toBe(2026);
    expect(body.seasonMeta.evidenceSeason).toBe(2026);
    expect(body.seasonMeta.evidenceWeek).toBe(1);
    expect(body.seasonMeta.isArchiveView).toBe(false);
  });
});

describe('Rankings v2 route evidence bound belongs to the queried season', () => {
  // The reported defect: `throughWeek` fell back to the LIVE phase week
  // whenever the request named another season. Because the consumer applies it
  // as a hard `lte` filter, an archive was silently truncated to the live week
  // and presented as the whole season, and in the offseason the `?? 0`
  // fallback returned nothing while still rendering as a populated archive.
  it('bounds an explicitly requested archive by that archive, not by the live clock', async () => {
    mockResolveSeasonPhase.mockReturnValue(POSTSEASON_2025);

    const { status, body } = await callRankings('/api/rankings/v2/weekly?position=WR&season=2025');

    expect(status).toBe(200);
    // 2025 is complete, so its bound is its full length — regardless of what
    // the live clock happens to say. The old code produced 0 here, because
    // `regularSeasonWeek` is null during a postseason.
    expect(mockedBuild).toHaveBeenCalledWith(
      expect.objectContaining({ season: 2025, throughWeek: 18 }),
    );
    expect(body.seasonMeta.evidenceSeason).toBe(2025);
  });

  it('reports the evidence bound it actually applied', async () => {
    // Reporting `evidenceWeek: null` while filtering to a week was the same
    // evidence/computation conflation inside the envelope.
    mockResolveSeasonPhase.mockReturnValue(POSTSEASON_2025);
    mockedMeaningful.mockReturnValue(true);
    const { scoringService } = jest.requireMock(
      '../../modules/externalModels/scoring/scoringService',
    ) as any;
    scoringService.getWeeklyRankings.mockResolvedValue({
      ok: true,
      data: { asOf: '2026-01-20T00:00:00.000Z', items: [] },
    });

    const { body } = await callRankings('/api/rankings/v2/weekly?position=WR&season=2025');

    expect(body.seasonMeta.evidenceWeek).toBe(18);
  });

  it('fails closed for a season whose extent cannot be established', async () => {
    // An unconfigured season has no calendar to bound it, and the fix must not
    // reach for another season's bound. It must say so instead.
    mockResolveSeasonPhase.mockReturnValue(POSTSEASON_2025);

    const { status, body } = await callRankings('/api/rankings/v2/weekly?position=WR&season=2019');

    expect(status).toBe(200);
    expect(body.items).toEqual([]);
    expect(body.seasonMeta.status).toBe('season_calendar_config_stale');
    expect(body.seasonMeta.statusDetail).toContain('extent of its evidence cannot be established');
    expect(mockedCache).not.toHaveBeenCalled();
    expect(mockedBuild).not.toHaveBeenCalled();
  });

  it('still honours an explicit asOfWeek over the derived bound', async () => {
    // The caller pinning a week is a deliberate request, not a defect.
    mockResolveSeasonPhase.mockReturnValue(POSTSEASON_2025);

    await callRankings('/api/rankings/v2/weekly?position=WR&season=2025&asOfWeek=6');

    expect(mockedBuild).toHaveBeenCalledWith(
      expect.objectContaining({ season: 2025, throughWeek: 6 }),
    );
  });
});
