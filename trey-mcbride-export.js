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

async function exportTreyMcBride() {
  try {
    const playersData = await makeRequest('/v1/players/nfl');
    let treyMcBrideId = null;
    let treyMcBrideInfo = null;

    // Find Trey McBride
    for (const [playerId, playerInfo] of Object.entries(playersData)) {
      const fullName = playerInfo.full_name || `${playerInfo.first_name} ${playerInfo.last_name}`;
      if (fullName && fullName.toLowerCase().includes('trey mcbride') && playerInfo.team === 'ARI') {
        treyMcBrideId = playerId;
        treyMcBrideInfo = playerInfo;
        break;
      }
    }

    if (!treyMcBrideId) {
      console.error('Trey McBride not found');
      return;
    }

    const gameLogs = [];

    for (let week = 1; week <= 18; week++) {
      try {
        const weekData = await makeRequest(`/v1/stats/nfl/regular/2024/${week}`);
        
        if (weekData && weekData[treyMcBrideId]) {
          const stats = weekData[treyMcBrideId];
          
          const weekLog = {
            week,
            active: true,
            rec_tgt: stats.rec_tgt || 0,
            rec: stats.rec || 0,
            rec_yd: stats.rec_yd || 0,
            rec_td: stats.rec_td || 0,
            rush_att: stats.rush_att || 0,
            rush_yd: stats.rush_yd || 0,
            rush_td: stats.rush_td || 0,
            pts_ppr: stats.pts_ppr || 0
          };

          gameLogs.push(weekLog);
        } else {
          gameLogs.push({ 
            week, 
            active: false,
            rec_tgt: 0,
            rec: 0,
            rec_yd: 0,
            rec_td: 0,
            rush_att: 0,
            rush_yd: 0,
            rush_td: 0,
            pts_ppr: 0
          });
        }
      } catch (error) {
        gameLogs.push({ 
          week, 
          active: false,
          rec_tgt: 0,
          rec: 0,
          rec_yd: 0,
          rec_td: 0,
          rush_att: 0,
          rush_yd: 0,
          rush_td: 0,
          pts_ppr: 0
        });
      }
    }

    const result = {
      player_name: treyMcBrideInfo.full_name || `${treyMcBrideInfo.first_name} ${treyMcBrideInfo.last_name}`,
      position: treyMcBrideInfo.position,
      team: treyMcBrideInfo.team,
      game_logs: gameLogs
    };

    console.log(JSON.stringify(result, null, 2));

  } catch (error) {
    console.error('Export failed:', error.message);
  }
}

exportTreyMcBride();