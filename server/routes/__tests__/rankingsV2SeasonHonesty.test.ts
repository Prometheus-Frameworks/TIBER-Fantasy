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
import { z } from 'zod';

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
import {
  RANKINGS_V2_CONTRACT_VERSION,
  rankingsV2ResponseSchema,
  rankingsV2SeasonMetaSchema,
} from '../../contracts/rankingsV2';
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
    expect(mockedCache).toHaveBeenCalledWith(2026, 1, 'WR', 100, 'test-version', { exactWeek: false });
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

    expect(mockedCache).toHaveBeenCalledWith(2025, 11, 'WR', 100, 'test-version', { exactWeek: false });
    expect(body.seasonMeta.isArchiveView).toBe(false);
    expect(body.seasonMeta.status).toBeNull();
    expect(body.seasonMeta.currentPhaseLabel).toBe('2025 · Week 11');
  });

  test('an explicit season query parameter still wins', async () => {
    mockResolveSeasonPhase.mockReturnValue(PRESEASON_2026);

    await call('/api/rankings/v2/weekly?position=RB&season=2024&asOfWeek=7');

    expect(mockedCache).toHaveBeenCalledWith(2024, 7, 'RB', 100, 'test-version', { exactWeek: true });
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

    expect(mockedCache).toHaveBeenCalledWith(2025, 18, 'WR', 100, 'test-version', { exactWeek: true });
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
    // The target the request named is still visible — as the board's target.
    expect(body.seasonMeta.decisionTargetWeek).toBe(18);
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

    // The evidence claim is the point here, and it is unchanged: nothing was
    // admitted, so nothing is declared. The *status* is now the stronger
    // exact-week one, because an explicitly requested week with no rows is a
    // question this build cannot answer rather than a board still computing.
    expect(body.seasonMeta.status).toBe('exact_week_evidence_unavailable');
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

  test('a defaulted target carries the phase provenance in the envelope', async () => {
    // No asOfWeek: the week comes from the phase calendar, so it inherits that
    // calendar's provenance and its provisional flag.
    const { body } = await call('/api/rankings/v2/weekly?position=WR&season=2025');

    expect(body.seasonMeta.decisionTargetSeason).toBe(2025);
    expect(body.seasonMeta.decisionTargetWeek).toBe(MIDSEASON_2025.targetWeek);
    expect(body.seasonMeta.decisionTargetProvenance).toBe('anchor_derived');
    expect(body.seasonMeta.decisionTargetOrigin).toBe('phase_default');
    expect(body.seasonMeta.decisionTargetIsProvisional).toBe(true);
  });
});

