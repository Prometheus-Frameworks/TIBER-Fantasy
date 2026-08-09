/**
 * Fantasy #308 — cross-surface identity contract.
 *
 * Asserts the invariant the live 404 violated: every **linked** `playerId` the
 * public Rankings v2 API emits must resolve through the player-identity lookup.
 * The two surfaces are exercised against one shared fake crosswalk, so a
 * regression in either boundary breaks this test.
 */

import express from 'express';
import { AddressInfo } from 'net';

const AMON_RA_GSIS = '00-0036963';
const AMON_RA_CANONICAL = 'tiber-amon-ra-st-brown';
const CHASE_GSIS = '00-0036900';
const CHASE_CANONICAL = 'tiber-jamarr-chase';
/** Present in the ranking cohort but deliberately absent from the crosswalk. */
const ORPHAN_GSIS = '00-0099999';

/** GSIS values deliberately duplicated in the shared fake identity table. */
const DUPLICATED_GSIS = '00-0077777';

const mockIdentityRows = [
  { canonicalId: AMON_RA_CANONICAL, gsisId: AMON_RA_GSIS, fullName: 'Amon-Ra St. Brown' },
  { canonicalId: CHASE_CANONICAL, gsisId: CHASE_GSIS, fullName: "Ja'Marr Chase" },
  { canonicalId: 'duplicate-a', gsisId: DUPLICATED_GSIS, fullName: 'Duplicate A' },
  { canonicalId: 'duplicate-b', gsisId: DUPLICATED_GSIS, fullName: 'Duplicate B' },
];

function mockResolveIdentity(id: string):
  | { status: 'resolved'; row: (typeof mockIdentityRows)[number] }
  | { status: 'ambiguous' }
  | { status: 'not_found' } {
  const gsisMatches = mockIdentityRows.filter((row) => row.gsisId === id);
  if (gsisMatches.length > 1) return { status: 'ambiguous' };
  if (gsisMatches.length === 1) return { status: 'resolved', row: gsisMatches[0] };
  const canonical = mockIdentityRows.find((row) => row.canonicalId === id);
  return canonical ? { status: 'resolved', row: canonical } : { status: 'not_found' };
}

// `requireActual` on the resolver pulls in the real db module, which throws at
// import time without DATABASE_URL. The crosswalk below is the only data source
// this test needs.
jest.mock('../../infra/db', () => ({ db: {} }));

// Mount the real playerIdentityRoutes router while driving it with the same
// collision-aware identity fixture used by the ranking resolver below. This is
// an HTTP route regression, not a local stand-in for route behaviour.
jest.mock('../../services/PlayerIdentityService', () => {
  const actual = jest.requireActual('../../services/PlayerIdentityService');
  return {
    ...actual,
    playerIdentityService: {
      getByAnyId: jest.fn(async (id: string) => {
        const result = mockResolveIdentity(id);
        if (result.status !== 'resolved') return null;
        return {
          canonicalId: result.row.canonicalId,
          fullName: result.row.fullName,
          position: 'WR',
          nflTeam: 'DET',
          confidence: 1,
          externalIds: { gsis: result.row.gsisId },
          isActive: true,
          lastVerified: new Date('2026-08-09T00:00:00.000Z'),
        };
      }),
    },
  };
});

jest.mock('../../modules/externalModels/playerDetailEnrichment/playerDetailEnrichmentOrchestrator', () => ({
  orchestratePlayerDetailEnrichment: jest.fn(async () => ({})),
}));

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

// One fake crosswalk, shared by both surfaces.
jest.mock('../../services/identity/rankingIdentityResolver', () => {
  const actual = jest.requireActual('../../services/identity/rankingIdentityResolver');
  return {
    ...actual,
    resolveRankingIdentities: async (sourceIds: string[]) => {
      const identities = new Map();
      for (const raw of sourceIds) {
        const sourceId = (raw ?? '').trim();
        const resolution = mockResolveIdentity(sourceId);
        const canonicalId = resolution.status === 'resolved' ? resolution.row.canonicalId : null;
        identities.set(sourceId, {
          status: canonicalId ? 'resolved' : 'unresolved',
          canonicalId,
          sourceId,
          sourceType: /^00-\d{7}$/.test(sourceId) ? 'gsis' : 'unknown',
          reason: canonicalId
            ? null
            : resolution.status === 'ambiguous'
              ? 'gsis_ambiguous_duplicate_crosswalk_rows'
              : 'gsis_not_in_identity_map',
        });
      }
      const ambiguous = new Set(
        sourceIds.filter((sourceId) => mockResolveIdentity(sourceId).status === 'ambiguous'),
      );
      return { identities, coverage: actual.measureCoverage(sourceIds, identities, ambiguous) };
    },
  };
});

