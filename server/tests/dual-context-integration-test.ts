import { generateChatResponse, generateEmbedding } from '../services/geminiEmbeddings';
import { db } from '../infra/db';
import { sql } from 'drizzle-orm';

async function testDualContextIntegration() {
  console.log('🏈 Testing 2024 Baseline + 2025 VORP Dual-Context Integration\n');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  const tests = [
    {
      name: 'Test 1: 2024 Baseline Retrieval with Temporal Framing',
      query: 'Tell me about Saquon Barkley\'s 2024 season performance',
      validations: [
        {
          check: (response: string) => /\b(2024|last season|last year)/i.test(response),
          description: 'Contains temporal markers (2024, last season, etc.)',
        },
        {
          check: (response: string) => /\b(had|was|finished)\b/i.test(response),
          description: 'Uses past tense for 2024 data',
        },
        {
          check: (response: string) => /(2005.*rush.*yard|rush.*yard.*2005)/i.test(response),
          description: 'Cites correct 2024 rush yards (2005)',
        },
        {
          check: (response: string) => !/\b(has|is)\s+(2005|rush.*yard)/i.test(response),
          description: 'Does NOT use present tense for 2024 stats',
        },
      ],
    },
    {
      name: 'Test 2: Dual-Context Integration (2024 + 2025)',
      query: 'How is Saquon Barkley doing this season compared to last year?',
      validations: [
        {
          check: (response: string) => /2024/i.test(response) && /2025|current.*season|this.*season/i.test(response),
          description: 'References both 2024 and 2025 contexts',
        },
        {
          check: (response: string) => /(PPG|points.*per.*game|VORP)/i.test(response),
          description: 'Includes current 2025 VORP metrics (PPG, VORP)',
        },
        {
          check: (response: string) => /(RB\d+|position.*rank)/i.test(response),
          description: 'Includes position ranking',
        },
      ],
    },
    {
      name: 'Test 3: Historical Pattern Teaching (No 2025 Hallucination)',
      query: 'What does elite RB production look like? Should I expect breakout from my RB with increasing touches?',
      validations: [
        {
          check: (response: string) => /(historical|2017.*2024|pattern|typically|correlate)/i.test(response),
          description: 'References historical patterns for teaching',
        },
        {
          check: (response: string) => !/(current.*snap.*share|2025.*snap|his.*snap.*share.*\d+%)/i.test(response),
          description: 'Does NOT cite specific 2025 snap share values',
        },
        {
          check: (response: string) => !/(his.*YPC.*\d+\.\d+|YPC.*trend.*up|YPC.*trend.*down)/i.test(response),
          description: 'Does NOT cite 2025 YPC trends or values',
        },
        {
          check: (response: string) => /(don't have|can't provide|unavailable).*data/i.test(response) || /(rank|PPG|VORP)/i.test(response),
          description: 'Either acknowledges data gaps OR provides available metrics only',
        },
      ],
    },
    {
      name: 'Test 4: Elite Baseline Teaching (TE Position)',
      query: 'What should I look for in an elite tight end?',
      validations: [
        {
          check: (response: string) => /(Bowers|Kittle|McBride|Kelce)/i.test(response),
          description: 'References elite 2024 TE examples',
        },
        {
          check: (response: string) => /2024|last.*season|historically/i.test(response),
          description: 'Uses temporal framing for baseline references',
        },
        {
          check: (response: string) => !/(he.*has|they.*have).*\d+.*yard.*2024/i.test(response),
          description: 'Does NOT use present tense when citing 2024 stats',
        },
      ],
    },
    {
      name: 'Test 5: Year Separation Enforcement',
      query: 'Tell me about Derrick Henry',
      validations: [
        {
          check: (response: string) => {
            const has2024Context = /(2024|last.*season).*Henry/i.test(response);
            const has2025Context = /(2025|current|this.*season).*Henry/i.test(response) || /(PPG|VORP|RB\d+)/i.test(response);
            return !has2024Context || (has2024Context && has2025Context);
          },
          description: 'If 2024 mentioned, also includes current 2025 context (dual-context pattern)',
        },
        {
          check: (response: string) => {
            const mentionedStats = response.match(/(\d{3,4})\s*(rush|receiving)?\s*yard/gi);
            if (!mentionedStats) return true;
            return mentionedStats.every(stat => /2024|last|was|had/i.test(response.substring(Math.max(0, response.indexOf(stat) - 50), response.indexOf(stat))));
          },
          description: 'Any yard totals are clearly framed as 2024 historical data',
        },
      ],
    },
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    console.log(`\n📝 ${test.name}`);
    console.log(`Query: "${test.query}"\n`);

    try {
      // Step 1: Generate embedding for query
      const queryEmbedding = await generateEmbedding(test.query);
      const vectorString = `[${queryEmbedding.join(',')}]`;

      // Step 2: Retrieve relevant chunks from database
      const searchResult = await db.execute(
        sql`SELECT 
              content, 
              metadata
            FROM chunks
            ORDER BY embedding <-> ${vectorString}::vector
            LIMIT 5`
      );

      const context = searchResult.rows.map((row: any) => row.content);
      console.log(`  Retrieved ${context.length} chunks from database`);

      // Step 3: Generate response with context
      const response = await generateChatResponse(test.query, context, 1, false);

      console.log(`Response Preview (first 400 chars):`);
      console.log(`"${response.substring(0, 400)}..."\n`);

      let testPassed = true;
      for (const validation of test.validations) {
        const result = validation.check(response);
        const status = result ? '✅' : '❌';
        console.log(`  ${status} ${validation.description}`);
        if (!result) testPassed = false;
      }

      if (testPassed) {
        console.log(`\n✅ ${test.name} PASSED`);
        passed++;
      } else {
        console.log(`\n❌ ${test.name} FAILED`);
        console.log(`Full Response:\n${response}`);
        failed++;
      }

    } catch (error) {
      console.log(`\n❌ ${test.name} ERROR: ${error instanceof Error ? error.message : String(error)}`);
      failed++;
    }

    console.log('\n' + '─'.repeat(67));
  }

  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('📊 DUAL-CONTEXT INTEGRATION TEST RESULTS');
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log(`Total Tests: ${tests.length}`);
  console.log(`✅ Passed: ${passed} (${((passed / tests.length) * 100).toFixed(1)}%)`);
  console.log(`❌ Failed: ${failed} (${((failed / tests.length) * 100).toFixed(1)}%)`);
  console.log('═══════════════════════════════════════════════════════════════════\n');

  if (passed === tests.length) {
    console.log('🎉 All dual-context integration tests passed!\n');
    console.log('Verified:');
    console.log('  ✅ 2024 baseline data retrieval works');
    console.log('  ✅ Proper temporal framing (past tense, year markers)');
    console.log('  ✅ Dual-context integration is natural');
    console.log('  ✅ Year separation enforced (2024 ≠ 2025)');
    console.log('  ✅ Historical patterns taught without 2025 hallucination');
  } else {
    console.log('⚠️  Some dual-context tests failed. Review failures above.');
  }
}

testDualContextIntegration().catch(console.error);
