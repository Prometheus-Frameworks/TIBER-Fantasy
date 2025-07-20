#!/usr/bin/env tsx

/**
 * Test script to verify Sleeper API integration is working correctly
 */

import { fetchSleeperProjections, applyLeagueFormatScoring } from './services/projections/sleeperProjectionsService';
import { calculateVORP } from './vorp_calculator';

async function testSleeperIntegration() {
  console.log('🧪 Testing Sleeper API Integration...\n');

  try {
    // Test 1: Fetch projections
    console.log('1️⃣ Testing projection fetch...');
    const projections = await fetchSleeperProjections(true);
    console.log(`   ✅ Fetched ${projections.length} projections`);
    
    if (projections.length > 0) {
      console.log(`   📊 Sample player: ${projections[0].player_name} (${projections[0].position}, ${projections[0].team})`);
      console.log(`   💯 Sample scoring: STD=${projections[0].stats?.pts_std}, PPR=${projections[0].stats?.pts_ppr}`);
    }

    // Test 2: Apply format scoring
    console.log('\n2️⃣ Testing format scoring...');
    const pprProjections = applyLeagueFormatScoring(projections, 'ppr');
    console.log(`   ✅ Applied PPR scoring to ${pprProjections.length} players`);

    // Test 3: VORP calculation
    console.log('\n3️⃣ Testing VORP calculation...');
    const settings = {
      format: 'ppr' as const,
      num_teams: 12,
      starters: { QB: 1, RB: 2, WR: 3, TE: 1, FLEX: 1 },
      is_superflex: true,
      is_te_premium: false
    };
    
    const { vorpMap, tiers } = await calculateVORP(settings, 'dynasty', true);
    const vorpCount = Object.keys(vorpMap).length;
    console.log(`   ✅ Calculated VORP for ${vorpCount} players`);
    console.log(`   🏆 Generated ${tiers.length} tiers`);

    // Test 4: Top players
    if (vorpCount > 0) {
      console.log('\n4️⃣ Top 5 VORP players:');
      const sortedPlayers = Object.entries(vorpMap)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5);
      
      sortedPlayers.forEach(([name, vorp], index) => {
        console.log(`   ${index + 1}. ${name}: ${vorp} VORP`);
      });
    }

    console.log('\n✅ Sleeper integration test completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run test if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testSleeperIntegration();
}

export { testSleeperIntegration };