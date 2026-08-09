/**
 * Fantasy #307 Phase A — end-to-end stale-calendar and archive-semantics
 * regression.
 *
 * The bypass this locks out: past the configured calendar `resolveSeasonPhase()`
 * correctly reported `stale_calendar_config`, but the legacy `getCurrentWeek()`
 * still returned the *invented* next year as a numeric season (2027 for a 2031
 * clock). `useCurrentNFLWeek()` surfaced that as `resolvedSeason`, `/tiers` sent
 * it as an explicit `season=2027`, and the Rankings route — which only fails
 * closed when no explicit season is supplied — served it.
 *
 * This walks the whole chain: detection → current-week payload → hook selector →
 * /tiers request construction → Rankings response.
 */

import express from 'express';
import { AddressInfo } from 'net';

jest.mock('../../infra/db', () => ({ db: {} }));
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
import { buildRankingsScoringInputs, hasMeaningfulScoringInputs } from '../../modules/externalModels/scoring/scoringRequestMappers';

const actual = jest.requireActual<typeof import('@shared/weekDetection')>('@shared/weekDetection');
const { getCurrentWeek, resolveSeasonPhase } = actual;

const mockedCache = getGradesFromCache as jest.MockedFunction<typeof getGradesFromCache>;
const mockedBuild = buildRankingsScoringInputs as jest.MockedFunction<typeof buildRankingsScoringInputs>;
const mockedMeaningful = hasMeaningfulScoringInputs as jest.MockedFunction<typeof hasMeaningfulScoringInputs>;

const STALE_CLOCK = new Date('2031-10-01T12:00:00Z');
const POSTSEASON_2025 = new Date('2026-01-20T12:00:00Z');
const PRESEASON_2026 = new Date('2026-08-09T12:00:00Z');

/** The exact `/api/system/current-week` body, built the way the route builds it. */
function currentWeekPayload(now: Date) {
  const weekInfo = getCurrentWeek(now);
  return { success: true, ...weekInfo, upcomingWeek: weekInfo.targetWeek };
}

/**
 * The `resolvedSeason` selector from `useCurrentNFLWeek`, mirrored here so the
 * chain can be exercised without a React renderer. Kept deliberately identical
 * to the hook.
 */
function hookResolvedSeason(payload: ReturnType<typeof currentWeekPayload>): number | null {
  return payload.configStatus === 'stale_calendar_config' ? null : payload.season ?? null;
}

/** The `/tiers` query-string construction, mirrored from TiberTiers.tsx. */
function tiersRequestPath(resolvedSeason: number | null, asOfWeek: number | null): string {
  const params = new URLSearchParams({ position: 'WR', limit: '75' });
  if (resolvedSeason !== null) params.set('season', String(resolvedSeason));
  if (asOfWeek !== null) params.set('asOfWeek', String(asOfWeek));
  return `/api/rankings/v2/weekly?${params.toString()}`;
}

