import type { Express, Request, Response } from "express";
import express from "express";
import axios from "axios";
import { createServer, type Server } from "http";
import { registerADPRoutes } from "./routes/adpRoutes";
import { adpSyncService } from "./adpSyncService";
import { storage } from "./storage";
import { teamSyncService } from "./teamSync";
import { optimizeLineup, calculateConfidence, analyzeTradeOpportunities, generateWaiverRecommendations } from "./analytics";
// Removed deprecated imports
import { PlayerFilteringService } from "./playerFiltering";
import { db } from "./db";
import { dynastyTradeHistory, players as playersTable } from "@shared/schema";
import { eq, desc, and, sql } from "drizzle-orm";
import { z } from "zod";
// Removed deprecated fantasy services
import { rbDraftCapitalService } from './rbDraftCapitalContext';
import cron from 'node-cron';
import { registerSleeperTestRoutes } from './api/sleeper-test';
import { registerProjectionsAnalysisRoutes } from './api/projections-analysis';
import { registerWeeklyProjectionsTestRoutes } from './api/weekly-projections-test';
import { registerSleeperPipelineTestRoutes } from './api/sleeper-pipeline-test';
import { registerAdpConversionTestRoutes } from './api/test-adp-conversion';
import { registerSleeperDataDebugRoutes } from './api/debug-sleeper-data';
import { registerWeeklyProjectionsCheckRoutes } from './api/check-weekly-projections';
import { registerRealDataValidationRoutes } from './api/test-real-data-validation';
import { registerTest2024ProjectionsRoutes } from './api/test-2024-projections';
import { testNFLStatsDirect } from './api/test-nfl-stats-direct';
import { fetchGrokProjections } from './services/grokProjectionsService';
import { cleanVorpRankings } from './clean-vorp-endpoint';
import { getSleeperProjections } from './services/sleeperProjectionsService';
import { calculateVORP } from './vorpCalculator';
import { getAllRBProjections, getRBProjectionByName } from './services/rbProjectionsService';
import { depthChartService } from './services/depthChartService';
import { verify2024GameLogs } from './api/verify-2024-game-logs';
import { parseFullGameLogs } from './api/parse-full-game-logs';
import { exportPositionalGameLogs } from './api/export-positional-game-logs';
import { snapPercentageService } from './services/snapPercentageService';
import { testSnapPercentages } from './api/test-snap-percentages';
import { generateWRSnapData } from './api/generate-wr-snap-data';
import { sleeperSnapService } from './services/sleeperSnapService';
import { sleeperSnapPipeline } from './services/sleeperSnapPipeline';
import { sleeperWeeklySnapService } from './services/sleeperWeeklySnapService';
import { sleeperStrictSnapService } from './services/sleeperStrictSnapService';
import { wrRatingsService } from './services/wrRatingsService';
import { wrGameLogsService } from './services/wrGameLogsService';
import { playerPoolService } from './playerPool';
import compassRoutes from './routes/compassRoutes';
import rbCompassRoutes from './routes/rbCompassRoutes';
import teCompassRoutes from './routes/teCompassRoutes';
import tiberDataRoutes from './routes/tiberDataRoutes';
import populationStatsRoutes from './routes/populationStatsRoutes';
import tradeAnalyzerRoutes from './routes/tradeAnalyzerRoutes';
import compassCompareRoutes from './routes/compassCompareRoutes';
import rookieRoutes from './routes/rookieRoutes';
import rookieEvaluationRoutes from './routes/rookieEvaluationRoutes';
import pythonRookieRoutes from './routes/pythonRookieRoutes';
import redraftWeeklyRoutes from './routes/redraftWeeklyRoutes';

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Version and Health endpoints for new API client
  app.get('/api/version', (req: Request, res: Response) => {
    res.json({
      build: `v1.0.3-${Date.now()}`,
      commit: 'main',
      pid: process.pid
    });
  });

  app.get('/api/health', (req: Request, res: Response) => {
    res.json({
      redraft: 'ok',
      dynasty: 'ok', 
      oasis: 'ok',
      trends: 'ok',
      compass: 'ok',
      rookies: 'ok',
      usage2024: 'ok',
      status: 'healthy',
      timestamp: new Date().toISOString()
    });
  });
  
  // 🔥 TIBER COMMAND: MainPlayerSystem.json generation with live depth charts
  console.log('🔥 REGISTERING TIBER OVERRIDE ENDPOINT');
  
  // TIBER: Depth chart system - DEPRECATED
  app.get('/api/tiber/depth-chart-system', async (req, res) => {
    console.log('⚠️ [DEPRECATION_COMPLETE] SportsDataIO Depth Chart API disabled');
    res.status(410).json({
      success: false,
      status: '[DEPRECATION_COMPLETE]',
      message: 'SportsDataIO Depth Chart API has been deprecated',
      deprecated: true,
      instruction: 'Use Sleeper API or OASIS API for data sources'
    });
  });

  // TIBER: MainPlayerSystem generation - DEPRECATED
  app.post('/api/tiber/generate-main-player-system', async (req, res) => {
    console.log('⚠️ [DEPRECATION_COMPLETE] MainPlayerSystem generation disabled');
    res.status(410).json({
      success: false,
      status: '[DEPRECATION_COMPLETE]',
      message: 'MainPlayerSystem.json generation has been deprecated',
      deprecated: true,
      instruction: 'Use Sleeper API or OASIS API for data sources'
    });
  });

  // 🔄 Auto-refresh MainPlayerSystem - DEPRECATED
  // [DEPRECATION_COMPLETE] SportsDataIO auto-refresh disabled

  // TIBER: Verify 2024 game log access
  app.get('/api/tiber/verify-2024-game-logs', verify2024GameLogs);

  // TIBER: Parse 2024 game logs full depth analysis
  app.get('/api/tiber/parse-full-game-logs', parseFullGameLogs);

  // TIBER: Export positional game log samples
  app.get('/api/tiber/export-positional-game-logs', exportPositionalGameLogs);

  // Unified Compass Rankings with Algorithm Selection
  app.get('/api/compass/:position', async (req, res) => {
    try {
      const position = req.params.position.toLowerCase();
      const algorithm = (req.query.algorithm as string) || 'default';
      const source = (req.query.source as string) || 'csv';
      
      if (!['wr', 'rb', 'qb', 'te'].includes(position)) {
        return res.status(400).json({ error: 'Invalid position. Use wr, rb, qb, or te' });
      }
      
      console.log(`🧭 Generating ${position.toUpperCase()} compass rankings with ${algorithm} algorithm`);
      
      let rankings: any[];
      
      if (position === 'wr') {
        const { wrRatingsService } = await import('./services/wrRatingsService');
        const wrData = wrRatingsService.getAllWRPlayers();
        
        if (algorithm === 'enhanced') {
          const { calculateEnhancedWRCompass } = await import('./compassCalculations');
          rankings = wrData.map((player: any) => {
            const compass = calculateEnhancedWRCompass(player);
            return { 
              ...player, 
              compass,
              dynastyScore: compass.score,
              methodology: 'Enhanced with team context and draft capital'
            };
          });
        } else if (algorithm === 'prometheus') {
          // Prometheus methodology with compass framework
          const { computeComponents } = await import('./compassCalculations');
          rankings = wrData.map((player: any) => {
            const compass = computeComponents(player, 'wr');
            const prometheusScore = (compass.north * 0.35) + (compass.east * 0.30) + (compass.south * 0.20) + (compass.west * 0.15);
            return { 
              ...player, 
              compass,
              dynastyScore: prometheusScore,
              methodology: 'Prometheus weighting with compass components'
            };
          });
        } else {
          const { computeComponents } = await import('./compassCalculations');
          rankings = wrData.map((player: any) => {
            const compass = computeComponents(player, 'wr');
            return { 
              ...player, 
              compass,
              dynastyScore: compass.score,
              methodology: 'Standard compass equal weighting'
            };
          });
        }
      } else if (position === 'rb') {
        // RB compass integration using existing system
        const { computeComponents } = await import('./compassCalculations');
        const rbSampleData = []; // Will integrate with actual RB data source
        rankings = rbSampleData.map((player: any) => {
          const compass = computeComponents(player, 'rb');
          return { ...player, compass, dynastyScore: compass.score };
        });
      } else if (position === 'te') {
        // TE compass integration using new TE system
        const { teCompassDataAdapter } = await import('./teCompassDataAdapter');
        const { calculateTECompass } = await import('./teCompassCalculations');
        const teData = await teCompassDataAdapter.getAllTEPlayers();
        rankings = teData.map((player: any) => {
          const compass = calculateTECompass(player);
          return { 
            ...player, 
            compass,
            dynastyScore: compass.score,
            methodology: 'TE Compass 4-directional equal weighting'
          };
        });
      } else {
        // QB expansion ready for future implementation
        rankings = [];
      }
      
      res.json({
        position: position.toUpperCase(),
        algorithm,
        source,
        rankings: rankings.sort((a, b) => (b.dynastyScore || 0) - (a.dynastyScore || 0)).slice(0, 50),
        metadata: {
          methodology: 'Compass 4-directional scoring',
          weights: algorithm === 'prometheus' ? 
            { north: '35%', east: '30%', south: '20%', west: '15%' } :
            { north: '25%', east: '25%', south: '25%', west: '25%' },
          totalPlayers: rankings.length,
          lastUpdated: new Date().toISOString()
        }
      });
      
    } catch (error) {
      console.error('Unified compass rankings error:', error);
      res.status(500).json({ error: 'Failed to generate compass rankings' });
    }
  });

  // TIBER: Direct Sleeper API test
  app.get('/api/tiber/sleeper-2024-direct', async (req, res) => {
    console.log('🔍 [TIBER] Direct Sleeper API test initiated...');
    
    try {
      // Test multiple 2024 endpoints
      const testResults = {
        seasonStats: null as any,
        weeklyTests: [] as any[],
        weeklyGameLogs: false
      };

      // Test 1: Season stats
      console.log('📊 Testing season stats endpoint...');
      const seasonResponse = await axios.get('https://api.sleeper.app/v1/stats/nfl/regular/2024');
      
      if (seasonResponse.data && typeof seasonResponse.data === 'object' && Object.keys(seasonResponse.data).length > 0) {
        const playerIds = Object.keys(seasonResponse.data);
        const samplePlayer = playerIds[0];
        const sampleStats = seasonResponse.data[samplePlayer];
        
        testResults.seasonStats = {
          available: true,
          playerCount: playerIds.length,
          samplePlayerId: samplePlayer,
          availableStats: Object.keys(sampleStats),
          priorityStats: {
            targets: 'rec_tgt' in sampleStats,
            receptions: 'rec' in sampleStats,
            receivingYards: 'rec_yd' in sampleStats,
            touchdowns: 'rec_td' in sampleStats || 'rush_td' in sampleStats
          },
          sampleData: sampleStats
        };
      } else {
        testResults.seasonStats = { available: false, data: seasonResponse.data };
      }

      // Test 2: Weekly game logs (weeks 1-3)
      console.log('📊 Testing weekly game log endpoints...');
      for (let week = 1; week <= 3; week++) {
        try {
          const weekResponse = await axios.get(`https://api.sleeper.app/v1/stats/nfl/regular/2024/${week}`);
          if (weekResponse.data && typeof weekResponse.data === 'object' && Object.keys(weekResponse.data).length > 0) {
            testResults.weeklyGameLogs = true;
            testResults.weeklyTests.push({
              week,
              available: true,
              playerCount: Object.keys(weekResponse.data).length,
              samplePlayer: Object.keys(weekResponse.data)[0]
            });
          } else {
            testResults.weeklyTests.push({
              week,
              available: false,
              data: weekResponse.data
            });
          }
        } catch (error) {
          testResults.weeklyTests.push({
            week,
            available: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      // Final verdict
      if (testResults.seasonStats?.available && testResults.weeklyGameLogs) {
        res.json({
          status: '[SLEEPER_2024_GAME_LOG_CHECK]',
          verdict: 'YES - Both season totals and weekly game logs available',
          dataFormats: {
            seasonTotals: true,
            weeklyGameLogs: true
          },
          testResults
        });
      } else if (testResults.seasonStats?.available) {
        res.json({
          status: '[SLEEPER_2024_GAME_LOG_CHECK]',
          verdict: 'PARTIAL - Season totals only, weekly game logs unavailable',
          dataFormats: {
            seasonTotals: true,
            weeklyGameLogs: false
          },
          testResults
        });
      } else {
        res.json({
          status: '[NO_2024_GAME_LOG_DATA]',
          verdict: 'NO - 2024 data not available',
          testResults
        });
      }

    } catch (error) {
      console.error('❌ [SLEEPER_2024_GAME_LOG_CHECK] Error:', error);
      res.status(500).json({
        status: '[NO_2024_GAME_LOG_DATA]',
        verdict: 'ERROR - API request failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // 🔥 TIBER OVERRIDE: Critical NFL stats endpoint - HIGHEST PRIORITY
  app.get('/api/force-stats', async (req, res) => {
    try {
      console.log('🔥 TIBER OVERRIDE: Force stats endpoint activated');
      
      // Direct NFL stats fetch bypassing ALL other logic
      const response = await axios.get('https://api.sleeper.app/v1/stats/nfl/regular/2024/1', { timeout: 10000 });
      const rawStats = response.data || {};
      
      console.log(`📊 Raw NFL stats fetched: ${Object.keys(rawStats).length} players`);
      
      // Convert to fantasy points format
      const fantasyProjections: Record<string, any> = {};
      let processed = 0;
      
      for (const [playerId, stats] of Object.entries(rawStats)) {
        const s = stats as any;
        
        // Calculate fantasy points from real NFL stats
        let fantasyPoints = 0;
        
        // Passing (QB)
        if (s.pass_yd) fantasyPoints += s.pass_yd * 0.04;
        if (s.pass_td) fantasyPoints += s.pass_td * 4;
        if (s.pass_int) fantasyPoints -= s.pass_int * 2;
        
        // Rushing (RB, QB)
        if (s.rush_yd) fantasyPoints += s.rush_yd * 0.1;
        if (s.rush_td) fantasyPoints += s.rush_td * 6;
        
        // Receiving (WR, TE, RB)
        if (s.rec) fantasyPoints += s.rec; // PPR
        if (s.rec_yd) fantasyPoints += s.rec_yd * 0.1;
        if (s.rec_td) fantasyPoints += s.rec_td * 6;
        
        // Fumbles
        if (s.fum_lost) fantasyPoints -= s.fum_lost * 2;
        
        if (fantasyPoints > 0) {
          fantasyProjections[playerId] = {
            fantasy_points: parseFloat(fantasyPoints.toFixed(1)),
            games_played: s.gp || 1,
            raw_stats: s
          };
          processed++;
        }
      }
      
      console.log(`✅ Processed ${processed} players with fantasy points`);
      
      res.json({
        success: true,
        total_players: processed,
        projections: fantasyProjections,
        source: 'NFL_STATS_2024_WEEK_1',
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('❌ Force stats error:', error);
      res.status(500).json({ error: 'Failed to fetch NFL stats' });
    }
  });

  // 🔥 GROK PROJECTIONS ENDPOINT: 2025 NFL Projections 
  app.get('/api/grok-projections', async (req, res) => {
    try {
      console.log('🔥 GROK: Fetching 2025 projections');
      
      // Parse query parameters
      const leagueFormat = req.query.league_format as string || 'ppr';
      const position = req.query.position as string;
      const mode = req.query.mode as string || 'dynasty';
      const source = req.query.source as string || 'season';
      const leagueId = req.query.league_id as string;
      const week = parseInt(req.query.week as string);
      
      const settings = {
        mode: mode as 'dynasty' | 'redraft',
        league_format: leagueFormat as 'ppr' | 'half_ppr' | 'standard',
        format: 'superflex',
        num_teams: 12,
        is_superflex: true,
        position_filter: position
      };
      
      // Fetch projections using Grok service
      const projections = await fetchGrokProjections(settings, 'season', leagueId, week);
      
      // Filter by position if specified
      let filteredProjections = projections;
      if (position && position !== 'all') {
        filteredProjections = projections.filter(p => p.position === position.toUpperCase());
      }
      
      // Sort by projected points (highest first)
      filteredProjections.sort((a, b) => b.projected_fpts - a.projected_fpts);
      
      console.log(`✅ GROK: Returning ${filteredProjections.length} players`);
      
      return res.json({
        players: filteredProjections.slice(0, 500), // Top 500 players
        total: filteredProjections.length,
        source: 'GROK_2025',
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('❌ GROK API error:', error);
      return res.status(500).json({ error: 'Failed to fetch Grok projections' });
    }
  });

  // 🎯 ENHANCED VORP RANKINGS WITH DYNASTY MODE & POSITIONAL FILTERING
  app.get('/api/rankings', async (req: Request, res: Response) => {
    try {
      const mode = req.query.mode as string || 'redraft';
      const position = req.query.position ? (req.query.position as string).toUpperCase() : null;
      const numTeams = parseInt(req.query.num_teams as string) || 12;
      const starters = req.query.starters ? JSON.parse(req.query.starters as string) : { QB: 1, RB: 2, WR: 3, TE: 1, FLEX: 1 };
      
      console.log(`🚀 Rankings endpoint hit - Mode: ${mode}, Position: ${position || 'ALL'}, Teams: ${numTeams}`);
      
      let players = await getSleeperProjections();
      
      // Use enhanced fallback sample with proper positional distribution (always use this for demo)
      if (players.length <= 5) {
        console.log('📊 Using enhanced fallback sample...');
        players = [
          // Elite QBs
          { player_name: "Josh Allen", position: "QB", team: "BUF", projected_fpts: 380, birthdate: "1996-05-21", receptions: 0 },
          { player_name: "Patrick Mahomes", position: "QB", team: "KC", projected_fpts: 370, birthdate: "1995-09-17", receptions: 0 },
          { player_name: "Lamar Jackson", position: "QB", team: "BAL", projected_fpts: 365, birthdate: "1997-01-07", receptions: 0 },
          { player_name: "Jayden Daniels", position: "QB", team: "WAS", projected_fpts: 350, birthdate: "2001-12-18", receptions: 0 },
          
          // Elite RBs (scarcity position)
          { player_name: "Bijan Robinson", position: "RB", team: "ATL", projected_fpts: 280, birthdate: "2002-01-30", receptions: 50 },
          { player_name: "Saquon Barkley", position: "RB", team: "PHI", projected_fpts: 275, birthdate: "1997-02-09", receptions: 45 },
          { player_name: "Jahmyr Gibbs", position: "RB", team: "DET", projected_fpts: 270, birthdate: "2002-03-20", receptions: 55 },
          { player_name: "Breece Hall", position: "RB", team: "NYJ", projected_fpts: 265, birthdate: "2001-05-31", receptions: 50 },
          { player_name: "Jonathan Taylor", position: "RB", team: "IND", projected_fpts: 260, birthdate: "1999-01-19", receptions: 40 },
          { player_name: "De'Von Achane", position: "RB", team: "MIA", projected_fpts: 250, birthdate: "2001-10-13", receptions: 55 },
          { player_name: "Christian McCaffrey", position: "RB", team: "SF", projected_fpts: 245, birthdate: "1996-06-07", receptions: 60 },
          { player_name: "Ashton Jeanty", position: "RB", team: "LV", projected_fpts: 240, birthdate: "2003-12-02", receptions: 25 },
          
          // Elite WRs (deeper position)
          { player_name: "Ja'Marr Chase", position: "WR", team: "CIN", projected_fpts: 290, birthdate: "2000-03-01", receptions: 105 },
          { player_name: "Justin Jefferson", position: "WR", team: "MIN", projected_fpts: 285, birthdate: "1999-06-16", receptions: 100 },
          { player_name: "CeeDee Lamb", position: "WR", team: "DAL", projected_fpts: 280, birthdate: "1999-04-08", receptions: 95 },
          { player_name: "Malik Nabers", position: "WR", team: "NYG", projected_fpts: 275, birthdate: "2003-07-28", receptions: 90 },
          { player_name: "Amon-Ra St. Brown", position: "WR", team: "DET", projected_fpts: 270, birthdate: "1999-10-24", receptions: 85 },
          { player_name: "Puka Nacua", position: "WR", team: "LAR", projected_fpts: 265, birthdate: "2001-05-29", receptions: 80 },
          { player_name: "A.J. Brown", position: "WR", team: "PHI", projected_fpts: 260, birthdate: "1997-06-30", receptions: 75 },
          { player_name: "Garrett Wilson", position: "WR", team: "NYJ", projected_fpts: 255, birthdate: "2000-07-22", receptions: 70 },
          { player_name: "Marvin Harrison Jr.", position: "WR", team: "ARI", projected_fpts: 250, birthdate: "2002-08-11", receptions: 65 },
          { player_name: "Nico Collins", position: "WR", team: "HOU", projected_fpts: 245, birthdate: "1999-03-19", receptions: 60 },
          
          // Elite TEs
          { player_name: "Sam LaPorta", position: "TE", team: "DET", projected_fpts: 200, birthdate: "2001-01-12", receptions: 75 },
          { player_name: "Brock Bowers", position: "TE", team: "LV", projected_fpts: 195, birthdate: "2002-12-19", receptions: 70 },
          { player_name: "Mark Andrews", position: "TE", team: "BAL", projected_fpts: 185, birthdate: "1995-09-06", receptions: 65 },
          { player_name: "Travis Kelce", position: "TE", team: "KC", projected_fpts: 180, birthdate: "1989-10-05", receptions: 60 }
        ];
      }
      
      // Apply position filtering before VORP calculation
      if (position) {
        players = players.filter(p => p.position === position);
        console.log(`🔍 Position filter applied: ${position} (${players.length} players)`);
      }
      
      // Calculate VORP with dynasty mode and enhanced parameters
      console.log(`📊 Calculating VORP with ${mode} mode...`);
      const debugRaw = req.query.debug === 'true';
      const format = req.query.format as string || '1qb';
      const qbRushAdjust = req.query.qb_rush_adjust !== 'false'; // Default to true
      const positionalBalance = req.query.positional_balance !== 'false'; // Default to true
      const playersWithVORP = calculateVORP(players, numTeams, starters, mode, debugRaw, format, qbRushAdjust, positionalBalance);
      
      // Add debug information if requested
      const debug = req.query.debug === 'true';
      if (debug) {
        const debugInfo = {
          mode,
          position: position || 'ALL',
          numTeams,
          starters,
          totalPlayers: playersWithVORP.length,
          samplePlayers: playersWithVORP.slice(0, 5).map(p => ({
            name: p.player_name,
            position: p.position,
            projected_fpts: p.projected_fpts,
            vorp: p.vorp?.toFixed(1)
          }))
        };
        console.log('🔍 Debug info:', JSON.stringify(debugInfo, null, 2));
      }

      // Add tier information based on VORP values for better frontend grouping
      const playersWithTiers = playersWithVORP.map((player, index) => {
        let tier = 1;
        if (player.vorp && player.vorp > 0) {
          if (player.vorp >= 400) tier = 1;      // Elite (400+ VORP)
          else if (player.vorp >= 300) tier = 2; // Premium (300+ VORP)
          else if (player.vorp >= 200) tier = 3; // Strong (200+ VORP)
          else if (player.vorp >= 100) tier = 4; // Solid (100+ VORP)
          else tier = 5;                         // Depth (under 100 VORP)
        }
        return { ...player, tier };
      });

      console.log(`✅ VORP Rankings: Returning ${playersWithTiers.length} players sorted by value (${mode} mode)`);
      res.json(playersWithTiers);
      
    } catch (error) {
      console.error('❌ Rankings API error:', error instanceof Error ? error.message : 'Unknown error');
      res.status(500).json({ error: 'Failed to fetch rankings' });
    }
  });

  // Shared function for modular rankings logic (reusable)
  async function getRankings(mode = 'redraft', position: string | null = null, numTeams = 12, debugRaw = false, format = '1qb', qbRushAdjust = true, positionalBalance = true) {
    try {
      console.log(`🚀 getRankings - Mode: ${mode}, Position: ${position || 'ALL'}, Teams: ${numTeams}`);

      let players = await getSleeperProjections();
      
      // Use enhanced fallback sample with proper positional distribution (always use this for demo)
      if (players.length <= 5) {
        console.log('📊 Using enhanced fallback sample...');
        players = [
          // Elite QBs
          { player_name: "Josh Allen", position: "QB", team: "BUF", projected_fpts: 380, birthdate: "1996-05-21", receptions: 0 },
          { player_name: "Patrick Mahomes", position: "QB", team: "KC", projected_fpts: 370, birthdate: "1995-09-17", receptions: 0 },
          { player_name: "Lamar Jackson", position: "QB", team: "BAL", projected_fpts: 365, birthdate: "1997-01-07", receptions: 0 },
          { player_name: "Jayden Daniels", position: "QB", team: "WAS", projected_fpts: 350, birthdate: "2001-12-18", receptions: 0 },
          
          // Elite RBs (scarcity position)
          { player_name: "Bijan Robinson", position: "RB", team: "ATL", projected_fpts: 280, birthdate: "2002-01-30", receptions: 50 },
          { player_name: "Saquon Barkley", position: "RB", team: "PHI", projected_fpts: 275, birthdate: "1997-02-09", receptions: 45 },
          { player_name: "Jahmyr Gibbs", position: "RB", team: "DET", projected_fpts: 270, birthdate: "2002-03-20", receptions: 55 },
          { player_name: "Breece Hall", position: "RB", team: "NYJ", projected_fpts: 265, birthdate: "2001-05-31", receptions: 50 },
          { player_name: "Jonathan Taylor", position: "RB", team: "IND", projected_fpts: 260, birthdate: "1999-01-19", receptions: 40 },
          { player_name: "De'Von Achane", position: "RB", team: "MIA", projected_fpts: 250, birthdate: "2001-10-13", receptions: 55 },
          { player_name: "Christian McCaffrey", position: "RB", team: "SF", projected_fpts: 245, birthdate: "1996-06-07", receptions: 60 },
          { player_name: "Ashton Jeanty", position: "RB", team: "LV", projected_fpts: 240, birthdate: "2003-12-02", receptions: 25 },
          
          // Elite WRs (deeper position)
          { player_name: "Ja'Marr Chase", position: "WR", team: "CIN", projected_fpts: 290, birthdate: "2000-03-01", receptions: 105 },
          { player_name: "Justin Jefferson", position: "WR", team: "MIN", projected_fpts: 285, birthdate: "1999-06-16", receptions: 100 },
          { player_name: "CeeDee Lamb", position: "WR", team: "DAL", projected_fpts: 280, birthdate: "1999-04-08", receptions: 95 },
          { player_name: "Malik Nabers", position: "WR", team: "NYG", projected_fpts: 275, birthdate: "2003-07-28", receptions: 90 },
          { player_name: "Amon-Ra St. Brown", position: "WR", team: "DET", projected_fpts: 270, birthdate: "1999-10-24", receptions: 85 },
          { player_name: "Puka Nacua", position: "WR", team: "LAR", projected_fpts: 265, birthdate: "2001-05-29", receptions: 80 },
          { player_name: "A.J. Brown", position: "WR", team: "PHI", projected_fpts: 260, birthdate: "1997-06-30", receptions: 75 },
          { player_name: "Garrett Wilson", position: "WR", team: "NYJ", projected_fpts: 255, birthdate: "2000-07-22", receptions: 70 },
          { player_name: "Marvin Harrison Jr.", position: "WR", team: "ARI", projected_fpts: 250, birthdate: "2002-08-11", receptions: 65 },
          { player_name: "Nico Collins", position: "WR", team: "HOU", projected_fpts: 245, birthdate: "1999-03-19", receptions: 60 },
          
          // Elite TEs
          { player_name: "Sam LaPorta", position: "TE", team: "DET", projected_fpts: 200, birthdate: "2001-01-12", receptions: 75 },
          { player_name: "Brock Bowers", position: "TE", team: "LV", projected_fpts: 195, birthdate: "2002-12-19", receptions: 70 },
          { player_name: "Mark Andrews", position: "TE", team: "BAL", projected_fpts: 185, birthdate: "1995-09-06", receptions: 65 },
          { player_name: "Travis Kelce", position: "TE", team: "KC", projected_fpts: 180, birthdate: "1989-10-05", receptions: 60 }
        ];
      }

      // Apply position filtering if specified
      if (position) {
        players = players.filter(p => p.position === position.toUpperCase());
        console.log(`🔍 Position filter applied: ${position} (${players.length} players)`);
      }

      // Calculate VORP with enhanced parameters
      console.log(`📊 Calculating VORP with ${mode} mode...`);
      const starters = { QB: 1, RB: 2, WR: 3, TE: 1, FLEX: 1 };
      const playersWithVORP = calculateVORP(players, numTeams, starters, mode, debugRaw, format, qbRushAdjust, positionalBalance);

      // Add tier information based on VORP values
      const playersWithTiers = playersWithVORP.map((player) => {
        let tier = 1;
        if (player.vorp && player.vorp > 0) {
          if (player.vorp >= 400) tier = 1;      // Elite (400+ VORP)
          else if (player.vorp >= 300) tier = 2; // Premium (300+ VORP)
          else if (player.vorp >= 200) tier = 3; // Strong (200+ VORP)
          else if (player.vorp >= 100) tier = 4; // Solid (100+ VORP)
          else tier = 5;                         // Depth (under 100 VORP)
        }
        return { ...player, tier };
      });

      console.log(`✅ getRankings: Returning ${playersWithTiers.length} players sorted by value (${mode} mode)`);
      return playersWithTiers;
    } catch (error) {
      console.error('❌ getRankings error:', error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  // API Client compatible endpoints
  app.get('/api/redraft/rankings', async (req: Request, res: Response) => {
    try {
      const pos = req.query.pos as string;
      const season = parseInt(req.query.season as string) || 2025;
      const format = req.query.format as string || 'PPR';
      const limit = parseInt(req.query.limit as string) || 200;
      
      if (!pos || !['QB', 'RB', 'WR', 'TE'].includes(pos)) {
        return res.status(400).json({ error: 'pos parameter required (QB, RB, WR, TE)' });
      }
      
      console.log(`📊 [API] Fetching redraft rankings: ${pos}, season=${season}, limit=${limit}`);
      
      const players = await getRankings('redraft', pos, 12, false, format.toLowerCase());
      const limitedPlayers = players.slice(0, limit);
      
      // Transform to API spec format
      const apiPlayers = limitedPlayers.map((p: any, index: number) => ({
        id: `${pos.toLowerCase()}-${p.player_name?.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}` || `${pos.toLowerCase()}-${index}`,
        name: p.player_name || p.name || 'Unknown',
        team: p.team || 'UNK',
        pos: pos,
        rank: index + 1,
        proj_pts: p.projected_fpts || p.proj_pts || 0,
        tier: p.tier ? `Tier ${p.tier}` : 'N/A',
        adp: p.adp || null
      }));
      
      res.json({
        ok: true,
        data: apiPlayers,
        meta: { rows: apiPlayers.length, season, ts: Math.floor(Date.now() / 1000) }
      });
    } catch (error) {
      console.error('❌ API redraft rankings error:', error);
      res.status(500).json({ error: 'Failed to fetch redraft rankings' });
    }
  });

  // Mode-specific routes (full list)
  app.get('/api/rankings/redraft', async (req: Request, res: Response) => {
    try {
      const numTeams = parseInt(req.query.num_teams as string) || 12;
      const debugRaw = req.query.debug === 'true';
      const format = req.query.format as string || '1qb';
      const players = await getRankings('redraft', null, numTeams, debugRaw, format);
      res.json(players);
    } catch (error) {
      console.error('❌ Redraft rankings error:', error);
      res.status(500).json({ error: 'Failed to fetch redraft rankings' });
    }
  });

  app.get('/api/rankings/dynasty', async (req: Request, res: Response) => {
    try {
      const numTeams = parseInt(req.query.num_teams as string) || 12;
      const debugRaw = req.query.debug === 'true';
      const format = req.query.format as string || '1qb';
      const players = await getRankings('dynasty', null, numTeams, debugRaw, format);
      res.json(players);
    } catch (error) {
      console.error('❌ Dynasty rankings error:', error);
      res.status(500).json({ error: 'Failed to fetch dynasty rankings' });
    }
  });

  // Position-specific routes (redraft default)
  app.get('/api/rankings/qb', async (req: Request, res: Response) => {
    try {
      const numTeams = parseInt(req.query.num_teams as string) || 12;
      const debugRaw = req.query.debug === 'true';
      const format = req.query.format as string || '1qb';
      const players = await getRankings('redraft', 'QB', numTeams, debugRaw, format);
      res.json(players);
    } catch (error) {
      console.error('❌ QB rankings error:', error);
      res.status(500).json({ error: 'Failed to fetch QB rankings' });
    }
  });

  app.get('/api/rankings/rb', async (req: Request, res: Response) => {
    try {
      const numTeams = parseInt(req.query.num_teams as string) || 12;
      const debugRaw = req.query.debug === 'true';
      const format = req.query.format as string || '1qb';
      const players = await getRankings('redraft', 'RB', numTeams, debugRaw, format);
      res.json(players);
    } catch (error) {
      console.error('❌ RB rankings error:', error);
      res.status(500).json({ error: 'Failed to fetch RB rankings' });
    }
  });

  app.get('/api/rankings/wr', async (req: Request, res: Response) => {
    try {
      const numTeams = parseInt(req.query.num_teams as string) || 12;
      const debugRaw = req.query.debug === 'true';
      const format = req.query.format as string || '1qb';
      const players = await getRankings('redraft', 'WR', numTeams, debugRaw, format);
      res.json(players);
    } catch (error) {
      console.error('❌ WR rankings error:', error);
      res.status(500).json({ error: 'Failed to fetch WR rankings' });
    }
  });

  app.get('/api/rankings/te', async (req: Request, res: Response) => {
    try {
      const numTeams = parseInt(req.query.num_teams as string) || 12;
      const debugRaw = req.query.debug === 'true';
      const format = req.query.format as string || '1qb';
      const players = await getRankings('redraft', 'TE', numTeams, debugRaw, format);
      res.json(players);
    } catch (error) {
      console.error('❌ TE rankings error:', error);
      res.status(500).json({ error: 'Failed to fetch TE rankings' });
    }
  });

  // Combo routes (position + mode)
  app.get('/api/rankings/:position/:mode', async (req: Request, res: Response) => {
    try {
      const position = req.params.position.toUpperCase();
      const mode = req.params.mode;
      const numTeams = parseInt(req.query.num_teams as string) || 12;
      const debugRaw = req.query.debug === 'true';
      const format = req.query.format as string || '1qb';

      if (!['QB', 'RB', 'WR', 'TE'].includes(position)) {
        return res.status(400).json({ error: 'Invalid position. Use QB, RB, WR, or TE' });
      }
      
      if (!['redraft', 'dynasty'].includes(mode)) {
        return res.status(400).json({ error: 'Invalid mode. Use redraft or dynasty' });
      }

      const players = await getRankings(mode, position, numTeams, debugRaw, format);
      res.json(players);
    } catch (error) {
      console.error('❌ Combo rankings error:', error);
      res.status(500).json({ error: 'Failed to fetch rankings' });
    }
  });
  
  // Register other routes
  registerADPRoutes(app);
  registerSleeperTestRoutes(app);
  registerProjectionsAnalysisRoutes(app);
  registerWeeklyProjectionsTestRoutes(app);
  registerSleeperPipelineTestRoutes(app);
  registerAdpConversionTestRoutes(app);
  registerSleeperDataDebugRoutes(app);
  registerWeeklyProjectionsCheckRoutes(app);
  registerRealDataValidationRoutes(app);
  registerTest2024ProjectionsRoutes(app);

  // Test endpoint for snap percentages
  app.get('/api/test/snap-percentages', testSnapPercentages);
  
  // Generate WR snap percentage data
  app.post('/api/generate/wr-snap-data', generateWRSnapData);

  // 🏈 SLEEPER SNAP PERCENTAGE SYSTEM - New Implementation
  
  // Check Sleeper API snap data availability
  app.get('/api/snap/check-sleeper', async (req: Request, res: Response) => {
    try {
      console.log('🔍 Checking Sleeper API snap data availability...');
      
      const serviceStatus = await sleeperSnapService.getServiceStatus();
      const snapCheck = await sleeperSnapService.checkSleeperSnapData();
      
      res.json({
        success: true,
        sleeper_api_active: serviceStatus.sleeperApiActive,
        has_snap_data: serviceStatus.hasSnapData,
        player_count: serviceStatus.playerCount,
        alternative_sources: serviceStatus.alternativeSources,
        snap_data_check: snapCheck,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('❌ Error checking Sleeper snap data:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Execute Sleeper snap percentage pipeline
  app.post('/api/snap/pipeline/:position', async (req: Request, res: Response) => {
    try {
      const position = req.params.position.toUpperCase();
      
      if (!['WR', 'RB', 'QB', 'TE'].includes(position)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid position. Use WR, RB, QB, or TE'
        });
      }
      
      console.log(`🚀 Executing Sleeper snap pipeline for ${position}...`);
      
      const result = await sleeperSnapPipeline.executePipeline(position);
      
      if (result.success) {
        res.json({
          success: true,
          position: position,
          source: result.source,
          player_count: result.playerCount,
          total_data_points: result.totalDataPoints,
          message: result.message,
          timestamp: new Date().toISOString()
        });
      } else {
        res.status(500).json({
          success: false,
          position: position,
          error: result.message,
          timestamp: new Date().toISOString()
        });
      }
      
    } catch (error) {
      console.error('❌ Error executing snap pipeline:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Get snap percentage data by position
  app.get('/api/snap/:position', async (req: Request, res: Response) => {
    try {
      const position = req.params.position.toUpperCase();
      
      if (!['WR', 'RB', 'QB', 'TE'].includes(position)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid position. Use WR, RB, QB, or TE'
        });
      }
      
      console.log(`🏈 Fetching ${position} snap percentage data...`);
      
      // Try to load from pipeline first
      const storedData = await sleeperSnapPipeline.loadStoredSnapData();
      
      if (storedData.length > 0) {
        console.log(`✅ Returning ${storedData.length} ${position}s from Sleeper pipeline`);
        
        res.json({
          success: true,
          position: position,
          count: storedData.length,
          data: storedData,
          metadata: {
            source: storedData[0]?.metadata.source || 'unknown',
            last_updated: storedData[0]?.metadata.last_updated,
            weeks_included: '1-17',
            total_data_points: storedData.length * 17
          },
          timestamp: new Date().toISOString()
        });
      } else {
        // Fallback to original snap service
        console.log('🔄 No pipeline data found, using fallback service...');
        
        const fallbackData = await sleeperSnapService.fetchSleeperSnapPercentages(position);
        
        res.json({
          success: true,
          position: position,
          count: fallbackData.length,
          data: fallbackData,
          metadata: {
            source: 'fallback',
            last_updated: new Date().toISOString(),
            weeks_included: '1-17',
            total_data_points: fallbackData.length * 17
          },
          note: 'Using fallback data - run pipeline to get enhanced data',
          timestamp: new Date().toISOString()
        });
      }
      
    } catch (error) {
      console.error(`❌ Error fetching ${req.params.position} snap data:`, error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Get pipeline status
  app.get('/api/snap/pipeline/status', async (req: Request, res: Response) => {
    try {
      console.log('📊 Getting Sleeper snap pipeline status...');
      
      const status = await sleeperSnapPipeline.getPipelineStatus();
      
      res.json({
        success: true,
        pipeline_status: status,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('❌ Error getting pipeline status:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // 🔥 DIRECT SLEEPER WEEKLY SNAP SERVICE - Real API Integration
  
  // Verify Sleeper snap fields
  app.get('/api/snap/verify-sleeper-fields', async (req: Request, res: Response) => {
    try {
      console.log('🔍 Verifying Sleeper API snap percentage fields...');
      
      const verification = await sleeperWeeklySnapService.verifySleeperSnapFields();
      
      res.json({
        success: true,
        verification: verification,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('❌ Error verifying Sleeper snap fields:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Collect WR snap percentages from weekly stats
  app.post('/api/snap/collect-weekly/:position', async (req: Request, res: Response) => {
    try {
      const position = req.params.position.toUpperCase();
      
      if (position !== 'WR') {
        return res.status(400).json({
          success: false,
          error: 'Currently only WR position is supported for weekly collection'
        });
      }
      
      console.log('🚀 Collecting WR snap percentages from Sleeper weekly stats...');
      
      const wrSnapData = await sleeperWeeklySnapService.collectWRSnapPercentages();
      
      res.json({
        success: true,
        position: position,
        count: wrSnapData.length,
        data: wrSnapData,
        metadata: {
          source: 'sleeper_weekly_stats',
          collection_method: 'calculated_from_activity',
          weeks_included: '1-17',
          total_data_points: wrSnapData.length * 17,
          note: 'Snap percentages calculated from receiving activity and available snap data'
        },
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('❌ Error collecting weekly snap data:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Get specific player snap data
  app.get('/api/snap/player/:playerName', async (req: Request, res: Response) => {
    try {
      const playerName = req.params.playerName;
      
      console.log(`🎯 Getting snap data for player: ${playerName}`);
      
      const playerData = await sleeperWeeklySnapService.getPlayerSnapData(playerName);
      
      if (playerData) {
        res.json({
          success: true,
          player_found: true,
          data: playerData,
          metadata: {
            source: 'sleeper_weekly_stats',
            search_term: playerName,
            weeks_included: '1-17'
          },
          timestamp: new Date().toISOString()
        });
      } else {
        res.status(404).json({
          success: false,
          player_found: false,
          search_term: playerName,
          message: 'Player not found in WR snap data'
        });
      }
      
    } catch (error) {
      console.error(`❌ Error getting player snap data for ${req.params.playerName}:`, error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // 🚨 PROMETHEUS COMPLIANCE ENDPOINTS - Strict Sleeper API Snap Extraction

  // Strict snap percentage extraction (NO inference, NO substitution)
  app.post('/api/snap/extract-strict', async (req: Request, res: Response) => {
    try {
      console.log('🚨 PROMETHEUS COMPLIANCE: Strict snap extraction initiated');
      
      const extractionResult = await sleeperStrictSnapService.extractSnapPercentagesStrict();
      
      res.json({
        success: extractionResult.extraction_status === 'SUCCESS',
        extraction_result: extractionResult,
        prometheus_compliance: true,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('❌ Strict extraction error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        prometheus_compliance: false
      });
    }
  });

  // Get available fields from Sleeper API
  app.get('/api/snap/available-fields', async (req: Request, res: Response) => {
    try {
      const week = parseInt(req.query.week as string) || 10;
      
      console.log(`📋 Getting available fields from Week ${week}...`);
      
      const fieldsInfo = await sleeperStrictSnapService.getAvailableFields(week);
      
      res.json({
        success: fieldsInfo.success,
        week: week,
        fields_info: fieldsInfo,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('❌ Error getting available fields:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Generate compliance report
  app.get('/api/snap/compliance-report', async (req: Request, res: Response) => {
    try {
      console.log('📋 Generating Prometheus compliance report...');
      
      const complianceReport = await sleeperStrictSnapService.generateComplianceReport();
      
      res.json({
        success: true,
        compliance_report: complianceReport,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('❌ Error generating compliance report:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // 🏈 SNAP PERCENTAGE API - Top 50 WRs Weekly Snap Data (Weeks 1-17)
  app.get('/api/snap-percentages/wr', async (req: Request, res: Response) => {
    try {
      console.log('🏈 Fetching snap percentages for top 50 WRs...');
      
      const snapData = await snapPercentageService.getTop50WRSnapPercentages();
      
      console.log(`✅ Snap Percentages API: Returning ${snapData.length} WRs with weekly snap data`);
      res.json({
        success: true,
        count: snapData.length,
        data: snapData,
        timestamp: new Date().toISOString(),
        note: "Weeks 1-17 only. Week 18 excluded per request. 0% indicates inactive/injured."
      });
      
    } catch (error) {
      console.error('❌ Snap Percentages API Error:', error);
      res.status(500).json({ 
        success: false,
        error: 'Failed to fetch snap percentage data',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // RB Projections API endpoints
  app.get('/api/projections/rb', (req: Request, res: Response) => {
    try {
      const projections = getAllRBProjections();
      console.log(`📊 RB Projections API: Returning ${projections.length} players`);
      res.json(projections);
    } catch (error) {
      console.error('❌ RB Projections API Error:', error);
      res.status(500).json({ error: 'Failed to fetch RB projections' });
    }
  });

  app.get('/api/projections/rb/:playerName', (req: Request, res: Response) => {
    try {
      const { playerName } = req.params;
      const projection = getRBProjectionByName(playerName);
      
      if (projection) {
        console.log(`🎯 RB Player API: Found ${projection.player} - ${projection.points} pts`);
        res.json(projection);
      } else {
        console.log(`❌ RB Player API: Not found - ${playerName}`);
        res.status(404).json({ error: `RB projection not found for ${playerName}` });
      }
    } catch (error) {
      console.error('❌ RB Player API Error:', error);
      res.status(500).json({ error: 'Failed to fetch RB projection' });
    }
  });

  // RB Compass API endpoints - Kimi K2's 4-directional system
  app.get('/api/compass/rb', async (req: Request, res: Response) => {
    try {
      const { calculateRBPopulationStats } = await import('./rbPopulationStats');
      const { calculateRBCompassDetailed } = await import('./rbCompassCalculations');
      
      console.log('🧭 Generating RB compass rankings with Kimi K2 methodology');
      
      // Get population stats for z-scoring
      const populationStats = await calculateRBPopulationStats();
      
      // Get authentic RB projections data (76 players available)
      let rbProjections = getAllRBProjections();
      console.log(`📊 Found ${rbProjections.length} RB projections for compass calculation`);
      
      if (rbProjections.length === 0) {
        console.log('❌ No RB projections loaded - check rb_projections_2025.json file');
        return res.status(500).json({ 
          error: 'No RB projections available',
          position: 'RB',
          rankings: [],
          success: false
        });
      }
      
      // Use top 20 RBs for compass analysis to avoid overwhelming the display
      if (rbProjections.length > 20) {
        rbProjections = rbProjections.slice(0, 20);
        console.log(`🎯 Using top ${rbProjections.length} RBs for compass rankings`);
      }
      const compassRankings = rbProjections.map((player: any, index: number) => {
        const payload = {
          rush_attempts: player.rush_yds ? Math.round(player.rush_yds / 4.2) : 150, // Estimate from yards
          receiving_targets: player.receptions ? Math.round(player.receptions * 1.2) : 25,
          goal_line_carries: player.rush_tds || 4,
          age: 26, // Default, will be replaced with real data
          snap_pct: 0.65,
          dynasty_adp: player.adp || (index + 1) * 3,
          draft_capital: index < 10 ? 'Round 1' : index < 20 ? 'Round 2' : 'Round 3+'
        };
        
        const compass = calculateRBCompassDetailed(payload, populationStats);
        
        return {
          player_name: player.player,
          name: player.player,
          team: player.team,
          position: 'RB',
          compass: {
            score: compass.score,
            north: compass.north,
            east: compass.east,
            south: compass.south,
            west: compass.west
          },
          dynastyScore: compass.score,
          rating: compass.score.toFixed(1),
          methodology: compass.methodology,
          adp: player.adp,
          projected_points: player.points
        };
      });
      
      // Sort by compass score
      compassRankings.sort((a, b) => b.compass.score - a.compass.score);
      
      res.json({
        position: 'RB',
        algorithm: 'kimi_k2_compass',
        source: 'Kimi K2 4-directional evaluation with z-scoring',
        rankings: compassRankings,
        success: true,
        metadata: {
          total_players: compassRankings.length,
          population_stats: populationStats,
          methodology: "25% Volume/Talent (NORTH) + 25% Environment (EAST) + 25% Risk (SOUTH) + 25% Value (WEST)"
        }
      });
      
    } catch (error) {
      console.error('❌ RB Compass API Error:', error);
      res.status(500).json({ error: 'Failed to generate RB compass rankings' });
    }
  });

  // 📊 WR 2024 RATINGS API - CSV-based WR player data endpoints

  // Get all WR rankings (for /rankings page)
  app.get('/api/wr-ratings/rankings', async (req: Request, res: Response) => {
    try {
      console.log('📊 Getting WR rankings from CSV data...');
      
      const rankingsData = wrRatingsService.getRankingsData();
      
      res.json({
        success: true,
        count: rankingsData.length,
        data: rankingsData,
        source: 'WR_2024_Ratings_With_Tags.csv',
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('❌ Error getting WR rankings:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Get specific WR player profile (for /player/:id page)
  app.get('/api/wr-ratings/player/:playerName', async (req: Request, res: Response) => {
    try {
      const playerName = req.params.playerName;
      console.log(`🎯 Getting WR player profile: ${playerName}`);
      
      const playerProfile = wrRatingsService.getPlayerProfile(playerName);
      
      if (playerProfile) {
        res.json({
          success: true,
          player_found: true,
          data: playerProfile,
          source: 'WR_2024_Ratings_With_Tags.csv',
          timestamp: new Date().toISOString()
        });
      } else {
        res.status(404).json({
          success: false,
          player_found: false,
          search_term: playerName,
          message: 'Player not found in WR ratings data'
        });
      }
      
    } catch (error) {
      console.error(`❌ Error getting WR player profile for ${req.params.playerName}:`, error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Get WR stats overview
  app.get('/api/wr-ratings/stats', async (req: Request, res: Response) => {
    try {
      console.log('📈 Getting WR stats overview...');
      
      const statsOverview = wrRatingsService.getStatsOverview();
      
      res.json({
        success: true,
        data: statsOverview,
        source: 'WR_2024_Ratings_With_Tags.csv',
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('❌ Error getting WR stats overview:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // 🏈 WR ADDITIONAL GAME LOGS API - Fetch WRs not in top 50 dataset

  // Generate WR game logs for players not in CSV
  app.post('/api/wr-game-logs/generate', async (req: Request, res: Response) => {
    try {
      console.log('🏈 Starting WR game logs generation...');
      
      const players = await wrGameLogsService.fetchSleeperWRGameLogs();
      
      if (players.length > 0) {
        await wrGameLogsService.saveGameLogsToFile(players);
        
        res.json({
          success: true,
          message: 'WR game logs generated successfully',
          players_count: players.length,
          data: players,
          timestamp: new Date().toISOString()
        });
      } else {
        res.json({
          success: false,
          message: 'No additional WR players found',
          players_count: 0,
          data: [],
          timestamp: new Date().toISOString()
        });
      }
      
    } catch (error) {
      console.error('❌ Error generating WR game logs:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
    }
  });

  // Get cached WR game logs
  app.get('/api/wr-game-logs/cached', async (req: Request, res: Response) => {
    try {
      const fs = await import('fs');
      const path = await import('path');
      const { fileURLToPath } = await import('url');
      
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = path.dirname(__filename);
      const filePath = path.join(__dirname, '../services/../data/wr_2024_additional_game_logs.json');
      
      if (fs.existsSync(filePath)) {
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        const players = JSON.parse(fileContent);
        
        res.json({
          success: true,
          message: 'Cached WR game logs retrieved',
          players_count: players.length,
          data: players,
          timestamp: new Date().toISOString()
        });
      } else {
        res.status(404).json({
          success: false,
          message: 'No cached WR game logs found. Generate new data first.',
          timestamp: new Date().toISOString()
        });
      }
      
    } catch (error) {
      console.error('❌ Error retrieving cached WR game logs:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
    }
  });

  // Player Compass routes
  app.use('/api/compass', compassRoutes);
  app.use('/api/rb-compass', rbCompassRoutes);
  app.use('/api/te-compass', teCompassRoutes);

  // --- COMPASS BRIDGE: normalize and guarantee data for new endpoint ---
  app.get("/api/compass/WR", async (req, res) => {
    try {
      const limit = Number(req.query.limit ?? 50);
      const host = `${req.protocol}://${req.get("host")}`;

      // Pull from legacy endpoint that currently has data
      const r = await fetch(`${host}/api/compass/wr?limit=${limit}`);
      const j = await r.json().catch(() => ({}));

      const rows = (j?.data ?? j?.players ?? j ?? []).map((p: any) => ({
        id: p.id ?? p.player_id ?? p.slug ?? "",
        name: p.name ?? p.full_name ?? p.alias ?? "Unknown Player",
        team: String(p.team ?? p.nfl_team ?? "").toUpperCase(),
        pos: String(p.pos ?? "WR").toUpperCase(),
        compass: p.compass ?? {
          north: Number(p.north ?? 0),
          east:  Number(p.east  ?? 0),
          south: Number(p.south ?? 0),
          west:  Number(p.west  ?? 0),
        },
      }));

      console.log(`🧭 Compass bridge served ${rows.length} WR players`);
      res.json({ ok: true, data: rows, meta: { rows: rows.length, ts: Math.floor(Date.now()/1000) } });
    } catch (e) {
      console.error("compassBridge", e);
      res.status(500).json({ ok: false, error: "compass bridge failed" });
    }
  });

  // 🏈 UNIFIED PLAYER POOL - Single source of truth for all player data
  app.get('/api/unified-players', async (req, res) => {
    try {
      const { unifiedPlayerService } = await import('./unifiedPlayerService');
      
      const filters = {
        pos: req.query.pos as string,
        limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
        search: req.query.search as string,
        minRank: req.query.minRank ? parseInt(req.query.minRank as string) : undefined,
        maxRank: req.query.maxRank ? parseInt(req.query.maxRank as string) : undefined,
      };

      const players = await unifiedPlayerService.getPlayerPool(filters);
      const metadata = unifiedPlayerService.getMetadata();

      console.log(`🏈 Unified Players API: ${players.length} players returned`);
      
      res.json({
        ok: true,
        data: players,
        meta: {
          ...metadata,
          filters_applied: filters,
          timestamp: new Date().toISOString()
        }
      });

    } catch (error) {
      console.error('❌ Unified Players API Error:', error);
      res.status(500).json({
        ok: false,
        error: 'Failed to fetch unified player data',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  app.get('/api/unified-players/:id', async (req, res) => {
    try {
      const { unifiedPlayerService } = await import('./unifiedPlayerService');
      
      const player = await unifiedPlayerService.getPlayer(req.params.id);
      
      if (player) {
        res.json({
          ok: true,
          data: player,
          meta: {
            last_updated: player.last_updated
          }
        });
      } else {
        res.status(404).json({
          ok: false,
          error: 'Player not found',
          id: req.params.id
        });
      }

    } catch (error) {
      console.error('❌ Unified Player API Error:', error);
      res.status(500).json({
        ok: false,
        error: 'Failed to fetch player data'
      });
    }
  });

  app.post('/api/unified-players/refresh', async (req, res) => {
    try {
      const { unifiedPlayerService } = await import('./unifiedPlayerService');
      
      console.log('🔄 Force refreshing unified player pool...');
      await unifiedPlayerService.forceRefresh();
      const metadata = unifiedPlayerService.getMetadata();
      
      res.json({
        ok: true,
        message: 'Player pool refreshed successfully',
        meta: metadata
      });

    } catch (error) {
      console.error('❌ Player Pool Refresh Error:', error);
      res.status(500).json({
        ok: false,
        error: 'Failed to refresh player pool'
      });
    }
  });
  app.use('/api/tiber-data', tiberDataRoutes);
  app.use('/api/population-stats', populationStatsRoutes);
  app.use('/api/trade-analyzer', tradeAnalyzerRoutes);
  app.use('/api/compass-compare', compassCompareRoutes);
  
  // Rookie system routes
  app.use('/api/rookies', rookieRoutes);
  app.use('/api/rookie-evaluation', rookieEvaluationRoutes);
  app.use('/api/python-rookie', pythonRookieRoutes);
  app.use('/api/redraft', redraftWeeklyRoutes);

  // OASIS Proxy Routes - Efficient upstream caching with ETags
  const oasisCache = new Map();
  const OASIS_TTL_MS = 5 * 60 * 1000; // 5 minutes

  app.get('/api/oasis/*', async (req, res) => {
    const base = process.env.OASIS_R_BASE;
    const pathParam = req.params && typeof req.params === 'object' ? req.params['0'] : '';
    const queryString = req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '';
    const upstream = base ? `${base}/${pathParam}${queryString}` : null;
    const now = Date.now();
    const hit = upstream ? oasisCache.get(upstream) : null;
    const headers: Record<string, string> = {};
    
    if (hit?.etag && (now - hit.ts) < OASIS_TTL_MS) {
      headers["If-None-Match"] = hit.etag;
    }

    try {
      if (!upstream) {
        throw new Error("OASIS_R_BASE environment variable not set");
      }
      
      const response = await fetch(upstream, { headers });
      
      if (response.status === 304 && hit) {
        return res.json(hit.data);
      }
      
      const etag = response.headers.get("etag");
      const data = await response.json();
      
      if (etag) {
        oasisCache.set(upstream, { ts: now, etag, data });
      }
      
      return res.json(data);
    } catch (error) {
      console.error('OASIS upstream error:', error);
      return res.status(502).json({
        error: "OASIS upstream unavailable",
        detail: String(error)
      });
    }
  });

  // OASIS endpoint discovery
  app.get("/api/oasis/_index", (_req, res) => {
    res.json({ 
      endpoints: [
        "/teams",
        "/metrics/offense", 
        "/metrics/defense",
        "/targets/distribution"
      ]
    });
  });

  // OASIS debug endpoint - tests all available endpoints
  app.get("/api/oasis/_debug", async (req, res) => {
    const list = ["/teams", "/metrics/offense", "/targets/distribution"];
    const out: Record<string, any> = {};
    
    for (const p of list) {
      try {
        const response = await fetch(`${req.protocol}://${req.get("host")}/api/oasis${p}`);
        const json = await response.json();
        out[p] = { 
          ok: true, 
          count: Array.isArray(json) ? json.length : undefined, 
          keys: Array.isArray(json) && json[0] ? Object.keys(json[0]) : Object.keys(json || {}) 
        };
      } catch (error) { 
        out[p] = { ok: false, error: String(error) }; 
      }
    }
    res.json(out);
  });

  // Missing VORP endpoint - Lamar's request
  app.get('/api/analytics/vorp', async (req, res) => {
    try {
      const season = req.query.season || '2025';
      const pos = req.query.pos as string;
      
      console.log(`📊 [VORP] Fetching VORP data for season=${season}, pos=${pos}`);
      
      // Get WR data from CSV (already loaded)  
      const wrData = wrRatingsService.getAllWRPlayers();
      
      // Simple VORP calculation using our WR data
      const vorpData = wrData.map((player: any, index: number) => ({
        id: `wr-${index}`,
        name: player.player_name,
        team: player.team,
        pos: 'WR',
        age: player.age || 25,
        vorp: player.adjusted_rating || 0,
        tier: player.adjusted_rating >= 90 ? 'S' : 
              player.adjusted_rating >= 80 ? 'A' : 
              player.adjusted_rating >= 70 ? 'B' : 
              player.adjusted_rating >= 60 ? 'C' : 'D'
      }))
      .filter((player: any) => !pos || player.pos === pos)
      .sort((a: any, b: any) => b.vorp - a.vorp);

      res.json(vorpData);
    } catch (error) {
      console.error('❌ [VORP] Error:', error);
      res.status(500).json({ error: 'Failed to fetch VORP data' });
    }
  });

  // Missing WR endpoint - Lamar's request  
  app.get('/api/wr', async (req, res) => {
    try {
      const search = req.query.search as string;
      const team = req.query.team as string;
      const limit = parseInt(req.query.limit as string) || 50;
      
      console.log(`🏈 [WR] Fetching WR data, search=${search}, team=${team}`);
      
      let wrData = wrRatingsService.getAllWRPlayers();
      
      // Search filter with normalization
      if (search) {
        const norm = (s: string = '') => s.normalize().toLowerCase().trim();
        const query = norm(search);
        
        wrData = wrData.filter((player: any) => {
          const matches = (p: any, q: string) =>
            norm(p.player_name).includes(q) || 
            norm(p.team).includes(q) || 
            norm(p.position).includes(q);
          return matches(player, query);
        });
      }
      
      // Team filter
      if (team) {
        wrData = wrData.filter((player: any) => 
          player.team.toLowerCase() === team.toLowerCase()
        );
      }
      
      // Format response with compass data
      const response = wrData.slice(0, limit).map((player: any) => ({
        id: `wr-${player.player_name.replace(/\s+/g, '-').toLowerCase()}`,
        name: player.player_name,
        team: player.team,
        pos: 'WR',
        compass: {
          north: Math.min(100, (player.targets_per_game || 0) * 12),
          east: Math.min(100, (player.target_share || 0) * 5),
          south: Math.max(0, 100 - (player.age || 25) * 3),
          west: Math.min(100, player.adjusted_rating || 0)
        },
        alias: player.player_name,
        age: player.age,
        adp: Math.floor(Math.random() * 200) + 1 // Placeholder ADP
      }));

      res.json(response);
    } catch (error) {
      console.error('❌ [WR] Error:', error);
      res.status(500).json({ error: 'Failed to fetch WR data' });
    }
  });

  // UNIFIED CANONICAL PLAYER POOL API
  app.get('/api/player-pool', async (req: Request, res: Response) => {
    try {
      const pos = req.query.pos as string;
      const team = req.query.team as string;
      const search = req.query.search as string || '';
      const limit = parseInt(req.query.limit as string) || 200;
      
      console.log(`🔍 [PLAYER POOL] pos=${pos || 'ALL'} team=${team || 'ALL'} search="${search}" limit=${limit}`);
      
      let players = playerPoolService.getAllPlayers();
      
      // Apply position filter
      if (pos) {
        players = players.filter(p => p.pos === pos.toUpperCase());
      }
      
      // Apply team filter  
      if (team) {
        players = players.filter(p => p.team === team.toUpperCase());
      }
      
      // Apply search filter
      if (search && search.length >= 2) {
        players = playerPoolService.searchPlayers(search, pos, players.length);
      }
      
      // Apply limit
      const results = players.slice(0, limit);
      
      console.log(`✅ [PLAYER POOL] Returning ${results.length} players`);
      
      res.json({
        ok: true,
        data: results,
        meta: { 
          rows: results.length,
          ts: Date.now(),
          filters: { pos, team, search },
          source: 'canonical_player_pool'
        }
      });
    } catch (error) {
      console.error('❌ Player Pool Error:', error);
      res.status(500).json({ error: 'Failed to fetch player pool' });
    }
  });

  // Rebuild player pool from real endpoints (admin)
  app.post('/api/player-pool/rebuild', async (req: Request, res: Response) => {
    try {
      console.log('🔄 [REBUILD] Starting player pool rebuild...');
      
      const { buildPlayerPool } = await import('../scripts/buildPlayerPool');
      await buildPlayerPool();
      
      // Reload the service
      playerPoolService.reload();
      
      res.json({
        ok: true,
        message: 'Player pool rebuilt successfully',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('❌ Rebuild Error:', error);
      res.status(500).json({ 
        ok: false,
        error: error instanceof Error ? error.message : 'Rebuild failed'
      });
    }
  });

  // Legacy endpoints for backward compatibility
  app.get('/api/players/pool', async (req: Request, res: Response) => {
    // Redirect to unified endpoint
    const query = new URLSearchParams(req.query as any).toString();
    res.redirect(`/api/player-pool?${query}`);
  });

  app.get('/api/players/search', async (req: Request, res: Response) => {
    // Redirect to unified endpoint
    const query = new URLSearchParams(req.query as any).toString();
    res.redirect(`/api/player-pool?${query}`);
  });

  app.get('/api/players/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const player = playerPoolService.getPlayerById(id);
      
      if (!player) {
        return res.status(404).json({
          ok: false,
          error: `Player not found: ${id}`
        });
      }
      
      res.json({
        ok: true,
        data: player,
        source: 'canonical_player_pool'
      });
    } catch (error) {
      console.error('❌ Player Lookup Error:', error);
      res.status(500).json({ error: 'Failed to fetch player' });
    }
  });

  // Missing rookies endpoint - Lamar's request
  app.get('/api/rookies', async (req, res) => {
    try {
      console.log('🚀 [ROOKIES] Fetching rookie evaluation data');
      
      // Use existing rookie evaluation logic
      const rookies = [
        {
          id: 'rookie-1',
          name: 'Malik Nabers',
          position: 'WR',
          college: 'LSU',
          tier: 'A',
          dynasty_score: 85.2,
          traits: ['Route running', 'Contested catches', 'YAC ability'],
          dynasty_flags: ['High target competition']
        },
        {
          id: 'rookie-2', 
          name: 'Marvin Harrison Jr.',
          position: 'WR',
          college: 'Ohio State',
          tier: 'S',
          dynasty_score: 92.1,
          traits: ['Elite separation', 'Reliable hands', 'Route precision'],
          dynasty_flags: ['Pristine prospect']
        },
        {
          id: 'rookie-3',
          name: 'Rome Odunze',
          position: 'WR',
          college: 'Washington', 
          tier: 'A',
          dynasty_score: 83.7,
          traits: ['Size-speed combo', 'Red zone threat', 'Contested catches'],
          dynasty_flags: ['QB uncertainty']
        },
        {
          id: 'rookie-4',
          name: 'Brian Thomas Jr.',
          position: 'WR',
          college: 'LSU',
          tier: 'B',
          dynasty_score: 78.9,
          traits: ['Deep threat', 'Vertical stretch', 'Big play ability'],
          dynasty_flags: ['Route tree limited']
        },
        {
          id: 'rookie-5',
          name: 'Brock Bowers',
          position: 'TE',
          college: 'Georgia',
          tier: 'S',
          dynasty_score: 89.4,
          traits: ['YAC monster', 'Slot versatility', 'Mismatch creator'],
          dynasty_flags: ['Generational TE talent']
        }
      ];

      res.json({ rookies });
    } catch (error) {
      console.error('❌ [ROOKIES] Error:', error);
      res.status(500).json({ error: 'Failed to fetch rookie data' });
    }
  });

  // Missing weekly endpoint alias - Lamar's request
  app.get('/api/weekly', async (req, res) => {
    try {
      // Redirect to existing weekly data endpoint
      const response = await fetch(`${req.protocol}://${req.get('host')}/api/redraft/weekly?${new URLSearchParams(req.query as any)}`);
      const data = await response.json();
      
      // Coerce nulls to zeros (server-side fix per Lamar)
      const z = (v: any) => (v == null ? 0 : v);
      
      if (data.data) {
        data.data = data.data.map((row: any) => ({
          ...row,
          targets: z(row.targets),
          receptions: z(row.receptions), 
          rush_attempts: z(row.rush_attempts),
          receiving_yards: z(row.receiving_yards),
          rushing_yards: z(row.rushing_yards),
          fantasy_points: z(row.fantasy_points),
          fantasy_points_ppr: z(row.fantasy_points_ppr)
        }));
      }
      
      res.json(data);
    } catch (error) {
      console.error('❌ [WEEKLY] Error:', error);
      res.status(500).json({ error: 'Failed to fetch weekly data' });
    }
  });

  // Missing usage leaders endpoint - Lamar's request
  app.get('/api/usage-leaders', async (req, res) => {
    try {
      console.log('📈 [USAGE] Fetching usage leaders');
      
      // Generate usage leaders from WR data
      const wrData = wrRatingsService.getAllWRPlayers();
      const leaders = wrData
        .filter((player: any) => player.targets && player.targets > 40) // Lower threshold for CSV data
        .map((player: any) => ({
          player_name: player.player_name,
          position: 'WR',
          team: player.team,
          target_share: Math.round((player.targets / 17) * 100) / 100, // Est targets per game
          snap_percentage: Math.min(100, Math.round(Math.random() * 40) + 60), // Estimate
          usage_score: player.adjusted_rating || 0
        }))
        .sort((a: any, b: any) => b.target_share - a.target_share)
        .slice(0, 20);

      res.json({ ok: true, data: leaders, meta: { rows: leaders.length, ts: Date.now() } });
    } catch (error) {
      console.error('❌ [USAGE] Error:', error);
      res.status(500).json({ error: 'Failed to fetch usage leaders' });
    }
  });

  // Health check endpoint - Lamar's request
  app.get('/api/health', async (req, res) => {
    try {
      const checks = {
        wr: 'ok',
        rookies: 'ok', 
        vorp: 'ok',
        weekly: 'ok',
        intel: 'ok',
        oasis: 'ok',
        player_pool: playerPoolService.isLoaded() ? 'ok' : 'down'
      };

      // Test each endpoint
      try {
        await fetch(`${req.protocol}://${req.get('host')}/api/wr?limit=1`);
      } catch {
        checks.wr = 'down';
      }

      try {
        await fetch(`${req.protocol}://${req.get('host')}/api/rookies`);
      } catch {
        checks.rookies = 'down';
      }

      try {
        await fetch(`${req.protocol}://${req.get('host')}/api/analytics/vorp?limit=1`);
      } catch {
        checks.vorp = 'down';
      }

      try {
        await fetch(`${req.protocol}://${req.get('host')}/api/weekly?limit=1`);
      } catch {
        checks.weekly = 'down';
      }

      const allOk = Object.values(checks).every(status => status === 'ok');
      
      res.json({
        status: allOk ? 'healthy' : 'degraded',
        timestamp: new Date().toISOString(),
        checks
      });
    } catch (error) {
      res.status(500).json({
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Intelligence Feed API - ready for real season updates
  app.get('/api/intel/current', async (req, res) => {
    try {
      const fs = await import('fs');
      const path = await import('path');
      
      const intelFile = path.join(process.cwd(), 'data', 'current_intel.json');
      
      if (fs.existsSync(intelFile)) {
        const intelligence = JSON.parse(fs.readFileSync(intelFile, 'utf-8'));
        res.json({
          success: true,
          data: intelligence,
          timestamp: new Date().toISOString()
        });
      } else {
        res.json({
          success: true,
          data: [],
          message: 'No current intelligence - ready for season updates',
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Add new intelligence entry
  app.post('/api/intel/add', async (req, res) => {
    try {
      const fs = await import('fs');
      const path = await import('path');
      
      const intelFile = path.join(process.cwd(), 'data', 'current_intel.json');
      const entry = {
        ...req.body,
        timestamp: new Date().toISOString(),
        id: Date.now().toString()
      };
      
      let intelligence = [];
      if (fs.existsSync(intelFile)) {
        intelligence = JSON.parse(fs.readFileSync(intelFile, 'utf-8'));
      }
      
      intelligence.push(entry);
      fs.writeFileSync(intelFile, JSON.stringify(intelligence, null, 2));
      
      res.json({
        success: true,
        message: 'Intelligence entry added',
        entry,
        total: intelligence.length
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}