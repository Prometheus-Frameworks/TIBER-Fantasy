import { Request, Response } from 'express';
import { sleeperSourceManager } from '../services/projections/sleeperSourceManager';

/**
 * Test endpoint to directly call NFL stats method
 */
export async function testNFLStatsDirect(req: Request, res: Response) {
  try {
    console.log('🧪 TESTING: Direct NFL stats method call');
    
    // Call the fetchNFL2024Stats method directly
    const result = await (sleeperSourceManager as any).fetchNFL2024Stats();
    
    console.log(`✅ NFL Stats test result: ${Object.keys(result.projections).length} players`);
    
    // Get top 10 performers
    const players = Object.entries(result.projections)
      .map(([id, data]: [string, any]) => ({
        id,
        points: data.pts_ppr || 0,
        stats: data.stats
      }))
      .sort((a, b) => b.points - a.points)
      .slice(0, 10);
    
    res.json({
      success: true,
      sourceType: result.sourceType,
      totalPlayers: Object.keys(result.projections).length,
      topPerformers: players
    });
    
  } catch (error) {
    console.error('❌ NFL Stats test failed:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      sourceType: 'error'
    });
  }
}