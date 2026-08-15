/**
 * Fantasy #329 — merge rollback cannot reactivate a surviving row without a
 * canonical identity. A row merged BEFORE migration 0014 was skipped by the
 * tiber backfill (its identity lived on the survivor); rolling it back makes
 * it a surviving entity again, so the rollback mints an id when absent while
 * preserving any id that was already issued.
 */

type Row = Record<string, unknown> & { canonicalId: string };

let TABLE: Row[] = [];
const UPDATES: Array<{ set: Record<string, unknown>; canonicalId: unknown }> = [];

jest.mock('../../infra/db', () => ({
  db: {
    select: () => ({
      from: () => ({
        where: (clause: { value?: unknown }) => ({
          limit: () =>
            Promise.resolve(TABLE.filter((r) => r.canonicalId === clause?.value)),
        }),
      }),
    }),
    update: () => ({
      set: (setValues: Record<string, unknown>) => ({
        where: (clause: { value?: unknown }) => {
          UPDATES.push({ set: setValues, canonicalId: clause?.value });
          for (const row of TABLE) {
            if (row.canonicalId === clause?.value) Object.assign(row, setValues);
          }
          return Promise.resolve();
        },
      }),
    }),
  },
}));

jest.mock('drizzle-orm', () => ({
  ...jest.requireActual('drizzle-orm'),
  eq: (col: { name?: string }, value: unknown) => ({ column: col?.name ?? '', value }),
}));

import { rollbackMerge } from '../identityConsolidation';
import { TIBER_PLAYER_ID_PATTERN, mintTiberPlayerId } from '../../services/identity/tiberPlayerId';

beforeEach(() => {
  TABLE = [];
  UPDATES.length = 0;
});

describe('rollbackMerge canonical-identity invariant', () => {
  test('a pre-migration merged row (null id) is minted on reactivation', async () => {
    TABLE = [
      { canonicalId: 'sleeper:old', tiberPlayerId: null, mergedInto: 'sleeper:survivor' },
    ];
    await expect(rollbackMerge('sleeper:old')).resolves.toEqual({ success: true });
    expect(UPDATES).toHaveLength(1);
    expect(String(UPDATES[0].set.tiberPlayerId)).toMatch(TIBER_PLAYER_ID_PATTERN);
    expect(UPDATES[0].set.mergedInto).toBeNull();
    expect(UPDATES[0].set.isActive).toBe(true);
  });

  test('an already-issued id is preserved, never reminted', async () => {
    const issued = mintTiberPlayerId();
    TABLE = [
      { canonicalId: 'sleeper:old', tiberPlayerId: issued, mergedInto: 'sleeper:survivor' },
    ];
    await expect(rollbackMerge('sleeper:old')).resolves.toEqual({ success: true });
    expect(UPDATES).toHaveLength(1);
    expect('tiberPlayerId' in UPDATES[0].set).toBe(false);
    expect(TABLE[0].tiberPlayerId).toBe(issued);
  });

  test('an unmerged row is still refused', async () => {
    TABLE = [{ canonicalId: 'sleeper:active', tiberPlayerId: null, mergedInto: null }];
    await expect(rollbackMerge('sleeper:active')).resolves.toEqual({
      success: false,
      error: 'Record was not merged',
    });
    expect(UPDATES).toHaveLength(0);
  });
});

describe('retired raw-SQL population script', () => {
  test('populatePlayerIdentityFromUsage.py keeps its contract-retirement guard', () => {
    // Tripwire: the Python writer is outside the TypeScript mint, so its
    // hard-fail guard is the only thing preventing it from reopening the
    // active-null population. Removing the guard must fail this suite.
    const { readFileSync } = jest.requireActual('node:fs') as typeof import('node:fs');
    const source = readFileSync(
      require.resolve('../populatePlayerIdentityFromUsage.py'),
      'utf8',
    );
    expect(source).toContain('refuse_if_canonical_identity_contract_present');
    expect(source).toContain("column_name = 'tiber_player_id'");
    expect(source).toContain('sys.exit(1)');
    // The guard must actually be invoked on the write path, not just defined.
    expect(source).toContain('refuse_if_canonical_identity_contract_present(cur)');
  });
});
