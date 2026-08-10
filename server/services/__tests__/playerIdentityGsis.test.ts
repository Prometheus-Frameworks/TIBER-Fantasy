/**
 * Fantasy #308 — exact GSIS lookup and the pre-migration identity census.
 */

/** A fake `player_identity_map` row. Only the columns under test are modelled. */
type Row = Record<string, string | null | undefined> & { canonicalId: string };

let TABLE: Row[] = [];
let QUERY_ERROR: Error | null = null;
const mockIdentityCache = new Map<string, unknown>();
/** Records how the last query filtered, so tests can assert exactness. */
let lastWhere: { kind: 'eq' | 'in'; column: string; values: unknown[] } | null = null;

/** Maps a drizzle column name back to the fake row property. */
const COLUMN_TO_FIELD: Record<string, string> = {
  canonical_id: 'canonicalId',
  gsis_id: 'gsisId',
  sleeper_id: 'sleeperId',
  espn_id: 'espnId',
  yahoo_id: 'yahooId',
  rotowire_id: 'rotowireId',
  fantasypros_id: 'fantasyprosId',
  fantasy_data_id: 'fantasyDataId',
  mysportsfeeds_id: 'mysportsfeedsId',
  nfl_data_py_id: 'nflDataPyId',
};

// Only `eq`/`inArray` are replaced, so the predicate — including *which column*
// was queried — is inspectable while the rest of drizzle stays real;
// `shared/schema.ts` builds drizzle-zod insert schemas at import time and needs
// the genuine module. Capturing the column matters: an earlier harness matched
// any column and made getByCanonicalId() appear to match on gsis_id.
jest.mock('drizzle-orm', () => ({
  ...jest.requireActual('drizzle-orm'),
  eq: (col: { name?: string }, value: unknown) => ({ __kind: 'eq' as const, column: col?.name ?? '', value }),
  inArray: (col: { name?: string }, values: unknown[]) => ({ __kind: 'in' as const, column: col?.name ?? '', values }),
}));

jest.mock('../../infra/db', () => ({
  db: {
    select: () => ({
      // `from()` is awaitable on its own (the census reads the whole table with
      // no predicate) *and* exposes `.where` for filtered reads.
      from: () => ({
        then: (resolve: any, reject: any) => Promise.resolve(TABLE).then(resolve, reject),
        where: (clause: any) => {
          const field = COLUMN_TO_FIELD[clause?.column] ?? clause?.column;
          let rows: Row[];
          if (clause?.__kind === 'in') {
            lastWhere = { kind: 'in', column: clause.column, values: clause.values };
            rows = TABLE.filter((r) => r[field] != null && clause.values.includes(r[field]));
          } else {
            lastWhere = { kind: 'eq', column: clause?.column, values: [clause?.value] };
            rows = TABLE.filter((r) => r[field] === clause?.value);
          }
          const result: any = {
            then: (resolve: any, reject: any) =>
              (QUERY_ERROR ? Promise.reject(QUERY_ERROR) : Promise.resolve(rows)).then(resolve, reject),
          };
          result.limit = (n: number) =>
            QUERY_ERROR ? Promise.reject(QUERY_ERROR) : Promise.resolve(rows.slice(0, n));
          return result;
        },
      }),
    }),
  },
}));

jest.mock('../../../src/data/cache', () => ({
  cacheKey: (parts: unknown[]) => parts.join(':'),
  getCache: (key: string) => mockIdentityCache.get(key) ?? null,
  setCache: (key: string, value: unknown) => mockIdentityCache.set(key, value),
}));

import {
  PLATFORM_COLUMNS,
  PlayerIdentityService,
  WRITABLE_PLATFORM_COLUMNS,
} from '../PlayerIdentityService';

const service = PlayerIdentityService.getInstance();
const AMON_RA_GSIS = '00-0036963';
const AMON_RA_CANONICAL = 'tiber-amon-ra-st-brown';

beforeEach(() => {
  TABLE = [];
  QUERY_ERROR = null;
  lastWhere = null;
  mockIdentityCache.clear();
});

