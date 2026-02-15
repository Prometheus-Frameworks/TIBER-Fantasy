#!/usr/bin/env tsx
/**
 * Backfill personnel columns in bronze_nflfastr_plays by re-importing season parquet data.
 *
 * Usage:
 *   tsx server/scripts/backfillPersonnel.ts                 # defaults to season 2024
 *   tsx server/scripts/backfillPersonnel.ts 2024            # explicit single season
 *   tsx server/scripts/backfillPersonnel.ts 2024,2025       # multiple seasons
 */

import { sql } from 'drizzle-orm';
import { db } from '../infra/db';
import {
  ingestBronzeNflfastrSeason,
  verifyPersonnelFieldsInParquet,
} from '../ingest/nflfastr';

function parseSeasonsArg(rawArg?: string): number[] {
  if (!rawArg) return [2024];

  return rawArg
    .split(',')
    .map(v => Number.parseInt(v.trim(), 10))
    .filter(v => Number.isFinite(v));
}

async function main() {
  const seasons = parseSeasonsArg(process.argv[2]);

  for (const season of seasons) {
    console.log(`\n🔎 Verifying personnel fields exist in nflverse parquet for ${season}...`);
    const fields = await verifyPersonnelFieldsInParquet(season);

    if (!fields.offense_personnel) {
      throw new Error(`Season ${season} parquet does not include offense_personnel.`);
    }

    console.log(`✅ Parquet field check (${season}):`, fields);

    console.log(`🚀 Re-ingesting bronze NFLfastR plays for ${season}...`);
    await ingestBronzeNflfastrSeason(season);

    const populated = await db.execute(sql`
      SELECT COUNT(*)::int AS cnt
      FROM bronze_nflfastr_plays
      WHERE season = ${season}
        AND offense_personnel IS NOT NULL
    `);

    console.log(`✅ Backfill complete for ${season}. Rows with offense_personnel: ${populated.rows[0]?.cnt ?? 0}`);
  }

  console.log('\n🎉 Personnel backfill complete.');
}

main().catch((error) => {
  console.error('❌ backfillPersonnel failed:', error);
  process.exit(1);
});
