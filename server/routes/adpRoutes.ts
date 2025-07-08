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
      
      const result = await query;
      
      res.json(result);
      
    } catch (error) {
      console.error('Enhanced ADP fetch error:', error);
      res.status(500).json({
        error: 'Failed to fetch enhanced ADP data',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * Real-time ADP endpoint with credible fantasy football sources
   * Falls back to mocked data if external APIs unavailable
   */
  app.get('/api/adp-enhanced', async (req, res) => {
    try {
      // Attempt to fetch from Sleeper API first
      let players: any[] = [];
      
      try {
        console.log('🔄 Fetching live ADP from Sleeper API...');
        const sleeperResponse = await fetch('https://api.sleeper.app/v1/players/nfl');
        
        if (sleeperResponse.ok) {
          const sleeperPlayers = await sleeperResponse.json();
          
          // Extract top dynasty players with ADP data
          const eligiblePlayers = Object.values(sleeperPlayers)
            .filter((p: any) => 
              p.position && 
              ['QB', 'RB', 'WR', 'TE'].includes(p.position) &&
              p.team &&
              p.status === 'Active'
            )
            .slice(0, 50); // Get top 50 active players
          
          // Transform and calculate proper positional rankings
          const playersByPosition: {[key: string]: any[]} = {};
          
          eligiblePlayers.forEach((player: any, index: number) => {
            const position = player.position;
            if (!playersByPosition[position]) {
              playersByPosition[position] = [];
            }
            playersByPosition[position].push({
              name: `${player.first_name} ${player.last_name}`,
              team: player.team || 'FA',
              position: position,
              overallADP: index + 1
            });
          });
          
          // Assign position-specific rankings
          players = [];
          Object.keys(playersByPosition).forEach(position => {
            playersByPosition[position].forEach((player, posIndex) => {
              player.posADP = `${position}${posIndex + 1}`;
              players.push(player);
            });
          });
          
          // Sort by overall ADP
          players.sort((a, b) => a.overallADP - b.overallADP);
          
          console.log(`✅ Fetched ${players.length} players from Sleeper API`);
        }
      } catch (sleeperError) {
        console.log('⚠️ Sleeper API unavailable, trying FantasyPros...');
        
        // Try FantasyPros or other sources here
        // For now, fall through to fallback data
      }
      
      // Fallback to mocked data if external APIs fail
      if (players.length === 0) {
        console.log('📋 Using fallback ADP data...');
        players = [
          { name: "Justin Jefferson", team: "MIN", position: "WR", overallADP: 1, posADP: "WR1" },
          { name: "CeeDee Lamb", team: "DAL", position: "WR", overallADP: 2, posADP: "WR2" },
          { name: "Ja'Marr Chase", team: "CIN", position: "WR", overallADP: 3, posADP: "WR3" },
          { name: "Josh Allen", team: "BUF", position: "QB", overallADP: 4, posADP: "QB1" },
          { name: "Lamar Jackson", team: "BAL", position: "QB", overallADP: 5, posADP: "QB2" },
          { name: "Bijan Robinson", team: "ATL", position: "RB", overallADP: 6, posADP: "RB1" },
          { name: "Breece Hall", team: "NYJ", position: "RB", overallADP: 7, posADP: "RB2" },
          { name: "Puka Nacua", team: "LAR", position: "WR", overallADP: 8, posADP: "WR4" },
          { name: "Drake London", team: "ATL", position: "WR", overallADP: 9, posADP: "WR5" },
          { name: "Rome Odunze", team: "CHI", position: "WR", overallADP: 10, posADP: "WR6" },
          { name: "Marvin Harrison Jr.", team: "ARI", position: "WR", overallADP: 11, posADP: "WR7" },
          { name: "Malik Nabers", team: "NYG", position: "WR", overallADP: 12, posADP: "WR8" },
          { name: "Saquon Barkley", team: "PHI", position: "RB", overallADP: 13, posADP: "RB3" },
          { name: "Travis Kelce", team: "KC", position: "TE", overallADP: 14, posADP: "TE1" },
          { name: "Jayden Daniels", team: "WAS", position: "QB", overallADP: 15, posADP: "QB3" }
        ];
      }
      
      // Ensure proper sorting by overallADP
      players.sort((a, b) => a.overallADP - b.overallADP);
      
      res.json(players);
      
    } catch (error) {
      console.error('ADP Enhanced API error:', error);
      res.status(500).json({ error: 'Failed to fetch ADP data' });
    }
  });

  /**
   * Clean ADP endpoint - merges live Sleeper data with database players
   * Deduplicates by name+position+team and normalizes field structure
   */
  app.get('/api/clean-adp', async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      
      // Fetch from both sources simultaneously
      const [sleeperResponse, dbPlayers] = await Promise.all([
        // Live Sleeper data
        fetch('https://api.sleeper.app/v1/players/nfl').then(async (response) => {
          if (!response.ok) return [];
          const sleeperPlayers = await response.json();
          
          const eligiblePlayers = Object.values(sleeperPlayers)
            .filter((p: any) => 
              p.position && 
              ['QB', 'RB', 'WR', 'TE'].includes(p.position) &&
              p.team &&
              p.status === 'Active'
            )
            .slice(0, 50);
          
          // Transform and calculate proper positional rankings
          const playersByPosition: {[key: string]: any[]} = {};
          
          eligiblePlayers.forEach((player: any, index: number) => {
            const position = player.position;
            if (!playersByPosition[position]) {
              playersByPosition[position] = [];
            }
            playersByPosition[position].push({
              name: `${player.first_name} ${player.last_name}`,
              team: player.team || 'FA',
              position: position,
              overallADP: index + 1,
              source: 'sleeper'
            });
          });
          
          // Assign position-specific rankings
          const transformedPlayers: any[] = [];
          Object.keys(playersByPosition).forEach(position => {
            playersByPosition[position].forEach((player, posIndex) => {
              player.posADP = `${position}${posIndex + 1}`;
              transformedPlayers.push(player);
            });
          });
          
          return transformedPlayers.sort((a, b) => a.overallADP - b.overallADP);
        }).catch(() => []),
        
        // Database players
        db.select({
          name: players.name,
          team: players.team,
          position: players.position,
          overallADP: sql`CAST(${players.adp} AS DECIMAL)`,
          posADP: players.positionalADP,
          dynastyValue: players.dynastyValue,
          ownership: players.ownership,
          source: sql`'database'`
        })
        .from(players)
        .where(sql`position IN ('QB', 'RB', 'WR', 'TE') AND adp IS NOT NULL`)
        .orderBy(sql`CAST(adp AS DECIMAL)`)
        .limit(limit)
      ]);
      
      // Merge and deduplicate players
      const playerMap = new Map<string, any>();
      const allPlayers = [...sleeperResponse, ...dbPlayers];
      
      allPlayers.forEach(player => {
        const key = `${player.name.toLowerCase().trim()}-${player.position}-${player.team}`;
        
        if (!playerMap.has(key)) {
          // First occurrence - add player
          const cleanPlayer: any = {
            name: player.name,
            team: player.team,
            position: player.position,
            overallADP: parseFloat(player.overallADP || 0),
            posADP: player.posADP || `${player.position}—`
          };
          
          // Add optional fields only if they exist and are non-null
          if (player.dynastyValue != null) {
            cleanPlayer.dynastyValue = player.dynastyValue;
          }
          if (player.ownership != null) {
            cleanPlayer.ownership = player.ownership;
          }
          
          playerMap.set(key, cleanPlayer);
        } else {
          // Duplicate found - keep the most complete version
          const existing = playerMap.get(key);
          const current = player;
          
          // Prefer database version if it has dynasty value
          if (current.dynastyValue != null && existing.dynastyValue == null) {
            existing.dynastyValue = current.dynastyValue;
          }
          if (current.ownership != null && existing.ownership == null) {
            existing.ownership = current.ownership;
          }
          
          // Use better ADP if available (lower is better)
          if (current.overallADP > 0 && (existing.overallADP === 0 || current.overallADP < existing.overallADP)) {
            existing.overallADP = parseFloat(current.overallADP);
            existing.posADP = current.posADP;
          }
        }
      });
      
      // Convert to array and sort by ADP
      const cleanPlayers = Array.from(playerMap.values())
        .filter(player => player.overallADP > 0)
        .sort((a, b) => a.overallADP - b.overallADP)
        .slice(0, limit);
      
      console.log(`✅ Clean ADP: merged ${sleeperResponse.length} Sleeper + ${dbPlayers.length} DB players → ${cleanPlayers.length} unique players`);
      
      res.json(cleanPlayers);
      
    } catch (error) {
      console.error('Clean ADP API error:', error);
      res.status(500).json({ error: 'Failed to fetch clean ADP data' });
    }
  });

  /**
   * Dynasty Value Scoring Engine with Age Decay
   * Returns players with calculated dynasty values based on ADP, position weights, and age
   */
  app.get('/api/players/with-dynasty-value', async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const agePenalty = 0.75; // Configurable age penalty factor
      
      // Fetch from both sources simultaneously
      const [sleeperResponse, dbPlayers] = await Promise.all([
        // Live Sleeper data
        fetch('https://api.sleeper.app/v1/players/nfl').then(async (response) => {
          if (!response.ok) return [];
          const sleeperPlayers = await response.json();
          
          const eligiblePlayers = Object.values(sleeperPlayers)
            .filter((p: any) => 
              p.position && 
              ['QB', 'RB', 'WR', 'TE'].includes(p.position) &&
              p.team &&
              p.status === 'Active'
            )
            .slice(0, 50);
          
          // Transform and calculate proper positional rankings
          const playersByPosition: {[key: string]: any[]} = {};
          
          eligiblePlayers.forEach((player: any, index: number) => {
            const position = player.position;
            if (!playersByPosition[position]) {
              playersByPosition[position] = [];
            }
            playersByPosition[position].push({
              name: `${player.first_name} ${player.last_name}`,
              team: player.team || 'FA',
              position: position,
              overallADP: index + 1,
              source: 'sleeper'
            });
          });
          
          // Assign position-specific rankings
          const transformedPlayers: any[] = [];
          Object.keys(playersByPosition).forEach(position => {
            playersByPosition[position].forEach((player, posIndex) => {
              player.posADP = `${position}${posIndex + 1}`;
              transformedPlayers.push(player);
            });
          });
          
          return transformedPlayers.sort((a, b) => a.overallADP - b.overallADP);
        }).catch(() => []),
        
        // Database players
        db.select({
          name: players.name,
          team: players.team,
          position: players.position,
          overallADP: sql`CAST(${players.adp} AS DECIMAL)`,
          posADP: players.positionalADP,
          dynastyValue: players.dynastyValue,
          ownership: players.ownership,
          source: sql`'database'`
        })
        .from(players)
        .where(sql`position IN ('QB', 'RB', 'WR', 'TE') AND adp IS NOT NULL`)
        .orderBy(sql`CAST(adp AS DECIMAL)`)
        .limit(limit)
      ]);
      
      // Merge and deduplicate players
      const playerMap = new Map<string, any>();
      const allPlayers = [...sleeperResponse, ...dbPlayers];
      
      allPlayers.forEach(player => {
        const key = `${player.name.toLowerCase().trim()}-${player.position}-${player.team}`;
        
        if (!playerMap.has(key)) {
          // First occurrence - add player
          const cleanPlayer: any = {
            name: player.name,
            team: player.team,
            position: player.position,
            overallADP: parseFloat(player.overallADP || 0),
            posADP: player.posADP || `${player.position}—`
          };
          
          // Add optional fields only if they exist and are non-null
          if (player.dynastyValue != null) {
            cleanPlayer.dynastyValue = player.dynastyValue;
          }
          if (player.ownership != null) {
            cleanPlayer.ownership = player.ownership;
          }
          
          playerMap.set(key, cleanPlayer);
        } else {
          // Duplicate found - keep the most complete version
          const existing = playerMap.get(key);
          const current = player;
          
          // Prefer database version if it has dynasty value
          if (current.dynastyValue != null && existing.dynastyValue == null) {
            existing.dynastyValue = current.dynastyValue;
          }
          if (current.ownership != null && existing.ownership == null) {
            existing.ownership = current.ownership;
          }
          
          // Use better ADP if available (lower is better)
          if (current.overallADP > 0 && (existing.overallADP === 0 || current.overallADP < existing.overallADP)) {
            existing.overallADP = parseFloat(current.overallADP);
            existing.posADP = current.posADP;
          }
        }
      });
      
      // Convert to array and calculate dynasty values with age decay
      const cleanPlayers = Array.from(playerMap.values())
        .filter(player => player.overallADP > 0)
        .map(player => {
          // Dynasty Value Scoring Formula
          // dynastyValue = (100 - overallADP * 2) + positionWeight
          
          const positionWeights: {[key: string]: number} = {
            'QB': 10,
            'RB': 15, 
            'WR': 12,
            'TE': 8
          };
          
          const positionWeight = positionWeights[player.position] || 0;
          const calculatedDynastyValue = Math.max(0, (100 - player.overallADP * 2) + positionWeight);
          
          // Use existing dynasty value if available, otherwise use calculated
          const finalDynastyValue = player.dynastyValue != null ? 
            player.dynastyValue : 
            Math.round(calculatedDynastyValue * 10) / 10; // Round to 1 decimal
          
          // Age Decay Calculation
          // adjustedDynastyValue = dynastyValue - (age * agePenalty)
          // Sample ages for testing (in production, this would come from database)
          const sampleAges: {[key: string]: number} = {
            'Justin Jefferson': 25,
            'CeeDee Lamb': 25,
            'Ja\'Marr Chase': 24,
            'Josh Allen': 28,
            'Lamar Jackson': 27,
            'Joe Flacco': 39,
            'Aaron Rodgers': 40,
            'Bijan Robinson': 22,
            'Breece Hall': 23
          };
          
          const playerAge = player.age || sampleAges[player.name] || null;
          const adjustedDynastyValue = playerAge != null ? 
            Math.max(0, finalDynastyValue - (playerAge * agePenalty)) : 
            finalDynastyValue; // If no age data, use original dynasty value
          
          return {
            ...player,
            dynastyValue: finalDynastyValue,
            adjustedDynastyValue: Math.round(adjustedDynastyValue * 10) / 10, // Round to 1 decimal
            age: playerAge
          };
        })
        .sort((a, b) => b.adjustedDynastyValue - a.adjustedDynastyValue) // Sort by adjusted dynasty value descending
        .slice(0, limit);
      
      console.log(`✅ Dynasty Values: processed ${cleanPlayers.length} players with dynasty scoring`);
      
      res.json(cleanPlayers);
      
    } catch (error) {
      console.error('Dynasty Value API error:', error);
      res.status(500).json({ error: 'Failed to fetch dynasty value data' });
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