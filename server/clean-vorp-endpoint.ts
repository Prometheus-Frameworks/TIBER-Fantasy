import { Request, Response } from 'express';
import axios from 'axios';

// Replacement level thresholds (fantasy points)
const REPLACEMENT_LEVELS = {
  QB: 225,
  RB: 200,
  WR: 200,
  TE: 150
};

// Static simulated sample JSON (final fallback)
const SIMULATED_SAMPLE = [
  {"player_name": "Ja'Marr Chase", "position": "WR", "team": "CIN", "projected_fpts": 220, "receptions": 100, "birthdate": "2000-03-01"},
  {"player_name": "Bijan Robinson", "position": "RB", "team": "ATL", "projected_fpts": 250, "receptions": 50, "birthdate": "2002-01-30"},
  {"player_name": "Justin Jefferson", "position": "WR", "team": "MIN", "projected_fpts": 210, "receptions": 95, "birthdate": "1999-06-16"},
  {"player_name": "Jahmyr Gibbs", "position": "RB", "team": "DET", "projected_fpts": 230, "receptions": 60, "birthdate": "2002-03-20"},
  {"player_name": "Malik Nabers", "position": "WR", "team": "NYG", "projected_fpts": 190, "receptions": 80, "birthdate": "2003-07-28"},
  {"player_name": "CeeDee Lamb", "position": "WR", "team": "DAL", "projected_fpts": 215, "receptions": 105, "birthdate": "1999-04-08"},
  {"player_name": "Puka Nacua", "position": "WR", "team": "LAR", "projected_fpts": 200, "receptions": 90, "birthdate": "2001-05-29"},
  {"player_name": "Amon-Ra St. Brown", "position": "WR", "team": "DET", "projected_fpts": 205, "receptions": 100, "birthdate": "1999-10-24"},
  {"player_name": "Ashton Jeanty", "position": "RB", "team": "LV", "projected_fpts": 220, "receptions": 40, "birthdate": "2003-12-02"},
  {"player_name": "Garrett Wilson", "position": "WR", "team": "NYJ", "projected_fpts": 185, "receptions": 85, "birthdate": "2000-07-22"},
  {"player_name": "Marvin Harrison Jr.", "position": "WR", "team": "ARI", "projected_fpts": 180, "receptions": 75, "birthdate": "2002-08-11"},
  {"player_name": "A.J. Brown", "position": "WR", "team": "PHI", "projected_fpts": 195, "receptions": 85, "birthdate": "1997-06-30"},
  {"player_name": "Saquon Barkley", "position": "RB", "team": "PHI", "projected_fpts": 240, "receptions": 55, "birthdate": "1997-02-09"},
  {"player_name": "Jonathan Taylor", "position": "RB", "team": "IND", "projected_fpts": 225, "receptions": 30, "birthdate": "1999-01-19"},
  {"player_name": "Breece Hall", "position": "RB", "team": "NYJ", "projected_fpts": 215, "receptions": 65, "birthdate": "2001-05-31"},
  {"player_name": "Nico Collins", "position": "WR", "team": "HOU", "projected_fpts": 170, "receptions": 70, "birthdate": "1999-03-19"},
  {"player_name": "De'Von Achane", "position": "RB", "team": "MIA", "projected_fpts": 200, "receptions": 45, "birthdate": "2001-10-13"},
  {"player_name": "Sam LaPorta", "position": "TE", "team": "DET", "projected_fpts": 150, "receptions": 80, "birthdate": "2001-01-12"},
  {"player_name": "Patrick Mahomes", "position": "QB", "team": "KC", "projected_fpts": 350, "receptions": 0, "birthdate": "1995-09-17"},
  {"player_name": "Josh Allen", "position": "QB", "team": "BUF", "projected_fpts": 360, "receptions": 0, "birthdate": "1996-05-21"}
];

const LEAGUE_ID = '1197631162923614208'; // Boss's league ID
const WEEK = 1; // Default week

