#!/usr/bin/env tsx
/**
 * Fantasy Lab Phase 1 sanity checks for fantasy_metrics_weekly_mv.
 *
 * Usage:
 *   npx tsx server/scripts/qaFantasyLabPhase1.ts 2025 1
 */

import { Client } from "pg";

const season = Number(process.argv[2] || 2025);
const week = Number(process.argv[3] || 1);

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  try {
    console.log(`\n🔎 Fantasy Lab sanity check — season=${season}, week=${week}\n`);

    const snapshotCount = await client.query(
      `SELECT COUNT(*)::int AS c
       FROM datadive_snapshot_player_week
       WHERE season = $1 AND week = $2`,
      [season, week]
    );

    const mvCount = await client.query(
      `SELECT COUNT(*)::int AS c
       FROM fantasy_metrics_weekly_mv
       WHERE season = $1 AND week = $2`,
      [season, week]
    );

    const xfpNullCheck = await client.query(
      `SELECT
         COUNT(*)::int AS total,
         COUNT(*) FILTER (WHERE x_ppr_v2 IS NOT NULL)::int AS xfp_present
       FROM fantasy_metrics_weekly_mv
       WHERE season = $1 AND week = $2`,
      [season, week]
    );

    const dupes = await client.query(
      `SELECT player_id, COUNT(*)::int AS c
       FROM fantasy_metrics_weekly_mv
       WHERE season = $1 AND week = $2
       GROUP BY player_id
       HAVING COUNT(*) > 1
       LIMIT 10`,
      [season, week]
    );

    const snapshotRows = snapshotCount.rows[0]?.c ?? 0;
    const mvRows = mvCount.rows[0]?.c ?? 0;
    const total = xfpNullCheck.rows[0]?.total ?? 0;
    const xfpPresent = xfpNullCheck.rows[0]?.xfp_present ?? 0;

    const checks = [
      {
        ok: snapshotRows === 0 || mvRows > 0,
        label: "MV returns rows when snapshot rows exist",
        detail: `snapshot_rows=${snapshotRows}, mv_rows=${mvRows}`,
      },
      {
        ok: total === 0 || xfpPresent > 0,
        label: "x_ppr_v2 is not all null",
        detail: `total_rows=${total}, xfp_present_rows=${xfpPresent}`,
      },
      {
        ok: dupes.rows.length === 0,
        label: "(season, week, player_id) uniqueness",
        detail: dupes.rows.length === 0 ? "no duplicates" : `found_duplicates=${dupes.rows.length}`,
      },
    ];

    let failed = 0;
    for (const check of checks) {
      if (check.ok) {
        console.log(`✅ PASS: ${check.label} — ${check.detail}`);
      } else {
        failed += 1;
        console.log(`❌ FAIL: ${check.label} — ${check.detail}`);
      }
    }

    if (failed > 0) {
      process.exitCode = 1;
      console.log(`\n❌ Fantasy Lab sanity check failed (${failed} check${failed === 1 ? "" : "s"}).`);
    } else {
      console.log("\n✅ Fantasy Lab sanity check passed.");
    }
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("❌ Fatal error running Fantasy Lab sanity check:", error);
  process.exit(1);
});
