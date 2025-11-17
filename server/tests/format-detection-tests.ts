/**
 * TIBER Format Detection Test Suite
 * 
 * Tests the redraft vs dynasty detection heuristics
 */

import { detectFormat, Format } from '../lib/format-detector';

interface TestCase {
  query: string;
  expectedFormat: Format;
  minConfidence?: number;
  description: string;
}

const TEST_CASES: TestCase[] = [
  // ═══════════════════════════════════════════════════════════════
  // REDRAFT SIGNALS
  // ═══════════════════════════════════════════════════════════════
  {
    query: 'Half PPR: start Puka or Pittman this week?',
    expectedFormat: 'redraft',
    minConfidence: 0.8,
    description: 'Explicit start/sit with scoring format',
  },
  {
    query: 'Should I play Josh Allen or Geno Smith in Week 12?',
    expectedFormat: 'redraft',
    minConfidence: 0.75,
    description: 'Weekly start decision',
  },
  {
    query: 'Who should I pick up on waivers: Tank Dell or Romeo Doubs?',
    expectedFormat: 'redraft',
    minConfidence: 0.7,
    description: 'Waiver wire decision',
  },
  {
    query: 'Matchup analysis for Breece Hall tonight',
    expectedFormat: 'redraft',
    minConfidence: 0.7,
    description: 'Game day matchup',
  },
  {
    query: 'RB rankings rest of season for playoffs',
    expectedFormat: 'redraft',
    minConfidence: 0.6,
    description: 'Rest of season focus',
  },
  {
    query: 'Best playoff schedule for weeks 15-17',
    expectedFormat: 'redraft',
    minConfidence: 0.6,
    description: 'Playoff schedule planning',
  },
  {
    query: 'Drop Rashee Rice for Diontae Johnson?',
    expectedFormat: 'redraft',
    minConfidence: 0.5,
    description: 'Add/drop decision',
  },

  // ═══════════════════════════════════════════════════════════════
  // DYNASTY SIGNALS
  // ═══════════════════════════════════════════════════════════════
  {
    query: 'Dynasty: trade my 2026 1st for Kyler Murray?',
    expectedFormat: 'dynasty',
    minConfidence: 0.85,
    description: 'Explicit dynasty with future pick',
  },
  {
    query: 'Should I rebuild or contend this year?',
    expectedFormat: 'dynasty',
    minConfidence: 0.75,
    description: 'Rebuild vs contend (window)',
  },
  {
    query: 'What is CeeDee Lamb\'s age curve outlook?',
    expectedFormat: 'dynasty',
    minConfidence: 0.8,
    description: 'Age curve question',
  },
  {
    query: 'Is Marvin Harrison Jr a good long-term asset?',
    expectedFormat: 'dynasty',
    minConfidence: 0.6,
    description: 'Long-term asset evaluation',
  },
  {
    query: 'Trade two 2nd round picks for Brock Bowers?',
    expectedFormat: 'dynasty',
    minConfidence: 0.75,
    description: 'Multi-pick trade',
  },
  {
    query: 'Young RB with breakout potential for 2026?',
    expectedFormat: 'dynasty',
    minConfidence: 0.6,
    description: 'Future breakout (young asset)',
  },
  {
    query: 'Does Garrett Wilson have insulation from QB changes?',
    expectedFormat: 'dynasty',
    minConfidence: 0.75,
    description: 'Insulation concept',
  },
  {
    query: 'Keeper league: keep Bijan or take the 1st round pick?',
    expectedFormat: 'dynasty',
    minConfidence: 0.8,
    description: 'Keeper decision',
  },
  {
    query: 'Sell high on aging RB for young WR?',
    expectedFormat: 'dynasty',
    minConfidence: 0.6,
    description: 'Asset trading strategy',
  },

  // ═══════════════════════════════════════════════════════════════
  // AMBIGUOUS / EDGE CASES
  // ═══════════════════════════════════════════════════════════════
  {
    query: 'Is Tank Dell good?',
    expectedFormat: 'dynasty',
    minConfidence: 0.4,
    description: 'Generic player eval (defaults to dynasty)',
  },
  {
    query: 'Trade analysis: my Ja\'Marr Chase for Garrett Wilson + a 2nd',
    expectedFormat: 'dynasty',
    minConfidence: 0.55,
    description: 'Trade with pick (mild dynasty signal)',
  },
  {
    query: 'Who are the top 5 RBs?',
    expectedFormat: 'dynasty',
    minConfidence: 0.4,
    description: 'Generic rankings (defaults to dynasty)',
  },
  {
    query: 'How do you evaluate breakout candidates?',
    expectedFormat: 'dynasty',
    minConfidence: 0.45,
    description: 'Teaching question (slight dynasty lean)',
  },
  
  // ═══════════════════════════════════════════════════════════════
  // MIXED SIGNALS (conflicting format hints)
  // ═══════════════════════════════════════════════════════════════
  {
    query: 'Dynasty team: who should I start this week - Najee or Javonte?',
    expectedFormat: 'redraft',
    minConfidence: 0.6,
    description: 'Dynasty context but weekly decision (redraft wins)',
  },
  {
    query: 'Trade Tyreek Hill for a 2026 1st? Need to win this week.',
    expectedFormat: 'dynasty',
    minConfidence: 0.55,
    description: 'Future pick vs weekly need (dynasty pick signal stronger)',
  },
  
  // ═══════════════════════════════════════════════════════════════
  // NEGATIVE TESTS (common phrases that should NOT trigger dynasty)
  // ═══════════════════════════════════════════════════════════════
  {
    query: 'Who scored the first touchdown last week?',
    expectedFormat: 'redraft',
    minConfidence: 0.5,
    description: 'Negative test: "first touchdown" should not trigger dynasty',
  },
  {
    query: 'What happened in the second half of the game?',
    expectedFormat: 'dynasty',
    minConfidence: 0.4,
    description: 'Negative test: "second half" should not trigger dynasty (ambiguous)',
  },
  {
    query: 'Did he get a second chance at the end zone?',
    expectedFormat: 'dynasty',
    minConfidence: 0.4,
    description: 'Negative test: "a second chance" should not trigger dynasty',
  },
];

/**
 * Run all format detection tests
 */
export function runFormatDetectionTests(): { passed: number; failed: number; total: number } {
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('TIBER FORMAT DETECTION TEST SUITE');
  console.log('═══════════════════════════════════════════════════════════════\n');

  let passed = 0;
  let failed = 0;

  for (const testCase of TEST_CASES) {
    const result = detectFormat(testCase.query);
    const formatMatch = result.format === testCase.expectedFormat;
    const confidenceOK = testCase.minConfidence
      ? result.confidence >= testCase.minConfidence
      : true;

    const testPassed = formatMatch && confidenceOK;

    if (testPassed) {
      passed++;
      console.log(`✅ PASS: ${testCase.description}`);
    } else {
      failed++;
      console.log(`❌ FAIL: ${testCase.description}`);
      console.log(`   Query: "${testCase.query}"`);
      console.log(`   Expected: ${testCase.expectedFormat} (conf >= ${testCase.minConfidence || 0})`);
      console.log(`   Got: ${result.format} (conf = ${result.confidence.toFixed(2)})`);
      console.log(`   Reasons: ${result.reasons.join('; ')}`);
    }
  }

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log(`RESULTS: ${passed} passed, ${failed} failed, ${TEST_CASES.length} total`);
  console.log('═══════════════════════════════════════════════════════════════\n');

  return { passed, failed, total: TEST_CASES.length };
}

// Run tests if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const results = runFormatDetectionTests();
  process.exit(results.failed > 0 ? 1 : 0);
}
