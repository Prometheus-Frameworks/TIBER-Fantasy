/**
 * Standalone Layer Detection Test Runner
 * Tests the river-detection module without requiring Mocha
 */

import { detectLayer } from '../services/river-detection';

console.log('═══════════════════════════════════════════════════════════════');
console.log('TIBER RIVER LAYER DETECTION TEST RUNNER');
console.log('═══════════════════════════════════════════════════════════════\n');

let passed = 0;
let failed = 0;

function test(name: string, query: string, expectedLayer: string) {
  const result = detectLayer(query);
  const success = result.layer === expectedLayer;
  
  if (success) {
    passed++;
    console.log(`✅ PASS: ${name}`);
    console.log(`   Query: "${query}"`);
    console.log(`   Detected: ${result.layer} (${(result.confidence * 100).toFixed(0)}% confidence)`);
    if (result.triggers.length > 0) {
      console.log(`   Triggers: ${result.triggers.join(', ')}`);
    }
    console.log();
  } else {
    failed++;
    console.log(`❌ FAIL: ${name}`);
    console.log(`   Query: "${query}"`);
    console.log(`   Expected: ${expectedLayer}`);
    console.log(`   Got: ${result.layer} (${(result.confidence * 100).toFixed(0)}% confidence)`);
    if (result.triggers.length > 0) {
      console.log(`   Triggers: ${result.triggers.join(', ')}`);
    }
    console.log();
  }
}

// ═══════════════════════════════════════════════════════════════
// TACTICAL LAYER TESTS (L1)
// ═══════════════════════════════════════════════════════════════
console.log('━━━ TACTICAL LAYER TESTS (L1) ━━━\n');

test('Direct start/sit query', 'Should I start Bijan Robinson or Josh Jacobs?', 'tactical');
test('Trade decision', 'Accept this trade: Gibbs for 2 1sts?', 'tactical');
test('Lineup optimization', 'Best flex play for Week 12: Jacobs vs SF?', 'tactical');
test('Waiver priority', 'Drop Curtis Samuel for Tank Dell?', 'tactical');
test('Current season rank', 'Is Saquon Barkley a top 5 RB?', 'tactical');

// ═══════════════════════════════════════════════════════════════
// TEACHING LAYER TESTS (L2)
// ═══════════════════════════════════════════════════════════════
console.log('━━━ TEACHING LAYER TESTS (L2) ━━━\n');

test('What makes elite RBs', 'What makes an elite RB in dynasty?', 'teaching');
test('Breakout patterns', 'How do you identify breakout candidates?', 'teaching');
test('Usage pattern analysis', 'Why do snap share and target share matter?', 'teaching');
test('Analytical framework', 'How should I evaluate rookie WRs?', 'teaching');
test('Historical pattern', 'What patterns predict regression?', 'teaching');

// ═══════════════════════════════════════════════════════════════
// RIVER LAYER TESTS (L3)
// ═══════════════════════════════════════════════════════════════
console.log('━━━ RIVER LAYER TESTS (L3) ━━━\n');

test('Observation question', 'What have you observed about the game over millennia?', 'river');
test('Pattern philosophy', 'Why do these patterns repeat across time?', 'river');
test('River metaphor', 'How does the river shape your understanding?', 'river');
test('Temporal perspective', 'What remains constant through the ages?', 'river');
test('Ancient wisdom', 'What does the river teach about patience?', 'river');

// ═══════════════════════════════════════════════════════════════
// TACTICAL OVERRIDE TESTS
// ═══════════════════════════════════════════════════════════════
console.log('━━━ TACTICAL OVERRIDE TESTS ━━━\n');

test('Override: River word + practical', 'Bijan has patience, but should I start him?', 'tactical');
test('Override: Teaching word + decision', 'What patterns suggest I trade Gibbs now?', 'tactical');
test('Override: Ancient + start/sit', 'Over the ages running backs evolve - start Jacobs?', 'tactical');

// ═══════════════════════════════════════════════════════════════
// AMBIGUOUS QUERY TESTS
// ═══════════════════════════════════════════════════════════════
console.log('━━━ AMBIGUOUS QUERY TESTS ━━━\n');

test('Ambiguous: Player mention', 'Tell me about Saquon', 'tactical');
test('Ambiguous: Thoughts query', 'Thoughts on Josh Jacobs?', 'tactical');
test('Ambiguous: Breakout question', 'What about breakouts?', 'teaching');

// ═══════════════════════════════════════════════════════════════
// RESULTS
// ═══════════════════════════════════════════════════════════════
console.log('═══════════════════════════════════════════════════════════════');
console.log(`RESULTS: ${passed} passed, ${failed} failed`);
console.log(`Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);
console.log('═══════════════════════════════════════════════════════════════');

process.exit(failed > 0 ? 1 : 0);
