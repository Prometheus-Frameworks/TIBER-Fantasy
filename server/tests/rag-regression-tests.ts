/**
 * RAG Chat Regression Test Suite
 * 
 * Tests critical functionality to prevent regressions:
 * 1. VORP data citation (no "I don't have data" when data is provided)
 * 2. No [Source N] citation leakage in responses
 * 3. Elite player recognition (top-12 = studs, not dart throws)
 * 4. Top performers season awareness (all chats, not just mentioned players)
 * 5. Conversational focus (answer user's question first)
 */

import axios from 'axios';

const BASE_URL = process.env.TEST_URL || 'http://localhost:5000';

interface TestResult {
  name: string;
  passed: boolean;
  message: string;
  response?: string;
}

const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
};

function log(color: string, message: string) {
  console.log(`${color}${message}${colors.reset}`);
}

async function testRAGChat(message: string, user_level: number = 3): Promise<string> {
  try {
    const response = await axios.post(`${BASE_URL}/api/rag/chat`, {
      message,
      user_level,
    }, {
      timeout: 30000, // 30 second timeout
    });
    
    return response.data.response || '';
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(`API Error: ${error.message}`);
    }
    throw error;
  }
}

// Test 1: VORP Data Citation (Mentioned Players)
async function testVORPCitation(): Promise<TestResult> {
  const message = "Should I start Josh Jacobs or Jaylen Warren?";
  const response = await testRAGChat(message);
  
  // Check that both players are detected and cited with rank
  const hasJacobs = response.includes('Josh Jacobs') && response.match(/RB\d+/);
  const hasWarren = response.includes('Jaylen Warren') && response.match(/RB\d+/);
  const hasPPG = response.includes('PPG');
  
  const passed = hasJacobs && hasWarren && hasPPG;
  
  return {
    name: 'VORP Citation (Mentioned Players)',
    passed,
    message: passed 
      ? '✓ Both players cited with rank and PPG' 
      : '✗ Missing player ranks or PPG data',
    response,
  };
}

// Test 2: No [Source N] Leakage
async function testNoSourceLeakage(): Promise<TestResult> {
  const message = "Tell me about Emeka Egbuka";
  const response = await testRAGChat(message);
  
  const hasSourceTag = response.match(/\[Source \d+\]/i);
  const passed = !hasSourceTag;
  
  return {
    name: 'No [Source N] Leakage',
    passed,
    message: passed 
      ? '✓ Clean natural language, no source tags' 
      : `✗ Found source tag: ${hasSourceTag?.[0]}`,
    response,
  };
}

// Test 3: Elite Player Recognition
async function testEliteRecognition(): Promise<TestResult> {
  const message = "Is Josh Jacobs a stud?";
  const response = await testRAGChat(message);
  
  // Check that RB5 is recognized as elite/high-end, not "dart throw" or "speculative"
  const hasEliteLanguage = response.match(/(elite|high-end|RB1|stud|must-start)/i);
  const hasDartThrow = response.match(/(dart throw|speculative|risky|gamble)/i);
  const passed = hasEliteLanguage && !hasDartThrow;
  
  return {
    name: 'Elite Player Recognition',
    passed,
    message: passed 
      ? '✓ RB5 correctly recognized as elite' 
      : '✗ Top-12 player not recognized as elite',
    response,
  };
}

// Test 4: Top Performers Season Awareness (No Player Mentions)
async function testSeasonAwareness(): Promise<TestResult> {
  const message = "Who are the best RBs this season?";
  const response = await testRAGChat(message);
  
  // Check that response mentions multiple RBs with specific names and ranks
  const hasSpecificPlayers = response.match(/RB\d+/g);
  const hasMultiplePlayers = hasSpecificPlayers && hasSpecificPlayers.length >= 3;
  const hasPPG = response.includes('PPG');
  
  const passed = hasMultiplePlayers && hasPPG;
  
  return {
    name: 'Top Performers Season Awareness',
    passed,
    message: passed 
      ? `✓ Full season awareness (${hasSpecificPlayers?.length} players mentioned)` 
      : '✗ Missing season leaders context',
    response,
  };
}

// Test 5: Conversational Focus (Answer Question First)
async function testConversationalFocus(): Promise<TestResult> {
  const message = "Should I start Josh Jacobs or Jaylen Warren?";
  const response = await testRAGChat(message);
  
  // Check that the first sentence/paragraph addresses the specific comparison
  const firstParagraph = response.split('\n\n')[0];
  const mentionsBoth = firstParagraph.includes('Jacobs') && firstParagraph.includes('Warren');
  const wordCount = response.split(/\s+/).length;
  const notTooLong = wordCount < 400; // Should be focused, not rambling
  
  const passed = mentionsBoth && notTooLong;
  
  return {
    name: 'Conversational Focus',
    passed,
    message: passed 
      ? `✓ Direct answer (${wordCount} words)` 
      : `✗ Unfocused or too long (${wordCount} words)`,
    response,
  };
}

