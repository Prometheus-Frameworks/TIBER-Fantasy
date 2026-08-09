/**
 * Fantasy #308 — ranking identity boundary.
 *
 * The regression under test: `forge_grade_cache.player_id` (GSIS in the live
 * cohort) was emitted as the public `playerId`, the UI built
 * `/player/00-0036963` from it, and the player endpoint 404'd because
 * `PLATFORM_COLUMNS` never consulted `gsis_id`.
 */

const mockSelect = jest.fn();
jest.mock('../../infra/db', () => ({
  db: { select: (...args: unknown[]) => mockSelect(...args) },
}));

const mockResolveByGsis = jest.fn();
jest.mock('../PlayerIdentityService', () => {
  const actual = jest.requireActual('../PlayerIdentityService');
  return {
    ...actual,
    PlayerIdentityService: {
      getInstance: () => ({ resolveCanonicalIdsByGsis: mockResolveByGsis }),
    },
  };
});

import {
  UNRESOLVED_REASONS,
  measureCoverage,
  resolveRankingIdentities,
} from '../identity/rankingIdentityResolver';
import { looksLikeGsisId, PLATFORM_COLUMNS } from '../PlayerIdentityService';

/** Stub the single canonical pre-check query. */
function canonicalRowsAre(canonicalIds: string[]) {
  mockSelect.mockReturnValue({
    from: () => ({ where: async () => canonicalIds.map((canonicalId) => ({ canonicalId })) }),
  });
}

const AMON_RA_GSIS = '00-0036963';
const AMON_RA_CANONICAL = 'tiber-amon-ra-st-brown';

describe('PLATFORM_COLUMNS', () => {
  test('includes gsis — the omission that caused the Amon-Ra 404', () => {
    expect(PLATFORM_COLUMNS.gsis).toBe('gsisId');
  });

  test('includes fantasy_data, the other schema column that was missing', () => {
    expect(PLATFORM_COLUMNS.fantasy_data).toBe('fantasyDataId');
  });

  test('gsis is consulted before the other platforms', () => {
    expect(Object.keys(PLATFORM_COLUMNS)[0]).toBe('gsis');
  });
});

describe('looksLikeGsisId', () => {
  test.each([
    [AMON_RA_GSIS, true],
    ['00-0036900', true],
    ['00-003696', false], // six digits
    ['00-00369633', false], // eight digits
    ['0036963', false],
    ['real-player-2025-amon-ra-st-brown-strong-wr2-fixture', false],
    ['tiber-amon-ra-st-brown', false],
    ['', false],
  ])('%s -> %s', (value, expected) => {
    expect(looksLikeGsisId(value)).toBe(expected);
  });

  test('rejects the bundled static-artifact fixture namespace', () => {
    // FORGE_PLAYER_STATIC_V1 keys Amon-Ra as a fixture ID. It must never be
    // mistaken for the GSIS ID (#308 regression coverage, #310 lineage split).
    expect(looksLikeGsisId('real-player-2025-amon-ra-st-brown-strong-wr2-fixture')).toBe(false);
  });
});

