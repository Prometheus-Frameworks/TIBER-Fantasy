/**
 * Backfill TIBER scores for 2025 weeks 8-18
 *
 * Run with:  tsx server/scripts/backfill2025TiberScores.ts
 *
 * What this does:
 *  1. Finds every distinct player who has tiber_scores entries for weeks 1-7 in 2025.
 *  2. For each player, computes and caches scores for every missing week (8-18).
 *  3. After all weeks are written, recalculates tiber_season_ratings for 2025.
 *
 * Both steps read from bronze_nflfastr_plays which is fully populated for all
 * 22 weeks of the 2025 season (verified 2026-03-14).
 *
 * The forge_grade_cache refresh should be triggered separately via:
 *   POST /api/forge/compute-grades   { season: 2025, asOfWeek: 18, position: "ALL" }
 * with x-admin-key header set to FORGE_ADMIN_KEY.
 */

import { db } from "../infra/db";
import { tiberScores } from "../../shared/schema";
import { eq, and, inArray, notInArray, sql } from "drizzle-orm";
import { tiberService } from "../services/tiberService";

const SEASON = 2025;
const MISSING_WEEKS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18];
const BATCH_DELAY_MS = 200;

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log(`\n🚀 TIBER 2025 scores backfill — weeks ${MISSING_WEEKS[0]}-${MISSING_WEEKS.at(-1)}`);

  const playersWithScores = await db
    .selectDistinct({ nflfastrId: tiberScores.nflfastrId })
    .from(tiberScores)
    .where(eq(tiberScores.season, SEASON));

  const playerIds = playersWithScores
    .map(p => p.nflfastrId)
    .filter((id): id is string => id !== null && id !== undefined);

  console.log(`Found ${playerIds.length} players with existing 2025 tiber_scores entries\n`);

  let computed = 0;
  let skipped = 0;
  let errors = 0;

  for (const nflfastrId of playerIds) {
    for (const week of MISSING_WEEKS) {
      const existing = await db
        .select()
        .from(tiberScores)
        .where(
          and(
            eq(tiberScores.nflfastrId, nflfastrId),
            eq(tiberScores.week, week),
            eq(tiberScores.season, SEASON)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        skipped++;
        continue;
      }

      try {
        const score = await tiberService.calculateTiberScore(nflfastrId, week, SEASON, "season");

        await db.insert(tiberScores).values({
          playerId: null,
          nflfastrId,
          week,
          season: SEASON,
          tiberScore: score.tiberScore,
          tier: score.tier,
          firstDownScore: score.breakdown.firstDownScore,
          epaScore: score.breakdown.epaScore,
          usageScore: score.breakdown.usageScore,
          tdScore: score.breakdown.tdScore,
          teamScore: score.breakdown.teamScore,
          firstDownRate: score.metrics.firstDownRate,
          epaPerPlay: score.metrics.epaPerPlay,
          snapPercentAvg: score.metrics.snapPercentAvg,
          teamOffenseRank: score.metrics.teamOffenseRank ?? null,
          tdRate: score.metrics.tdRate ?? null,
          totalFirstDowns: score.metrics.totalFirstDowns ?? null,
        }).onConflictDoNothing();

        computed++;
        process.stdout.write(`  ✅ ${nflfastrId} wk${week} → ${score.tiberScore} (${score.tier})\n`);

        await sleep(BATCH_DELAY_MS);
      } catch (err) {
        errors++;
        const msg = err instanceof Error ? err.message : String(err);
        process.stdout.write(`  ⚠️  ${nflfastrId} wk${week} — ${msg}\n`);
      }
    }
  }

  console.log(`\n📊 Scores backfill complete: ${computed} computed, ${skipped} already existed, ${errors} errors`);

  console.log(`\n🔄 Recalculating tiber_season_ratings for ${SEASON}...`);
  try {
    await tiberService.calculateAllSeasonRatings(SEASON);
    console.log(`✅ tiber_season_ratings updated for ${SEASON}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`❌ Season ratings failed: ${msg}`);
  }

  console.log(`
📋 Next step — refresh forge_grade_cache:
   curl -X POST http://localhost:5000/api/forge/compute-grades \\
     -H 'Content-Type: application/json' \\
     -H 'x-admin-key: <FORGE_ADMIN_KEY>' \\
     -d '{"season":2025,"asOfWeek":18,"position":"ALL"}'
`);

  process.exit(0);
}

main().catch(err => {
  console.error("Fatal:", err);
  process.exit(1);
});
