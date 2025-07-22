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

async function exportAllQuarterbacks() {
  try {
    console.log('Fetching all NFL players...');
    const playersData = await makeRequest('/v1/players/nfl');
    
    // Find all quarterbacks with 2024 data
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

    console.log(`Found ${quarterbacks.length} quarterbacks to process...`);

    // Priority QBs for ordering
    const priorityQBs = [
      'josh allen', 'jared goff', 'caleb williams', 'patrick mahomes', 
      'lamar jackson', 'jalen hurts', 'cj stroud', 'justin herbert',
      'jayden daniels', 'jordan love', 'joe burrow', 'brock purdy', 
      'trevor lawrence'
    ];

    // Sort QBs with priority players first
    quarterbacks.sort((a, b) => {
      const aPriority = priorityQBs.some(name => a.name.toLowerCase().includes(name));
      const bPriority = priorityQBs.some(name => b.name.toLowerCase().includes(name));
      
      if (aPriority && !bPriority) return -1;
      if (!aPriority && bPriority) return 1;
      return a.name.localeCompare(b.name);
    });

    const allQBData = [];

    for (const qb of quarterbacks) {
      console.log(`Processing ${qb.name} (${qb.team})...`);
      
      const gameLogs = [];
      let hasActiveGames = false;

      // Check each week for game data
      for (let week = 1; week <= 18; week++) {
        try {
          const weekData = await makeRequest(`/v1/stats/nfl/regular/2024/${week}`);
          
          if (weekData && weekData[qb.id]) {
            const stats = weekData[qb.id];
            
            // Only include if QB had meaningful stats
            if (stats.pass_att > 0 || stats.rush_att > 0 || stats.pts_ppr > 0) {
              hasActiveGames = true;
              
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
            }
          }
        } catch (error) {
          // Continue processing other weeks
          continue;
        }
      }

      // Only include QBs with active games in 2024
      if (hasActiveGames) {
        const qbData = {
          player_name: qb.name,
          position: qb.info.position,
          team: qb.info.team,
          player_id: qb.id,
          years_exp: qb.info.years_exp,
          age: qb.info.age,
          games_played: gameLogs.length,
          total_pass_att: gameLogs.reduce((sum, game) => sum + game.pass_att, 0),
          total_pass_yd: gameLogs.reduce((sum, game) => sum + game.pass_yd, 0),
          total_pass_td: gameLogs.reduce((sum, game) => sum + game.pass_td, 0),
          total_pass_int: gameLogs.reduce((sum, game) => sum + game.pass_int, 0),
          total_rush_att: gameLogs.reduce((sum, game) => sum + game.rush_att, 0),
          total_rush_yd: gameLogs.reduce((sum, game) => sum + game.rush_yd, 0),
          total_rush_td: gameLogs.reduce((sum, game) => sum + game.rush_td, 0),
          total_fantasy_pts: gameLogs.reduce((sum, game) => sum + game.pts_ppr, 0),
          avg_fantasy_pts: gameLogs.length > 0 ? (gameLogs.reduce((sum, game) => sum + game.pts_ppr, 0) / gameLogs.length).toFixed(2) : 0,
          game_logs: gameLogs
        };

        allQBData.push(qbData);
        console.log(`✓ ${qb.name}: ${gameLogs.length} games, ${qbData.avg_fantasy_pts} avg PPR`);
      }
    }

    const result = {
      export_date: new Date().toISOString(),
      season: 2024,
      total_quarterbacks: allQBData.length,
      data_source: "Sleeper API",
      quarterbacks: allQBData
    };

    console.log(`\n=== EXPORT COMPLETE ===`);
    console.log(`Total QBs with 2024 data: ${allQBData.length}`);
    console.log(`Priority QBs included: ${allQBData.filter(qb => 
      priorityQBs.some(name => qb.player_name.toLowerCase().includes(name))
    ).length}`);
    
    console.log(JSON.stringify(result, null, 2));

  } catch (error) {
    console.error('Export failed:', error.message);
  }
}

exportAllQuarterbacks();