describe('resolveRankingIdentities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockResolveByGsis.mockResolvedValue({ resolved: new Map(), ambiguous: new Set() });
  });

  test('resolves an exact GSIS to the canonical key', async () => {
    canonicalRowsAre([]);
    mockResolveByGsis.mockResolvedValue({
      resolved: new Map([[AMON_RA_GSIS, AMON_RA_CANONICAL]]),
      ambiguous: new Set(),
    });

    const { identities, coverage } = await resolveRankingIdentities([AMON_RA_GSIS]);

    expect(identities.get(AMON_RA_GSIS)).toEqual({
      status: 'resolved',
      canonicalId: AMON_RA_CANONICAL,
      sourceId: AMON_RA_GSIS,
      sourceType: 'gsis',
      reason: null,
    });
    expect(coverage.resolved).toBe(1);
    expect(coverage.coverageRatio).toBe(1);
  });

  test('passes an already-canonical ID straight through', async () => {
    canonicalRowsAre([AMON_RA_CANONICAL]);

    const { identities } = await resolveRankingIdentities([AMON_RA_CANONICAL]);

    expect(identities.get(AMON_RA_CANONICAL)?.status).toBe('canonical');
    expect(identities.get(AMON_RA_CANONICAL)?.canonicalId).toBe(AMON_RA_CANONICAL);
    // A canonical ID must not be re-queried as a GSIS.
    expect(mockResolveByGsis).not.toHaveBeenCalled();
  });

  test('a GSIS absent from the crosswalk stays unresolved and non-linkable', async () => {
    canonicalRowsAre([]);

    const { identities, coverage } = await resolveRankingIdentities(['00-0099999']);

    const identity = identities.get('00-0099999');
    expect(identity?.status).toBe('unresolved');
    expect(identity?.canonicalId).toBeNull();
    expect(identity?.reason).toBe(UNRESOLVED_REASONS.GSIS_NOT_IN_CROSSWALK);
    // Provenance retained.
    expect(identity?.sourceId).toBe('00-0099999');
    expect(identity?.sourceType).toBe('gsis');
    expect(coverage.unresolved).toBe(1);
  });

  test('a duplicated GSIS fails closed instead of picking a winner', async () => {
    canonicalRowsAre([]);
    mockResolveByGsis.mockResolvedValue({
      resolved: new Map(),
      ambiguous: new Set([AMON_RA_GSIS]),
    });

    const { identities, coverage } = await resolveRankingIdentities([AMON_RA_GSIS]);

    expect(identities.get(AMON_RA_GSIS)?.status).toBe('unresolved');
    expect(identities.get(AMON_RA_GSIS)?.reason).toBe(UNRESOLVED_REASONS.GSIS_AMBIGUOUS);
    expect(coverage.ambiguous).toBe(1);
  });

  test('an unrecognised namespace is typed, not fuzzily matched', async () => {
    canonicalRowsAre([]);

    const { identities } = await resolveRankingIdentities([
      'real-player-2025-amon-ra-st-brown-strong-wr2-fixture',
    ]);

    const identity = identities.get('real-player-2025-amon-ra-st-brown-strong-wr2-fixture');
    expect(identity?.status).toBe('unresolved');
    expect(identity?.reason).toBe(UNRESOLVED_REASONS.UNRECOGNISED_NAMESPACE);
    expect(identity?.sourceType).toBe('unknown');
    // No name-based lookup was attempted anywhere in this path.
    expect(mockResolveByGsis).not.toHaveBeenCalled();
  });

  test('a partially-resolvable cohort keeps every row — the board is never blanked', async () => {
    canonicalRowsAre([]);
    mockResolveByGsis.mockResolvedValue({
      resolved: new Map([[AMON_RA_GSIS, AMON_RA_CANONICAL]]),
      ambiguous: new Set(),
    });

    const cohort = [AMON_RA_GSIS, '00-0099999', '00-0088888'];
    const { identities, coverage } = await resolveRankingIdentities(cohort);

    expect(identities.size).toBe(3);
    expect(coverage.total).toBe(3);
    expect(coverage.resolved).toBe(1);
    expect(coverage.unresolved).toBe(2);
    expect(coverage.coverageRatio).toBeCloseTo(1 / 3);
    // Every input still has an identity record, i.e. a renderable row.
    for (const id of cohort) expect(identities.get(id)).toBeDefined();
  });

  test('batches: one canonical pre-check plus one GSIS resolve for any cohort size', async () => {
    canonicalRowsAre([]);
    const cohort = Array.from({ length: 150 }, (_, i) => `00-00${String(10000 + i)}`);

    await resolveRankingIdentities(cohort);

    expect(mockSelect).toHaveBeenCalledTimes(1);
    expect(mockResolveByGsis).toHaveBeenCalledTimes(1);
    expect(mockResolveByGsis).toHaveBeenCalledWith(cohort);
  });

  test('deduplicates repeated source IDs before querying', async () => {
    canonicalRowsAre([]);

    await resolveRankingIdentities([AMON_RA_GSIS, AMON_RA_GSIS, AMON_RA_GSIS]);

    expect(mockResolveByGsis).toHaveBeenCalledWith([AMON_RA_GSIS]);
  });

  test('an empty producer identifier is a typed unresolved case', async () => {
    canonicalRowsAre([]);

    const { identities, coverage } = await resolveRankingIdentities(['']);

    expect(identities.get('')?.reason).toBe(UNRESOLVED_REASONS.EMPTY);
    expect(coverage.coverageRatio).toBe(0);
  });

  test('an empty cohort is fully covered, not zero-covered', async () => {
    const { coverage } = await resolveRankingIdentities([]);
    expect(coverage.total).toBe(0);
    expect(coverage.coverageRatio).toBe(1);
  });
});

describe('measureCoverage', () => {
  test('counts each status and groups unresolved rows by reason', () => {
    const identities = new Map([
      ['a', { status: 'canonical' as const, canonicalId: 'a', sourceId: 'a', sourceType: 'canonical' as const, reason: null }],
      ['b', { status: 'resolved' as const, canonicalId: 'B', sourceId: 'b', sourceType: 'gsis' as const, reason: null }],
      [
        'c',
        {
          status: 'unresolved' as const,
          canonicalId: null,
          sourceId: 'c',
          sourceType: 'gsis' as const,
          reason: UNRESOLVED_REASONS.GSIS_NOT_IN_CROSSWALK,
        },
      ],
    ]);

    const coverage = measureCoverage(['a', 'b', 'c'], identities);

    expect(coverage).toMatchObject({
      total: 3,
      canonical: 1,
      resolved: 1,
      unresolved: 1,
    });
    expect(coverage.byReason[UNRESOLVED_REASONS.GSIS_NOT_IN_CROSSWALK]).toBe(1);
    expect(coverage.coverageRatio).toBeCloseTo(2 / 3);
  });
});
