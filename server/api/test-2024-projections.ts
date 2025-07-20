import type { Express } from "express";
import axios from 'axios';

export function registerTest2024ProjectionsRoutes(app: Express) {
  // Test with working 2024 data to demonstrate validation system
  app.get('/api/test/2024-projections', async (req, res) => {
    try {
      console.log('🎯 Testing validation system with 2024 Sleeper data...');
      
      // Fetch working 2024 data
      const response = await axios.get('https://api.sleeper.app/v1/projections/nfl/2024/regular/11');
      const rawProjections = response.data || {};
      
      // Fetch player metadata
      const playersResponse = await axios.get('https://api.sleeper.app/v1/players/nfl');
      const players = playersResponse.data || {};
      
      let mappedCount = 0;
      let excludedPlayers: Array<{name: string, projected_fpts: number, reason: string}> = [];
      let validPlayers: Array<any> = [];
      
      // Process projections with validation
      for (const [playerId, projection] of Object.entries(rawProjections)) {
        const player = players[playerId];
        if (!player) continue;
        
        const projectedPts = (projection as any).pts_ppr || 0;
        const playerName = player.full_name || `${player.first_name || ''} ${player.last_name || ''}`.trim();
        
        mappedCount++;
        
        // Apply strict validation filters
        if (projectedPts <= 50) {
          excludedPlayers.push({
            name: playerName,
            projected_fpts: projectedPts,
            reason: 'projected_fpts <= 50'
          });
          continue;
        }
        
        if (projectedPts > 450) {
          excludedPlayers.push({
            name: playerName,
            projected_fpts: projectedPts,
            reason: 'projected_fpts > 450 (sanity cap)'
          });
          continue;
        }
        
        if (!['QB', 'RB', 'WR', 'TE'].includes(player.position)) {
          excludedPlayers.push({
            name: playerName,
            projected_fpts: projectedPts,
            reason: 'invalid position: ' + player.position
          });
          continue;
        }
        
        if (!player.team || player.team === 'FA' || player.team.length !== 3) {
          excludedPlayers.push({
            name: playerName,
            projected_fpts: projectedPts,
            reason: 'no active NFL team: ' + player.team
          });
          continue;
        }
        
        // Player passed all validations
        validPlayers.push({
          name: playerName,
          position: player.position,
          team: player.team,
          projected_fpts: projectedPts
        });
      }
      
      // Sort by projected points
      validPlayers.sort((a, b) => b.projected_fpts - a.projected_fpts);
      
      console.log(`🔍 VALIDATION RESULTS:`);
      console.log(`   📊 Raw projections: ${Object.keys(rawProjections).length}`);
      console.log(`   📊 Mapped players: ${mappedCount}`);
      console.log(`   ✅ Valid players: ${validPlayers.length}`);
      console.log(`   ❌ Excluded players: ${excludedPlayers.length}`);
      
      if (excludedPlayers.length > 0) {
        console.log(`🔍 EXCLUDED PLAYERS REPORT (${excludedPlayers.length} total):`);
        excludedPlayers.slice(0, 10).forEach(player => {
          console.log(`   ❌ ${player.name}: ${player.projected_fpts} pts (${player.reason})`);
        });
      }
      
      res.json({
        success: true,
        validation_demo: {
          raw_projections_count: Object.keys(rawProjections).length,
          mapped_players: mappedCount,
          valid_players: validPlayers.length,
          excluded_players: excludedPlayers.length,
          sample_valid_players: validPlayers.slice(0, 10),
          sample_excluded_players: excludedPlayers.slice(0, 10),
          validation_filters: [
            'projected_fpts > 50',
            'projected_fpts <= 450',
            'position in [QB,RB,WR,TE]',
            'active NFL team only'
          ]
        },
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('❌ 2024 projections test failed:', error);
      res.status(500).json({
        success: false,
        error: '2024 projections test failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
}