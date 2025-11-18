/**
 * TIBER UX Fixes Test Suite
 * 
 * Tests all 6 UX improvements:
 * 1. Rookie & pre-NFL guard
 * 2. Data availability contract (weekly vs season-level)
 * 3. Stats keyword override (force tactical, never River)
 * 4. Trade evaluation structured format
 * 5. Confession pattern handling
 * 6. River discipline snapback
 */

import { detectLayerWithIntents, isStatsQuery, isConfessionPattern, isTradeEvaluation } from '../services/river-detection';
import { getDataAvailability, isWeeklyBoxScoreRequest, extractSeasonFromQuery, getRookieGuardMessage } from '../lib/dataAvailability';
import { formatTradeResponse, handleConfessionResponse, formatStatsResponse, applyRiverSnapback } from '../lib/responsePostProcessors';

// Test data
const TEST_QUERIES = {
  // UX Fix #3: Stats queries should force tactical layer
  statsQueries: [
    "What are Chris Olave's 2025 stats?",
    "Show me Alec Pierce statline",
    "How many yards did Olave have this week?",
    "Any more 2025 stats for Ja'Marr Chase?",
    "What's his box score for week 5?",
    "How many receptions did he have?",
  ],
  
  // UX Fix #5: Confession patterns
  confessionQueries: [
    "Would you believe me if I told you I already traded Saquon?",
    "What if I told you I accepted that deal?",
    "I already made the trade for Jefferson",
  ],
  
  // UX Fix #4: Trade evaluations
  tradeQueries: [
    "Should I trade Derrick Henry for Justin Jefferson?",
    "I got offered Saquon for my CeeDee Lamb",
    "Trade analysis: My Bijan + 2025 2nd for his Jahmyr Gibbs",
  ],
  
  // UX Fix #1: Rookie guard (players with no 2024 NFL data)
  rookieQueries: [
    "What did Emeka Egbuka do in 2024?",
    "Show me Tetairola McMillan's 2024 stats",
    "What were Jermaine Burton's 2024 receptions?",
  ],
  
  // UX Fix #6: River leakage on stats queries
  riverLeakageQueries: [
    "Why do patterns repeat in Olave's stats?", // River words + stats = snapback
  ],
  
  // UX Fix #2: Data availability for weekly queries
  weeklyDataQueries: [
    "What did Olave do in week 5 of 2024?",  // Should work - have 2024 weekly
    "What did Olave do in week 5 of 2025?",  // Should say "no weekly 2025 yet"
  ],
};

// ═══════════════════════════════════════════════════════════════
// TEST SUITE
// ═══════════════════════════════════════════════════════════════

console.log('═══════════════════════════════════════════════════════════════');
console.log('TIBER UX FIXES TEST SUITE');
console.log('═══════════════════════════════════════════════════════════════\n');

// ─────────────────────────────────────────────────────────────────
// TEST 1: Stats Query Detection → Force Tactical Layer
// ─────────────────────────────────────────────────────────────────
console.log('TEST 1: Stats Queries Force Tactical Layer (Never River/Teaching)');
console.log('─────────────────────────────────────────────────────────────────');

let test1Passed = 0;
let test1Total = TEST_QUERIES.statsQueries.length;

for (const query of TEST_QUERIES.statsQueries) {
  const result = detectLayerWithIntents(query);
  const passed = result.layer === 'tactical' && result.intents.isStatsQuery;
  
  if (passed) test1Passed++;
  
  console.log(`${passed ? '✅' : '❌'} "${query}"`);
  console.log(`   → Layer: ${result.layer}, Stats query: ${result.intents.isStatsQuery}\n`);
}

console.log(`RESULT: ${test1Passed}/${test1Total} tests passed\n`);

// ─────────────────────────────────────────────────────────────────
// TEST 2: Confession Pattern Detection
// ─────────────────────────────────────────────────────────────────
console.log('TEST 2: Confession Pattern Detection');
console.log('─────────────────────────────────────────────────────────────────');

let test2Passed = 0;
let test2Total = TEST_QUERIES.confessionQueries.length;

for (const query of TEST_QUERIES.confessionQueries) {
  const result = detectLayerWithIntents(query);
  const passed = result.intents.isConfession;
  
  if (passed) test2Passed++;
  
  console.log(`${passed ? '✅' : '❌'} "${query}"`);
  console.log(`   → Confession detected: ${result.intents.isConfession}\n`);
}

// Test response formatting
const confessionResponse = handleConfessionResponse("Yes, that was a good trade.");
const hasAcknowledgment = /okay.*you already did it/i.test(confessionResponse);
console.log(`\nResponse formatting: ${hasAcknowledgment ? '✅' : '❌'} Adds acknowledgment`);
if (hasAcknowledgment) test2Passed++;

console.log(`RESULT: ${test2Passed}/${test2Total + 1} tests passed\n`);

// ─────────────────────────────────────────────────────────────────
// TEST 3: Trade Evaluation Detection
// ─────────────────────────────────────────────────────────────────
console.log('TEST 3: Trade Evaluation Detection & Formatting');
console.log('─────────────────────────────────────────────────────────────────');

let test3Passed = 0;
let test3Total = TEST_QUERIES.tradeQueries.length;

for (const query of TEST_QUERIES.tradeQueries) {
  const result = detectLayerWithIntents(query);
  const passed = result.intents.isTradeEval;
  
  if (passed) test3Passed++;
  
  console.log(`${passed ? '✅' : '❌'} "${query}"`);
  console.log(`   → Trade eval detected: ${result.intents.isTradeEval}\n`);
}

