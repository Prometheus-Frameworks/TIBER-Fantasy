/**
 * RB Context Check Nightly Cron Job
 * Runs daily at 2:45 AM ET to keep RB EPA context data fresh
 * Calculates both context metrics and adjusted EPA for all RBs
 * Runs 15 min after QB cron to avoid overlap
 */
import cron from 'node-cron';
import { rbContextCheckService } from '../services/rbContextCheck';
import { seasonService } from '../services/SeasonService';

export function setupRBContextCheckCron() {
  console.log('🏃 Setting up RB Context Check nightly cron job...');

  // Run every day at 2:45 AM ET (15 min after QB EPA cron)
  cron.schedule('45 2 * * *', async () => {
    try {
      // Get current season dynamically from SeasonService
      const seasonSnapshot = await seasonService.current();
      const season = seasonSnapshot.season;
      
      console.log(`🏃 RB Context Check cron triggered for season ${season} (week ${seasonSnapshot.week}, source: ${seasonSnapshot.source})...`);
      
      // Validate season before processing
      if (!season || season < 2020 || season > 2030) {
        console.error(`❌ Invalid season detected: ${season}. Aborting RB context calculation.`);
        return;
      }
      
      // Calculate RB context metrics
      // Step 1: Calculate RB context metrics (box count, YBC, broken tackles, etc.)
      console.log(`📊 Calculating RB context metrics for season ${season}...`);
      await rbContextCheckService.storeRbContextMetrics(season);
      console.log(`✅ RB context metrics calculated and stored for season ${season}`);

      // Step 2: Calculate Tiber adjusted EPA using context metrics
      console.log(`🧮 Calculating Tiber adjusted EPA for RBs season ${season}...`);
      await rbContextCheckService.calculateTiberAdjustedEpa(season);
      console.log(`✅ Tiber adjusted EPA calculated for RBs season ${season}`);

      // Step 3: Get summary for logging
      const result = await rbContextCheckService.getRbContextComparison(season);
      const { summary, dataQuality } = result;

      console.log(`✅ RB Context Check completed successfully:`);
      console.log(`   🏃 ${summary.totalRbs} RBs processed`);
      console.log(`   📊 Average raw EPA: ${summary.avgRawEpa.toFixed(3)}`);
      console.log(`   📈 Average adjusted EPA: ${summary.avgAdjEpa.toFixed(3)}`);
      console.log(`   🎯 Average adjustment: ${summary.avgDifference.toFixed(3)}`);
      console.log(`   💾 Duplicates: ${dataQuality.hasDuplicates ? 'Yes ⚠️' : 'No ✓'}`);
      console.log(`   🕒 Last updated: ${dataQuality.adjustedLastCalculated?.toLocaleString('en-US', { timeZone: 'America/New_York' })}`);
      console.log(`   ⏰ Stale data: ${dataQuality.isStale ? 'Yes ⚠️' : 'No ✓'}`);
      
    } catch (error) {
      console.error(`❌ RB Context Check cron failed:`, error);
    }
  }, {
    timezone: "America/New_York"
  });

  console.log('✅ RB Context Check cron job active (runs daily at 2:45 AM ET)');
}