describe('getCanonicalIdByGsisId', () => {
  test('resolves the Amon-Ra GSIS reported in #308', async () => {
    TABLE = [{ canonicalId: AMON_RA_CANONICAL, gsisId: AMON_RA_GSIS }];

    await expect(service.getCanonicalIdByGsisId(AMON_RA_GSIS)).resolves.toEqual({
      status: 'resolved',
      canonicalId: AMON_RA_CANONICAL,
    });
    // Exact column equality, never a LIKE/fuzzy predicate.
    expect(lastWhere).toEqual({ kind: 'eq', column: 'gsis_id', values: [AMON_RA_GSIS] });
  });

  test('reports not_found rather than guessing', async () => {
    TABLE = [{ canonicalId: 'someone-else', gsisId: '00-0011111' }];
    await expect(service.getCanonicalIdByGsisId(AMON_RA_GSIS)).resolves.toEqual({ status: 'not_found' });
  });

  test('fails closed on duplicates instead of picking a winner', async () => {
    TABLE = [
      { canonicalId: 'dupe-a', gsisId: AMON_RA_GSIS },
      { canonicalId: 'dupe-b', gsisId: AMON_RA_GSIS },
    ];
    await expect(service.getCanonicalIdByGsisId(AMON_RA_GSIS)).resolves.toEqual({
      status: 'ambiguous',
      matches: 2,
    });
  });

  test('an empty/whitespace id is not_found without querying', async () => {
    await expect(service.getCanonicalIdByGsisId('   ')).resolves.toEqual({ status: 'not_found' });
    expect(lastWhere).toBeNull();
  });

  test('reports unavailable rather than not_found when the query fails', async () => {
    QUERY_ERROR = new Error('identity database offline');
    const error = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      await expect(service.getCanonicalIdByGsisId(AMON_RA_GSIS)).resolves.toEqual({ status: 'unavailable' });
    } finally {
      error.mockRestore();
    }
  });
});

describe('resolveCanonicalIdsByGsis', () => {
  test('resolves a batch in a single query', async () => {
    TABLE = [
      { canonicalId: AMON_RA_CANONICAL, gsisId: AMON_RA_GSIS },
      { canonicalId: 'tiber-jamarr-chase', gsisId: '00-0036900' },
    ];

    const { resolved, ambiguous, lookupStatus } = await service.resolveCanonicalIdsByGsis([AMON_RA_GSIS, '00-0036900']);

    expect(resolved.get(AMON_RA_GSIS)).toBe(AMON_RA_CANONICAL);
    expect(resolved.get('00-0036900')).toBe('tiber-jamarr-chase');
    expect(ambiguous.size).toBe(0);
    expect(lookupStatus).toBe('available');
    expect(lastWhere?.kind).toBe('in');
  });

  test('separates ambiguous values from resolved ones', async () => {
    TABLE = [
      { canonicalId: 'dupe-a', gsisId: AMON_RA_GSIS },
      { canonicalId: 'dupe-b', gsisId: AMON_RA_GSIS },
      { canonicalId: 'tiber-jamarr-chase', gsisId: '00-0036900' },
    ];

    const { resolved, ambiguous } = await service.resolveCanonicalIdsByGsis([AMON_RA_GSIS, '00-0036900']);

    expect(resolved.has(AMON_RA_GSIS)).toBe(false);
    expect(ambiguous.has(AMON_RA_GSIS)).toBe(true);
    expect(resolved.get('00-0036900')).toBe('tiber-jamarr-chase');
  });

  test('an empty input does not query', async () => {
    const { resolved, lookupStatus } = await service.resolveCanonicalIdsByGsis([]);
    expect(resolved.size).toBe(0);
    expect(lookupStatus).toBe('available');
    expect(lastWhere).toBeNull();
  });

  test('reports an unavailable batch separately from a successful empty result', async () => {
    QUERY_ERROR = new Error('identity database offline');
    const error = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      const result = await service.resolveCanonicalIdsByGsis([AMON_RA_GSIS]);
      expect(result).toEqual({
        resolved: new Map(),
        ambiguous: new Set(),
        lookupStatus: 'unavailable',
      });
    } finally {
      error.mockRestore();
    }
  });
});

