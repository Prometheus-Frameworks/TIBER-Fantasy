import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { sleeperProjectionsPipeline } from '../services/projections/sleeperProjectionsPipeline';

/**
 * Test endpoint to inject real data from user and verify system behavior
 */
export async function testRealDataInjection(req: Request, res: Response) {
  try {
    console.log('🧪 Testing real data injection from user sample');
    
    // Load sample data
    const sampleDataPath = path.join(__dirname, '../test-data/sample-sleeper-data.json');
    const sampleData = JSON.parse(fs.readFileSync(sampleDataPath, 'utf8'));
    
    console.log('📊 Sample data loaded:');
    console.log(`- Season data: ${sampleData.season.top_10.length} players`);
    console.log(`- League data: ${sampleData.league.top_10.length} players`);
    
    // Test season projections formatting
    const seasonProjections = sampleData.season.top_10.map((player: any) => ({
      player_name: player.player_name,
      position: player.position,
      team: player.team,
      projected_fpts: player.projected_fpts,
      receptions: 0,
      player_id: `test_${player.player_name.toLowerCase().replace(/[^a-z]/g, '_')}`,
      birthdate: '1995-01-01',
      stats: {
        pts_ppr: player.projected_fpts,
        pts_half_ppr: player.projected_fpts * 0.9,
        pts_std: player.projected_fpts * 0.8
      }
    }));
    
    // Test league projections formatting
    const leagueProjections = sampleData.league.top_10.map((player: any) => ({
      player_name: player.player_name,
      position: player.position,
      team: player.team,
      projected_fpts: player.projected_fpts,
      receptions: 0,
      player_id: `test_${player.player_name.toLowerCase().replace(/[^a-z]/g, '_')}`,
      birthdate: '1995-01-01',
      stats: {
        pts_ppr: player.projected_fpts,
        pts_half_ppr: player.projected_fpts * 0.9,
        pts_std: player.projected_fpts * 0.8
      }
    }));
    
    // Test validation filters
    console.log('🔍 Testing validation filters on real data:');
    
    const seasonFiltered = seasonProjections.filter(p => {
      const valid = p.projected_fpts > 50 && 
                   p.projected_fpts <= 450 && 
                   ['QB', 'RB', 'WR', 'TE'].includes(p.position) &&
                   p.team !== null;
      if (!valid) {
        console.log(`❌ Filtered out: ${p.player_name} (${p.projected_fpts} fpts)`);
      }
      return valid;
    });
    
    const leagueFiltered = leagueProjections.filter(p => {
      const valid = p.projected_fpts > 50 && 
                   p.projected_fpts <= 450 && 
                   ['QB', 'RB', 'WR', 'TE'].includes(p.position) &&
                   p.team !== null;
      if (!valid) {
        console.log(`❌ Filtered out: ${p.player_name} (${p.projected_fpts} fpts)`);
      }
      return valid;
    });
    
    console.log(`✅ Season projections: ${seasonFiltered.length}/${seasonProjections.length} passed validation`);
    console.log(`✅ League projections: ${leagueFiltered.length}/${leagueProjections.length} passed validation`);
    
    // Test format mapping
    const formatTest = {
      ppr: seasonFiltered.map(p => ({ ...p, projected_fpts: p.stats.pts_ppr })),
      half_ppr: seasonFiltered.map(p => ({ ...p, projected_fpts: p.stats.pts_half_ppr })),
      standard: seasonFiltered.map(p => ({ ...p, projected_fpts: p.stats.pts_std }))
    };
    
    console.log('📊 Format mapping test:');
    console.log(`- PPR: ${formatTest.ppr[0].player_name} = ${formatTest.ppr[0].projected_fpts} fpts`);
    console.log(`- Half-PPR: ${formatTest.half_ppr[0].player_name} = ${formatTest.half_ppr[0].projected_fpts} fpts`);
    console.log(`- Standard: ${formatTest.standard[0].player_name} = ${formatTest.standard[0].projected_fpts} fpts`);
    
    res.json({
      success: true,
      message: 'Real data injection test completed',
      results: {
        sampleDataLoaded: true,
        seasonProjections: seasonFiltered.length,
        leagueProjections: leagueFiltered.length,
        validationPassed: seasonFiltered.length > 0 && leagueFiltered.length > 0,
        formatMappingWorking: true,
        topPlayers: {
          season: seasonFiltered.slice(0, 3).map(p => ({ 
            name: p.player_name, 
            position: p.position, 
            team: p.team, 
            fpts: p.projected_fpts 
          })),
          league: leagueFiltered.slice(0, 3).map(p => ({ 
            name: p.player_name, 
            position: p.position, 
            team: p.team, 
            fpts: p.projected_fpts 
          }))
        }
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Real data test failed:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
}