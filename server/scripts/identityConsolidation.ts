/**
 * Identity Consolidation Script
 * 
 * Detects and merges duplicate player identity records.
 * 
 * USAGE:
 *   npx tsx server/scripts/identityConsolidation.ts [command]
 * 
 * COMMANDS:
 *   backfill    - Populate name_fingerprint for all records
 *   detect      - Find duplicate clusters (dry-run)
 *   report      - Generate detailed merge report with FK counts
 *   merge       - Execute merges for auto-merge candidates
 *   rollback    - Restore a merged record (requires canonical_id arg)
 */

import { db } from '../infra/db';
import { playerIdentityMap } from '@shared/schema';
import { eq, sql, and, isNull, isNotNull } from 'drizzle-orm';
import { 
  generateNameFingerprint, 
  calculateNameSimilarity, 
  calculateDataCompleteness,
  hasTeamOverlap,
  MATCH_THRESHOLDS,
  getMatchAction
} from '../utils/nameFingerprint';

interface DuplicateCluster {
  fingerprint: string;
  position: string;
  records: Array<{
    canonicalId: string;
    fullName: string;
    nflTeam: string | null;
    sleeperId: string | null;
    nflDataPyId: string | null;
    dataCompleteness: number;
    weeklyStatsCount: number;
    createdAt: Date | null;
  }>;
  recommendedSurvivor: string;
  recommendedAction: 'auto_merge' | 'review' | 'skip';
  similarity: number;
}

interface MergeReport {
  generatedAt: Date;
  totalRecords: number;
  recordsWithFingerprint: number;
  duplicateClusters: DuplicateCluster[];
  autoMergeCandidates: number;
  reviewCandidates: number;
  totalAffectedFKs: number;
}

async function backfillFingerprints(): Promise<{ updated: number; skipped: number }> {
  console.log('🔧 Backfilling name fingerprints...');
  
  const allPlayers = await db
    .select()
    .from(playerIdentityMap)
    .where(isNull(playerIdentityMap.nameFingerprint));
  
  let updated = 0;
  let skipped = 0;
  
  for (const player of allPlayers) {
    const fingerprint = generateNameFingerprint(player.fullName);
    const completeness = calculateDataCompleteness(player);
    
    if (fingerprint) {
      await db
        .update(playerIdentityMap)
        .set({ 
          nameFingerprint: fingerprint,
          dataCompleteness: completeness,
          updatedAt: new Date()
        })
        .where(eq(playerIdentityMap.canonicalId, player.canonicalId));
      updated++;
    } else {
      skipped++;
    }
  }
  
  console.log(`✅ Updated ${updated} records, skipped ${skipped}`);
  return { updated, skipped };
}

async function getWeeklyStatsCount(canonicalId: string): Promise<number> {
  const result = await db.execute<{ count: number }>(sql`
    SELECT COUNT(*) as count FROM weekly_stats 
    WHERE player_id = ${canonicalId}
       OR player_id IN (
         SELECT sleeper_id FROM player_identity_map WHERE canonical_id = ${canonicalId}
       )
       OR player_id IN (
         SELECT nfl_data_py_id FROM player_identity_map WHERE canonical_id = ${canonicalId}
       )
  `);
  return Number(result.rows[0]?.count || 0);
}

