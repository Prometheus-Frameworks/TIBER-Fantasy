#!/usr/bin/env tsx
/**
 * Canonical TIBER player-id operations CLI (Fantasy #327; operationalizes the
 * methods merged in #329).
 *
 * This is an invocation surface ONLY. It adds no identity logic: minting,
 * merge handling, and census semantics all live in PlayerIdentityService and
 * are used here exactly as reviewed. It performs no identity consolidation,
 * no merge, no alias rewrite, and no consumer changes.
 *
 * Credentials are never accepted on the command line — the process uses the
 * ordinary production environment (DATABASE_URL) like every other server
 * entry point.
 *
 *   npm run identity:census     # read-only receipt
 *   npm run identity:backfill   # idempotent backfill, then a receipt
 *
 * Receipts print as a single JSON object on stdout (logs go to stderr), so a
 * run can be preserved verbatim:
 *
 *   npm run identity:census > census-receipt.json
 *
 * Exit codes: 0 success; 1 unavailable/failed/unexpected state (fail closed).
 */

// PlayerIdentityService is imported lazily inside main(): it pulls in the db
// pool, which requires DATABASE_URL at module load. Keeping it out of the
// module graph lets the pure command functions be imported and tested without
// a database, and lets this file emit its own clearer environment error first.

export type IdentityOpsCommand = 'census' | 'backfill';

export interface CensusResult {
  activeMinted: number;
  activeNull: number;
  mergedRows: number;
  lookupStatus: 'available' | 'unavailable';
}

export interface BackfillResult {
  minted: number;
  skippedMerged: number;
  status: 'complete' | 'failed';
}

export interface IdentityOpsDeps {
  censusTiberPlayerIds: () => Promise<CensusResult>;
  backfillTiberPlayerIds: () => Promise<BackfillResult>;
  /** Injected for deterministic receipts in tests. */
  now?: () => string;
}

export interface CommandOutcome {
  exitCode: 0 | 1;
  receipt: Record<string, unknown>;
}

export class UsageError extends Error {}

const USAGE = [
  'Usage: tsx server/scripts/tiberPlayerIdBackfill.ts <census|backfill>',
  '',
  '  census    Read-only canonical-identity census; prints a JSON receipt.',
  '  backfill  Idempotent canonical-id backfill, then prints a post-backfill',
  '            census receipt. Fails closed on any unexpected state.',
].join('\n');

export function parseCommand(argv: readonly string[]): IdentityOpsCommand {
  const positional = argv.filter((arg) => arg.trim().length > 0);
  if (positional.length === 0) {
    throw new UsageError(`No command given.\n${USAGE}`);
  }
  if (positional.length > 1) {
    throw new UsageError(`Expected exactly one command.\n${USAGE}`);
  }
  const [command] = positional;
  if (command !== 'census' && command !== 'backfill') {
    throw new UsageError(`Unknown command: ${command}\n${USAGE}`);
  }
  return command;
}

/**
 * Read-only census. Never writes, so it is always safe to run — including
 * before the backfill, to confirm the canonical column is actually present.
 */
export async function runCensus(deps: IdentityOpsDeps): Promise<CommandOutcome> {
  const generatedAt = (deps.now ?? (() => new Date().toISOString()))();
  const census = await deps.censusTiberPlayerIds();
  const unavailable = census.lookupStatus !== 'available';
  return {
    exitCode: unavailable ? 1 : 0,
    receipt: {
      receipt_kind: 'tiber_player_id_census',
      generatedAt,
      census,
      // An unavailable read is not evidence of a clean registry; it is a
      // failure to observe, and is reported as such.
      ok: !unavailable,
      ...(unavailable
        ? { error: 'census lookup unavailable; registry state was not observed' }
        : {}),
    },
  };
}

/**
 * Idempotent backfill followed by an automatic post-backfill census.
 *
 * Fails closed on: a failed backfill, an unavailable post-backfill census, or
 * a completed backfill that still leaves surviving rows without a canonical
 * identity (which would mean some writer bypassed the governed mint).
 */
export async function runBackfill(deps: IdentityOpsDeps): Promise<CommandOutcome> {
  const now = deps.now ?? (() => new Date().toISOString());
  const startedAt = now();
  const backfill = await deps.backfillTiberPlayerIds();

  if (backfill.status !== 'complete') {
    // Do not certify anything after a failed write pass.
    return {
      exitCode: 1,
      receipt: {
        receipt_kind: 'tiber_player_id_backfill',
        startedAt,
        completedAt: now(),
        backfill,
        census: null,
        ok: false,
        error: 'backfill did not complete; no post-backfill census was taken',
      },
    };
  }

  const census = await deps.censusTiberPlayerIds();
  const unavailable = census.lookupStatus !== 'available';
  const residualNulls = !unavailable && census.activeNull > 0;
  const ok = !unavailable && !residualNulls;

  let error: string | undefined;
  if (unavailable) {
    error = 'post-backfill census unavailable; backfill result could not be verified';
  } else if (residualNulls) {
    error =
      `post-backfill census still reports ${census.activeNull} surviving row(s) without a canonical identity; ` +
      'a registry writer may be bypassing the governed mint';
  }

  return {
    exitCode: ok ? 0 : 1,
    receipt: {
      receipt_kind: 'tiber_player_id_backfill',
      startedAt,
      completedAt: now(),
      backfill,
      census,
      ok,
      ...(error ? { error } : {}),
    },
  };
}

export async function runCommand(
  command: IdentityOpsCommand,
  deps: IdentityOpsDeps,
): Promise<CommandOutcome> {
  return command === 'census' ? runCensus(deps) : runBackfill(deps);
}

async function main(): Promise<void> {
  let command: IdentityOpsCommand;
  try {
    command = parseCommand(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  }

  if (!process.env.DATABASE_URL) {
    process.stderr.write(
      'DATABASE_URL is not set. Run this inside the target environment (e.g. the Railway ' +
        'production shell); credentials are never passed on the command line.\n',
    );
    process.exit(1);
  }

  process.stderr.write(`[identity-ops] running ${command}...\n`);
  const { playerIdentityService } = await import('../services/PlayerIdentityService');
  const outcome = await runCommand(command, {
    censusTiberPlayerIds: () => playerIdentityService.censusTiberPlayerIds(),
    backfillTiberPlayerIds: () => playerIdentityService.backfillTiberPlayerIds(),
  });

  // Receipt on stdout only, so `> receipt.json` captures pure JSON.
  process.stdout.write(`${JSON.stringify(outcome.receipt, null, 2)}\n`);
  process.exit(outcome.exitCode);
}

// Not under test: this file self-executes as a CLI; the guard lets the pure
// command functions be imported by regression tests without running main().
if (process.env.JEST_WORKER_ID === undefined) {
  main().catch((error: unknown) => {
    process.stderr.write(`[identity-ops] fatal: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  });
}
