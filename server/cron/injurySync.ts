/**
 * Injury Sync Nightly Cron Job
 * Runs daily at 2:00 AM ET to keep injury data fresh from Sleeper API
 * Tracks IR and OUT statuses to filter unavailable players from rankings
 */
import cron from 'node-cron';
import { injurySyncService } from '../services/injurySyncService';
import { seasonService } from '../services/SeasonService';

export function setupInjurySyncCron() {
  console.log('🏥 Setting up injury sync nightly cron job...');

  // Run every day at 2:00 AM ET (before other data processing jobs)
  cron.schedule('0 2 * * *', async () => {
    try {
      // Get current season dynamically from SeasonService
      const seasonSnapshot = await seasonService.current();
      const season = seasonSnapshot.season;
      
      console.log(`🏥 Injury sync cron triggered for season ${season} (week ${seasonSnapshot.week})...`);
      
      // Validate season before processing
      if (!season || season < 2020 || season > 2030) {
        console.error(`❌ Invalid season detected: ${season}. Aborting injury sync.`);
        return;
      }
      
      // Sync injuries from Sleeper
      console.log(`📊 Syncing injury data from Sleeper API for season ${season}...`);
      const result = await injurySyncService.syncCurrentInjuries(season);
      
      console.log(`✅ Injury sync completed successfully:`);
      console.log(`   🏥 ${result.synced} players synced (IR/OUT)`);
      console.log(`   ⏭️  ${result.skipped} players skipped (healthy)`);
      console.log(`   ❌ ${result.errors.length} errors`);
      
      if (result.errors.length > 0) {
        console.warn(`⚠️ First 5 errors:`);
        result.errors.slice(0, 5).forEach((error: string) => console.warn(`   • ${error}`));
      }
      
    } catch (error: unknown) {
      console.error(`❌ Injury sync cron failed:`, error);
    }
  }, {
    timezone: "America/New_York"
  });

  console.log('✅ Injury sync cron job active (runs daily at 2:00 AM ET)');
}
