import type { Express, Request, Response } from "express";
import express from "express";
import axios from "axios";
import { createServer, type Server } from "http";
import { registerADPRoutes } from "./routes/adpRoutes";
import { adpSyncService } from "./adpSyncService";
import { storage } from "./storage";
import { teamSyncService } from "./teamSync";
import { optimizeLineup, calculateConfidence, analyzeTradeOpportunities, generateWaiverRecommendations } from "./analytics";
import { sportsDataAPI } from "./sportsdata";
import { playerAnalysisCache } from "./playerAnalysisCache";
import { espnAPI } from "./espnAPI";
import { playerMapping } from "./playerMapping";
import { dataRefreshService } from "./dataRefresh";
import { realTimeADPUpdater } from "./realTimeADPUpdater";
import { dataIntegrityFixer } from "./dataIntegrityFixer";
import { PlayerFilteringService } from "./playerFiltering";
import { db } from "./db";
import { dynastyTradeHistory, players as playersTable } from "@shared/schema";
import { eq, desc, and, sql } from "drizzle-orm";
import { z } from "zod";
import { fantasyProsAPI } from './services/fantasyProsAPI';
import { dataIngestionService } from './services/dataIngestionService';
import { fantasyProService } from './services/fantasyProService';
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

export async function registerRoutes(app: Express): Promise<Server> {
  
  // 🔥 TIBER OVERRIDE: Critical NFL stats endpoint - HIGHEST PRIORITY
  console.log('🔥 REGISTERING TIBER OVERRIDE ENDPOINT');
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

  const httpServer = createServer(app);
  return httpServer;
}