describe('duplicate GSIS fails closed on every public path, not just the helper', () => {
  test('getCanonicalId(id, "gsis") returns null rather than an arbitrary row', async () => {
    TABLE = [
      { canonicalId: 'dupe-a', gsisId: AMON_RA_GSIS },
      { canonicalId: 'dupe-b', gsisId: AMON_RA_GSIS },
    ];
    // Before the repair this used .limit(1) and would have returned 'dupe-a'.
    await expect(service.getCanonicalId(AMON_RA_GSIS, 'gsis')).resolves.toBeNull();
  });

  test('getCanonicalId still resolves a unique GSIS', async () => {
    TABLE = [{ canonicalId: AMON_RA_CANONICAL, gsisId: AMON_RA_GSIS }];
    await expect(service.getCanonicalId(AMON_RA_GSIS, 'gsis')).resolves.toBe(AMON_RA_CANONICAL);
  });

  test('getByAnyId returns null for a duplicated GSIS instead of guessing', async () => {
    TABLE = [
      { canonicalId: 'dupe-a', gsisId: AMON_RA_GSIS },
      { canonicalId: 'dupe-b', gsisId: AMON_RA_GSIS },
    ];
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      await expect(service.getByAnyId(AMON_RA_GSIS)).resolves.toBeNull();
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('Ambiguous GSIS'));
    } finally {
      warn.mockRestore();
    }
  });

  test('a same-text canonical_id cannot bypass a duplicated gsis_id', async () => {
    TABLE = [
      { canonicalId: AMON_RA_GSIS, gsisId: AMON_RA_GSIS },
      { canonicalId: 'dupe-b', gsisId: AMON_RA_GSIS },
    ];

    await expect(service.getByAnyId(AMON_RA_GSIS)).resolves.toBeNull();
  });

  test('a GSIS query failure cannot fall through to a same-text canonical_id', async () => {
    TABLE = [{ canonicalId: AMON_RA_GSIS, gsisId: null }];
    QUERY_ERROR = new Error('identity database offline');
    const canonicalLookup = jest.spyOn(service, 'getByCanonicalId');
    const error = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      await expect(service.getByAnyId(AMON_RA_GSIS)).resolves.toBeNull();
      expect(canonicalLookup).not.toHaveBeenCalled();
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('refusing namespace fallback'));
    } finally {
      canonicalLookup.mockRestore();
      error.mockRestore();
      warn.mockRestore();
    }
  });

  test('a GSIS canonical lookup is rechecked when a unique mapping becomes duplicated', async () => {
    TABLE = [{ canonicalId: AMON_RA_CANONICAL, gsisId: AMON_RA_GSIS }];
    await expect(service.getCanonicalId(AMON_RA_GSIS, 'gsis')).resolves.toBe(AMON_RA_CANONICAL);

    TABLE.push({ canonicalId: 'late-duplicate', gsisId: AMON_RA_GSIS });

    // A positive result cached at T0 must not survive the duplicate at T1.
    await expect(service.getCanonicalId(AMON_RA_GSIS, 'gsis')).resolves.toBeNull();
  });

  test('a GSIS by-any-id lookup is rechecked when a unique mapping becomes duplicated', async () => {
    TABLE = [{
      canonicalId: AMON_RA_CANONICAL,
      gsisId: AMON_RA_GSIS,
      fullName: 'Amon-Ra St. Brown',
      position: 'WR',
    }];
    await expect(service.getByAnyId(AMON_RA_GSIS)).resolves.toMatchObject({ canonicalId: AMON_RA_CANONICAL });

    TABLE.push({ canonicalId: 'late-duplicate', gsisId: AMON_RA_GSIS });

    await expect(service.getByAnyId(AMON_RA_GSIS)).resolves.toBeNull();
  });

  test('getByAnyId resolves a unique GSIS through the canonical row', async () => {
    TABLE = [{ canonicalId: AMON_RA_CANONICAL, gsisId: AMON_RA_GSIS }];
    const player = await service.getByAnyId(AMON_RA_GSIS);
    expect(player?.canonicalId).toBe(AMON_RA_CANONICAL);
  });

  test('a non-GSIS-shaped id never touches the GSIS column', async () => {
    TABLE = [{ canonicalId: 'someone', gsisId: 'not-a-gsis' }];
    // 'not-a-gsis' fails the shape test, so the gsis branch is skipped entirely.
    await expect(service.getByAnyId('not-a-gsis')).resolves.toBeNull();
  });

  test('uniquely indexed platform columns keep their existing single-row behaviour', async () => {
    TABLE = [{ canonicalId: 'sleeper-player', gsisId: null, sleeperId: '4034' } as any];
    await expect(service.getCanonicalId('4034', 'sleeper')).resolves.toBe('sleeper-player');
  });
});

describe('GSIS is resolvable but not writable while uniqueness is unenforced', () => {
  test('GSIS is absent from the writable map but present for resolution', () => {
    expect(PLATFORM_COLUMNS.gsis).toBe('gsisId');
    expect(WRITABLE_PLATFORM_COLUMNS.gsis).toBeUndefined();
  });

  test('every writable column is one the database can enforce', () => {
    // The write map must never regain gsis without a unique index landing
    // first — otherwise an admin write can mint the duplicates the resolvers
    // then fail closed on, silently disabling links for that player.
    for (const platform of Object.keys(WRITABLE_PLATFORM_COLUMNS)) {
      expect(platform).not.toBe('gsis');
    }
    expect(Object.keys(WRITABLE_PLATFORM_COLUMNS)).toHaveLength(
      Object.keys(PLATFORM_COLUMNS).length - 1,
    );
  });
});

