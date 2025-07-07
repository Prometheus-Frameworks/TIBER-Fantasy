import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { teamSyncService } from "./teamSync";
import { optimizeLineup, calculateConfidence, analyzeTradeOpportunities, generateWaiverRecommendations } from "./analytics";
import { sportsDataAPI } from "./sportsdata";
import { playerAnalysisCache } from "./playerAnalysisCache";
import { espnAPI } from "./espnAPI";
import { playerMapping } from "./playerMapping";
import { dataRefreshService } from "./dataRefresh";
import { db } from "./db";
import { dynastyTradeHistory, players as playersTable } from "@shared/schema";
import { eq, desc, and, sql } from "drizzle-orm";
import { z } from "zod";
import { accuracyValidator } from './accuracyValidator';

/**
 * Apply league format adjustments to dynasty values
 * Superflex: QBs get premium (default values)
 * Single QB: QBs get penalty (-25-40 points)
 */
function applyLeagueFormatAdjustments(players: any[], format: string): any[] {
  return players.map((player: any) => {
    if (player.position !== 'QB') {
      return player; // No adjustment for non-QBs
    }

    let adjustment = 0;
    const baseValue = player.dynastyValue || 0;

    if (format === 'single-qb' || format === '1qb') {
      // Single QB: Significant penalty for QBs
      if (baseValue >= 85) {
        adjustment = -25; // Josh Allen 94 → 69 (Strong tier)
      } else if (baseValue >= 70) {
        adjustment = -30; // Mid QBs → Depth tier
      } else if (baseValue >= 50) {
        adjustment = -35; // Low QBs → Bench tier
      } else {
        adjustment = -20; // Already low
      }
    }

    return {
      ...player,
      dynastyValue: Math.max(0, Math.min(100, baseValue + adjustment)),
      formatAdjustment: adjustment
    };
  });
}

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Core API Routes
  app.get("/api/teams/:id", async (req, res) => {
    try {
      const team = await storage.getTeam(Number(req.params.id));
      if (!team) {
        return res.status(404).json({ message: "Team not found" });
      }
      res.json(team);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch team" });
    }
  });

  app.get("/api/teams/:id/players", async (req, res) => {
    try {
      const teamPlayers = await storage.getTeamPlayers(Number(req.params.id));
      res.json(teamPlayers);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch team players" });
    }
  });

  // Enhanced Rankings API - Core Dynasty System
  app.get('/api/rankings/enhanced', async (req, res) => {
    try {
      const { limit = 50, format = 'superflex', position } = req.query;
      
      console.log('🔄 Generating enhanced rankings with fantasy platform integration...');
      console.log(`🔄 Enhancing ${limit} players with fantasy platform data...`);
      
      // Import ranking enhancement service
      const { rankingEnhancement } = await import('./rankingEnhancement');
      
      // Get all dynasty players from database
      const { getAllDynastyPlayers } = await import('./expandedDynastyDatabase');
      let players = getAllDynastyPlayers();
      
      // Sort by existing dynasty value for consistent top players
      players.sort((a: any, b: any) => (b.dynastyValue || 0) - (a.dynastyValue || 0));
      
      // Then filter by position if specified  
      if (position && typeof position === 'string') {
        players = players.filter(p => p.position === position.toUpperCase());
      }
      
      // Apply limit after sorting and filtering
      players = players.slice(0, Number(limit));
      
      // Use all filtered players for enhancement
      const playersToEnhance = players;
      
      // Enhance players with mapping data
      let enhancedPlayers = await rankingEnhancement.enhancePlayerRankings(playersToEnhance);
      
      // Apply Jake Maraia's authentic dynasty algorithm
      console.log('🔧 Applying Jake Maraia dynasty methodology...');
      const { jakeMaraiaAlgorithm } = await import('./jakeMaraiaAlgorithm');
      
      enhancedPlayers = enhancedPlayers.map(player => {
        const jakeScore = jakeMaraiaAlgorithm.calculateJakeScore(player);
        return {
          ...player,
          dynastyValue: jakeScore.totalScore,
          dynastyTier: jakeScore.tier,
          jakeMaraiaScore: jakeScore
        };
      });
      
      // Apply league format adjustments
      const formatAdjustedPlayers = applyLeagueFormatAdjustments(enhancedPlayers, format as string);
      
      // Sort enhanced players by dynasty value (highest first) for true overall rankings
      formatAdjustedPlayers.sort((a: any, b: any) => (b.dynastyValue || 0) - (a.dynastyValue || 0));
      
      // Get mapping statistics
      const mappingStats = rankingEnhancement.getMappingStats(formatAdjustedPlayers);
      
      // Format response for frontend
      const response = {
        players: formatAdjustedPlayers.map(player => ({
          id: player.id,
          name: player.name,
          position: player.position,
          team: player.team,
          age: player.age,
          avgPoints: player.avgPoints,
          dynastyValue: player.dynastyValue,
          dynastyTier: player.dynastyTier,
          // Enhanced data from mapping
          sleeperId: player.sleeperId || null,
          fantasyOwnership: player.fantasyOwnership || null,
          enhancementStatus: player.sleeperId ? 'Enhanced' : 'Basic'
        })),
        mappingStats,
        message: `Enhanced ${formatAdjustedPlayers.length} players with ${Math.round(mappingStats.mappingRate)}% platform integration`
      };
      
      res.json(response);
    } catch (error: any) {
      console.error('❌ Enhanced rankings error:', error);
      res.status(500).json({ 
        message: 'Failed to generate enhanced rankings', 
        error: error.message 
      });
    }
  });

  // Rankings accuracy validation
  app.get('/api/rankings/validate-accuracy', async (req, res) => {
    try {
      // Get current enhanced rankings
      const { getAllDynastyPlayers } = await import('./expandedDynastyDatabase');
      const { jakeMaraiaAlgorithm } = await import('./jakeMaraiaAlgorithm');
      
      let players = getAllDynastyPlayers();
      
      // Apply Jake Maraia algorithm to all players
      const rankedPlayers = players.map(player => {
        const jakeScore = jakeMaraiaAlgorithm.calculateJakeScore(player);
        return {
          ...player,
          dynastyValue: jakeScore.totalScore,
          dynastyTier: jakeScore.tier
        };
      });
      
      // Sort by dynasty value
      rankedPlayers.sort((a, b) => (b.dynastyValue || 0) - (a.dynastyValue || 0));
      
      // Validate rankings accuracy
      const report = accuracyValidator.validateRankings(rankedPlayers);
      
      // Add top 15 players to response
      const topPlayers = rankedPlayers.slice(0, 15).map((player, index) => ({
        rank: index + 1,
        name: player.name,
        position: player.position,
        dynastyValue: player.dynastyValue,
        tier: player.dynastyTier,
        algorithmFix: true // All players now use authentic Jake Maraia methodology
      }));
      
      res.json({
        ...report,
        targetAccuracy: 89,
        accuracyStatus: report.overallAccuracy >= 89 ? 'TARGET_ACHIEVED' : 'NEEDS_IMPROVEMENT',
        algorithmFixes: 17, // Number of fixes applied in Jake Maraia algorithm
        topPlayers
      });
    } catch (error: any) {
      console.error('❌ Accuracy validation error:', error);
      res.status(500).json({ 
        message: 'Failed to validate accuracy', 
        error: error.message 
      });
    }
  });

  // Player mapping generation
  app.get('/api/mapping/generate', async (req, res) => {
    try {
      const result = await playerMapping.generatePlayerMappings();
      res.json(result);
    } catch (error: any) {
      console.error('❌ Player mapping error:', error);
      res.status(500).json({ 
        message: 'Failed to generate player mappings', 
        error: error.message 
      });
    }
  });

  // Team sync endpoints
  app.post("/api/teams/:id/sync/sleeper", async (req, res) => {
    try {
      const { leagueId, teamId } = req.body;
      const result = await teamSyncService.syncSleeperTeam(Number(req.params.id), leagueId, teamId);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: "Failed to sync with Sleeper", error: error.message });
    }
  });

  app.post("/api/teams/:id/sync/espn", async (req, res) => {
    try {
      const { leagueId, teamId } = req.body;
      const result = await teamSyncService.syncESPNTeam(Number(req.params.id), leagueId, teamId);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: "Failed to sync with ESPN", error: error.message });
    }
  });

  // League comparison routes
  app.get('/api/league/compare/:leagueId', async (req, res) => {
    try {
      const { leagueId } = req.params;
      const { leagueComparisonService } = await import('./leagueComparison');
      const comparison = await leagueComparisonService.compareLeague(leagueId);
      res.json(comparison);
    } catch (error: any) {
      console.error('League comparison error:', error);
      res.status(500).json({ message: 'Failed to compare league', error: error.message });
    }
  });

  // Simple data sources endpoint
  app.get("/api/data-sources", async (req, res) => {
    try {
      res.json({
        sources: [
          { name: "NFL-Data-Py", status: "Active", description: "Historical NFL statistics" },
          { name: "Sleeper API", status: "Active", description: "Fantasy platform integration" },
          { name: "SportsDataIO", status: "Active", description: "Real-time NFL data" }
        ]
      });
    } catch (error: any) {
      console.error("Error fetching data sources:", error);
      res.status(500).json({ message: "Failed to fetch data sources" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}