describe('an explicit asOfWeek is exact, and fails closed', () => {
  // The defect: `getGradesFromCache()` substitutes the season's latest cached
  // week when the requested week has no rows, and the response labelled those
  // rows as the requested board. A Week 7 request came back with Week 18
  // grades under a Week 7 heading — rows describing games the caller never
  // asked about, which is a wrong answer rather than a degraded one.
  beforeEach(() => {
    jest.clearAllMocks();
    mockResolveSeasonPhase.mockReturnValue(MIDSEASON_2025);
    mockedBuild.mockResolvedValue({ players: [], maxRepresentedWeek: null } as any);
    mockedMeaningful.mockReturnValue(false);
  });

  test('the exact week is requested from the cache, not "whatever is newest"', async () => {
    mockedCache.mockResolvedValue({
      players: [cacheRow], computedAt: new Date('2025-10-20T18:00:00.000Z'), asOfWeek: 7,
    } as any);

    await call('/api/rankings/v2/weekly?position=WR&season=2025&asOfWeek=7');

    expect(mockedCache).toHaveBeenCalledWith(2025, 7, 'WR', 100, 'test-version', { exactWeek: true });
  });

  test('a defaulted week does NOT ask for an exact read', async () => {
    // Omitting the week is how a caller says "whatever is current", so the
    // latest-week resolution is correct there and must not be disabled.
    mockedCache.mockResolvedValue({
      players: [cacheRow], computedAt: new Date('2025-11-16T18:00:00.000Z'), asOfWeek: 11,
    } as any);

    await call('/api/rankings/v2/weekly?position=WR&season=2025');

    expect(mockedCache).toHaveBeenCalledWith(
      2025, MIDSEASON_2025.targetWeek, 'WR', 100, 'test-version', { exactWeek: false },
    );
  });

  test('a missing exact cache week fails closed instead of serving another week', async () => {
    // The exact read returns empty. Scoring is unavailable. The response must
    // say it cannot answer, not render an empty Week 7 board.
    mockedCache.mockResolvedValue({
      players: [], computedAt: null, asOfWeek: 7, requestedAsOfWeek: 7, weekSubstituted: false,
    } as any);

    const { body } = await call('/api/rankings/v2/weekly?position=WR&season=2025&asOfWeek=7');

    expect(body.items).toEqual([]);
    expect(body.seasonMeta.status).toBe('exact_week_evidence_unavailable');
    expect(body.seasonMeta.statusDetail).toMatch(/week 7/i);
    expect(body.seasonMeta.statusDetail).toMatch(/not substituted/i);
    // Distinct from "grades are still being computed for the current board".
    expect(body.seasonMeta.status).not.toBe('forge_cache_empty_uncomputed');
    expect(rankingsV2ResponseSchema.safeParse(body).success).toBe(true);
  });

  test('unavailable exact scoring evidence also fails closed', async () => {
    // Scoring has coverage and is attempted, but the service errors; the exact
    // cache week is empty. Neither source answered the question asked.
    mockedMeaningful.mockReturnValue(true);
    mockedBuild.mockResolvedValue({
      players: Array.from({ length: 20 }, () => ({ playerId: 'x' })), maxRepresentedWeek: 7,
    } as any);
    const { scoringService } = jest.requireMock('../../modules/externalModels/scoring/scoringService');
    scoringService.getWeeklyRankings.mockResolvedValue({
      ok: false, code: 'upstream_unavailable', message: 'boom',
    });
    mockedCache.mockResolvedValue({
      players: [], computedAt: null, asOfWeek: 7, requestedAsOfWeek: 7, weekSubstituted: false,
    } as any);

    const { body } = await call('/api/rankings/v2/weekly?position=WR&season=2025&asOfWeek=7');

    expect(body.seasonMeta.status).toBe('exact_week_evidence_unavailable');
    expect(body.seasonMeta.statusDetail).toMatch(/upstream_unavailable/);
    expect(rankingsV2ResponseSchema.safeParse(body).success).toBe(true);
  });

  test('a latest-week substitution is never labelled as the requested board', async () => {
    // The end-to-end property, stated directly: whatever comes back for an
    // explicit week is either that week's evidence or nothing. There is no
    // path that returns another week's rows under the requested week's label.
    mockedCache.mockResolvedValue({
      players: [], computedAt: null, asOfWeek: 7, requestedAsOfWeek: 7, weekSubstituted: false,
    } as any);

    const { body } = await call('/api/rankings/v2/weekly?position=WR&season=2025&asOfWeek=7');

    expect(body.items).toEqual([]);
    // No board was served, so none is labelled — `decisionTargetWeek` describes
    // the board IN the response, and there is none. The week the caller asked
    // about is named in the status detail, where it belongs.
    expect(body.seasonMeta.decisionTargetWeek).toBeNull();
    expect(body.seasonMeta.statusDetail).toMatch(/week 7/i);
    // Evidence is not claimed through any week at all.
    expect(body.seasonMeta.evidenceWeek).toBeNull();
    expect(body.seasonMeta.evidenceProvenance).toBe('no_rankable_source');
  });

  test('an exact week that IS present is served normally', async () => {
    // Fail-closed must not become fail-always: the exact week exists, so it is
    // served, and its metadata describes it.
    mockedCache.mockResolvedValue({
      players: [cacheRow], computedAt: new Date('2025-10-20T18:00:00.000Z'),
      asOfWeek: 7, requestedAsOfWeek: 7, weekSubstituted: false,
    } as any);

    const { body } = await call('/api/rankings/v2/weekly?position=WR&season=2025&asOfWeek=7');

    expect(body.items.length).toBe(1);
    expect(body.seasonMeta.status).not.toBe('exact_week_evidence_unavailable');
    expect(body.seasonMeta.decisionTargetWeek).toBe(7);
    expect(body.seasonMeta.evidenceWeek).toBe(7);
  });

  test('a defaulted board with an empty cache keeps its own uncomputed status', async () => {
    // The fail-closed gate is for explicit weeks only. A defaulted board with
    // no computed grades is a different, pre-existing state and keeps saying so.
    mockedCache.mockResolvedValue({
      players: [], computedAt: null, asOfWeek: 11, requestedAsOfWeek: null, weekSubstituted: false,
    } as any);

    const { body } = await call('/api/rankings/v2/weekly?position=WR&season=2025');

    expect(body.seasonMeta.status).toBe('forge_cache_empty_uncomputed');
    expect(body.seasonMeta.status).not.toBe('exact_week_evidence_unavailable');
  });
});

