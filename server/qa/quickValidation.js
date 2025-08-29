#!/usr/bin/env node

/**
 * Quick validation script for final production readiness check
 */

import axios from 'axios';

const baseUrl = 'http://localhost:5000';

async function quickValidation() {
  console.log('🔧 Running Quick Validation...\n');
  
  try {
    // Test 1: Tier distribution
    const response = await axios.get(`${baseUrl}/api/rankings/deepseek/v3?mode=dynasty`);
    const tierCounts = {};
    response.data.data.slice(0, 50).forEach(player => {
      tierCounts[player.tier] = (tierCounts[player.tier] || 0) + 1;
    });
    
    console.log('📊 Tier Distribution (Top 50):');
    Object.entries(tierCounts).sort((a, b) => parseInt(a[0]) - parseInt(b[0])).forEach(([tier, count]) => {
      console.log(`  Tier ${tier}: ${count} players`);
    });
    
    // Test 2: ADP data coverage
    const playersWithADP = response.data.data.filter(p => p.adp !== null);
    console.log(`\n📈 ADP Coverage: ${playersWithADP.length} players have ADP data`);
    
    // Test 3: Sample scores and tiers
    console.log('\n🎯 Sample Rankings:');
    response.data.data.slice(0, 10).forEach(player => {
      console.log(`  ${player.rank}. ${player.name} (${player.pos}) - Score: ${player.score}, Tier: ${player.tier}, ADP: ${player.adp || 'N/A'}`);
    });
    
    // Test 4: Frontend accessibility
    const frontendResponse = await axios.get(`${baseUrl}/rankings/v3`);
    const hasDeepSeekBranding = frontendResponse.data.includes('DeepSeek v3') || frontendResponse.data.includes('🚀 DeepSeek v3');
    console.log(`\n🎨 Frontend Branding: ${hasDeepSeekBranding ? '✅ Found' : '❌ Missing'}`);
    
    console.log('\n✅ Quick validation completed successfully!');
    
  } catch (error) {
    console.error('❌ Quick validation failed:', error.message);
    process.exit(1);
  }
}

quickValidation();