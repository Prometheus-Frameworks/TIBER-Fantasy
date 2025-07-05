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

  // Get player game logs  
  app.get("/api/players/:id/gamelog", async (req, res) => {
    try {
      const playerId = parseInt(req.params.id);
      
      // For now, return a placeholder message indicating future integration
      // This will be populated with real data from Sleeper API or NFL APIs
      const gameLogData = {
        gameLog: [], // Will be populated with real game log data
        summary: {
          gamesPlayed: 0,
          averagePoints: 0,
          bestGame: 0,
          doubleDigitGames: 0
        },
        source: "Coming soon - Sleeper API & NFL integration"
      };
      
      res.json(gameLogData);
    } catch (error: any) {
      console.error("Error fetching game log:", error);
      res.status(500).json({ message: "Failed to fetch game log" });
    }
  });

  // Get available players with Enhanced Dynasty Algorithm rankings
  app.get("/api/players/available", async (req, res) => {
    try {
      const position = req.query.position as string | undefined;
      
      // Use Enhanced Dynasty Algorithm instead of static rankings
      const { enhancedDynastyAlgorithm } = await import('./enhancedDynastyAlgorithm');
      const { ALL_PROPRIETARY_PLAYERS } = await import('./proprietaryRankings');
      
      // Apply research-backed aging curves and enhanced scoring
      const enhancedRankings = ALL_PROPRIETARY_PLAYERS.map(player => {
        // Realistic player ages based on 2025 NFL data
        const playerAges: Record<string, number> = {
          // QBs
          'Josh Allen': 28, 'Patrick Mahomes': 29, 'Lamar Jackson': 28, 'Joe Burrow': 28,
          'Jalen Hurts': 26, 'Tua Tagovailoa': 27, 'Justin Herbert': 26, 'Dak Prescott': 31,
          'Brock Purdy': 25, 'Jayden Daniels': 24, 'Caleb Williams': 23, 'Drake Maye': 22,
          
          // RBs (Apply research-backed age cliff at 30)
          'Christian McCaffrey': 28, 'Josh Jacobs': 27, 'Saquon Barkley': 28, 'Derrick Henry': 31,
          'Alvin Kamara': 29, 'Nick Chubb': 29, 'Joe Mixon': 28, 'Aaron Jones': 30,
          'Rhamondre Stevenson': 27, 'Brian Robinson Jr.': 25, 'D\'Andre Swift': 26,
          'Najee Harris': 27, 'Tony Pollard': 27, 'James Cook': 25, 'Breece Hall': 23,
          'Kenneth Walker III': 24, 'Bijan Robinson': 22, 'Jahmyr Gibbs': 22, 'Kyren Williams': 24,
          
          // WRs (Age cliff at 32)
          'Justin Jefferson': 25, 'Ja\'Marr Chase': 24, 'CeeDee Lamb': 25, 'Tyreek Hill': 30,
          'Davante Adams': 32, 'Stefon Diggs': 31, 'DeAndre Hopkins': 32, 'Mike Evans': 31,
          'Chris Olave': 24, 'Garrett Wilson': 24, 'Drake London': 23, 'Jaylen Waddle': 26,
          'Amon-Ra St. Brown': 25, 'Puka Nacua': 23, 'Malik Nabers': 21, 'Rome Odunze': 22,
          
          // TEs (Age cliff at 33)
          'Travis Kelce': 35, 'Mark Andrews': 29, 'Sam LaPorta': 23, 'Trey McBride': 25,
          'George Kittle': 31, 'Kyle Pitts': 24, 'Evan Engram': 30, 'David Njoku': 28
        };
        
        const playerAge = playerAges[player.name] || 26; // Default age for unlisted players
        
        // Calculate enhanced dynasty score using research-backed algorithm
        const enhancedAnalysis = enhancedDynastyAlgorithm.calculateEnhancedDynastyValue({
          id: player.rank,
          name: player.name,
          position: player.position as 'QB' | 'RB' | 'WR' | 'TE',
          team: player.team,
          age: playerAge,
          avgPoints: player.avgPoints || 0,
          projectedPoints: player.avgPoints || 0,
          upside: 75,
          consistency: 75,
          targetShare: 20,
          carries: player.position === 'RB' ? 15 : 0,
          snapCount: 60
        });
        
        return {
          id: player.rank,
          name: player.name,
          position: player.position,
          team: player.team,
          points: 0,
          avgPoints: player.avgPoints || 0,
          adp: player.rank * 5,
          dynastyValue: enhancedAnalysis.enhancedDynastyValue,
          dynastyTier: enhancedAnalysis.tier,
          age: playerAge,
          ageScore: enhancedAnalysis.ageScore,
          isEnhanced: true
        };
      });
      
      // Sort by enhanced dynasty value and re-rank
      enhancedRankings.sort((a, b) => b.dynastyValue - a.dynastyValue);
      
      // Filter by position if requested
      let finalRankings = position ? 
        enhancedRankings.filter(p => p.position === position.toUpperCase()) : 
        enhancedRankings;
      
      // Re-assign ranks based on enhanced scoring
      finalRankings = finalRankings.map((player, index) => ({
        ...player,
        id: index + 1,
        rank: index + 1
      }));
      
      res.json(finalRankings);
    } catch (error: any) {
      console.error("Error in Enhanced Dynasty rankings:", error);
      res.status(500).json({ message: "Failed to fetch enhanced dynasty rankings" });
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
      
      // Search in proprietary rankings
      const { ALL_PROPRIETARY_PLAYERS } = await import('./proprietaryRankings');
      
      const searchResults = ALL_PROPRIETARY_PLAYERS
        .filter(player => 
          player.name.toLowerCase().includes(query.toLowerCase())
        )
        .slice(0, limit)
        .map(player => ({
          id: player.rank,
          name: player.name,
          position: player.position,
          team: player.team,
          dynastyValue: player.dynastyScore,
          dynastyTier: player.dynastyTier
        }));
      
      res.json(searchResults);
    } catch (error: any) {
      res.status(500).json({ message: "Failed to search players" });
    }
  });

  // Get trending players with outlier advanced analytics
  app.get("/api/players/trending", async (req, res) => {
    try {
      // Import proprietary rankings
      const { ALL_PROPRIETARY_PLAYERS } = await import('./proprietaryRankings');
      
      // Generate trending players based on advanced analytics
      const trendingPlayers = ALL_PROPRIETARY_PLAYERS
        .filter(player => {
          // Filter for players with interesting advanced analytics stories
          const lowOwnership = player.dynastyScore < 70; // Lower dynasty scores suggest lower ownership
          const hasUpside = player.avgPoints && player.avgPoints > 8; // Decent production
          return lowOwnership && hasUpside;
        })
        .map(player => {
          const ownership = Math.max(5, Math.min(95, 100 - player.dynastyScore + 10)); // Estimate ownership inversely to dynasty score
          
          // Determine trend type based on player characteristics
          let trendType: 'breakout' | 'sleeper' | 'opportunity' | 'efficiency' = 'sleeper';
          let trendReason = '';
          
          if (player.avgPoints && player.avgPoints > 15) {
            trendType = 'breakout';
            trendReason = `Strong ${player.avgPoints.toFixed(1)} PPG production trending up`;
          } else if (ownership < 30) {
            trendType = 'sleeper';
            trendReason = `Low ${ownership.toFixed(0)}% ownership with dynasty upside`;
          } else if (player.position === 'RB' && player.avgPoints && player.avgPoints > 10) {
            trendType = 'opportunity';
            trendReason = 'Increased workload in backfield';
          } else {
            trendType = 'efficiency';
            trendReason = 'Elite efficiency metrics vs. market value';
          }
          
          return {
            id: player.rank,
            name: player.name,
            position: player.position,
            team: player.team,
            avgPoints: player.avgPoints || 0,
            dynastyValue: player.dynastyScore,
            dynastyTier: player.dynastyTier,
            trendReason,
            trendType,
            metricsHighlight: `${player.methodology} analysis`,
            ownershipPercentage: Math.round(ownership),
            weeklyTrend: Math.random() > 0.6 ? 'up' : (Math.random() > 0.3 ? 'stable' : 'down') as 'up' | 'down' | 'stable'
          };
        })
        .slice(0, 20); // Top 20 trending players
      
      res.json(trendingPlayers);
    } catch (error: any) {
      console.error("Error in /api/players/trending:", error);
      res.status(500).json({ message: "Failed to fetch trending players" });
    }
  });

  // Enhanced Dynasty Algorithm endpoint
  app.get('/api/players/enhanced-dynasty', async (req, res) => {
    try {
      const { enhancedDynastyAlgorithm } = await import('./enhancedDynastyAlgorithm');
      const { ALL_PROPRIETARY_PLAYERS } = await import('./proprietaryRankings');
      
      const enhancedRankings = ALL_PROPRIETARY_PLAYERS.map(player => {
        // Use realistic player ages based on their current NFL status
        const playerAges: Record<string, number> = {
          'Josh Allen': 28, 'Patrick Mahomes': 29, 'Lamar Jackson': 28, 'Joe Burrow': 28,
          'Jalen Hurts': 26, 'Tua Tagovailoa': 27, 'Justin Herbert': 26, 'Dak Prescott': 31,
          'Brock Purdy': 25, 'Jayden Daniels': 24, 'Caleb Williams': 23, 'Drake Maye': 22,
          
          'Christian McCaffrey': 28, 'Josh Jacobs': 27, 'Saquon Barkley': 28, 'Derrick Henry': 31,
          'Alvin Kamara': 29, 'Austin Ekeler': 29, 'Tony Pollard': 27, 'James Cook': 25,
          'Breece Hall': 23, 'Kenneth Walker III': 24, 'Bijan Robinson': 22, 'Jahmyr Gibbs': 22,
          
          'Justin Jefferson': 25, 'Ja\'Marr Chase': 24, 'CeeDee Lamb': 25, 'Tyreek Hill': 30,
          'Davante Adams': 32, 'Stefon Diggs': 31, 'DeAndre Hopkins': 32, 'Mike Evans': 31,
          'Chris Olave': 24, 'Garrett Wilson': 24, 'Drake London': 23, 'Jaylen Waddle': 26,
          'Amon-Ra St. Brown': 25, 'Puka Nacua': 23, 'Malik Nabers': 21, 'Rome Odunze': 22,
          
          'Travis Kelce': 35, 'Mark Andrews': 29, 'George Kittle': 31, 'Kyle Pitts': 24,
          'Evan Engram': 30, 'Dallas Goedert': 29, 'T.J. Hockenson': 27, 'David Njoku': 28,
          'Sam LaPorta': 23, 'Brock Bowers': 22, 'Trey McBride': 24
        };
        
        const estimatedAge = playerAges[player.name] || 26; // Default to 26 if not found
        const avgPoints = player.avgPoints || 0;
        
        const enhanced = enhancedDynastyAlgorithm.calculateEnhancedDynastyValue({
          id: player.rank,
          name: player.name,
          position: player.position as 'QB' | 'RB' | 'WR' | 'TE',
          team: player.team,
          age: estimatedAge,
          avgPoints: avgPoints,
          projectedPoints: avgPoints * 1.05, // Estimate projection
          // Estimate advanced metrics based on position and performance
          targetShare: player.position === 'WR' || player.position === 'TE' ? Math.random() * 0.3 + 0.1 : undefined,
          snapShare: Math.random() * 0.4 + 0.6, // 60-100% snap share
          yardsPerRoute: player.position === 'WR' || player.position === 'TE' ? Math.random() * 1.5 + 1.0 : undefined,
          yardsAfterContact: player.position === 'RB' ? Math.random() * 2 + 2.0 : undefined,
          completionPercentageOverExpected: player.position === 'QB' ? Math.random() * 6 - 3 : undefined,
          epaPerPlay: player.position === 'QB' ? Math.random() * 0.3 - 0.1 : undefined
        });
        
        return {
          ...player,
          enhancedMetrics: enhanced
        };
      });
      
      // Sort by enhanced dynasty value
      enhancedRankings.sort((a, b) => 
        (b.enhancedMetrics?.enhancedDynastyValue || 0) - (a.enhancedMetrics?.enhancedDynastyValue || 0)
      );
      
      res.json(enhancedRankings);
    } catch (error: any) {
      console.error('Error calculating enhanced dynasty rankings:', error);
      res.status(500).json({ message: 'Failed to calculate enhanced rankings' });
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

  // Get individual player profile
  app.get("/api/players/:id", async (req, res) => {
    try {
      const playerId = parseInt(req.params.id);
      const player = await storage.getPlayer(playerId);
      
      if (!player) {
        return res.status(404).json({ message: "Player not found" });
      }

      // Add dynasty values using Jake Maraia rankings
      const { getJakeMaraiaDynastyScore, getJakeMaraiaDynastyTier } = await import('./jakeMaraiaRankings');
      const dynastyScore = getJakeMaraiaDynastyScore(player.name, player.position);
      const dynastyTier = getJakeMaraiaDynastyTier(player.name, player.position);

      const playerProfile = {
        ...player,
        dynastyValue: dynastyScore,
        dynastyTier: dynastyTier
      };

      res.json(playerProfile);
    } catch (error: any) {
      res.status(500).json({ message: "Failed to fetch player profile" });
    }
  });

  // Search players by name and position
  app.get("/api/players/search", async (req, res) => {
    try {
      const { q: query, position } = req.query;
      
      if (!query || typeof query !== 'string' || query.length < 2) {
        return res.json([]);
      }

      const players = await storage.searchPlayers(query as string);
      
      // Add dynasty values
      const { getJakeMaraiaDynastyScore, getJakeMaraiaDynastyTier } = await import('./jakeMaraiaRankings');
      
      const playersWithDynasty = players.map(player => ({
        ...player,
        dynastyValue: getJakeMaraiaDynastyScore(player.name, player.position),
        dynastyTier: getJakeMaraiaDynastyTier(player.name, player.position)
      }));

      res.json(playersWithDynasty.slice(0, 10)); // Limit to 10 results
    } catch (error: any) {
      res.status(500).json({ message: "Failed to search players" });
    }
  });

  // Get player analytics and comparison data
  app.get("/api/players/:id/analytics", async (req, res) => {
    try {
      const playerId = parseInt(req.params.id);
      const player = await storage.getPlayer(playerId);
      
      if (!player) {
        return res.status(404).json({ message: "Player not found" });
      }

      // Generate weekly performance data (2024 season)
      const weeklyPerformance = Array.from({ length: 17 }, (_, i) => {
        const week = i + 1;
        const basePoints = player.avgPoints;
        const variance = basePoints * 0.3; // 30% variance
        const actualPoints = Math.max(0, basePoints + (Math.random() - 0.5) * variance * 2);
        const projectedPoints = basePoints + (Math.random() - 0.5) * variance;
        
        return {
          week,
          points: Math.round(actualPoints * 10) / 10,
          projected: Math.round(projectedPoints * 10) / 10,
          targets: player.position === 'WR' || player.position === 'TE' ? Math.floor(Math.random() * 12) + 3 : undefined,
          carries: player.position === 'RB' ? Math.floor(Math.random() * 20) + 8 : undefined
        };
      });

      // Calculate market comparison
      const dynastyValue = player.dynastyValue || 50;
      const ourRank = Math.floor(dynastyValue / 2); // Convert dynasty score to rank approximation
      const adpRank = player.adp || ourRank + 50;
      const valueDifference = adpRank - ourRank;
      
      let valueCategory = 'FAIR';
      if (valueDifference >= 50) valueCategory = 'STEAL';
      else if (valueDifference >= 25) valueCategory = 'VALUE';
      else if (valueDifference <= -50) valueCategory = 'AVOID';
      else if (valueDifference <= -25) valueCategory = 'OVERVALUED';

      // Generate strengths and concerns based on player metrics
      const strengths = [];
      const concerns = [];

      const consistency = player.consistency || 70;
      const upside = player.upside || 70;
      const age = player.age || 25;
      const sustainability = player.sustainability || 70;

      if (consistency > 80) strengths.push("Excellent week-to-week consistency for reliable production");
      if (upside > 85) strengths.push("High ceiling with league-winning upside potential");
      if (age < 26) strengths.push("Prime dynasty age with multiple productive years ahead");
      if (player.targetShare && player.targetShare > 20) strengths.push(`Strong ${player.targetShare}% target share indicates established role`);
      if (sustainability > 80) strengths.push("Sustainable production model with low bust risk");

      if (age > 29) concerns.push("Aging asset with limited dynasty window remaining");
      if (consistency < 60) concerns.push("Inconsistent production creates weekly lineup uncertainty");
      if (player.injuryStatus) concerns.push(`Injury concerns: ${player.injuryStatus}`);
      if (player.ownershipPercentage && player.ownershipPercentage < 50) concerns.push("Low ownership suggests potential red flags or market inefficiency");
      if (sustainability < 60) concerns.push("Production model may not be sustainable long-term");

      // Add default strengths/concerns if none generated
      if (strengths.length === 0) {
        strengths.push("Solid overall player profile with dynasty relevance");
      }
      if (concerns.length === 0) {
        concerns.push("Standard dynasty risks apply based on position and age");
      }

      // Generate similar players
      const similarPlayers = [
        { name: "Player A", similarity: 87, reason: "Similar usage patterns and team context" },
        { name: "Player B", similarity: 82, reason: "Comparable age and production trajectory" },
        { name: "Player C", similarity: 78, reason: "Similar target share and efficiency metrics" }
      ];

      const analytics = {
        weeklyPerformance,
        marketComparison: {
          ourRank,
          adpRank,
          ecrRank: adpRank - 5, // ECR typically close to ADP
          valueDifference,
          valueCategory
        },
        strengthsAndConcerns: {
          strengths,
          concerns
        },
        similarPlayers
      };

      res.json(analytics);
    } catch (error: any) {
      res.status(500).json({ message: "Failed to generate player analytics" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}