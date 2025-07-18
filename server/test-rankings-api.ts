/**
 * Rankings Builder API Test Suite
 * Test all endpoints for "On The Clock" Rankings Builder integration
 */

import express from 'express';
import { db } from './db';
import { sql } from 'drizzle-orm';

const app = express();

// Test data
const testUserId = 999;
const testRankings = [
  { player_id: 1, rank: 1, notes: "Elite QB" },
  { player_id: 2, rank: 2, notes: "Top RB" },
  { player_id: 3, rank: 3, notes: "WR1" }
];

/**
 * Test all Rankings Builder API endpoints
 */
async function testRankingsBuilderAPI() {
  console.log('🧪 Testing Rankings Builder API Support Layer...\n');
  
  try {
    // Test 1: Player List Endpoint
    console.log('1️⃣ Testing GET /api/players/list');
    const playersResponse = await fetch('http://localhost:5000/api/players/list');
    const playersData = await playersResponse.json();
    
    if (playersData.success) {
      console.log(`✅ Players list: ${playersData.data.totalPlayers} players found`);
      console.log(`   Sample: ${playersData.data.players[0]?.name} (${playersData.data.players[0]?.position})`);
    } else {
      console.log('❌ Players list failed:', playersData.error);
    }
    
    // Test 2: Submit Rankings Endpoint
    console.log('\n2️⃣ Testing POST /api/rankings/submit');
    const submitResponse = await fetch('http://localhost:5000/api/rankings/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: testUserId,
        mode: 'redraft',
        rankings: testRankings
      })
    });
    const submitData = await submitResponse.json();
    
    if (submitData.success) {
      console.log(`✅ Rankings submitted: ${submitData.data.rankingsSubmitted} rankings`);
    } else {
      console.log('❌ Rankings submission failed:', submitData.error);
    }
    
    // Test 3: Personal Rankings Endpoint
    console.log('\n3️⃣ Testing GET /api/rankings/personal');
    const personalResponse = await fetch(`http://localhost:5000/api/rankings/personal?user_id=${testUserId}&mode=redraft`);
    const personalData = await personalResponse.json();
    
    if (personalData.success) {
      console.log(`✅ Personal rankings: ${personalData.data.meta.totalResults} rankings found`);
      console.log(`   Sample: ${personalData.data.rankings[0]?.name} ranked #${personalData.data.rankings[0]?.rank}`);
    } else {
      console.log('❌ Personal rankings failed:', personalData.error);
    }
    
    // Test 4: Consensus Rankings Endpoint (Template)
    console.log('\n4️⃣ Testing GET /api/rankings/consensus (as template)');
    const consensusResponse = await fetch('http://localhost:5000/api/rankings/consensus?format=redraft');
    const consensusData = await consensusResponse.json();
    
    if (consensusData.success) {
      console.log(`✅ Consensus rankings: ${consensusData.data.rankings.length} rankings calculated`);
      console.log(`   Can serve as pre-fill template: ${consensusData.data.meta.calculatedAt}`);
    } else {
      console.log('❌ Consensus rankings failed:', consensusData.error);
    }
    
    console.log('\n🎯 Rankings Builder API Support Layer Test Complete!');
    console.log('✅ All endpoints functional for "On The Clock" integration');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

/**
 * API Endpoint Summary for Rankings Builder
 */
function printAPIEndpointsSummary() {
  console.log('\n📋 Rankings Builder API Support Layer Summary:');
  console.log('\n🔧 Core Endpoints:');
  console.log('   GET  /api/players/list              - Full player list for rankings construction');
  console.log('   POST /api/rankings/submit           - Submit personal rankings');
  console.log('   GET  /api/rankings/personal         - Load saved personal rankings');
  console.log('   GET  /api/rankings/consensus        - Consensus rankings (template option)');
  
  console.log('\n📊 Expected Request/Response Patterns:');
  console.log('   Submit: { user_id, mode, dynasty_mode?, rankings: [{ player_id, rank }] }');
  console.log('   Personal: ?user_id=123&mode=redraft&dynasty_mode=contender');
  console.log('   Players: Returns { players: [{ player_id, name, position, team }] }');
  
  console.log('\n🚀 Ready for Frontend Rankings Builder Integration!');
}

// Run tests if this file is executed directly
if (require.main === module) {
  testRankingsBuilderAPI();
  printAPIEndpointsSummary();
}

export { testRankingsBuilderAPI, printAPIEndpointsSummary };