describe('the response stays compatible with the pre-change client schema', () => {
  // The other half of the finding: `explicit_request` had been added to the
  // existing closed provenance enum without moving the contract version, so a
  // client validating the advertised `v2-canonical-identity-2026-08-09` schema
  // would reject a response mid-rolling-deployment. Origin moved to its own
  // optional field and the enum was restored.
  const PRE_CHANGE_SEASON_META = z.object({
    decisionTargetSeason: z.number().nullable(),
    decisionTargetWeek: z.number().nullable(),
    decisionTargetProvenance: z.enum(['verified_schedule', 'anchor_derived']).nullable(),
    decisionTargetIsProvisional: z.boolean(),
    evidenceThroughSeason: z.number().nullable(),
    evidenceThroughWeek: z.number().nullable(),
    evidenceProvenance: z.enum([
      'source_declared_as_of',
      'source_max_represented_week',
      'source_extent_unknown',
      'no_rankable_source',
    ]),
    completionVerified: z.boolean(),
    finalizedThroughWeek: z.number().nullable(),
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockResolveSeasonPhase.mockReturnValue(MIDSEASON_2025);
    mockedBuild.mockResolvedValue({ players: [], maxRepresentedWeek: null } as any);
    mockedMeaningful.mockReturnValue(false);
    mockedCache.mockResolvedValue({
      players: [cacheRow], computedAt: new Date('2025-10-20T18:00:00.000Z'),
      asOfWeek: 7, requestedAsOfWeek: 7, weekSubstituted: false,
    } as any);
  });

  test('the contract version is unchanged', () => {
    expect(RANKINGS_V2_CONTRACT_VERSION).toBe('v2-canonical-identity-2026-08-09');
  });

  test('an explicit-week response validates against the pre-change schema', async () => {
    const { body } = await call('/api/rankings/v2/weekly?position=WR&season=2025&asOfWeek=7');
    expect(body.contractVersion).toBe('v2-canonical-identity-2026-08-09');

    const parsed = PRE_CHANGE_SEASON_META.safeParse(body.seasonMeta);
    expect(parsed.success).toBe(true);
  });

  test('a defaulted response validates against the pre-change schema', async () => {
    const { body } = await call('/api/rankings/v2/weekly?position=WR&season=2025');
    expect(PRE_CHANGE_SEASON_META.safeParse(body.seasonMeta).success).toBe(true);
  });

  test('the provenance enum has not gained a member', async () => {
    // The direct regression: had `explicit_request` still been published as a
    // provenance, the pre-change enum above would reject it.
    const { body } = await call('/api/rankings/v2/weekly?position=WR&season=2025&asOfWeek=7');
    expect(['verified_schedule', 'anchor_derived', null])
      .toContain(body.seasonMeta.decisionTargetProvenance);
    expect(body.seasonMeta.decisionTargetProvenance).not.toBe('explicit_request');
  });

  test('origin is additive: a client that ignores it is unaffected', async () => {
    const { body } = await call('/api/rankings/v2/weekly?position=WR&season=2025&asOfWeek=7');
    const { decisionTargetOrigin, ...withoutOrigin } = body.seasonMeta;

    expect(decisionTargetOrigin).toBe('explicit_request');
    // Dropping the new field entirely still satisfies the current contract,
    // which is what "optional" has to mean for a rolling deployment.
    expect(rankingsV2SeasonMetaSchema.safeParse(withoutOrigin).success).toBe(true);
  });
});

