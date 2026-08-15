/**
 * Fantasy #327 (PR A) — canonical tiber_player_id on the identity registry:
 * minting on create, exact fail-closed lookup, and the idempotent backfill
 * that skips merged rows (their entity identity lives on the survivor).
 */

/** A fake `player_identity_map` row. Only the columns under test are modelled. */
type Row = Record<string, string | null | undefined> & { canonicalId: string };

let TABLE: Row[] = [];
let QUERY_ERROR: Error | null = null;
const INSERTS: Record<string, unknown>[] = [];
const UPDATES: Array<{ set: Record<string, unknown>; matched: string[] }> = [];
const mockIdentityCache = new Map<string, unknown>();

/** Maps a drizzle column name back to the fake row property. */
const COLUMN_TO_FIELD: Record<string, string> = {
  canonical_id: 'canonicalId',
  tiber_player_id: 'tiberPlayerId',
  gsis_id: 'gsisId',
  sleeper_id: 'sleeperId',
  espn_id: 'espnId',
  yahoo_id: 'yahooId',
  rotowire_id: 'rotowireId',
  fantasypros_id: 'fantasyprosId',
  fantasy_data_id: 'fantasyDataId',
  mysportsfeeds_id: 'mysportsfeedsId',
  nfl_data_py_id: 'nflDataPyId',
  merged_into: 'mergedInto',
};

type Clause =
  | { __kind: 'eq'; column: string; value: unknown }
  | { __kind: 'in'; column: string; values: unknown[] }
  | { __kind: 'isNull'; column: string }
  | { __kind: 'and'; clauses: Clause[] };

function rowMatches(row: Row, clause: Clause | undefined): boolean {
  if (!clause) return true;
  if (clause.__kind === 'and') return clause.clauses.every((c) => rowMatches(row, c));
  const field = COLUMN_TO_FIELD[clause.column] ?? clause.column;
  if (clause.__kind === 'isNull') return row[field] == null;
  if (clause.__kind === 'in') return row[field] != null && clause.values.includes(row[field]);
  return row[field] === clause.value;
}

// Only the predicate builders are replaced so which column was queried stays
// inspectable while the rest of drizzle stays real (shared/schema.ts builds
// drizzle-zod insert schemas at import time and needs the genuine module).
jest.mock('drizzle-orm', () => ({
  ...jest.requireActual('drizzle-orm'),
  eq: (col: { name?: string }, value: unknown) => ({ __kind: 'eq' as const, column: col?.name ?? '', value }),
  inArray: (col: { name?: string }, values: unknown[]) => ({ __kind: 'in' as const, column: col?.name ?? '', values }),
  isNull: (col: { name?: string }) => ({ __kind: 'isNull' as const, column: col?.name ?? '' }),
  and: (...clauses: Clause[]) => ({ __kind: 'and' as const, clauses }),
}));

