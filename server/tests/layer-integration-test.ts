import { generateChatResponse } from '../services/geminiEmbeddings';

async function testLayerIntegration() {
  console.log('🏈 Testing Full Layer Detection Integration\n');
  console.log('═'.repeat(60));

  const testCases = [
    {
      name: "Tactical Query",
      query: "Should I start Saquon Barkley?",
      context: [`**2025 Season Performance**\n**Saquon Barkley (RB2)**: 18.3 PPG, +91.5 VORP, 11 games (PHI)`]
    },
    {
      name: "Teaching Query",
      query: "What makes an elite running back?",
      context: []
    },
    {
      name: "River Query",
      query: "What is the nature of regression in fantasy football?",
      context: []
    }
  ];

  for (const test of testCases) {
    console.log(`\n📝 Test: ${test.name}`);
    console.log(`Query: "${test.query}"\n`);

    try {
      const response = await generateChatResponse(
        test.query,
        test.context,
        3, // User level
        false // No league context
      );

      console.log(`Response:`);
      console.log('─'.repeat(60));
      console.log(response);
      console.log('─'.repeat(60));
      console.log('\n' + '═'.repeat(60));
    } catch (error) {
      console.error(`❌ Test failed:`, error);
    }
  }

  console.log('\n✅ Full integration test complete!\n');
}

testLayerIntegration().catch(console.error);
