#!/usr/bin/env tsx
/**
 * TypeScript Wrapper for Weekly Usage Backfill
 * 
 * Invokes the Python backfill script to populate weekly_stats and player_usage tables
 * 
 * Usage:
 *   tsx server/scripts/backfillWeeklyUsage.ts 2024           # Full 2024 season
 *   tsx server/scripts/backfillWeeklyUsage.ts 2024 10        # Just week 10
 *   tsx server/scripts/backfillWeeklyUsage.ts 2024 --player=00-0036963  # Amon-Ra 2024
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const execAsync = promisify(exec);

interface BackfillResult {
  success: boolean;
  season: number;
  weeks_processed: number;
  weekly_stats_count: number;
  player_usage_count: number;
  player_filter?: string;
}

async function backfillWeeklyUsage(
  season: number,
  week?: number,
  playerId?: string
): Promise<BackfillResult> {
  const scriptPath = path.join(__dirname, 'backfillWeeklyUsage.py');
  
  let command = `python3 ${scriptPath} ${season}`;
  
  if (week) {
    command += ` ${week}`;
  }
  
  if (playerId) {
    command += ` --player_id=${playerId}`;
  }
  
  console.log(`\n🚀 Running backfill: ${command}\n`);
  
  try {
    const { stdout, stderr } = await execAsync(command);
    
    // Print Python stderr (progress logs)
    if (stderr) {
      console.log(stderr);
    }
    
    // Parse JSON result from stdout
    const jsonStart = stdout.lastIndexOf('{');
    if (jsonStart === -1) {
      throw new Error('No JSON output from Python script');
    }
    
    const jsonOutput = stdout.substring(jsonStart);
    const result: BackfillResult = JSON.parse(jsonOutput);
    
    return result;
  } catch (error) {
    throw new Error(`Backfill failed: ${(error as Error).message}`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.error('Usage: tsx backfillWeeklyUsage.ts <season> [week] [--player=<player_id>]');
    console.error('Examples:');
    console.error('  tsx backfillWeeklyUsage.ts 2024');
    console.error('  tsx backfillWeeklyUsage.ts 2024 10');
    console.error('  tsx backfillWeeklyUsage.ts 2024 --player=00-0036963');
    process.exit(1);
  }
  
  const season = parseInt(args[0], 10);
  let week: number | undefined;
  let playerId: string | undefined;
  
  // Parse arguments
  for (let i = 1; i < args.length; i++) {
    if (args[i].startsWith('--player=')) {
      playerId = args[i].split('=')[1];
    } else if (!isNaN(parseInt(args[i], 10))) {
      week = parseInt(args[i], 10);
    }
  }
  
  if (isNaN(season) || season < 2020 || season > 2030) {
    console.error('❌ Invalid season. Must be between 2020 and 2030.');
    process.exit(1);
  }
  
  try {
    const result = await backfillWeeklyUsage(season, week, playerId);
    
    console.log('\n✅ Backfill Complete!');
    console.log(`   Season: ${result.season}`);
    console.log(`   Weeks Processed: ${result.weeks_processed}`);
    console.log(`   Weekly Stats Records: ${result.weekly_stats_count}`);
    console.log(`   Player Usage Records: ${result.player_usage_count}`);
    if (result.player_filter) {
      console.log(`   Player Filter: ${result.player_filter}`);
    }
    console.log('');
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Backfill Failed:', (error as Error).message);
    process.exit(1);
  }
}

main();
