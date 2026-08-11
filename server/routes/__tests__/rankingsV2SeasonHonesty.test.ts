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
import { RANKINGS_V2_CONTRACT_VERSION, rankingsV2ResponseSchema } from '../../contracts/rankingsV2';
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
    mockedBuild.mockResolvedValue({ players: [], maxRepresentedWeek: null } as any);
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
    // The cache is queried for the *current* season, not a hardcoded 2025 —
    // and for the PHASE TARGET week (preseason → Week 1), so the board, the
    // request, and the published Target Week 1 metadata agree instead of the
    // request silently carrying no week.
    expect(mockedCache).toHaveBeenCalledWith(2026, 1, 'WR', 100, 'test-version');
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

  test('the fail-closed response satisfies the canonical contract it advertises', async () => {
    // Reproduces the reported defect: `identityCoverage` became required in
    // #313, but the unavailable payload omitted it and returned without
    // validation — so the ONE response that exists to be trusted when
    // everything else is unavailable was the one a consumer validating the
    // advertised contract would reject.
    mockResolveSeasonPhase.mockReturnValue(STALE);

    const { status, body } = await call('/api/rankings/v2/weekly?position=WR');

    expect(status).toBe(200);
    const parsed = rankingsV2ResponseSchema.safeParse(body);
    if (!parsed.success) {
      throw new Error(`fail-closed payload rejected by its own contract: ${JSON.stringify(parsed.error.flatten())}`);
    }
    expect(body.contractVersion).toBe(RANKINGS_V2_CONTRACT_VERSION);
    // A true zero, not a fabricated coverage claim: nothing was admitted.
    expect(body.identityCoverage).toEqual({
      total: 0, canonical: 0, resolved: 0, unresolved: 0,
      ambiguous: 0, coverageRatio: 0, byReason: {},
    });
  });

  test('the no-derivable-extent fail-closed path validates too', async () => {
    // The second unavailable return site, which took the same shortcut.
    mockResolveSeasonPhase.mockReturnValue(MIDSEASON_2025);

    const { status, body } = await call('/api/rankings/v2/weekly?position=WR&season=1999');

    expect(status).toBe(200);
    expect(rankingsV2ResponseSchema.safeParse(body).success).toBe(true);
    expect(body.identityCoverage.total).toBe(0);
    expect(body.seasonMeta.evidenceProvenance).toBe('no_rankable_source');
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

describe('evidence is what the source declares, never the request or a calendar', () => {
  beforeEach(() => {
    // Top-level describe: the contract suite's beforeEach does not apply here,
    // so the full mock set is established locally.
    jest.clearAllMocks();
    mockResolveSeasonPhase.mockReturnValue(MIDSEASON_2025);
    mockedBuild.mockResolvedValue({ players: [], maxRepresentedWeek: null } as any);
    mockedMeaningful.mockReturnValue(false);
    mockedCache.mockResolvedValue({
      players: [cacheRow],
      computedAt: new Date('2025-11-16T18:00:00.000Z'),
      asOfWeek: 11,
    } as any);
  });

  test('the cache path publishes the cache\'s own declared as-of week, not the requested target', async () => {
    // The caller asks for the Week 18 board; the serving cache declares its
    // rows are as of Week 5. Evidence is the SOURCE's statement: publishing
    // the request here is exactly how a target week used to masquerade as
    // evidence for football that had not been played.
    mockedCache.mockResolvedValue({
      players: [cacheRow],
      computedAt: new Date('2025-11-16T18:00:00.000Z'),
      asOfWeek: 5,
    } as any);

    const { body } = await call('/api/rankings/v2/weekly?position=WR&season=2025&asOfWeek=18');

    expect(body.seasonMeta.evidenceWeek).toBe(5);
    expect(body.seasonMeta.evidenceThroughWeek).toBe(5);
    expect(body.seasonMeta.evidenceProvenance).toBe('source_declared_as_of');
    // The target the request named is still visible — as a target.
    expect(body.seasonMeta.decisionTargetWeek).toBe(MIDSEASON_2025.targetWeek);
  });

  test('a cache that declares no extent yields unknown — never \"full season\"', async () => {
    mockedCache.mockResolvedValue({
      players: [cacheRow],
      computedAt: new Date('2025-11-16T18:00:00.000Z'),
      asOfWeek: undefined,
    } as any);

    const { body } = await call('/api/rankings/v2/weekly?position=WR&season=2025&asOfWeek=18');

    expect(body.seasonMeta.evidenceWeek).toBeNull();
    expect(body.seasonMeta.evidenceThroughWeek).toBeNull();
    expect(body.seasonMeta.evidenceProvenance).toBe('source_extent_unknown');
    // Null is "unknown", not "18": nothing downstream may widen it.
    expect(body.seasonMeta.evidenceWeek).not.toBe(18);
  });

  test('the scoring path publishes the measured max represented week, not the query ceiling', async () => {
    // The ceiling admits up to week 11 (the live phase week), but the stats
    // actually aggregated only reach week 9 — say, an ingestion lag. The
    // envelope must say 9: the ceiling is what the query was ALLOWED to
    // admit, not what the source contained.
    mockedBuild.mockResolvedValue({
      players: Array.from({ length: 12 }).map((_, idx) => ({
        player_id: `00-00${idx}`,
        player_name: `P${idx}`,
        position: 'WR',
        team: 'MIN',
        games_sampled: 5,
        targets_pg: 8,
        fantasy_points_ppr_pg: 15,
      })),
      maxRepresentedWeek: 9,
    } as any);
    mockedMeaningful.mockReturnValue(true);
    const { scoringService } = jest.requireMock('../../modules/externalModels/scoring/scoringService');
    scoringService.getWeeklyRankings.mockResolvedValue({
      ok: true,
      data: {
        asOf: '2025-11-16T18:00:00.000Z',
        items: [{
          rank: 1, playerId: '00-000', playerName: 'P0', team: 'MIN', position: 'WR',
          expectedPoints: 20.1, vorp: 3.4,
        }],
      },
    });

    const { body } = await call('/api/rankings/v2/weekly?position=WR');

    // The ceiling comes from the queried season's own calendar under the real
    // clock (all 18 of 2025's weeks have begun by now) — and that is exactly
    // why it must not be published: the envelope below says 9, the measured
    // extent, not the 18 the query was merely allowed to admit.
    expect(mockedBuild).toHaveBeenCalledWith(
      expect.objectContaining({ season: 2025, throughWeek: 18 }),
    );
    expect(body.seasonMeta.evidenceWeek).toBe(9);
    expect(body.seasonMeta.evidenceThroughWeek).toBe(9);
    expect(body.seasonMeta.evidenceProvenance).toBe('source_max_represented_week');
  });

  test('an EMPTY cache declares nothing, even when a week was explicitly requested', async () => {
    // getGradesFromCache echoes the requested week in `asOfWeek` even when it
    // holds no rows, so without the emptiness gate an uncomputed cache would
    // "declare" whatever week the caller asked for — preseason Week 1
    // evidence published alongside forge_cache_empty_uncomputed.
    mockedCache.mockResolvedValue({
      players: [],
      computedAt: null,
      asOfWeek: 18,
    } as any);

    const { body } = await call('/api/rankings/v2/weekly?position=WR&season=2025&asOfWeek=18');

    expect(body.seasonMeta.status).toBe('forge_cache_empty_uncomputed');
    expect(body.seasonMeta.evidenceWeek).toBeNull();
    expect(body.seasonMeta.evidenceThroughWeek).toBeNull();
    expect(body.seasonMeta.evidenceProvenance).toBe('no_rankable_source');
  });

  test('the unavailable payload declares no rankable source', async () => {
    mockResolveSeasonPhase.mockReturnValue(STALE);

    const { body } = await call('/api/rankings/v2/weekly?position=WR');

    expect(body.seasonMeta.evidenceWeek).toBeNull();
    expect(body.seasonMeta.evidenceProvenance).toBe('no_rankable_source');
  });

  test('completion is never asserted: no finalization source exists', async () => {
    const { body } = await call('/api/rankings/v2/weekly?position=WR&season=2025&asOfWeek=18');

    expect(body.seasonMeta.completionVerified).toBe(false);
    expect(body.seasonMeta.finalizedThroughWeek).toBeNull();
    expect(body.seasonMeta.completionCopy).toBe('Completion not verified.');
  });

  test('the decision target carries its provenance in the envelope', async () => {
    const { body } = await call('/api/rankings/v2/weekly?position=WR&season=2025&asOfWeek=18');

    expect(body.seasonMeta.decisionTargetSeason).toBe(MIDSEASON_2025.targetSeason);
    expect(body.seasonMeta.decisionTargetWeek).toBe(MIDSEASON_2025.targetWeek);
    expect(body.seasonMeta.decisionTargetProvenance).toBe('anchor_derived');
    expect(body.seasonMeta.decisionTargetIsProvisional).toBe(true);
  });
});
