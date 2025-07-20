import axios from 'axios';

async function debugProjections() {
  try {
    console.log('🔍 DEBUG: Fetching 2025 projections sample...');
    const response = await axios.get('https://api.sleeper.app/v1/projections/nfl/2025/regular', { timeout: 10000 });
    const data = response.data || {};
    
    console.log(`Total players: ${Object.keys(data).length}`);
    
    // Sample first 5 players to see structure
    const samplePlayers = Object.entries(data).slice(0, 5);
    
    for (const [playerId, projection] of samplePlayers) {
      console.log(`Player ID: ${playerId}`);
      console.log('Projection data:', JSON.stringify(projection, null, 2));
      console.log('---');
    }
    
  } catch (error) {
    console.error('Debug error:', error.message);
  }
}

debugProjections();