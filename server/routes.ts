import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { teamSyncService } from "./teamSync";
import { optimizeLineup, calculateConfidence, analyzeTradeOpportunities, generateWaiverRecommendations } from "./analytics";
import { valueArbitrageEngine } from "./valueArbitrage";
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

  // Get available players with dynasty values
  app.get("/api/players/available", async (req, res) => {
    try {
      const position = req.query.position as string | undefined;
      const players = await storage.getAvailablePlayers(position);
      
      // Add elite dynasty players to improve ranking accuracy
      const { getEliteDynastyPlayers } = await import('./eliteDynastyPlayers');
      const elitePlayers = getEliteDynastyPlayers();
      
      // Filter elite players by position if specified
      const filteredElitePlayers = position 
        ? elitePlayers.filter(p => p.position === position)
        : elitePlayers;
      
      // Combine existing players with elite players (avoid duplicates by name)
      const existingNames = new Set(players.map(p => p.name));
      const uniqueElitePlayers = filteredElitePlayers.filter(p => !existingNames.has(p.name));
      
      const combinedPlayers = [...players, ...uniqueElitePlayers];
      
      // Calculate dynasty values using Jake Maraia rankings
      const { DynastyTierEngine } = await import('./dynastyTierSystem');
      const { getJakeMaraiaDynastyScore, getJakeMaraiaDynastyTier } = await import('./jakeMaraiaRankings');
      const dynastyEngine = new DynastyTierEngine();
      
      const playersWithDynastyValues = combinedPlayers.map(player => {
        // Use Jake Maraia's rankings or fallback calculation
        const jakeScore = getJakeMaraiaDynastyScore(player.name);
        const jakeTier = getJakeMaraiaDynastyTier(player.name);
        
        let dynastyValue: number;
        let dynastyTier: string;
        
        if (jakeScore !== null && jakeTier !== null) {
          dynastyValue = jakeScore;
          dynastyTier = jakeTier;
        } else {
          // Fallback for unranked players
          const result = dynastyEngine.calculateDynastyScore({
            name: player.name,
            position: player.position,
            age: 25, // Default age for missing data
            avgPoints: player.avgPoints,
            team: player.team
          });
          dynastyValue = result.score;
          dynastyTier = result.tier.label;
        }
        
        return {
          ...player,
          dynastyValue,
          dynastyTier
        };
      });
      
      res.json(playersWithDynastyValues);
    } catch (error) {
      console.error("Error fetching available players:", error);
      res.status(500).json({ message: "Failed to fetch available players" });
    }
  });

  // Jake Maraia ranking methodology analysis
  app.get('/api/analysis/jake-maraia-methodology', async (req, res) => {
    try {
      const { rankingAnalysis } = await import('./rankingAnalysis');
      const analyses = await rankingAnalysis.analyzeRankingFactors();
      const report = await rankingAnalysis.generateAnalysisReport();
      
      res.json({
        analyses,
        report,
        summary: {
          topFactor: analyses.sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation))[0],
          correlationStrength: analyses.map(a => ({ factor: a.factor, correlation: a.correlation }))
        }
      });
    } catch (error) {
      console.error('Error running ranking analysis:', error);
      res.status(500).json({ error: 'Failed to analyze rankings' });
    }
  });

  // League Import - Complete league standings and player import
  app.post("/api/teams/:id/import-league", async (req, res) => {
    try {
      const teamId = parseInt(req.params.id);
      const { leagueId, userId } = req.body;
      
      if (!leagueId || !userId) {
        return res.status(400).json({ 
          message: "League ID and User ID are required" 
        });
      }
      
      console.log(`Starting full league import for league: ${leagueId}, user: ${userId}`);
      
      const { leagueImportService } = await import('./leagueImport');
      
      // Import complete league and update team ranking
      await leagueImportService.updateTeamRanking(teamId, leagueId, userId);
      
      // Get updated team info
      const updatedTeam = await storage.getTeam(teamId);
      
      res.json({
        success: true,
        message: "League imported successfully",
        team: updatedTeam,
        rank: updatedTeam?.leagueRank || 0
      });
      
    } catch (error) {
      console.error("Error importing league:", error);
      res.status(500).json({ 
        message: `Failed to import league: ${error instanceof Error ? error.message : 'Unknown error'}` 
      });
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

  // Our Rankings vs Consensus ADP Comparison
  app.get("/api/rankings/comparison", async (req, res) => {
    try {
      // Select only existing columns to avoid database errors
      const playerData = await db.select({
        id: playersTable.id,
        name: playersTable.name,
        team: playersTable.team,
        position: playersTable.position,
        avgPoints: playersTable.avgPoints,
        projectedPoints: playersTable.projectedPoints,
        ownershipPercentage: playersTable.ownershipPercentage,
        isAvailable: playersTable.isAvailable,
        upside: playersTable.upside,
        injuryStatus: playersTable.injuryStatus,
        availability: playersTable.availability,
        consistency: playersTable.consistency,
        matchupRating: playersTable.matchupRating,
        trend: playersTable.trend,
        ownership: playersTable.ownership,
        targetShare: playersTable.targetShare,
        redZoneTargets: playersTable.redZoneTargets,
        carries: playersTable.carries,
        snapCount: playersTable.snapCount,
        externalId: playersTable.externalId
      }).from(playersTable).limit(100);
      
      const { rankingComparisonService } = await import('./rankingComparison');
      const rankings = await rankingComparisonService.generateRankings(playerData);
      
      // Sort by value opportunities (biggest steals first)
      rankings.sort((a, b) => {
        if (a.valueCategory === 'STEAL' && b.valueCategory !== 'STEAL') return -1;
        if (b.valueCategory === 'STEAL' && a.valueCategory !== 'STEAL') return 1;
        if (a.valueCategory === 'VALUE' && b.valueCategory !== 'VALUE') return -1;
        if (b.valueCategory === 'VALUE' && a.valueCategory !== 'VALUE') return 1;
        return b.adpDifference - a.adpDifference; // Largest positive difference first
      });
      
      res.json(rankings);
    } catch (error) {
      console.error("Error calculating ranking comparisons:", error);
      res.status(500).json({ message: "Failed to calculate rankings" });
    }
  });

  // League Rankings - Total Team Values (Players + Draft Picks)
  app.get("/api/league/rankings", async (req, res) => {
    try {
      const { leagueRankingService } = await import('./leagueRankings');
      const leagueRankings = await leagueRankingService.calculateLeagueRankings();
      
      res.json(leagueRankings);
    } catch (error) {
      console.error("Error calculating league rankings:", error);
      res.status(500).json({ message: "Failed to calculate league rankings" });
    }
  });

  // Position-specific rankings (QB, RB, WR, TE, SFLEX) - 1 to 250 rankings
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
    } catch (error) {
      console.error(`Error generating ${req.params.position} rankings:`, error);
      res.status(500).json({ message: `Failed to generate ${req.params.position} rankings` });
    }
  });

  // All position rankings at once
  app.get('/api/rankings/all-positions', async (req, res) => {
    try {
      const { positionRankingService } = await import('./positionRankings');
      const allRankings = await positionRankingService.getAllPositionRankings();
      res.json(allRankings);
    } catch (error) {
      console.error("Error generating all position rankings:", error);
      res.status(500).json({ message: "Failed to generate position rankings" });
    }
  });

  // Sleeper API Integration and Data Sync
  app.post("/api/sync/sleeper", async (req, res) => {
    try {
      const { sleeperAPI } = await import('./sleeperAPI');
      const syncResults = await sleeperAPI.syncSleeperData();
      
      res.json({
        message: "Sleeper data sync completed successfully",
        results: syncResults
      });
    } catch (error) {
      console.error("Error syncing Sleeper data:", error);
      res.status(500).json({ message: "Failed to sync Sleeper data" });
    }
  });

  // Get player data from Sleeper API
  app.get("/api/sleeper/player/:name", async (req, res) => {
    try {
      const { sleeperAPI } = await import('./sleeperAPI');
      const playerName = req.params.name;
      const playerData = await sleeperAPI.getPlayerAnalytics(playerName);
      
      if (!playerData) {
        return res.status(404).json({ message: "Player not found in Sleeper data" });
      }
      
      res.json(playerData);
    } catch (error) {
      console.error("Error fetching Sleeper player data:", error);
      res.status(500).json({ message: "Failed to fetch player data from Sleeper" });
    }
  });

  // Player Data Validation Diagnostics
  app.get("/api/validation/filtered-players", async (req, res) => {
    try {
      const { playerDataValidationService } = await import('./playerDataValidation');
      const allPlayers = await storage.getPlayers();
      
      const filteredDetails = [];
      const validPlayers = [];

      for (const player of allPlayers) {
        if (!playerDataValidationService.isValidPlayer(player)) {
          const reason = playerDataValidationService.getFilterReason(player);
          filteredDetails.push({
            name: player.name,
            position: player.position,
            team: player.team,
            avgPoints: player.avgPoints,
            ownershipPercentage: player.ownershipPercentage,
            injuryStatus: player.injuryStatus,
            reason: reason
          });
        } else {
          validPlayers.push(player);
        }
      }

      res.json({
        summary: {
          totalPlayers: allPlayers.length,
          validPlayers: validPlayers.length,
          filteredPlayers: filteredDetails.length
        },
        filteredPlayers: filteredDetails.sort((a, b) => a.name.localeCompare(b.name)),
        filteringCriteria: {
          explicitlyExcluded: [
            'Deshaun Watson (Suspended/not playing 2024)',
            'Calvin Ridley (Was suspended, may have outdated data)',
            'Josh Gordon (Suspended repeatedly)',
            'Alvin Kamara (Check if data is current)',
            'Leonard Fournette (Free agent/inactive)',
            'Kareem Hunt (Check current team status)'
          ],
          statisticalThresholds: {
            QB: { minPoints: 8, maxPoints: 28, maxOwnership: 90 },
            RB: { minPoints: 3, maxPoints: 25, maxOwnership: 85 },
            WR: { minPoints: 3, maxPoints: 22, maxOwnership: 80 },
            TE: { minPoints: 2, maxPoints: 18, maxOwnership: 75 }
          },
          activityChecks: [
            'Players with 0 points and <5% ownership (inactive)',
            'Players with Suspended/Retired injury status',
            'Players with >15 PPG but <10% ownership (data anomaly)'
          ]
        }
      });
    } catch (error) {
      console.error("Error generating validation report:", error);
      res.status(500).json({ message: "Failed to generate validation report" });
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
      const { valueArbitrageService } = await import('./valueArbitrage');
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
      const opportunity = await valueArbitrageEngine.analyzePlayer(playerId);
      res.json(opportunity);
    } catch (error) {
      console.error("Error analyzing player for arbitrage:", error);
      res.status(500).json({ message: "Failed to analyze player" });
    }
  });

  // Advanced player analytics endpoint
  app.get('/api/players/analytics', async (req, res) => {
    try {
      const { player: playerName } = req.query;
      
      if (!playerName || typeof playerName !== 'string') {
        return res.status(400).json({ message: "Player name required" });
      }
      
      // Find player by name (case-insensitive)
      const [player] = await db.select()
        .from(playersTable)
        .where(
          sql`LOWER(${playersTable.name}) LIKE LOWER(${'%' + playerName + '%'})`
        )
        .limit(1);
      
      if (!player) {
        return res.status(404).json({ message: "Player not found" });
      }
      
      // Import and use advanced analytics engine
      const { advancedAnalyticsEngine } = await import('./advancedAnalytics');
      const analytics = await advancedAnalyticsEngine.analyzePlayer(player);
      
      res.json(analytics);
    } catch (error) {
      console.error('Player analytics error:', error);
      res.status(500).json({ message: "Analytics calculation failed" });
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

  // League Analysis endpoints
  app.get('/api/league/:leagueId/analysis', async (req, res) => {
    try {
      const { leagueId } = req.params;
      const { userId } = req.query;
      
      const { leagueAnalysisService } = await import('./leagueSync');
      const leagueAnalysis = await leagueAnalysisService.analyzeFullLeague(leagueId, userId as string);
      res.json(leagueAnalysis);
    } catch (error: any) {
      console.error('League analysis error:', error);
      res.status(500).json({ error: error.message || 'Failed to analyze league' });
    }
  });

  app.get('/api/league/:leagueId/teams', async (req, res) => {
    try {
      const { leagueId } = req.params;
      const { leagueAnalysisService } = await import('./leagueSync');
      const analysis = await leagueAnalysisService.analyzeFullLeague(leagueId);
      res.json({
        teams: analysis.teams,
        leagueAverages: analysis.leagueAverages,
        powerRankings: analysis.powerRankings
      });
    } catch (error: any) {
      console.error('League teams error:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch league teams' });
    }
  });

  // Fantasy Moves Analysis endpoints
  app.get('/api/teams/:id/moves', async (req, res) => {
    try {
      const { id } = req.params;
      const { type, year } = req.query;
      
      // Import sample data for demonstration
      const { sampleMoves, getMovesByType } = await import('./sampleMovesData');
      
      let moves = sampleMoves;
      
      // Filter by type if specified
      if (type && typeof type === 'string') {
        moves = getMovesByType(moves, type);
      }
      
      // Filter by year if specified
      if (year && typeof year === 'string') {
        const targetYear = parseInt(year);
        moves = moves.filter(move => new Date(move.date).getFullYear() === targetYear);
      }
      
      res.json(moves);
    } catch (error) {
      console.error('Error fetching fantasy moves:', error);
      res.status(500).json({ error: 'Failed to fetch fantasy moves' });
    }
  });

  app.get('/api/teams/:id/moves/stats', async (req, res) => {
    try {
      const { id } = req.params;
      
      // Import sample data for demonstration
      const { sampleMoves, generateMoveStats, getTopMovesAnalysis } = await import('./sampleMovesData');
      
      const stats = generateMoveStats(sampleMoves);
      const topMoves = getTopMovesAnalysis(sampleMoves);
      
      res.json({
        overview: stats,
        analysis: topMoves
      });
    } catch (error) {
      console.error('Error generating move stats:', error);
      res.status(500).json({ error: 'Failed to generate move statistics' });
    }
  });

  app.post('/api/teams/:id/moves/analyze-trade', async (req, res) => {
    try {
      const { id } = req.params;
      const { playersGained, playersLost, picksGained, picksLost, tradeDate } = req.body;
      
      const { fantasyMovesValuation } = await import('./fantasyMovesValuation');
      
      const analysis = await fantasyMovesValuation.analyzeTrade(
        playersGained,
        playersLost,
        picksGained,
        picksLost,
        tradeDate ? new Date(tradeDate) : new Date()
      );
      
      res.json(analysis);
    } catch (error) {
      console.error('Error analyzing trade:', error);
      res.status(500).json({ error: 'Failed to analyze trade' });
    }
  });

  app.post('/api/teams/:id/moves/analyze-draft', async (req, res) => {
    try {
      const { id } = req.params;
      const { pick, year, playerId, playerName, draftDate } = req.body;
      
      const { fantasyMovesValuation } = await import('./fantasyMovesValuation');
      
      const analysis = await fantasyMovesValuation.analyzeDraftPick(
        pick,
        year,
        playerId,
        playerName,
        draftDate ? new Date(draftDate) : new Date()
      );
      
      res.json(analysis);
    } catch (error) {
      console.error('Error analyzing draft pick:', error);
      res.status(500).json({ error: 'Failed to analyze draft pick' });
    }
  });

  app.post('/api/teams/:id/moves/analyze-waiver', async (req, res) => {
    try {
      const { id } = req.params;
      const { playerId, playerName, waiverPosition, claimDate } = req.body;
      
      const { fantasyMovesValuation } = await import('./fantasyMovesValuation');
      
      const analysis = await fantasyMovesValuation.analyzeWaiverClaim(
        playerId,
        playerName,
        waiverPosition,
        claimDate ? new Date(claimDate) : new Date()
      );
      
      res.json(analysis);
    } catch (error) {
      console.error('Error analyzing waiver claim:', error);
      res.status(500).json({ error: 'Failed to analyze waiver claim' });
    }
  });

  // Trending Players Analysis endpoints
  app.get('/api/trending', async (req, res) => {
    try {
      const { position, category, minConfidence } = req.query;
      
      const { trendingPlayersService } = await import('./trendingPlayers');
      
      if (position || category || minConfidence) {
        const players = await trendingPlayersService.getFilteredTrending(
          position as string,
          category as string,
          minConfidence ? parseInt(minConfidence as string) : undefined
        );
        res.json({ players });
      } else {
        const analysis = await trendingPlayersService.getTrendingPlayers();
        res.json(analysis);
      }
    } catch (error) {
      console.error('Error fetching trending players:', error);
      res.status(500).json({ error: 'Failed to fetch trending players' });
    }
  });

  // Sustainability scoring endpoint
  app.get('/api/trending/:playerId/sustainability', async (req, res) => {
    try {
      const { playerId } = req.params;
      
      const { sustainabilityEngine } = await import('./breakoutSustainability');
      const { fantasyPointsDataETL } = await import('./fantasyPointsDataETL');
      
      // Get premium metrics for player
      const premiumMetrics = await fantasyPointsDataETL.runFullETL();
      
      // Calculate sustainability score
      const score = sustainabilityEngine.calculateSustainability(
        parseInt(playerId),
        "Sample Player", // In production, fetch from database
        "WR",
        {} as any, // Premium metrics
        { snapShareIncrease: 25, touchIncrease: 8, targetIncrease: 4, trendStartWeek: 9 }
      );
      
      res.json(score);
    } catch (error) {
      console.error('Error calculating sustainability score:', error);
      res.status(500).json({ error: 'Failed to calculate sustainability score' });
    }
  });

  // Value arbitrage endpoint
  app.get('/api/arbitrage/trending', async (req, res) => {
    try {
      const { valueArbitrageEngine } = await import('./valueArbitrage');
      
      const dashboard = await valueArbitrageEngine.analyzeTrendingArbitrage();
      res.json(dashboard);
    } catch (error) {
      console.error('Error analyzing arbitrage opportunities:', error);
      res.status(500).json({ error: 'Failed to analyze arbitrage opportunities' });
    }
  });

  // ETL pipeline status endpoint
  app.get('/api/etl/status', async (req, res) => {
    try {
      const { fantasyPointsDataETL } = await import('./fantasyPointsDataETL');
      
      // Return ETL pipeline status
      res.json({
        status: 'ready',
        lastRun: new Date(),
        nextScheduledRun: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
        subscription: {
          active: false,
          provider: 'FantasyPointsData',
          cost: '$200/year',
          features: [
            'Real-time target share tracking',
            'Route participation metrics',
            'Weighted opportunity ratings',
            'Dominator rating calculations',
            'Air yards share analysis'
          ]
        }
      });
    } catch (error) {
      console.error('Error fetching ETL status:', error);
      res.status(500).json({ error: 'Failed to fetch ETL status' });
    }
  });

  // Manual ETL trigger endpoint
  app.post('/api/etl/run', async (req, res) => {
    try {
      const { fantasyPointsDataETL } = await import('./fantasyPointsDataETL');
      
      const results = await fantasyPointsDataETL.runFullETL();
      res.json({
        success: true,
        results,
        message: 'ETL pipeline completed successfully'
      });
    } catch (error) {
      console.error('Error running ETL pipeline:', error);
      res.status(500).json({ error: 'Failed to run ETL pipeline' });
    }
  });

  app.get('/api/trending/:playerId/analysis', async (req, res) => {
    try {
      const { playerId } = req.params;
      
      const { trendingPlayersService } = await import('./trendingPlayers');
      
      const analysis = await trendingPlayersService.analyzePlayerTrend(parseInt(playerId));
      res.json(analysis);
    } catch (error) {
      console.error('Error analyzing player trend:', error);
      res.status(500).json({ error: 'Failed to analyze player trend' });
    }
  });

  app.get('/api/trending/premium-preview', async (req, res) => {
    try {
      // Preview of what FantasyPointsData integration would provide
      res.json({
        subscription: {
          name: "FantasyPointsData Premium",
          price: "$200/year",
          status: "not_subscribed"
        },
        premiumMetrics: [
          {
            name: "Target Share",
            description: "Percentage of team targets (vs X% placeholder)",
            example: "23.4% late season vs 12.1% early"
          },
          {
            name: "Route Participation",
            description: "Percentage of passing plays where player ran route",
            example: "78.5% route participation rate"
          },
          {
            name: "Weighted Opportunity Rating",
            description: "Composite score weighting targets, carries, and red zone touches",
            example: "8.7 WOR (top 15% at position)"
          },
          {
            name: "Dominator Rating",
            description: "Share of team's total offensive production",
            example: "31.2% dominator rating"
          },
          {
            name: "Air Yards Share",
            description: "Percentage of team's total air yards",
            example: "28.9% air yards share"
          }
        ],
        features: [
          "Real-time role tracking from Week 9 onward",
          "Advanced breakout context analysis",
          "Sustainability probability models",
          "2025 projection algorithms",
          "Integration with dynasty value APIs"
        ]
      });
    } catch (error) {
      console.error('Error fetching premium preview:', error);
      res.status(500).json({ error: 'Failed to fetch premium preview' });
    }
  });

  // ESPN API Integration Routes
  app.get("/api/espn/scoreboard", async (req, res) => {
    try {
      const date = req.query.date as string;
      const scoreboard = date 
        ? await espnAPI.getScoreboardByDate(date)
        : await espnAPI.getCurrentScoreboard();
      res.json(scoreboard);
    } catch (error) {
      console.error("ESPN scoreboard error:", error);
      res.status(500).json({ message: "Failed to fetch ESPN scoreboard" });
    }
  });

  app.get("/api/espn/news", async (req, res) => {
    try {
      const news = await espnAPI.getLatestNews();
      res.json(news);
    } catch (error) {
      console.error("ESPN news error:", error);
      res.status(500).json({ message: "Failed to fetch ESPN news" });
    }
  });

  app.get("/api/espn/news/injuries", async (req, res) => {
    try {
      const injuryNews = await espnAPI.getInjuryNews();
      res.json(injuryNews);
    } catch (error) {
      console.error("ESPN injury news error:", error);
      res.status(500).json({ message: "Failed to fetch injury news" });
    }
  });

  app.get("/api/espn/teams", async (req, res) => {
    try {
      const teams = await espnAPI.getAllTeams();
      res.json(teams);
    } catch (error) {
      console.error("ESPN teams error:", error);
      res.status(500).json({ message: "Failed to fetch ESPN teams" });
    }
  });

  app.get("/api/espn/teams/:teamId", async (req, res) => {
    try {
      const team = await espnAPI.getTeam(req.params.teamId);
      if (!team) {
        return res.status(404).json({ message: "Team not found" });
      }
      res.json(team);
    } catch (error) {
      console.error("ESPN team error:", error);
      res.status(500).json({ message: "Failed to fetch ESPN team" });
    }
  });

  app.get("/api/espn/games/:gameId", async (req, res) => {
    try {
      const gameSummary = await espnAPI.getGameSummary(req.params.gameId);
      res.json(gameSummary);
    } catch (error) {
      console.error("ESPN game summary error:", error);
      res.status(500).json({ message: "Failed to fetch game summary" });
    }
  });

  app.get("/api/espn/insights", async (req, res) => {
    try {
      const insights = await espnAPI.getFantasyInsights();
      res.json(insights);
    } catch (error) {
      console.error("ESPN insights error:", error);
      res.status(500).json({ message: "Failed to fetch fantasy insights" });
    }
  });

  app.get("/api/espn/playing-today/:team", async (req, res) => {
    try {
      const isPlaying = await espnAPI.isTeamPlayingToday(req.params.team);
      res.json({ team: req.params.team, playingToday: isPlaying });
    } catch (error) {
      console.error("ESPN playing today error:", error);
      res.status(500).json({ message: "Failed to check if team is playing" });
    }
  });

  // Data refresh endpoint to pull authentic NFL player data
  app.post('/api/data/refresh', async (req, res) => {
    try {
      console.log('🔄 Starting player data refresh from SportsDataIO...');
      
      const results = await dataRefreshService.refreshPlayerData();
      
      res.json({
        success: true,
        message: `Successfully refreshed ${results.updated} players`,
        details: {
          playersUpdated: results.updated,
          playersFiltered: results.filtered,
          totalPlayers: results.total
        }
      });
    } catch (error) {
      console.error('❌ Data refresh failed:', error);
      res.status(500).json({ 
        success: false,
        message: 'Failed to refresh player data',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Platform Sync Routes - Multi-platform fantasy data synchronization
  app.post('/api/sync/authenticate', async (req, res) => {
    try {
      const { platformSyncManager } = await import('./platformSync');
      const { platform, ...credentials } = req.body;
      
      const isAuthenticated = await platformSyncManager.authenticateUser({
        platform,
        ...credentials
      });
      
      res.json({ success: isAuthenticated, platform });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post('/api/sync/full/:platform', async (req, res) => {
    try {
      const { platformSyncManager } = await import('./platformSync');
      const { platform } = req.params;
      const { userId = 'default_user', ...credentials } = req.body;
      
      const syncData = await platformSyncManager.syncUserData(userId, {
        platform: platform as any,
        ...credentials
      });
      
      res.json(syncData);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get('/api/sync/status/:userId', async (req, res) => {
    try {
      const { platformSyncManager } = await import('./platformSync');
      const { userId } = req.params;
      
      const status = await platformSyncManager.getSyncStatus(userId);
      res.json(status);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // MySportsFeeds test endpoint for commercial data
  app.post('/api/sync/mysportsfeeds/test', async (req, res) => {
    try {
      const { MySportsFeedsAdapter } = await import('./platformSync/adapters/mysportsfeedsAdapter');
      const adapter = new MySportsFeedsAdapter();
      
      const { apiKey } = req.body;
      if (!apiKey) {
        return res.status(400).json({ message: 'MySportsFeeds API key required' });
      }

      const credentials = {
        platform: 'mysportsfeeds' as const,
        apiKey,
        leagueId: 'nfl-2024-regular'
      };

      console.log('🔄 Testing MySportsFeeds authentication...');
      
      // Test authentication
      const isAuthenticated = await adapter.authenticate(credentials);
      if (!isAuthenticated) {
        return res.status(401).json({ 
          success: false,
          message: 'MySportsFeeds authentication failed - check API key' 
        });
      }

      console.log('✅ MySportsFeeds authenticated, fetching sample data...');

      // Fetch sample data
      const [leagues, teams] = await Promise.all([
        adapter.fetchLeagues(credentials),
        adapter.fetchTeams(credentials).catch(() => []) // Teams endpoint might require higher tier
      ]);

      res.json({
        success: true,
        authenticated: isAuthenticated,
        message: 'MySportsFeeds connection successful',
        sampleData: {
          leagues: leagues.slice(0, 1),
          teams: teams.slice(0, 5),
          totalTeams: teams.length,
          pricing: {
            current: '$39 CAD/month (~$29 USD)',
            tier: 'Non-Live NFL Data',
            upgrades: 'Live data, projections, DFS salaries available'
          }
        }
      });
    } catch (error: any) {
      console.error('❌ MySportsFeeds test failed:', error);
      res.status(500).json({ 
        success: false, 
        message: error.message,
        error: error.toString(),
        help: 'Verify your MySportsFeeds API key and subscription status'
      });
    }
  });

  // League Comparison Routes - Real fantasy league analysis
  app.get('/api/league-comparison/:leagueId', async (req, res) => {
    try {
      const { leagueId } = req.params;
      const { platform = 'sleeper' } = req.query;
      
      const { leagueComparisonService } = await import('./leagueComparison');
      const comparison = await leagueComparisonService.getLeagueComparison(
        leagueId, 
        platform as string
      );
      
      res.json(comparison);
    } catch (error: any) {
      console.error('❌ League comparison failed:', error);
      res.status(500).json({ 
        message: error.message || 'Failed to fetch league comparison',
        error: error.toString()
      });
    }
  });

  app.post('/api/league-comparison/test', async (req, res) => {
    try {
      const { leagueId, platform = 'sleeper' } = req.body;
      
      if (!leagueId) {
        return res.status(400).json({ message: 'League ID required' });
      }

      console.log(`🔄 Testing league comparison for ${leagueId} on ${platform}...`);
      
      const { leagueComparisonService } = await import('./leagueComparison');
      const comparison = await leagueComparisonService.getLeagueComparison(leagueId, platform);
      
      res.json({
        success: true,
        message: `Successfully analyzed ${comparison.teams.length} teams`,
        data: {
          leagueName: comparison.leagueName,
          teamCount: comparison.teams.length,
          topTeam: comparison.teams[0],
          leagueAverages: comparison.leagueAverages,
          settings: comparison.leagueSettings
        }
      });
    } catch (error: any) {
      console.error('❌ League comparison test failed:', error);
      res.status(500).json({ 
        success: false,
        message: error.message || 'Failed to test league comparison',
        error: error.toString()
      });
    }
  });

  // Get MySportsFeeds pricing and setup info
  app.get('/api/sync/mysportsfeeds/info', async (req, res) => {
    res.json({
      provider: 'MySportsFeeds',
      commercial: true,
      pricing: {
        nfl: {
          nonLive: '$39 CAD/month (~$29 USD)',
          live10min: '$109 CAD/month (~$82 USD)',
          live5min: '$309 CAD/month (~$232 USD)'
        },
        addons: {
          stats: '$29 CAD/month',
          projections: '$29 CAD/month', 
          dfs: '$29 CAD/month',
          odds: '$29 CAD/month'
        }
      },
      features: [
        'Commercial use allowed',
        'Authentic NFL player statistics',
        'Fantasy point calculations',
        'Weekly and season data',
        'Canadian pricing (20-30% discount)',
        '3-day free trial available'
      ],
      setup: {
        website: 'https://www.mysportsfeeds.com',
        documentation: 'https://www.mysportsfeeds.com/data-feeds/api-docs/',
        support: 'Account required for API access'
      }
    });
  });

  // Player Value Score endpoints
  app.get('/api/player-value-score/:playerId', async (req, res) => {
    try {
      const { playerId } = req.params;
      const { scoring = 'ppr', positions = 'QB,RB,WR,TE' } = req.query;
      
      const leagueSettings = {
        scoring: scoring as 'standard' | 'ppr' | 'half-ppr',
        positions: (positions as string).split(',')
      };

      const { playerValueScoreEngine } = await import('./playerValueScore');
      const pvsData = await playerValueScoreEngine.calculatePlayerValueScore(
        parseInt(playerId),
        leagueSettings
      );
      
      res.json(pvsData);
    } catch (error) {
      console.error('PVS calculation error:', error);
      res.status(500).json({ 
        message: 'Failed to calculate Player Value Score',
        error: error.message 
      });
    }
  });

  // Batch PVS calculation for multiple players
  app.post('/api/player-value-score/batch', async (req, res) => {
    try {
      const { playerIds, scoring = 'ppr', positions = ['QB', 'RB', 'WR', 'TE'] } = req.body;
      
      if (!Array.isArray(playerIds)) {
        return res.status(400).json({ message: 'playerIds must be an array' });
      }

      const leagueSettings = {
        scoring: scoring as 'standard' | 'ppr' | 'half-ppr',
        positions
      };

      const { playerValueScoreEngine } = await import('./playerValueScore');
      const pvsResults = await playerValueScoreEngine.calculateBatchPlayerValueScores(
        playerIds,
        leagueSettings
      );
      
      res.json(pvsResults);
    } catch (error) {
      console.error('Batch PVS calculation error:', error);
      res.status(500).json({ 
        message: 'Failed to calculate batch Player Value Scores',
        error: error.message 
      });
    }
  });

  // Top players by position with PVS
  app.get('/api/rankings/:position', async (req, res) => {
    try {
      const { position } = req.params;
      const { limit = '50', scoring = 'ppr', positions = 'QB,RB,WR,TE' } = req.query;
      
      const leagueSettings = {
        scoring: scoring as 'standard' | 'ppr' | 'half-ppr',
        positions: (positions as string).split(',')
      };

      const { playerValueScoreEngine } = await import('./playerValueScore');
      const topPlayers = await playerValueScoreEngine.getTopPlayersByPosition(
        position.toUpperCase(),
        parseInt(limit as string),
        leagueSettings
      );
      
      res.json(topPlayers);
    } catch (error) {
      console.error('Position rankings error:', error);
      res.status(500).json({ 
        message: 'Failed to fetch position rankings',
        error: error.message 
      });
    }
  });

  // League comparison endpoint with PVS integration
  app.get('/api/league-comparison/:leagueId', async (req, res) => {
    try {
      const { leagueId } = req.params;
      const { platform = 'sleeper' } = req.query;
      
      const { leagueComparisonService } = await import('./leagueComparison');
      const leagueData = await leagueComparisonService.getLeagueComparison(
        leagueId, 
        platform as string
      );
      
      res.json(leagueData);
    } catch (error) {
      console.error('League comparison error:', error);
      res.status(500).json({ 
        message: 'Failed to fetch league comparison data',
        error: error.message 
      });
    }
  });

  // Player Search with Autocomplete
  app.get('/api/players/search', async (req, res) => {
    try {
      const { q, limit = 10 } = req.query;
      
      if (!q || typeof q !== 'string' || q.length < 2) {
        return res.json([]);
      }
      
      const players = await storage.searchPlayers(q.toLowerCase(), parseInt(limit as string));
      
      res.json(players.map(player => ({
        id: player.id,
        name: player.name,
        position: player.position,
        team: player.team,
        avgPoints: player.avgPoints,
        imageUrl: player.imageUrl
      })));
    } catch (error) {
      console.error('Player search error:', error);
      res.status(500).json({ message: 'Search failed' });
    }
  });

  // Player Tier Information
  app.get('/api/players/:id/tier', async (req, res) => {
    try {
      const { id } = req.params;
      const player = await storage.getPlayer(parseInt(id));
      
      if (!player) {
        return res.status(404).json({ message: 'Player not found' });
      }
      
      const { getPlayerTier } = await import('./playerTiers');
      const tierInfo = getPlayerTier(player.name);
      
      res.json({
        player: {
          id: player.id,
          name: player.name,
          position: player.position,
          team: player.team
        },
        tier: tierInfo || {
          tier: 'Unranked',
          tierDescription: 'Not in dynasty tier system',
          dynastyScore: 0,
          strengths: [],
          concerns: ['Not evaluated for dynasty value']
        }
      });
    } catch (error) {
      console.error('Player tier error:', error);
      res.status(500).json({ message: 'Failed to get tier info' });
    }
  });

  // Get Players by Tier
  app.get('/api/tiers/:tier', async (req, res) => {
    try {
      const { tier } = req.params;
      const { getPlayersByTier } = await import('./playerTiers');
      const players = getPlayersByTier(tier);
      
      res.json(players);
    } catch (error) {
      console.error('Tier players error:', error);
      res.status(500).json({ message: 'Failed to get tier players' });
    }
  });

  // Comprehensive Data Sync endpoints
  app.post('/api/data/sync-comprehensive', async (req, res) => {
    try {
      console.log('🚀 Starting comprehensive NFL data sync...');
      
      const { comprehensiveDataSync } = await import('./comprehensiveDataSync');
      const results = await comprehensiveDataSync.syncAllPlayerData();
      
      res.json({
        success: true,
        message: `Comprehensive sync completed: ${results.created} created, ${results.updated} updated`,
        results
      });
    } catch (error) {
      console.error('❌ Comprehensive sync failed:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Comprehensive data sync failed',
        error: error.message 
      });
    }
  });

  app.post('/api/data/sync-incremental', async (req, res) => {
    try {
      console.log('🔄 Starting incremental data sync...');
      
      const { comprehensiveDataSync } = await import('./comprehensiveDataSync');
      const results = await comprehensiveDataSync.incrementalSync();
      
      res.json({
        success: true,
        message: `Incremental sync completed: ${results.updated} updates`,
        results
      });
    } catch (error) {
      console.error('❌ Incremental sync failed:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Incremental data sync failed',
        error: error.message 
      });
    }
  });

  app.get('/api/data/sync-status', async (req, res) => {
    try {
      const { comprehensiveDataSync } = await import('./comprehensiveDataSync');
      const status = await comprehensiveDataSync.getSyncStatus();
      
      res.json({
        status: 'ready',
        database: status,
        apis: {
          sportsDataIO: {
            enabled: !!process.env.SPORTSDATA_API_KEY,
            description: 'Official NFL statistics and player data'
          },
          espnAPI: {
            enabled: true,
            description: 'Real-time injury reports and game data'
          },
          playerValueScore: {
            enabled: true,
            description: 'Comprehensive dynasty player valuations'
          }
        },
        recommendations: {
          nextSync: 'Run comprehensive sync to populate database with authentic NFL data',
          dataQuality: status.playersWithPVS > 0 ? 'Good' : 'Initial setup required'
        }
      });
    } catch (error) {
      console.error('❌ Sync status error:', error);
      res.status(500).json({ 
        message: 'Failed to fetch sync status',
        error: error.message 
      });
    }
  });

  // 6-Tier Dynasty System endpoints
  app.post('/api/admin/populate-tiers', async (req, res) => {
    try {
      const { populatePlayerTiers } = await import('./populateTiers');
      const result = await populatePlayerTiers();
      res.json({
        message: '6-tier dynasty classification complete',
        ...result
      });
    } catch (error) {
      console.error('❌ Tier population error:', error);
      res.status(500).json({ 
        message: 'Failed to populate player tiers',
        error: error.message 
      });
    }
  });

  app.get('/api/tiers/statistics', async (req, res) => {
    try {
      const { getTierStatistics } = await import('./populateTiers');
      const stats = await getTierStatistics();
      res.json(stats);
    } catch (error) {
      console.error('❌ Tier statistics error:', error);
      res.status(500).json({ 
        message: 'Failed to get tier statistics',
        error: error.message 
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
