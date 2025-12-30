#!/usr/bin/env tsx
/**
 * TypeScript Wrapper for Snap Share Percentage Backfill
 * 
 * Invokes the Python backfill script to populate snap_share_pct in player_usage table
 * 
 * Usage:
 *   tsx server/scripts/backfillSnapSharePct.ts 2024           # Full 2024 season
 *   tsx server/scripts/backfillSnapSharePct.ts 2024 --week=3  # Just week 3
 *   tsx server/scripts/backfillSnapSharePct.ts 2024 --dry-run # Preview changes
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
  week?: number | null;
  rows_updated?: number;
  rows_to_update?: number;
  rows_skipped?: number;
  dry_run?: boolean;
  error?: string;
  message?: string;
}

async function backfillSnapShare(
  season: number,
  week?: number,
  dryRun: boolean = false
): Promise<BackfillResult> {
  const scriptPath = path.join(__dirname, 'backfillSnapSharePct.py');
  
  let command = `python3 ${scriptPath} ${season}`;
  
  if (week) {
    command += ` --week=${week}`;
  }
  
  if (dryRun) {
    command += ' --dry-run';
  }
  
  console.log(`\n🚀 Running snap share backfill: ${command}\n`);
  
  try {
    const { stdout, stderr } = await execAsync(command, { timeout: 120000 });
    
    if (stderr) {
      console.log(stderr);
    }
    
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
    console.error('Usage: tsx backfillSnapSharePct.ts <season> [--week=<week>] [--dry-run]');
    console.error('Examples:');
    console.error('  tsx backfillSnapSharePct.ts 2024');
    console.error('  tsx backfillSnapSharePct.ts 2024 --week=3');
    console.error('  tsx backfillSnapSharePct.ts 2024 --dry-run');
    process.exit(1);
  }
  
  const season = parseInt(args[0], 10);
  let week: number | undefined;
  let dryRun = false;
  
  for (let i = 1; i < args.length; i++) {
    if (args[i].startsWith('--week=')) {
      week = parseInt(args[i].split('=')[1], 10);
    } else if (args[i] === '--dry-run') {
      dryRun = true;
    }
  }
  
  if (isNaN(season) || season < 2020 || season > 2030) {
    console.error('Invalid season. Must be between 2020 and 2030.');
    process.exit(1);
  }
  
  try {
    const result = await backfillSnapShare(season, week, dryRun);
    
    if (dryRun) {
      console.log('\n🔍 DRY RUN Complete!');
      console.log(`   Season: ${result.season}`);
      console.log(`   Rows to Update: ${result.rows_to_update}`);
      console.log(`   Rows Skipped: ${result.rows_skipped}`);
    } else {
      console.log('\n✅ Backfill Complete!');
      console.log(`   Season: ${result.season}`);
      console.log(`   Rows Updated: ${result.rows_updated}`);
      console.log(`   Rows Skipped: ${result.rows_skipped}`);
    }
    console.log('');
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Backfill Failed:', (error as Error).message);
    process.exit(1);
  }
}

main();
