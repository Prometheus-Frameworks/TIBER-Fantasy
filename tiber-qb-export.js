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

async function exportQBsForTiber() {
  try {
    console.log('Fetching NFL players for Tiber format...');
    const playersData = await makeRequest('/v1/players/nfl');
    
    // Find all quarterbacks
    const quarterbacks = [];
    for (const [playerId, playerInfo] of Object.entries(playersData)) {
      if (playerInfo.position === 'QB' && playerInfo.team) {
        quarterbacks.push({
          id: playerId,
          name: playerInfo.full_name || `${playerInfo.first_name} ${playerInfo.last_name}`,
          team: playerInfo.team,
          info: playerInfo
        });
      }
    }

    console.log(`Processing ${quarterbacks.length} quarterbacks...`);

    const allQBData = [];

    for (const qb of quarterbacks) {
      console.log(`Processing ${qb.name} (${qb.team})...`);
      
      const gameLogs = [];
      let hasAnyStats = false;

      // Process all 17 weeks (plus week 18 for completeness)
      for (let week = 1; week <= 18; week++) {
        try {
          const weekData = await makeRequest(`/v1/stats/nfl/regular/2024/${week}`);
          
          if (weekData && weekData[qb.id]) {
            const stats = weekData[qb.id];
            hasAnyStats = true;
            
            const weekLog = {
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

            gameLogs.push(weekLog);
          } else {
            // Include zero stats for weeks QB didn't play
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
        } catch (error) {
          // Include zeros for error weeks
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

    // Sort by total fantasy points (descending) for better organization
    allQBData.sort((a, b) => {
      const aTotal = a.game_logs.reduce((sum, game) => sum + game.fantasy_points_ppr, 0);
      const bTotal = b.game_logs.reduce((sum, game) => sum + game.fantasy_points_ppr, 0);
      return bTotal - aTotal;
    });

    const result = {
      quarterbacks: allQBData
    };

    console.log(`\n=== TIBER EXPORT COMPLETE ===`);
    console.log(`Total QBs: ${allQBData.length}`);
    console.log(`Data format: Tiber-specified structure`);
    console.log(`All weeks included: 1-18 with zeros for inactive weeks`);
    
    console.log(JSON.stringify(result, null, 2));

  } catch (error) {
    console.error('Tiber export failed:', error.message);
  }
}

exportQBsForTiber();