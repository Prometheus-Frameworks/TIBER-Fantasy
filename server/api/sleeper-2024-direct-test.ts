/**
 * Direct Sleeper API 2024 Stats Test
 * Raw API calls to verify data availability
 */

import axios from 'axios';

export async function testSleeper2024Direct() {
  console.log('🔍 [TIBER] Direct Sleeper API 2024 verification...');
  
  const results = {
    seasonStats: null,
    weeklyStats: [],
    playerData: null
  };

  try {
    // Test season-level stats
    console.log('📊 Testing: https://api.sleeper.app/v1/stats/nfl/regular/2024');
    const seasonResponse = await axios.get('https://api.sleeper.app/v1/stats/nfl/regular/2024', {
      timeout: 10000
    });
    results.seasonStats = {
      available: !!seasonResponse.data,
      playerCount: seasonResponse.data ? Object.keys(seasonResponse.data).length : 0,
      sample: seasonResponse.data ? Object.keys(seasonResponse.data).slice(0, 3) : []
    };

    // Test weekly stats (weeks 1-3)
    for (let week = 1; week <= 3; week++) {
      try {
        console.log(`📊 Testing week ${week}: https://api.sleeper.app/v1/stats/nfl/regular/2024/${week}`);
        const weekResponse = await axios.get(`https://api.sleeper.app/v1/stats/nfl/regular/2024/${week}`, {
          timeout: 5000
        });
        
        results.weeklyStats.push({
          week,
          available: !!weekResponse.data,
          playerCount: weekResponse.data ? Object.keys(weekResponse.data).length : 0,
          sample: weekResponse.data ? Object.keys(weekResponse.data).slice(0, 2) : []
        });
      } catch (error) {
        results.weeklyStats.push({
          week,
          available: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    // Test player data
    console.log('📊 Testing: https://api.sleeper.app/v1/players/nfl');
    const playersResponse = await axios.get('https://api.sleeper.app/v1/players/nfl', {
      timeout: 10000
    });
    results.playerData = {
      available: !!playersResponse.data,
      playerCount: playersResponse.data ? Object.keys(playersResponse.data).length : 0
    };

  } catch (error) {
    console.error('❌ Direct API test failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      results
    };
  }

  return {
    success: true,
    results
  };
}