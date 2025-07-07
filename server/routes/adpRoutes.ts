/**
 * ADP-specific API routes for real-time syncing and management
 */

import type { Express } from 'express';
import { adpSyncService } from '../adpSyncService';
import { db } from '../db';
import { players } from '../../shared/schema';
import { sql, desc, eq } from 'drizzle-orm';

export function registerADPRoutes(app: Express): void {
  
  /**
   * Manual trigger for ADP sync
   */
  app.post('/api/adp/sync', async (req, res) => {
    try {
      const { source } = req.body;
      
      if (source) {
        adpSyncService.updateConfig({ source });
      }
      
      const result = await adpSyncService.performSync();
      
      res.json({
        success: result.success,
        message: result.success 
          ? `Successfully updated ${result.updated} players` 
          : 'Sync failed',
        updated: result.updated,
        errors: result.errors,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('ADP sync error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error during sync',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * Get current ADP sync status
   */
  app.get('/api/adp/status', (req, res) => {
    const status = adpSyncService.getSyncStatus();
    res.json({
      ...status,
      autoSyncActive: !!status.lastSync,
      nextSync: status.enabled ? 'Every 6 hours' : 'Disabled'
    });
  });

  /**
   * Update ADP sync configuration
   */
  app.put('/api/adp/config', (req, res) => {
    try {
      const { source, syncInterval, enabled } = req.body;
      
      const config: any = {};
      if (source) config.source = source;
      if (syncInterval) config.syncInterval = parseInt(syncInterval);
      if (enabled !== undefined) config.enabled = enabled;
      
      adpSyncService.updateConfig(config);
      
      res.json({
        success: true,
        message: 'Configuration updated successfully',
        newConfig: adpSyncService.getSyncStatus()
      });
      
    } catch (error) {
      res.status(400).json({
        success: false,
        message: 'Invalid configuration',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * Get players with enhanced ADP data (both overall and positional)
   */
  app.get('/api/players/enhanced-adp', async (req, res) => {
    try {
      const { position, limit = 200 } = req.query;
      
      let query = db.select({
        id: players.id,
        name: players.name,
        team: players.team,
        position: players.position,
        adp: players.adp,
        positionalADP: players.positionalADP,
        ownership: players.ownership,
        adpLastUpdated: players.adpLastUpdated,
        adpSource: players.adpSource,
        dynastyValue: players.dynastyValue
      })
      .from(players)
      .where(sql`adp IS NOT NULL AND adp < 500`)
      .orderBy(sql`CAST(adp AS DECIMAL)`)
      .limit(parseInt(limit as string));
      
      if (position && position !== 'ALL') {
        query = query.where(eq(players.position, position as string));
      }
      
      const players = await query;
      
      res.json(players);
      
    } catch (error) {
      console.error('Enhanced ADP fetch error:', error);
      res.status(500).json({
        error: 'Failed to fetch enhanced ADP data',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * Get positional rankings summary
   */
  app.get('/api/adp/positional-summary', async (req, res) => {
    try {
      const summary = await db.select({
        position: players.position,
        totalPlayers: sql`COUNT(*)`,
        avgADP: sql`AVG(CAST(adp AS DECIMAL))`,
        minADP: sql`MIN(CAST(adp AS DECIMAL))`,
        maxADP: sql`MAX(CAST(adp AS DECIMAL))`,
        lastUpdated: sql`MAX(adp_last_updated)`
      })
      .from(players)
      .where(sql`adp IS NOT NULL AND position IN ('QB', 'RB', 'WR', 'TE')`)
      .groupBy(players.position)
      .orderBy(sql`MIN(CAST(adp AS DECIMAL))`);

      res.json(summary);
      
    } catch (error) {
      console.error('Positional summary error:', error);
      res.status(500).json({
        error: 'Failed to fetch positional summary',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * Get ADP trend data (if available)
   */
  app.get('/api/adp/trends', async (req, res) => {
    try {
      // This would require historical ADP data tracking
      // For now, return recent updates
      const recentUpdates = await db.select({
        name: players.name,
        position: players.position,
        adp: players.adp,
        positionalADP: players.positionalADP,
        adpLastUpdated: players.adpLastUpdated,
        adpSource: players.adpSource
      })
      .from(players)
      .where(sql`adp_last_updated IS NOT NULL`)
      .orderBy(desc(players.adpLastUpdated))
      .limit(50);

      res.json({
        recentUpdates,
        message: 'Historical trending requires additional data collection'
      });
      
    } catch (error) {
      console.error('ADP trends error:', error);
      res.status(500).json({
        error: 'Failed to fetch ADP trends',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
}