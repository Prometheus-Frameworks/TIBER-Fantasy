/**
 * FORGE-R Phase 2: Seed college production data into rookie_profiles
 * Reads data/rookies/2026_college_production.json and upserts DB rows.
 */

import fs from "fs";
import path from "path";
import { db } from "../server/infra/db";
import { rookieProfiles } from "../shared/schema";
import { eq } from "drizzle-orm";

const DATA_PATH = path.join(process.cwd(), "data/rookies/2026_college_production.json");

interface ProductionPlayer {
  player_name: string;
  position: string;
  school: string;
  cfb_stats: Record<string, number | null>;
  dominator_rating: number | null;
  college_target_share: number | null;
  college_ypc: number | null;
  production_score: number | null;
  cfb_source: string;
}

async function main() {
  console.log("=".repeat(60));
  console.log("FORGE-R Phase 2: Seeding College Production");
  console.log("=".repeat(60));

  const raw = JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));
  const players: ProductionPlayer[] = raw.players;
  console.log(`\nLoaded ${players.length} players from ${DATA_PATH}`);

  let updated = 0;
  let notFound = 0;

  for (const p of players) {
    // Find existing row by player name
    const existing = await db
      .select({ id: rookieProfiles.id })
      .from(rookieProfiles)
      .where(eq(rookieProfiles.playerName, p.player_name))
      .limit(1);

    if (existing.length === 0) {
      console.log(`  ⚠️  Not found in DB: ${p.player_name}`);
      notFound++;
      continue;
    }

    await db
      .update(rookieProfiles)
      .set({
        dominatorRating: p.dominator_rating ?? undefined,
        collegeTargetShare: p.college_target_share ?? undefined,
        collegeYpc: p.college_ypc ?? undefined,
        productionScore: p.production_score ?? undefined,
        updatedAt: new Date(),
      })
      .where(eq(rookieProfiles.playerName, p.player_name));

    updated++;
  }

  console.log(`\n✅ Updated ${updated} players`);
  if (notFound > 0) console.log(`   ⚠️  ${notFound} players not found in DB`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
