#!/usr/bin/env tsx
/**
 * Ingest a single week of NFLfastR stats into weekly_stats table
 * 
 * Usage:
 *   tsx server/scripts/ingest-week.ts 10
 *   tsx server/scripts/ingest-week.ts 11
 */

import { fetchWeeklyFromNflfastR } from '../ingest/nflfastr';
import { storage } from '../storage';

async function main() {
  const week = parseInt(process.argv[2], 10);
  const season = parseInt(process.argv[3], 10) || 2024; // Allow season override, default to 2024
  
  if (!week || week < 1 || week > 18) {
    console.error('❌ Invalid week. Usage: tsx server/scripts/ingest-week.ts <week>');
    console.error('   Example: tsx server/scripts/ingest-week.ts 10');
    process.exit(1);
  }
  
  console.log(`\n📥 Starting NFLfastR ingest for ${season} Week ${week}...`);
  
  try {
    // Fetch from NFLfastR
    console.log('🔍 Fetching data from NFLfastR (nfl_data_py)...');
    const stats = await fetchWeeklyFromNflfastR(season, week);
    
    console.log(`✅ Fetched ${stats.length} player records`);
    
    if (stats.length === 0) {
      console.log('⚠️  No stats found for this week (game may not have been played yet)');
      process.exit(0);
    }
    
    // Preview top 5 players
    console.log('\n📊 Preview (top 5 by half-PPR):');
    const preview = stats
      .sort((a, b) => (b.fantasy_points_half || 0) - (a.fantasy_points_half || 0))
      .slice(0, 5);
    
    preview.forEach((p, i) => {
      console.log(
        `  ${i + 1}. ${p.player_name} (${p.position}) - ` +
        `${p.fantasy_points_half?.toFixed(1)} pts half-PPR`
      );
    });
    
    // Upsert to database
    console.log('\n💾 Upserting to weekly_stats table...');
    const result = await storage.upsertWeeklyStats(stats);
    
    console.log(`✅ Inserted/updated ${result.inserted} player records`);
    console.log('\n🎯 You can now query the data:');
    console.log(`   curl "http://localhost:5000/api/debug/week-summary?season=${season}&week=${week}&pos=RB"`);
    console.log('');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Ingest failed:', (error as Error).message);
    process.exit(1);
  }
}

main();
