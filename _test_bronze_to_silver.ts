/**
 * Test Bronze → Silver Processing
 *
 * This script tests the Bronze-to-Silver ETL processing by:
 * 1. Finding a small batch of PENDING Bronze payloads
 * 2. Processing them through the SilverLayerService
 * 3. Verifying the results and updating payload statuses
 */

import { db } from './server/infra/db';
import { bronzeLayerService } from './server/services/BronzeLayerService';
import { silverLayerService } from './server/services/SilverLayerService';

async function testBronzeToSilver() {
  console.log("=".repeat(60));
  console.log("BRONZE → SILVER PROCESSING TEST");
  console.log("=".repeat(60));
  console.log();

  try {
    // Step 1: Check current Bronze payload status
    console.log("Step 1: Checking Bronze payload inventory...");
    const stats = await bronzeLayerService.getDataSourceStats();

    console.log("\nBronze Layer Status:");
    console.log("Source       | Total | Pending | Success | Failed");
    console.log("-".repeat(55));
    for (const stat of stats) {
      console.log(
        `${stat.source.padEnd(12)} | ${String(stat.totalPayloads).padEnd(5)} | ${String(stat.pendingPayloads).padEnd(7)} | ${String(stat.successfulPayloads).padEnd(7)} | ${stat.failedPayloads}`
      );
    }

    // Step 2: Get a small batch of PENDING payloads to process
    const testBatchSize = 10;
    console.log(`\nStep 2: Fetching ${testBatchSize} PENDING payloads for testing...`);

    const pendingPayloads = await bronzeLayerService.getRawPayloads({
      status: 'PENDING',
      limit: testBatchSize
    });

    if (pendingPayloads.length === 0) {
      console.log("⚠️ No PENDING payloads found to process");
      return;
    }

    console.log(`✅ Found ${pendingPayloads.length} PENDING payloads`);
    console.log("\nPayload Details:");
    pendingPayloads.forEach((p, i) => {
      console.log(`  ${i + 1}. ID: ${p.id} | Source: ${p.source} | Endpoint: ${p.endpoint} | Records: ${p.recordCount || 0}`);
    });

    // Step 3: Process the payloads using SilverLayerService
    console.log(`\nStep 3: Processing payloads through SilverLayerService...`);
    const payloadIds = pendingPayloads.map(p => p.id);

    const startTime = Date.now();
    const result = await silverLayerService.processBronzeToSilver(payloadIds);

    // Update payload statuses based on processing results
    if (result.success > 0) {
      const successfulPayloadIds = payloadIds.filter(id =>
        !result.errorDetails.some(err => err.payloadId === id)
      );
      if (successfulPayloadIds.length > 0) {
        await bronzeLayerService.updateBatchPayloadStatus(successfulPayloadIds, 'SUCCESS');
        console.log(`📝 Marked ${successfulPayloadIds.length} payloads as SUCCESS`);
      }
    }

    if (result.errorDetails.length > 0) {
      for (const error of result.errorDetails) {
        await bronzeLayerService.updatePayloadStatus(error.payloadId, 'FAILED', error.error);
      }
      console.log(`📝 Marked ${result.errorDetails.length} payloads as FAILED`);
    }

    const duration = Date.now() - startTime;

    // Step 4: Display results
    console.log("\n" + "=".repeat(60));
    console.log("PROCESSING RESULTS");
    console.log("=".repeat(60));
    console.log(`Duration: ${duration}ms`);
    console.log(`Processed: ${result.processed}`);
    console.log(`Success: ${result.success}`);
    console.log(`Errors: ${result.errors}`);
    console.log(`Skipped: ${result.skipped}`);
    console.log();

    console.log("Table Results:");
    console.log(`  Players Created: ${result.tableResults.playersCreated}`);
    console.log(`  Players Updated: ${result.tableResults.playersUpdated}`);
    console.log(`  Teams Created: ${result.tableResults.teamsCreated}`);
    console.log(`  Teams Updated: ${result.tableResults.teamsUpdated}`);
    console.log(`  Market Signals Created: ${result.tableResults.marketSignalsCreated}`);
    console.log(`  Injuries Created: ${result.tableResults.injuriesCreated}`);
    console.log(`  Depth Charts Created: ${result.tableResults.depthChartsCreated}`);

    if (result.errorDetails.length > 0) {
      console.log("\nErrors:");
      result.errorDetails.forEach((err, i) => {
        console.log(`  ${i + 1}. Payload ${err.payloadId}: ${err.error}`);
      });
    }

    // Step 5: Verify updated payload statuses
    console.log("\nStep 5: Verifying updated payload statuses...");
    const updatedStats = await bronzeLayerService.getDataSourceStats();

    console.log("\nUpdated Bronze Layer Status:");
    console.log("Source       | Total | Pending | Success | Failed");
    console.log("-".repeat(55));
    for (const stat of updatedStats) {
      console.log(
        `${stat.source.padEnd(12)} | ${String(stat.totalPayloads).padEnd(5)} | ${String(stat.pendingPayloads).padEnd(7)} | ${String(stat.successfulPayloads).padEnd(7)} | ${stat.failedPayloads}`
      );
    }

    console.log("\n" + "=".repeat(60));
    console.log("TEST COMPLETE");
    console.log("=".repeat(60));

  } catch (error) {
    console.error("\n❌ TEST FAILED:");
    console.error(error);
    process.exit(1);
  }

  process.exit(0);
}

testBronzeToSilver().catch(e => {
  console.error("Fatal error:", e);
  process.exit(1);
});
