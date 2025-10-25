/**
 * Import Snap Counts Script
 * Fetches and imports NFLfast R snap count data for 2025 season
 */
import { snapCountService } from '../services/snapCountService';

async function importSnapCounts() {
  console.log('🏈 Starting Snap Counts Import for 2025...');
  console.log('=' .repeat(60));
  
  try {
    // Fetch snap counts for 2025
    const records = await snapCountService.fetchSnapCounts([2025]);
    
    console.log(`\n📊 Summary:`);
    console.log(`  Total records: ${records.length}`);
    
    // Show breakdown by position
    const byPosition = records.reduce((acc, r) => {
      acc[r.position] = (acc[r.position] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    console.log(`\n  By position:`);
    Object.entries(byPosition)
      .sort(([, a], [, b]) => b - a)
      .forEach(([pos, count]) => {
        console.log(`    ${pos}: ${count}`);
      });
    
    // Show weeks available
    const weeks = [...new Set(records.map(r => r.week))].sort((a, b) => a - b);
    console.log(`\n  Weeks available: ${weeks.join(', ')}`);
    
    // Import to database
    await snapCountService.importSnapCounts(records);
    
    // Show sample data for verification
    console.log(`\n📋 Sample WR snap data (Week 7):`);
    const week7WRs = records
      .filter(r => r.week === 7 && r.position === 'WR' && r.offensePct > 0.5)
      .sort((a, b) => b.offensePct - a.offensePct)
      .slice(0, 10);
    
    week7WRs.forEach(wr => {
      const pct = (wr.offensePct * 100).toFixed(0);
      console.log(`  ${wr.player} (${wr.team}): ${pct}% snaps (${wr.offenseSnaps})`);
    });
    
    console.log('\n✅ Snap counts import complete!');
    
  } catch (error) {
    console.error('❌ Import failed:', error);
    process.exit(1);
  }
}

export { importSnapCounts };

// Run if executed directly
importSnapCounts()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
