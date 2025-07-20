import type { Express } from "express";
import { sleeperSourceManager } from '../services/projections/sleeperSourceManager';

export function registerAdpConversionTestRoutes(app: Express) {
  // Test ADP to projections conversion directly
  app.get('/api/test/adp-conversion', async (req, res) => {
    try {
      console.log('🧪 Testing ADP to projections conversion...');
      
      // Clear cache and force fresh data fetch
      sleeperSourceManager.clearCache();
      
      // Fetch seasonal projections (which should use ADP conversion)
      const seasonalProjections = await sleeperSourceManager.fetchSeasonalProjections();
      
      console.log(`📊 Seasonal projections received: ${Object.keys(seasonalProjections).length}`);
      
      // Get sample projections
      const samples = Object.entries(seasonalProjections).slice(0, 10);
      
      res.json({
        success: true,
        adp_conversion_test: {
          total_projections: Object.keys(seasonalProjections).length,
          sample_conversions: samples.map(([playerId, projection]) => ({
            player_id: playerId,
            pts_ppr: projection.pts_ppr,
            pts_half_ppr: projection.pts_half_ppr,
            pts_std: projection.pts_std,
            rec: projection.rec
          })),
          conversion_working: Object.keys(seasonalProjections).length > 0
        },
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('❌ ADP conversion test failed:', error);
      res.status(500).json({
        success: false,
        error: 'ADP conversion test failed',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
    }
  });
}