import { createRankingsV2Router } from '../rankingsV2Routes';
import playerIdentityRouter from '../playerIdentityRoutes';
import { getGradesFromCache } from '../../modules/forge/forgeGradeCache';
import { buildRankingsScoringInputs, hasMeaningfulScoringInputs } from '../../modules/externalModels/scoring/scoringRequestMappers';

const mockedCache = getGradesFromCache as jest.MockedFunction<typeof getGradesFromCache>;
const mockedBuild = buildRankingsScoringInputs as jest.MockedFunction<typeof buildRankingsScoringInputs>;
const mockedMeaningful = hasMeaningfulScoringInputs as jest.MockedFunction<typeof hasMeaningfulScoringInputs>;

function cacheRow(playerId: string, playerName: string, alpha: number) {
  return {
    playerId,
    playerName,
    position: 'WR',
    nflTeam: 'DET',
    alpha,
    rawAlpha: alpha,
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
}

async function fetchRankings(path: string) {
  const app = express();
  app.use('/api/rankings/v2', createRankingsV2Router());
  app.use('/api/player-identity', playerIdentityRouter);
  const server = app.listen(0);
  const { port } = server.address() as AddressInfo;
  try {
    const res = await fetch(`http://127.0.0.1:${port}${path}`);
    return { status: res.status, body: await res.json() };
  } finally {
    server.close();
  }
}

async function fetchPlayer(id: string) {
  const app = express();
  app.use('/api/player-identity', playerIdentityRouter);
  const server = app.listen(0);
  const { port } = server.address() as AddressInfo;
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/player-identity/player/${encodeURIComponent(id)}`);
    return { status: res.status, body: await res.json() };
  } finally {
    server.close();
  }
}

describe('Rankings v2 → player identity, cross-surface', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedBuild.mockResolvedValue([]);
    mockedMeaningful.mockReturnValue(false);
    mockedCache.mockResolvedValue({
      players: [
        cacheRow(AMON_RA_GSIS, 'Amon-Ra St. Brown', 95),
        cacheRow(CHASE_GSIS, "Ja'Marr Chase", 90.6),
        cacheRow(ORPHAN_GSIS, 'Unmapped Player', 70),
      ],
      computedAt: new Date('2026-08-08T19:04:15.325Z'),
      asOfWeek: 18,
    } as any);
  });

  test('the invariant: every linked playerId resolves through player identity', async () => {
    const { body } = await fetchRankings('/api/rankings/v2/weekly?position=WR&season=2025&asOfWeek=18');

    const linked = body.items.filter((item: any) => item.identity.linkable);
    expect(linked.length).toBeGreaterThan(0);

    for (const item of linked) {
      const lookup = await fetchPlayer(item.playerId);
      expect(lookup.status).toBe(200);
      expect(lookup.body.data.canonicalId).toBe(item.playerId);
    }
  });

  test('Amon-Ra resolves from the ranking row to a canonical player page', async () => {
    const { body } = await fetchRankings('/api/rankings/v2/weekly?position=WR&season=2025&asOfWeek=18');

    const amonRa = body.items.find((item: any) => item.playerName === 'Amon-Ra St. Brown');
    expect(amonRa).toBeDefined();
    // The public key is canonical, not the raw GSIS the cache stores.
    expect(amonRa.playerId).toBe(AMON_RA_CANONICAL);
    expect(amonRa.playerId).not.toBe(AMON_RA_GSIS);
    expect(amonRa.identity.linkable).toBe(true);
    // Provenance survives.
    expect(amonRa.identity.sourceId).toBe(AMON_RA_GSIS);
    expect(amonRa.identity.sourceType).toBe('gsis');
    const playerResponse = await fetchPlayer(amonRa.playerId);
    expect(playerResponse.status).toBe(200);
    expect(playerResponse.body.data.canonicalId).toBe(AMON_RA_CANONICAL);
  });

  test('the exact reported regression no longer occurs', async () => {
    // Before: the row emitted playerId "00-0036963" and /player/00-0036963 404'd.
    const { body } = await fetchRankings('/api/rankings/v2/weekly?position=WR&season=2025&asOfWeek=18');
    const rawGsisLinked = body.items.filter(
      (item: any) => item.identity.linkable && /^00-\d{7}$/.test(item.playerId),
    );
    expect(rawGsisLinked).toHaveLength(0);
  });

  test('an unresolved row stays visible but is not linkable', async () => {
    const { body } = await fetchRankings('/api/rankings/v2/weekly?position=WR&season=2025&asOfWeek=18');

    const orphan = body.items.find((item: any) => item.identity.sourceId === ORPHAN_GSIS);
    expect(orphan).toBeDefined();
    expect(orphan.playerName).toBe('Unmapped Player');
    expect(orphan.identity.linkable).toBe(false);
    expect(orphan.identity.canonicalId).toBeNull();
    expect(orphan.identity.reason).toBe('gsis_not_in_identity_map');
  });

  test('partial crosswalk coverage does not blank the board', async () => {
    const { body } = await fetchRankings('/api/rankings/v2/weekly?position=WR&season=2025&asOfWeek=18');

    // All three producer rows are still present.
    expect(body.items).toHaveLength(3);
    expect(body.identityCoverage.total).toBe(3);
    expect(body.identityCoverage.resolved).toBe(2);
    expect(body.identityCoverage.unresolved).toBe(1);
    expect(body.identityCoverage.coverageRatio).toBeCloseTo(2 / 3);
  });

  test('coverage is reported even when nothing resolves', async () => {
    mockedCache.mockResolvedValue({
      players: [cacheRow(ORPHAN_GSIS, 'Unmapped Player', 70)],
      computedAt: new Date('2026-08-08T19:04:15.325Z'),
      asOfWeek: 18,
    } as any);

    const { body } = await fetchRankings('/api/rankings/v2/weekly?position=WR&season=2025&asOfWeek=18');

    expect(body.items).toHaveLength(1);
    expect(body.identityCoverage.coverageRatio).toBe(0);
    expect(body.identityCoverage.byReason.gsis_not_in_identity_map).toBe(1);
  });

  test('the mounted public player route returns HTTP 404 for a duplicated GSIS', async () => {
    const lookup = await fetchPlayer(DUPLICATED_GSIS);
    expect(lookup.status).toBe(404);
    expect(lookup.body).toEqual({ success: false, message: 'Player not found' });
  });

  test('unresolved rows expose a null canonical playerId, never the raw source id', async () => {
    const { body } = await fetchRankings('/api/rankings/v2/weekly?position=WR&season=2025&asOfWeek=18');

    const orphan = body.items.find((item: any) => item.identity.sourceId === ORPHAN_GSIS);
    // The contract says playerId is canonical-only, so an unresolved row carries null.
    expect(orphan.playerId).toBeNull();
    expect(orphan.playerId).not.toBe(ORPHAN_GSIS);
    // Provenance still available for display/debugging.
    expect(orphan.identity.sourceId).toBe(ORPHAN_GSIS);
  });

  test('no linked row ever carries a null or raw-source playerId', async () => {
    const { body } = await fetchRankings('/api/rankings/v2/weekly?position=WR&season=2025&asOfWeek=18');
    for (const item of body.items) {
      if (item.identity.linkable) {
        expect(typeof item.playerId).toBe('string');
        expect(item.playerId).not.toMatch(/^00-\d{7}$/);
      } else {
        expect(item.playerId).toBeNull();
      }
    }
  });

  test('identity survives contract validation rather than being stripped', async () => {
    const { body } = await fetchRankings('/api/rankings/v2/weekly?position=WR&season=2025&asOfWeek=18');
    for (const item of body.items) {
      expect(item.identity).toBeDefined();
      expect(typeof item.identity.linkable).toBe('boolean');
    }
    expect(body.identityCoverage).toBeDefined();
  });
});