describe('seasonMeta describes the board that was returned', () => {
  // The defect: `decisionTarget*` was built from the LIVE PHASE target
  // regardless of what was requested, so an explicit historical request came
  // back with correct rows under a label describing a different board — a 2025
  // Week 7 board advertising 2026 Week 1. The label and the rows must be the
  // same board.
  beforeEach(() => {
    jest.clearAllMocks();
    mockResolveSeasonPhase.mockReturnValue(PRESEASON_2026);
    mockedBuild.mockResolvedValue({ players: [], maxRepresentedWeek: null } as any);
    mockedMeaningful.mockReturnValue(false);
    mockedCache.mockResolvedValue({
      players: [cacheRow],
      computedAt: new Date('2025-11-16T18:00:00.000Z'),
      asOfWeek: 7,
    } as any);
  });

  test('an explicit historical season/week is what the metadata publishes', async () => {
    // The live phase is 2026 preseason, targeting Week 1. The request asks for
    // the 2025 Week 7 board, and that is what comes back.
    expect(PRESEASON_2026.targetSeason).toBe(2026);
    expect(PRESEASON_2026.targetWeek).toBe(1);

    const { body } = await call('/api/rankings/v2/weekly?position=WR&season=2025&asOfWeek=7');

    expect(body.seasonMeta.decisionTargetSeason).toBe(2025);
    expect(body.seasonMeta.decisionTargetWeek).toBe(7);
    // The caller named the week, so no SCHEDULE stands behind it: provenance
    // describes the schedule and is null here, keeping its existing closed
    // membership. Origin is the separate field that says who chose the week.
    expect(body.seasonMeta.decisionTargetProvenance).toBeNull();
    expect(body.seasonMeta.decisionTargetOrigin).toBe('explicit_request');
    expect(body.seasonMeta.decisionTargetIsProvisional).toBe(false);

    // Not 2026 Week 1 — the board this response did not return.
    expect(body.seasonMeta.decisionTargetSeason).not.toBe(PRESEASON_2026.targetSeason);
    expect(body.seasonMeta.decisionTargetWeek).not.toBe(PRESEASON_2026.targetWeek);
  });

  test('the live phase target is preserved separately, not conflated', async () => {
    const { body } = await call('/api/rankings/v2/weekly?position=WR&season=2025&asOfWeek=7');

    expect(body.seasonMeta.phaseTargetSeason).toBe(PRESEASON_2026.targetSeason);
    expect(body.seasonMeta.phaseTargetWeek).toBe(PRESEASON_2026.targetWeek);
    expect(body.seasonMeta.phaseTargetProvenance).toBe(PRESEASON_2026.targetProvenance);
    expect(body.seasonMeta.phaseTargetIsProvisional).toBe(PRESEASON_2026.targetIsProvisional);
    // The legacy fields keep their pre-existing meaning and types.
    expect(body.seasonMeta.targetSeason).toBe(PRESEASON_2026.targetSeason);
    expect(body.seasonMeta.targetWeek).toBe(PRESEASON_2026.targetWeek);
  });

  test('the archive label and the board label agree', async () => {
    const { body } = await call('/api/rankings/v2/weekly?position=WR&season=2025&asOfWeek=7');

    // The response is an archive view BECAUSE the board is 2025 while the
    // forward board is 2026 — the same fact the decision target now states.
    expect(body.seasonMeta.isArchiveView).toBe(true);
    expect(body.seasonMeta.decisionTargetSeason).toBe(body.seasonMeta.evidenceSeason);
  });

  test('the current forward board still labels itself as the phase target', async () => {
    // The fix must not invert the defect: when the request IS the forward
    // board, both descriptions agree and nothing changes.
    mockedCache.mockResolvedValue({
      players: [cacheRow],
      computedAt: new Date('2026-08-09T12:00:00.000Z'),
      asOfWeek: 1,
    } as any);

    const { body } = await call('/api/rankings/v2/weekly?position=WR&season=2026');

    expect(body.seasonMeta.decisionTargetSeason).toBe(PRESEASON_2026.targetSeason);
    expect(body.seasonMeta.decisionTargetWeek).toBe(PRESEASON_2026.targetWeek);
    expect(body.seasonMeta.phaseTargetWeek).toBe(PRESEASON_2026.targetWeek);
    expect(body.seasonMeta.isArchiveView).toBe(false);
  });

  test('an unavailable response labels no board at all', async () => {
    // Nothing was served, so borrowing the phase target here would label an
    // empty response with a board it did not return.
    mockResolveSeasonPhase.mockReturnValue(STALE);

    const { body } = await call('/api/rankings/v2/weekly?position=WR');

    expect(body.items).toEqual([]);
    expect(body.seasonMeta.decisionTargetWeek).toBeNull();
    expect(body.seasonMeta.decisionTargetProvenance).toBeNull();
    expect(body.seasonMeta.decisionTargetIsProvisional).toBe(false);
    expect(rankingsV2ResponseSchema.safeParse(body).success).toBe(true);
  });
});
