import { db } from './server/infra/db';
import { sql } from 'drizzle-orm';

async function verify() {
  console.log("=".repeat(60));
  console.log("DATA PIPELINE VERIFICATION");
  console.log("=".repeat(60));

  // Check all layers
  const layers = await db.execute(sql`
    SELECT 'bronze_nflfastr_plays' as layer, COUNT(*) as rows, COUNT(DISTINCT week) as weeks
    FROM bronze_nflfastr_plays WHERE season = 2025
    UNION ALL
    SELECT 'silver_player_weekly_stats', COUNT(*), COUNT(DISTINCT week)
    FROM silver_player_weekly_stats WHERE season = 2025
    UNION ALL
    SELECT 'weekly_stats', COUNT(*), COUNT(DISTINCT week)
    FROM weekly_stats WHERE season = 2025
    UNION ALL
    SELECT 'datadive_snapshot_player_week', COUNT(*), COUNT(DISTINCT week)
    FROM datadive_snapshot_player_week WHERE season = 2025
  `);

  console.log("\n## Data Layer Summary\n");
  console.log("Layer                          | Rows   | Weeks");
  console.log("-".repeat(55));
  for (const row of layers.rows as any[]) {
    console.log(`${row.layer.padEnd(30)} | ${String(row.rows).padEnd(6)} | ${row.weeks}`);
  }

  // Check test players
  console.log("\n## Test Player Coverage (silver_player_weekly_stats)\n");
  const testPlayers = ['Hampton', 'Odunze', 'Collins', 'Dowdle', 'Barkley'];

  for (const name of testPlayers) {
    const result = await db.execute(sql`
      SELECT player_name, COUNT(*) as weeks,
             SUM(targets) as total_tgt,
             SUM(receptions) as total_rec,
             SUM(receiving_yards) as total_rec_yds,
             SUM(rush_attempts) as total_rush,
             SUM(rushing_yards) as total_rush_yds
      FROM silver_player_weekly_stats
      WHERE season = 2025 AND LOWER(player_name) LIKE ${`%${name.toLowerCase()}%`}
      GROUP BY player_name
      LIMIT 1
    `);

    if ((result.rows as any[]).length > 0) {
      const r = (result.rows as any[])[0];
      console.log(`${r.player_name}: ${r.weeks} weeks | Tgt: ${r.total_tgt || 0} | Rec: ${r.total_rec || 0} | RecYd: ${r.total_rec_yds || 0} | Rush: ${r.total_rush || 0} | RushYd: ${r.total_rush_yds || 0}`);
    } else {
      console.log(`${name}: NOT FOUND`);
    }
  }

  // Sample week 17 data
  console.log("\n## Week 17 Sample (top 5 by rushing yards)\n");
  const week17 = await db.execute(sql`
    SELECT player_name, position, team, rush_attempts, rushing_yards, rushing_tds, rushing_epa
    FROM silver_player_weekly_stats
    WHERE season = 2025 AND week = 17
    ORDER BY rushing_yards DESC NULLS LAST
    LIMIT 5
  `);

  console.log("Player                  | Pos | Team | Rush | Yds  | TDs | EPA");
  console.log("-".repeat(65));
  for (const r of week17.rows as any[]) {
    const rushEpa = r.rushing_epa ? Number(r.rushing_epa).toFixed(1) : 'N/A';
    console.log(`${(r.player_name || '').slice(0, 22).padEnd(23)} | ${(r.position || '?').padEnd(3)} | ${(r.team || '?').padEnd(4)} | ${String(r.rush_attempts || 0).padEnd(4)} | ${String(r.rushing_yards || 0).padEnd(4)} | ${String(r.rushing_tds || 0).padEnd(3)} | ${rushEpa}`);
  }

  console.log("\n" + "=".repeat(60));
  console.log("VERIFICATION COMPLETE");
  console.log("=".repeat(60));

  process.exit(0);
}

verify().catch(e => { console.error(e); process.exit(1); });
