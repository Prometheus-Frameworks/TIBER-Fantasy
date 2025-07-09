/**
 * Test script to run QB batch evaluation with our top QB input
 */

const testQBs = [
  {
    playerName: "Josh Allen",
    season: 2024,
    position: "QB",
    passingYards: 4306,
    passingTDs: 28,
    interceptions: 6,
    rushingYards: 553,
    rushingTDs: 15,
    completionPercentage: 63.6,
    epaPerPlay: 0.25,
    qbr: 81.2,
    scrambleRate: 0.18,
    rushYPG: 32.5,
    yardsPerCarry: 4.2,
    explosiveRushRate: 0.22,
    cpoe: 0.025,
    adjustedCompletionPct: 0.645,
    deepAccuracyRate: 0.48,
    pressureToSackRate: 0.15,
    team: {
      passBlockGrade: 78,
      passBlockWinRate: 0.62,
      pressureRateAllowed: 0.31,
      pressureRateOverExpected: -0.05,
      wrYPRR: 1.85,
      wr1DRR: 0.095,
      yardsPerTarget: 7.2,
      yacPerReception: 5.8,
      contestedCatchRate: 0.58,
      routeWinRateRanks: [75, 82, 68, 55],
      offseasonWRUpgrades: ["Amari Cooper trade", "Keon Coleman draft"]
    }
  },
  {
    playerName: "Lamar Jackson",
    season: 2024,
    position: "QB",
    passingYards: 3678,
    passingTDs: 40,
    interceptions: 4,
    rushingYards: 915,
    rushingTDs: 3,
    completionPercentage: 66.7,
    epaPerPlay: 0.32,
    qbr: 85.4,
    scrambleRate: 0.25,
    rushYPG: 53.8,
    yardsPerCarry: 5.6,
    explosiveRushRate: 0.31,
    cpoe: 0.045,
    adjustedCompletionPct: 0.678,
    deepAccuracyRate: 0.52,
    pressureToSackRate: 0.12,
    team: {
      passBlockGrade: 72,
      passBlockWinRate: 0.58,
      pressureRateAllowed: 0.35,
      pressureRateOverExpected: 0.02,
      wrYPRR: 1.92,
      wr1DRR: 0.088,
      yardsPerTarget: 7.8,
      yacPerReception: 6.2,
      contestedCatchRate: 0.62,
      routeWinRateRanks: [68, 75, 72, 58],
      offseasonWRUpgrades: ["Zay Flowers development", "Tight end upgrade"]
    }
  },
  {
    playerName: "Jayden Daniels",
    season: 2024,
    position: "QB",
    passingYards: 3568,
    passingTDs: 25,
    interceptions: 9,
    rushingYards: 891,
    rushingTDs: 6,
    completionPercentage: 69.0,
    epaPerPlay: 0.23,
    qbr: 78.5,
    scrambleRate: 0.22,
    rushYPG: 52.4,
    yardsPerCarry: 5.3,
    explosiveRushRate: 0.28,
    cpoe: 0.038,
    adjustedCompletionPct: 0.695,
    deepAccuracyRate: 0.45,
    pressureToSackRate: 0.11,
    team: {
      passBlockGrade: 68,
      passBlockWinRate: 0.55,
      pressureRateAllowed: 0.38,
      pressureRateOverExpected: 0.05,
      wrYPRR: 1.78,
      wr1DRR: 0.082,
      yardsPerTarget: 6.9,
      yacPerReception: 5.4,
      contestedCatchRate: 0.55,
      routeWinRateRanks: [62, 68, 65, 52],
      offseasonWRUpgrades: ["Rookie development", "Terry McLaurin security"]
    }
  }
];

console.log('Testing QB Batch Evaluation with top 3 QBs...');
console.log(`Input: ${testQBs.length} QBs (${testQBs.map(q => q.playerName).join(', ')})`);

// Test the batch evaluator
async function testBatch() {
  try {
    const response = await fetch('http://localhost:5000/api/analytics/batch-evaluation', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ players: testQBs })
    });

    const result = await response.json();
    
    if (result.success) {
      console.log('\n✅ QB Batch Evaluation Complete:');
      console.log(`Total Evaluated: ${result.batchResult.totalEvaluated}`);
      console.log(`QBs Processed: ${result.batchResult.QB.length}`);
      console.log(`Errors: ${result.batchResult.errorCount}`);
      
      result.batchResult.QB.forEach((qb, index) => {
        console.log(`\n${index + 1}. ${qb.playerName} - Score: ${qb.contextScore}`);
        console.log(`   Sub-scores: ${JSON.stringify(qb.subScores, null, 2)}`);
        console.log(`   Tags: ${qb.tags.join(', ')}`);
        console.log(`   Top logs: ${qb.logs.slice(0, 3).join('; ')}`);
      });
    } else {
      console.error('❌ Batch evaluation failed:', result.error);
    }
  } catch (error) {
    console.error('❌ Request failed:', error.message);
  }
}

testBatch();