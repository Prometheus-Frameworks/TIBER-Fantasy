/**
 * enrich-birth-dates-from-sleeper.ts
 *
 * Fetches all NFL players from Sleeper's /players/nfl endpoint and backfills
 * birth_date in player_identity_map by matching on sleeper_id.
 *
 * Usage:
 *   npx tsx scripts/enrich-birth-dates-from-sleeper.ts
 *
 * Safe to re-run — only updates rows where birth_date IS NULL or has changed.
 */

import { Pool } from "pg";

const SLEEPER_PLAYERS_URL = "https://api.sleeper.app/v1/players/nfl";
const SKILL_POSITIONS = new Set(["QB", "RB", "WR", "TE"]);
const BATCH_SIZE = 200;

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  console.log("📥 Fetching Sleeper /players/nfl ...");
  const resp = await fetch(SLEEPER_PLAYERS_URL);
  if (!resp.ok) {
    throw new Error(`Sleeper API error: ${resp.status} ${resp.statusText}`);
  }
  const players = (await resp.json()) as Record<string, Record<string, unknown>>;
  console.log(`   ${Object.keys(players).length} total Sleeper players received`);

  // Collect skill-position players that have a birth_date
  const toUpdate: { sleeper_id: string; birth_date: string }[] = [];
  for (const [sleeperId, p] of Object.entries(players)) {
    if (!SKILL_POSITIONS.has(p.position as string)) continue;
    if (!p.birth_date || typeof p.birth_date !== "string") continue;
    toUpdate.push({ sleeper_id: sleeperId, birth_date: p.birth_date });
  }
  console.log(`   ${toUpdate.length} skill-position players with birth_date`);

  // Check how many of these sleeper_ids exist in our identity map
  const allSleeperIds = toUpdate.map((r) => r.sleeper_id);
  const checkResult = await pool.query(
    `SELECT COUNT(*) AS cnt FROM player_identity_map WHERE sleeper_id = ANY($1::text[])`,
    [allSleeperIds],
  );
  console.log(`   ${checkResult.rows[0].cnt} matched in player_identity_map`);

  // Batch UPDATE using a temporary VALUES list
  let updated = 0;
  let skipped = 0;

  for (let i = 0; i < toUpdate.length; i += BATCH_SIZE) {
    const batch = toUpdate.slice(i, i + BATCH_SIZE);

    // Build a VALUES clause: ($1, $2::date), ($3, $4::date), ...
    const values: string[] = [];
    const params: string[] = [];
    for (const [j, row] of batch.entries()) {
      const base = j * 2;
      values.push(`($${base + 1}, $${base + 2}::date)`);
      params.push(row.sleeper_id, row.birth_date);
    }

    const result = await pool.query(
      `UPDATE player_identity_map AS pim
       SET birth_date = v.birth_date, updated_at = NOW()
       FROM (VALUES ${values.join(", ")}) AS v(sleeper_id, birth_date)
       WHERE pim.sleeper_id = v.sleeper_id
         AND (pim.birth_date IS DISTINCT FROM v.birth_date)`,
      params,
    );
    updated += result.rowCount ?? 0;
    skipped += batch.length - (result.rowCount ?? 0);

    if (i % (BATCH_SIZE * 5) === 0 && i > 0) {
      console.log(`   ... ${i}/${toUpdate.length} processed`);
    }
  }

  console.log(`\n✅ Done.`);
  console.log(`   Updated : ${updated} rows`);
  console.log(`   Skipped : ${skipped} (no match or already current)`);

  // Spot-check a few
  const spot = await pool.query(
    `SELECT sleeper_id, full_name, position, birth_date
     FROM player_identity_map
     WHERE birth_date IS NOT NULL AND position IN ('QB','RB','WR','TE')
     ORDER BY RANDOM() LIMIT 6`,
  );
  console.log("\n📋 Sample spot-check:");
  for (const row of spot.rows) {
    console.log(
      `   ${row.full_name} (${row.position}) — ${row.birth_date} [sleeper: ${row.sleeper_id}]`,
    );
  }

  // Summary stat
  const stat = await pool.query(
    `SELECT
       COUNT(*) FILTER (WHERE birth_date IS NOT NULL) AS with_bd,
       COUNT(*) AS total
     FROM player_identity_map
     WHERE sleeper_id IS NOT NULL AND position IN ('QB','RB','WR','TE')`,
  );
  const { with_bd, total } = stat.rows[0];
  console.log(`\n📊 Coverage: ${with_bd}/${total} skill-position players now have birth_date`);

  await pool.end();
}

main().catch((err) => {
  console.error("❌ Script failed:", err.message);
  process.exit(1);
});
