import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { teamSyncService } from "./teamSync";
import { optimizeLineup, calculateConfidence, analyzeTradeOpportunities, generateWaiverRecommendations } from "./analytics";
import { valueArbitrageService } from "./valueArbitrage";
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

  // Value Arbitrage Endpoints
  app.get("/api/arbitrage/opportunities", async (req, res) => {
    try {
      const { position, limit } = req.query;
      const opportunities = await valueArbitrageService.findArbitrageOpportunities(
        position as string,
        limit ? parseInt(limit as string) : 20
      );
      res.json(opportunities);
    } catch (error) {
      console.error("Error fetching arbitrage opportunities:", error);
      res.status(500).json({ message: "Failed to fetch arbitrage opportunities" });
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

  app.get("/api/arbitrage/hit-rate", async (req, res) => {
    try {
      const hitRate = await valueArbitrageService.calculateHitRate();
      res.json(hitRate);
    } catch (error) {
      console.error("Error calculating hit rate:", error);
      res.status(500).json({ message: "Failed to calculate hit rate" });
    }
  });

  // Player Analysis Endpoint for individual breakdown
  app.get("/api/analysis/player/:name", async (req, res) => {
    try {
      const playerName = decodeURIComponent(req.params.name);
      
      // Get player data from SportsDataIO
      const players = await sportsDataAPI.getActivePlayers();
      const player = players.find(p => 
        p.Name.toLowerCase().includes(playerName.toLowerCase()) ||
        `${p.FirstName} ${p.LastName}`.toLowerCase().includes(playerName.toLowerCase())
      );

      if (!player) {
        return res.status(404).json({ message: `Player ${playerName} not found` });
      }

      // Get 2024 season stats
      const seasonStats = await sportsDataAPI.getPlayerStats("2024REG");
      const playerStats = seasonStats.find(s => s.PlayerID === player.PlayerID);

      // Calculate advanced metrics
      const analysis = {
        player: {
          name: player.Name,
          team: player.Team,
          position: player.Position,
          age: player.Age,
          experience: player.ExperienceString,
          injury: {
            status: player.InjuryStatus,
            bodyPart: player.InjuryBodyPart,
            notes: player.InjuryNotes
          }
        },
        marketData: {
          adp: player.AverageDraftPosition,
          depthChart: {
            position: player.DepthChartPosition,
            order: player.DepthChartOrder
          },
          dfsIds: {
            fanDuel: player.FanDuelPlayerID,
            draftKings: player.DraftKingsPlayerID,
            yahoo: player.YahooPlayerID
          }
        },
        seasonStats: playerStats ? {
          games: playerStats.Games,
          // Receiving stats
          targets: playerStats.ReceivingTargets,
          receptions: playerStats.Receptions,
          receivingYards: playerStats.ReceivingYards,
          receivingTDs: playerStats.ReceivingTouchdowns,
          yardsPerTarget: playerStats.ReceivingYardsPerTarget,
          yardsPerReception: playerStats.ReceivingYardsPerReception,
          receptionPercentage: playerStats.ReceptionPercentage,
          // Snap data
          offensiveSnaps: playerStats.OffensiveSnapsPlayed,
          teamSnaps: playerStats.OffensiveTeamSnaps,
          snapPercentage: playerStats.OffensiveTeamSnaps > 0 ? 
            (playerStats.OffensiveSnapsPlayed / playerStats.OffensiveTeamSnaps * 100) : 0,
          // Fantasy
          fantasyPoints: playerStats.FantasyPoints,
          fantasyPointsPPR: playerStats.FantasyPointsPPR,
          fantasyPointsPerGame: playerStats.FantasyPointsPerGame,
          fantasyPointsPPRPerGame: playerStats.FantasyPointsPPRPerGame,
          // Platform specific
          fanDuelPoints: playerStats.FantasyPointsFanDuel,
          draftKingsPoints: playerStats.FantasyPointsDraftKings,
          yahooPoints: playerStats.FantasyPointsYahoo
        } : null,
        advancedMetrics: playerStats ? {
          // Calculate yards per route run (approximation)
          yardsPerRouteRun: playerStats.OffensiveSnapsPlayed > 0 ? 
            (playerStats.ReceivingYards / playerStats.OffensiveSnapsPlayed).toFixed(3) : 0,
          // Target share would need team totals
          efficiency: {
            yardsPerTarget: playerStats.ReceivingYardsPerTarget,
            catchRate: playerStats.ReceptionPercentage,
            yardsAfterCatch: playerStats.ReceivingYards > 0 && playerStats.Receptions > 0 ? 
              (playerStats.ReceivingYards - (playerStats.ReceivingTargets * 8)).toFixed(1) : 0 // Rough YAC estimate
          },
          volume: {
            targets: playerStats.ReceivingTargets,
            airYards: playerStats.ReceivingTargets * 8, // Rough air yards estimate
            snapsPerGame: playerStats.Games > 0 ? 
              (playerStats.OffensiveSnapsPlayed / playerStats.Games).toFixed(1) : 0
          }
        } : null
      };

      res.json(analysis);
    } catch (error) {
      console.error("Error analyzing player:", error);
      res.status(500).json({ message: "Failed to analyze player" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
