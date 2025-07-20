import type { Express } from "express";
import { sleeperProjectionsPipeline } from '../services/projections/sleeperProjectionsPipeline';

export function registerForceSyntheticTestRoutes(app: Express) {
  // Force synthetic projections test to validate pipeline
  app.get('/api/test/force-synthetic', async (req, res) => {
    try {
      console.log('🎯 Force testing synthetic projections pipeline...');
      
      const format = req.query.format as string || 'ppr';
      const position = req.query.position as string || undefined;
      
      // Force clear cache to ensure fresh test
      sleeperProjectionsPipeline.clearCache();
      
      // Run pipeline which should trigger synthetic projections when Sleeper API is empty
      const projections = await sleeperProjectionsPipeline.generateProjections(
        'season', 
        format as 'ppr' | 'half-ppr' | 'standard',
        position
      );
      
      console.log(`✅ Force synthetic test complete: ${projections.length} projections`);
      
      // Show sample projections
      const sampleProjections = projections.slice(0, 10);
      
      res.json({
        success: true,
        force_synthetic_test: {
          total_projections: projections.length,
          format: format,
          position_filter: position || 'all',
          sample_projections: sampleProjections,
          top_players: projections.slice(0, 5).map(p => ({
            name: p.player_name,
            position: p.position,
            team: p.team,
            projected_fpts: p.projected_fpts
          })),
          pipeline_working: projections.length > 0
        },
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('❌ Force synthetic test failed:', error);
      res.status(500).json({
        success: false,
        error: 'Force synthetic test failed',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
    }
  });
}