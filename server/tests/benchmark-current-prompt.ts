/**
 * STEP 1: BENCHMARK CURRENT PROMPT
 * 
 * Comprehensive test suite to establish baseline performance of current system prompt.
 * Tests: Layer routing, epistemic violations, subject tracking, voice consistency
 */

import { generateChatResponse } from '../services/geminiEmbeddings';
import { detectLayer } from '../services/river-detection';

// Mock VORP context for testing
const MOCK_VORP_CONTEXT = [
  `**2025 Season Performance**
**Jonathan Taylor (RB1)**: 24.2 PPG, +150.2 VORP, 11 games (IND)
**Christian McCaffrey (RB2)**: 18.0 PPG, +99.7 VORP, 11 games (SF)
**De'Von Achane (RB3)**: 16.4 PPG, +85.3 VORP, 11 games (MIA)
**Jahmyr Gibbs (RB4)**: 16.9 PPG, +88.1 VORP, 11 games (DET)
**Josh Jacobs (RB5)**: 16.7 PPG, +73.2 VORP, 11 games (GB)
**George Kittle (TE6)**: 8.0 PPG, +25.4 VORP, 11 games (SF)`
];

// Mock context with unavailable metrics (testing epistemic boundaries)
const MOCK_CONTEXT_WITH_BANNED_METRICS = [
  `**2025 Season Performance**
**Christian McCaffrey (RB2)**: 18.0 PPG, +99.7 VORP, 11 games (SF)

**Analysis Note**: McCaffrey's snap share in competitive games has dropped from 89% to 76% over the past 3 weeks. His YPC also decreased from 5.1 (Weeks 1-6) to 4.3 (Weeks 7-9). While maintaining elite touch rate (24.3 per game), these underlying metrics could foreshadow future workload reduction.

In 2024, McCaffrey posted 1459 rushing yards, 14 TDs, and 1106 receiving yards.`
];

interface TestResult {
  category: string;
  test: string;
  status: 'PASS' | 'FAIL';
  violation?: string;
  response?: string;
  promptSection?: string;
}

const results: TestResult[] = [];

console.log('═══════════════════════════════════════════════════════════════');
console.log('STEP 1: BENCHMARK CURRENT PROMPT');
console.log('═══════════════════════════════════════════════════════════════\n');

// ═══════════════════════════════════════════════════════════════
// TEST CATEGORY 1: USER'S CMC CONVERSATION (Real-world Failure Case)
// ═══════════════════════════════════════════════════════════════

async function testCMCConversation() {
  console.log('━━━ CATEGORY 1: CMC CONVERSATION (Real Failure Case) ━━━\n');
  
  // Test 1: "who are the best RBs this season"
  const q1 = "who are the best RBs this season";
  const r1 = await generateChatResponse(q1, MOCK_CONTEXT_WITH_BANNED_METRICS, 3, false);
  
  // Check for epistemic violations
  const hasSnapShareClaim = /snap share.*\d+%|snap share.*to.*\d+%/i.test(r1);
  const hasYPCClaim = /ypc.*\d+\.\d+|ypc.*to.*\d+\.\d+/i.test(r1);
  
  if (hasSnapShareClaim || hasYPCClaim) {
    results.push({
      category: 'CMC Conversation',
      test: 'Best RBs query',
      status: 'FAIL',
      violation: `Claimed unavailable metrics: ${hasSnapShareClaim ? 'snap share %' : ''} ${hasYPCClaim ? 'YPC values' : ''}`,
      response: r1.substring(0, 200),
      promptSection: 'CRITICAL DATA BOUNDARIES - epistemic rules not enforced'
    });
    console.log(`❌ FAIL: Best RBs query`);
    console.log(`   Violation: Claimed ${hasSnapShareClaim ? 'snap share %' : ''} ${hasYPCClaim ? 'YPC values' : ''}`);
    console.log(`   Response: "${r1.substring(0, 150)}..."`);
  } else {
    results.push({
      category: 'CMC Conversation',
      test: 'Best RBs query',
      status: 'PASS',
      response: r1.substring(0, 200)
    });
    console.log(`✅ PASS: Best RBs query - No epistemic violations`);
  }
  console.log();
  
  // Test 2: Subject tracking - "he is top 8 in receiving yards" (about CMC, not Kittle)
  const q2 = "the 49ers are 6-4 and have a tough division, so health permitted he is a locked and loaded top 2/3 player in the game. he is (im pretty sure) top 8 in receiving yards, including WRs. he looks really sharp and healthy so let us hope it holds. i hate seeing guys go down injured";
  const conversationContext = [
    ...MOCK_VORP_CONTEXT,
    `Previous conversation context: User asked about best RBs. TIBER mentioned Christian McCaffrey (RB2). User is now discussing McCaffrey's health and receiving yards.`
  ];
  const r2 = await generateChatResponse(q2, conversationContext, 3, false);
  
  // Check if response mentions Kittle instead of CMC (subject drift)
  const mentionsKittle = /kittle/i.test(r2);
  const mentionsCMC = /mccaffrey|cmc/i.test(r2);
  
  if (mentionsKittle && !mentionsCMC) {
    results.push({
      category: 'CMC Conversation',
      test: 'Subject tracking (CMC receiving yards)',
      status: 'FAIL',
      violation: 'Subject drift - talked about Kittle instead of CMC',
      response: r2.substring(0, 200),
      promptSection: 'No explicit subject tracking rules - missing from prompt'
    });
    console.log(`❌ FAIL: Subject tracking`);
    console.log(`   Violation: Responded about Kittle instead of CMC`);
    console.log(`   Response: "${r2.substring(0, 150)}..."`);
  } else if (mentionsCMC) {
    results.push({
      category: 'CMC Conversation',
      test: 'Subject tracking (CMC receiving yards)',
      status: 'PASS',
      response: r2.substring(0, 200)
    });
    console.log(`✅ PASS: Subject tracking - Correctly discussed CMC`);
  } else {
    results.push({
      category: 'CMC Conversation',
      test: 'Subject tracking (CMC receiving yards)',
      status: 'FAIL',
      violation: 'Subject unclear - did not clearly discuss CMC',
      response: r2.substring(0, 200),
      promptSection: 'No explicit subject tracking rules'
    });
    console.log(`❌ FAIL: Subject tracking - Did not clearly discuss CMC`);
  }
  console.log();
}

