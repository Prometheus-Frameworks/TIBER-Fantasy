import axios from 'axios';

interface PlayerProjection {
  player_name: string;
  position: string;
  team: string;
  projected_fpts: number;
  receptions: number;
  birthdate?: string;
}

interface SleeperPlayer {
  player_id: string;
  full_name?: string;
  first_name?: string;
  last_name?: string;
  position: string;
  team?: string;
  birth_date?: string;
  active?: boolean;
}

interface ProjectionData {
  stats?: {
    pts_ppr?: number;
    rec?: number;
  };
}

const leagueId = '1197631162923614208';
const week = 1;

// Sample fallback if both APIs fail
const simulatedSample: PlayerProjection[] = [
  { player_name: "Justin Jefferson", position: "WR", team: "MIN", projected_fpts: 320, receptions: 95, birthdate: "1999-06-16" },
  { player_name: "Christian McCaffrey", position: "RB", team: "SF", projected_fpts: 310, receptions: 80, birthdate: "1996-06-07" },
  { player_name: "Patrick Mahomes", position: "QB", team: "KC", projected_fpts: 305, receptions: 0, birthdate: "1995-09-17" },
  { player_name: "Ja'Marr Chase", position: "WR", team: "CIN", projected_fpts: 290, receptions: 100, birthdate: "2000-03-01" },
  { player_name: "Josh Allen", position: "QB", team: "BUF", projected_fpts: 300, receptions: 0, birthdate: "1996-05-21" }
];

export async function fetchAggregatedProjections(): Promise<PlayerProjection[]> {
  try {
    console.log('🔍 Fetching NFL players from Sleeper API...');
    const playersResponse = await axios.get('https://api.sleeper.app/v1/players/nfl', { timeout: 10000 });
    const playersData: Record<string, SleeperPlayer> = playersResponse.data;
    console.log(`📊 Players fetched: ${Object.keys(playersData).length} total`);

    let projectionsData: Record<string, ProjectionData> = {};

    // TIER 1: Try 2025 season projections first
    console.log('🎯 TIER 1: Attempting 2025 season projections...');
    try {
      const projResponse = await axios.get('https://api.sleeper.com/projections/nfl/2025?season_type=regular&position=QB,RB,WR,TE', { timeout: 10000 });
      projectionsData = projResponse.data || {};
      console.log(`📈 Season projections: ${Object.keys(projectionsData).length} players`);
    } catch (error) {
      console.warn('⚠️ Season projections failed:', error instanceof Error ? error.message : 'Unknown error');
    }

    // TIER 2: Fallback to league matchups if season projections are empty
    if (Object.keys(projectionsData).length === 0) {
      console.log('🔄 TIER 2: Season projections empty — fallback to league matchups...');
      try {
        const matchupsResponse = await axios.get(`https://api.sleeper.app/v1/league/${leagueId}/matchups/${week}`, { timeout: 10000 });
        const matchups = matchupsResponse.data;
        console.log(`🏈 Matchups fetched: ${matchups?.length || 0} matchups`);

        if (matchups && matchups.length > 0) {
          for (const matchup of matchups) {
            const starters = matchup.starters || [];
            const startersPoints = matchup.starters_points || [];
            console.log(`📋 Processing matchup with ${starters.length} starters`);
            
            for (let i = 0; i < starters.length; i++) {
              const playerId = starters[i];
              const points = startersPoints[i] || 0;
              if (points > 0) {
                projectionsData[playerId] = { stats: { pts_ppr: points } };
              }
            }
          }
          console.log(`📈 League data processed: ${Object.keys(projectionsData).length} players`);
        } else {
          console.warn('⚠️ Matchups empty — triggering simulated sample fallback');
          return simulatedSample;
        }
      } catch (error) {
        console.warn('⚠️ League matchups failed:', error instanceof Error ? error.message : 'Unknown error');
        console.log('🔄 TIER 3: Using simulated sample fallback');
        return simulatedSample;
      }
    }

    // TIER 3: Final fallback if no data available
    if (Object.keys(projectionsData).length === 0) {
      console.log('🔄 TIER 3: No projections data — using simulated sample');
      return simulatedSample;
    }

    // Process and validate player data
    console.log('🔍 Processing player projections...');
    const aggregated: PlayerProjection[] = [];
    let processed = 0;
    let skipped = 0;

    for (const [playerId, proj] of Object.entries(projectionsData)) {
      const player = playersData[playerId];
      if (player && proj && proj.stats) {
        const fpts = proj.stats.pts_ppr || 0;
        
        // Validation filters
        if (fpts > 450 || fpts <= 50 || 
            !['QB', 'RB', 'WR', 'TE'].includes(player.position) || 
            player.team === null || 
            player.active === false) {
          console.log(`⏭️ Skipped player: ${player.full_name || 'Unknown'} (${fpts} pts, ${player.position}, ${player.team})`);
          skipped++;
          continue;
        }

        aggregated.push({
          player_name: player.full_name || `${player.first_name} ${player.last_name}`,
          position: player.position,
          team: player.team || 'FA',
          projected_fpts: fpts,
          receptions: proj.stats.rec || 0,
          birthdate: player.birth_date
        });
        processed++;
      }
    }

    console.log(`✅ Aggregation complete: ${processed} players processed, ${skipped} skipped`);

    // Sort by projected points (highest first)
    aggregated.sort((a, b) => b.projected_fpts - a.projected_fpts);

    return aggregated.length > 0 ? aggregated : simulatedSample;

  } catch (error) {
    console.error('❌ Fetch failed:', error instanceof Error ? error.message : 'Unknown error');
    console.log('🔄 Using simulated sample fallback due to error');
    return simulatedSample;
  }
}

export async function getSleeperProjections(): Promise<PlayerProjection[]> {
  console.log('🚀 Starting Sleeper projections fetch...');
  const projections = await fetchAggregatedProjections();
  console.log(`🎯 Final result: ${projections.length} players returned`);
  
  // Log data source for debugging
  if (projections === simulatedSample) {
    console.log('📊 Data source: Simulated sample (fallback)');
  } else if (projections.length > 0) {
    console.log('📊 Data source: Live Sleeper API');
  }

  return projections;
}