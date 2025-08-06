/**
 * Test Batch Processing System
 * Demonstrates the RookieBatch class functionality as requested
 */

import { RookieBatch, type RookieEvaluationData } from './services/rookieEvaluationService';

async function testBatchProcessing() {
  console.log('🔄 Testing Rookie Batch Processing System');
  console.log('=========================================');

  // Create batch instance
  const batch = new RookieBatch();
  
  // Test data - top 2025 rookies
  const sampleRookies: RookieEvaluationData[] = [
    {
      name: "A. Jeanty",
      position: "RB", 
      team: "LV",
      draft_round: 1,
      draft_pick: 12,
      adp: 11.4,
      projected_points: 256.4,
      rush_yds: 1235,
      rec_yds: 319,
      rec: 43,
      rush_td: 8,
      rec_td: 2,
      rush: 280
    },
    {
      name: "T. McMillan",
      position: "WR",
      team: "CAR", 
      draft_round: 1,
      draft_pick: 33,
      adp: 62.5,
      projected_points: 201,
      rec: 77,
      rec_yds: 933,
      rec_td: 5
    },
    {
      name: "O. Hampton",
      position: "RB",
      team: "LAC",
      draft_round: 2, 
      adp: 44.4,
      projected_points: 216.4,
      rush_yds: 1039,
      rec_yds: 265,
      rec: 38,
      rush_td: 7,
      rec_td: 1,
      rush: 231
    }
  ];

  // Add rookies to batch (as per the pattern in request)
  sampleRookies.forEach(player_data => {
    batch.addRookie(player_data);
  });

  try {
    // Export as JSON for database (as requested)
    console.log('\n📦 Exporting batch as JSON for database...');
    const json_output = await batch.exportJson();
    
    // Parse to show key results
    const batchResult = JSON.parse(json_output);
    
    console.log(`\n📊 Batch Results Summary:`);
    console.log(`- Total Rookies: ${batchResult.total_rookies}`);
    console.log(`- Elite Prospects: ${batchResult.batch_summary.elite_prospects}`);
    console.log(`- Solid Prospects: ${batchResult.batch_summary.solid_prospects}`);
    console.log(`- Average Compass Score: ${batchResult.batch_summary.average_compass_score}`);
    
    console.log(`\n🏆 Individual Evaluations:`);
    batchResult.evaluations.forEach((evaluation: any, index: number) => {
      console.log(`${index + 1}. ${evaluation.player_name} (${evaluation.position})`);
      console.log(`   Compass Score: ${evaluation.compass_score} (${evaluation.tier})`);
      console.log(`   Dynasty Projection: ${evaluation.dynasty_projection}`);
    });
    
    console.log('\n✅ Batch processing system fully operational!');
    console.log(`JSON output ready for database storage (${json_output.length} chars)`);
    
    return batchResult;
    
  } catch (error) {
    console.error('❌ Batch processing error:', error);
    throw error;
  }
}

// Export for use in other modules
export { testBatchProcessing };

// Run test if called directly
if (require.main === module) {
  testBatchProcessing().catch(console.error);
}