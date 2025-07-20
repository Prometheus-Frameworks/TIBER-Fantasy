import type { Express } from "express";
import axios from 'axios';

export function registerWeeklyProjectionsCheckRoutes(app: Express) {
  // Check if weekly projections contain actual fantasy point data
  app.get('/api/debug/weekly-projections', async (req, res) => {
    try {
      console.log('🔍 Checking weekly projections for fantasy point data...');
      
      // Try different weekly endpoints
      const endpoints = [
        'https://api.sleeper.app/v1/projections/nfl/2024/regular/11',
        'https://api.sleeper.app/v1/projections/nfl/2024/regular/10', 
        'https://api.sleeper.app/v1/projections/nfl/regular/2024',
        'https://api.sleeper.com/projections/nfl/2024?season_type=regular&week=11',
        'https://api.sleeper.com/projections/nfl/2024?season_type=regular&position=QB,RB,WR,TE'
      ];
      
      const results = [];
      
      for (const endpoint of endpoints) {
        try {
          console.log(`📡 Testing endpoint: ${endpoint}`);
          const response = await axios.get(endpoint, { timeout: 10000 });
          const data = response.data || {};
          
          // Get first few players to check data structure
          const playerIds = Object.keys(data).slice(0, 5);
          const sampleData = playerIds.map(id => ({
            player_id: id,
            data: data[id],
            fields: Object.keys(data[id] || {})
          }));
          
          results.push({
            endpoint: endpoint,
            status: 'success',
            total_players: Object.keys(data).length,
            sample_data: sampleData,
            has_pts_ppr: sampleData.some(p => p.data?.pts_ppr),
            has_projections: sampleData.some(p => p.data?.pts_ppr || p.data?.pts_std || p.data?.pts_half_ppr),
            field_analysis: {
              pts_ppr_count: Object.values(data).filter((p: any) => p.pts_ppr).length,
              pts_std_count: Object.values(data).filter((p: any) => p.pts_std).length,
              pts_half_ppr_count: Object.values(data).filter((p: any) => p.pts_half_ppr).length,
              adp_count: Object.values(data).filter((p: any) => p.adp_dd_ppr && p.adp_dd_ppr < 999).length
            }
          });
          
        } catch (error: any) {
          results.push({
            endpoint: endpoint,
            status: 'error',
            error: error.message
          });
        }
      }
      
      res.json({
        success: true,
        endpoint_analysis: results,
        summary: {
          total_endpoints_tested: endpoints.length,
          successful_endpoints: results.filter(r => r.status === 'success').length,
          endpoints_with_projections: results.filter(r => r.has_projections).length,
          best_endpoint: results.find(r => r.has_projections && r.total_players > 0)?.endpoint || null
        },
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('❌ Weekly projections check failed:', error);
      res.status(500).json({
        success: false,
        error: 'Weekly projections check failed',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
    }
  });
}