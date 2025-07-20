import type { Express } from "express";
import { fetchSleeperProjections, applyLeagueFormatScoring, getCacheStatus, clearCache } from '../services/projections/sleeperProjectionsService';
import { calculateVORP } from '../vorp_calculator';

export function registerSleeperTestRoutes(app: Express) {
  // Test endpoint for Sleeper API integration
  app.get('/api/sleeper/test', async (req, res) => {
    try {
      console.log('🧪 Sleeper API test endpoint called');
      
      // Clear cache to force fresh data
      clearCache();
      
      const projections = await fetchSleeperProjections(true);
      const cacheStatus = getCacheStatus();
      
      res.json({
        success: true,
        projections_count: projections.length,
        sample_players: projections.slice(0, 3).map(p => ({
          name: p.player_name,
          position: p.position,
          team: p.team,
          pts_ppr: p.stats?.pts_ppr || p.projected_fpts
        })),
        cache_status: cacheStatus,
        timestamp: new Date().toISOString()
      });
      
    } catch (error: any) {
      console.error('❌ Sleeper test endpoint error:', error.message);
      res.status(500).json({ 
        success: false, 
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  // VORP test endpoint
  app.get('/api/vorp/test', async (req, res) => {
    try {
      const { format = 'ppr', mode = 'dynasty' } = req.query;
      
      console.log(`🎯 VORP test: ${format} ${mode}`);
      
      const settings = {
        format: format as 'standard' | 'ppr' | 'half-ppr',
        num_teams: 12,
        starters: { QB: 1, RB: 2, WR: 3, TE: 1, FLEX: 1 },
        is_superflex: mode === 'dynasty',
        is_te_premium: false
      };
      
      clearCache(); // Force fresh data
      const { vorpMap, tiers } = await calculateVORP(settings, mode as string, true);
      
      // Get top 10 players
      const topPlayers = Object.entries(vorpMap)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10)
        .map(([name, vorp]) => ({ name, vorp }));
      
      res.json({
        success: true,
        settings,
        total_players: Object.keys(vorpMap).length,
        tiers_count: tiers.length,
        top_players: topPlayers,
        sample_tiers: tiers.slice(0, 3),
        timestamp: new Date().toISOString()
      });
      
    } catch (error: any) {
      console.error('❌ VORP test endpoint error:', error.message);
      res.status(500).json({ 
        success: false, 
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });
}