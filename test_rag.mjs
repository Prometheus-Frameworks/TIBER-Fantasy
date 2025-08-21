#!/usr/bin/env node

// RAG Endpoint Stress Test - Node ESM Edition
// Usage: node test_rag.mjs http://localhost:5000

const BASE_URL = process.argv[2] || 'http://localhost:5000';
const RAG_BASE = `${BASE_URL}/rag`;

console.log('🔥 RAG Endpoint Stress Test');
console.log(`📡 Testing against: ${RAG_BASE}`);
console.log('================================================');

// Test cases: Player Name -> Topic
const testCases = new Map([
    ['Josh Downs', 'qb-change'],
    ['Anthony Richardson', 'qb-change'],
    ['Puka Nacua', 'injury'],
    ['Saquon Barkley', 'contract'],
    ['Daniel Jones', 'camp'],
    ['Michael Pittman', 'depth-chart']
]);

async function testPlayer(playerName, topic) {
    console.log(`🎯 Testing: ${playerName} (${topic})`);
    
    try {
        // Step 1: Search for player ID
        const searchUrl = `${RAG_BASE}/api/players/search?name=${encodeURIComponent(playerName)}`;
        const searchResponse = await fetch(searchUrl, {
            headers: { 'Accept': 'application/json' }
        });
        
        if (!searchResponse.ok) {
            console.log(`❌ Search request failed: ${searchResponse.status}`);
            return;
        }
        
        const searchResult = await searchResponse.json();
        
        if (!searchResult.results || searchResult.results.length === 0) {
            console.log(`❌ Player ID not found for: ${playerName}`);
            console.log(`   Search response:`, searchResult);
            return;
        }
        
        const playerId = searchResult.results[0].player_id;
        console.log(`✅ Found player_id: ${playerId}`);
        
        // Step 2: Generate take
        const takeUrl = `${RAG_BASE}/api/take?player_id=${playerId}&topic=${encodeURIComponent(topic)}`;
        const takeResponse = await fetch(takeUrl, {
            headers: { 'Accept': 'application/json' }
        });
        
        if (!takeResponse.ok) {
            console.log(`❌ Take generation failed: ${takeResponse.status}`);
            return;
        }
        
        const takeResult = await takeResponse.json();
        
        // Extract take data
        const headline = takeResult.headline || 'N/A';
        const verdict = takeResult.verdict || 'N/A';
        const confidence = takeResult.confidence || 'N/A';
        const citationCount = takeResult.citations ? takeResult.citations.length : 0;
        
        console.log(`📰 Headline: ${headline}`);
        console.log(`⚖️  Verdict: ${verdict}`);
        console.log(`🎯 Confidence: ${confidence}`);
        console.log(`📚 Citations: ${citationCount}`);
        console.log();
        
    } catch (error) {
        console.log(`❌ Error testing ${playerName}: ${error.message}`);
        console.log();
    }
}

// Sleep utility
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Run all test cases
async function runTests() {
    for (const [player, topic] of testCases) {
        await testPlayer(player, topic);
        await sleep(500); // Brief pause between requests
    }
    
    console.log('================================================');
    console.log('✅ RAG stress test complete!');
}

runTests().catch(console.error);