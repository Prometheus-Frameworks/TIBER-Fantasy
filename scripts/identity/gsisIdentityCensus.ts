/**
 * Read-only GSIS identity census (Fantasy #308).
 *
 * `player_identity_map` has a `gsis_id` column but — unlike every other platform
 * ID column — **no unique index**. #308 requires this census to run *before* any
 * uniqueness migration, because `CREATE UNIQUE INDEX` against live data with
 * duplicates fails, and repairing duplicates is an identity decision an operator
 * must make, not one a migration should make implicitly.
 *
 * This script performs **no writes and no DDL**. It reads `player_identity_map`,
 * counts nulls/duplicates/malformed values, and prints a verdict.
 *
 *   npx tsx scripts/identity/gsisIdentityCensus.ts
 *   npx tsx scripts/identity/gsisIdentityCensus.ts --json
 *
 * Requires `DATABASE_URL`. Exit codes:
 *   0 — census completed and a unique index would be safe
 *   1 — census completed but duplicates block a unique index
 *   2 — census could not run (no database access)
 */

import { PlayerIdentityService } from '../../server/services/PlayerIdentityService';

async function main() {
  const asJson = process.argv.includes('--json');

  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set; cannot run the identity census.');
    console.error('This script is read-only but still requires database access.');
    process.exit(2);
  }

  let census;
  try {
    census = await PlayerIdentityService.getInstance().censusGsisIdentity();
  } catch (error) {
    console.error('Census failed:', error instanceof Error ? error.message : error);
    process.exit(2);
    return;
  }

  if (asJson) {
    console.log(JSON.stringify({ generatedAt: new Date().toISOString(), ...census }, null, 2));
  } else {
    const pct = (n: number) => (census.totalRows === 0 ? '0.0' : ((n / census.totalRows) * 100).toFixed(1));
    console.log('player_identity_map.gsis_id census');
    console.log('='.repeat(52));
    console.log(`rows total              ${census.totalRows}`);
    console.log(`gsis_id present         ${census.nonNullGsis} (${pct(census.nonNullGsis)}%)`);
    console.log(`gsis_id null/blank      ${census.nullGsis} (${pct(census.nullGsis)}%)`);
    console.log(`distinct gsis_id        ${census.distinctGsis}`);
    console.log(`duplicated gsis values  ${census.duplicateGsisValues}`);
    console.log(`rows in those dupes     ${census.duplicateRowCount}`);
    console.log(`malformed gsis_id       ${census.malformedGsis}`);
    console.log('');
    console.log(
      census.uniqueIndexSafe
        ? 'VERDICT: a partial unique index on gsis_id WHERE gsis_id IS NOT NULL would apply cleanly.'
        : 'VERDICT: duplicates present — a unique index would FAIL. Resolve duplicates first.',
    );

    if (census.samples.duplicates.length > 0) {
      console.log('\nDuplicate samples (up to 10):');
      for (const dupe of census.samples.duplicates) {
        console.log(`  ${dupe.gsisId} -> ${dupe.canonicalIds.join(', ')}`);
      }
    }
    if (census.samples.malformed.length > 0) {
      console.log('\nMalformed samples (up to 10):');
      for (const value of census.samples.malformed) console.log(`  ${value}`);
    }
  }

  process.exit(census.uniqueIndexSafe ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(2);
});
