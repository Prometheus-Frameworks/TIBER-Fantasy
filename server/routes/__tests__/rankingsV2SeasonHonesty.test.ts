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
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
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
  resolveRankingIdentities: jest.fn(async (sourceIds: string[]) => ({
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
  })),
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

import { createRankingsV2Router, EXACT_WEEK_UNAVAILABLE_STATUS, SEASON_CONFIG_STALE_STATUS } from '../rankingsV2Routes';
import {
  EXACT_WEEK_UNAVAILABLE_STATUS as CLIENT_EXACT_WEEK_UNAVAILABLE_STATUS,
  SEASON_CONFIG_STALE_STATUS as CLIENT_SEASON_CONFIG_STALE_STATUS,
  validateRankingsV2WeeklyResponse,
} from '@/pages/tiberTiersV2Mapper';
import { TiberTiersView } from '@/pages/TiberTiers';
import {
  RANKINGS_V2_CONTRACT_VERSION,
  rankingsV2ResponseSchema,
  rankingsV2SeasonMetaSchema,
} from '../../contracts/rankingsV2';
import { getGradesFromCache } from '../../modules/forge/forgeGradeCache';
import { buildRankingsScoringInputs, hasMeaningfulScoringInputs } from '../../modules/externalModels/scoring/scoringRequestMappers';
import { resolveRankingIdentities } from '../../services/identity/rankingIdentityResolver';

// Must come from requireActual: the module mock above replaces the named export,
// so importing it normally would hand back the mock and produce undefined phases.
const { resolveSeasonPhase: actualResolveSeasonPhase } =
  jest.requireActual<typeof import('@shared/weekDetection')>('@shared/weekDetection');

