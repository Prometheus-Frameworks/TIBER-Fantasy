#!/usr/bin/env tsx
/**
 * Standalone Sleeper Identity Sync Script
 * Runs the sync independently without server interference
 */

import { db } from '../infra/db';
import { sleeperIdentitySync } from '../services/SleeperIdentitySync';

async function runSync() {
  console.log('🚀 Starting standalone Sleeper Identity Sync...\n');

  try {
    // Run the sync
    const report = await sleeperIdentitySync.syncSleeperIdentities(false, 0.90);

    console.log('\n✅ Sync completed successfully!');
    console.log('\n📊 Final Report:');
    console.log(`   Total Sleeper Players: ${report.totalSleeperPlayers}`);
    console.log(`   Already Mapped: ${report.alreadyMapped}`);
    console.log(`   High Confidence Matches: ${report.highConfidenceMatches}`);
    console.log(`   Medium Confidence Matches: ${report.mediumConfidenceMatches}`);
    console.log(`   Low Confidence Matches: ${report.lowConfidenceMatches}`);
    console.log(`   Unmatched Players: ${report.unmatchedPlayers}`);
    console.log(`   Newly Mapped: ${report.newlyMapped}`);

    // Show top unmapped star players
    const starPlayers = report.unmatchedDetails
      .filter(p => ['QB', 'RB', 'WR', 'TE'].includes(p.position))
      .slice(0, 20);

    if (starPlayers.length > 0) {
      console.log('\n❌ Top 20 Unmapped Players:');
      starPlayers.forEach(p => {
        console.log(`   ${p.name} (${p.position}, ${p.team})`);
      });
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Sync failed:', error);
    process.exit(1);
  }
}

runSync();
