#!/usr/bin/env tsx

/*
 * ECR Pipeline Test Script
 * ------------------------
 * Direct test of the ECR pipeline functionality
 */

import { runEcrPipelineSanityCheck } from "../server/services/ecrPipelineService";

async function main() {
  console.log("🚀 Starting ECR Pipeline Test\n");
  
  try {
    const result = await runEcrPipelineSanityCheck();
    
    console.log("✅ ECR Pipeline Test Results:");
    console.log("=============================");
    console.log(`Week: ${result.summary.week}`);
    console.log(`ECR Data Loaded: ${result.summary.ecr_loaded} players`);
    console.log(`Market Signals: ${result.summary.market_signals} players`);
    console.log(`Features Built: ${result.summary.features_built} player feature vectors`);
    
    console.log("\n📊 Sample Feature Vectors:");
    console.log("---------------------------");
    result.features.slice(0, 3).forEach((feature, index) => {
      console.log(`${index + 1}. ${feature.name} (${feature.team} ${feature.pos})`);
      console.log(`   ECR Rank: ${feature.ecr_rank}, ECR Points: ${feature.ecr_points}`);
      console.log(`   NORTH - Target Share: ${feature.target_share}, Red Zone Opps: ${feature.red_zone_opps}`);
      console.log(`   EAST - Team PROE: ${feature.team_proe}, Pace: ${feature.pace_overall}`);
      console.log(`   SOUTH - Age: ${feature.age}, Weather Risk: ${feature.weather_risk}`);
      console.log(`   WEST - ADP Movement: ${feature.adp_movement_7d}, Start% Delta: ${feature.start_pct_delta}`);
      console.log("");
    });
    
    console.log("🎉 ECR Pipeline Integration Complete!");
    console.log("🔗 Integration Status: READY for production ECR data sources");
    console.log("📈 Next Steps: Replace mock data with real Fantasy Pros CSV / Sleeper API calls");
    
  } catch (error) {
    console.error("❌ ECR Pipeline Test Failed:", error);
    process.exit(1);
  }
}

// Run directly when executed
main();

export { main as testEcrPipeline };