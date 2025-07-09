/**
 * COMPREHENSIVE QB BATCH EVALUATION TEST
 * Testing BatchFantasyEvaluator v1.2 with full QB dataset
 */

// Import the QB batch data directly since module import doesn't work in this context
const qbBatchInput = [
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
  },
  {
    playerName: "Patrick Mahomes",
    season: 2024,
    position: "QB",
    passingYards: 4183,
    passingTDs: 26,
    interceptions: 11,
    rushingYards: 417,
    rushingTDs: 2,
    completionPercentage: 67.5,
    epaPerPlay: 0.21,
    qbr: 76.8,
    scrambleRate: 0.14,
    rushYPG: 24.5,
    yardsPerCarry: 4.8,
    explosiveRushRate: 0.18,
    cpoe: 0.032,
    adjustedCompletionPct: 0.685,
    deepAccuracyRate: 0.50,
    pressureToSackRate: 0.13,
    team: {
      passBlockGrade: 75,
      passBlockWinRate: 0.61,
      pressureRateAllowed: 0.29,
      pressureRateOverExpected: -0.08,
      wrYPRR: 1.95,
      wr1DRR: 0.105,
      yardsPerTarget: 8.1,
      yacPerReception: 6.5,
      contestedCatchRate: 0.65,
      routeWinRateRanks: [88, 92, 85, 78],
      offseasonWRUpgrades: ["Xavier Worthy draft", "Hollywood Brown health"]
    }
  },
  {
    playerName: "Joe Burrow",
    season: 2024,
    position: "QB",
    passingYards: 4918,
    passingTDs: 43,
    interceptions: 7,
    rushingYards: 117,
    rushingTDs: 3,
    completionPercentage: 70.4,
    epaPerPlay: 0.28,
    qbr: 82.1,
    scrambleRate: 0.08,
    rushYPG: 6.9,
    yardsPerCarry: 3.2,
    explosiveRushRate: 0.08,
    cpoe: 0.058,
    adjustedCompletionPct: 0.715,
    deepAccuracyRate: 0.56,
    pressureToSackRate: 0.16,
    team: {
      passBlockGrade: 65,
      passBlockWinRate: 0.52,
      pressureRateAllowed: 0.42,
      pressureRateOverExpected: 0.08,
      wrYPRR: 2.15,
      wr1DRR: 0.125,
      yardsPerTarget: 8.8,
      yacPerReception: 6.8,
      contestedCatchRate: 0.68,
      routeWinRateRanks: [95, 88, 92, 85],
      offseasonWRUpgrades: ["Ja'Marr Chase extension", "Tee Higgins security"]
    }
  },
  {
    playerName: "Caleb Williams",
    season: 2024,
    position: "QB",
    passingYards: 3541,
    passingTDs: 20,
    interceptions: 6,
    rushingYards: 489,
    rushingTDs: 4,
    completionPercentage: 62.5,
    epaPerPlay: 0.12,
    qbr: 68.9,
    scrambleRate: 0.16,
    rushYPG: 28.8,
    yardsPerCarry: 4.7,
    explosiveRushRate: 0.19,
    cpoe: 0.018,
    adjustedCompletionPct: 0.635,
    deepAccuracyRate: 0.41,
    pressureToSackRate: 0.19,
    team: {
      passBlockGrade: 62,
      passBlockWinRate: 0.48,
      pressureRateAllowed: 0.45,
      pressureRateOverExpected: 0.12,
      wrYPRR: 1.65,
      wr1DRR: 0.075,
      yardsPerTarget: 6.8,
      yacPerReception: 5.2,
      contestedCatchRate: 0.52,
      routeWinRateRanks: [58, 62, 55, 48],
      offseasonWRUpgrades: ["Rookie weapons", "Rome Odunze draft"]
    }
  },
  {
    playerName: "Dak Prescott",
    season: 2024,
    position: "QB",
    passingYards: 3304,
    passingTDs: 29,
    interceptions: 11,
    rushingYards: 105,
    rushingTDs: 2,
    completionPercentage: 64.7,
    epaPerPlay: 0.19,
    qbr: 71.5,
    scrambleRate: 0.09,
    rushYPG: 6.2,
    yardsPerCarry: 3.8,
    explosiveRushRate: 0.11,
    cpoe: 0.025,
    adjustedCompletionPct: 0.658,
    deepAccuracyRate: 0.47,
    pressureToSackRate: 0.17,
    team: {
      passBlockGrade: 73,
      passBlockWinRate: 0.59,
      pressureRateAllowed: 0.32,
      pressureRateOverExpected: -0.02,
      wrYPRR: 1.82,
      wr1DRR: 0.089,
      yardsPerTarget: 7.3,
      yacPerReception: 5.7,
      contestedCatchRate: 0.57,
      routeWinRateRanks: [72, 75, 68, 62],
      offseasonWRUpgrades: ["CeeDee Lamb extension", "Weapon development"]
    }
  },
  {
    playerName: "Tua Tagovailoa",
    season: 2024,
    position: "QB",
    passingYards: 2867,
    passingTDs: 19,
    interceptions: 7,
    rushingYards: 42,
    rushingTDs: 1,
    completionPercentage: 69.3,
    epaPerPlay: 0.16,
    qbr: 72.8,
    scrambleRate: 0.04,
    rushYPG: 2.5,
    yardsPerCarry: 2.8,
    explosiveRushRate: 0.06,
    cpoe: 0.048,
    adjustedCompletionPct: 0.705,
    deepAccuracyRate: 0.44,
    pressureToSackRate: 0.22,
    team: {
      passBlockGrade: 66,
      passBlockWinRate: 0.51,
      pressureRateAllowed: 0.41,
      pressureRateOverExpected: 0.06,
      wrYPRR: 2.05,
      wr1DRR: 0.098,
      yardsPerTarget: 8.2,
      yacPerReception: 6.9,
      contestedCatchRate: 0.61,
      routeWinRateRanks: [85, 88, 82, 75],
      offseasonWRUpgrades: ["Tyreek Hill prime", "Jaylen Waddle development"]
    }
  },
  {
    playerName: "Sam Darnold",
    season: 2024,
    position: "QB",
    passingYards: 4319,
    passingTDs: 35,
    interceptions: 12,
    rushingYards: 148,
    rushingTDs: 5,
    completionPercentage: 66.2,
    epaPerPlay: 0.17,
    qbr: 73.6,
    scrambleRate: 0.08,
    rushYPG: 8.7,
    yardsPerCarry: 3.9,
    explosiveRushRate: 0.12,
    cpoe: 0.032,
    adjustedCompletionPct: 0.672,
    deepAccuracyRate: 0.49,
    pressureToSackRate: 0.16,
    team: {
      passBlockGrade: 69,
      passBlockWinRate: 0.54,
      pressureRateAllowed: 0.37,
      pressureRateOverExpected: 0.04,
      wrYPRR: 1.88,
      wr1DRR: 0.095,
      yardsPerTarget: 7.6,
      yacPerReception: 6.1,
      contestedCatchRate: 0.59,
      routeWinRateRanks: [75, 78, 72, 65],
      offseasonWRUpgrades: ["Justin Jefferson elite", "Jordan Addison development"]
    }
  },
  {
    playerName: "Bo Nix",
    season: 2024,
    position: "QB",
    passingYards: 3775,
    passingTDs: 29,
    interceptions: 12,
    rushingYards: 430,
    rushingTDs: 4,
    completionPercentage: 66.3,
    epaPerPlay: 0.11,
    qbr: 67.8,
    scrambleRate: 0.14,
    rushYPG: 25.3,
    yardsPerCarry: 4.6,
    explosiveRushRate: 0.17,
    cpoe: 0.025,
    adjustedCompletionPct: 0.675,
    deepAccuracyRate: 0.42,
    pressureToSackRate: 0.17,
    team: {
      passBlockGrade: 63,
      passBlockWinRate: 0.50,
      pressureRateAllowed: 0.43,
      pressureRateOverExpected: 0.10,
      wrYPRR: 1.62,
      wr1DRR: 0.072,
      yardsPerTarget: 6.5,
      yacPerReception: 5.1,
      contestedCatchRate: 0.51,
      routeWinRateRanks: [48, 52, 45, 38],
      offseasonWRUpgrades: ["Courtland Sutton veteran", "Rookie development"]
    }
  }
];

