#!/usr/bin/env tsx

// Endpoint diagnostic script - Test live vs stale data sources
async function pingEndpoint(url: string, label: string) {
  try {
    console.log(`\n📡 Testing: ${label}`);
    console.log(`   ${url}`);
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.ok === false) {
      console.log(`   ❌ STALE - Error: ${data.error}`);
      return;
    }
    
    const rows = data.data?.length || data.rankings?.length || 0;
    const firstItem = data.data?.[0] || data.rankings?.[0];
    
    console.log(`   ✅ LIVE - Rows: ${rows}`);
    if (firstItem) {
      const id = firstItem.id || firstItem.player_id || firstItem.name || 'unknown';
      const name = firstItem.name || firstItem.full_name || firstItem.player_name || 'unknown';
      console.log(`   📋 First: {id:"${id}", name:"${name}"}`);
    }
    
  } catch (error) {
    console.log(`   💀 EMPTY - Failed: ${error.message}`);
  }
}

async function main() {
  console.log('🔍 ENDPOINT DIAGNOSTIC - Live vs Stale Detection\n');
  console.log('=' .repeat(60));
  
  const baseUrl = 'http://localhost:5000';
  
  // Test core endpoints
  await pingEndpoint(`${baseUrl}/api/redraft/rankings?pos=WR&limit=10`, 'Redraft WR Rankings');
  await pingEndpoint(`${baseUrl}/api/dynasty/value?pos=WR&limit=10`, 'Dynasty WR Values');
  await pingEndpoint(`${baseUrl}/api/rookies?class=2025&pos=WR&limit=10`, 'Rookie WR 2025');
  await pingEndpoint(`${baseUrl}/api/compass/WR?limit=10`, 'WR Compass (NEW)');
  await pingEndpoint(`${baseUrl}/api/compass/wr?limit=10`, 'WR Compass (legacy)');
  await pingEndpoint(`${baseUrl}/api/usage/summary?season=2024&pos=WR&limit=10`, 'Usage Summary WR');
  
  // Test unified endpoints
  await pingEndpoint(`${baseUrl}/api/player-pool?pos=WR&limit=5`, 'Player Pool WR');
  await pingEndpoint(`${baseUrl}/api/unified-players?pos=WR&limit=5`, 'Unified Players WR');
  
  console.log('\n' + '=' .repeat(60));
  console.log('🏁 Diagnostic Complete');
}

main().catch(console.error);