const mockedCache = getGradesFromCache as jest.MockedFunction<typeof getGradesFromCache>;
const mockedBuild = buildRankingsScoringInputs as jest.MockedFunction<typeof buildRankingsScoringInputs>;
const mockedMeaningful = hasMeaningfulScoringInputs as jest.MockedFunction<typeof hasMeaningfulScoringInputs>;
const mockedIdentityResolver = resolveRankingIdentities as jest.MockedFunction<typeof resolveRankingIdentities>;

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
const FINAL_WEEK_2025_NO_TARGET = actualResolveSeasonPhase(new Date('2026-01-06T02:00:00Z'));
const POSTSEASON_2025 = actualResolveSeasonPhase(new Date('2026-01-20T12:00:00Z'));
const POSTSEASON_2026_NO_TARGET = actualResolveSeasonPhase(new Date('2027-01-20T12:00:00Z'));
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
    mockedCache.mockResolvedValue({
      players: [cacheRow],
      computedAt: new Date('2026-08-08T19:04:15.325Z'),
      asOfWeek: 1,
      requestedAsOfWeek: 1,
      weekSubstituted: false,
    } as any);

    const { status, body } = await call('/api/rankings/v2/weekly?position=WR');

    expect(status).toBe(200);
    // The cache is queried for the *current* season, not a hardcoded 2025 —
    // and for the PHASE TARGET week (preseason → Week 1), so the board, the
    // request, and the published Target Week 1 metadata agree instead of the
    // request silently carrying no week.
    expect(mockedCache).toHaveBeenCalledWith(2026, 1, 'WR', 100, 'test-version', { exactWeek: true });
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

    expect(mockedCache).toHaveBeenCalledWith(2025, 11, 'WR', 100, 'test-version', { exactWeek: true });
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

  test('a fresh configured phase with no forward target publishes null, not its current season as a substitute', async () => {
    expect(POSTSEASON_2026_NO_TARGET.configStatus).toBe('ok');
    expect(POSTSEASON_2026_NO_TARGET.targetSeason).toBeNull();
    mockResolveSeasonPhase.mockReturnValue(POSTSEASON_2026_NO_TARGET);
    mockedCache.mockResolvedValue({
      players: [cacheRow],
      computedAt: new Date('2027-01-20T12:00:00.000Z'),
      asOfWeek: 18,
      requestedAsOfWeek: null,
      weekSubstituted: false,
    } as any);

    const { status, body } = await call('/api/rankings/v2/weekly?position=WR');

    expect(status).toBe(200);
    expect(body.seasonMeta.currentSeason).toBe(2026);
    expect(body.seasonMeta.currentPhase).toBe('postseason');
    expect(body.seasonMeta.forwardRankingSeason).toBeNull();
    expect(body.seasonMeta.targetSeason).toBeNull();
    expect(body.seasonMeta.phaseTargetSeason).toBeNull();
    expect(body.seasonMeta.scheduleSource).toBeNull();
    expect(body.seasonMeta.isArchiveView).toBe(false);
    expect(body.seasonMeta.statusDetail).toBeNull();
    expect(rankingsV2ResponseSchema.safeParse(body).success).toBe(true);
  });

  test('a fresh no-forward-target phase marks older evidence against the real current season', async () => {
    mockResolveSeasonPhase.mockReturnValue(POSTSEASON_2026_NO_TARGET);
    mockedCache.mockResolvedValue({
      players: [cacheRow],
      computedAt: new Date('2026-01-07T12:00:00.000Z'),
      asOfWeek: 18,
      requestedAsOfWeek: null,
      weekSubstituted: false,
    } as any);

    const { body } = await call('/api/rankings/v2/weekly?position=WR&season=2025');

    expect(body.seasonMeta.forwardRankingSeason).toBeNull();
    expect(body.seasonMeta.currentSeason).toBe(2026);
    expect(body.seasonMeta.isArchiveView).toBe(true);
    expect(body.seasonMeta.status).toBe('archive_season_not_current');
    expect(body.seasonMeta.statusDetail).toMatch(/historical 2025 evidence/i);
    expect(body.seasonMeta.statusDetail).toMatch(/league is in 2026/i);
    expect(body.seasonMeta.statusDetail).toMatch(/no forward ranking target/i);
    expect(body.seasonMeta.statusDetail).not.toContain('null');
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

  test('the cache path rejects a declared week that differs from the requested target', async () => {
    // Defense in depth: even if a cache adapter returns rows despite exactWeek,
    // those Week 5 rows cannot be admitted under a Week 18 board label.
    mockedCache.mockResolvedValue({
      players: [cacheRow],
      computedAt: new Date('2025-11-16T18:00:00.000Z'),
      asOfWeek: 5,
      requestedAsOfWeek: 18,
      weekSubstituted: false,
    } as any);

    const { body } = await call('/api/rankings/v2/weekly?position=WR&season=2025&asOfWeek=18');

    expect(body.items).toEqual([]);
    expect(body.seasonMeta.status).toBe(EXACT_WEEK_UNAVAILABLE_STATUS);
    expect(body.seasonMeta.evidenceWeek).toBeNull();
    expect(body.seasonMeta.evidenceProvenance).toBe('no_rankable_source');
    expect(body.seasonMeta.decisionTargetWeek).toBeNull();
    expect(body.seasonMeta.statusDetail).toMatch(/rows were rejected/i);
    expect(body.seasonMeta.statusDetail).toMatch(/declaredAsOfWeek=5/);
    expect(body.seasonMeta.statusDetail).toMatch(/requestedAsOfWeek=18/);
    expect(body.seasonMeta.statusDetail).toMatch(/weekSubstituted=false/);
    expect(body.seasonMeta.statusDetail).not.toMatch(/FORGE grades are not computed/i);
  });

  test('a weekless historical cache that declares no extent yields unknown — never \"full season\"', async () => {
    // A genuinely weekless historical request is the one path where newest is
    // the question asked, so no target-week equality check applies.
    mockResolveSeasonPhase.mockReturnValue(PRESEASON_2026);
    mockedCache.mockResolvedValue({
      players: [cacheRow],
      computedAt: new Date('2025-11-16T18:00:00.000Z'),
      asOfWeek: undefined,
      requestedAsOfWeek: null,
      weekSubstituted: false,
    } as any);

    const { body } = await call('/api/rankings/v2/weekly?position=WR&season=2025');

    expect(mockedCache).toHaveBeenCalledWith(2025, undefined, 'WR', 100, 'test-version', { exactWeek: false });
    expect(body.seasonMeta.evidenceWeek).toBeNull();
    expect(body.seasonMeta.evidenceThroughWeek).toBeNull();
    expect(body.seasonMeta.evidenceProvenance).toBe('source_extent_unknown');
    // Null is "unknown", not "18": nothing downstream may widen it.
    expect(body.seasonMeta.evidenceWeek).not.toBe(18);
    // Negative control for the no_rankable_source fix: a nonempty admitted
    // source that merely doesn't state its week extent still truthfully
    // identifies its season. This must not have been swept into the same
    // null-everything treatment as no_rankable_source.
    expect(body.seasonMeta.evidenceSeason).toBe(2025);
    expect(rankingsV2ResponseSchema.safeParse(body).success).toBe(true);
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
    // The complete no_rankable_source invariant: no evidence season either,
    // no archive flag, no generatedAt, and no layer claiming it answered.
    expect(body.seasonMeta.evidenceSeason).toBeNull();
    expect(body.seasonMeta.evidenceThroughSeason).toBeNull();
    expect(body.seasonMeta.generatedAt).toBeNull();
    expect(body.seasonMeta.isArchiveView).toBe(false);
    expect(body.sourceStack).toEqual([]);
    // The attempted-source diagnostics still surface, just not as evidence.
    expect(body.seasonMeta.statusDetail).toMatch(/2025 week 18/);
    expect(rankingsV2ResponseSchema.safeParse(body).success).toBe(true);
  });

  test('the unavailable payload declares no rankable source', async () => {
    mockResolveSeasonPhase.mockReturnValue(STALE);

    const { body } = await call('/api/rankings/v2/weekly?position=WR');

    expect(body.seasonMeta.evidenceWeek).toBeNull();
    expect(body.seasonMeta.evidenceProvenance).toBe('no_rankable_source');
    // Same complete invariant as the empty-cache path: buildUnavailablePayload
    // is the other producer site and must not leak the requested season as
    // evidence either.
    expect(body.seasonMeta.evidenceSeason).toBeNull();
    expect(body.seasonMeta.evidenceThroughSeason).toBeNull();
    expect(body.seasonMeta.generatedAt).toBeNull();
    expect(body.seasonMeta.isArchiveView).toBe(false);
    expect(body.sourceStack).toEqual([]);
    expect(rankingsV2ResponseSchema.safeParse(body).success).toBe(true);
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

describe('no_rankable_source rejects contradictory evidence metadata at the schema boundary', () => {
  // A minimal, otherwise-valid no_rankable_source seasonMeta. Each adversarial
  // test below mutates exactly one prohibited field away from its required
  // null/false value and asserts the schema — not buildSeasonMeta — is what
  // catches it. Enforcement lives in the .superRefine(), so a producer that
  // regresses this fails loudly at the contract boundary rather than being
  // silently patched up.
  const VALID_NO_RANKABLE_SOURCE_META = {
    currentSeason: 2025,
    forwardRankingSeason: 2025,
    currentPhase: 'regular_season' as const,
    currentPhaseLabel: 'Regular Season',
    currentRegularSeasonWeek: 11,
    targetSeason: 2025,
    targetWeek: 11,
    targetLabel: 'Week 11',
    scheduleSource: 'anchor_derived' as const,
    configStatus: 'ok' as const,
    configNote: null,
    evidenceSeason: null,
    evidenceWeek: null,
    decisionTargetSeason: null,
    decisionTargetWeek: null,
    decisionTargetProvenance: null,
    decisionTargetIsProvisional: false,
    decisionTargetOrigin: null,
    phaseTargetSeason: 2025,
    phaseTargetWeek: 11,
    phaseTargetProvenance: 'anchor_derived' as const,
    phaseTargetIsProvisional: true,
    evidenceThroughSeason: null,
    evidenceThroughWeek: null,
    evidenceProvenance: 'no_rankable_source' as const,
    completionVerified: false,
    finalizedThroughWeek: null,
    completionCopy: 'Completion not verified.',
    generatedAt: null,
    isArchiveView: false,
    status: 'forge_cache_empty_uncomputed',
    statusDetail: 'FORGE grades for this filter have not been computed yet.',
  };

  test('the valid base object itself is accepted (sanity check for the adversarial tests below)', () => {
    expect(rankingsV2SeasonMetaSchema.safeParse(VALID_NO_RANKABLE_SOURCE_META).success).toBe(true);
  });

  test.each([
    ['evidenceSeason', 2025],
    ['evidenceWeek', 11],
    ['evidenceThroughSeason', 2025],
    ['evidenceThroughWeek', 11],
    ['generatedAt', '2025-11-16T18:00:00.000Z'],
  ])('%s must independently fail the server schema when non-null under no_rankable_source', (field, badValue) => {
    const mutated = { ...VALID_NO_RANKABLE_SOURCE_META, [field]: badValue };
    const result = rankingsV2SeasonMetaSchema.safeParse(mutated);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.join('.') === field)).toBe(true);
    }
  });

  test('isArchiveView must independently fail the server schema when true under no_rankable_source', () => {
    const mutated = { ...VALID_NO_RANKABLE_SOURCE_META, isArchiveView: true };
    const result = rankingsV2SeasonMetaSchema.safeParse(mutated);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.join('.') === 'isArchiveView')).toBe(true);
    }
  });

  test('a nonempty sourceStack must independently fail the response schema under no_rankable_source', () => {
    const response = {
      contractVersion: RANKINGS_V2_CONTRACT_VERSION,
      mode: 'weekly' as const,
      lens: 'lineup_decision' as const,
      horizon: 'week' as const,
      asOf: '2025-11-16T18:00:00.000Z',
      sourceStack: [{ layer: 'forge' as const, source: 'api/forge/tiers cache', asOf: null, notes: null }],
      items: [],
      trust: {},
      seasonMeta: VALID_NO_RANKABLE_SOURCE_META,
      identityCoverage: {
        total: 0, canonical: 0, resolved: 0, unresolved: 0, ambiguous: 0, coverageRatio: 0, byReason: {},
      },
    };
    const result = rankingsV2ResponseSchema.safeParse(response);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.join('.') === 'sourceStack')).toBe(true);
    }
  });

  test('an empty sourceStack under no_rankable_source is accepted by the response schema', () => {
    const response = {
      contractVersion: RANKINGS_V2_CONTRACT_VERSION,
      mode: 'weekly' as const,
      lens: 'lineup_decision' as const,
      horizon: 'week' as const,
      asOf: '2025-11-16T18:00:00.000Z',
      sourceStack: [],
      items: [],
      trust: {},
      seasonMeta: VALID_NO_RANKABLE_SOURCE_META,
      identityCoverage: {
        total: 0, canonical: 0, resolved: 0, unresolved: 0, ambiguous: 0, coverageRatio: 0, byReason: {},
      },
    };
    expect(rankingsV2ResponseSchema.safeParse(response).success).toBe(true);
  });

  test.each([
    ['items', (response: any) => {
      response.items = [{
        rank: 1,
        playerId: null,
        playerName: 'Unresolved Player',
        explanation: {},
        trust: {},
        identity: {
          status: 'unresolved', canonicalId: null, sourceId: 'source-1',
          sourceType: 'unknown', reason: 'not_resolved', linkable: false,
        },
      }];
    }],
    ['identityCoverage.total', (response: any) => { response.identityCoverage.total = 1; }],
    ['identityCoverage.byReason', (response: any) => { response.identityCoverage.byReason = { not_resolved: 1 }; }],
    ['trust.asOf', (response: any) => { response.trust.asOf = '2025-11-16T18:00:00.000Z'; }],
    ['trust.confidence', (response: any) => { response.trust.confidence = 0; }],
  ])('a no_rankable_source response rejects contradictory %s', (path, mutate) => {
    const response: any = {
      contractVersion: RANKINGS_V2_CONTRACT_VERSION,
      mode: 'weekly',
      lens: 'lineup_decision',
      horizon: 'week',
      asOf: '2025-11-16T18:00:00.000Z',
      sourceStack: [],
      items: [],
      trust: {},
      seasonMeta: VALID_NO_RANKABLE_SOURCE_META,
      identityCoverage: {
        total: 0, canonical: 0, resolved: 0, unresolved: 0, ambiguous: 0, coverageRatio: 0, byReason: {},
      },
    };
    mutate(response);
    const result = rankingsV2ResponseSchema.safeParse(response);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.join('.').startsWith(path))).toBe(true);
    }
  });

  test('the SERVER response schema still requires seasonMeta — rolling compatibility is a client-only relaxation', () => {
    // Fantasy #307 correction round 4 made `seasonMeta` optional on the
    // CLIENT transport schema only, for a same-contract-version legacy
    // server. The server's own canonical contract is unchanged: this
    // producer must always emit seasonMeta, and a response missing it fails
    // its own contract exactly as before.
    const { seasonMeta, ...responseWithoutSeasonMeta } = {
      contractVersion: RANKINGS_V2_CONTRACT_VERSION,
      mode: 'weekly' as const,
      lens: 'lineup_decision' as const,
      horizon: 'week' as const,
      asOf: '2025-11-16T18:00:00.000Z',
      sourceStack: [],
      items: [],
      trust: {},
      seasonMeta: VALID_NO_RANKABLE_SOURCE_META,
      identityCoverage: {
        total: 0, canonical: 0, resolved: 0, unresolved: 0, ambiguous: 0, coverageRatio: 0, byReason: {},
      },
    };
    void seasonMeta;
    const result = rankingsV2ResponseSchema.safeParse(responseWithoutSeasonMeta);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.join('.') === 'seasonMeta')).toBe(true);
    }
  });
});

