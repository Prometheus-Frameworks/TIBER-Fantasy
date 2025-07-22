import https from 'https';

function makeRequest(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.sleeper.app',
      path: path,
      method: 'GET',
      headers: { 'User-Agent': 'On-The-Clock-Fantasy/1.0' }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (error) {
          reject(new Error(`Parse error: ${error.message}`));
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function debugDeebo() {
  try {
    const playersData = await makeRequest('/v1/players/nfl');
    
    // Search for any player with "samuel" or "deebo" in name
    const possibleMatches = [];
    for (const [playerId, playerInfo] of Object.entries(playersData)) {
      const fullName = playerInfo.full_name || `${playerInfo.first_name} ${playerInfo.last_name}`;
      if (fullName && (fullName.toLowerCase().includes('samuel') || fullName.toLowerCase().includes('deebo'))) {
        possibleMatches.push({
          id: playerId,
          name: fullName,
          team: playerInfo.team,
          position: playerInfo.position
        });
      }
    }
    
    console.log('Possible matches for Deebo Samuel:');
    console.log(JSON.stringify(possibleMatches, null, 2));
    
  } catch (error) {
    console.error('Debug failed:', error.message);
  }
}

debugDeebo();