// Test 6: Player Detection Edge Case (Multiple Players)
async function testMultiplePlayerDetection(): Promise<TestResult> {
  const message = "Rank Josh Jacobs, Jaylen Warren, and Bijan Robinson for me";
  const response = await testRAGChat(message);
  
  // Check that at least 2 of 3 players are detected and discussed
  const hasJacobs = response.includes('Jacobs');
  const hasWarren = response.includes('Warren');
  const hasRobinson = response.includes('Robinson');
  const detectedCount = [hasJacobs, hasWarren, hasRobinson].filter(Boolean).length;
  
  const passed = detectedCount >= 2;
  
  return {
    name: 'Multiple Player Detection',
    passed,
    message: passed 
      ? `✓ Detected ${detectedCount}/3 players` 
      : `✗ Only detected ${detectedCount}/3 players`,
    response,
  };
}

// Test 7: No Hallucination (Data-Backed Claims)
async function testNoHallucination(): Promise<TestResult> {
  const message = "What is Josh Jacobs' rank this season?";
  const response = await testRAGChat(message);
  
  // Check that response includes specific rank (RB5) with actual stats
  const hasRank = response.match(/RB\d+/);
  const hasStats = response.includes('PPG') || response.includes('VORP') || response.includes('pts');
  const passed = hasRank && hasStats;
  
  return {
    name: 'No Hallucination (Data-Backed)',
    passed,
    message: passed 
      ? `✓ Cited specific rank and stats` 
      : '✗ Missing concrete data',
    response,
  };
}

// Test 8: Replacement Level Recognition
async function testReplacementLevel(): Promise<TestResult> {
  const message = "Is Jaylen Warren a good start?";
  const response = await testRAGChat(message);
  
  // Check that RB21 is acknowledged as replacement level, not elite
  const hasReplacementLanguage = response.match(/(replacement|flex|RB2|marginal|backup)/i);
  const hasEliteLanguage = response.match(/(elite|must-start|RB1|stud.*Warren)/i);
  const passed = hasReplacementLanguage && !hasEliteLanguage;
  
  return {
    name: 'Replacement Level Recognition',
    passed,
    message: passed 
      ? '✓ RB21 correctly identified as replacement level' 
      : '✗ Replacement player incorrectly hyped',
    response,
  };
}

// Test 9: Banned Metric Refusal (Snap Share)
async function testBannedMetricSnapShare(): Promise<TestResult> {
  const message = "What's Christian McCaffrey's snap share this season?";
  const response = await testRAGChat(message);
  
  // Should refuse snap share and provide ANY available data (rank OR PPG OR VORP)
  const refusesSnapShare = response.match(/don't have.*snap|can't verify.*snap|no.*snap.*data/i);
  const providesAnyAvailableData = response.match(/RB\d+|PPG|VORP/i);
  const doesNotInventSnapShare = !response.match(/\d+%.*snap|\d+ percent.*snap/i);
  
  const passed = refusesSnapShare && providesAnyAvailableData && doesNotInventSnapShare;
  
  return {
    name: 'Banned Metric Refusal (Snap Share)',
    passed,
    message: passed 
      ? '✓ Refused snap share, provided available data' 
      : '✗ Either invented snap share or failed to provide alternatives',
    response,
  };
}

// Test 10: Banned Metric Refusal (YPC)
async function testBannedMetricYPC(): Promise<TestResult> {
  const message = "How's Josh Jacobs' yards per carry trending?";
  const response = await testRAGChat(message);
  
  // Should refuse YPC and provide ANY available data (rank OR PPG OR VORP)
  const refusesYPC = response.match(/don't have.*(YPC|yards per carry)|can't verify.*(YPC|yards per carry)|no.*(YPC|yards per carry).*data/i);
  const providesAnyRanking = response.match(/RB\d+|PPG|VORP/i);
  const doesNotInventYPC = !response.match(/\d+\.\d+.*(YPC|yards per carry)|yards per carry.*\d+\.\d+/i);
  
  const passed = refusesYPC && providesAnyRanking && doesNotInventYPC;
  
  return {
    name: 'Banned Metric Refusal (YPC)',
    passed,
    message: passed 
      ? '✓ Refused YPC, provided ranking instead' 
      : '✗ Either invented YPC or failed to refuse',
    response,
  };
}

