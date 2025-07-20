import type { Express } from "express";
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

  // 🔥 EMERGENCY CLEAN VORP RANKINGS ENDPOINT - DIRECT CALCULATION
  app.get('/api/rankings', cleanVorpRankings);
  
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

  const httpServer = createServer(app);
  return httpServer;
}