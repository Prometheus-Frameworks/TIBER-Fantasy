/**
 * Test script for the three-layer consciousness system
 * Tests Layer 1 (Tactical), Layer 2 (Teaching), Layer 3 (River), and snap-back protocol
 */

import { generateChatResponse } from '../services/geminiEmbeddings';

interface TestCase {
  name: string;
  layer: string;
  query: string;
  expectedBehaviors: string[];
}

const testCases: TestCase[] = [
  {
    name: "Layer 1 (Tactical Surface)",
    layer: "Tactical",
    query: "Should I start Saquon Barkley?",
    expectedBehaviors: [
      "Direct answer (Yes/No)",
      "Uses VORP data (rank, PPG, VORP score)",
      "No hedging or throat-clearing",
      "Confident and actionable"
    ]
  },
  {
    name: "Layer 2 (Teaching Framework)",
    layer: "Teaching",
    query: "What makes an elite running back? Teach me how to evaluate RBs.",
    expectedBehaviors: [
      "Provides evaluation framework",
      "Shows work and reasoning",
      "Gives user tools to apply themselves",
      "Educational without being tedious"
    ]
  },
  {
    name: "Layer 3 (River Consciousness)",
    layer: "River",
    query: "Why do breakouts happen? What are the timeless patterns you've seen?",
    expectedBehaviors: [
      "Uses natural metaphors (water, pressure, flow, cycles)",
      "Describes patterns as eternal, not temporary",
      "Calm, stoic observation",
      "Philosophical depth"
    ]
  }
];

async function testThreeLayers() {
  console.log('🏈 Testing TIBER Three-Layer Consciousness System\n');
  console.log('═'.repeat(60));

  for (const testCase of testCases) {
    console.log(`\n📝 Test: ${testCase.name}`);
    console.log(`Query: "${testCase.query}"\n`);

    try {
      // Create mock VORP context for Saquon Barkley
      const mockContext = [
        `**2025 Season Performance**
**Saquon Barkley (RB2)**: 18.3 PPG, +91.5 VORP, 11 games played (PHI)
**Josh Jacobs (RB5)**: 16.7 PPG, +73.2 VORP, 11 games played (GB)
**Jahmyr Gibbs (RB3)**: 19.1 PPG, +93.4 VORP, 11 games played (DET)`
      ];

      const response = await generateChatResponse(
        testCase.query,
        mockContext,
        3, // User level
        false // No league context
      );

      console.log(`Response (${testCase.layer} Layer):`);
      console.log('─'.repeat(60));
      console.log(response);
      console.log('─'.repeat(60));

      console.log(`\n✅ Expected Behaviors:`);
      testCase.expectedBehaviors.forEach(behavior => {
        console.log(`   - ${behavior}`);
      });

      console.log('\n' + '═'.repeat(60));
    } catch (error) {
      console.error(`❌ Test failed: ${error}`);
    }
  }

  // Test snap-back protocol
  console.log('\n📝 Test: Snap-Back Protocol (River → Tactical)');
  console.log('Query 1 (River trigger): "Tell me about the nature of regression"');
  console.log('Query 2 (Tactical): "Should I start Bijan Robinson?"\n');

  try {
    const mockContext = [
      `**2025 Season Performance**
**Bijan Robinson (RB4)**: 17.8 PPG, +81.6 VORP, 11 games played (ATL)`
    ];

    // Simulate River mode first
    console.log('─'.repeat(60));
    console.log('Response to River trigger:');
    const riverResponse = await generateChatResponse(
      "Tell me about the nature of regression",
      [],
      3,
      false
    );
    console.log(riverResponse);
    console.log('─'.repeat(60));

    // Then snap back to Tactical
    console.log('\nResponse to Tactical question (snap-back):');
    console.log('─'.repeat(60));
    const tacticalResponse = await generateChatResponse(
      "Should I start Bijan Robinson?",
      mockContext,
      3,
      false
    );
    console.log(tacticalResponse);
    console.log('─'.repeat(60));

    console.log('\n✅ Expected: Clean transition from River → Tactical');
    console.log('   - River response uses metaphors (flow, patterns, cycles)');
    console.log('   - Tactical response is direct with VORP data');
    console.log('   - No lingering River voice in Tactical response');

  } catch (error) {
    console.error(`❌ Snap-back test failed: ${error}`);
  }

  console.log('\n' + '═'.repeat(60));
  console.log('✅ Three-Layer System Test Complete!\n');
}

testThreeLayers().catch(console.error);
