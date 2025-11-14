/**
 * VOICE & EPISTEMIC HONESTY REGRESSION TESTS
 * 
 * Tests TIBER's:
 * 1. No over-narration (no "I'm analyzing..." preambles)
 * 2. Epistemic honesty (only claim metrics you have)
 */

import { generateChatResponse } from '../services/geminiEmbeddings';

// Mock VORP context for testing
const MOCK_VORP_CONTEXT = [
  `**2025 Season Performance**
**Josh Jacobs (RB5)**: 16.7 PPG, +73.2 VORP, 11 games (GB)
**Bijan Robinson (RB4)**: 17.8 PPG, +81.6 VORP, 11 games (ATL)
**Saquon Barkley (RB2)**: 18.3 PPG, +91.5 VORP, 11 games (PHI)`
];

// Mock context that mentions unavailable metrics (testing CONCEPT vs DATA rule)
const MOCK_CONTEXT_WITH_UNAVAILABLE_METRICS = [
  `**2025 Season Performance**
**Josh Jacobs (RB5)**: 16.7 PPG, +73.2 VORP, 11 games (GB)

**Historical Pattern Analysis:**
High snap share (75%+) typically correlates with sustained RB1 production. Players who consistently gain first downs per route run (1D/RR) tend to break out in fantasy. Target share above 20% in the passing game provides a safe floor for PPR scoring.

In 2024, Jacobs posted 1329 rushing yards, 15 TDs, and 5.8 YPC for the Packers.`
];

console.log('═══════════════════════════════════════════════════════════════');
console.log('TIBER VOICE & EPISTEMIC HONESTY REGRESSION TESTS');
console.log('═══════════════════════════════════════════════════════════════\n');

async function testVoiceFix() {
  console.log('━━━ TEST 1: NO OVER-NARRATION ━━━\n');
  
  const testCases = [
    {
      name: 'Casual greeting',
      query: "What's up?",
      shouldNotInclude: [
        "I'm analyzing",
        "Let me examine",
        "I'm looking at",
        "analyzing the",
        "examining the"
      ]
    },
    {
      name: 'Direct start/sit',
      query: "Should I start Josh Jacobs?",
      shouldNotInclude: [
        "Let me examine the matchup",
        "I'm analyzing his usage",
        "Looking at the data"
      ]
    },
    {
      name: 'Player evaluation',
      query: "Is Bijan Robinson elite?",
      shouldNotInclude: [
        "I'm examining",
        "Let me analyze",
        "Looking at his"
      ]
    }
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const test of testCases) {
    const response = await generateChatResponse(test.query, MOCK_VORP_CONTEXT, 3, false);
    
    const foundBadPhrases = test.shouldNotInclude.filter(phrase => 
      response.toLowerCase().includes(phrase.toLowerCase())
    );
    
    if (foundBadPhrases.length === 0) {
      passed++;
      console.log(`✅ PASS: ${test.name}`);
      console.log(`   Query: "${test.query}"`);
      console.log(`   Response: "${response.substring(0, 100)}..."`);
      console.log();
    } else {
      failed++;
      console.log(`❌ FAIL: ${test.name}`);
      console.log(`   Query: "${test.query}"`);
      console.log(`   Found bad phrases: ${foundBadPhrases.join(', ')}`);
      console.log(`   Response: "${response.substring(0, 150)}..."`);
      console.log();
    }
  }
  
  return { passed, failed };
}

async function testEpistemicHonesty() {
  console.log('━━━ TEST 2: EPISTEMIC HONESTY (CONCEPT vs DATA) ━━━\n');
  
  const testCases = [
    {
      name: 'Direct unavailable metric query',
      query: "What's Josh Jacobs' snap share?",
      shouldInclude: ["I don't have snap share", "RB5", "16.7 PPG"],
      shouldNotInclude: ["snap share is", "snap share of", "%"]
    },
    {
      name: 'YPC trend query',
      query: "How's Jacobs' YPC trending?",
      shouldInclude: ["don't have YPC", "RB5", "production"],
      shouldNotInclude: ["YPC is", "yards per carry of", "trending up"]
    },
    {
      name: 'RAG context with 1D/RR (concept allowed)',
      query: "What makes Jacobs a good RB?",
      shouldInclude: ["RB5", "VORP"],
      shouldNotInclude: [
        "his 1D/RR",
        "his snap share",
        "his target share",
        "1D/RR shows",
        "snap share is"
      ],
      context: MOCK_CONTEXT_WITH_UNAVAILABLE_METRICS
    },
    {
      name: 'General breakout question (concept allowed)',
      query: "What makes RBs break out?",
      shouldNotInclude: [
        "Jacobs' snap share",
        "his 1D/RR is",
        "target share of"
      ],
      context: MOCK_CONTEXT_WITH_UNAVAILABLE_METRICS
    }
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const test of testCases) {
    const context = test.context || MOCK_VORP_CONTEXT;
    const response = await generateChatResponse(test.query, context, 3, false);
    
    const hasRequired = test.shouldInclude 
      ? test.shouldInclude.every(phrase => 
          response.toLowerCase().includes(phrase.toLowerCase())
        )
      : true;
    
    const foundBadPhrases = test.shouldNotInclude.filter(phrase => 
      response.toLowerCase().includes(phrase.toLowerCase())
    );
    
    const testPassed = hasRequired && foundBadPhrases.length === 0;
    
    if (testPassed) {
      passed++;
      console.log(`✅ PASS: ${test.name}`);
      console.log(`   Query: "${test.query}"`);
      console.log(`   Response: "${response.substring(0, 150)}..."`);
      console.log();
    } else {
      failed++;
      console.log(`❌ FAIL: ${test.name}`);
      console.log(`   Query: "${test.query}"`);
      if (!hasRequired) {
        console.log(`   Missing required phrases: ${test.shouldInclude?.join(', ')}`);
      }
      if (foundBadPhrases.length > 0) {
        console.log(`   Found banned phrases: ${foundBadPhrases.join(', ')}`);
      }
      console.log(`   Response: "${response.substring(0, 200)}..."`);
      console.log();
    }
  }
  
  return { passed, failed };
}

async function runAllTests() {
  const voiceResults = await testVoiceFix();
  const epistemicResults = await testEpistemicHonesty();
  
  const totalPassed = voiceResults.passed + epistemicResults.passed;
  const totalFailed = voiceResults.failed + epistemicResults.failed;
  const total = totalPassed + totalFailed;
  
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`RESULTS:`);
  console.log(`  Voice Tests: ${voiceResults.passed}/${voiceResults.passed + voiceResults.failed} passed`);
  console.log(`  Epistemic Tests: ${epistemicResults.passed}/${epistemicResults.passed + epistemicResults.failed} passed`);
  console.log(`  Total: ${totalPassed}/${total} passed (${((totalPassed/total)*100).toFixed(1)}%)`);
  console.log('═══════════════════════════════════════════════════════════════');
  
  process.exit(totalFailed > 0 ? 1 : 0);
}

// Run tests
runAllTests().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
