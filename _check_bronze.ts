import { db } from './server/infra/db';
import { sql } from 'drizzle-orm';

async function checkBronze() {
  console.log("=== BRONZE LAYER DATA CHECK ===\n");

  // Check bronze_nflfastr_plays coverage
  const playsCoverage = await db.execute(sql`
    SELECT
      season,
      week,
      COUNT(*) as plays,
      COUNT(DISTINCT receiver_player_id) as receivers,
      COUNT(DISTINCT rusher_player_id) as rushers,
      COUNT(DISTINCT passer_player_id) as passers
    FROM bronze_nflfastr_plays
    WHERE season = 2025
    GROUP BY season, week
    ORDER BY week
  `);

  console.log("bronze_nflfastr_plays by week:");
  console.log("Week | Plays  | Receivers | Rushers | Passers");
  console.log("-".repeat(50));
  for (const row of playsCoverage.rows as any[]) {
    console.log(`${String(row.week).padEnd(4)} | ${String(row.plays).padEnd(6)} | ${String(row.receivers).padEnd(9)} | ${String(row.rushers).padEnd(7)} | ${row.passers}`);
  }

  // Check available columns
  const cols = await db.execute(sql`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = 'bronze_nflfastr_plays'
    ORDER BY ordinal_position
  `);

  console.log("\n\nbronze_nflfastr_plays columns (first 40):");
  const columnRows = cols.rows.slice(0, 40) as any[];
  for (const c of columnRows) {
    console.log(`  ${c.column_name}: ${c.data_type}`);
  }
  console.log(`  ... (${cols.rows.length} total columns)`);

  // Check weekly_stats source columns
  const weeklyCols = await db.execute(sql`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = 'weekly_stats'
    ORDER BY ordinal_position
  `);

  console.log("\n\nweekly_stats columns:");
  for (const c of weeklyCols.rows as any[]) {
    console.log(`  ${c.column_name}: ${c.data_type}`);
  }

  process.exit(0);
}

checkBronze().catch(e => { console.error(e); process.exit(1); });