describe('externalIds envelope', () => {
  test('surfaces gsis and fantasy_data alongside the other platforms', async () => {
    TABLE = [{
      canonicalId: AMON_RA_CANONICAL,
      gsisId: AMON_RA_GSIS,
      fantasyDataId: 'fd-123',
      sleeperId: '4034',
    } as any];
    const player = await service.getByCanonicalId(AMON_RA_CANONICAL);
    expect(player?.externalIds.gsis).toBe(AMON_RA_GSIS);
    expect(player?.externalIds.fantasy_data).toBe('fd-123');
    expect(player?.externalIds.sleeper).toBe('4034');
  });
});

describe('censusGsisIdentity — pre-migration safety check', () => {
  test('a clean table reports a unique index as safe', async () => {
    TABLE = [
      { canonicalId: 'a', gsisId: '00-0000001' },
      { canonicalId: 'b', gsisId: '00-0000002' },
      { canonicalId: 'c', gsisId: null },
    ];

    const census = await service.censusGsisIdentity();

    expect(census).toMatchObject({
      totalRows: 3,
      nonNullGsis: 2,
      nullGsis: 1,
      distinctGsis: 2,
      duplicateGsisValues: 0,
      uniqueIndexSafe: true,
    });
  });

  test('duplicate blank values block the index the census recommends', async () => {
    // '' is NOT NULL, so `CREATE UNIQUE INDEX ... WHERE gsis_id IS NOT NULL`
    // includes both rows and fails. Trimming first counted them as null and
    // reported the migration safe — the verdict disagreeing with its own index.
    TABLE = [
      { canonicalId: 'a', gsisId: '' },
      { canonicalId: 'b', gsisId: '   ' },
      { canonicalId: 'c', gsisId: '00-0000003' },
    ];

    const census = await service.censusGsisIdentity();

    expect(census.nullGsis).toBe(0);
    expect(census.blankOrPaddedGsis).toBe(2);
    expect(census.uniqueIndexSafe).toBe(false);
  });

  test('a whitespace-padded id is malformed, not healthy', async () => {
    // Trimming reported this valid; exact runtime lookups cannot resolve it.
    TABLE = [
      { canonicalId: 'a', gsisId: ` ${AMON_RA_GSIS} ` },
      { canonicalId: 'b', gsisId: '00-0000003' },
    ];

    const census = await service.censusGsisIdentity();

    expect(census.blankOrPaddedGsis).toBe(1);
    expect(census.malformedGsis).toBe(1);
    expect(census.uniqueIndexSafe).toBe(false);
  });

  test('duplicates block the unique index and are sampled', async () => {
    TABLE = [
      { canonicalId: 'a', gsisId: AMON_RA_GSIS },
      { canonicalId: 'b', gsisId: AMON_RA_GSIS },
      { canonicalId: 'c', gsisId: '00-0000003' },
    ];

    const census = await service.censusGsisIdentity();

    expect(census.duplicateGsisValues).toBe(1);
    expect(census.duplicateRowCount).toBe(2);
    expect(census.uniqueIndexSafe).toBe(false);
    expect(census.samples.duplicates).toEqual([{ gsisId: AMON_RA_GSIS, canonicalIds: ['a', 'b'] }]);
  });

  test('nulls alone do not block a partial unique index', async () => {
    TABLE = [
      { canonicalId: 'a', gsisId: null },
      { canonicalId: 'b', gsisId: null },
      { canonicalId: 'c', gsisId: '00-0000003' },
    ];

    const census = await service.censusGsisIdentity();

    expect(census.nullGsis).toBe(2);
    expect(census.uniqueIndexSafe).toBe(true);
  });

  test('malformed GSIS values are counted and sampled', async () => {
    TABLE = [
      { canonicalId: 'a', gsisId: 'not-a-gsis' },
      { canonicalId: 'b', gsisId: '00-0000003' },
    ];

    const census = await service.censusGsisIdentity();

    expect(census.malformedGsis).toBe(1);
    expect(census.samples.malformed).toEqual(['not-a-gsis']);
    // Malformed but distinct values still do not block uniqueness.
    expect(census.uniqueIndexSafe).toBe(true);
  });

  test('performs no writes — read paths only', async () => {
    TABLE = [{ canonicalId: 'a', gsisId: '00-0000001' }];
    const before = JSON.stringify(TABLE);
    await service.censusGsisIdentity();
    expect(JSON.stringify(TABLE)).toBe(before);
  });
});
