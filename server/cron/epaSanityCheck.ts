/**
 * EPA Sanity Check Nightly Cron Job
 * Runs daily at 2:30 AM ET to keep EPA validation data fresh
 * Calculates both context metrics and adjusted EPA for all QBs
 */
import cron from 'node-cron';
import { epaSanityCheckService } from '../services/epaSanityCheck';
import { seasonService } from '../services/SeasonService';

export function setupEPASanityCheckCron() {
  console.log('🔬 Setting up EPA Sanity Check nightly cron job...');

  // Run every day at 2:30 AM ET (after nightly data updates)
  cron.schedule('30 2 * * *', async () => {
    try {
      // Get current season dynamically from SeasonService
      const seasonSnapshot = await seasonService.current();
      const season = seasonSnapshot.season;
      
      console.log(`🔬 EPA Sanity Check cron triggered for season ${season} (week ${seasonSnapshot.week}, source: ${seasonSnapshot.source})...`);
      
      // Validate season before processing
      if (!season || season < 2020 || season > 2030) {
        console.error(`❌ Invalid season detected: ${season}. Aborting EPA calculation.`);
        return;
      }
      
      // Calculate EPA metrics
      // Step 1: Calculate QB context metrics (drops, pressure, YAC, defense)
      console.log(`📊 Calculating QB context metrics for season ${season}...`);
      await epaSanityCheckService.calculateQbContextMetrics(season);
      console.log(`✅ Context metrics calculated for season ${season}`);

      // Step 2: Calculate Tiber adjusted EPA using context metrics
      console.log(`🧮 Calculating Tiber adjusted EPA for season ${season}...`);
      await epaSanityCheckService.calculateTiberAdjustedEpa(season);
      console.log(`✅ Tiber adjusted EPA calculated for season ${season}`);

      // Step 3: Get summary for logging
      const result = await epaSanityCheckService.compareWithBaldwin(season);
      const { comparisons, metadata } = result;
      
      const withDiff = comparisons.filter(c => c.difference !== null);
      const avgDiff = withDiff.length > 0
        ? withDiff.reduce((sum, c) => sum + Math.abs(c.difference!), 0) / withDiff.length
        : 0;

      console.log(`✅ EPA Sanity Check completed successfully:`);
      console.log(`   📊 ${comparisons.length} QBs processed`);
      console.log(`   🎯 Average difference: ${avgDiff.toFixed(3)}`);
      console.log(`   💾 Duplicates: ${metadata.hasDuplicates ? 'Yes ⚠️' : 'No ✓'}`);
      console.log(`   🕒 Last updated: ${metadata.tiberLastCalculated?.toLocaleString('en-US', { timeZone: 'America/New_York' })}`);
      
    } catch (error) {
      console.error(`❌ EPA Sanity Check cron failed:`, error);
    }
  }, {
    timezone: "America/New_York"
  });

  console.log('✅ EPA Sanity Check cron job active (runs daily at 2:30 AM ET)');
}