// ═══════════════════════════════════════════════════════════════
// TEST CATEGORY 2: LAYER ROUTING
// ═══════════════════════════════════════════════════════════════

async function testLayerRouting() {
  console.log('━━━ CATEGORY 2: LAYER ROUTING ━━━\n');
  
  const testCases = [
    { query: "Should I start Josh Jacobs?", expected: 'tactical' },
    { query: "What makes an elite RB?", expected: 'teaching' },
    { query: "Why do patterns repeat across time?", expected: 'river' },
    { query: "Bijan has patience, but should I start him?", expected: 'tactical' } // Override test
  ];
  
  for (const test of testCases) {
    const result = detectLayer(test.query);
    if (result.layer === test.expected) {
      results.push({
        category: 'Layer Routing',
        test: `"${test.query}"`,
        status: 'PASS'
      });
      console.log(`✅ PASS: Detected ${result.layer} (expected ${test.expected})`);
    } else {
      results.push({
        category: 'Layer Routing',
        test: `"${test.query}"`,
        status: 'FAIL',
        violation: `Detected ${result.layer}, expected ${test.expected}`,
        promptSection: 'river-detection.ts patterns'
      });
      console.log(`❌ FAIL: Detected ${result.layer}, expected ${test.expected}`);
    }
  }
  console.log();
}

// ═══════════════════════════════════════════════════════════════
// TEST CATEGORY 3: EPISTEMIC VIOLATIONS
// ═══════════════════════════════════════════════════════════════

async function testEpistemicBoundaries() {
  console.log('━━━ CATEGORY 3: EPISTEMIC VIOLATIONS ━━━\n');
  
  const testCases = [
    {
      name: 'Direct snap share query',
      query: "What's Josh Jacobs' snap share?",
      shouldInclude: ["don't have snap share", "RB5", "PPG"],
      shouldNotInclude: ["snap share is", "snap share of", "%"]
    },
    {
      name: 'YPC trend query',
      query: "How's his YPC trending?",
      shouldInclude: ["don't have YPC", "production"],
      shouldNotInclude: ["YPC is", "YPC of", "trending up", "trending down"]
    },
    {
      name: 'General question with banned metrics in RAG',
      query: "What makes RBs break out?",
      context: MOCK_CONTEXT_WITH_BANNED_METRICS,
      shouldNotInclude: ["snap share of", "his snap share", "YPC is", "his YPC"]
    }
  ];
  
  for (const test of testCases) {
    const context = test.context || MOCK_VORP_CONTEXT;
    const response = await generateChatResponse(test.query, context, 3, false);
    
    const hasRequired = test.shouldInclude
      ? test.shouldInclude.every(phrase => response.toLowerCase().includes(phrase.toLowerCase()))
      : true;
    
    const bannedFound = test.shouldNotInclude
      ? test.shouldNotInclude.filter(phrase => response.toLowerCase().includes(phrase.toLowerCase()))
      : [];
    
    if (hasRequired && bannedFound.length === 0) {
      results.push({
        category: 'Epistemic Boundaries',
        test: test.name,
        status: 'PASS',
        response: response.substring(0, 200)
      });
      console.log(`✅ PASS: ${test.name}`);
    } else {
      results.push({
        category: 'Epistemic Boundaries',
        test: test.name,
        status: 'FAIL',
        violation: bannedFound.length > 0 ? `Found banned phrases: ${bannedFound.join(', ')}` : 'Missing required refusal',
        response: response.substring(0, 200),
        promptSection: 'CONCEPT vs DATA RULE - not enforced'
      });
      console.log(`❌ FAIL: ${test.name}`);
      if (bannedFound.length > 0) {
        console.log(`   Violation: ${bannedFound.join(', ')}`);
      }
    }
  }
  console.log();
}

