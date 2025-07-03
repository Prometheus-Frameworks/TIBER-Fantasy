import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { teamSyncService } from "./teamSync";
import { optimizeLineup, calculateConfidence, analyzeTradeOpportunities, generateWaiverRecommendations } from "./analytics";
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
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch team" });
    }
  });

  // Get team players
  app.get("/api/teams/:id/players", async (req, res) => {
    try {
      const teamId = parseInt(req.params.id);
      const players = await storage.getTeamPlayers(teamId);
      res.json(players);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch team players" });
    }
  });

  // Get position analysis
  app.get("/api/teams/:id/analysis", async (req, res) => {
    try {
      const teamId = parseInt(req.params.id);
      const analysis = await storage.getPositionAnalysis(teamId);
      res.json(analysis);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch position analysis" });
    }
  });

  // Get weekly performance
  app.get("/api/teams/:id/performance", async (req, res) => {
    try {
      const teamId = parseInt(req.params.id);
      const performance = await storage.getWeeklyPerformance(teamId);
      res.json(performance);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch performance data" });
    }
  });

  // Get player recommendations
  app.get("/api/teams/:id/recommendations", async (req, res) => {
    try {
      const teamId = parseInt(req.params.id);
      const position = req.query.position as string | undefined;
      const recommendations = await storage.getPlayerRecommendations(teamId, position);
      res.json(recommendations);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch recommendations" });
    }
  });

  // Get available players
  app.get("/api/players/available", async (req, res) => {
    try {
      const position = req.query.position as string | undefined;
      const players = await storage.getAvailablePlayers(position);
      res.json(players);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch available players" });
    }
  });

  // Team sync endpoints
  
  // Sync ESPN team
  app.post("/api/teams/:id/sync/espn", async (req, res) => {
    try {
      const teamId = parseInt(req.params.id);
      const { leagueId, espnTeamId, season } = req.body;
      
      if (!leagueId || !espnTeamId) {
        return res.status(400).json({ message: "League ID and ESPN Team ID are required" });
      }

      const syncData = await teamSyncService.syncESPNTeam(leagueId, espnTeamId, season || 2024);
      
      // Update team with sync metadata
      await storage.updateTeamSync(teamId, {
        syncPlatform: "espn",
        syncLeagueId: leagueId,
        syncTeamId: espnTeamId,
        lastSyncDate: new Date(),
        syncEnabled: true
      });

      res.json({
        message: "ESPN team synced successfully",
        syncData,
        playersFound: syncData.players.length
      });
    } catch (error) {
      console.error("ESPN sync error:", error);
      res.status(500).json({ message: `ESPN sync failed: ${error}` });
    }
  });

  // Sync Sleeper team
  app.post("/api/teams/:id/sync/sleeper", async (req, res) => {
    try {
      const teamId = parseInt(req.params.id);
      const { leagueId, userId } = req.body;
      
      if (!leagueId || !userId) {
        return res.status(400).json({ message: "League ID and User ID are required" });
      }

      const syncData = await teamSyncService.syncSleeperTeam(leagueId, userId);
      
      // Update team with sync metadata
      await storage.updateTeamSync(teamId, {
        syncPlatform: "sleeper",
        syncLeagueId: leagueId,
        syncTeamId: userId,
        lastSyncDate: new Date(),
        syncEnabled: true
      });

      res.json({
        message: "Sleeper team synced successfully",
        syncData,
        playersFound: syncData.players.length
      });
    } catch (error) {
      console.error("Sleeper sync error:", error);
      res.status(500).json({ message: `Sleeper sync failed: ${error}` });
    }
  });

  // Manual team import
  app.post("/api/teams/:id/sync/manual", async (req, res) => {
    try {
      const teamId = parseInt(req.params.id);
      const { playerNames, teamName } = req.body;
      
      if (!Array.isArray(playerNames) || playerNames.length === 0) {
        return res.status(400).json({ message: "Player names array is required" });
      }

      const syncData = await teamSyncService.syncManualTeam(playerNames, teamName || "My Team");
      
      // Update team with sync metadata
      await storage.updateTeamSync(teamId, {
        syncPlatform: "manual",
        syncLeagueId: null,
        syncTeamId: null,
        lastSyncDate: new Date(),
        syncEnabled: false
      });

      res.json({
        message: "Manual team import completed",
        syncData,
        playersFound: syncData.players.length
      });
    } catch (error) {
      console.error("Manual sync error:", error);
      res.status(500).json({ message: `Manual import failed: ${error}` });
    }
  });

  // Test sync endpoints (for development)
  app.post("/api/sync/test/espn", async (req, res) => {
    try {
      const { leagueId, teamId } = req.body;
      const syncData = await teamSyncService.syncESPNTeam(leagueId, teamId);
      res.json(syncData);
    } catch (error) {
      res.status(500).json({ message: `Test failed: ${error}` });
    }
  });

  app.post("/api/sync/test/sleeper", async (req, res) => {
    try {
      const { leagueId, userId } = req.body;
      const syncData = await teamSyncService.syncSleeperTeam(leagueId, userId);
      res.json(syncData);
    } catch (error) {
      res.status(500).json({ message: `Test failed: ${error}` });
    }
  });

  // Advanced Analytics Endpoints
  app.get("/api/teams/:id/lineup-optimizer", async (req, res) => {
    const teamId = parseInt(req.params.id);
    const week = parseInt(req.query.week as string) || 18;
    
    try {
      const teamPlayers = await storage.getTeamPlayers(teamId);
      
      // Analyze optimal lineup based on current projections
      const lineup = optimizeLineup(teamPlayers);
      
      res.json({
        week,
        optimizedLineup: lineup,
        projectedPoints: lineup.totalProjected,
        confidence: calculateConfidence(lineup),
        recommendations: lineup.recommendations || []
      });
    } catch (error) {
      console.error("Error optimizing lineup:", error);
      res.status(500).json({ message: "Failed to optimize lineup" });
    }
  });

  app.get("/api/teams/:id/trade-analyzer", async (req, res) => {
    const teamId = parseInt(req.params.id);
    
    try {
      const teamPlayers = await storage.getTeamPlayers(teamId);
      const availablePlayers = await storage.getAvailablePlayers();
      
      const analysis = analyzeTradeOpportunities(teamPlayers, availablePlayers);
      
      res.json({
        tradeTargets: analysis.targets,
        teamNeeds: analysis.needs,
        surplus: analysis.surplus,
        recommendations: analysis.recommendations
      });
    } catch (error) {
      console.error("Error analyzing trades:", error);
      res.status(500).json({ message: "Failed to analyze trades" });
    }
  });

  app.get("/api/teams/:id/waiver-wire", async (req, res) => {
    const teamId = parseInt(req.params.id);
    
    try {
      const teamPlayers = await storage.getTeamPlayers(teamId);
      const availablePlayers = await storage.getAvailablePlayers();
      
      const recommendations = generateWaiverRecommendations(teamPlayers, availablePlayers);
      
      res.json({
        recommendations,
        totalAvailable: availablePlayers.length,
        priorityPickups: recommendations.slice(0, 5)
      });
    } catch (error) {
      console.error("Error fetching waiver recommendations:", error);
      res.status(500).json({ message: "Failed to fetch waiver recommendations" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