// Test response formatting
const mockTradeResponse = "I prefer Jefferson. He's WR3. Henry is RB8.";
const formattedTrade = formatTradeResponse(mockTradeResponse, 'dynasty');
const hasVerdict = /^for (redraft|dynasty)/i.test(formattedTrade);
console.log(`\nFormatting check: ${hasVerdict ? '✅' : '❌'} Has verdict structure`);
if (hasVerdict) test3Passed++;

console.log(`RESULT: ${test3Passed}/${test3Total + 1} tests passed\n`);

// ─────────────────────────────────────────────────────────────────
// TEST 4: Data Availability Contract
// ─────────────────────────────────────────────────────────────────
console.log('TEST 4: Data Availability Contract');
console.log('─────────────────────────────────────────────────────────────────');

let test4Passed = 0;

// Test 2024 availability (should have weekly)
const capabilities2024 = getDataAvailability(2024);
if (capabilities2024.hasWeekly && capabilities2024.hasSeasonLevel) {
  console.log('✅ 2024: Has weekly box scores AND season-level data');
  test4Passed++;
} else {
  console.log('❌ 2024: Missing expected data');
}

// Test 2025 availability (only season-level, no weekly yet)
const capabilities2025 = getDataAvailability(2025);
if (!capabilities2025.hasWeekly && capabilities2025.hasSeasonLevel) {
  console.log('✅ 2025: Season-level only (no weekly box scores)');
  test4Passed++;
} else {
  console.log('❌ 2025: Incorrect availability');
}

// Test weekly box score detection
const isWeekly2024 = isWeeklyBoxScoreRequest("What did Olave do in week 5 of 2024?");
const isWeekly2025 = isWeeklyBoxScoreRequest("What did Olave do in week 5 of 2025?");

if (isWeekly2024 && isWeekly2025) {
  console.log('✅ Weekly box score requests detected correctly');
  test4Passed++;
} else {
  console.log('❌ Weekly box score detection failed');
}

// Test season extraction
const extracted2024 = extractSeasonFromQuery("What did Olave do in week 5 of 2024?");
const extracted2025 = extractSeasonFromQuery("Show me his 2025 stats");

if (extracted2024 === 2024 && extracted2025 === 2025) {
  console.log('✅ Season extraction works correctly');
  test4Passed++;
} else {
  console.log(`❌ Season extraction failed: ${extracted2024}, ${extracted2025}`);
}

console.log(`RESULT: ${test4Passed}/4 tests passed\n`);

// ─────────────────────────────────────────────────────────────────
// TEST 5: Rookie Guard
// ─────────────────────────────────────────────────────────────────
console.log('TEST 5: Rookie & Pre-NFL Guard');
console.log('─────────────────────────────────────────────────────────────────');

let test5Passed = 0;

// Test rookie guard message generation
const rookieMsg = getRookieGuardMessage("Emeka Egbuka", 2024);
const hasCorrectMessage = rookieMsg.includes("didn't play in the NFL in 2024");

if (hasCorrectMessage) {
  console.log('✅ Rookie guard message template correct');
  test5Passed++;
} else {
  console.log('❌ Rookie guard message incorrect');
}

console.log(`   Sample: "${rookieMsg.slice(0, 100)}..."\n`);
console.log(`RESULT: ${test5Passed}/1 tests passed\n`);

// ─────────────────────────────────────────────────────────────────
// TEST 6: River Discipline Snapback
// ─────────────────────────────────────────────────────────────────
console.log('TEST 6: River Discipline Snapback');
console.log('─────────────────────────────────────────────────────────────────');

let test6Passed = 0;

// Test River snapback on stats queries
const riverLeakResponse = "The river of time carries Olave's stats. He's WR12 with 11.8 PPG.";
const snappedBack = applyRiverSnapback(riverLeakResponse, true);
const removedRiver = !snappedBack.includes("river of time");

if (removedRiver) {
  console.log('✅ River language removed from stats response');
  test6Passed++;
} else {
  console.log('❌ River snapback failed');
}

// Test NO snapback for non-stats queries
const riverPhilosophy = "The river of time teaches us patterns repeat.";
const notSnapped = applyRiverSnapback(riverPhilosophy, false);
const preservedRiver = notSnapped.includes("river of time");

if (preservedRiver) {
  console.log('✅ River language preserved for philosophy queries');
  test6Passed++;
} else {
  console.log('❌ Incorrectly removed River from philosophy query');
}

console.log(`RESULT: ${test6Passed}/2 tests passed\n`);

// ═══════════════════════════════════════════════════════════════
// SUMMARY
// ═══════════════════════════════════════════════════════════════
console.log('═══════════════════════════════════════════════════════════════');
console.log('TEST SUMMARY');
console.log('═══════════════════════════════════════════════════════════════');

const totalPassed = test1Passed + test2Passed + test3Passed + test4Passed + test5Passed + test6Passed;
const totalTests = test1Total + (test2Total + 1) + (test3Total + 1) + 4 + 1 + 2;

console.log(`Overall: ${totalPassed}/${totalTests} tests passed (${((totalPassed / totalTests) * 100).toFixed(1)}%)`);
console.log(`
✅ Test 1 (Stats→Tactical): ${test1Passed}/${test1Total}
✅ Test 2 (Confession): ${test2Passed}/${test2Total + 1}
✅ Test 3 (Trade Format): ${test3Passed}/${test3Total + 1}
✅ Test 4 (Data Availability): ${test4Passed}/4
✅ Test 5 (Rookie Guard): ${test5Passed}/1
✅ Test 6 (River Snapback): ${test6Passed}/2
`);

console.log('═══════════════════════════════════════════════════════════════\n');

// Exit with appropriate code
process.exit(totalPassed === totalTests ? 0 : 1);
