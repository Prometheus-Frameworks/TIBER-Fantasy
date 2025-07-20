import type { Express } from "express";
import axios from 'axios';

export function registerWeeklyProjectionsTestRoutes(app: Express) {
  // Test raw weekly projections data structure
  app.get('/api/weekly-projections/test', async (req, res) => {
    try {
      console.log('🔍 Testing weekly projections data structure...');
      
      const weeklyUrl = 'https://api.sleeper.app/v1/projections/nfl/2024/regular/11';
      const response = await axios.get(weeklyUrl, { timeout: 10000 });
      const data = response.data;
      
      console.log('📊 Weekly projections data type:', typeof data);
      console.log('📊 Is array:', Array.isArray(data));
      console.log('📊 Keys count:', Object.keys(data || {}).length);
      
      // Sample 5 entries to understand structure
      const entries = Object.entries(data || {}).slice(0, 5);
      const samples = entries.map(([playerId, projData]) => ({
        playerId,
        projData: JSON.stringify(projData).substring(0, 200) + '...'
      }));
      
      // Check for actual player projection data
      let validProjections = 0;
      let invalidProjections = 0;
      
      for (const [playerId, projData] of Object.entries(data || {})) {
        if (projData && typeof projData === 'object') {
          const hasProjections = Object.keys(projData as any).some(key => 
            key.includes('pts_') || key.includes('pass_') || key.includes('rush_') || key.includes('rec_')
          );
          if (hasProjections) {
            validProjections++;
          } else {
            invalidProjections++;
          }
        }
      }
      
      res.json({
        success: true,
        metadata: {
          url: weeklyUrl,
          responseType: typeof data,
          isArray: Array.isArray(data),
          totalEntries: Object.keys(data || {}).length,
          validProjections,
          invalidProjections
        },
        samples,
        timestamp: new Date().toISOString()
      });
      
    } catch (error: any) {
      console.error('❌ Weekly projections test error:', error.message);
      res.status(500).json({ 
        error: 'Weekly projections test failed',
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });
}