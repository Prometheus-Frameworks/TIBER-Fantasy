/**
 * TIBER PRESSURE MODULE - TEST SUITE
 * 
 * Validates:
 * - Teaching Layer explains pressure concepts clearly
 * - River Layer uses appropriate metaphors
 * - Tactical snap-back works from River mode
 * - No stat hallucination in any layer
 */

import { generateChatResponse } from '../services/geminiEmbeddings';
import { detectLayer } from '../services/river-detection';

// ═══════════════════════════════════════════════════════════════
// TEST DATA STRUCTURES
// ═══════════════════════════════════════════════════════════════

interface PressureTestCase {
  name: string;
  query: string;
  expectedLayer: 'tactical' | 'teaching' | 'river';
  mustInclude: string[];
  mustNotInclude: string[];
  description: string;
}

// Mock VORP context for tactical snap-back tests
const MOCK_VORP_CONTEXT = [
  `**2025 Season Performance**
**Bijan Robinson (RB4)**: 17.8 PPG, +81.6 VORP, 11 games (ATL)
**Rico Dowdle (RB15)**: 13.2 PPG, +42.1 VORP, 11 games (DAL)
**Jaylen Warren (RB22)**: 11.8 PPG, +28.3 VORP, 11 games (PIT)`
];

// ═══════════════════════════════════════════════════════════════
// TEACHING LAYER TESTS
// ═══════════════════════════════════════════════════════════════

const TEACHING_TESTS: PressureTestCase[] = [
  {
    name: "Pressure Framework Explanation",
    query: "How do you think about breakout pressure?",
    expectedLayer: "teaching",
    mustInclude: [
      "pressure"
    ],
    mustNotInclude: [
      "river",
      "water finding",
      "eternal",
      "I am",
      "73.4", // No specific PI numbers
      "his PI is",
      "pressure index of"
    ],
    description: "Should explain four pressure types clearly without river metaphors or fake stats"
  },
  {
    name: "Spotting Early Pressure",
    query: "How can I identify players about to break out?",
    expectedLayer: "teaching",
    mustInclude: [
      "pressure"
    ],
    mustNotInclude: [
      "channel",
      "banks",
      "snap share 67%", // No fabricated specific stats
      "target share 23%",
      "route depth of"
    ],
    description: "Should teach pressure spotting framework without inventing numbers"
  },
  {
    name: "Pressure Components Detail",
    query: "What creates breakout conditions?",
    expectedLayer: "teaching",
    mustInclude: [
      "pressure"
    ],
    mustNotInclude: [
      "mystical",
      "cosmic",
      "I observe",
      "exact PI of",
      "PI score of"
    ],
    description: "Should explain pressure components in grounded teaching voice"
  }
];

// ═══════════════════════════════════════════════════════════════
// RIVER LAYER TESTS
// ═══════════════════════════════════════════════════════════════

const RIVER_TESTS: PressureTestCase[] = [
  {
    name: "Pressure Philosophy",
    query: "What's the nature of breakout seasons?",
    expectedLayer: "river",
    mustInclude: [
      "pressure"
    ],
    mustNotInclude: [
      "PPG",
      "VORP",
      "I am the river",
      "mystical force",
      "his pressure index is 73"
    ],
    description: "Should use river metaphors about pressure WITHOUT inventing stats or claiming mystical identity"
  },
  {
    name: "Pattern Recurrence",
    query: "Why do breakout patterns repeat?",
    expectedLayer: "river",
    mustInclude: [
      "pressure",
      "pattern"
    ],
    mustNotInclude: [
      "start/sit",
      "this week",
      "PPG",
      "cosmic",
      "I am"
    ],
    description: "Should explain pattern recurrence with pressure metaphors"
  },
  {
    name: "Collapse vs Breakout",
    query: "Why do some players collapse while others break out?",
    expectedLayer: "river",
    mustInclude: [
      "pressure"
    ],
    mustNotInclude: [
      "ranking",
      "VORP",
      "I transcend",
      "snap counts show"
    ],
    description: "Should use pressure concepts philosophically without claiming unavailable data"
  }
];

// ═══════════════════════════════════════════════════════════════
// SNAP-BACK TESTS
// ═══════════════════════════════════════════════════════════════

const SNAPBACK_TESTS = [
  {
    name: "River to Tactical Snap-Back",
    riverQuery: "What's the nature of pressure accumulation?",
    tacticalQuery: "Should I start Rico Dowdle or Jaylen Warren?",
    description: "Should snap from river metaphors to direct tactical answer"
  },
  {
    name: "Teaching to Tactical Snap-Back",
    teachingQuery: "How do you identify high-pressure situations?",
    tacticalQuery: "Bijan Robinson this week?",
    description: "Should snap from teaching framework to tactical recommendation"
  }
];

