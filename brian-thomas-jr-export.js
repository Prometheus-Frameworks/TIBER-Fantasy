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

async function exportBrianThomasJr() {
  try {
    const playersData = await makeRequest('/v1/players/nfl');
    let brianThomasId = null;
    let brianThomasInfo = null;

    // Find Brian Thomas Jr. - multiple name variations
    for (const [playerId, playerInfo] of Object.entries(playersData)) {
      const fullName = playerInfo.full_name || `${playerInfo.first_name} ${playerInfo.last_name}`;
      
      // Check various name formats
      if (fullName && playerInfo.team === 'JAX' && playerInfo.position === 'WR') {
        if (fullName.toLowerCase().includes('brian thomas') || 
            (playerInfo.first_name && playerInfo.first_name.toLowerCase() === 'brian' && 
             playerInfo.last_name && playerInfo.last_name.toLowerCase().includes('thomas'))) {
          brianThomasId = playerId;
          brianThomasInfo = playerInfo;
          break;
        }
      }
    }

    if (!brianThomasId) {
      console.error('Brian Thomas Jr. not found');
      return;
    }

    const gameLogs = [];

    for (let week = 1; week <= 18; week++) {
      try {
        const weekData = await makeRequest(`/v1/stats/nfl/regular/2024/${week}`);
        
        if (weekData && weekData[brianThomasId]) {
          const stats = weekData[brianThomasId];
          
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
      player_name: brianThomasInfo.full_name || `${brianThomasInfo.first_name} ${brianThomasInfo.last_name}`,
      position: brianThomasInfo.position,
      team: brianThomasInfo.team,
      rookie_year: brianThomasInfo.years_exp === 0 ? 2024 : null,
      game_logs: gameLogs
    };

    console.log(JSON.stringify(result, null, 2));

  } catch (error) {
    console.error('Export failed:', error.message);
  }
}

exportBrianThomasJr();