/**
 * Automated NFL Schedule Sync from NFLverse
 * Runs Tuesday at 1 AM ET (before other weekly processing)
 * Ensures schedule data is always up-to-date from official source
 */
import cron from 'node-cron';
import { spawn } from 'child_process';
import path from 'path';
import {
  InvalidEvidenceIngestionTargetError,
  requireScheduleSyncDefaultSeason,
} from '../config/season';

export interface ScheduleSyncResult {
  success: boolean;
  season: number;
  gamesSync: number;
  duration: number;
  error?: string;
}

/**
 * Run the Python schedule sync script
 */
export async function syncScheduleFromNFLverse(season?: number): Promise<ScheduleSyncResult> {
  const startTime = Date.now();
  const targetSeason = season ?? requireScheduleSyncDefaultSeason();
  if (!Number.isInteger(targetSeason) || targetSeason < 2000 || targetSeason > 2100) {
    throw new InvalidEvidenceIngestionTargetError('Season must be an integer between 2000 and 2100.');
  }
  
  return new Promise((resolve) => {
    const scriptPath = path.join(process.cwd(), 'scripts', 'sync_schedule.py');
    
    console.log(`[ScheduleSync] Starting sync for season ${targetSeason}...`);
    
    const python = spawn('python', [scriptPath, '--season', targetSeason.toString(), '--verify']);
    
    let stdout = '';
    let stderr = '';
    
    python.stdout.on('data', (data) => {
      stdout += data.toString();
      console.log(`[ScheduleSync] ${data.toString().trim()}`);
    });
    
    python.stderr.on('data', (data) => {
      stderr += data.toString();
      console.error(`[ScheduleSync] Error: ${data.toString().trim()}`);
    });
    
    python.on('close', (code) => {
      const duration = Date.now() - startTime;
      
      if (code === 0) {
        // Parse games count from output
        const gamesMatch = stdout.match(/Upserted (\d+) games/);
        const gamesSync = gamesMatch ? parseInt(gamesMatch[1]) : 0;
        
        console.log(`[ScheduleSync] Complete - ${gamesSync} games in ${duration}ms`);
        
        resolve({
          success: true,
          season: targetSeason,
          gamesSync,
          duration
        });
      } else {
        console.error(`[ScheduleSync] Failed with code ${code}`);
        resolve({
          success: false,
          season: targetSeason,
          gamesSync: 0,
          duration,
          error: stderr || `Process exited with code ${code}`
        });
      }
    });
    
    python.on('error', (error) => {
      console.error(`[ScheduleSync] Spawn error:`, error);
      resolve({
        success: false,
        season: targetSeason,
        gamesSync: 0,
        duration: Date.now() - startTime,
        error: error.message
      });
    });
  });
}

/**
 * Setup automated schedule sync cron job
 * Runs every Tuesday at 1 AM ET (before other weekly processing)
 */
export function setupScheduleSyncCron() {
  console.log('📅 Setting up NFL schedule sync cron job...');
  
  // Run every Tuesday at 1 AM ET
  cron.schedule('0 1 * * 2', async () => {
    try {
      const targetSeason = requireScheduleSyncDefaultSeason();
      console.log(`📅 Schedule sync cron triggered for season ${targetSeason}`);
      const result = await syncScheduleFromNFLverse(targetSeason);
      
      if (result.success) {
        console.log(`✅ Schedule sync completed:`);
        console.log(`   📊 ${result.gamesSync} games synced`);
        console.log(`   ⏱️ Completed in ${result.duration}ms`);
      } else {
        console.error(`❌ Schedule sync failed: ${result.error}`);
      }
    } catch (error) {
      console.error(`❌ Schedule sync cron failed:`, error);
    }
  }, {
    timezone: "America/New_York"
  });
  
  console.log('✅ NFL schedule sync cron job active (Tuesdays @ 1 AM ET)');
}

/**
 * Get current week's schedule from database
 */
export async function getCurrentWeekSchedule(db: any, season: number, week: number) {
  const result = await db.query.schedule.findMany({
    where: (schedule: any, { and, eq }: any) => and(
      eq(schedule.season, season),
      eq(schedule.week, week)
    ),
    orderBy: (schedule: any, { asc }: any) => [asc(schedule.home)]
  });
  
  return result;
}
