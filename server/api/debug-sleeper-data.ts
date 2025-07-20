import type { Express } from "express";
import axios from 'axios';

export function registerSleeperDataDebugRoutes(app: Express) {
  // Debug Sleeper data structure to understand ADP fields
  app.get('/api/debug/sleeper-data', async (req, res) => {
    try {
      console.log('🔍 Debugging Sleeper data structure...');
      
      // Fetch raw data from working endpoint
      const response = await axios.get('https://api.sleeper.app/v1/projections/nfl/2024/regular/11', {
        timeout: 15000
      });
      
      const adpData = response.data || {};
      console.log(`📊 Raw data: ${Object.keys(adpData).length} players`);
      
      // Get sample player data to understand structure
      const samplePlayerId = Object.keys(adpData)[0];
      const samplePlayer = adpData[samplePlayerId];
      
      // Look for players with any ADP-related fields
      const playersWithAdp: any[] = [];
      let totalPlayersChecked = 0;
      
      Object.entries(adpData).forEach(([playerId, playerData]: [string, any]) => {
        totalPlayersChecked++;
        
        // Check for various ADP field possibilities
        const adpFields = {
          adp_dd_ppr: playerData.adp_dd_ppr,
          adp_dd: playerData.adp_dd,
          adp_ppr: playerData.adp_ppr,
          adp: playerData.adp,
          draft_rank: playerData.draft_rank,
          rank_ecr: playerData.rank_ecr,
          rank_adp: playerData.rank_adp
        };
        
        const hasAnyAdp = Object.values(adpFields).some(value => 
          value !== undefined && value !== null && value !== 999 && value > 0
        );
        
        if (hasAnyAdp && playersWithAdp.length < 20) {
          playersWithAdp.push({
            player_id: playerId,
            ...adpFields,
            all_fields: Object.keys(playerData)
          });
        }
      });
      
      res.json({
        success: true,
        debug_results: {
          total_players: Object.keys(adpData).length,
          total_checked: totalPlayersChecked,
          players_with_adp: playersWithAdp.length,
          sample_player_structure: {
            player_id: samplePlayerId,
            all_fields: Object.keys(samplePlayer),
            sample_values: samplePlayer
          },
          players_with_adp_data: playersWithAdp,
          field_analysis: {
            adp_dd_ppr_found: playersWithAdp.filter(p => p.adp_dd_ppr).length,
            adp_dd_found: playersWithAdp.filter(p => p.adp_dd).length,
            adp_ppr_found: playersWithAdp.filter(p => p.adp_ppr).length,
            adp_found: playersWithAdp.filter(p => p.adp).length,
            draft_rank_found: playersWithAdp.filter(p => p.draft_rank).length,
            rank_ecr_found: playersWithAdp.filter(p => p.rank_ecr).length,
            rank_adp_found: playersWithAdp.filter(p => p.rank_adp).length
          }
        },
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('❌ Sleeper data debug failed:', error);
      res.status(500).json({
        success: false,
        error: 'Data debug failed',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
    }
  });
}