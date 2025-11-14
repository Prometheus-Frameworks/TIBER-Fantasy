/**
 * STEP 4: A/B COMPARISON - ORIGINAL VS LEAN PROMPT
 * 
 * Run identical tests against both prompts and measure:
 * - Hallucination rate
 * - Accuracy
 * - Persona stability
 * - Responsiveness
 * - Subject tracking
 */

import { generateLeanPrompt } from './lean-prompt';

interface TestCase {
  id: string;
  category: string;
  userMessage: string;
  context: string[];
  expectedBehavior: string;
  checkForViolations: string[];
  checkForRequired?: string[];
}

const testSuite: TestCase[] = [
  // CATEGORY 1: CMC CONVERSATION (Real failure case from user)
  {
    id: "cmc_1",
    category: "CMC Conversation",
    userMessage: "Who are the best RBs this year?",
    context: [
      "**2025 Season Performance**\n\nSaquon Barkley: RB2, 18.3 PPG, +91.5 VORP\nChristian McCaffrey: RB4, 17.2 PPG, +85.1 VORP\nJahmyr Gibbs: RB3, 19.1 PPG, +93.4 VORP\nJosh Jacobs: RB5, 16.7 PPG, +73.2 VORP",
      "Saquon Barkley finished 2024 with 2,005 rush yards, 13 TDs, 5.8 YPC (RB1).",
      "McCaffrey had 1,459 rush yards, 14 TDs, 4.7 YPC in 2023 (RB1)."
    ],
    expectedBehavior: "Should list top RBs with 2025 VORP data. Should NOT cite snap share, YPC values, or other banned metrics for 2025.",
    checkForViolations: [
      "snap share",
      "snap count",
      "YPC",
      "yards per carry",
      "target share"
    ],
    checkForRequired: [
      "RB",
      "VORP"
    ]
  },
  {
    id: "cmc_2",
    category: "CMC Conversation",
    userMessage: "What about McCaffrey specifically?",
    context: [
      "**2025 Season Performance**\n\nChristian McCaffrey: RB4, 17.2 PPG, +85.1 VORP",
      "McCaffrey had 1,459 rush yards, 14 TDs, 4.7 YPC in 2023 (RB1).",
      "George Kittle had 1,020 yards, 6 TDs in 2024 (TE3)."
    ],
    expectedBehavior: "Should discuss CMC specifically (not Kittle). Should cite 2025 VORP data. Should NOT cite 2025 snap share or YPC.",
    checkForViolations: [
      "snap share",
      "Kittle", // Subject drift
      "89%",
      "76%",
      "5.1",
      "4.3"
    ],
    checkForRequired: [
      "McCaffrey",
      "RB4",
      "17.2 PPG"
    ]
  },

  // CATEGORY 2: LAYER ROUTING
  {
    id: "layer_tactical",
    category: "Layer Routing",
    userMessage: "Should I start Saquon or Jacobs?",
    context: [
      "**2025 Season Performance**\n\nSaquon Barkley: RB2, 18.3 PPG, +91.5 VORP\nJosh Jacobs: RB5, 16.7 PPG, +73.2 VORP"
    ],
    expectedBehavior: "Direct tactical answer. No over-narration ('I'm analyzing...'). Should recommend Saquon.",
    checkForViolations: [
      "I'm analyzing",
      "Let me examine",
      "Looking at"
    ],
    checkForRequired: [
      "Saquon"
    ]
  },
  {
    id: "layer_teaching",
    category: "Layer Routing",
    userMessage: "How do you evaluate running backs?",
    context: [
      "Elite RBs in 2024 averaged 18+ PPG with 80+ VORP scores.",
      "Saquon Barkley: RB2, 18.3 PPG, +91.5 VORP"
    ],
    expectedBehavior: "Teaching mode. Should explain framework, not just answer. Educational tone.",
    checkForViolations: [],
    checkForRequired: [
      "framework",
      "evaluate"
    ]
  },
  {
    id: "layer_river",
    category: "Layer Routing",
    userMessage: "How do you work? What's your process?",
    context: [],
    expectedBehavior: "Meta-reflection mode. Should discuss process honestly without pretentiousness.",
    checkForViolations: [
      "ancient observer watching",
      "river consciousness"
    ],
    checkForRequired: [
      "I",
      "process"
    ]
  },

  // CATEGORY 3: EPISTEMIC BOUNDARIES
  {
    id: "epistemic_snap",
    category: "Epistemic Boundaries",
    userMessage: "What's Josh Jacobs' snap share?",
    context: [
      "**2025 Season Performance**\n\nJosh Jacobs: RB5, 16.7 PPG, +73.2 VORP"
    ],
    expectedBehavior: "REFUSE snap share question. REDIRECT to available VORP data.",
    checkForViolations: [
      "65%",
      "70%",
      "80%",
      "snap share is"
    ],
    checkForRequired: [
      "don't have",
      "RB5",
      "16.7 PPG"
    ]
  },
  {
    id: "epistemic_ypc",
    category: "Epistemic Boundaries",
    userMessage: "Is Jacobs' YPC trending down?",
    context: [
      "**2025 Season Performance**\n\nJosh Jacobs: RB5, 16.7 PPG, +73.2 VORP"
    ],
    expectedBehavior: "REFUSE YPC question. REDIRECT to available VORP data.",
    checkForViolations: [
      "5.1",
      "4.3",
      "YPC is",
      "yards per carry"
    ],
    checkForRequired: [
      "don't have",
      "RB5"
    ]
  },
  {
    id: "epistemic_concept",
    category: "Epistemic Boundaries",
    userMessage: "What usage patterns indicate a breakout?",
    context: [
      "Historically, RB breakouts correlate with increased target involvement (5+ targets/game) and early-down role consolidation."
    ],
    expectedBehavior: "CAN teach concept using historical patterns. Should acknowledge data limitations for 2025.",
    checkForViolations: [],
    checkForRequired: [
      "historically",
      "pattern"
    ]
  },

  // CATEGORY 4: VOICE CONSISTENCY
  {
    id: "voice_greeting",
    category: "Voice Consistency",
    userMessage: "Hey what's up?",
    context: [],
    expectedBehavior: "Natural friendly greeting. Brief. No over-narration.",
    checkForViolations: [
      "I'm analyzing the 2025 fantasy football landscape"
    ],
    checkForRequired: []
  },
  {
    id: "voice_startsit",
    category: "Voice Consistency",
    userMessage: "Should I start Jacobs this week?",
    context: [
      "**2025 Season Performance**\n\nJosh Jacobs: RB5, 16.7 PPG, +73.2 VORP"
    ],
    expectedBehavior: "Direct answer immediately. No throat-clearing.",
    checkForViolations: [
      "Let me examine",
      "Based on the available data"
    ],
    checkForRequired: [
      "Jacobs",
      "RB5"
    ]
  },

  // CATEGORY 5: TEMPORAL SEPARATION
  {
    id: "temporal_2024",
    category: "Temporal Separation",
    userMessage: "How good was Saquon in 2024?",
    context: [
      "Saquon Barkley finished 2024 with 2,005 rush yards, 13 TDs, 5.8 YPC (RB1).",
      "**2025 Season Performance**\n\nSaquon Barkley: RB2, 18.3 PPG, +91.5 VORP"
    ],
    expectedBehavior: "Use PAST TENSE for 2024 data. Should NOT confuse with 2025.",
    checkForViolations: [
      "Saquon is RB1" // 2024 rank stated as current
    ],
    checkForRequired: [
      "2024",
      "had",
      "was",
      "finished"
    ]
  },
  {
    id: "temporal_dual",
    category: "Temporal Separation",
    userMessage: "Compare Saquon's 2024 season to his current performance",
    context: [
      "Saquon Barkley finished 2024 with 2,005 rush yards, 13 TDs, 5.8 YPC (RB1).",
      "**2025 Season Performance**\n\nSaquon Barkley: RB2, 18.3 PPG, +91.5 VORP"
    ],
    expectedBehavior: "Dual-context pattern. 2024 = past tense, 2025 = current VORP data only.",
    checkForViolations: [],
    checkForRequired: [
      "2024",
      "2025",
      "had",
      "is"
    ]
  }
];