jest.mock('../../infra/db', () => ({
  db: {
    select: () => ({
      from: () => ({
        then: (resolve: any, reject: any) =>
          (QUERY_ERROR ? Promise.reject(QUERY_ERROR) : Promise.resolve(TABLE)).then(resolve, reject),
        where: (clause: Clause) => {
          const rows = TABLE.filter((r) => rowMatches(r, clause));
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
    insert: () => ({
      values: (value: Record<string, unknown>) => {
        if (QUERY_ERROR) return Promise.reject(QUERY_ERROR);
        INSERTS.push(value);
        TABLE.push(value as Row);
        return Promise.resolve();
      },
    }),
    update: () => ({
      set: (setValues: Record<string, unknown>) => ({
        where: (clause: Clause) => {
          if (QUERY_ERROR) return Promise.reject(QUERY_ERROR);
          const matched: string[] = [];
          for (const row of TABLE) {
            if (rowMatches(row, clause)) {
              matched.push(row.canonicalId);
              for (const [key, value] of Object.entries(setValues)) {
                (row as Record<string, unknown>)[key] = value;
              }
            }
          }
          UPDATES.push({ set: setValues, matched });
          return Promise.resolve();
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

import { PlayerIdentityService } from '../PlayerIdentityService';
import { TIBER_PLAYER_ID_PATTERN, mintTiberPlayerId } from '../identity/tiberPlayerId';

const service = PlayerIdentityService.getInstance();

beforeEach(() => {
  TABLE = [];
  QUERY_ERROR = null;
  INSERTS.length = 0;
  UPDATES.length = 0;
  mockIdentityCache.clear();
});

describe('createPlayerIdentity', () => {
  test('every new registry row is born with a canonical tiber_player_id', async () => {
    await expect(
      service.createPlayerIdentity({
        canonicalId: 'sleeper:9500',
        fullName: 'Josh Downs',
        position: 'wr',
      }),
    ).resolves.toBe(true);

    expect(INSERTS).toHaveLength(1);
    expect(String(INSERTS[0].tiberPlayerId)).toMatch(TIBER_PLAYER_ID_PATTERN);
  });
});

describe('getByTiberPlayerId', () => {
  const ID = mintTiberPlayerId();

  test('resolves an exact match', async () => {
    TABLE = [{ canonicalId: 'sleeper:9500', tiberPlayerId: ID, fullName: 'Josh Downs', position: 'WR' }];
    const resolution = await service.getByTiberPlayerId(ID);
    expect(resolution.status).toBe('resolved');
    if (resolution.status === 'resolved') {
      expect(resolution.player.tiberPlayerId).toBe(ID);
      expect(resolution.player.canonicalId).toBe('sleeper:9500');
    }
  });

  test('reports not_found for a well-formed unknown id', async () => {
    await expect(service.getByTiberPlayerId(mintTiberPlayerId())).resolves.toEqual({ status: 'not_found' });
  });

  test('rejects provider-shaped identifiers without querying', async () => {
    await expect(service.getByTiberPlayerId('sleeper:9500')).resolves.toEqual({ status: 'not_found' });
    await expect(service.getByTiberPlayerId('00-0035659')).resolves.toEqual({ status: 'not_found' });
  });

  test('fails closed on duplicates instead of picking a winner', async () => {
    TABLE = [
      { canonicalId: 'dupe-a', tiberPlayerId: ID, fullName: 'A', position: 'WR' },
      { canonicalId: 'dupe-b', tiberPlayerId: ID, fullName: 'B', position: 'WR' },
    ];
    await expect(service.getByTiberPlayerId(ID)).resolves.toEqual({ status: 'ambiguous', matches: 2 });
  });

  test('reports unavailable on lookup outage, never an empty-namespace conclusion', async () => {
    QUERY_ERROR = new Error('connection refused');
    await expect(service.getByTiberPlayerId(ID)).resolves.toEqual({ status: 'unavailable' });
  });

  test('a merged row redirects to the survivor, whose own id is the entity identity', async () => {
    // Merge paths set merged_into without touching tiber_player_id, so a row
    // minted before a merge keeps its id as a stable historical redirect.
    const loserId = mintTiberPlayerId();
    const survivorId = mintTiberPlayerId();
    TABLE = [
      { canonicalId: 'sleeper:loser', tiberPlayerId: loserId, mergedInto: 'sleeper:survivor', fullName: 'Dupe', position: 'WR' },
      { canonicalId: 'sleeper:survivor', tiberPlayerId: survivorId, mergedInto: null, fullName: 'Real', position: 'WR' },
    ];
    const resolution = await service.getByTiberPlayerId(loserId);
    expect(resolution.status).toBe('resolved');
    if (resolution.status === 'resolved') {
      expect(resolution.player.canonicalId).toBe('sleeper:survivor');
      expect(resolution.player.tiberPlayerId).toBe(survivorId);
    }
  });

  test('a chained merge resolves through to the final survivor', async () => {
    const first = mintTiberPlayerId();
    TABLE = [
      { canonicalId: 'a', tiberPlayerId: first, mergedInto: 'b', fullName: 'A', position: 'WR' },
      { canonicalId: 'b', tiberPlayerId: null, mergedInto: 'c', fullName: 'B', position: 'WR' },
      { canonicalId: 'c', tiberPlayerId: mintTiberPlayerId(), mergedInto: null, fullName: 'C', position: 'WR' },
    ];
    const resolution = await service.getByTiberPlayerId(first);
    expect(resolution.status).toBe('resolved');
    if (resolution.status === 'resolved') {
      expect(resolution.player.canonicalId).toBe('c');
    }
  });

  test('a merged_into cycle fails closed as merge_broken', async () => {
    const cycled = mintTiberPlayerId();
    TABLE = [
      { canonicalId: 'a', tiberPlayerId: cycled, mergedInto: 'b', fullName: 'A', position: 'WR' },
      { canonicalId: 'b', tiberPlayerId: null, mergedInto: 'a', fullName: 'B', position: 'WR' },
    ];
    await expect(service.getByTiberPlayerId(cycled)).resolves.toEqual({ status: 'merge_broken' });
  });

  test('a missing merge survivor fails closed as merge_broken', async () => {
    const orphaned = mintTiberPlayerId();
    TABLE = [
      { canonicalId: 'a', tiberPlayerId: orphaned, mergedInto: 'vanished', fullName: 'A', position: 'WR' },
    ];
    await expect(service.getByTiberPlayerId(orphaned)).resolves.toEqual({ status: 'merge_broken' });
  });
});

describe('getByAnyId with a canonical identifier', () => {
  const ID = mintTiberPlayerId();

  test('resolves through the canonical column first', async () => {
    TABLE = [{ canonicalId: 'sleeper:9500', tiberPlayerId: ID, fullName: 'Josh Downs', position: 'WR' }];
    const player = await service.getByAnyId(ID);
    expect(player?.tiberPlayerId).toBe(ID);
  });

  test('a tiber-shaped id never falls through to provider columns', async () => {
    // A row whose sleeper_id equals the tiber-shaped query must NOT match.
    TABLE = [{ canonicalId: 'sleeper:x', sleeperId: ID, fullName: 'Wrong Player', position: 'WR' }];
    await expect(service.getByAnyId(ID)).resolves.toBeNull();
  });
});

describe('backfillTiberPlayerIds', () => {
  test('mints for unminted active rows, skips merged rows, and is idempotent', async () => {
    const preexisting = mintTiberPlayerId();
    TABLE = [
      { canonicalId: 'sleeper:1', tiberPlayerId: null, mergedInto: null, fullName: 'A', position: 'WR' },
      { canonicalId: 'sleeper:2', tiberPlayerId: preexisting, mergedInto: null, fullName: 'B', position: 'RB' },
      { canonicalId: 'sleeper:3', tiberPlayerId: null, mergedInto: 'sleeper:1', fullName: 'A dupe', position: 'WR' },
    ];

    const first = await service.backfillTiberPlayerIds();
    expect(first).toEqual({ minted: 1, skippedMerged: 1, status: 'complete' });
    expect(String(TABLE[0].tiberPlayerId)).toMatch(TIBER_PLAYER_ID_PATTERN);
    expect(TABLE[1].tiberPlayerId).toBe(preexisting);
    expect(TABLE[2].tiberPlayerId).toBeNull();

    const second = await service.backfillTiberPlayerIds();
    expect(second).toEqual({ minted: 0, skippedMerged: 1, status: 'complete' });
  });

  test('reports failure with progress rather than continuing past an outage', async () => {
    QUERY_ERROR = new Error('connection refused');
    await expect(service.backfillTiberPlayerIds()).resolves.toEqual({
      minted: 0,
      skippedMerged: 0,
      status: 'failed',
    });
  });
});
