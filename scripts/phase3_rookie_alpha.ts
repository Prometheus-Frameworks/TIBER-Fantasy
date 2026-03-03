/**
 * FORGE-R Phase 3: Rookie Alpha Composite Score
 *
 * Formula (pre-draft, no age data yet):
 *   RAS v2 normalized (0-100):       35%
 *   Production Score (0-100):        45%
 *   Draft Capital proxy (proj_round): 20%
 *
 * Draft capital proxy:
 *   R1 → 100, R2 → 78, R3 → 56, R4 → 34, R5+ → 18, null → position median
 *
 * Rookie Tier thresholds (same as FORGE tiers):
 *   T1: 80+  |  T2: 65–79  |  T3: 50–64  |  T4: 35–49  |  T5: <35
 */

import { db } from "../server/infra/db";
import { rookieProfiles } from "../shared/schema";
import { isNotNull, sql } from "drizzle-orm";

// ─── Draft Capital proxy (logarithmic-ish decay) ─────────────────────────────
function draftCapitalScore(projRound: number | null): number {
  if (projRound === null || projRound === undefined) return 50; // unknown = median
  const scores: Record<number, number> = {
    1: 100,
    2: 78,
    3: 56,
    4: 34,
    5: 18,
    6: 10,
    7: 5,
  };
  return scores[projRound] ?? 5;
}

// ─── Rookie tier mapping ──────────────────────────────────────────────────────
function rookieTier(alpha: number): string {
  if (alpha >= 80) return "T1";
  if (alpha >= 65) return "T2";
  if (alpha >= 50) return "T3";
  if (alpha >= 35) return "T4";
  return "T5";
}

async function main() {
  console.log("=".repeat(60));
  console.log("FORGE-R Phase 3: Rookie Alpha");
  console.log("=".repeat(60));

  // Pull all players from DB
  const players = await db
    .select({
      id: rookieProfiles.id,
      playerName: rookieProfiles.playerName,
      position: rookieProfiles.position,
      projRound: rookieProfiles.projRound,
      tiberRasV2: rookieProfiles.tiberRasV2,
      productionScore: rookieProfiles.productionScore,
    })
    .from(rookieProfiles)
    .orderBy(rookieProfiles.playerName);

  console.log(`\nLoaded ${players.length} players`);

  // Coverage check
  const withRas = players.filter((p) => p.tiberRasV2 !== null).length;
  const withProd = players.filter((p) => p.productionScore !== null).length;
  console.log(`  RAS v2 coverage: ${withRas}/${players.length}`);
  console.log(`  Production coverage: ${withProd}/${players.length}`);

  // Compute position medians for production_score (for players with no data)
  type PosKey = "QB" | "RB" | "WR" | "TE";
  const posProdMedians: Record<PosKey, number> = { QB: 50, RB: 50, WR: 50, TE: 50 };
  for (const pos of ["QB", "RB", "WR", "TE"] as PosKey[]) {
    const scores = players
      .filter((p) => p.position === pos && p.productionScore !== null)
      .map((p) => p.productionScore as number)
      .sort((a, b) => a - b);
    if (scores.length > 0) {
      const mid = Math.floor(scores.length / 2);
      posProdMedians[pos] =
        scores.length % 2 === 0
          ? (scores[mid - 1] + scores[mid]) / 2
          : scores[mid];
    }
  }
  console.log("\nPosition production medians:", posProdMedians);

  // Compute scores
  const results: Array<{
    id: number;
    playerName: string;
    position: string;
    rasNorm: number;
    prodScore: number;
    dcScore: number;
    rookieAlpha: number;
    tier: string;
    pillarDetail: string;
  }> = [];

  for (const p of players) {
    const pos = (p.position as PosKey) ?? "WR";

    // Normalize RAS v2 (0–10) to 0–100
    const rasNorm =
      p.tiberRasV2 !== null ? Math.round(p.tiberRasV2 * 10) : 50;

    // Production score (use position median if missing)
    const prodScore =
      p.productionScore !== null
        ? p.productionScore
        : posProdMedians[pos] ?? 50;

    // Draft capital proxy
    const dcScore = draftCapitalScore(p.projRound);

    // Weights: RAS 35%, Production 45%, Draft Capital 20%
    const alpha = Math.round(
      rasNorm * 0.35 + prodScore * 0.45 + dcScore * 0.20
    );

    const tier = rookieTier(alpha);

    results.push({
      id: p.id,
      playerName: p.playerName,
      position: p.position ?? "",
      rasNorm,
      prodScore,
      dcScore,
      rookieAlpha: alpha,
      tier,
      pillarDetail: `RAS=${rasNorm} PROD=${prodScore.toFixed(0)} DC=${dcScore}`,
    });
  }

  // Sort by alpha for display
  results.sort((a, b) => b.rookieAlpha - a.rookieAlpha);

  // ── Print leaderboard ───────────────────────────────────────────────────────
  console.log("\n" + "=".repeat(60));
  console.log("ROOKIE ALPHA LEADERBOARD (top 20)");
  console.log("=".repeat(60));
  const header = "Rank  Name                          Pos  Alpha  Tier  Pillars";
  console.log(header);
  console.log("-".repeat(header.length));

  for (const [i, r] of results.slice(0, 20).entries()) {
    console.log(
      `${String(i + 1).padStart(4)}  ${r.playerName.padEnd(28)}  ${r.position.padEnd(3)}  ${String(r.rookieAlpha).padStart(5)}  ${r.tier.padEnd(4)}  ${r.pillarDetail}`
    );
  }

  console.log("\n--- By Position (top 5 each) ---");
  for (const pos of ["WR", "RB", "TE", "QB"]) {
    const group = results.filter((r) => r.position === pos).slice(0, 5);
    console.log(`\n${pos}:`);
    for (const [i, r] of group.entries()) {
      console.log(
        `  ${i + 1}. ${r.playerName.padEnd(28)} Alpha=${r.rookieAlpha}  ${r.tier}  [${r.pillarDetail}]`
      );
    }
  }

  // ── Write to DB ─────────────────────────────────────────────────────────────
  console.log("\nWriting to DB...");
  let updated = 0;
  for (const r of results) {
    await db
      .update(rookieProfiles)
      .set({
        athleticismScore: r.rasNorm,
        productionScore: r.prodScore,
        draftCapitalScore: r.dcScore,
        rookieAlpha: r.rookieAlpha,
        rookieTier: r.tier,
        updatedAt: new Date(),
      })
      .where(sql`id = ${r.id}`);
    updated++;
  }

  console.log(`\n✅ Updated ${updated} players with Rookie Alpha scores`);

  // ── Summary stats ───────────────────────────────────────────────────────────
  const tierCounts: Record<string, number> = {};
  for (const r of results) {
    tierCounts[r.tier] = (tierCounts[r.tier] ?? 0) + 1;
  }
  console.log("\nTier distribution:", tierCounts);

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