async function detectDuplicates(): Promise<DuplicateCluster[]> {
  console.log('🔍 Detecting duplicate clusters...');
  
  // Find fingerprint+position combos with multiple active records
  const duplicates = await db.execute<{
    name_fingerprint: string;
    position: string;
    count: number;
  }>(sql`
    SELECT name_fingerprint, position, COUNT(*) as count
    FROM player_identity_map
    WHERE name_fingerprint IS NOT NULL
      AND is_active = true
      AND merged_into IS NULL
    GROUP BY name_fingerprint, position
    HAVING COUNT(*) > 1
    ORDER BY count DESC
  `);
  
  console.log(`📊 Found ${duplicates.rows.length} potential duplicate clusters`);
  
  const clusters: DuplicateCluster[] = [];
  
  for (const dup of duplicates.rows) {
    const records = await db
      .select()
      .from(playerIdentityMap)
      .where(
        and(
          eq(playerIdentityMap.nameFingerprint, dup.name_fingerprint),
          eq(playerIdentityMap.position, dup.position),
          eq(playerIdentityMap.isActive, true),
          isNull(playerIdentityMap.mergedInto)
        )
      );
    
    // Calculate completeness and FK counts for each record
    const enrichedRecords = await Promise.all(
      records.map(async (r) => ({
        canonicalId: r.canonicalId,
        fullName: r.fullName,
        nflTeam: r.nflTeam,
        sleeperId: r.sleeperId,
        nflDataPyId: r.nflDataPyId,
        dataCompleteness: calculateDataCompleteness(r),
        weeklyStatsCount: await getWeeklyStatsCount(r.canonicalId),
        createdAt: r.createdAt,
      }))
    );
    
    // Sort by completeness (desc) then weekly stats (desc) then age (asc)
    enrichedRecords.sort((a, b) => {
      if (b.dataCompleteness !== a.dataCompleteness) {
        return b.dataCompleteness - a.dataCompleteness;
      }
      if (b.weeklyStatsCount !== a.weeklyStatsCount) {
        return b.weeklyStatsCount - a.weeklyStatsCount;
      }
      return (a.createdAt?.getTime() || 0) - (b.createdAt?.getTime() || 0);
    });
    
    // Calculate similarity between first two records
    const similarity = records.length >= 2
      ? calculateNameSimilarity(records[0].fullName, records[1].fullName)
      : 1.0;
    
    // Check for team overlap (handles trades)
    const teamOverlap = records.length >= 2
      ? hasTeamOverlap(
          records[0].nflTeam ? [records[0].nflTeam] : [],
          records[1].nflTeam ? [records[1].nflTeam] : []
        )
      : true;
    
    // Determine action
    let action = getMatchAction(similarity);
    
    // If same fingerprint but different teams and no overlap, flag for review
    if (
      action === 'auto_merge' && 
      records.length >= 2 &&
      records[0].nflTeam !== records[1].nflTeam &&
      !teamOverlap
    ) {
      action = 'review';
    }
    
    clusters.push({
      fingerprint: dup.name_fingerprint,
      position: dup.position,
      records: enrichedRecords,
      recommendedSurvivor: enrichedRecords[0].canonicalId,
      recommendedAction: action,
      similarity,
    });
  }
  
  return clusters;
}

async function generateReport(): Promise<MergeReport> {
  console.log('📋 Generating merge report...');
  
  const totalRecords = await db.execute<{ count: number }>(sql`
    SELECT COUNT(*) as count FROM player_identity_map WHERE is_active = true
  `);
  
  const withFingerprint = await db.execute<{ count: number }>(sql`
    SELECT COUNT(*) as count FROM player_identity_map 
    WHERE is_active = true AND name_fingerprint IS NOT NULL
  `);
  
  const clusters = await detectDuplicates();
  
  const autoMerge = clusters.filter(c => c.recommendedAction === 'auto_merge');
  const review = clusters.filter(c => c.recommendedAction === 'review');
  
  const totalFKs = clusters.reduce(
    (sum, c) => sum + c.records.reduce((s, r) => s + r.weeklyStatsCount, 0),
    0
  );
  
  const report: MergeReport = {
    generatedAt: new Date(),
    totalRecords: Number(totalRecords.rows[0]?.count || 0),
    recordsWithFingerprint: Number(withFingerprint.rows[0]?.count || 0),
    duplicateClusters: clusters,
    autoMergeCandidates: autoMerge.length,
    reviewCandidates: review.length,
    totalAffectedFKs: totalFKs,
  };
  
  return report;
}