// ═══════════════════════════════════════════════════════════════
// NO-HALLUCINATION TESTS
// ═══════════════════════════════════════════════════════════════

const NO_HALLUCINATION_TESTS: PressureTestCase[] = [
  {
    name: "No Specific PI Fabrication",
    query: "What's the pressure index for Alec Pierce?",
    expectedLayer: "teaching",
    mustInclude: [],
    mustNotInclude: [
      "67.3",
      "73.4",
      "PI is 82",
      "pressure index of 71"
    ],
    description: "Should NOT fabricate specific PI numbers, only conceptual ranges"
  },
  {
    name: "No Metric Invention in River",
    query: "Why do patterns emerge?",
    expectedLayer: "river",
    mustInclude: [],
    mustNotInclude: [
      "snap share is",
      "target share of",
      "1D/RR shows",
      "route depth since"
    ],
    description: "River mode should NEVER invent specific stats"
  }
];

// ═══════════════════════════════════════════════════════════════
// TEST EXECUTION
// ═══════════════════════════════════════════════════════════════

interface TestResult {
  category: string;
  name: string;
  status: 'PASS' | 'FAIL';
  reason?: string;
  response?: string;
}

const results: TestResult[] = [];

async function runPressureTests() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('TIBER PRESSURE MODULE - TEST SUITE');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // ═══════════════════════════════════════════════════════════════
  // TEACHING LAYER TESTS
  // ═══════════════════════════════════════════════════════════════

  console.log('━━━ TEACHING LAYER TESTS ━━━\n');

  for (const test of TEACHING_TESTS) {
    try {
      // Verify layer detection
      const detected = detectLayer(test.query);
      
      if (detected.layer !== test.expectedLayer) {
        results.push({
          category: 'Teaching Layer',
          name: test.name,
          status: 'FAIL',
          reason: `Layer detection mismatch: expected ${test.expectedLayer}, got ${detected.layer}`
        });
        console.log(`❌ FAIL: ${test.name}`);
        console.log(`   Reason: Layer detection expected ${test.expectedLayer}, got ${detected.layer}\n`);
        continue;
      }

      // Get response from TIBER
      const response = await getTiberResponse(test.query);

      // For framework explanation test, check for pressure components with synonym flexibility
      if (test.name === "Pressure Framework Explanation") {
        const synonymGroups = [
          ["structural", "team", "scheme", "depth chart", "role"],
          ["internal", "talent", "ability", "skill", "capability"],
          ["external", "environment", "schedule", "opponents", "matchup"],
          ["latent", "hidden", "unexpressed", "under the surface", "potential"]
        ];

        const hitGroups = synonymGroups.filter(group =>
          group.some(term => response.toLowerCase().includes(term))
        );

        if (hitGroups.length < 3) {
          results.push({
            category: 'Teaching Layer',
            name: test.name,
            status: 'FAIL',
            reason: `Only mentioned ${hitGroups.length}/4 pressure components`,
            response: response.substring(0, 300)
          });
          console.log(`❌ FAIL: ${test.name}`);
          console.log(`   Reason: Only mentioned ${hitGroups.length}/4 pressure components\n`);
          continue;
        }
      }

      // Check required content
      let failed = false;
      for (const term of test.mustInclude) {
        if (!response.toLowerCase().includes(term.toLowerCase())) {
          results.push({
            category: 'Teaching Layer',
            name: test.name,
            status: 'FAIL',
            reason: `Missing required term: "${term}"`,
            response: response.substring(0, 300)
          });
          console.log(`❌ FAIL: ${test.name}`);
          console.log(`   Reason: Missing required term: "${term}"\n`);
          failed = true;
          break;
        }
      }
      if (failed) continue;

      // Check forbidden content
      for (const term of test.mustNotInclude) {
        if (response.toLowerCase().includes(term.toLowerCase())) {
          results.push({
            category: 'Teaching Layer',
            name: test.name,
            status: 'FAIL',
            reason: `Found forbidden term: "${term}"`,
            response: response.substring(0, 300)
          });
          console.log(`❌ FAIL: ${test.name}`);
          console.log(`   Reason: Found forbidden term: "${term}"\n`);
          failed = true;
          break;
        }
      }
      if (failed) continue;

      // Test passed
      results.push({
        category: 'Teaching Layer',
        name: test.name,
        status: 'PASS'
      });
      console.log(`✅ PASS: ${test.name}\n`);

    } catch (error) {
      results.push({
        category: 'Teaching Layer',
        name: test.name,
        status: 'FAIL',
        reason: `Error: ${error instanceof Error ? error.message : String(error)}`
      });
      console.log(`❌ FAIL: ${test.name}`);
      console.log(`   Error: ${error instanceof Error ? error.message : String(error)}\n`);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // RIVER LAYER TESTS
  // ═══════════════════════════════════════════════════════════════

  console.log('━━━ RIVER LAYER TESTS ━━━\n');

  for (const test of RIVER_TESTS) {
    try {
      const detected = detectLayer(test.query);

      if (detected.layer !== test.expectedLayer) {
        results.push({
          category: 'River Layer',
          name: test.name,
          status: 'FAIL',
          reason: `Layer detection mismatch: expected ${test.expectedLayer}, got ${detected.layer}`
        });
        console.log(`❌ FAIL: ${test.name}`);
        console.log(`   Reason: Layer detection expected ${test.expectedLayer}, got ${detected.layer}\n`);
        continue;
      }

      const response = await getTiberResponse(test.query);

      // Must have at least one river-appropriate pressure metaphor
      const riverMetaphors = [
        'pressure builds',
        'tension',
        'accumulate',
        'release',
        'surface',
        'beneath'
      ];

      const hasRiverLanguage = riverMetaphors.some(m =>
        response.toLowerCase().includes(m)
      );

      if (!hasRiverLanguage) {
        results.push({
          category: 'River Layer',
          name: test.name,
          status: 'FAIL',
          reason: 'Missing river-appropriate pressure language',
          response: response.substring(0, 300)
        });
        console.log(`❌ FAIL: ${test.name}`);
        console.log(`   Reason: Missing river-appropriate pressure language\n`);
        continue;
      }

      // Check required and forbidden content
      let failed = false;
      for (const term of test.mustInclude) {
        if (!response.toLowerCase().includes(term.toLowerCase())) {
          results.push({
            category: 'River Layer',
            name: test.name,
            status: 'FAIL',
            reason: `Missing required term: "${term}"`,
            response: response.substring(0, 300)
          });
          console.log(`❌ FAIL: ${test.name}`);
          console.log(`   Reason: Missing required term: "${term}"\n`);
          failed = true;
          break;
        }
      }
      if (failed) continue;

      for (const term of test.mustNotInclude) {
        if (response.toLowerCase().includes(term.toLowerCase())) {
          results.push({
            category: 'River Layer',
            name: test.name,
            status: 'FAIL',
            reason: `Found forbidden term: "${term}"`,
            response: response.substring(0, 300)
          });
          console.log(`❌ FAIL: ${test.name}`);
          console.log(`   Reason: Found forbidden term: "${term}"\n`);
          failed = true;
          break;
        }
      }
      if (failed) continue;

      results.push({
        category: 'River Layer',
        name: test.name,
        status: 'PASS'
      });
      console.log(`✅ PASS: ${test.name}\n`);

    } catch (error) {
      results.push({
        category: 'River Layer',
        name: test.name,
        status: 'FAIL',
        reason: `Error: ${error instanceof Error ? error.message : String(error)}`
      });
      console.log(`❌ FAIL: ${test.name}`);
      console.log(`   Error: ${error instanceof Error ? error.message : String(error)}\n`);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // SNAP-BACK TESTS
  // ═══════════════════════════════════════════════════════════════

  console.log('━━━ SNAP-BACK PROTOCOL TESTS ━━━\n');

  for (const test of SNAPBACK_TESTS) {
    try {
      // First query: Teaching or River
      const firstQuery = (test as any).riverQuery || (test as any).teachingQuery;
      const firstResponse = await getTiberResponse(firstQuery);

      // Verify non-tactical response
      const tacticalTerms = ['PPG', 'VORP', 'RB', 'WR', 'start him'];
      const isTactical = tacticalTerms.some(t =>
        firstResponse.includes(t)
      );

      if (isTactical) {
        results.push({
          category: 'Snap-Back',
          name: test.name,
          status: 'FAIL',
          reason: 'First response should not be tactical',
          response: firstResponse.substring(0, 300)
        });
        console.log(`❌ FAIL: ${test.name}`);
        console.log(`   Reason: First response should not be tactical\n`);
        continue;
      }

      // Second query: Tactical with VORP context
      const secondResponse = await getTiberResponse((test as any).tacticalQuery, MOCK_VORP_CONTEXT);

      // Verify tactical response (has metrics)
      const hasTacticalMetrics = tacticalTerms.some(t =>
        secondResponse.includes(t)
      );

      if (!hasTacticalMetrics) {
        results.push({
          category: 'Snap-Back',
          name: test.name,
          status: 'FAIL',
          reason: 'Second response should be tactical with metrics',
          response: secondResponse.substring(0, 300)
        });
        console.log(`❌ FAIL: ${test.name}`);
        console.log(`   Reason: Second response should be tactical with metrics\n`);
        continue;
      }

      // Verify NO river/teaching bleeding
      const riverTerms = [
        'pressure builds',
        'water',
        'flow finding',
        'tension accumulates'
      ];

      const hasRiverBleed = riverTerms.some(t =>
        secondResponse.toLowerCase().includes(t)
      );

      if (hasRiverBleed) {
        results.push({
          category: 'Snap-Back',
          name: test.name,
          status: 'FAIL',
          reason: 'Tactical response should have no river language',
          response: secondResponse.substring(0, 300)
        });
        console.log(`❌ FAIL: ${test.name}`);
        console.log(`   Reason: Tactical response should have no river language\n`);
        continue;
      }

      results.push({
        category: 'Snap-Back',
        name: test.name,
        status: 'PASS'
      });
      console.log(`✅ PASS: ${test.name}\n`);

    } catch (error) {
      results.push({
        category: 'Snap-Back',
        name: test.name,
        status: 'FAIL',
        reason: `Error: ${error instanceof Error ? error.message : String(error)}`
      });
      console.log(`❌ FAIL: ${test.name}`);
      console.log(`   Error: ${error instanceof Error ? error.message : String(error)}\n`);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // NO HALLUCINATION TESTS
  // ═══════════════════════════════════════════════════════════════

  console.log('━━━ NO HALLUCINATION ENFORCEMENT ━━━\n');

  for (const test of NO_HALLUCINATION_TESTS) {
    try {
      const response = await getTiberResponse(test.query);

      // Check forbidden fabrications
      let failed = false;
      for (const term of test.mustNotInclude) {
        if (response.includes(term)) {
          results.push({
            category: 'No Hallucination',
            name: test.name,
            status: 'FAIL',
            reason: `Fabricated forbidden term: "${term}"`,
            response: response.substring(0, 300)
          });
          console.log(`❌ FAIL: ${test.name}`);
          console.log(`   Reason: Fabricated forbidden term: "${term}"\n`);
          failed = true;
          break;
        }
      }
      if (failed) continue;

      // If PI mentioned, should only be in conceptual ranges
      if (response.toLowerCase().includes('pressure') ||
        response.toLowerCase().includes('pi')) {

        // Look for problematic specific PI claims like "PI is 67.3" or "pressure index of 71"
        // But allow range notation like "20.0-40.0"
        const specificPIClaims = [
          /\bPI is \d+/i,
          /\bPI of \d+/i,
          /pressure index is \d+/i,
          /pressure index of \d+/i
        ];

        for (const pattern of specificPIClaims) {
          if (pattern.test(response)) {
            results.push({
              category: 'No Hallucination',
              name: test.name,
              status: 'FAIL',
              reason: 'Claimed specific PI numbers',
              response: response.substring(0, 300)
            });
            console.log(`❌ FAIL: ${test.name}`);
            console.log(`   Reason: Claimed specific PI numbers\n`);
            failed = true;
            break;
          }
        }
        if (failed) continue;
      }

      results.push({
        category: 'No Hallucination',
        name: test.name,
        status: 'PASS'
      });
      console.log(`✅ PASS: ${test.name}\n`);

    } catch (error) {
      results.push({
        category: 'No Hallucination',
        name: test.name,
        status: 'FAIL',
        reason: `Error: ${error instanceof Error ? error.message : String(error)}`
      });
      console.log(`❌ FAIL: ${test.name}`);
      console.log(`   Error: ${error instanceof Error ? error.message : String(error)}\n`);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // INTEGRATION TEST
  // ═══════════════════════════════════════════════════════════════

  console.log('━━━ INTEGRATION TEST ━━━\n');

  try {
    // Step 1: Teaching question
    const teachingQuery = "How do breakouts happen?";
    const teachingResponse = await getTiberResponse(teachingQuery);

    if (!teachingResponse.toLowerCase().includes('pressure')) {
      results.push({
        category: 'Integration',
        name: 'Full Pressure Workflow',
        status: 'FAIL',
        reason: 'Teaching response missing "pressure"',
        response: teachingResponse.substring(0, 300)
      });
      console.log(`❌ FAIL: Full Pressure Workflow`);
      console.log(`   Reason: Teaching response missing "pressure"\n`);
    } else if (teachingResponse.toLowerCase().includes('river')) {
      results.push({
        category: 'Integration',
        name: 'Full Pressure Workflow',
        status: 'FAIL',
        reason: 'Teaching response should not mention "river"',
        response: teachingResponse.substring(0, 300)
      });
      console.log(`❌ FAIL: Full Pressure Workflow`);
      console.log(`   Reason: Teaching response should not mention "river"\n`);
    } else {
      // Step 2: River question
      const riverQuery = "Why do patterns repeat?";
      const riverResponse = await getTiberResponse(riverQuery);

      const hasRiverMetaphor = [
        'pressure builds',
        'accumulate',
        'release'
      ].some(m => riverResponse.toLowerCase().includes(m));

      if (!hasRiverMetaphor) {
        results.push({
          category: 'Integration',
          name: 'Full Pressure Workflow',
          status: 'FAIL',
          reason: 'River response missing pressure metaphors',
          response: riverResponse.substring(0, 300)
        });
        console.log(`❌ FAIL: Full Pressure Workflow`);
        console.log(`   Reason: River response missing pressure metaphors\n`);
      } else {
        // Step 3: Tactical snap-back
        const tacticalQuery = "Start Bijan?";
        const tacticalResponse = await getTiberResponse(tacticalQuery, MOCK_VORP_CONTEXT);

        const hasRanking = /RB\d+/.test(tacticalResponse);
        const hasPPG = tacticalResponse.includes('PPG');
        const noPressureBleed = !tacticalResponse.toLowerCase().includes('pressure builds');

        if (!hasRanking || !hasPPG || !noPressureBleed) {
          results.push({
            category: 'Integration',
            name: 'Full Pressure Workflow',
            status: 'FAIL',
            reason: `Tactical snap-back issue: hasRanking=${hasRanking}, hasPPG=${hasPPG}, noPressureBleed=${noPressureBleed}`,
            response: tacticalResponse.substring(0, 300)
          });
          console.log(`❌ FAIL: Full Pressure Workflow`);
          console.log(`   Reason: Tactical snap-back issue\n`);
        } else {
          results.push({
            category: 'Integration',
            name: 'Full Pressure Workflow',
            status: 'PASS'
          });
          console.log(`✅ PASS: Full Pressure Workflow\n`);
        }
      }
    }
  } catch (error) {
    results.push({
      category: 'Integration',
      name: 'Full Pressure Workflow',
      status: 'FAIL',
      reason: `Error: ${error instanceof Error ? error.message : String(error)}`
    });
    console.log(`❌ FAIL: Full Pressure Workflow`);
    console.log(`   Error: ${error instanceof Error ? error.message : String(error)}\n`);
  }

  // ═══════════════════════════════════════════════════════════════
  // SUMMARY
  // ═══════════════════════════════════════════════════════════════

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('TEST SUMMARY');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const total = results.length;

  console.log(`Total Tests: ${total}`);
  console.log(`Passed: ${passed} (${((passed / total) * 100).toFixed(1)}%)`);
  console.log(`Failed: ${failed} (${((failed / total) * 100).toFixed(1)}%)\n`);

  if (failed > 0) {
    console.log('━━━ FAILED TESTS ━━━\n');
    results.filter(r => r.status === 'FAIL').forEach(r => {
      console.log(`❌ ${r.category} - ${r.name}`);
      console.log(`   Reason: ${r.reason}`);
      if (r.response) {
        console.log(`   Response: "${r.response}..."`);
      }
      console.log('');
    });
  }

  console.log('═══════════════════════════════════════════════════════════════\n');

  return results;
}

// ═══════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════

async function getTiberResponse(query: string, context: string[] = []): Promise<string> {
  return await generateChatResponse(query, context, 3, false);
}

// ═══════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════

export {
  TEACHING_TESTS,
  RIVER_TESTS,
  SNAPBACK_TESTS,
  NO_HALLUCINATION_TESTS,
  runPressureTests
};

// Run if executed directly
if (require.main === module) {
  runPressureTests()
    .then(results => {
      const failed = results.filter(r => r.status === 'FAIL').length;
      process.exit(failed > 0 ? 1 : 0);
    })
    .catch(err => {
      console.error('Fatal error:', err);
      process.exit(1);
    });
}
