import axios from 'axios';

const BASE_URL = 'http://localhost:5000';

interface ChatResponse {
  success: boolean;
  session_id: string;
  response: string;
  sources: Array<{
    chunk_id: number;
    relevance_score: number;
    content_preview: string;
    metadata: any;
  }>;
}

async function testRAGChat(message: string): Promise<ChatResponse> {
  const response = await axios.post(`${BASE_URL}/api/rag/chat`, {
    message,
    user_level: 3
  });
  
  return response.data;
}

async function runChatTests() {
  console.log('💬 Starting QB Stats RAG Chat Integration Tests...\n');
  
  try {
    // Test 1: Query about Lamar's 2024 performance
    console.log('Test 1: "How did Lamar Jackson perform in 2024?"');
    console.log('─'.repeat(60));
    
    const test1 = await testRAGChat("How did Lamar Jackson perform in 2024?");
    
    console.log('TIBER Response:');
    console.log(test1.response);
    console.log('\nRetrieved Sources:');
    if (test1.sources && test1.sources.length > 0) {
      test1.sources.forEach((source, idx) => {
        console.log(`  ${idx + 1}. ${source.metadata?.player_id || 'General'} (relevance: ${(source.relevance_score * 100).toFixed(1)}%)`);
      });
    } else {
      console.log('  No sources returned');
    }
    
    // Verify TIBER cites the stats
    const cites4172Yards = test1.response.includes('4172') || test1.response.includes('4,172');
    const cites41TDs = test1.response.includes('41 TD') || test1.response.includes('41 touchdown');
    const cites4INTs = test1.response.includes('4 INT') || test1.response.includes('4 interception');
    const cites119Rating = test1.response.includes('119.6') || test1.response.includes('119');
    const frames2024 = test1.response.toLowerCase().includes('2024');
    
    console.log('\n✓ Verification:');
    console.log(`  Cites 4172 yards: ${cites4172Yards ? '✅' : '❌'}`);
    console.log(`  Cites 41 TDs: ${cites41TDs ? '✅' : '❌'}`);
    console.log(`  Cites 4 INTs: ${cites4INTs ? '✅' : '❌'}`);
    console.log(`  Cites 119.6 rating: ${cites119Rating ? '✅' : '❌'}`);
    console.log(`  Frames as 2024 data: ${frames2024 ? '✅' : '❌'}`);
    
    const test1Pass = cites4172Yards && cites41TDs && frames2024;
    console.log(`\nTest 1: ${test1Pass ? '✅ PASS' : '❌ FAIL'}\n\n`);
    
    // Test 2: "Is Lamar elite?" - should reference BOTH 2024 baseline AND current 2025 ranking
    console.log('Test 2: "Is Lamar elite?"');
    console.log('─'.repeat(60));
    
    const test2 = await testRAGChat("Is Lamar elite?");
    
    console.log('TIBER Response:');
    console.log(test2.response);
    console.log('\nRetrieved Sources:');
    if (test2.sources && test2.sources.length > 0) {
      test2.sources.forEach((source, idx) => {
        console.log(`  ${idx + 1}. ${source.metadata?.player_id || 'General'} (relevance: ${(source.relevance_score * 100).toFixed(1)}%)`);
      });
    } else {
      console.log('  No sources returned');
    }
    
    // Verify TIBER references 2024 performance
    const references2024Performance = 
      test2.response.toLowerCase().includes('2024') ||
      test2.response.toLowerCase().includes('last season') ||
      test2.response.toLowerCase().includes('last year');
    
    // Verify TIBER discusses current season
    const discusses2025 = 
      test2.response.toLowerCase().includes('2025') ||
      test2.response.toLowerCase().includes('current') ||
      test2.response.toLowerCase().includes('this season') ||
      test2.response.toLowerCase().includes('this year');
    
    console.log('\n✓ Verification:');
    console.log(`  References 2024 performance: ${references2024Performance ? '✅' : '❌'}`);
    console.log(`  Discusses current (2025) season: ${discusses2025 ? '✅' : '❌'}`);
    
    const test2Pass = references2024Performance;
    console.log(`\nTest 2: ${test2Pass ? '✅ PASS' : '❌ FAIL (but acceptable if discusses current performance)'}\n\n`);
    
    // Test 3: Comparison query
    console.log('Test 3: "Compare Joe Burrow and Jared Goff\'s 2024 seasons"');
    console.log('─'.repeat(60));
    
    const test3 = await testRAGChat("Compare Joe Burrow and Jared Goff's 2024 seasons");
    
    console.log('TIBER Response:');
    console.log(test3.response);
    console.log('\nRetrieved Sources:');
    if (test3.sources && test3.sources.length > 0) {
      test3.sources.forEach((source, idx) => {
        console.log(`  ${idx + 1}. ${source.metadata?.player_id || 'General'} (relevance: ${(source.relevance_score * 100).toFixed(1)}%)`);
      });
    } else {
      console.log('  No sources returned');
    }
    
    const mentionsBurrow = test3.response.includes('Burrow');
    const mentionsGoff = test3.response.includes('Goff');
    const comparesBoth = mentionsBurrow && mentionsGoff;
    
    console.log('\n✓ Verification:');
    console.log(`  Mentions Burrow: ${mentionsBurrow ? '✅' : '❌'}`);
    console.log(`  Mentions Goff: ${mentionsGoff ? '✅' : '❌'}`);
    console.log(`  Compares both: ${comparesBoth ? '✅' : '❌'}`);
    
    const test3Pass = comparesBoth;
    console.log(`\nTest 3: ${test3Pass ? '✅ PASS' : '❌ FAIL'}\n\n`);
    
    // Summary
    console.log('═'.repeat(60));
    console.log('📊 Test Summary:');
    console.log(`  Test 1 (Lamar 2024 stats): ${test1Pass ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`  Test 2 (Lamar elite): ${test2Pass ? '✅ PASS' : '⚠️  PARTIAL'}`);
    console.log(`  Test 3 (Burrow vs Goff): ${test3Pass ? '✅ PASS' : '❌ FAIL'}`);
    console.log('═'.repeat(60));
    
  } catch (error: any) {
    if (error.code === 'ECONNREFUSED') {
      console.error('❌ Server not running. Start the application first with: npm run dev');
    } else {
      console.error('❌ Test failed with error:', error.message);
    }
    process.exit(1);
  }
}

// Run the tests
runChatTests()
  .then(() => {
    console.log('\n✅ Chat integration tests complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Test suite failed:', error);
    process.exit(1);
  });