async function fetchAggregatedProjections(settings: any) {
  try {
    console.log('📋 Fetching player metadata...');
    const playersResponse = await axios.get('https://api.sleeper.app/v1/players/nfl', { timeout: 15000 });
    const playersData = playersResponse.data || {};
    console.log(`📋 Loaded ${Object.keys(playersData).length} player metadata`);

    let projectionsData: Record<string, any> = {};
    let dataSource = '';

    // TIER 1: 2025 Season Projections (Primary)
    console.log('📊 Fetching 2025 NFL projections (primary source)...');
    try {
      const projResponse = await axios.get('https://api.sleeper.app/v1/projections/nfl/2025/regular', { timeout: 10000 });
      projectionsData = projResponse.data || {};
      
      // Check if projections have meaningful data (not just empty objects)
      let hasValidData = false;
      if (Object.keys(projectionsData).length > 0) {
        // Check for at least one player with actual projection data
        for (const playerId in projectionsData) {
          const proj = projectionsData[playerId];
          // Check if projection object has any properties at all
          if (proj && Object.keys(proj).length > 0) {
            // Check if it has point values > 0
            if (proj.pts_ppr > 0 || proj.pts_half_ppr > 0 || proj.pts_std > 0) {
              hasValidData = true;
              break;
            }
          }
        }
      }
      
      if (hasValidData) {
        console.log(`✅ 2025 projections: ${Object.keys(projectionsData).length} players with valid data`);
        dataSource = '2025_PROJECTIONS';
      } else {
        console.warn('⚠️ Season projections empty or zero values — fallback to league matchups.');
        throw new Error('Empty projections');
      }
    } catch (error) {
      // TIER 2: League Matchups Fallback
      console.log(`📊 Fallback: League ${LEAGUE_ID} week ${WEEK} matchups...`);
      try {
        const matchupsResponse = await axios.get(`https://api.sleeper.app/v1/league/${LEAGUE_ID}/matchups/${WEEK}`, { timeout: 10000 });
        const matchups = matchupsResponse.data || [];
        
        projectionsData = {};
        for (const matchup of matchups) {
          const starters = matchup.starters || [];
          const startersPoints = matchup.starters_points || [];
          for (let i = 0; i < starters.length; i++) {
            const playerId = starters[i];
            if (playerId && startersPoints[i]) {
              projectionsData[playerId] = { stats: { pts_ppr: startersPoints[i] } };
            }
          }
        }
        
        if (Object.keys(projectionsData).length > 0) {
          console.log(`✅ League fallback: ${Object.keys(projectionsData).length} players`);
          dataSource = 'LEAGUE_FALLBACK';
        } else {
          console.warn('⚠️ Matchups empty — injecting simulated sample.');
          throw new Error('Empty matchups');
        }
      } catch (fallbackError) {
        // TIER 3: Static Simulated JSON (Final Fallback)
        console.log('💾 Using static simulated sample data (final fallback)');
        dataSource = 'SIMULATED_SAMPLE';
        return { players: SIMULATED_SAMPLE, dataSource };
      }
    }

    // Process projections data
    const aggregated = [];
    let processed = 0;
    let skipped = 0;

    for (const playerId in projectionsData) {
      const proj = projectionsData[playerId];
      const player = playersData[playerId];
      
      if (!player || !proj) continue;
      
      let fpts = 0;
      if (proj.stats) {
        fpts = proj.stats.pts_ppr || proj.stats.pts_half_ppr || proj.stats.pts_std || 0;
      } else if (proj.pts_ppr) {
        fpts = proj.pts_ppr;
      }
      
      // Validation filters
      if (fpts > 450 || fpts <= 50 || 
          !['QB', 'RB', 'WR', 'TE'].includes(player.position) || 
          player.team === null || 
          player.active === false) {
        console.log(`Skipped player: ${player.full_name || 'Unknown'} - Points: ${fpts}, Position: ${player.position}, Team: ${player.team}`);
        skipped++;
        continue;
      }

      aggregated.push({
        player_name: player.full_name || `${player.first_name} ${player.last_name}`,
        position: player.position,
        team: player.team,
        projected_fpts: Math.round(fpts * 10) / 10, // Round to 1 decimal
        receptions: proj.stats?.rec || 0,
        birthdate: player.birth_date || null
      });
      processed++;
    }

    console.log(`✅ Processed ${processed} players, skipped ${skipped} players`);
    return { players: aggregated, dataSource };

  } catch (error: any) {
    console.error('❌ Fetch failed:', error.message);
    console.log('💾 Using static simulated sample data (error fallback)');
    return { players: SIMULATED_SAMPLE, dataSource: 'SIMULATED_SAMPLE' };
  }
}

export async function cleanVorpRankings(req: Request, res: Response) {
  try {
    const mode = req.query.mode as string || 'redraft';
    const leagueFormat = req.query.league_format as string || 'ppr';
    const position = req.query.position as string;
    
    console.log(`🔥 CLEAN VORP: ${mode} ${leagueFormat} rankings${position ? ` (${position})` : ''}`);
    
    const settings = { mode, leagueFormat, position };
    const { players, dataSource } = await fetchAggregatedProjections(settings);
    
    // Filter by position if specified
    let filteredPlayers = players;
    if (position && position !== 'all') {
      filteredPlayers = players.filter(p => p.position === position.toUpperCase());
    }
    
    // Calculate VORP scores
    const playersWithVorp = filteredPlayers.map(player => {
      const replacementLevel = REPLACEMENT_LEVELS[player.position as keyof typeof REPLACEMENT_LEVELS] || 100;
      const vorp = player.projected_fpts - replacementLevel;
      
      return {
        full_name: player.player_name,
        position: player.position,
        team: player.team,
        projected_fpts: player.projected_fpts,
        vorp_score: Math.round(vorp * 10) / 10,
        replacement_level: replacementLevel,
        receptions: player.receptions || 0,
        birthdate: player.birthdate
      };
    });
    
    // Sort by VORP score (highest first)
    playersWithVorp.sort((a, b) => b.vorp_score - a.vorp_score);
    
    console.log(`✅ CLEAN VORP: Returning ${playersWithVorp.length} players`);
    console.log('🏆 Top 3:', playersWithVorp.slice(0, 3).map(p => `${p.full_name} (${p.vorp_score})`).join(', '));
    
    res.json({
      success: true,
      players: playersWithVorp.slice(0, 500), // Top 500 players
      meta: {
        totalPlayers: playersWithVorp.length,
        dataSource,
        league_format: leagueFormat,
        mode,
        replacement_levels: REPLACEMENT_LEVELS
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error: any) {
    console.error('❌ CLEAN VORP error:', error);
    res.status(500).json({ error: 'Failed to fetch VORP rankings', message: error.message });
  }
}