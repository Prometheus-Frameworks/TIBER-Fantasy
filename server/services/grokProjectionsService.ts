import axios from 'axios';
import Fuse from 'fuse.js';

interface PlayerProjection {
  player_id: string;
  full_name: string;
  position: string;
  team: string;
  projected_fpts: number;
  age: number;
  source: string;
}

interface LeagueSettings {
  format: 'standard' | 'ppr' | 'half-ppr';
  num_teams: number;
  is_superflex: boolean;
}

const CACHE_TTL = 60 * 60 * 1000; // 1 hour
const cache = { projections: null as PlayerProjection[] | null, lastFetch: 0 };

// Grok Backend Implementation - 2025 Projections with League Fallback
export async function fetchGrokProjections(
  settings: LeagueSettings, 
  source: string = 'season', 
  leagueId?: string, 
  week?: number, 
  skipCache = false
): Promise<PlayerProjection[]> {
  
  if (!skipCache && cache.projections && Date.now() - cache.lastFetch < CACHE_TTL) {
    return cache.projections;
  }

  let aggregated: PlayerProjection[] = [];
  const skipped: { player_name: string; projected_fpts: number; reason: string }[] = [];

  try {
    console.log('🔥 GROK: Fetching player metadata...');
    const playersResponse = await axios.get('https://api.sleeper.app/v1/players/nfl', { timeout: 15000 });
    const playersData = playersResponse.data;
    console.log(`📋 Loaded ${Object.keys(playersData).length} player metadata entries`);

    let projectionsData = {};
    let dataSource = 'PROJECTIONS_2025';

    // Primary Source: 2025 Projections
    if (source === 'season') {
      console.log('📊 Attempting 2025 NFL projections...');
      try {
        const projResponse = await axios.get('https://api.sleeper.app/v1/projections/nfl/2025/regular', { timeout: 10000 });
        projectionsData = projResponse.data || {};
        console.log(`📊 2025 projections: ${Object.keys(projectionsData).length} players`);

        if (Object.keys(projectionsData).length === 0) {
          console.warn('⚠️ Season projections empty — fallback to league matchups');
          source = 'league';
        }
      } catch (error) {
        console.warn('⚠️ 2025 projections failed — fallback to league matchups');
        source = 'league';
      }
      
      // Check if projections are empty (all zero values)
      if (Object.keys(projectionsData).length > 0) {
        const sampleProj = Object.values(projectionsData)[0] as any;
        const hasMeaningfulData = sampleProj?.stats?.pts_ppr > 0 || sampleProj?.stats?.pts_half_ppr > 0 || sampleProj?.stats?.pts_std > 0;
        
        if (!hasMeaningfulData) {
          console.warn('⚠️ 2025 projections contain zero values — fallback to league matchups');
          source = 'league';
        }
      }
    }

    // Fallback Source: League Matchups
    if (source === 'league' && leagueId && week) {
      console.log(`📊 Fallback: League ${leagueId} week ${week} matchups...`);
      try {
        const matchupsResponse = await axios.get(`https://api.sleeper.app/v1/league/${leagueId}/matchups/${week}`, { timeout: 10000 });
        const matchups = matchupsResponse.data || [];
        dataSource = 'LEAGUE_FALLBACK';

        if (matchups && matchups.length > 0) {
          projectionsData = {};
          for (const matchup of matchups) {
            const starters = matchup.starters || [];
            const startersPoints = matchup.starters_points || [];
            for (let i = 0; i < starters.length; i++) {
              const playerId = starters[i];
              projectionsData[playerId] = {
                stats: {
                  pts_std: startersPoints[i],
                  pts_half_ppr: startersPoints[i],
                  pts_ppr: startersPoints[i] // League is 1 PPR
                }
              };
            }
          }
          console.log(`📊 League fallback: ${Object.keys(projectionsData).length} players`);
        } else {
          console.warn('❌ Matchups empty — no data available');
          
          // Emergency fallback: Use known star player IDs with realistic projections
          console.log('🎯 Using emergency sample data with known player IDs for UI testing...');
          projectionsData = {
            "4046": { stats: { pts_ppr: 285, pts_half_ppr: 260, pts_std: 235 } }, // Patrick Mahomes
            "4881": { stats: { pts_ppr: 275, pts_half_ppr: 250, pts_std: 225 } }, // Lamar Jackson  
            "4984": { stats: { pts_ppr: 265, pts_half_ppr: 240, pts_std: 215 } }, // Josh Allen
            "6813": { stats: { pts_ppr: 225, pts_half_ppr: 200, pts_std: 175 } }, // Justin Jefferson
            "7564": { stats: { pts_ppr: 215, pts_half_ppr: 190, pts_std: 165 } }, // CeeDee Lamb
            "7828": { stats: { pts_ppr: 205, pts_half_ppr: 180, pts_std: 155 } }, // Ja'Marr Chase
            "4866": { stats: { pts_ppr: 195, pts_half_ppr: 175, pts_std: 155 } }, // Austin Ekeler
            "5892": { stats: { pts_ppr: 185, pts_half_ppr: 165, pts_std: 145 } }, // Saquon Barkley
            "6794": { stats: { pts_ppr: 175, pts_half_ppr: 155, pts_std: 135 } }, // Bijan Robinson
            "4039": { stats: { pts_ppr: 165, pts_half_ppr: 145, pts_std: 125 } }  // Travis Kelce
          };
          dataSource = 'EMERGENCY_SAMPLE';
        }
      } catch (fallbackError) {
        console.error('❌ League fallback failed:', fallbackError);
        return [];
      }
    }

    // Process projections with Grok validation
    console.log(`📊 Processing ${Object.keys(projectionsData).length} projections...`);
    
    // Debug: Check data structure
    const firstPlayer = Object.keys(projectionsData)[0];
    if (firstPlayer) {
      console.log(`🔍 Sample projection data: ${JSON.stringify(projectionsData[firstPlayer])}`);
    }
    
    for (const playerId in projectionsData) {
      const proj = projectionsData[playerId];
      const player = playersData[playerId];
      
      if (player && proj) {
        // Extract fantasy points - handle different data structures
        let fpts = 0;
        
        if (proj.stats) {
          // Format from season projections API
          if (settings.format === 'ppr') fpts = proj.stats.pts_ppr || 0;
          else if (settings.format === 'half-ppr') fpts = proj.stats.pts_half_ppr || 0;
          else fpts = proj.stats.pts_std || 0;
        } else if (typeof proj === 'object' && proj.pts_ppr !== undefined) {
          // Direct format from league fallback
          if (settings.format === 'ppr') fpts = proj.pts_ppr || 0;
          else if (settings.format === 'half-ppr') fpts = proj.pts_half_ppr || 0;
          else fpts = proj.pts_std || 0;
        } else {
          // Assume proj is a direct number
          fpts = typeof proj === 'number' ? proj : 0;
        }

        // GROK VALIDATION: Relaxed for 2025 season (many players have low/zero projections)
        if (fpts > 450) {
          skipped.push({ player_name: player.full_name || 'Unknown', projected_fpts: fpts, reason: 'exceeds_cap' });
          continue;
        }
        
        // Skip if not core positions
        if (!['QB', 'RB', 'WR', 'TE'].includes(player.position)) {
          skipped.push({ player_name: player.full_name || 'Unknown', projected_fpts: fpts, reason: 'invalid_position' });
          continue;
        }
        
        // Skip if inactive players (but allow zero projections for 2025)
        if (player.active === false) {
          skipped.push({ player_name: player.full_name || 'Unknown', projected_fpts: fpts, reason: 'inactive' });
          continue;
        }

        // Calculate age
        let age = 25;
        if (player.birth_date) {
          const birthYear = new Date(player.birth_date).getFullYear();
          age = new Date().getFullYear() - birthYear;
        }

        aggregated.push({
          player_id: playerId,
          full_name: player.full_name || `${player.first_name} ${player.last_name}`,
          position: player.position,
          team: player.team || 'FA',
          projected_fpts: parseFloat(fpts.toFixed(1)),
          age: age,
          source: dataSource
        });
      }
    }

    // Log validation results
    console.log(`✅ Grok validation: ${aggregated.length} valid players, ${skipped.length} skipped`);
    if (skipped.length > 0) {
      console.log('⚠️ Validation skips:');
      skipped.slice(0, 10).forEach(s => {
        console.log(`   ${s.player_name}: ${s.projected_fpts} pts (${s.reason})`);
      });
    }

    // Fuse.js deduplication
    const fuse = new Fuse(aggregated, { 
      keys: ['full_name', 'position'], 
      threshold: 0.3 
    });
    
    const unique = aggregated.filter((p, i) => {
      const matches = fuse.search({ full_name: p.full_name, position: p.position })
        .filter(m => m.refIndex !== i);
      if (matches.length) {
        matches.forEach(m => {
          aggregated[m.refIndex].projected_fpts = 
            (aggregated[m.refIndex].projected_fpts + p.projected_fpts) / 2;
        });
        return false;
      }
      return true;
    });

    console.log(`🔄 Deduplication: ${aggregated.length} → ${unique.length} unique players`);

    cache.projections = unique;
    cache.lastFetch = Date.now();
    return unique;

  } catch (error) {
    console.error('❌ Grok projections fetch failed:', error);
    return [];
  }
}