async function executeMerge(
  survivorId: string, 
  loserId: string,
  dryRun: boolean = true
): Promise<{ success: boolean; error?: string }> {
  console.log(`${dryRun ? '[DRY-RUN] ' : ''}Merging ${loserId} into ${survivorId}...`);
  
  try {
    // Get both records
    const [survivor, loser] = await Promise.all([
      db.select().from(playerIdentityMap).where(eq(playerIdentityMap.canonicalId, survivorId)).limit(1),
      db.select().from(playerIdentityMap).where(eq(playerIdentityMap.canonicalId, loserId)).limit(1),
    ]);
    
    if (!survivor[0] || !loser[0]) {
      return { success: false, error: 'Record not found' };
    }
    
    if (dryRun) {
      console.log(`  Would merge: ${loser[0].fullName} (${loserId}) -> ${survivor[0].fullName} (${survivorId})`);
      console.log(`  Survivor external IDs: sleeper=${survivor[0].sleeperId}, nfl_data_py=${survivor[0].nflDataPyId}`);
      console.log(`  Loser external IDs: sleeper=${loser[0].sleeperId}, nfl_data_py=${loser[0].nflDataPyId}`);
      return { success: true };
    }
    
    // Step 1: Merge external IDs into survivor (preserve non-null values)
    await db
      .update(playerIdentityMap)
      .set({
        sleeperId: survivor[0].sleeperId || loser[0].sleeperId,
        espnId: survivor[0].espnId || loser[0].espnId,
        yahooId: survivor[0].yahooId || loser[0].yahooId,
        rotowireId: survivor[0].rotowireId || loser[0].rotowireId,
        fantasyDataId: survivor[0].fantasyDataId || loser[0].fantasyDataId,
        fantasyprosId: survivor[0].fantasyprosId || loser[0].fantasyprosId,
        mysportsfeedsId: survivor[0].mysportsfeedsId || loser[0].mysportsfeedsId,
        nflDataPyId: survivor[0].nflDataPyId || loser[0].nflDataPyId,
        dataCompleteness: calculateDataCompleteness({
          sleeperId: survivor[0].sleeperId || loser[0].sleeperId,
          espnId: survivor[0].espnId || loser[0].espnId,
          yahooId: survivor[0].yahooId || loser[0].yahooId,
          rotowireId: survivor[0].rotowireId || loser[0].rotowireId,
          fantasyDataId: survivor[0].fantasyDataId || loser[0].fantasyDataId,
          fantasyprosId: survivor[0].fantasyprosId || loser[0].fantasyprosId,
          mysportsfeedsId: survivor[0].mysportsfeedsId || loser[0].mysportsfeedsId,
          nflDataPyId: survivor[0].nflDataPyId || loser[0].nflDataPyId,
        }),
        updatedAt: new Date(),
      })
      .where(eq(playerIdentityMap.canonicalId, survivorId));
    
    // Step 2: Mark loser as merged (soft delete)
    await db
      .update(playerIdentityMap)
      .set({
        mergedInto: survivorId,
        isActive: false,
        updatedAt: new Date(),
      })
      .where(eq(playerIdentityMap.canonicalId, loserId));
    
    console.log(`✅ Merged ${loserId} into ${survivorId}`);
    return { success: true };
    
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error(`❌ Merge failed: ${errorMsg}`);
    return { success: false, error: errorMsg };
  }
}

async function executeAutoMerges(dryRun: boolean = true): Promise<{ merged: number; failed: number }> {
  const clusters = await detectDuplicates();
  const autoMergeClusters = clusters.filter(c => c.recommendedAction === 'auto_merge');
  
  console.log(`\n📊 Found ${autoMergeClusters.length} auto-merge candidates`);
  
  let merged = 0;
  let failed = 0;
  
  for (const cluster of autoMergeClusters) {
    const survivor = cluster.records[0];
    const losers = cluster.records.slice(1);
    
    console.log(`\n🔄 Cluster: ${cluster.fingerprint} (${cluster.position})`);
    console.log(`   Survivor: ${survivor.fullName} (${survivor.canonicalId})`);
    console.log(`   - Data completeness: ${survivor.dataCompleteness}`);
    console.log(`   - Weekly stats: ${survivor.weeklyStatsCount}`);
    
    for (const loser of losers) {
      console.log(`   Merging: ${loser.fullName} (${loser.canonicalId})`);
      console.log(`   - Data completeness: ${loser.dataCompleteness}`);
      console.log(`   - Weekly stats: ${loser.weeklyStatsCount}`);
      
      const result = await executeMerge(survivor.canonicalId, loser.canonicalId, dryRun);
      if (result.success) {
        merged++;
      } else {
        failed++;
      }
    }
  }
  
  console.log(`\n${dryRun ? '[DRY-RUN] ' : ''}Summary: ${merged} merged, ${failed} failed`);
  return { merged, failed };
}