async function callRankings(path: string) {
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

const cacheRow = {
  playerId: '00-0036963', playerName: 'Amon-Ra St. Brown', position: 'WR', nflTeam: 'DET',
  alpha: 95, rawAlpha: 95, tier: 'T1', confidence: 0.9, gamesPlayed: 16, trajectory: 'flat',
  footballLensIssues: [], lensAdjustment: 0,
  volumeScore: 90, efficiencyScore: 88, teamContextScore: 80, stabilityScore: 85,
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

describe('stale calendar: the full detection → hook → /tiers → route chain', () => {
  it('detection reports stale and offers no forward target', () => {
    const phase = resolveSeasonPhase(STALE_CLOCK);
    expect(phase.configStatus).toBe('stale_calendar_config');
    expect(phase.targetSeason).toBeNull();
    expect(phase.targetWeek).toBeNull();
  });

  it('the current-week payload still carries an invented numeric season for legacy consumers', () => {
    const payload = currentWeekPayload(STALE_CLOCK);
    // This is the value that used to leak through as resolved state.
    expect(payload.season).toBe(2027);
    expect(payload.configStatus).toBe('stale_calendar_config');
  });

  it('but the hook selector refuses to resolve it', () => {
    expect(hookResolvedSeason(currentWeekPayload(STALE_CLOCK))).toBeNull();
  });

  it('so /tiers omits the season parameter entirely', () => {
    const path = tiersRequestPath(hookResolvedSeason(currentWeekPayload(STALE_CLOCK)), null);
    expect(path).not.toContain('season=');
    expect(path).not.toContain('2027');
  });

  it('and the Rankings route answers with the typed unavailable state', async () => {
    mockResolveSeasonPhase.mockReturnValue(resolveSeasonPhase(STALE_CLOCK));
    const path = tiersRequestPath(hookResolvedSeason(currentWeekPayload(STALE_CLOCK)), null);

    const { status, body } = await callRankings(path);

    expect(status).toBe(200);
    expect(body.items).toEqual([]);
    expect(body.seasonMeta.configStatus).toBe('stale_calendar_config');
    expect(body.seasonMeta.status).toBe('season_calendar_config_stale');
    // Fail closed: no cache read, no invented season served.
    expect(mockedCache).not.toHaveBeenCalled();
  });

  it('the season toggle is not populated with an invented year', () => {
    // Mirrors TiberTiers: availableSeasons is empty when the season is unresolved.
    const resolved = hookResolvedSeason(currentWeekPayload(STALE_CLOCK));
    const availableSeasons = resolved === null ? [] : [resolved - 1, resolved];
    expect(availableSeasons).toEqual([]);
  });

  it('legacy numeric accessors keep working for untouched consumers', () => {
    const payload = currentWeekPayload(STALE_CLOCK);
    // The legacy hook fields intentionally stay numeric; only `resolvedSeason`
    // is nulled, so the ~13 other pages consuming this hook are unaffected.
    expect(typeof payload.season).toBe('number');
    expect(typeof payload.currentWeek).toBe('number');
  });
});

describe('postseason: phase season and forward ranking season stay distinct', () => {
  it('the 2025 postseason targets 2026 while remaining labelled 2025', () => {
    const phase = resolveSeasonPhase(POSTSEASON_2025);
    expect(phase.season).toBe(2025);
    expect(phase.phase).toBe('postseason');
    expect(phase.seasonPhaseLabel).toBe('2025 · Postseason');
    expect(phase.targetSeason).toBe(2026);
    expect(phase.targetWeek).toBe(1);
  });

  it('2025 evidence during the 2025 postseason IS an archive, because the board targets 2026', async () => {
    mockResolveSeasonPhase.mockReturnValue(resolveSeasonPhase(POSTSEASON_2025));

    const { body } = await callRankings('/api/rankings/v2/weekly?position=WR&season=2025&asOfWeek=18');

    expect(body.seasonMeta.currentSeason).toBe(2025);
    expect(body.seasonMeta.forwardRankingSeason).toBe(2026);
    expect(body.seasonMeta.isArchiveView).toBe(true);
    // The phase label stays honest even while the board looks forward.
    expect(body.seasonMeta.currentPhaseLabel).toBe('2025 · Postseason');
  });

  it('a 2026 forward board during the 2025 postseason is NOT an archive', async () => {
    mockResolveSeasonPhase.mockReturnValue(resolveSeasonPhase(POSTSEASON_2025));
    mockedCache.mockResolvedValue({
      players: [cacheRow], computedAt: new Date('2026-01-20T00:00:00.000Z'), asOfWeek: 1,
    } as any);

    const { body } = await callRankings('/api/rankings/v2/weekly?position=WR&season=2026&asOfWeek=1');

    expect(body.seasonMeta.forwardRankingSeason).toBe(2026);
    expect(body.seasonMeta.isArchiveView).toBe(false);
    expect(body.seasonMeta.status).toBeNull();
    // Still honest about where the league actually is.
    expect(body.seasonMeta.currentSeason).toBe(2025);
    expect(body.seasonMeta.currentPhaseLabel).toBe('2025 · Postseason');
  });

  it('current phase and forward target remain separate facts in every phase', async () => {
    for (const [clock, expectedPhaseSeason, expectedForward] of [
      [PRESEASON_2026, 2026, 2026],
      [POSTSEASON_2025, 2025, 2026],
    ] as const) {
      mockResolveSeasonPhase.mockReturnValue(resolveSeasonPhase(clock));
      const { body } = await callRankings('/api/rankings/v2/weekly?position=WR&season=2025&asOfWeek=18');
      expect(body.seasonMeta.currentSeason).toBe(expectedPhaseSeason);
      expect(body.seasonMeta.forwardRankingSeason).toBe(expectedForward);
    }
  });

  it('2026 preseason keeps 2025 evidence as an archive', async () => {
    mockResolveSeasonPhase.mockReturnValue(resolveSeasonPhase(PRESEASON_2026));

    const { body } = await callRankings('/api/rankings/v2/weekly?position=WR&season=2025&asOfWeek=18');

    expect(body.seasonMeta.forwardRankingSeason).toBe(2026);
    expect(body.seasonMeta.isArchiveView).toBe(true);
  });

  it('an in-season board is never an archive of itself', async () => {
    mockResolveSeasonPhase.mockReturnValue(resolveSeasonPhase(new Date('2025-11-16T18:00:00Z')));
    mockedCache.mockResolvedValue({
      players: [cacheRow], computedAt: new Date('2025-11-17T00:00:00.000Z'), asOfWeek: 11,
    } as any);

    const { body } = await callRankings('/api/rankings/v2/weekly?position=WR&season=2025&asOfWeek=11');

    expect(body.seasonMeta.currentSeason).toBe(2025);
    expect(body.seasonMeta.forwardRankingSeason).toBe(2025);
    expect(body.seasonMeta.isArchiveView).toBe(false);
  });
});
