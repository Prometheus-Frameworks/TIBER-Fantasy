// Quick verification of Grok's calculation - Manual test
console.log("=== GROK'S AYOMANOR CALCULATION VERIFICATION ===");

// Step 1: Usage Growth Calculation
const dSnap = Math.max(0, 65 - 45) / 100; // 0.20
const dRoutes = Math.max(0, 35 - 25) / Math.max(10, 25); // 10/25 = 0.40  
const dTargets = Math.max(0, 8 - 5) / Math.max(6, 5); // 3/6 = 0.50
const usageGrowth = (dSnap + dRoutes + dTargets) / 3; // 0.37

console.log("Step 1 - Usage Growth:");
console.log(`  Snap delta: ${dSnap.toFixed(3)}`);
console.log(`  Routes delta: ${dRoutes.toFixed(3)}`);
console.log(`  Targets delta: ${dTargets.toFixed(3)}`);
console.log(`  Average: ${usageGrowth.toFixed(3)}`);

// Step 2: Opportunity Delta
const injuryOpening = 0.5; // Jefferson tweaked ankle
const depthImprove = (4 - 3) / 5; // Moved up one spot, max depth 5
const opportunityDelta = Math.min(1, injuryOpening + depthImprove); // 0.70

console.log("\nStep 2 - Opportunity Delta:");
console.log(`  Injury opening: ${injuryOpening}`);
console.log(`  Depth improvement: ${depthImprove}`);
console.log(`  Total: ${opportunityDelta.toFixed(3)}`);

// Step 3: Market Lag  
const rostershipGap = (0.60 - 0.45) * 2; // Expected 60% for 65% snaps, amplified
const adpLag = Math.abs(-15) / 50; // ADP fell 15 spots out of 50 max
const startLag = 0.20; // Start % too low
const marketLag = (rostershipGap + adpLag + startLag) / 3; // 0.27

console.log("\nStep 3 - Market Lag:");
console.log(`  Rostership gap: ${rostershipGap.toFixed(3)}`);
console.log(`  ADP lag: ${adpLag.toFixed(3)}`);
console.log(`  Start lag: ${startLag.toFixed(3)}`);
console.log(`  Average: ${marketLag.toFixed(3)}`);

// Step 4: News Weight (given)
const newsWeight = 0.70; // Strong coach quote
console.log("\nStep 4 - News Weight:");
console.log(`  Coach quote strength: ${newsWeight}`);

// Step 5: Final Waiver Heat Calculation
const component1 = 0.40 * usageGrowth; // Usage: 40%
const component2 = 0.30 * opportunityDelta; // Opportunity: 30%  
const component3 = 0.20 * marketLag; // Market: 20%
const component4 = 0.10 * newsWeight; // News: 10%
const totalScore = component1 + component2 + component3 + component4;
const waiverHeat = Math.round(totalScore * 100);

console.log("\nStep 5 - Final Calculation:");
console.log(`  Usage component (40%): ${component1.toFixed(3)}`);
console.log(`  Opportunity component (30%): ${component2.toFixed(3)}`);
console.log(`  Market component (20%): ${component3.toFixed(3)}`);
console.log(`  News component (10%): ${component4.toFixed(3)}`);
console.log(`  Total score: ${totalScore.toFixed(3)}`);
console.log(`  Waiver Heat: ${waiverHeat}/100`);

console.log("\n=== VERIFICATION ===");
console.log(`Expected (Grok): 48/100`);
console.log(`Calculated: ${waiverHeat}/100`);
console.log(`Match: ${waiverHeat === 48 ? 'YES ✅' : 'NO ❌'}`);
console.log(`Interpretation: ${waiverHeat >= 50 ? 'Strong waiver add' : waiverHeat >= 30 ? 'Warm waiver add' : 'Monitor'}`);

// Analysis
if (waiverHeat === 48) {
  console.log("\n🎯 SUCCESS: Our calculation EXACTLY matches Grok's expectation!");
  console.log("The Waiver Heat formula is mathematically verified.");
} else {
  console.log(`\n⚠️  DIFFERENCE: Off by ${Math.abs(waiverHeat - 48)} points`);
  console.log("Need to review calculation components.");
}