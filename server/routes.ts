import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { teamSyncService } from "./teamSync";
import { optimizeLineup, calculateConfidence, analyzeTradeOpportunities, generateWaiverRecommendations } from "./analytics";
import { valueArbitrageService } from "./valueArbitrage";
import { sportsDataAPI } from "./sportsdata";
import { playerAnalysisCache } from "./playerAnalysisCache";
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

  // Player search for autocomplete
  app.get('/api/players/search', async (req, res) => {
    try {
      const query = req.query.q as string;
      if (!query || query.length < 2) {
        return res.json([]);
      }
      
      // Get available players from cache
      const availablePlayers = playerAnalysisCache.getAvailablePlayers();
      
      // Filter by search query
      const matches = availablePlayers
        .filter(name => name.toLowerCase().includes(query.toLowerCase()))
        .slice(0, 10) // Limit results
        .map(name => ({
          name,
          team: 'NFL', // Simplified for now
          position: 'WR' // Most of our cached players are WRs
        }));
      
      res.json(matches);
    } catch (error) {
      console.error('Error searching players:', error);
      res.status(500).json({ error: 'Search failed' });
    }
  });

  // Dynasty Valuation endpoint - our unique weighted scoring
  app.get('/api/dynasty/valuation/:playerId', async (req, res) => {
    try {
      const playerId = parseInt(req.params.playerId);
      const player = await storage.getPlayer(playerId);
      
      if (!player) {
        return res.status(404).json({ error: 'Player not found' });
      }
      
      const { dynastyValuationService } = await import('./dynastyValuation');
      const valuation = await dynastyValuationService.calculateDynastyValue(player);
      
      res.json(valuation);
    } catch (error) {
      console.error('Error calculating dynasty valuation:', error);
      res.status(500).json({ error: 'Failed to calculate dynasty value' });
    }
  });

  // Team dynasty valuations - ranked by our system
  app.get('/api/dynasty/team/:teamId/valuations', async (req, res) => {
    try {
      const teamId = parseInt(req.params.teamId);
      const teamPlayers = await storage.getTeamPlayers(teamId);
      
      const { dynastyValuationService } = await import('./dynastyValuation');
      const valuations = await dynastyValuationService.calculateTeamValues(teamPlayers);
      
      res.json(valuations);
    } catch (error) {
      console.error('Error calculating team valuations:', error);
      res.status(500).json({ error: 'Failed to calculate team valuations' });
    }
  });

  // Player Analysis endpoint with smart caching
  app.get("/api/analysis/player/:name", async (req, res) => {
    try {
      const playerName = decodeURIComponent(req.params.name);
      console.log(`Player analysis request for: ${playerName}`);
      
      // Use the smart caching system
      const analysis = await playerAnalysisCache.getPlayerAnalysis(playerName, 2024);
      return res.json(analysis);
      
    } catch (error) {
      console.error("Player analysis error:", error);
      
      // Check if it's a "not available" error vs a real error
      if (error.message.includes("not available")) {
        const availablePlayers = playerAnalysisCache.getAvailablePlayers();
        return res.status(500).json({ 
          error: error.message,
          availablePlayers: availablePlayers,
          suggestion: `Try searching for: ${availablePlayers.slice(0, 3).join(', ')}`
        });
      }
      
      return res.status(500).json({ message: "Failed to analyze player" });
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
      
      // Match players to database and add to team
      const matchedPlayers = await teamSyncService.matchPlayersToDatabase(syncData);
      
      // Add matched players to team
      let playersAdded = 0;
      for (const match of matchedPlayers) {
        if (match.player && match.confidence > 0.8) {
          try {
            await storage.addPlayerToTeam({
              teamId: teamId,
              playerId: match.player.id,
              isStarter: match.syncPlayer.isStarter || false
            });
            playersAdded++;
          } catch (error) {
            console.log(`Player ${match.player.name} already on team or error adding:`, error);
          }
        }
      }
      
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
        playersFound: syncData.players.length,
        playersAdded: playersAdded
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
      
      // Match players to database and add to team
      const matchedPlayers = await teamSyncService.matchPlayersToDatabase(syncData);
      
      // Clear existing team roster
      const existingPlayers = await storage.getTeamPlayers(teamId);
      for (const player of existingPlayers) {
        // Note: We don't have a remove method, so we'll skip this for now
      }
      
      // Add matched players to team, create missing players
      console.log(`Processing ${matchedPlayers.length} players from Sleeper sync`);
      let playersAdded = 0;
      for (const match of matchedPlayers) {
        let playerId: number;
        
        if (match.player && match.confidence > 0.8) {
          // Use existing player
          playerId = match.player.id;
          console.log(`Using existing player: ${match.player.name} (confidence: ${match.confidence})`);
        } else {
          // Create missing player
          console.log(`Creating new player: ${match.syncPlayer.name} (confidence: ${match.confidence})`);
          try {
            const newPlayer = await storage.createPlayer({
              name: match.syncPlayer.name,
              team: match.syncPlayer.team || "UNK",
              position: match.syncPlayer.position || "FLEX",
              avgPoints: 10.0,
              projectedPoints: 10.0,
              ownershipPercentage: 50,
              isAvailable: false,
              upside: 5.0
            });
            playerId = newPlayer.id;
            console.log(`Created player ${newPlayer.name} with ID ${newPlayer.id}`);
          } catch (error) {
            console.log(`Failed to create player ${match.syncPlayer.name}:`, error);
            continue;
          }
        }
        
        // Add player to team
        try {
          await storage.addPlayerToTeam({
            teamId: teamId,
            playerId: playerId,
            isStarter: match.syncPlayer.isStarter || false
          });
          playersAdded++;
        } catch (error) {
          console.log(`Player already on team or error adding:`, error);
        }
      }
      
      // Update team with sync metadata and name
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
        playersFound: syncData.players.length,
        playersAdded: playersAdded
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
      
      // Match players to database and add to team
      const matchedPlayers = await teamSyncService.matchPlayersToDatabase(syncData);
      
      // Add matched players to team
      let playersAdded = 0;
      for (const match of matchedPlayers) {
        if (match.player && match.confidence > 0.8) {
          try {
            await storage.addPlayerToTeam({
              teamId: teamId,
              playerId: match.player.id,
              isStarter: match.syncPlayer.isStarter || false
            });
            playersAdded++;
          } catch (error) {
            console.log(`Player ${match.player.name} already on team or error adding:`, error);
          }
        }
      }
      
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
        playersFound: syncData.players.length,
        playersAdded: playersAdded
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

  // Premium Analytics Endpoint
  app.patch("/api/players/:id/premium", async (req, res) => {
    try {
      const playerId = parseInt(req.params.id);
      const premiumData = req.body;
      
      await storage.updatePlayerPremiumAnalytics(playerId, {
        ...premiumData,
        premiumDataUpdated: new Date()
      });
      
      res.json({ message: "Premium analytics updated successfully" });
    } catch (error) {
      console.error("Error updating premium analytics:", error);
      res.status(500).json({ message: "Failed to update premium analytics" });
    }
  });

  // Dynasty Trade History Endpoints
  app.get("/api/teams/:id/trades", async (req, res) => {
    try {
      const teamId = parseInt(req.params.id);
      const trades = await db.select()
        .from(dynastyTradeHistory)
        .where(eq(dynastyTradeHistory.teamId, teamId))
        .orderBy(desc(dynastyTradeHistory.tradeDate));
      res.json(trades);
    } catch (error) {
      console.error("Error fetching trade history:", error);
      res.status(500).json({ message: "Failed to fetch trade history" });
    }
  });

  app.post("/api/teams/:id/trades", async (req, res) => {
    try {
      const teamId = parseInt(req.params.id);
      const tradeData = {
        ...req.body,
        teamId,
      };
      
      const [trade] = await db.insert(dynastyTradeHistory)
        .values(tradeData)
        .returning();
      
      res.json(trade);
    } catch (error) {
      console.error("Error creating trade:", error);
      res.status(500).json({ message: "Failed to create trade" });
    }
  });

  // Value Arbitrage Endpoints
  app.get("/api/arbitrage/opportunities", async (req, res) => {
    try {
      const { position, limit } = req.query;
      const opportunities = await valueArbitrageService.findArbitrageOpportunities(
        limit ? parseInt(limit as string) : 20
      );
      res.json(opportunities);
    } catch (error) {
      console.error("Error fetching arbitrage opportunities:", error);
      res.status(500).json({ message: "Failed to fetch arbitrage opportunities" });
    }
  });

  // Quick test endpoint for arbitrage functionality
  app.get("/api/arbitrage/test", async (req, res) => {
    try {
      const { testArbitrageSystem } = await import("./arbitrageTest");
      const opportunities = await testArbitrageSystem();
      res.json({ 
        message: "Arbitrage test completed",
        count: opportunities.length,
        opportunities 
      });
    } catch (error) {
      console.error("Error in arbitrage test:", error);
      res.status(500).json({ message: "Arbitrage test failed" });
    }
  });

  app.get("/api/arbitrage/player/:id", async (req, res) => {
    try {
      const playerId = parseInt(req.params.id);
      const opportunity = await valueArbitrageService.analyzePlayer(playerId);
      res.json(opportunity);
    } catch (error) {
      console.error("Error analyzing player for arbitrage:", error);
      res.status(500).json({ message: "Failed to analyze player" });
    }
  });

  // Hit rate endpoint removed - requires actual historical validation data
  
  // Get player search suggestions for autocomplete
  app.get("/api/players/search", async (req, res) => {
    try {
      const { q } = req.query;
      if (!q || typeof q !== 'string' || q.length < 2) {
        return res.json([]);
      }
      
      // Get dynasty-relevant players (QB, RB, WR, TE) matching search
      const searchTerm = q.toLowerCase();
      const searchResults = await db.select({
        id: playersTable.id,
        name: playersTable.name,
        team: playersTable.team,
        position: playersTable.position
      })
      .from(playersTable)
      .where(
        and(
          sql`LOWER(${playersTable.name}) LIKE ${`%${searchTerm}%`}`,
          sql`${playersTable.position} IN ('QB', 'RB', 'WR', 'TE')`
        )
      )
      .limit(10)
      .orderBy(playersTable.name);
      
      res.json(searchResults);
    } catch (error) {
      console.error("Error searching players:", error);
      res.status(500).json({ message: "Failed to search players" });
    }
  });



  const httpServer = createServer(app);
  return httpServer;
}
