/**
 * Automated weekly cron jobs for nightly data processing
 * Runs every Tuesday at 2 AM ET (after MNF stats are finalized)
 * Includes nightly Buys/Sells computation
 */
import cron from 'node-cron';
import { nightlyBuysSellsETL } from '../etl/nightlyBuysSellsUpdate';
import { setupRBContextCheckCron } from './rbContextCheck';
import { setupInjurySyncCron } from './injurySync';
import { setupScheduleSyncCron } from './scheduleSync';
import { requireEvidenceIngestionDefaultTarget } from '../config/season';

/**
 * Setup nightly Buys/Sells computation cron job
 * Runs every day at 3 AM ET (after player data updates are complete)
 */
export function setupNightlyBuysSellsCron() {
  console.log('🌙 Setting up nightly Buys/Sells cron job...');

  // Run every day at 3 AM ET (after data ingestion is complete)
  cron.schedule('0 3 * * *', async () => {
    try {
      const target = requireEvidenceIngestionDefaultTarget();
      console.log(`🌙 Nightly Buys/Sells cron triggered for ${target.season} Week ${target.week}`);
      const result = await nightlyBuysSellsETL.processNightlyBuysSells(target);
      console.log(`✅ Nightly Buys/Sells computation completed:`);
      console.log(`   📊 ${result.totalRecords} recommendations generated`);
      console.log(`   🎯 ${result.positionsProcessed.length} positions processed`);
      console.log(`   ⏱️ Completed in ${result.duration}ms`);
      
      if (result.errors.length > 0) {
        console.warn(`⚠️ ${result.errors.length} errors occurred:`);
        result.errors.forEach(error => console.warn(`   • ${error}`));
      }
    } catch (error) {
      console.error(`❌ Nightly Buys/Sells cron failed:`, error);
    }
  }, {
    timezone: "America/New_York"
  });

  console.log('✅ Nightly Buys/Sells cron job active');
}

/**
 * Setup combined weekly data processing
 * Runs Tuesday at 4 AM ET (after Hot List and nightly processing)
 */
export function setupWeeklyDataProcessing() {
  console.log('📊 Setting up combined weekly data processing...');

  // Run every Tuesday at 4 AM ET (after Hot List updates and nightly processing)
  cron.schedule('0 4 * * 2', async () => {
    try {
      const target = requireEvidenceIngestionDefaultTarget();
      console.log(`📊 Weekly data processing triggered for ${target.season} Week ${target.week}`);
      // Run comprehensive Buys/Sells computation for the new week
      console.log('🔄 Running comprehensive Buys/Sells computation for new week...');
      const result = await nightlyBuysSellsETL.processSpecificWeek(target.week, target.season);
      
      console.log(`✅ Weekly Buys/Sells computation completed:`);
      console.log(`   📊 ${result.totalRecords} recommendations generated`);
      console.log(`   🎯 ${result.positionsProcessed.length} positions processed`);
      console.log(`   ⏱️ Completed in ${result.duration}ms`);
      
      // Run health check
      const healthCheck = await nightlyBuysSellsETL.healthCheck();
      console.log(`🏥 System health: ${healthCheck.status}`);
      if (healthCheck.status !== 'healthy') {
        console.warn(`⚠️ Health check details:`, healthCheck.details);
      }
      
    } catch (error) {
      console.error(`❌ Weekly data processing failed:`, error);
    }
  }, {
    timezone: "America/New_York"
  });

  console.log('✅ Weekly data processing cron job active');
}

/**
 * Setup all cron jobs for the application
 */
export function setupAllCronJobs() {
  console.log('🕒 Initializing all cron jobs...');
  
  setupScheduleSyncCron(); // Schedule sync first (1 AM ET)
  setupNightlyBuysSellsCron();
  setupWeeklyDataProcessing();
  setupInjurySyncCron();
  setupRBContextCheckCron();
  
  console.log('✅ All cron jobs initialized successfully');
}

/**
 * Get current NFL week as string (for backwards compatibility)
 * Uses the same atomic, phase-aware evidence target as active ingestion jobs.
 * Throws when the calendar/config cannot name a truthful evidence week; there
 * is deliberately no Week 1 or Week 18 fallback.
 */
function getCurrentNFLWeek(currentDate?: Date): string {
  return String(requireEvidenceIngestionDefaultTarget(currentDate).week);
}

export { getCurrentNFLWeek };
