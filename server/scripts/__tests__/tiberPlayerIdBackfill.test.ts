/**
 * Fantasy #327 — canonical identity operations CLI (invocation surface for the
 * methods merged in #329). Covers command parsing, read-only census behavior,
 * the backfill → census flow, and failure propagation.
 */

import {
  UsageError,
  parseCommand,
  runBackfill,
  runCensus,
  runCommand,
  type BackfillResult,
  type CensusResult,
  type IdentityOpsDeps,
} from '../tiberPlayerIdBackfill';

const FIXED_NOW = '2026-08-16T20:00:00.000Z';

function deps(overrides: {
  census?: CensusResult | CensusResult[];
  backfill?: BackfillResult;
  censusSpy?: jest.Mock;
  backfillSpy?: jest.Mock;
}): IdentityOpsDeps {
  const censusQueue = Array.isArray(overrides.census)
    ? [...overrides.census]
    : overrides.census
      ? [overrides.census]
      : [{ activeMinted: 0, activeNull: 0, mergedRows: 0, lookupStatus: 'available' as const }];

  return {
    now: () => FIXED_NOW,
    censusTiberPlayerIds: overrides.censusSpy
      ? (overrides.censusSpy as unknown as () => Promise<CensusResult>)
      : async () => censusQueue.shift() ?? censusQueue[censusQueue.length - 1]!,
    backfillTiberPlayerIds:
      (overrides.backfillSpy as unknown as () => Promise<BackfillResult>) ??
      (async () =>
        overrides.backfill ?? { minted: 0, skippedMerged: 0, status: 'complete' as const }),
  };
}

describe('parseCommand', () => {
  test.each([['census'], ['backfill']])('accepts %s', (command) => {
    expect(parseCommand([command])).toBe(command);
  });

  test('rejects a missing command', () => {
    expect(() => parseCommand([])).toThrow(UsageError);
  });

  test('rejects an unknown command', () => {
    expect(() => parseCommand(['migrate'])).toThrow(/Unknown command: migrate/);
  });

  test('rejects extra arguments rather than silently ignoring them', () => {
    expect(() => parseCommand(['census', 'backfill'])).toThrow(/exactly one command/);
  });

  test('ignores whitespace-only padding from shell wrappers', () => {
    expect(parseCommand(['  ', 'census'])).toBe('census');
  });
});

describe('census command', () => {
  test('is read-only: it never invokes the backfill', async () => {
    const backfillSpy = jest.fn();
    const outcome = await runCensus(
      deps({
        census: { activeMinted: 386, activeNull: 0, mergedRows: 4, lookupStatus: 'available' },
        backfillSpy,
      }),
    );

    expect(backfillSpy).not.toHaveBeenCalled();
    expect(outcome.exitCode).toBe(0);
    expect(outcome.receipt).toEqual({
      receipt_kind: 'tiber_player_id_census',
      generatedAt: FIXED_NOW,
      census: { activeMinted: 386, activeNull: 0, mergedRows: 4, lookupStatus: 'available' },
      ok: true,
    });
  });

  test('reports outstanding nulls without failing (pre-backfill is a legitimate read)', async () => {
    const outcome = await runCensus(
      deps({ census: { activeMinted: 0, activeNull: 317, mergedRows: 0, lookupStatus: 'available' } }),
    );
    expect(outcome.exitCode).toBe(0);
    expect(outcome.receipt.ok).toBe(true);
    expect((outcome.receipt.census as CensusResult).activeNull).toBe(317);
  });

  test('fails closed when the lookup is unavailable', async () => {
    const outcome = await runCensus(
      deps({ census: { activeMinted: 0, activeNull: 0, mergedRows: 0, lookupStatus: 'unavailable' } }),
    );
    expect(outcome.exitCode).toBe(1);
    expect(outcome.receipt.ok).toBe(false);
    expect(String(outcome.receipt.error)).toMatch(/not observed/);
  });
});

describe('backfill command', () => {
  test('runs the backfill then certifies it with a post-backfill census', async () => {
    const order: string[] = [];
    const backfillSpy = jest.fn(async () => {
      order.push('backfill');
      return { minted: 317, skippedMerged: 4, status: 'complete' as const };
    });
    const censusSpy = jest.fn(async () => {
      order.push('census');
      return { activeMinted: 386, activeNull: 0, mergedRows: 4, lookupStatus: 'available' as const };
    });

    const outcome = await runBackfill(deps({ backfillSpy, censusSpy }));

    expect(order).toEqual(['backfill', 'census']);
    expect(outcome.exitCode).toBe(0);
    expect(outcome.receipt).toEqual({
      receipt_kind: 'tiber_player_id_backfill',
      startedAt: FIXED_NOW,
      completedAt: FIXED_NOW,
      backfill: { minted: 317, skippedMerged: 4, status: 'complete' },
      census: { activeMinted: 386, activeNull: 0, mergedRows: 4, lookupStatus: 'available' },
      ok: true,
    });
  });

  test('propagates a failed backfill and certifies nothing', async () => {
    const censusSpy = jest.fn();
    const outcome = await runBackfill(
      deps({
        backfill: { minted: 12, skippedMerged: 0, status: 'failed' },
        censusSpy,
      }),
    );

    expect(censusSpy).not.toHaveBeenCalled();
    expect(outcome.exitCode).toBe(1);
    expect(outcome.receipt.census).toBeNull();
    expect(outcome.receipt.ok).toBe(false);
    expect(String(outcome.receipt.error)).toMatch(/did not complete/);
    // Partial progress is still reported honestly.
    expect(outcome.receipt.backfill).toEqual({ minted: 12, skippedMerged: 0, status: 'failed' });
  });

  test('fails closed when the post-backfill census is unavailable', async () => {
    const outcome = await runBackfill(
      deps({
        backfill: { minted: 317, skippedMerged: 4, status: 'complete' },
        census: { activeMinted: 0, activeNull: 0, mergedRows: 0, lookupStatus: 'unavailable' },
      }),
    );
    expect(outcome.exitCode).toBe(1);
    expect(outcome.receipt.ok).toBe(false);
    expect(String(outcome.receipt.error)).toMatch(/could not be verified/);
  });

  test('fails closed when surviving rows still lack a canonical identity', async () => {
    // A completed backfill that leaves active nulls means some writer bypassed
    // the governed mint — the operator-facing invariant is activeNull == 0.
    const outcome = await runBackfill(
      deps({
        backfill: { minted: 317, skippedMerged: 4, status: 'complete' },
        census: { activeMinted: 385, activeNull: 1, mergedRows: 4, lookupStatus: 'available' },
      }),
    );
    expect(outcome.exitCode).toBe(1);
    expect(outcome.receipt.ok).toBe(false);
    expect(String(outcome.receipt.error)).toMatch(/bypassing the governed mint/);
  });
});

describe('runCommand dispatch', () => {
  test('census dispatches to the read-only path', async () => {
    const backfillSpy = jest.fn();
    const outcome = await runCommand('census', deps({ backfillSpy }));
    expect(backfillSpy).not.toHaveBeenCalled();
    expect(outcome.receipt.receipt_kind).toBe('tiber_player_id_census');
  });

  test('backfill dispatches to the write path', async () => {
    const backfillSpy = jest.fn(async () => ({
      minted: 1,
      skippedMerged: 0,
      status: 'complete' as const,
    }));
    const outcome = await runCommand('backfill', deps({ backfillSpy }));
    expect(backfillSpy).toHaveBeenCalledTimes(1);
    expect(outcome.receipt.receipt_kind).toBe('tiber_player_id_backfill');
  });
});
