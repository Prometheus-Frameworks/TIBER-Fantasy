/**
 * TE Role Bank Batch Compute Script
 * Computes season-level role bank analytics for all TEs with weekly usage data
 * 
 * Usage:
 *   tsx server/scripts/computeAllTERoleBank.ts [season] [--dry-run]
 * 
 * Examples:
 *   tsx server/scripts/computeAllTERoleBank.ts 2024
 *   tsx server/scripts/computeAllTERoleBank.ts 2025 --dry-run
 */

import { db } from '../infra/db';
import { weeklyStats } from '@shared/schema';
import { sql } from 'drizzle-orm';
import { computeTERoleBankSeasonRow } from '../services/roleBankService';
import { storage } from '../storage';

interface TECandidate {
  playerId: string;
  playerName: string;
  position: string | null;
  gamesPlayed: number;
}

async function getTECandidates(season: number): Promise<TECandidate[]> {
  console.log(`🔍 [TE Role Bank] Finding TE candidates for season ${season}...`);
  
  const candidates = await db
    .select({
      playerId: weeklyStats.playerId,
      playerName: weeklyStats.playerName,
      position: sql<string>`pp.position`.as('position'),
      gamesPlayed: sql<number>`COUNT(DISTINCT ${weeklyStats.week})`.as('games_played')
    })
    .from(weeklyStats)
    .innerJoin(
      sql`player_positions pp`,
      sql`${weeklyStats.playerId} = pp.player_id`
    )
    .where(sql`${weeklyStats.season} = ${season} AND pp.position = 'TE'`)
    .groupBy(weeklyStats.playerId, weeklyStats.playerName, sql`pp.position`)
    .having(sql`COUNT(DISTINCT ${weeklyStats.week}) >= 4`);
  
  console.log(`✅ [TE Role Bank] Found ${candidates.length} TE candidates with 4+ games played`);
  
  return candidates;
}

async function computeAllTERoleBank(season: number, dryRun: boolean = false): Promise<void> {
  const startTime = Date.now();
  console.log(`\n🚀 [TE Role Bank] Starting TE Role Bank computation for season ${season}`);
  console.log(`   Mode: ${dryRun ? 'DRY RUN (no database writes)' : 'PRODUCTION (will write to database)'}\n`);
  
  const candidates = await getTECandidates(season);
  
  if (candidates.length === 0) {
    console.log(`⚠️  [TE Role Bank] No TE candidates found for season ${season}`);
    return;
  }
  
  let successCount = 0;
  let failureCount = 0;
  const failures: Array<{ playerId: string; playerName: string; error: string }> = [];
  
  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];
    const progress = `[${i + 1}/${candidates.length}]`;
    
    try {
      const weeklyUsage = await storage.getWeeklyUsageForTERoleBank(candidate.playerId, season);
      
      if (weeklyUsage.length === 0) {
        console.log(`   ${progress} ⚠️  ${candidate.playerName} - No weekly usage data`);
        failureCount++;
        failures.push({
          playerId: candidate.playerId,
          playerName: candidate.playerName,
          error: 'No weekly usage data'
        });
        continue;
      }
      
      const roleRow = computeTERoleBankSeasonRow(weeklyUsage);
      
      if (!roleRow) {
        console.log(`   ${progress} ⚠️  ${candidate.playerName} - Failed to compute role bank`);
        failureCount++;
        failures.push({
          playerId: candidate.playerId,
          playerName: candidate.playerName,
          error: 'Computation failed (no games played)'
        });
        continue;
      }
      
      if (!dryRun) {
        await storage.upsertTERoleBank(roleRow);
      }
      
      const tierEmoji = roleRow.roleTier === 'ELITE_TE1' ? '👑' :
                       roleRow.roleTier === 'STRONG_TE1' ? '🏆' :
                       roleRow.roleTier === 'MID_TE1' ? '⭐' :
                       roleRow.roleTier === 'HIGH_TE2' ? '🎯' :
                       roleRow.roleTier === 'STREAMER' ? '📊' :
                       roleRow.roleTier === 'BLOCKING_TE' ? '🛡️' : '❓';
      
      console.log(
        `   ${progress} ${tierEmoji} ${candidate.playerName.padEnd(25)} | ` +
        `Tier: ${roleRow.roleTier.padEnd(12)} | ` +
        `Score: ${roleRow.roleScore.toString().padStart(2)} | ` +
        `Vol: ${roleRow.volumeScore.toString().padStart(2)} | ` +
        `Con: ${roleRow.consistencyScore.toString().padStart(2)} | ` +
        `HV: ${roleRow.highValueUsageScore.toString().padStart(3)} | ` +
        `Mom: ${roleRow.momentumScore.toString().padStart(2)} | ` +
        `Games: ${roleRow.gamesPlayed}`
      );
      
      successCount++;
    } catch (error) {
      console.log(`   ${progress} ❌ ${candidate.playerName} - Error: ${(error as Error).message}`);
      failureCount++;
      failures.push({
        playerId: candidate.playerId,
        playerName: candidate.playerName,
        error: (error as Error).message
      });
    }
  }
  
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`\n${'='.repeat(80)}`);
  console.log(`📊 [TE Role Bank] Computation Summary for Season ${season}`);
  console.log(`${'='.repeat(80)}`);
  console.log(`   Total Candidates: ${candidates.length}`);
  console.log(`   ✅ Success: ${successCount}`);
  console.log(`   ❌ Failures: ${failureCount}`);
  console.log(`   ⏱️  Duration: ${duration}s`);
  console.log(`   Mode: ${dryRun ? 'DRY RUN' : 'PRODUCTION'}`);
  
  if (failures.length > 0 && failures.length <= 10) {
    console.log(`\n   Failed Players:`);
    failures.forEach(f => {
      console.log(`     - ${f.playerName} (${f.playerId}): ${f.error}`);
    });
  } else if (failures.length > 10) {
    console.log(`\n   Failed Players (showing first 10 of ${failures.length}):`);
    failures.slice(0, 10).forEach(f => {
      console.log(`     - ${f.playerName} (${f.playerId}): ${f.error}`);
    });
  }
  
  console.log(`${'='.repeat(80)}\n`);
}

const args = process.argv.slice(2);
const seasonArg = args.find(arg => !arg.startsWith('--'));
const season = seasonArg ? parseInt(seasonArg) : 2024;
const dryRun = args.includes('--dry-run');

if (isNaN(season) || season < 2000 || season > 2100) {
  console.error('❌ Invalid season. Usage: tsx server/scripts/computeAllTERoleBank.ts [season] [--dry-run]');
  process.exit(1);
}

computeAllTERoleBank(season, dryRun)
  .then(() => {
    console.log('✅ [TE Role Bank] Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ [TE Role Bank] Script failed:', error);
    process.exit(1);
  });
