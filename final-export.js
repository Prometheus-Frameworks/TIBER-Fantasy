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

async function exportFinalJSON() {
  const targetPlayers = {
    'Derrick Henry': { team: 'BAL', position: 'RB' },
    'Drake Maye': { team: 'NE', position: 'QB' },
    'Trey McBride': { team: 'ARI', position: 'TE' },
    'Brian Thomas Jr.': { team: 'JAX', position: 'WR' }
  };

  try {
    const playersData = await makeRequest('/v1/players/nfl');
    const foundPlayers = new Map();

    for (const [playerId, playerInfo] of Object.entries(playersData)) {
      const player = playerInfo;
      const fullName = player.full_name || `${player.first_name} ${player.last_name}`;
      
      for (const targetName of Object.keys(targetPlayers)) {
        if (fullName && fullName.toLowerCase() === targetName.toLowerCase()) {
          foundPlayers.set(targetName, {
            id: playerId,
            name: fullName,
            team: player.team || targetPlayers[targetName].team,
            position: player.position || targetPlayers[targetName].position
          });
          break;
        }
        if (targetName === 'Brian Thomas Jr.' && fullName && 
            fullName.toLowerCase().includes('brian thomas') && player.team === 'JAX') {
          foundPlayers.set(targetName, {
            id: playerId,
            name: fullName,
            team: player.team,
            position: player.position || targetPlayers[targetName].position
          });
          break;
        }
      }
    }

    const results = [];
    
    for (const [targetName, playerData] of foundPlayers) {
      const gameLogs = [];

      for (let week = 1; week <= 18; week++) {
        try {
          const weekData = await makeRequest(`/v1/stats/nfl/regular/2024/${week}`);
          
          if (weekData && weekData[playerData.id]) {
            const stats = weekData[playerData.id];
            
            const weekLog = {
              week,
              active: true,
              rush_att: stats.rush_att || 0,
              rush_yd: stats.rush_yd || 0,
              rush_td: stats.rush_td || 0,
              rec_tgt: stats.rec_tgt || 0,
              rec: stats.rec || 0,
              rec_yd: stats.rec_yd || 0,
              rec_td: stats.rec_td || 0,
              pass_att: stats.pass_att || 0,
              pass_yd: stats.pass_yd || 0,
              pass_td: stats.pass_td || 0,
              pts_ppr: stats.pts_ppr || 0
            };

            gameLogs.push(weekLog);
          } else {
            gameLogs.push({ week, active: false });
          }
        } catch (error) {
          gameLogs.push({ week, active: false });
        }
      }

      results.push({
        player_name: playerData.name,
        position: playerData.position,
        team: playerData.team,
        game_logs: gameLogs
      });
    }

    console.log(JSON.stringify(results, null, 2));

  } catch (error) {
    console.error('Export failed:', error.message);
  }
}

exportFinalJSON();