// Test 11: User Fake Stats Rejection
async function testFakeStatsRejection(): Promise<TestResult> {
  const message = "McCaffrey's snap share dropped from 89% to 76%, right?";
  const response = await testRAGChat(message);
  
  // Should NOT affirm the fake stats (allow quoting for rebuttal)
  const doesNotAffirmFakeStats = !response.match(/(yes|correct|right|that's accurate|confirmed).*89.*76|89.*76.*(yes|correct|right|accurate)/i);
  const refusesVerification = response.match(/can't verify|don't have.*snap|no.*snap.*data/i);
  const providesRealData = response.match(/RB\d+|PPG|VORP/i);
  
  const passed = doesNotAffirmFakeStats && refusesVerification && providesRealData;
  
  return {
    name: 'User Fake Stats Rejection',
    passed,
    message: passed 
      ? '✓ Refused to affirm fake stats, provided real data' 
      : '✗ Affirmed user\'s unverified stats as facts',
    response,
  };
}

// Test 12: Data Boundary Consistency
async function testDataBoundaryConsistency(): Promise<TestResult> {
  const message = "Tell me about Josh Jacobs - his target share, snap rate, and touches per game";
  const response = await testRAGChat(message);
  
  // Should explicitly refuse ALL three banned metrics
  const refusesTargetShare = response.match(/don't have.*(target|targ)/i) || !response.match(/target share.*\d+%/i);
  const refusesSnapRate = response.match(/don't have.*snap/i) || !response.match(/snap.*\d+%/i);
  const refusesTouches = response.match(/don't have.*touches/i) || !response.match(/touches.*\d+\.?\d*/i);
  const providesVORPData = response.match(/RB\d+|PPG|VORP/i);
  
  const passed = refusesTargetShare && refusesSnapRate && refusesTouches && providesVORPData;
  
  return {
    name: 'Data Boundary Consistency',
    passed,
    message: passed 
      ? '✓ Consistently refused all banned metrics, provided VORP data' 
      : '✗ Invented stats for one or more banned metrics',
    response,
  };
}

// Test 13: Fake Ranking Correction
async function testFakeRankingCorrection(): Promise<TestResult> {
  const message = "I heard Justin Jefferson is WR30 this year";
  const response = await testRAGChat(message);
  
  // Should correct the fake ranking with real data
  const correctsRanking = response.match(/actually|Jefferson is WR\d+|not WR30/i);
  const providesRealRank = response.match(/WR1[0-9]|WR[1-9]\b/i) && !response.match(/WR30/);
  const doesNotAffirmFake = !response.match(/(yes|correct|right).*WR30|WR30.*(yes|correct|right)/i);
  
  const passed = correctsRanking && providesRealRank && doesNotAffirmFake;
  
  return {
    name: 'Fake Ranking Correction',
    passed,
    message: passed 
      ? '✓ Corrected fake ranking with real data' 
      : '✗ Failed to correct or affirmed fake ranking',
    response,
  };
}

// Main test runner
async function runTests() {
  log(colors.blue, '\n🧪 Starting RAG Chat Regression Tests...\n');
  
  const tests = [
    testVORPCitation,
    testNoSourceLeakage,
    testEliteRecognition,
    testSeasonAwareness,
    testConversationalFocus,
    testMultiplePlayerDetection,
    testNoHallucination,
    testReplacementLevel,
    testBannedMetricSnapShare,
    testBannedMetricYPC,
    testFakeStatsRejection,
    testDataBoundaryConsistency,
    testFakeRankingCorrection,
  ];
  
  const results: TestResult[] = [];
  let passCount = 0;
  
  for (const test of tests) {
    try {
      log(colors.yellow, `Running: ${test.name}...`);
      const result = await test();
      results.push(result);
      
      if (result.passed) {
        passCount++;
        log(colors.green, `  ${result.message}`);
      } else {
        log(colors.red, `  ${result.message}`);
        if (process.env.VERBOSE) {
          console.log(`  Response: ${result.response?.substring(0, 200)}...`);
        }
      }
    } catch (error) {
      log(colors.red, `  ✗ Error: ${(error as Error).message}`);
      results.push({
        name: test.name,
        passed: false,
        message: `Error: ${(error as Error).message}`,
      });
    }
    
    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  // Summary
  log(colors.blue, `\n📊 Test Summary:`);
  log(colors.blue, `  Total: ${tests.length}`);
  log(colors.green, `  Passed: ${passCount}`);
  log(colors.red, `  Failed: ${tests.length - passCount}`);
  
  const passRate = ((passCount / tests.length) * 100).toFixed(1);
  if (passCount === tests.length) {
    log(colors.green, `\n✅ All tests passed! (${passRate}%)\n`);
    process.exit(0);
  } else {
    log(colors.red, `\n❌ Some tests failed (${passRate}%)\n`);
    process.exit(1);
  }
}

// Run tests
runTests().catch(error => {
  log(colors.red, `\n💥 Fatal error: ${error.message}\n`);
  process.exit(1);
});
