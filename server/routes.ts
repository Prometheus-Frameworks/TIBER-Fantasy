import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { teamSyncService } from "./teamSync";
import { optimizeLineup, calculateConfidence, analyzeTradeOpportunities, generateWaiverRecommendations } from "./analytics";
import { sportsDataAPI } from "./sportsdata";
import { playerAnalysisCache } from "./playerAnalysisCache";
import { espnAPI } from "./espnAPI";
import { dataRefreshService } from "./dataRefresh";
import { db } from "./db";
import { dynastyTradeHistory, players as playersTable } from "@shared/schema";
import { eq, desc, and, sql } from "drizzle-orm";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Get team overview
  app.get("/api/teams/:id", async (req, res) => {
    try {
      const teamId = parseInt(req.params.id);
      const team = await storage.getTeam(teamId);
      
      if (!team) {
        return res.status(404).json({ message: "Team not found" });
      }
      
      res.json(team);
    } catch (error: any) {
      res.status(500).json({ message: "Failed to fetch team" });
    }
  });

  // Update team settings
  app.patch("/api/teams/:id", async (req, res) => {
    try {
      const teamId = parseInt(req.params.id);
      const updates = req.body;
      
      await storage.updateTeam(teamId, updates);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: "Failed to update team" });
    }
  });

  // Get team players
  app.get("/api/teams/:id/players", async (req, res) => {
    try {
      const teamId = parseInt(req.params.id);
      const players = await storage.getTeamPlayers(teamId);
      
      res.json(players);
    } catch (error: any) {
      res.status(500).json({ message: "Failed to fetch team players" });
    }
  });

  // Get team position analysis
  app.get("/api/teams/:id/analysis", async (req, res) => {
    try {
      const teamId = parseInt(req.params.id);
      const analysis = await storage.getPositionAnalysis(teamId);
      
      res.json(analysis);
    } catch (error: any) {
      res.status(500).json({ message: "Failed to fetch team analysis" });
    }
  });

  // Get team weekly performance
  app.get("/api/teams/:id/performance", async (req, res) => {
    try {
      const teamId = parseInt(req.params.id);
      const performance = await storage.getWeeklyPerformance(teamId);
      
      res.json(performance);
    } catch (error: any) {
      res.status(500).json({ message: "Failed to fetch performance data" });
    }
  });

  // Get player recommendations for a team
  app.get("/api/teams/:id/recommendations", async (req, res) => {
    try {
      const teamId = parseInt(req.params.id);
      const position = req.query.position as string | undefined;
      
      const recommendations = await storage.getPlayerRecommendations(teamId, position);
      
      res.json(recommendations);
    } catch (error: any) {
      res.status(500).json({ message: "Failed to generate recommendations" });
    }
  });

  // Add player to team
  app.post("/api/teams/:id/players", async (req, res) => {
    try {
      const teamId = parseInt(req.params.id);
      const { playerId, isStarter } = req.body;
      
      const teamPlayer = await storage.addPlayerToTeam({
        teamId,
        playerId,
        isStarter: isStarter || false
      });
      
      res.json(teamPlayer);
    } catch (error: any) {
      res.status(500).json({ message: "Failed to add player to team" });
    }
  });

  // Sync team with external platforms
  app.post("/api/teams/:id/sync/:platform", async (req, res) => {
    try {
      const teamId = parseInt(req.params.id);
      const platform = req.params.platform;
      const { leagueId, teamId: externalTeamId, playerNames } = req.body;
      
      let result;
      switch (platform) {
        case 'espn':
          result = await teamSyncService.syncFromESPN(teamId, leagueId, externalTeamId);
          break;
        case 'sleeper':
          result = await teamSyncService.syncFromSleeper(teamId, leagueId, externalTeamId);
          break;
        case 'manual':
          result = await teamSyncService.syncManual(teamId, playerNames);
          break;
        default:
          return res.status(400).json({ message: "Unsupported platform" });
      }
      
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: "Failed to sync team" });
    }
  });

  // Test sync endpoints
  app.post("/api/sync/test/:platform", async (req, res) => {
    try {
      const platform = req.params.platform;
      const { leagueId } = req.body;
      
      let result;
      switch (platform) {
        case 'espn':
          result = await teamSyncService.testESPNSync(leagueId);
          break;
        case 'sleeper':
          result = await teamSyncService.testSleeperSync(leagueId);
          break;
        default:
          return res.status(400).json({ message: "Unsupported platform" });
      }
      
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: "Failed to test sync" });
    }
  });

  // Get player analysis with SportsDataIO
  app.get("/api/players/:id/analysis", async (req, res) => {
    try {
      const playerId = parseInt(req.params.id);
      const player = await storage.getPlayer(playerId);
      
      if (!player) {
        return res.status(404).json({ message: "Player not found" });
      }
      
      // Check cache first
      const cachedAnalysis = await playerAnalysisCache.get(player.name);
      if (cachedAnalysis) {
        return res.json(cachedAnalysis);
      }
      
      // Fallback to error when no cache available
      return res.status(500).json({ message: "Analysis data not available" });
    } catch (error: any) {
      return res.status(500).json({ message: "Failed to analyze player" });
    }
  });

  // Get available players with dynasty values
  app.get("/api/players/available", async (req, res) => {
    try {
      const position = req.query.position as string | undefined;
      const players = await storage.getAvailablePlayers(position);
      
      // Use only authentic storage players - no mock data
      const combinedPlayers = players;
      
      // Calculate dynasty values using Jake Maraia rankings
      const { DynastyTierEngine } = await import('./dynastyTierSystem');
      const { getJakeMaraiaDynastyScore, getJakeMaraiaDynastyTier } = await import('./jakeMaraiaRankings');
      const dynastyEngine = new DynastyTierEngine();
      
      const playersWithDynastyValues = combinedPlayers.map(player => {
        const dynastyScore = getJakeMaraiaDynastyScore(player.name, player.position);
        const dynastyTier = getJakeMaraiaDynastyTier(player.name, player.position);
        
        return {
          ...player,
          dynastyValue: dynastyScore,
          dynastyTier: dynastyTier
        };
      });
      
      res.json(playersWithDynastyValues);
    } catch (error: any) {
      res.status(500).json({ message: "Failed to fetch available players" });
    }
  });

  // Search players
  app.get("/api/players/search", async (req, res) => {
    try {
      const query = req.query.q as string;
      const limit = parseInt(req.query.limit as string) || 10;
      
      if (!query || query.length < 2) {
        return res.json([]);
      }
      
      const players = await storage.searchPlayers(query, limit);
      res.json(players);
    } catch (error: any) {
      res.status(500).json({ message: "Failed to search players" });
    }
  });

  // League comparison endpoints
  app.get("/api/compare/leagues", async (req, res) => {
    try {
      const { leagueComparison } = await import('./leagueComparison');
      const result = await leagueComparison.compareLeagues();
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: "Failed to compare leagues" });
    }
  });

  // Dynasty rankings comparison
  app.get("/api/rankings/dynasty", async (req, res) => {
    try {
      const dynastyRankings = await storage.getAllPlayers();
      
      // Calculate our ranking vs market ADP for value identification
      const rankingsWithValue = dynastyRankings.map((player, index) => {
        const ourRank = index + 1;
        const marketADP = player.adp || 999;
        const adpDifference = marketADP - ourRank;
        
        return {
          ...player,
          ourRank,
          marketADP,
          adpDifference,
          valueCategory: adpDifference >= 50 ? 'STEAL' : 
                       adpDifference >= 25 ? 'VALUE' : 
                       adpDifference <= -50 ? 'AVOID' : 
                       adpDifference <= -25 ? 'OVERVALUED' : 'FAIR'
        };
      }).sort((a, b) => {
        return b.adpDifference - a.adpDifference;
      });
      
      res.json(rankingsWithValue);
    } catch (error: any) {
      res.status(500).json({ message: "Failed to calculate rankings" });
    }
  });

  // League Rankings - Total Team Values
  app.get("/api/league/rankings", async (req, res) => {
    try {
      const { leagueRankingService } = await import('./leagueRankings');
      const leagueRankings = await leagueRankingService.calculateLeagueRankings();
      
      res.json(leagueRankings);
    } catch (error: any) {
      res.status(500).json({ message: "Failed to calculate league rankings" });
    }
  });

  // Position-specific rankings (QB, RB, WR, TE, SFLEX)
  app.get('/api/rankings/position/:position', async (req, res) => {
    try {
      const { position } = req.params;
      const validPositions = ['QB', 'RB', 'WR', 'TE', 'SFLEX'];
      
      if (!validPositions.includes(position)) {
        return res.status(400).json({ message: `Invalid position. Must be one of: ${validPositions.join(', ')}` });
      }

      const { positionRankingService } = await import('./positionRankings');
      const rankings = await positionRankingService.generatePositionRankings(position as any);
      res.json(rankings);
    } catch (error: any) {
      res.status(500).json({ message: `Failed to generate ${req.params.position} rankings` });
    }
  });

  // Create new team
  app.post("/api/teams", async (req, res) => {
    try {
      const teamData = req.body;
      const team = await storage.createTeam(teamData);
      res.json(team);
    } catch (error: any) {
      res.status(500).json({ message: "Failed to create team" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}