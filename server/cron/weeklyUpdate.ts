/**
 * Automated weekly cron job for Hot List updates and nightly data processing
 * Runs every Tuesday at 2 AM ET (after MNF stats are finalized)
 * Also includes nightly Buys/Sells computation
 */
import cron from 'node-cron';
import { weeklyHotListETL } from '../etl/weeklyHotListUpdate';
import { nightlyBuysSellsETL } from '../etl/nightlyBuysSellsUpdate';
import { setupEPASanityCheckCron } from './epaSanityCheck';

export function setupWeeklyHotListCron() {
  console.log('📅 Setting up weekly Hot List cron job...');

  // Run every Tuesday at 2 AM ET (after Monday Night Football stats finalized)
  cron.schedule('0 2 * * 2', async () => {
    const currentWeek = getCurrentNFLWeek();
    console.log(`🔄 Weekly Hot List cron triggered for Week ${currentWeek}`);
    
    try {
      await weeklyHotListETL.updateHotListFromLiveData(currentWeek);
      console.log(`✅ Weekly Hot List update completed for Week ${currentWeek}`);
    } catch (error) {
      console.error(`❌ Weekly Hot List cron failed:`, error);
    }
  }, {
    timezone: "America/New_York"
  });

  console.log('✅ Weekly Hot List cron job active');
}

/**
 * Setup nightly Buys/Sells computation cron job
 * Runs every day at 3 AM ET (after player data updates are complete)
 */
export function setupNightlyBuysSellsCron() {
  console.log('🌙 Setting up nightly Buys/Sells cron job...');

  // Run every day at 3 AM ET (after data ingestion is complete)
  cron.schedule('0 3 * * *', async () => {
    const currentWeek = getCurrentNFLWeek();
    console.log(`🌙 Nightly Buys/Sells cron triggered for Week ${currentWeek}`);
    
    try {
      const result = await nightlyBuysSellsETL.processNightlyBuysSells();
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
    const currentWeek = getCurrentNFLWeek();
    console.log(`📊 Weekly data processing triggered for Week ${currentWeek}`);
    
    try {
      // Run comprehensive Buys/Sells computation for the new week
      console.log('🔄 Running comprehensive Buys/Sells computation for new week...');
      const result = await nightlyBuysSellsETL.processSpecificWeek(parseInt(currentWeek));
      
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
  
  setupWeeklyHotListCron();
  setupNightlyBuysSellsCron();
  setupWeeklyDataProcessing();
  setupEPASanityCheckCron();
  
  console.log('✅ All cron jobs initialized successfully');
}

function getCurrentNFLWeek(): string {
  // Calculate current NFL week based on season calendar
  const now = new Date();
  const seasonStart = new Date('2024-09-05'); // NFL Week 1, 2024
  const timeDiff = now.getTime() - seasonStart.getTime();
  const daysDiff = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
  const weekNumber = Math.min(Math.max(Math.floor(daysDiff / 7) + 1, 1), 18);
  
  return `${weekNumber}`;
}

export { getCurrentNFLWeek };