describe('seasonMeta rejects synthetic or incoherent live-season facts at the schema boundary', () => {
  const staleBase = {
    currentSeason: null,
    forwardRankingSeason: null,
    currentPhase: null,
    currentPhaseLabel: null,
    currentRegularSeasonWeek: null,
    targetSeason: null,
    targetWeek: null,
    targetLabel: null,
    scheduleSource: null,
    configStatus: 'stale_calendar_config' as const,
    configNote: 'Calendar stale.',
    evidenceSeason: null,
    evidenceWeek: null,
    decisionTargetSeason: null,
    decisionTargetWeek: null,
    decisionTargetProvenance: null,
    decisionTargetIsProvisional: false,
    decisionTargetOrigin: null,
    phaseTargetSeason: null,
    phaseTargetWeek: null,
    phaseTargetProvenance: null,
    phaseTargetIsProvisional: false,
    evidenceThroughSeason: null,
    evidenceThroughWeek: null,
    evidenceProvenance: 'no_rankable_source' as const,
    completionVerified: false,
    finalizedThroughWeek: null,
    completionCopy: 'Completion not verified.',
    generatedAt: null,
    isArchiveView: false,
    status: SEASON_CONFIG_STALE_STATUS,
    statusDetail: 'Calendar stale.',
  };

  test.each([
    ['currentSeason', 2027],
    ['forwardRankingSeason', 2027],
    ['currentPhase', 'offseason'],
    ['currentPhaseLabel', '2027 · Offseason'],
    ['targetSeason', 2027],
    ['phaseTargetSeason', 2027],
  ])('stale metadata independently rejects a synthetic %s', (field, value) => {
    const result = rankingsV2SeasonMetaSchema.safeParse({ ...staleBase, [field]: value });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.join('.') === field)).toBe(true);
    }
  });

  test('fresh metadata rejects nullable live facts that should be known', () => {
    const fresh = {
      ...staleBase,
      currentSeason: 2026,
      forwardRankingSeason: 2026,
      currentPhase: 'preseason',
      currentPhaseLabel: '2026 · Preseason',
      targetSeason: 2026,
      targetWeek: 1,
      targetLabel: 'Target: Week 1',
      scheduleSource: 'anchor_derived',
      configStatus: 'ok',
      configNote: null,
      phaseTargetSeason: 2026,
      phaseTargetWeek: 1,
      phaseTargetProvenance: 'anchor_derived',
      phaseTargetIsProvisional: true,
    };
    for (const field of ['currentSeason', 'currentPhase', 'currentPhaseLabel'] as const) {
      const result = rankingsV2SeasonMetaSchema.safeParse({ ...fresh, [field]: null });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((issue) => issue.path.join('.') === field)).toBe(true);
      }
    }
  });

  test('forwardRankingSeason exactly mirrors the phase target, including a valid null/no-target state', () => {
    const noTarget = {
      ...staleBase,
      currentSeason: 2026,
      currentPhase: 'postseason',
      currentPhaseLabel: '2026 · Postseason',
      configStatus: 'ok',
      configNote: 'No calendar configured after 2026.',
    };
    expect(rankingsV2SeasonMetaSchema.safeParse(noTarget).success).toBe(true);
    expect(rankingsV2SeasonMetaSchema.safeParse({
      ...noTarget, forwardRankingSeason: 2026,
    }).success).toBe(false);
    expect(rankingsV2SeasonMetaSchema.safeParse({
      ...noTarget, scheduleSource: 'anchor_derived',
    }).success).toBe(false);
  });

  test('phase and decision target tuples reject partial or contradictory metadata', () => {
    const fresh = {
      ...staleBase,
      currentSeason: 2026,
      forwardRankingSeason: 2026,
      currentPhase: 'preseason',
      currentPhaseLabel: '2026 · Preseason',
      targetSeason: 2026,
      targetWeek: 1,
      targetLabel: 'Target: Week 1',
      scheduleSource: 'anchor_derived',
      configStatus: 'ok',
      configNote: null,
      decisionTargetSeason: 2026,
      decisionTargetWeek: 1,
      decisionTargetProvenance: 'anchor_derived',
      decisionTargetIsProvisional: true,
      decisionTargetOrigin: 'phase_default',
      phaseTargetSeason: 2026,
      phaseTargetWeek: 1,
      phaseTargetProvenance: 'anchor_derived',
      phaseTargetIsProvisional: true,
    };
    expect(rankingsV2SeasonMetaSchema.safeParse(fresh).success).toBe(true);
    for (const mutated of [
      { ...fresh, targetWeek: 2 },
      { ...fresh, phaseTargetWeek: null },
      { ...fresh, targetLabel: null },
      { ...fresh, scheduleSource: 'explicit_schedule' },
      { ...fresh, decisionTargetSeason: null },
      { ...fresh, decisionTargetWeek: 2 },
      { ...fresh, decisionTargetOrigin: 'explicit_request' },
    ]) {
      expect(rankingsV2SeasonMetaSchema.safeParse(mutated).success).toBe(false);
    }
  });

  test('stale metadata rejects decision schedule provenance and provisionality', () => {
    expect(rankingsV2SeasonMetaSchema.safeParse({
      ...staleBase,
      decisionTargetSeason: 2025,
      decisionTargetWeek: 18,
      decisionTargetOrigin: 'explicit_request',
      decisionTargetProvenance: 'anchor_derived',
    }).success).toBe(false);
    expect(rankingsV2SeasonMetaSchema.safeParse({
      ...staleBase,
      decisionTargetSeason: 2025,
      decisionTargetWeek: 18,
      decisionTargetOrigin: 'explicit_request',
      decisionTargetIsProvisional: true,
    }).success).toBe(false);
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

  test('a defaulted phase-target week asks for an exact read', async () => {
    // Omitting the parameter does not erase the target the phase resolved.
    // "Current board" is Week 11 here, not whatever cache week is newest.
    mockedCache.mockResolvedValue({
      players: [cacheRow], computedAt: new Date('2025-11-16T18:00:00.000Z'), asOfWeek: 11,
    } as any);

    await call('/api/rankings/v2/weekly?position=WR&season=2025');

    expect(mockedCache).toHaveBeenCalledWith(
      2025, MIDSEASON_2025.targetWeek, 'WR', 100, 'test-version', { exactWeek: true },
    );
  });

  test('the actual final-Week-18 no-target state stays weekless instead of resurrecting an expired board', async () => {
    expect(FINAL_WEEK_2025_NO_TARGET.phase).toBe('regular_season');
    expect(FINAL_WEEK_2025_NO_TARGET.regularSeasonWeek).toBe(18);
    expect(FINAL_WEEK_2025_NO_TARGET.targetSeason).toBeNull();
    expect(FINAL_WEEK_2025_NO_TARGET.targetWeek).toBeNull();
    mockResolveSeasonPhase.mockReturnValue(FINAL_WEEK_2025_NO_TARGET);
    mockedCache.mockResolvedValue({
      players: [cacheRow],
      computedAt: new Date('2026-01-06T01:30:00.000Z'),
      asOfWeek: 18,
      requestedAsOfWeek: null,
      weekSubstituted: false,
    } as any);

    const { status, body } = await call('/api/rankings/v2/weekly?position=WR');

    expect(status).toBe(200);
    expect(mockedCache).toHaveBeenCalledWith(
      2025, undefined, 'WR', 100, 'test-version', { exactWeek: false },
    );
    expect(body.items).toHaveLength(1);
    expect(body.seasonMeta.decisionTargetWeek).toBeNull();
    expect(body.seasonMeta.decisionTargetOrigin).toBeNull();
    expect(body.seasonMeta.phaseTargetWeek).toBeNull();
    expect(body.seasonMeta.scheduleSource).toBeNull();
    expect(rankingsV2ResponseSchema.safeParse(body).success).toBe(true);
  });

  test('a validated phase-default hint preserves the target origin carried by the UI', async () => {
    mockedCache.mockResolvedValue({
      players: [cacheRow],
      computedAt: new Date('2025-11-16T18:00:00.000Z'),
      asOfWeek: 11,
      requestedAsOfWeek: 11,
      weekSubstituted: false,
    } as any);

    const { body } = await call(
      '/api/rankings/v2/weekly?position=WR&season=2025&asOfWeek=11&targetOrigin=phase_default',
    );

    expect(mockedCache).toHaveBeenCalledWith(
      2025, 11, 'WR', 100, 'test-version', { exactWeek: true },
    );
    expect(body.seasonMeta.decisionTargetOrigin).toBe('phase_default');
    expect(body.seasonMeta.decisionTargetProvenance).toBe(MIDSEASON_2025.targetProvenance);
    expect(body.seasonMeta.decisionTargetIsProvisional).toBe(MIDSEASON_2025.targetIsProvisional);
  });

  test.each([
    [
      'week',
      MIDSEASON_2025,
      '/api/rankings/v2/weekly?position=WR&season=2025&asOfWeek=10&targetOrigin=phase_default',
      10,
    ],
    [
      'season',
      PRESEASON_2026,
      '/api/rankings/v2/weekly?position=WR&season=2025&asOfWeek=1&targetOrigin=phase_default',
      1,
    ],
  ])('a forged phase-default hint with a mismatched %s remains explicit', async (_kind, phase, path, week) => {
    mockResolveSeasonPhase.mockReturnValue(phase);
    mockedCache.mockResolvedValue({
      players: [cacheRow],
      computedAt: new Date('2025-11-16T18:00:00.000Z'),
      asOfWeek: week,
      requestedAsOfWeek: week,
      weekSubstituted: false,
    } as any);

    const { body } = await call(path as string);

    expect(body.seasonMeta.decisionTargetOrigin).toBe('explicit_request');
    expect(body.seasonMeta.decisionTargetProvenance).toBeNull();
    expect(body.seasonMeta.decisionTargetIsProvisional).toBe(false);
  });

  test.each([
    ['season prefix', '/api/rankings/v2/weekly?position=WR&season=2025junk&asOfWeek=11&targetOrigin=phase_default'],
    ['week prefix', '/api/rankings/v2/weekly?position=WR&season=2025&asOfWeek=11junk&targetOrigin=phase_default'],
    ['absent season', '/api/rankings/v2/weekly?position=WR&asOfWeek=11&targetOrigin=phase_default'],
  ])('a phase-default hint with a non-canonical %s remains explicit', async (_kind, path) => {
    mockedCache.mockResolvedValue({
      players: [cacheRow],
      computedAt: new Date('2025-11-16T18:00:00.000Z'),
      asOfWeek: 11,
      requestedAsOfWeek: 11,
      weekSubstituted: false,
    } as any);

    const { body } = await call(path);

    expect(body.seasonMeta.decisionTargetOrigin).toBe('explicit_request');
    expect(body.seasonMeta.decisionTargetProvenance).toBeNull();
    expect(body.seasonMeta.decisionTargetIsProvisional).toBe(false);
  });

  test('a validated phase-default hint keeps an unavailable target in the uncomputed state', async () => {
    mockedCache.mockResolvedValue({
      players: [],
      computedAt: null,
      asOfWeek: 11,
      requestedAsOfWeek: 11,
      weekSubstituted: false,
    } as any);

    const { body } = await call(
      '/api/rankings/v2/weekly?position=WR&season=2025&asOfWeek=11&targetOrigin=phase_default',
    );

    expect(body.seasonMeta.status).toBe('forge_cache_empty_uncomputed');
    expect(body.seasonMeta.status).not.toBe(EXACT_WEEK_UNAVAILABLE_STATUS);
  });

  test.each([
    ['preseason Week 1', PRESEASON_2026, 2026, 1],
    ['regular-season Week 11', MIDSEASON_2025, 2025, 11],
    ['postseason forward Week 1', POSTSEASON_2025, 2026, 1],
  ])(
    'an unavailable implicit %s target fails closed as uncomputed without substituting',
    async (_label, phase, expectedSeason, expectedWeek) => {
      mockResolveSeasonPhase.mockReturnValue(phase);
      mockedCache.mockResolvedValue({
        players: [],
        computedAt: null,
        asOfWeek: expectedWeek,
        requestedAsOfWeek: expectedWeek,
        weekSubstituted: false,
      } as any);

      const { body } = await call('/api/rankings/v2/weekly?position=WR');

      expect(mockedCache).toHaveBeenCalledWith(
        expectedSeason,
        expectedWeek,
        'WR',
        100,
        'test-version',
        { exactWeek: true },
      );
      expect(body.items).toEqual([]);
      expect(body.seasonMeta.status).toBe('forge_cache_empty_uncomputed');
      expect(body.seasonMeta.status).not.toBe(EXACT_WEEK_UNAVAILABLE_STATUS);
      expect(body.seasonMeta.evidenceProvenance).toBe('no_rankable_source');
    },
  );

  test('a genuinely weekless historical request retains newest-cache semantics', async () => {
    mockResolveSeasonPhase.mockReturnValue(PRESEASON_2026);
    mockedCache.mockResolvedValue({
      players: [cacheRow],
      computedAt: new Date('2026-01-07T12:00:00.000Z'),
      asOfWeek: 18,
      requestedAsOfWeek: null,
      weekSubstituted: false,
    } as any);

    const { body } = await call('/api/rankings/v2/weekly?position=WR&season=2025');

    expect(mockedCache).toHaveBeenCalledWith(
      2025, undefined, 'WR', 100, 'test-version', { exactWeek: false },
    );
    expect(body.items).toHaveLength(1);
    expect(body.seasonMeta.decisionTargetWeek).toBeNull();
    expect(body.seasonMeta.evidenceWeek).toBe(18);
  });

  test('the route backstop rejects rows marked as substituted for an implicit target', async () => {
    mockedCache.mockResolvedValue({
      players: [cacheRow],
      computedAt: new Date('2025-11-16T18:00:00.000Z'),
      asOfWeek: 11,
      requestedAsOfWeek: 11,
      weekSubstituted: true,
    } as any);

    const { body } = await call('/api/rankings/v2/weekly?position=WR&season=2025');

    expect(body.items).toEqual([]);
    expect(body.sourceStack).toEqual([]);
    expect(body.seasonMeta.status).toBe('forge_cache_empty_uncomputed');
    expect(body.seasonMeta.evidenceProvenance).toBe('no_rankable_source');
    expect(body.seasonMeta.statusDetail).toMatch(/rows were rejected/i);
    expect(body.seasonMeta.statusDetail).toMatch(/declaredAsOfWeek=11/);
    expect(body.seasonMeta.statusDetail).toMatch(/requestedAsOfWeek=11/);
    expect(body.seasonMeta.statusDetail).toMatch(/weekSubstituted=true/);
    expect(body.seasonMeta.statusDetail).not.toMatch(/have not been computed yet/i);

    // Real route -> client transport validator -> production view. The server
    // truth above must survive both downstream layers instead of the view
    // replacing it with the ordinary "not computed yet" sentence.
    const validated = validateRankingsV2WeeklyResponse(body);
    const html = renderToStaticMarkup(React.createElement(TiberTiersView, {
      season: 2025,
      decisionTargetWeek: 11,
      availableSeasons: [2025, 2026],
      onSeasonChange: () => {},
      position: 'WR',
      onPositionChange: () => {},
      sortDirection: 'desc',
      onToggleSortDirection: () => {},
      data: validated,
      isLoading: false,
      isError: false,
      isFetching: false,
      onRefetch: () => {},
    }));
    expect(html).toContain('cache rows were rejected');
    expect(html).toContain('target week 11');
    expect(html).toContain('cache week 11');
    expect(html).not.toContain('have not been computed yet');
  });

  test('the route backstop rejects a declared-week mismatch for an implicit target and leaks no cache timestamp', async () => {
    const rejectedComputedAt = '2025-10-20T18:00:00.000Z';
    mockedCache.mockResolvedValue({
      players: [cacheRow],
      computedAt: new Date(rejectedComputedAt),
      asOfWeek: 7,
      requestedAsOfWeek: 11,
      weekSubstituted: false,
    } as any);

    const { body } = await call('/api/rankings/v2/weekly?position=WR&season=2025');

    expect(body.items).toEqual([]);
    expect(body.sourceStack).toEqual([]);
    expect(body.seasonMeta.status).toBe('forge_cache_empty_uncomputed');
    expect(body.seasonMeta.generatedAt).toBeNull();
    expect(body.trust.asOf).toBeNull();
    expect(body.asOf).not.toBe(rejectedComputedAt);
    expect(body.trust.sampleNote).toMatch(/rows were rejected/i);
    expect(body.trust.sampleNote).toMatch(/declaredAsOfWeek=7/);
    expect(body.trust.sampleNote).toMatch(/requestedAsOfWeek=11/);
    expect(body.trust.sampleNote).toMatch(/weekSubstituted=false/);
    expect(() => new Date(body.asOf).toISOString()).not.toThrow();
  });

  test('an ordinary empty cache cannot lend its timestamp to a no-source response', async () => {
    const emptyCacheComputedAt = '2025-11-16T18:00:00.000Z';
    mockedCache.mockResolvedValue({
      players: [],
      computedAt: new Date(emptyCacheComputedAt),
      asOfWeek: 11,
      requestedAsOfWeek: 11,
      weekSubstituted: false,
    } as any);

    const { body } = await call('/api/rankings/v2/weekly?position=WR&season=2025');

    expect(body.seasonMeta.status).toBe('forge_cache_empty_uncomputed');
    expect(body.seasonMeta.generatedAt).toBeNull();
    expect(body.trust.asOf).toBeNull();
    expect(body.asOf).not.toBe(emptyCacheComputedAt);
    expect(body.sourceStack).toEqual([]);
    expect(body.identityCoverage).toEqual({
      total: 0, canonical: 0, resolved: 0, unresolved: 0,
      ambiguous: 0, coverageRatio: 0, byReason: {},
    });
  });

  test('an empty admitted cohort publishes zero coverage even when the resolver reports vacuous ratio one', async () => {
    mockedCache.mockResolvedValue({
      players: [], computedAt: null, asOfWeek: 11, requestedAsOfWeek: 11, weekSubstituted: false,
    } as any);
    mockedIdentityResolver.mockResolvedValueOnce({
      identities: new Map(),
      coverage: {
        total: 0, canonical: 0, resolved: 0, unresolved: 0,
        ambiguous: 0, coverageRatio: 1, byReason: {},
      },
    } as any);

    const { status, body } = await call('/api/rankings/v2/weekly?position=WR&season=2025');

    expect(status).toBe(200);
    expect(body.identityCoverage).toEqual({
      total: 0, canonical: 0, resolved: 0, unresolved: 0,
      ambiguous: 0, coverageRatio: 0, byReason: {},
    });
    expect(rankingsV2ResponseSchema.safeParse(body).success).toBe(true);
  });

  test('the status the server publishes is the one the client switches on', () => {
    // The two sides of a protocol value, pinned together. A typo on either side
    // would make the client fall through to its ordinary empty state — which is
    // exactly the defect this status exists to prevent, reappearing silently.
    expect(EXACT_WEEK_UNAVAILABLE_STATUS).toBe(CLIENT_EXACT_WEEK_UNAVAILABLE_STATUS);
  });

  test('the stale-calendar unavailable status is likewise pinned across the wire', () => {
    expect(SEASON_CONFIG_STALE_STATUS).toBe(CLIENT_SEASON_CONFIG_STALE_STATUS);
  });

  test('a stale LIVE PHASE is a different fact from the typed stale-calendar UNAVAILABLE response (Fantasy #307 round 4)', () => {
    // `configStatus: 'stale_calendar_config'` describes the live calendar and
    // survives even a successfully served configured archive; only the
    // dedicated `status` literal marks the response itself as the fail-closed
    // one. Collapsing the two is exactly the bug this status exists to
    // prevent from reappearing.
    expect(SEASON_CONFIG_STALE_STATUS).not.toBe('stale_calendar_config');
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
    expect(body.seasonMeta.evidenceSeason).toBeNull();
    expect(body.seasonMeta.isArchiveView).toBe(false);
    expect(body.sourceStack).toEqual([]);
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
      players: [], computedAt: null, asOfWeek: 11, requestedAsOfWeek: 11, weekSubstituted: false,
    } as any);

    const { body } = await call('/api/rankings/v2/weekly?position=WR&season=2025');

    expect(body.seasonMeta.status).toBe('forge_cache_empty_uncomputed');
    expect(body.seasonMeta.status).not.toBe('exact_week_evidence_unavailable');
    // The ordinary empty-cache response is the second producer path named in
    // the finding: it must publish the requested/decision season as
    // decisionTargetSeason, never as evidenceSeason.
    expect(body.seasonMeta.decisionTargetSeason).toBe(2025);
    expect(body.seasonMeta.evidenceProvenance).toBe('no_rankable_source');
    expect(body.seasonMeta.evidenceSeason).toBeNull();
    expect(body.seasonMeta.evidenceWeek).toBeNull();
    expect(body.seasonMeta.evidenceThroughSeason).toBeNull();
    expect(body.seasonMeta.evidenceThroughWeek).toBeNull();
    expect(body.seasonMeta.generatedAt).toBeNull();
    expect(body.seasonMeta.isArchiveView).toBe(false);
    expect(body.sourceStack).toEqual([]);
    // Attempted-source diagnostics are folded into statusDetail, not dropped.
    expect(body.seasonMeta.statusDetail).toMatch(/season=2025/);
    expect(rankingsV2ResponseSchema.safeParse(body).success).toBe(true);
  });
});

