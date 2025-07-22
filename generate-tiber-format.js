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

async function generateTiberFormat() {
  try {
    const playersData = await makeRequest('/v1/players/nfl');
    
    // Find all quarterbacks
    const quarterbacks = [];
    for (const [playerId, playerInfo] of Object.entries(playersData)) {
      if (playerInfo.position === 'QB' && playerInfo.team) {
        quarterbacks.push({
          id: playerId,
          name: playerInfo.full_name || `${playerInfo.first_name} ${playerInfo.last_name}`,
          team: playerInfo.team
        });
      }
    }

    const allQBData = [];

    for (const qb of quarterbacks) {
      const gameLogs = [];
      let hasAnyStats = false;

      // Process all 18 weeks
      for (let week = 1; week <= 18; week++) {
        try {
          const weekData = await makeRequest(`/v1/stats/nfl/regular/2024/${week}`);
          
          let weekLog;
          if (weekData && weekData[qb.id]) {
            const stats = weekData[qb.id];
            if (stats.pass_att > 0 || stats.rush_att > 0 || stats.pts_ppr > 0) {
              hasAnyStats = true;
            }
            
            weekLog = {
              week,
              pass_attempts: stats.pass_att || 0,
              pass_completions: stats.pass_cmp || 0,
              pass_yards: stats.pass_yd || 0,
              pass_touchdowns: stats.pass_td || 0,
              interceptions: stats.pass_int || 0,
              rush_attempts: stats.rush_att || 0,
              rush_yards: stats.rush_yd || 0,
              rush_touchdowns: stats.rush_td || 0,
              fumbles_lost: stats.fumbles_lost || 0,
              fantasy_points_ppr: stats.pts_ppr || 0
            };
          } else {
            weekLog = {
              week,
              pass_attempts: 0,
              pass_completions: 0,
              pass_yards: 0,
              pass_touchdowns: 0,
              interceptions: 0,
              rush_attempts: 0,
              rush_yards: 0,
              rush_touchdowns: 0,
              fumbles_lost: 0,
              fantasy_points_ppr: 0
            };
          }

          gameLogs.push(weekLog);
        } catch (error) {
          gameLogs.push({
            week,
            pass_attempts: 0,
            pass_completions: 0,
            pass_yards: 0,
            pass_touchdowns: 0,
            interceptions: 0,
            rush_attempts: 0,
            rush_yards: 0,
            rush_touchdowns: 0,
            fumbles_lost: 0,
            fantasy_points_ppr: 0
          });
        }
      }

      // Only include QBs with any recorded stats in 2024
      if (hasAnyStats) {
        const qbData = {
          player_name: qb.name,
          position: "QB",
          team: qb.team,
          season: 2024,
          game_logs: gameLogs
        };

        allQBData.push(qbData);
      }
    }

    // Sort by total fantasy points (descending)
    allQBData.sort((a, b) => {
      const aTotal = a.game_logs.reduce((sum, game) => sum + game.fantasy_points_ppr, 0);
      const bTotal = b.game_logs.reduce((sum, game) => sum + game.fantasy_points_ppr, 0);
      return bTotal - aTotal;
    });

    const result = {
      quarterbacks: allQBData
    };

    // Output clean JSON only
    console.log(JSON.stringify(result, null, 2));

  } catch (error) {
    process.stderr.write(`Error: ${error.message}\n`);
    process.exit(1);
  }
}

generateTiberFormat();