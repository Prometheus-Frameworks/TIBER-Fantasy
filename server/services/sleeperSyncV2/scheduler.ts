/**
 * Sleeper Sync Scheduler
 * Background scheduler that runs syncLeague for all known leagues at configurable intervals.
 * 
 * Env flags:
 * - ENABLE_SLEEPER_SYNC (default false) - Enable/disable scheduler
 * - SLEEPER_SYNC_INTERVAL_MINUTES (default 60) - Sync interval in minutes
 * - SLEEPER_SYNC_JITTER_SECONDS (default 10) - Random jitter between league syncs
 */

import { db } from '../../infra/db';
import { sleeperSyncState } from '@shared/schema';
import { desc } from 'drizzle-orm';
import { syncLeague } from './syncService';

// Scheduler state
interface SchedulerState {
  enabled: boolean;
  intervalMinutes: number;
  jitterSeconds: number;
  running: boolean;
  lastRunAt: Date | null;
  lastRunDurationMs: number | null;
  lastRunSummary: {
    leagues: number;
    ok: number;
    error: number;
  } | null;
}

let schedulerState: SchedulerState = {
  enabled: false,
  intervalMinutes: 60,
  jitterSeconds: 10,
  running: false,
  lastRunAt: null,
  lastRunDurationMs: null,
  lastRunSummary: null,
};

let schedulerTimer: NodeJS.Timeout | null = null;

/**
 * Shared function to get all stored leagues from sync state
 * Used by both routes and scheduler
 */
export async function getStoredLeagues(): Promise<{ leagueId: string; status: string | null; lastSyncedAt: Date | null; changeSeq: number | null }[]> {
  const leagues = await db
    .select({
      leagueId: sleeperSyncState.leagueId,
      status: sleeperSyncState.status,
      lastSyncedAt: sleeperSyncState.lastSyncedAt,
      changeSeq: sleeperSyncState.changeSeq,
    })
    .from(sleeperSyncState)
    .orderBy(desc(sleeperSyncState.lastSyncedAt));
  
  return leagues;
}

/**
 * Random delay for jitter between league syncs
 */
function randomJitter(maxSeconds: number): Promise<void> {
  const delayMs = Math.floor(Math.random() * maxSeconds * 1000);
  return new Promise(resolve => setTimeout(resolve, delayMs));
}

/**
 * Run a single sync cycle for all leagues
 */
async function runSyncCycle(): Promise<void> {
  if (schedulerState.running) {
    console.log('[SleeperScheduler] Skipped tick (already running)');
    return;
  }

  schedulerState.running = true;
  const startTime = Date.now();
  
  try {
    const leagues = await getStoredLeagues();
    
    if (leagues.length === 0) {
      console.log('[SleeperScheduler] No leagues to sync');
      schedulerState.lastRunAt = new Date();
      schedulerState.lastRunDurationMs = Date.now() - startTime;
      schedulerState.lastRunSummary = { leagues: 0, ok: 0, error: 0 };
      return;
    }

    console.log(`[SleeperScheduler] Starting sync cycle for ${leagues.length} leagues`);
    
    let okCount = 0;
    let errorCount = 0;

    for (const league of leagues) {
      try {
        const result = await syncLeague(league.leagueId);
        
        if (result.success) {
          okCount++;
          const status = result.baseline ? 'baseline' : result.shortCircuited ? 'shortCircuited' : 'synced';
          console.log(`[SleeperScheduler] ${league.leagueId}: ok (${status}, ${result.eventsInserted} events)`);
        } else {
          errorCount++;
          console.log(`[SleeperScheduler] ${league.leagueId}: error - ${result.error}`);
        }
      } catch (err: any) {
        errorCount++;
        console.error(`[SleeperScheduler] ${league.leagueId}: exception - ${err?.message || err}`);
      }

      // Apply jitter between leagues (except after the last one)
      if (leagues.indexOf(league) < leagues.length - 1) {
        await randomJitter(schedulerState.jitterSeconds);
      }
    }

    const durationMs = Date.now() - startTime;
    
    schedulerState.lastRunAt = new Date();
    schedulerState.lastRunDurationMs = durationMs;
    schedulerState.lastRunSummary = {
      leagues: leagues.length,
      ok: okCount,
      error: errorCount,
    };

    console.log(`[SleeperScheduler] Sync cycle complete: ${okCount}/${leagues.length} ok, ${errorCount} errors in ${durationMs}ms`);

  } finally {
    schedulerState.running = false;
  }
}

/**
 * Start the scheduler
 */
export function startScheduler(): void {
  const enabled = process.env.ENABLE_SLEEPER_SYNC === 'true';
  const intervalMinutes = parseInt(process.env.SLEEPER_SYNC_INTERVAL_MINUTES || '60', 10);
  const jitterSeconds = parseInt(process.env.SLEEPER_SYNC_JITTER_SECONDS || '10', 10);

  schedulerState.enabled = enabled;
  schedulerState.intervalMinutes = intervalMinutes;
  schedulerState.jitterSeconds = jitterSeconds;

  if (!enabled) {
    console.log('[SleeperScheduler] Disabled (ENABLE_SLEEPER_SYNC not set to true)');
    return;
  }

  const intervalMs = intervalMinutes * 60 * 1000;

  console.log(`[SleeperScheduler] Starting with interval=${intervalMinutes}min, jitter=${jitterSeconds}s`);

  // Run immediately on start, then at interval
  runSyncCycle().catch(err => {
    console.error('[SleeperScheduler] Initial sync cycle failed:', err);
  });

  schedulerTimer = setInterval(() => {
    runSyncCycle().catch(err => {
      console.error('[SleeperScheduler] Sync cycle failed:', err);
    });
  }, intervalMs);
}

/**
 * Stop the scheduler
 */
export function stopScheduler(): void {
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
    console.log('[SleeperScheduler] Stopped');
  }
}

/**
 * Get current scheduler status
 */
export function getSchedulerStatus(): {
  enabled: boolean;
  intervalMinutes: number;
  jitterSeconds: number;
  running: boolean;
  lastRunAt: string | null;
  lastRunDurationMs: number | null;
  lastRunSummary: { leagues: number; ok: number; error: number } | null;
} {
  return {
    enabled: schedulerState.enabled,
    intervalMinutes: schedulerState.intervalMinutes,
    jitterSeconds: schedulerState.jitterSeconds,
    running: schedulerState.running,
    lastRunAt: schedulerState.lastRunAt?.toISOString() ?? null,
    lastRunDurationMs: schedulerState.lastRunDurationMs,
    lastRunSummary: schedulerState.lastRunSummary,
  };
}
