/**
 * Fantasy #308 — exact GSIS lookup and the pre-migration identity census.
 */

type Row = { canonicalId: string; gsisId: string | null };

let TABLE: Row[] = [];
/** Records how the last query filtered, so tests can assert exactness. */
let lastWhere: { kind: 'eq' | 'in'; values: string[] } | null = null;

// Only `eq`/`inArray` are replaced, so the predicate shape is inspectable while
// the rest of drizzle stays real — `shared/schema.ts` builds drizzle-zod insert
// schemas at import time and needs the genuine module.
jest.mock('drizzle-orm', () => ({
  ...jest.requireActual('drizzle-orm'),
  eq: (_col: unknown, value: string) => ({ __kind: 'eq' as const, value }),
  inArray: (_col: unknown, values: string[]) => ({ __kind: 'in' as const, values }),
}));

jest.mock('../../infra/db', () => ({
  db: {
    select: () => ({
      from: () => {
        const runner = {
          where: (clause: any) => {
            let rows: Row[];
            if (clause?.__kind === 'in') {
              lastWhere = { kind: 'in', values: clause.values };
              rows = TABLE.filter((r) => r.gsisId !== null && clause.values.includes(r.gsisId));
            } else {
              lastWhere = { kind: 'eq', values: [clause?.value] };
              rows = TABLE.filter((r) => r.gsisId === clause?.value || r.canonicalId === clause?.value);
            }
            const result: any = Promise.resolve(rows);
            result.limit = (n: number) => Promise.resolve(rows.slice(0, n));
            return result;
          },
          then: (resolve: any) => Promise.resolve(TABLE).then(resolve),
        };
        return runner;
      },
    }),
  },
}));

jest.mock('../../../src/data/cache', () => ({
  cacheKey: (parts: unknown[]) => parts.join(':'),
  getCache: () => null,
  setCache: () => undefined,
}));

import { PlayerIdentityService } from '../PlayerIdentityService';

const service = PlayerIdentityService.getInstance();
const AMON_RA_GSIS = '00-0036963';
const AMON_RA_CANONICAL = 'tiber-amon-ra-st-brown';

beforeEach(() => {
  TABLE = [];
  lastWhere = null;
});

describe('getCanonicalIdByGsisId', () => {
  test('resolves the Amon-Ra GSIS reported in #308', async () => {
    TABLE = [{ canonicalId: AMON_RA_CANONICAL, gsisId: AMON_RA_GSIS }];

    await expect(service.getCanonicalIdByGsisId(AMON_RA_GSIS)).resolves.toEqual({
      status: 'resolved',
      canonicalId: AMON_RA_CANONICAL,
    });
    // Exact column equality, never a LIKE/fuzzy predicate.
    expect(lastWhere).toEqual({ kind: 'eq', values: [AMON_RA_GSIS] });
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
});

describe('resolveCanonicalIdsByGsis', () => {
  test('resolves a batch in a single query', async () => {
    TABLE = [
      { canonicalId: AMON_RA_CANONICAL, gsisId: AMON_RA_GSIS },
      { canonicalId: 'tiber-jamarr-chase', gsisId: '00-0036900' },
    ];

    const { resolved, ambiguous } = await service.resolveCanonicalIdsByGsis([AMON_RA_GSIS, '00-0036900']);

    expect(resolved.get(AMON_RA_GSIS)).toBe(AMON_RA_CANONICAL);
    expect(resolved.get('00-0036900')).toBe('tiber-jamarr-chase');
    expect(ambiguous.size).toBe(0);
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
    const { resolved } = await service.resolveCanonicalIdsByGsis([]);
    expect(resolved.size).toBe(0);
    expect(lastWhere).toBeNull();
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