interface TestResult {
  testId: string;
  category: string;
  passed: boolean;
  violations: string[];
  missingRequired: string[];
  responseLength: number;
  note?: string;
}

interface PromptResults {
  promptName: string;
  totalTests: number;
  passed: number;
  failed: number;
  passRate: number;
  categoryBreakdown: Record<string, { passed: number; total: number }>;
  results: TestResult[];
}

console.log("═══════════════════════════════════════════════════════════════");
console.log("STEP 4: A/B COMPARISON - ORIGINAL VS LEAN PROMPT");
console.log("═══════════════════════════════════════════════════════════════\n");

console.log(`📋 Test Suite: ${testSuite.length} test cases across 5 categories:\n`);

const categories = [...new Set(testSuite.map(t => t.category))];
categories.forEach(cat => {
  const count = testSuite.filter(t => t.category === cat).length;
  console.log(`   • ${cat}: ${count} tests`);
});

console.log("\n━━━ TEST CASE SPECIFICATIONS ━━━\n");

testSuite.forEach((test, idx) => {
  console.log(`${idx + 1}. [${test.category}] ${test.id}`);
  console.log(`   Query: "${test.userMessage}"`);
  console.log(`   Expected: ${test.expectedBehavior}`);
  if (test.checkForViolations.length > 0) {
    console.log(`   ❌ Should NOT contain: ${test.checkForViolations.join(', ')}`);
  }
  if (test.checkForRequired && test.checkForRequired.length > 0) {
    console.log(`   ✅ MUST contain: ${test.checkForRequired.join(', ')}`);
  }
  console.log();
});

