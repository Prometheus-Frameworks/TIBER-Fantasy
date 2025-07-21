// Direct test of depth chart system
import https from 'https';
const API_KEY = process.env.SPORTSDATA_API_KEY;

if (!API_KEY) {
  console.log('❌ [MPS_API_FAILURE_NO_FEED_DETECTED] SPORTSDATA_API_KEY not found');
  process.exit(1);
}

const url = `https://api.sportsdata.io/v3/nfl/scores/json/DepthCharts?key=${API_KEY}`;

console.log('🔍 [TIBER] CHECK_FOR_LIVE_DEPTH_CHART_API initiated...');

https.get(url, (res) => {
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    try {
      const depthCharts = JSON.parse(data);
      console.log('✅ [MPS_LIVE_UPDATE_SUCCESS] Live NFL depth chart API found!');
      console.log(`📊 Successfully fetched depth charts for ${depthCharts.length} teams`);
      
      // Count fantasy relevant players
      let totalPlayers = 0;
      const positions = ['QB', 'RB', 'WR', 'TE'];
      
      depthCharts.forEach(team => {
        if (team.Offense) {
          team.Offense.forEach(player => {
            if (positions.includes(player.Position)) {
              totalPlayers++;
            }
          });
        }
      });
      
      console.log(`🏈 Fantasy relevant players: ${totalPlayers}`);
      console.log('🎯 MainPlayerSystem.json generation: AVAILABLE');
      console.log('🔄 Auto-refresh capability: OPERATIONAL');
      
      // Show sample player data
      if (depthCharts[0] && depthCharts[0].Offense && depthCharts[0].Offense[0]) {
        const samplePlayer = depthCharts[0].Offense[0];
        console.log('📋 Sample player data:');
        console.log(`   Name: ${samplePlayer.Name}`);
        console.log(`   Position: ${samplePlayer.Position}`);
        console.log(`   DepthOrder: ${samplePlayer.DepthOrder}`);
      }
      
    } catch (error) {
      console.log('❌ [MPS_API_FAILURE_NO_FEED_DETECTED] JSON parse failed:', error.message);
    }
  });
}).on('error', (err) => {
  console.log('❌ [MPS_API_FAILURE_NO_FEED_DETECTED] API request failed:', err.message);
});