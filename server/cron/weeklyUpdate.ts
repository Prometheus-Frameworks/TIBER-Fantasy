/**
 * Automated weekly cron job for Hot List updates
 * Runs every Tuesday at 2 AM ET (after MNF stats are finalized)
 */
import cron from 'node-cron';
import { weeklyHotListETL } from '../etl/weeklyHotListUpdate';

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
    scheduled: true,
    timezone: "America/New_York"
  });

  console.log('✅ Weekly Hot List cron job active');
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