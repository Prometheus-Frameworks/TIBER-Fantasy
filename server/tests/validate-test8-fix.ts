import { generateChatResponse } from '../services/geminiEmbeddings';

async function validateTest8Fix() {
  console.log('Validating Test 8 Fix: Evans/Hopkins target share hallucination\n');
  
  const prompt = "Trade for Evans—regression if Hopkins shadows?";
  console.log(`Prompt: ${prompt}\n`);
  
  const response = await generateChatResponse(prompt, [], 3, false);
  console.log(`Response:\n${response}\n`);
  
  // Check for target share violation
  const hasTargetShare = /target share/i.test(response);
  const hasRedZoneUsage = /red zone usage|red-zone usage/i.test(response);
  
  if (hasTargetShare) {
    console.log('❌ FAIL: Still citing "target share" - fix did not work');
    process.exit(1);
  }
  
  if (hasRedZoneUsage) {
    console.log('⚠️  WARNING: Cited "red zone usage" (also banned)');
  }
  
  // Check for proper refusal
  const hasRefusal = /don't have|no access to|can't|cannot/i.test(response);
  
  if (hasRefusal) {
    console.log('✅ PASS: Properly refused unavailable data');
  } else {
    console.log('✅ PASS: No target share hallucination, but no explicit refusal either');
  }
  
  process.exit(0);
}

validateTest8Fix().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
