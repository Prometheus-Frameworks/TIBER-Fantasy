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

async function exportDeeboSamuel() {
  try {
    const playersData = await makeRequest('/v1/players/nfl');
    let deeboSamuelId = null;
    let deeboSamuelInfo = null;

    // Find Deebo Samuel - check multiple variations
    for (const [playerId, playerInfo] of Object.entries(playersData)) {
      const fullName = playerInfo.full_name || `${playerInfo.first_name} ${playerInfo.last_name}`;
      if ((playerInfo.team === 'SF' || playerInfo.team === 'WAS') && playerInfo.position === 'WR') {
        if (fullName && (fullName.toLowerCase().includes('deebo samuel') || 
                        fullName.toLowerCase().includes('samuel deebo') ||
                        (playerInfo.first_name && playerInfo.first_name.toLowerCase() === 'deebo') ||
                        (playerInfo.last_name && playerInfo.last_name.toLowerCase() === 'samuel'))) {
          deeboSamuelId = playerId;
          deeboSamuelInfo = playerInfo;
          break;
        }
      }
    }

    if (!deeboSamuelId) {
      console.error('Deebo Samuel not found');
      return;
    }

    const gameLogs = [];

    for (let week = 1; week <= 18; week++) {
      try {
        const weekData = await makeRequest(`/v1/stats/nfl/regular/2024/${week}`);
        
        if (weekData && weekData[deeboSamuelId]) {
          const stats = weekData[deeboSamuelId];
          
          const weekLog = {
            week,
            active: true,
            rec_tgt: stats.rec_tgt || 0,
            rec: stats.rec || 0,
            rec_yd: stats.rec_yd || 0,
            rec_td: stats.rec_td || 0,
            ypr: stats.rec && stats.rec > 0 ? Math.round((stats.rec_yd / stats.rec) * 10) / 10 : 0,
            rec_lng: stats.rec_lng || 0,
            rec_fd: stats.rec_fd || 0,
            rec_air_yd: stats.rec_air_yd || 0,
            rec_yac: stats.rec_yac || 0,
            rush_att: stats.rush_att || 0,
            rush_yd: stats.rush_yd || 0,
            rush_td: stats.rush_td || 0,
            pts_ppr: stats.pts_ppr || 0,
            pts_half_ppr: stats.pts_half_ppr || 0,
            pts_std: stats.pts_std || 0
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
            ypr: 0,
            rec_lng: 0,
            rec_fd: 0,
            rec_air_yd: 0,
            rec_yac: 0,
            rush_att: 0,
            rush_yd: 0,
            rush_td: 0,
            pts_ppr: 0,
            pts_half_ppr: 0,
            pts_std: 0
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
          ypr: 0,
          rec_lng: 0,
          rec_fd: 0,
          rec_air_yd: 0,
          rec_yac: 0,
          rush_att: 0,
          rush_yd: 0,
          rush_td: 0,
          pts_ppr: 0,
          pts_half_ppr: 0,
          pts_std: 0
        });
      }
    }

    const result = {
      player_name: deeboSamuelInfo.full_name || `${deeboSamuelInfo.first_name} ${deeboSamuelInfo.last_name}`,
      position: deeboSamuelInfo.position,
      team: deeboSamuelInfo.team,
      game_logs: gameLogs
    };

    console.log(JSON.stringify(result, null, 2));

  } catch (error) {
    console.error('Export failed:', error.message);
  }
}

exportDeeboSamuel();