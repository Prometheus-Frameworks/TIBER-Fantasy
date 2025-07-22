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

async function exportJaredGoff() {
  try {
    const playersData = await makeRequest('/v1/players/nfl');
    let jaredGoffId = null;
    let jaredGoffInfo = null;

    // Find Jared Goff
    for (const [playerId, playerInfo] of Object.entries(playersData)) {
      const fullName = playerInfo.full_name || `${playerInfo.first_name} ${playerInfo.last_name}`;
      if (fullName && fullName.toLowerCase().includes('jared goff') && 
          playerInfo.team === 'DET' && playerInfo.position === 'QB') {
        jaredGoffId = playerId;
        jaredGoffInfo = playerInfo;
        break;
      }
    }

    if (!jaredGoffId) {
      console.error('Jared Goff not found');
      return;
    }

    const gameLogs = [];

    for (let week = 1; week <= 18; week++) {
      try {
        const weekData = await makeRequest(`/v1/stats/nfl/regular/2024/${week}`);
        
        if (weekData && weekData[jaredGoffId]) {
          const stats = weekData[jaredGoffId];
          
          const weekLog = {
            week,
            active: true,
            pass_att: stats.pass_att || 0,
            pass_cmp: stats.pass_cmp || 0,
            pass_yd: stats.pass_yd || 0,
            pass_td: stats.pass_td || 0,
            pass_int: stats.pass_int || 0,
            pass_lng: stats.pass_lng || 0,
            pass_fd: stats.pass_fd || 0,
            rush_att: stats.rush_att || 0,
            rush_yd: stats.rush_yd || 0,
            rush_td: stats.rush_td || 0,
            rush_lng: stats.rush_lng || 0,
            rush_fd: stats.rush_fd || 0,
            fumbles_lost: stats.fumbles_lost || 0,
            pts_ppr: stats.pts_ppr || 0,
            pts_half_ppr: stats.pts_half_ppr || 0,
            pts_std: stats.pts_std || 0
          };

          gameLogs.push(weekLog);
        } else {
          gameLogs.push({ 
            week, 
            active: false,
            pass_att: 0,
            pass_cmp: 0,
            pass_yd: 0,
            pass_td: 0,
            pass_int: 0,
            pass_lng: 0,
            pass_fd: 0,
            rush_att: 0,
            rush_yd: 0,
            rush_td: 0,
            rush_lng: 0,
            rush_fd: 0,
            fumbles_lost: 0,
            pts_ppr: 0,
            pts_half_ppr: 0,
            pts_std: 0
          });
        }
      } catch (error) {
        gameLogs.push({ 
          week, 
          active: false,
          pass_att: 0,
          pass_cmp: 0,
          pass_yd: 0,
          pass_td: 0,
          pass_int: 0,
          pass_lng: 0,
          pass_fd: 0,
          rush_att: 0,
          rush_yd: 0,
          rush_td: 0,
          rush_lng: 0,
          rush_fd: 0,
          fumbles_lost: 0,
          pts_ppr: 0,
          pts_half_ppr: 0,
          pts_std: 0
        });
      }
    }

    const result = {
      player_name: jaredGoffInfo.full_name || `${jaredGoffInfo.first_name} ${jaredGoffInfo.last_name}`,
      position: jaredGoffInfo.position,
      team: jaredGoffInfo.team,
      game_logs: gameLogs
    };

    console.log(JSON.stringify(result, null, 2));

  } catch (error) {
    console.error('Export failed:', error.message);
  }
}

exportJaredGoff();