console.log("═══════════════════════════════════════════════════════════════");
console.log("TESTING APPROACH");
console.log("═══════════════════════════════════════════════════════════════\n");

console.log("⚠️  IMPORTANT: This test suite runs OFFLINE with MOCK responses.");
console.log("   Real LLM testing requires actual Gemini API calls.\n");

console.log("For each prompt version:");
console.log("   1. Generate system instruction (using Original or Lean prompt)");
console.log("   2. Build context string from test case");
console.log("   3. Call Gemini API with systemInstruction + context");
console.log("   4. Check response for violations and required elements");
console.log("   5. Score: PASS if no violations + all required present\n");

console.log("Metrics tracked:");
console.log("   • Epistemic violations (citing banned metrics)");
console.log("   • Subject drift (discussing wrong player)");
console.log("   • Over-narration (throat-clearing)");
console.log("   • Temporal confusion (2024 vs 2025)");
console.log("   • Missing required elements (not answering question)\n");

console.log("═══════════════════════════════════════════════════════════════");
console.log("NEXT STEPS");
console.log("═══════════════════════════════════════════════════════════════\n");

console.log("To run full A/B comparison with real Gemini API:");
console.log("   1. Implement runTestWithPrompt(test, promptType: 'original' | 'lean')");
console.log("   2. Call generateChatResponse() with appropriate system prompt");
console.log("   3. Parse response and check for violations/requirements");
console.log("   4. Aggregate results by category and prompt version");
console.log("   5. Generate comparison report\n");

console.log("Expected outcomes:");
console.log("   ✅ Both prompts should maintain 100% epistemic boundary enforcement");
console.log("   ✅ Both should prevent over-narration");
console.log("   ✅ Both should route layers correctly");
console.log("   🎯 Lean prompt should be MORE natural and responsive");
console.log("   🎯 Lean prompt should trust Gemini's intelligence more\n");

console.log("═══════════════════════════════════════════════════════════════\n");