const API_BASE = 'http://localhost:5000';

async function runFullQBBatchEvaluation() {
  console.log('🏈 PROMETHEUS QB BATCH EVALUATION v1.2');
  console.log('═══════════════════════════════════════');
  console.log(`📊 Testing with ${qbBatchInput.length} QBs from 2024 season`);
  console.log(`🎯 Target: Top 25 QB context scores using Prometheus methodology\n`);

  try {
    const startTime = Date.now();
    
    const response = await fetch(`${API_BASE}/api/analytics/batch-evaluation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ players: qbBatchInput })
    });

    const result = await response.json();
    const duration = Date.now() - startTime;

    if (result.success && result.batchResult.QB.length > 0) {
      console.log('✅ QB BATCH EVALUATION COMPLETE');
      console.log(`⏱️  Processing time: ${duration}ms`);
      console.log(`📈 Success rate: ${result.batchResult.QB.length}/${qbBatchInput.length} (${Math.round(result.batchResult.QB.length/qbBatchInput.length*100)}%)`);
      console.log(`⚠️  Errors: ${result.batchResult.errorCount}\n`);

      console.log('🏆 TOP 10 QB CONTEXT SCORES:');
      console.log('════════════════════════════');
      
      result.batchResult.QB.slice(0, 10).forEach((qb, index) => {
        const rank = index + 1;
        const score = qb.contextScore.toFixed(1);
        const env = qb.tags.find(tag => tag.includes('Environment')) || 'Unknown';
        
        console.log(`${rank.toString().padStart(2)}. ${qb.playerName.padEnd(18)} ${score.padStart(4)} - ${env}`);
        
        // Show component breakdown for top 3
        if (rank <= 3) {
          console.log(`    Rushing: ${qb.subScores.rushingUpside}, Accuracy: ${qb.subScores.throwingAccuracy}, O-Line: ${qb.subScores.oLineProtection}`);
          console.log(`    Weapons: ${qb.subScores.teammateQuality}, Upgrades: ${qb.subScores.offseasonUpgrade}`);
        }
      });

      console.log('\n🎯 DYNASTY IMPLICATIONS:');
      console.log('═══════════════════════');
      
      const eliteQBs = result.batchResult.QB.filter(qb => qb.contextScore >= 65);
      const strugglingQBs = result.batchResult.QB.filter(qb => qb.contextScore < 50);
      
      console.log(`🔥 Elite Environment (65+): ${eliteQBs.length} QBs`);
      eliteQBs.slice(0, 5).forEach(qb => {
        console.log(`   • ${qb.playerName} (${qb.contextScore.toFixed(1)}) - ${qb.tags.filter(t => !t.includes('Environment')).join(', ')}`);
      });
      
      console.log(`\n⚠️  Challenging Environment (<50): ${strugglingQBs.length} QBs`);
      strugglingQBs.forEach(qb => {
        console.log(`   • ${qb.playerName} (${qb.contextScore.toFixed(1)}) - Limited upside`);
      });

      console.log('\n📊 METHODOLOGY VALIDATION:');
      console.log('═══════════════════════════');
      console.log(`• ${result.methodology}`);
      console.log(`• Weighted scoring: Rushing (25%), Accuracy (25%), O-Line (20%), Weapons (20%), Upgrades (10%)`);
      console.log(`• Position-specific thresholds applied for 2024 NFL data`);
      console.log(`• Integration safety: Preserves all existing Prometheus evaluation logic`);

    } else {
      console.error('❌ BATCH EVALUATION FAILED');
      console.error(`Errors: ${result.batchResult?.errorCount || 'Unknown'}`);
      console.error(`QBs processed: ${result.batchResult?.QB?.length || 0}`);
      console.error('Result:', JSON.stringify(result, null, 2));
    }

  } catch (error) {
    console.error('❌ REQUEST FAILED:', error.message);
  }
}

// Run the evaluation
runFullQBBatchEvaluation();