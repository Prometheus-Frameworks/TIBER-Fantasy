// Test file to demonstrate smooth rank-score curves for dynasty injury multipliers
import { rankToScore, scoreToRank, adjustRankWithMultiplier } from './curves';

// Example test cases showing realistic rank transformations
export function testCurves() {
  console.log("🧮 Testing rank-score curves for dynasty injury adjustments");
  
  // Test basic transformations
  const testRanks = [1, 5, 10, 20, 50, 100, 200];
  
  console.log("\n📊 Basic rank ↔ score transformations:");
  testRanks.forEach(rank => {
    const score = rankToScore(rank);
    const backToRank = scoreToRank(score);
    console.log(`Rank ${rank} → Score ${score.toFixed(2)} → Rank ${backToRank}`);
  });
  
  // Test dynasty injury multipliers
  console.log("\n🏥 Dynasty injury adjustment examples:");
  
  const injuryScenarios = [
    { name: "Minor hamstring (young player)", k: 0.96, rank: 15 },
    { name: "ACL (prime player)", k: 0.92, rank: 8 },
    { name: "Achilles (older RB)", k: 0.70, rank: 25 },
    { name: "Concussion (QB)", k: 0.94, rank: 3 }
  ];
  
  injuryScenarios.forEach(scenario => {
    const adjustedRank = adjustRankWithMultiplier(scenario.rank, scenario.k);
    const rankDrop = adjustedRank - scenario.rank;
    console.log(`${scenario.name}: Rank ${scenario.rank} → ${adjustedRank} (drops ${rankDrop} spots with k=${scenario.k})`);
  });
  
  // Demonstrate smooth curves vs harsh division
  console.log("\n⚖️  Smooth curves vs harsh division comparison:");
  const testK = 0.85; // Significant injury penalty
  [5, 15, 30, 60].forEach(rank => {
    const smoothAdjustment = adjustRankWithMultiplier(rank, testK);
    const harshDivision = Math.round(rank / testK);
    console.log(`Rank ${rank}: Smooth=${smoothAdjustment}, Harsh=${harshDivision}, Difference=${harshDivision - smoothAdjustment}`);
  });
}

// Ready for Grok integration - maps JSON data to k values
export function mapGrokDataToMultiplier(grokData: any): number {
  // Example mapping when Grok's JSON arrives:
  // const prodDelta = grokData.year1_prod_delta || 0;
  // const agePenalty = grokData.age_penalty_per_year_over || 0;
  // return Math.max(0.5, Math.min(1.2, 1.0 + prodDelta - agePenalty));
  return 1.0; // Placeholder until Grok data arrives
}