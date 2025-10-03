import { buildStartSitPlayerProfile } from "./dataAssembler";

async function testDataAssembler() {
  console.log("=== Testing Start/Sit Data Assembler ===\n");
  
  // Test 1: NFL-data-py ID lookup (Courtland Sutton)
  console.log("Test 1: Courtland Sutton (NFL-data-py ID: 00-0034348) vs DEN");
  const sutton = await buildStartSitPlayerProfile("00-0034348", 5, "DEN", 2024);
  console.log(JSON.stringify(sutton, null, 2));
  console.log("\n---\n");
  
  // Test 2: Name-based lookup (Justin Jefferson)
  console.log("Test 2: Justin Jefferson (name lookup) vs GB");
  const jefferson = await buildStartSitPlayerProfile("Justin Jefferson", 5, "GB", 2024);
  console.log(JSON.stringify(jefferson, null, 2));
  console.log("\n---\n");
  
  // Test 3: Canonical ID lookup (if available)
  console.log("Test 3: ja-marr-chase (canonical ID) vs BAL");
  const chase = await buildStartSitPlayerProfile("ja-marr-chase", 5, "BAL", 2024);
  console.log(JSON.stringify(chase, null, 2));
  console.log("\n---\n");
  
  // Test 4: Player not found
  console.log("Test 4: Invalid player");
  const invalid = await buildStartSitPlayerProfile("ZZZZZ", 5, "KC", 2024);
  console.log(invalid ? "Found (unexpected)" : "Not found (expected)");
  
  process.exit(0);
}

testDataAssembler().catch(err => {
  console.error("Test failed:", err);
  process.exit(1);
});