describe('rolling compatibility is measured against deployed main, not unpublished intermediate shapes', () => {
  // Main 8148d949 predates `seasonMeta` entirely. Its transport validator is a
  // passthrough object, so the relevant rolling-deploy property is that the new
  // additive envelope — including truthful nulls — remains an ignored unknown
  // field. Intermediate schemas from earlier commits on this unmerged branch
  // were never deployed contracts and must not constrain this correction.
  const DEPLOYED_MAIN_TRANSPORT = z.object({
    contractVersion: z.literal(RANKINGS_V2_CONTRACT_VERSION),
    asOf: z.string().datetime(),
    sourceStack: z.array(z.unknown()),
    items: z.array(z.unknown()),
  }).passthrough();

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

  test('a current response remains consumable by the deployed-main passthrough client', async () => {
    const { body } = await call('/api/rankings/v2/weekly?position=WR&season=2025&asOfWeek=7');
    expect(DEPLOYED_MAIN_TRANSPORT.safeParse(body).success).toBe(true);
  });

  test('a stale response with nullable live metadata remains consumable by deployed main', async () => {
    mockResolveSeasonPhase.mockReturnValue(STALE);
    mockedCache.mockResolvedValue({
      players: [cacheRow],
      computedAt: new Date('2026-01-07T12:00:00.000Z'),
      asOfWeek: 18,
      requestedAsOfWeek: 18,
      weekSubstituted: false,
    } as any);

    const { body } = await call('/api/rankings/v2/weekly?position=WR&season=2025&asOfWeek=18');

    expect(body.seasonMeta.currentSeason).toBeNull();
    expect(body.seasonMeta.forwardRankingSeason).toBeNull();
    expect(DEPLOYED_MAIN_TRANSPORT.safeParse(body).success).toBe(true);
  });

  test('the provenance enum has not gained a member', async () => {
    // Origin stays separate from the closed schedule-provenance enum.
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
