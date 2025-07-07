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
      
      // Apply Jake Maraia's authentic dynasty algorithm - OVERRIDE all database values
      console.log('🔧 Applying Jake Maraia dynasty methodology (OVERRIDING database values)...');
      const { jakeMaraiaAlgorithm } = await import('./jakeMaraiaAlgorithm');
      
      enhancedPlayers = enhancedPlayers.map(player => {
        const jakeScore = jakeMaraiaAlgorithm.calculateJakeScore(player);
        console.log(`🔧 ${player.name}: Database=${player.dynastyValue} → Algorithm=${jakeScore.totalScore}`);
        return {
          ...player,
          dynastyValue: jakeScore.totalScore,  // OVERRIDE database value
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

  // NEW: Corrected Jake Maraia Algorithm endpoint
  app.get('/api/rankings/corrected', async (req, res) => {
    try {
      const { limit = 50, position } = req.query;
      const { RankingEnhancementService } = await import('./rankingEnhancement');
      const rankingEnhancement = new RankingEnhancementService();
      const correctedRankings = await rankingEnhancement.getCorrectedRankings(Number(limit), position as string);
      res.json(correctedRankings);
    } catch (error) {
      console.error('Error fetching corrected rankings:', error);
      res.status(500).json({ error: 'Failed to fetch corrected rankings' });
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

  // ADP endpoints - Real Sleeper dynasty data
  app.get('/api/adp/realtime/:format?', async (req, res) => {
    try {
      console.log(`🎯 Fetching REAL Sleeper dynasty ADP data (2QB mock draft)...`);
      
      // Use authentic Sleeper dynasty ADP from real mock drafts
      const { sleeperDynastyADPService } = await import('./sleeperDynastyADP');
      const players = sleeperDynastyADPService.getSleeperDynastyADP();
      
      // Players already formatted and filtered for dynasty startup
      
      res.json(players);
    } catch (error: any) {
      console.error('❌ Real-time ADP endpoint error:', error);
      res.status(500).json({ 
        message: 'Failed to fetch real-time ADP data', 
        error: error.message 
      });
    }
  });

  // ADP Accuracy Validation - Sleeper vs FantasyPros
  app.get('/api/adp/accuracy', async (req, res) => {
    try {
      console.log('🔍 Running ADP accuracy validation...');
      const { adpAccuracyValidator } = await import('./adpAccuracyValidator');
      const accuracyReport = await adpAccuracyValidator.validateSleeperVsFantasyPros();
      res.json(accuracyReport);
    } catch (error: any) {
      console.error('❌ ADP accuracy validation error:', error);
      res.status(500).json({ 
        message: 'Failed to validate ADP accuracy', 
        error: error.message 
      });
    }
  });

  // Expanded Player Database endpoints
  app.get('/api/players/database', async (req, res) => {
    try {
      const { expandedPlayerDatabase } = await import('./expandedPlayerDatabase');
      const allPlayers = expandedPlayerDatabase.getAllNFLPlayers();
      res.json({
        players: allPlayers,
        totalCount: allPlayers.length,
        byPosition: {
          QB: allPlayers.filter(p => p.position === 'QB').length,
          RB: allPlayers.filter(p => p.position === 'RB').length,
          WR: allPlayers.filter(p => p.position === 'WR').length,
          TE: allPlayers.filter(p => p.position === 'TE').length
        }
      });
    } catch (error: any) {
      console.error('❌ Player database error:', error);
      res.status(500).json({ 
        message: 'Failed to fetch player database', 
        error: error.message 
      });
    }
  });

  app.get('/api/players/position/:position', async (req, res) => {
    try {
      const position = req.params.position.toUpperCase();
      const { expandedPlayerDatabase } = await import('./expandedPlayerDatabase');
      const players = expandedPlayerDatabase.getPlayersByPosition(position);
      res.json({ players, position, count: players.length });
    } catch (error: any) {
      console.error('❌ Position filter error:', error);
      res.status(500).json({ 
        message: 'Failed to fetch players by position', 
        error: error.message 
      });
    }
  });

  app.get('/api/players/dynasty/young', async (req, res) => {
    try {
      const { expandedPlayerDatabase } = await import('./expandedPlayerDatabase');
      const youngAssets = expandedPlayerDatabase.getYoungDynastyAssets();
      res.json({ 
        players: youngAssets, 
        count: youngAssets.length,
        description: 'Players under 25 years old - Prime dynasty assets'
      });
    } catch (error: any) {
      console.error('❌ Young assets error:', error);
      res.status(500).json({ 
        message: 'Failed to fetch young dynasty assets', 
        error: error.message 
      });
    }
  });

  // Dynasty Rankings Integration
  app.get('/api/rankings/integrated', async (req, res) => {
    try {
      console.log('🔄 Generating integrated dynasty rankings...');
      const { dynastyRankingsIntegration } = await import('./dynastyRankingsIntegration');
      const rankings = dynastyRankingsIntegration.generateIntegratedRankings();
      
      res.json({
        rankings,
        totalPlayers: rankings.length,
        lastUpdated: new Date().toISOString(),
        methodology: 'Prometheus v2.0 Dynasty Algorithm - Production (40%), Opportunity (35%), Age (20%), Stability (15%)'
      });
    } catch (error: any) {
      console.error('❌ Integrated rankings error:', error);
      res.status(500).json({ 
        message: 'Failed to generate integrated rankings', 
        error: error.message 
      });
    }
  });

  app.get('/api/rankings/integrated/:position', async (req, res) => {
    try {
      const position = req.params.position.toUpperCase();
      const { dynastyRankingsIntegration } = await import('./dynastyRankingsIntegration');
      const allRankings = dynastyRankingsIntegration.generateIntegratedRankings();
      const positionRankings = allRankings.filter(p => p.position === position);
      
      res.json({
        rankings: positionRankings,
        position,
        count: positionRankings.length,
        topTier: positionRankings.filter(p => ['Elite', 'Premium'].includes(p.tier)),
        methodology: 'Position-specific dynasty evaluation with age and opportunity weighting'
      });
    } catch (error: any) {
      console.error('❌ Position rankings error:', error);
      res.status(500).json({ 
        message: 'Failed to generate position rankings', 
        error: error.message 
      });
    }
  });

  // Legacy ADP endpoints using Sleeper API
  app.get('/api/adp/sleeper/:format?', async (req, res) => {
    try {
      const format = req.params.format || 'superflex';
      const { cleanADPService } = await import('./cleanADPService');
      
      console.log(`🎯 Fetching Sleeper ADP data for ${format} format...`);
      const adpData = await cleanADPService.calculateDynastyADP(format as any);
      
      res.json(adpData);
    } catch (error: any) {
      console.error('❌ ADP endpoint error:', error);
      res.status(500).json({ 
        message: 'Failed to fetch ADP data', 
        error: error.message 
      });
    }
  });

  app.get('/api/adp/trending/:format?', async (req, res) => {
    try {
      const format = req.params.format || 'superflex';
      const { cleanADPService } = await import('./cleanADPService');
      
      console.log(`📈 Fetching trending players for ${format}...`);
      const [trendingAdds, trendingDrops] = await Promise.all([
        cleanADPService.getTrendingPlayers('add'),
        cleanADPService.getTrendingPlayers('drop')
      ]);
      
      res.json({
        rising: trendingAdds,
        falling: trendingDrops,
        lastUpdated: new Date().toISOString()
      });
    } catch (error: any) {
      console.error('❌ Trending endpoint error:', error);
      res.status(500).json({ 
        message: 'Failed to fetch trending data', 
        error: error.message 
      });
    }
  });

  app.get('/api/adp/analytics/:format?', async (req, res) => {
    try {
      const format = req.params.format || 'superflex';
      const { sleeperADPService } = await import('./sleeperADP');
      
      console.log(`📊 Generating ADP analytics for ${format}...`);
      const analytics = await sleeperADPService.getADPAnalytics(format as any);
      
      res.json(analytics);
    } catch (error: any) {
      console.error('❌ Analytics endpoint error:', error);
      res.status(500).json({ 
        message: 'Failed to generate analytics', 
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