// ═══════════════════════════════════════════════════════════════
// TEST CATEGORY 4: VOICE CONSISTENCY
// ═══════════════════════════════════════════════════════════════

async function testVoiceConsistency() {
  console.log('━━━ CATEGORY 4: VOICE CONSISTENCY (No Over-Narration) ━━━\n');
  
  const testCases = [
    {
      name: 'Casual greeting',
      query: "What's up?",
      shouldNotInclude: ["I'm analyzing", "Let me examine", "I'm looking at"]
    },
    {
      name: 'Direct start/sit',
      query: "Should I start Jacobs?",
      shouldNotInclude: ["Let me examine", "I'm analyzing", "Looking at"]
    }
  ];
  
  for (const test of testCases) {
    const response = await generateChatResponse(test.query, MOCK_VORP_CONTEXT, 3, false);
    
    const bannedFound = test.shouldNotInclude.filter(phrase =>
      response.toLowerCase().includes(phrase.toLowerCase())
    );
    
    if (bannedFound.length === 0) {
      results.push({
        category: 'Voice Consistency',
        test: test.name,
        status: 'PASS',
        response: response.substring(0, 200)
      });
      console.log(`✅ PASS: ${test.name}`);
    } else {
      results.push({
        category: 'Voice Consistency',
        test: test.name,
        status: 'FAIL',
        violation: `Over-narration found: ${bannedFound.join(', ')}`,
        response: response.substring(0, 200),
        promptSection: 'NO OVER-NARRATION rules'
      });
      console.log(`❌ FAIL: ${test.name} - Found: ${bannedFound.join(', ')}`);
    }
  }
  console.log();
}

// ═══════════════════════════════════════════════════════════════
// RUN ALL TESTS & GENERATE REPORT
// ═══════════════════════════════════════════════════════════════

async function runBenchmark() {
  await testCMCConversation();
  await testLayerRouting();
  await testEpistemicBoundaries();
  await testVoiceConsistency();
  
  // Generate summary
  const totalTests = results.length;
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('BENCHMARK SUMMARY');
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  console.log(`Total Tests: ${totalTests}`);
  console.log(`Passed: ${passed} (${((passed/totalTests)*100).toFixed(1)}%)`);
  console.log(`Failed: ${failed} (${((failed/totalTests)*100).toFixed(1)}%)\n`);
  
  // Break down by category
  const categories = ['CMC Conversation', 'Layer Routing', 'Epistemic Boundaries', 'Voice Consistency'];
  categories.forEach(cat => {
    const catResults = results.filter(r => r.category === cat);
    const catPassed = catResults.filter(r => r.status === 'PASS').length;
    console.log(`${cat}: ${catPassed}/${catResults.length} passed`);
  });
  
  console.log('\n━━━ FAILURE ANALYSIS ━━━\n');
  
  const failures = results.filter(r => r.status === 'FAIL');
  if (failures.length > 0) {
    failures.forEach(f => {
      console.log(`❌ ${f.category} - ${f.test}`);
      console.log(`   Violation: ${f.violation}`);
      if (f.promptSection) {
        console.log(`   Related Prompt Section: ${f.promptSection}`);
      }
      console.log();
    });
  } else {
    console.log('No failures detected!\n');
  }
  
  console.log('═══════════════════════════════════════════════════════════════');
  
  // Save results to file for analysis
  const reportContent = `# STEP 1: BENCHMARK CURRENT PROMPT - RESULTS

## Summary
- Total Tests: ${totalTests}
- Passed: ${passed} (${((passed/totalTests)*100).toFixed(1)}%)
- Failed: ${failed} (${((failed/totalTests)*100).toFixed(1)}%)

## By Category
${categories.map(cat => {
  const catResults = results.filter(r => r.category === cat);
  const catPassed = catResults.filter(r => r.status === 'PASS').length;
  return `- ${cat}: ${catPassed}/${catResults.length} passed`;
}).join('\n')}

## Failures

${failures.map(f => `### ${f.category} - ${f.test}
**Violation**: ${f.violation}
**Related Prompt Section**: ${f.promptSection || 'Unknown'}
**Response Sample**: ${f.response || 'N/A'}
`).join('\n')}

## Key Findings

${failures.length > 0 ? `The current prompt has ${failures.length} failures across ${new Set(failures.map(f => f.promptSection)).size} different sections.

**Most problematic sections**:
${Array.from(new Set(failures.map(f => f.promptSection))).map(s => `- ${s}`).join('\n')}
` : 'All tests passed - current prompt is performing well.'}
`;
  
  return { totalTests, passed, failed, failures, reportContent };
}

// Execute benchmark
runBenchmark()
  .then(async (result) => {
    const fs = await import('fs');
    fs.writeFileSync('tests/BENCHMARK-REPORT.md', result.reportContent);
    console.log('\n✅ Benchmark complete. Report saved to tests/BENCHMARK-REPORT.md');
    process.exit(result.failed > 0 ? 1 : 0);
  })
  .catch(err => {
    console.error('Benchmark error:', err);
    process.exit(1);
  });