async function rollbackMerge(canonicalId: string): Promise<{ success: boolean; error?: string }> {
  console.log(`🔄 Rolling back merge for ${canonicalId}...`);
  
  try {
    const record = await db
      .select()
      .from(playerIdentityMap)
      .where(eq(playerIdentityMap.canonicalId, canonicalId))
      .limit(1);
    
    if (!record[0]) {
      return { success: false, error: 'Record not found' };
    }
    
    if (!record[0].mergedInto) {
      return { success: false, error: 'Record was not merged' };
    }
    
    await db
      .update(playerIdentityMap)
      .set({
        mergedInto: null,
        isActive: true,
        updatedAt: new Date(),
      })
      .where(eq(playerIdentityMap.canonicalId, canonicalId));
    
    console.log(`✅ Rolled back ${canonicalId}`);
    return { success: true };
    
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: errorMsg };
  }
}

function printReport(report: MergeReport): void {
  console.log('\n' + '='.repeat(80));
  console.log('IDENTITY CONSOLIDATION REPORT');
  console.log('='.repeat(80));
  console.log(`Generated: ${report.generatedAt.toISOString()}`);
  console.log(`Total active records: ${report.totalRecords}`);
  console.log(`Records with fingerprint: ${report.recordsWithFingerprint}`);
  console.log(`Duplicate clusters found: ${report.duplicateClusters.length}`);
  console.log(`Auto-merge candidates: ${report.autoMergeCandidates}`);
  console.log(`Review candidates: ${report.reviewCandidates}`);
  console.log(`Total affected FK rows: ${report.totalAffectedFKs}`);
  console.log('='.repeat(80));
  
  // Print top 20 clusters
  const topClusters = report.duplicateClusters.slice(0, 20);
  
  for (const cluster of topClusters) {
    console.log(`\n📌 ${cluster.fingerprint.toUpperCase()} (${cluster.position})`);
    console.log(`   Action: ${cluster.recommendedAction} | Similarity: ${(cluster.similarity * 100).toFixed(1)}%`);
    
    for (const record of cluster.records) {
      const isSurvivor = record.canonicalId === cluster.recommendedSurvivor;
      const marker = isSurvivor ? '✓' : '✗';
      console.log(`   ${marker} ${record.canonicalId}`);
      console.log(`     Name: ${record.fullName} | Team: ${record.nflTeam || 'N/A'}`);
      console.log(`     IDs: sleeper=${record.sleeperId || 'N/A'}, nfl_data_py=${record.nflDataPyId || 'N/A'}`);
      console.log(`     Completeness: ${record.dataCompleteness} | Weekly Stats: ${record.weeklyStatsCount}`);
    }
  }
  
  if (report.duplicateClusters.length > 20) {
    console.log(`\n... and ${report.duplicateClusters.length - 20} more clusters`);
  }
}

// Main CLI
async function main(): Promise<void> {
  const command = process.argv[2] || 'report';
  
  console.log(`\n🚀 Identity Consolidation Tool - Command: ${command}\n`);
  
  switch (command) {
    case 'backfill':
      await backfillFingerprints();
      break;
      
    case 'detect':
      const clusters = await detectDuplicates();
      console.log(`Found ${clusters.length} duplicate clusters`);
      break;
      
    case 'report':
      const report = await generateReport();
      printReport(report);
      break;
      
    case 'merge':
      const dryRun = process.argv[3] !== '--execute';
      if (dryRun) {
        console.log('⚠️  DRY-RUN MODE - No changes will be made');
        console.log('   Add --execute flag to perform actual merges');
      }
      await executeAutoMerges(dryRun);
      break;
      
    case 'rollback':
      const canonicalId = process.argv[3];
      if (!canonicalId) {
        console.error('Usage: rollback <canonical_id>');
        process.exit(1);
      }
      await rollbackMerge(canonicalId);
      break;
      
    default:
      console.log('Unknown command. Available: backfill, detect, report, merge, rollback');
      process.exit(1);
  }
  
  console.log('\n✅ Done');
  process.exit(0);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
