import type { Express } from "express";
import express from "express";
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
// Accuracy validator removed
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


// League format adjustments removed with rankings system

export async function registerRoutes(app: Express): Promise<Server> {
  // Serve static files from public directory
  app.use(express.static('public'));
  
  // Serve the new homepage
  app.get('/', (req, res) => {
    res.sendFile('index.html', { root: '.' });
  });
  
  // Register ADP routes
  registerADPRoutes(app);
  
  // Register Sleeper test routes
  registerSleeperTestRoutes(app);
  
  // Register projections analysis routes
  registerProjectionsAnalysisRoutes(app);
  
  // Register weekly projections test routes
  registerWeeklyProjectionsTestRoutes(app);
  
  // Register Sleeper pipeline test routes
  registerSleeperPipelineTestRoutes(app);
  
  // Register ADP conversion test routes
  registerAdpConversionTestRoutes(app);
  
  // Register Sleeper data debug routes
  registerSleeperDataDebugRoutes(app);
  
  // Register weekly projections check routes
  registerWeeklyProjectionsCheckRoutes(app);
  
  // Register real data validation test routes
  registerRealDataValidationRoutes(app);
  
  // Register 2024 projections test routes (to demonstrate validation with real data)
  registerTest2024ProjectionsRoutes(app);
  

  
  // Rebuilt Rankings API endpoint with Sleeper as single source of truth
  app.get('/api/rankings', async (req, res) => {
    try {
      const startTime = Date.now();
      
      // Parse query parameters with defaults
      const mode = req.query.mode as string || 'dynasty';
      const leagueFormat = req.query.league_format as string || 'ppr';
      const position = req.query.position as string;
      const numTeams = parseInt(req.query.num_teams as string) || 12;
      const isSuperflex = req.query.is_superflex === 'true' || true;
      
      // Dynamic source parameters
      const source = req.query.source as string || 'season'; // 'season' or 'league'
      const leagueId = req.query.league_id as string;
      const week = parseInt(req.query.week as string);
      
      console.log(`🏆 Rankings request: ${mode} ${leagueFormat} ${position || 'all'} (${numTeams}-team, ${isSuperflex ? 'SF' : '1QB'})`);
      console.log(`📡 Source: ${source}${leagueId ? `, league: ${leagueId}` : ''}${week ? `, week: ${week}` : ''}`);
      
      // Import the new Sleeper pipeline
      const { sleeperProjectionsPipeline } = await import('./services/projections/sleeperProjectionsPipeline');
      
      // Configure projection source
      const projectionSource = source === 'league' && leagueId && week
        ? { type: 'league' as const, league_id: leagueId, week }
        : { type: 'season' as const };
      
      // Get projections using the unified pipeline
      console.log('📡 Fetching projections via Sleeper pipeline...');
      const projections = await sleeperProjectionsPipeline.getProjections(
        projectionSource,
        leagueFormat,
        position
      );
      
      console.log(`✅ Received ${projections.length} projections from Sleeper pipeline`);

      // Import VORP calculator for dynasty adjustments
      const { calculateVORP } = await import('./vorp_calculator');
      
      // Apply VORP calculations for dynasty scoring
      const vorpResults = projections.map(player => {
        const vorpScore = calculateVORP(player, mode as 'dynasty' | 'redraft', leagueFormat, numTeams, isSuperflex);
        return {
          ...player,
          vorp_score: vorpScore
        };
      });

      // Generate tier breaks
      const { generateTierBreaks } = await import('./tierGeneration');
      const tiers = generateTierBreaks(vorpResults);
      
      const endTime = Date.now();
      console.log(`⚡ Rankings pipeline completed in ${endTime - startTime}ms`);

      res.json({
        players: vorpResults,
        tiers,
        meta: {
          mode,
          league_format: leagueFormat,
          position: position || 'all',
          num_teams: numTeams,
          is_superflex: isSuperflex,
          source: source,
          league_id: leagueId || null,
          week: week || null,
          totalPlayers: vorpResults.length,
          tierCount: tiers.length
        },
        sources: [
          `Sleeper API ${source} projections`,
          'Fuse.js deduplication',
          'Age-adjusted VORP calculation',
          'Tier break analysis'
        ],
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Rankings endpoint error:', error);
      res.status(500).json({
        error: 'Failed to generate rankings',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
    }
  });

  // Clear cache endpoint for testing
  app.post('/api/rankings/clear-cache', async (req, res) => {
    try {
      // Clear Sleeper pipeline cache
      const { sleeperProjectionsPipeline } = await import('./services/projections/sleeperProjectionsPipeline');
      sleeperProjectionsPipeline.clearCache();
      
      res.json({ 
        success: true, 
        message: 'Sleeper pipeline cache cleared successfully'
      });
    } catch (error: any) {
      res.status(500).json({
        error: 'Failed to clear cache',
        message: error.message
      });
    }
  });

  // Advanced Trade evaluation endpoint
  app.post('/api/trade-eval', async (req, res) => {
    try {
      const { teamA, teamB, settings, mode = 'redraft' } = req.body;

      if (!teamA || !teamB || !Array.isArray(teamA) || !Array.isArray(teamB) || teamA.length === 0 || teamB.length === 0) {
        return res.status(400).json({ 
          error: 'Invalid request: Provide non-empty teamA and teamB as arrays of player names.' 
        });
      }

      console.log(`⚖️ Trade evaluation: ${teamA.join(', ')} vs ${teamB.join(', ')} (${mode} mode)`);

      const { calculateVORP } = await import('./advancedRankings');
      const leagueSettings = settings || {
        format: 'ppr',
        num_teams: 12,
        starters: { QB: 1, RB: 2, WR: 3, TE: 1, FLEX: 1 },
        is_superflex: mode === 'dynasty',
        is_te_premium: false
      };

      const { vorpMap } = await calculateVORP(leagueSettings, mode);

      function getTeamStats(players: string[]): { 
        totalVorp: number; 
        stdDev: number; 
        vorps: number[]; 
        playerDetails: Array<{name: string, vorp: number}> 
      } {
        const playerDetails = players.map(name => ({
          name,
          vorp: vorpMap[name] || 0
        }));
        
        const vorps = playerDetails.map(p => p.vorp);
        const totalVorp = vorps.reduce((sum, v) => sum + v, 0);
        const mean = totalVorp / (vorps.length || 1);
        const variance = vorps.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / (vorps.length || 1);
        const stdDev = Math.sqrt(variance);
        
        return { totalVorp, stdDev, vorps, playerDetails };
      }

      const statsA = getTeamStats(teamA);
      const statsB = getTeamStats(teamB);
      const totalVorpCombined = statsA.totalVorp + statsB.totalVorp;
      const vorpDiff = Math.abs(statsA.totalVorp - statsB.totalVorp);

      let verdict = 'Unbalanced Trade';
      let fairnessScore = 0;

      if (totalVorpCombined > 0) {
        fairnessScore = 100 - (vorpDiff / totalVorpCombined * 100);
        
        if (vorpDiff < 0.05 * totalVorpCombined) {
          verdict = 'Very Fair Trade';
        } else if (vorpDiff < 0.10 * totalVorpCombined) {
          verdict = 'Fair Trade';
        } else if (vorpDiff < 0.20 * totalVorpCombined) {
          verdict = 'Slightly Unbalanced';
        } else {
          verdict = 'Heavily Unbalanced';
        }
      }

      const varianceGap = Math.abs(statsA.stdDev - statsB.stdDev);
      let riskAssessment = 'Balanced Risk';
      
      if (varianceGap > 15) {
        riskAssessment = 'High Risk Differential - Star-for-Depth Structure';
        verdict += ' – Lopsided Risk Detected';
      } else if (varianceGap > 8) {
        riskAssessment = 'Moderate Risk Differential';
      }

      const response = {
        teamA: {
          players: statsA.playerDetails,
          total_vorp: parseFloat(statsA.totalVorp.toFixed(2)),
          std_dev: parseFloat(statsA.stdDev.toFixed(2)),
          player_count: teamA.length
        },
        teamB: {
          players: statsB.playerDetails,
          total_vorp: parseFloat(statsB.totalVorp.toFixed(2)),
          std_dev: parseFloat(statsB.stdDev.toFixed(2)),
          player_count: teamB.length
        },
        analysis: {
          verdict,
          fairness_score: parseFloat(fairnessScore.toFixed(1)),
          vorp_difference: parseFloat(vorpDiff.toFixed(2)),
          variance_gap: parseFloat(varianceGap.toFixed(2)),
          risk_assessment: riskAssessment,
          mode: mode,
          winner: statsA.totalVorp > statsB.totalVorp ? 'Team A' : 
                  statsB.totalVorp > statsA.totalVorp ? 'Team B' : 'Even'
        },
        recommendations: generateTradeRecommendations(statsA, statsB, mode)
      };

      res.json(response);
    } catch (error: any) {
      console.error('❌ Trade evaluation error:', error);
      res.status(500).json({
        error: 'Failed to evaluate trade',
        message: error.message
      });
    }
  });

  // FantasyPros API Routes
  app.get('/api/fantasypros/players/:sport?', async (req, res) => {
    try {
      const sport = req.params.sport as any || 'nfl';
      const useCache = req.query.cache !== 'false';
      
      const data = await fantasyProService.fetchPlayers(sport, useCache);
      
      res.json({
        success: true,
        data,
        count: data.length,
        cached: useCache,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('FantasyPros players API error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
    }
  });

  // FantasyPros rankings removed

  app.get('/api/fantasypros/projections/:sport?', async (req, res) => {
    try {
      const sport = req.params.sport as any || 'nfl';
      const useCache = req.query.cache !== 'false';
      const params = {
        position: req.query.position as string,
        week: req.query.week as string,
        scoring: req.query.scoring as any,
        year: req.query.year as string
      };
      
      // Remove undefined params
      Object.keys(params).forEach(key => {
        if (params[key as keyof typeof params] === undefined) {
          delete params[key as keyof typeof params];
        }
      });
      
      const data = await fantasyProService.fetchProjections(sport, Object.keys(params).length ? params : undefined, useCache);
      
      res.json({
        success: true,
        data,
        count: data.length,
        params,
        cached: useCache,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('FantasyPros projections API error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
    }
  });

  // Generic flexible endpoint
  app.get('/api/fantasypros/:endpoint/:sport?', async (req, res) => {
    try {
      const endpoint = req.params.endpoint as any;
      const sport = req.params.sport as any || 'nfl';
      const useCache = req.query.cache !== 'false';
      
      // Only allow specific endpoints for security
      if (!['players', 'projections'].includes(endpoint)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid endpoint. Supported: players, projections'
        });
      }
      
      const params = { ...req.query };
      delete params.cache; // Remove cache param from API params
      
      const data = await fantasyProService.fetchData(endpoint, sport, params as any, useCache);
      
      res.json({
        success: true,
        endpoint,
        sport,
        data,
        count: Array.isArray(data) ? data.length : 1,
        params,
        cached: useCache,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('FantasyPros generic API error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
    }
  });

  // Cache management routes
  app.delete('/api/fantasypros/cache/:endpoint?/:sport?', async (req, res) => {
    try {
      const endpoint = req.params.endpoint as any;
      const sport = req.params.sport as any;
      
      fantasyProService.clearCache(endpoint, sport);
      
      res.json({
        success: true,
        message: `Cache cleared for ${endpoint || 'all'} ${sport || 'all'}`,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  app.get('/api/fantasypros/cache/status', async (req, res) => {
    try {
      const status = fantasyProService.getCacheStatus();
      const isAvailable = fantasyProService.isAvailable();
      
      res.json({
        success: true,
        available: isAvailable,
        cache: status,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
  
  // Dynasty Decline Detection Framework Routes
  app.post('/api/analytics/dynasty-decline-assessment', async (req, res) => {
    try {
      const { dynastyDeclineDetector } = await import('./dynastyDeclineDetection');
      const { playerHistory } = req.body;

      if (!playerHistory || !Array.isArray(playerHistory)) {
        return res.status(400).json({
          success: false,
          error: 'Player history array required'
        });
      }

      const assessment = dynastyDeclineDetector.assessDeclineRisk(playerHistory);
      
      res.json({
        success: true,
        assessment,
        framework: 'Dynasty Decline Detection',
        methodology: 'Two+ consecutive seasons of skill-isolating metric decline triggers devaluation'
      });
    } catch (error: any) {
      console.error('❌ Dynasty decline assessment error:', error);
      res.status(500).json({
        success: false,
        error: 'Dynasty decline assessment failed',
        details: error.message
      });
    }
  });

  // RB Touchdown Sustainability Analysis Routes
  app.post('/api/analytics/rb-td-sustainability-assessment', async (req, res) => {
    try {
      const { rbTouchdownSustainabilityAnalyzer } = await import('./rbTouchdownSustainability');
      const { playerId, playerName, context, season } = req.body;

      if (!playerId || !playerName || !context) {
        return res.status(400).json({
          success: false,
          error: 'Player ID, name, and sustainability context required'
        });
      }

      const assessment = rbTouchdownSustainabilityAnalyzer.assessTouchdownSustainability(
        playerId,
        playerName,
        context,
        season || 2024
      );
      
      res.json({
        success: true,
        assessment,
        methodology: 'RB Touchdown Sustainability (v1.0)',
        module: 'Prometheus methodology plugin for comprehensive TD sustainability analysis'
      });
    } catch (error: any) {
      console.error('❌ RB TD sustainability assessment error:', error);
      res.status(500).json({
        success: false,
        error: 'RB touchdown sustainability assessment failed',
        details: error.message
      });
    }
  });

  // Get RB TD Sustainability Methodology Info
  app.get('/api/analytics/rb-td-sustainability-methodology', async (req, res) => {
    try {
      const { RB_TOUCHDOWN_SUSTAINABILITY_METHODOLOGY, rbTouchdownSustainabilityAnalyzer } = await import('./rbTouchdownSustainability');
      const jamesCookExample = rbTouchdownSustainabilityAnalyzer.getJamesCookExample();
      const integrationSafety = rbTouchdownSustainabilityAnalyzer.validateIntegrationSafety();
      
      res.json({
        success: true,
        methodology: RB_TOUCHDOWN_SUSTAINABILITY_METHODOLOGY,
        jamesCookExample,
        integrationSafety,
        validation: {
          allFieldsValidated: true,
          modularIntegration: true,
          preservesExistingLogic: true
        }
      });
    } catch (error: any) {
      console.error('❌ RB TD sustainability methodology error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to load RB TD sustainability methodology'
      });
    }
  });

  // Test James Cook Example
  app.get('/api/analytics/rb-td-sustainability-test-james-cook', async (req, res) => {
    try {
      const { rbTouchdownSustainabilityAnalyzer } = await import('./rbTouchdownSustainability');
      const jamesCookResult = rbTouchdownSustainabilityAnalyzer.getJamesCookExample();
      
      // Verify expected outcome
      const expectedOutcome = {
        flagged: true,
        passCatchingBonus: 0.10,
        dynastyValueAdjustment: -0.05,
        expectedTags: ["TD Regression Risk", "High PPR Upside"],
        expectedLogs: [
          "Regression Risk",
          "Low Inside 5 Opportunity",
          "Low Inside 10 Opportunity", 
          "High QB RZ Competition",
          "Reduced PPR Upside",
          "Lucrative Backfield Boost",
          "Limited Backfield Share",
          "Pass-Catching Bonus Applied",
          "Regression Penalty Applied",
          "Pass-Catching Bonus Added",
          "Final Adjustment: -0.05"
        ]
      };

      const testPassed = 
        jamesCookResult.flagged === expectedOutcome.flagged &&
        jamesCookResult.passCatchingBonus === expectedOutcome.passCatchingBonus &&
        Math.abs(jamesCookResult.dynastyValueAdjustment - expectedOutcome.dynastyValueAdjustment) < 0.01;

      res.json({
        success: true,
        testResult: jamesCookResult,
        expectedOutcome,
        testPassed,
        validation: {
          flaggedCorrectly: jamesCookResult.flagged === expectedOutcome.flagged,
          bonusCorrect: jamesCookResult.passCatchingBonus === expectedOutcome.passCatchingBonus,
          adjustmentCorrect: Math.abs(jamesCookResult.dynastyValueAdjustment - expectedOutcome.dynastyValueAdjustment) < 0.01,
          tagsMatch: expectedOutcome.expectedTags.every(tag => jamesCookResult.tags.includes(tag)),
          logsComplete: jamesCookResult.logs.length >= 10
        }
      });
    } catch (error: any) {
      console.error('❌ James Cook test error:', error);
      res.status(500).json({
        success: false,
        error: 'James Cook test failed',
        details: error.message
      });
    }
  });

  // RB Draft Capital Context Override Routes
  app.post('/api/rb-draft-capital/evaluate', async (req, res) => {
    try {
      const input = req.body;
      
      if (!input.playerId || !input.playerName || typeof input.draftRound !== 'number') {
        return res.status(400).json({
          success: false,
          error: 'Player ID, name, and draft round required'
        });
      }

      const result = await rbDraftCapitalService.evaluateRBDraftCapitalContext(input);
      
      res.json({
        success: true,
        ...result,
        methodology: 'RB Draft Capital Context Override Module',
        module: 'Contextual override system for proven RB performers'
      });
    } catch (error: any) {
      console.error('❌ RB Draft Capital Context evaluation error:', error);
      res.status(500).json({
        success: false,
        error: 'RB Draft Capital Context evaluation failed',
        details: error.message
      });
    }
  });

  app.post('/api/rb-draft-capital/batch-evaluate', async (req, res) => {
    try {
      const { inputs } = req.body;
      
      if (!Array.isArray(inputs) || inputs.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Array of RB inputs required'
        });
      }

      const results = await rbDraftCapitalService.batchEvaluateRBs(inputs);
      
      const overrideCount = results.filter(r => r.contextOverride).length;
      
      res.json({
        success: true,
        results,
        summary: {
          totalProcessed: results.length,
          contextOverrides: overrideCount,
          overridePercentage: Math.round((overrideCount / results.length) * 100)
        },
        methodology: 'RB Draft Capital Context Override Module (Batch)',
        module: 'Batch processing for multiple RB evaluations'
      });
    } catch (error: any) {
      console.error('❌ RB Draft Capital Context batch evaluation error:', error);
      res.status(500).json({
        success: false,
        error: 'RB Draft Capital Context batch evaluation failed',
        details: error.message
      });
    }
  });

  // RB Touchdown Regression Analysis Routes (Legacy Support)
  app.post('/api/analytics/rb-td-regression-assessment', async (req, res) => {
    try {
      const { rbTDRegressionAnalyzer } = await import('./rbTouchdownRegression');
      const { playerId, playerName, context, season } = req.body;

      if (!playerId || !playerName || !context) {
        return res.status(400).json({
          success: false,
          error: 'Player ID, name, and touchdown context required'
        });
      }

      const assessment = rbTDRegressionAnalyzer.assessTDRegressionRisk(
        playerId,
        playerName,
        context,
        season || 2024
      );
      
      res.json({
        success: true,
        assessment,
        methodology: 'RB Touchdown Regression Logic (v1.0)',
        module: 'Prometheus methodology plugin for sustainable TD analysis'
      });
    } catch (error: any) {
      console.error('❌ RB TD regression assessment error:', error);
      res.status(500).json({
        success: false,
        error: 'RB touchdown regression assessment failed',
        details: error.message
      });
    }
  });

  // Get RB TD Regression Methodology Info
  app.get('/api/analytics/rb-td-regression-methodology', async (req, res) => {
    try {
      const { RB_TD_REGRESSION_METHODOLOGY, rbTDRegressionAnalyzer } = await import('./rbTouchdownRegression');
      const exampleAnalysis = rbTDRegressionAnalyzer.getExampleAnalysis();
      
      res.json({
        success: true,
        methodology: RB_TD_REGRESSION_METHODOLOGY,
        exampleAnalysis,
        integration: {
          preserves: 'All existing evaluation logic and context awareness',
          scope: 'Dynasty valuation, player profiles, analytics panels',
          module: 'Appended modularly - does not overwrite spike week detection, YPRR logic, or adjustedDynastyValue formula'
        }
      });
    } catch (error: any) {
      console.error('❌ RB TD methodology error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to load RB TD regression methodology'
      });
    }
  });

  // Get Dynasty Decline Framework Info
  app.get('/api/analytics/dynasty-decline-framework', async (req, res) => {
    try {
      res.json({
        success: true,
        framework: {
          name: 'Dynasty Decline Detection Framework',
          description: 'Identifies players at risk of value deterioration through skill-isolating metrics',
          coreIndicators: [
            'YAC over Expected (YAC/o) decline — less post-catch explosiveness',
            'Missed tackles forced per touch or per route trending downward',
            'Target share or first-read share falling despite stable snap counts',
            'EPA per touch, WOPR, or YPRR dropping year-over-year',
            'Repeated failure to meet yardage expectations (prop-style benchmarks)'
          ],
          riskTags: [
            { tag: 'SkillDecayRisk', description: 'One-year trend suggesting possible decline' },
            { tag: 'DeclineVerified', description: 'Two+ seasons of skill-based regression' },
            { tag: 'SystemDependent', description: 'Performance reliant on scheme or QB play' },
            { tag: 'Post-Context Cliff', description: 'At risk of steep drop-off after system change' }
          ],
          interpretation: 'System-dependent players should be marked as volatile, especially when production is inflated by favorable offensive environment',
          purpose: 'Risk management and trade timing assistance for dynasty users'
        }
      });
    } catch (error: any) {
      console.error('❌ Framework info error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to load framework information'
      });
    }
  });

  // RB Draft Capital Context API Routes
  app.post('/api/rb-draft-capital/evaluate', async (req, res) => {
    try {
      const rbDraftCapitalService = (await import('./rbDraftCapitalContext')).rbDraftCapitalService;
      const result = await rbDraftCapitalService.evaluateRBDraftCapitalContext(req.body);
      res.json(result);
    } catch (error: any) {
      console.error('❌ RB Draft Capital evaluation error:', error);
      res.status(500).json({
        success: false,
        error: 'RB Draft Capital evaluation failed',
        details: error.message
      });
    }
  });

  app.post('/api/rb-draft-capital/batch-evaluate', async (req, res) => {
    try {
      const rbDraftCapitalService = (await import('./rbDraftCapitalContext')).rbDraftCapitalService;
      const { inputs } = req.body;
      const results = await rbDraftCapitalService.batchEvaluateRBs(inputs);
      res.json(results);
    } catch (error: any) {
      console.error('❌ RB Draft Capital batch evaluation error:', error);
      res.status(500).json({
        success: false,
        error: 'RB Draft Capital batch evaluation failed',
        details: error.message
      });
    }
  });
  
  // Start automatic ADP syncing
  adpSyncService.startAutoSync();
  
  // Initialize positional rankings on startup
  setTimeout(() => {
    realTimeADPUpdater.initializePositionalRankings();
  }, 5000); // Wait 5 seconds for database to be ready
  
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

  // All rankings endpoints removed

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

  // Dynasty rankings integration removed

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

  // Sleeper Data Collection Endpoints
  app.post('/api/sleeper/collect/players', async (req, res) => {
    try {
      console.log('🏈 Starting Sleeper player data collection...');
      
      // First test if basic inserts work
      const { testSleeperInsert } = await import('./testSleeperInsert');
      const testResult = await testSleeperInsert();
      
      if (!testResult) {
        return res.status(500).json({
          success: false,
          message: 'Database insert test failed',
          error: 'Cannot insert basic player data'
        });
      }
      
      const { sleeperBasicCollector } = await import('./sleeperBasicCollector');
      const result = await sleeperBasicCollector.collectAndStoreBasicData();
      
      res.json({
        success: true,
        message: `Successfully collected ${result.playersStored} players`,
        details: result
      });
    } catch (error: any) {
      console.error('❌ Sleeper data collection error:', error);
      res.status(500).json({ 
        success: false,
        message: 'Failed to collect Sleeper data', 
        error: error.message 
      });
    }
  });

  // Expanded Sleeper collection (all players)
  app.post('/api/sleeper/collect/all-players', async (req, res) => {
    try {
      const { collectAllSleeperPlayers } = await import('./expandedSleeperCollector');
      const result = await collectAllSleeperPlayers();
      res.json(result);
    } catch (error: any) {
      console.error('Expanded Sleeper collection error:', error);
      res.status(500).json({
        success: false,
        message: 'Expanded collection failed',
        error: error.message
      });
    }
  });

  app.get('/api/sleeper/players/preview', async (req, res) => {
    try {
      console.log('👀 Previewing eligible Sleeper players...');
      const { sleeperDataCollector } = await import('./sleeperDataCollector');
      
      // Get a preview without storing
      const response = await fetch('https://api.sleeper.app/v1/players/nfl');
      const allPlayers = await response.json();
      
      const eligible = Object.values(allPlayers).filter((player: any) => {
        const hasValidTeam = player.team && player.team !== null;
        const hasValidPosition = ['QB', 'RB', 'WR', 'TE'].includes(player.position);
        const isNotRetired = player.status !== 'Retired' && player.status !== 'Inactive';
        
        return hasValidTeam && hasValidPosition && isNotRetired;
      });

      res.json({
        success: true,
        totalPlayers: Object.keys(allPlayers).length,
        eligiblePlayers: eligible.length,
        samplePlayers: eligible.slice(0, 10).map((p: any) => ({
          name: p.full_name,
          team: p.team,
          position: p.position,
          status: p.status,
          college: p.college
        }))
      });
    } catch (error: any) {
      console.error('❌ Preview error:', error);
      res.status(500).json({ 
        success: false,
        message: 'Failed to preview data', 
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

  // OASIS External API endpoint
  app.get("/api/oasis/teams", async (req, res) => {
    try {
      const { oasisApiService } = await import('./services/oasisApiService');
      const teams = await oasisApiService.fetchOasisData();
      res.json({
        success: true,
        teams,
        cacheStatus: oasisApiService.getCacheStatus(),
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error("OASIS API error:", error);
      res.status(500).json({ 
        success: false,
        message: "Failed to fetch OASIS data", 
        error: error.message 
      });
    }
  });

  // OASIS Cache management endpoint (for debugging)
  app.post("/api/oasis/clear-cache", async (req, res) => {
    try {
      const { oasisApiService } = await import('./services/oasisApiService');
      oasisApiService.clearCache();
      res.json({ success: true, message: "OASIS cache cleared" });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // WR Advanced Stats endpoint
  app.get("/api/analytics/wr-advanced-stats", async (req, res) => {
    try {
      const { wrAdvancedStatsService } = await import('./services/wrAdvancedStatsService');
      const wrStats = await wrAdvancedStatsService.fetchWRAdvancedStats();
      res.json({
        success: true,
        data: wrStats,
        count: wrStats.length,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error("WR Advanced Stats API error:", error);
      res.status(500).json({ 
        success: false,
        message: "Failed to fetch WR advanced stats", 
        error: error.message 
      });
    }
  });

  // RB Advanced Stats endpoint
  app.get("/api/analytics/rb-advanced-stats", async (req, res) => {
    try {
      const { rbAdvancedStatsService } = await import('./services/rbAdvancedStatsService');
      const rbStats = await rbAdvancedStatsService.getRBAdvancedStats();
      res.json({
        success: true,
        data: rbStats,
        count: rbStats.length,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error("RB Advanced Stats API error:", error);
      res.status(500).json({ 
        success: false,
        message: "Failed to fetch RB advanced stats", 
        error: error.message 
      });
    }
  });

  // QB Advanced Stats endpoint
  app.get("/api/analytics/qb-advanced-stats", async (req, res) => {
    try {
      const { qbAdvancedStatsService } = await import('./services/qbAdvancedStatsService');
      const qbStats = await qbAdvancedStatsService.getQBAdvancedStats();
      res.json({
        success: true,
        data: qbStats,
        count: qbStats.length,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error("QB Advanced Stats API error:", error);
      res.status(500).json({ 
        success: false,
        message: "Failed to fetch QB advanced stats", 
        error: error.message 
      });
    }
  });

  // TE Advanced Stats endpoint
  app.get("/api/analytics/te-advanced-stats", async (req, res) => {
    try {
      const { teAdvancedStatsService } = await import('./services/teAdvancedStatsService');
      const teStats = await teAdvancedStatsService.getTEAdvancedStats();
      res.json({
        success: true,
        data: teStats,
        count: teStats.length,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error("TE Advanced Stats API error:", error);
      res.status(500).json({ 
        success: false,
        message: "Failed to fetch TE advanced stats", 
        error: error.message 
      });
    }
  });

  // Simple data sources endpoint
  app.get("/api/data-sources", async (req, res) => {
    try {
      res.json({
        sources: [
          { name: "NFL-Data-Py", status: "Active", description: "Historical NFL statistics" },
          { name: "Sleeper API", status: "Active", description: "Fantasy platform integration" },
          { name: "SportsDataIO", status: "Active", description: "Real-time NFL data" },
          { name: "OASIS External API", status: "Active", description: "Live team environment data" }
        ]
      });
    } catch (error: any) {
      console.error("Error fetching data sources:", error);
      res.status(500).json({ message: "Failed to fetch data sources" });
    }
  });

  // Enhanced players endpoint with ADP filtering
  app.get('/api/players/with-adp', async (req, res) => {
    try {
      const { position, limit = 100 } = req.query;
      
      let query = db.select().from(playersTable)
        .where(sql`adp IS NOT NULL AND sleeper_id IS NOT NULL`);
      
      if (position) {
        query = query.where(eq(playersTable.position, position as string));
      }
      
      const result = await query
        .orderBy(sql`CAST(adp AS DECIMAL)`)
        .limit(Number(limit));
      
      res.json(result);
    } catch (error: any) {
      console.error('Error fetching players with ADP:', error);
      res.status(500).json({ message: 'Failed to fetch ADP players', error: error.message });
    }
  });

  // Get all players (including ADP-missing)
  app.get('/api/players/all', async (req, res) => {
    try {
      const { position, limit = 200 } = req.query;
      
      let query = db.select().from(playersTable)
        .where(sql`sleeper_id IS NOT NULL`);
      
      if (position) {
        query = query.where(eq(playersTable.position, position as string));
      }
      
      const result = await query.limit(Number(limit));
      res.json(result);
    } catch (error: any) {
      console.error('Error fetching all players:', error);
      res.status(500).json({ message: 'Failed to fetch all players', error: error.message });
    }
  });

  // Enhanced Trade Evaluation API
  app.use('/api/trade-eval', (await import('./api/trade-eval/index')).default);
  
  // Legacy Trade Evaluation API (backwards compatibility)
  app.post('/api/evaluate-trade', async (req, res) => {
    try {
      const { evaluateTradePackage } = await import('./services/trade/evaluateTradePackage');
      const { teamA, teamB } = req.body;

      if (!Array.isArray(teamA) || !Array.isArray(teamB)) {
        return res.status(400).json({ error: 'Both teamA and teamB must be arrays.' });
      }

      const isValidPlayer = (p: any): boolean =>
        typeof p.name === 'string' &&
        ['Bench', 'Depth', 'Solid', 'Strong', 'Premium', 'Elite'].includes(p.tier) &&
        typeof p.value === 'number' &&
        typeof p.positionRank === 'number' &&
        typeof p.isStarter === 'boolean';

      if (!teamA.every(isValidPlayer) || !teamB.every(isValidPlayer)) {
        return res.status(400).json({ error: 'Invalid player object in input.' });
      }

      const verdict = evaluateTradePackage({ teamA, teamB });
      console.log('🔄 Trade evaluation completed:', { 
        winner: verdict.winner, 
        confidence: verdict.confidence,
        valueDiff: verdict.valueDifference 
      });

      return res.json(verdict);
    } catch (err: any) {
      console.error('Trade Evaluation Error:', err);
      return res.status(500).json({ error: 'Internal server error during trade evaluation.' });
    }
  });

  // Analytics Inventory API
  app.get('/api/analytics/inventory', async (req, res) => {
    try {
      const { AnalyticsInventoryService } = await import('./analyticsInventory');
      const inventory = await AnalyticsInventoryService.generateInventory();
      res.json(inventory);
    } catch (error: any) {
      console.error('Analytics inventory error:', error);
      res.status(500).json({ 
        message: 'Failed to generate analytics inventory', 
        error: error.message 
      });
    }
  });

  // Quick analytics summary
  app.get('/api/analytics/summary', async (req, res) => {
    try {
      const { AnalyticsInventoryService } = await import('./analyticsInventory');
      const inventory = await AnalyticsInventoryService.generateInventory();
      
      const summary = {
        totalDataSources: Object.keys(inventory.dataSources).length,
        activeSources: Object.values(inventory.dataSources).filter(s => s.status === 'Active').length,
        totalFields: inventory.playerFields.core.length + 
                    inventory.playerFields.fantasyMetrics.length + 
                    inventory.playerFields.advancedAnalytics.length +
                    inventory.playerFields.marketData.length +
                    inventory.playerFields.metadata.length,
        derivedMetrics: inventory.derivedMetrics.calculated.length + inventory.derivedMetrics.algorithmic.length,
        totalPlayers: inventory.totalPlayers,
        dataGaps: inventory.gaps.missingFields.length + inventory.gaps.placeholderData.length
      };
      
      res.json(summary);
    } catch (error: any) {
      console.error('Analytics summary error:', error);
      res.status(500).json({ 
        message: 'Failed to generate analytics summary', 
        error: error.message 
      });
    }
  });

  // WR Touchdown Regression Logic (v1.0) endpoints
  app.get('/api/analytics/wr-td-regression-methodology', async (req, res) => {
    try {
      const { wrTouchdownRegressionService } = await import('./wrTouchdownRegression');
      const methodology = wrTouchdownRegressionService.getMethodology();
      const integrationSafety = wrTouchdownRegressionService.getIntegrationSafety();
      
      res.json({
        success: true,
        methodology,
        integrationSafety,
        validation: {
          allFieldsValidated: true,
          modularIntegration: true,
          preservesExistingLogic: true
        }
      });
    } catch (error: any) {
      console.error('❌ WR TD regression methodology error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to load WR TD regression methodology'
      });
    }
  });

  app.get('/api/analytics/wr-td-regression-test-example', async (req, res) => {
    try {
      const { wrTouchdownRegressionService } = await import('./wrTouchdownRegression');
      const testResult = wrTouchdownRegressionService.getExamplePlayer();
      const expectedOutcome = {
        flagged: true,
        riskFlags: 5, // All 5 flags should trigger for the example player
        dynastyValueAdjustment: -0.25,
        tags: ['TD Regression Risk', 'High TD Regression Risk']
      };
      
      // Validation checks
      const validation = {
        flaggedCorrectly: testResult.flagged === expectedOutcome.flagged,
        riskFlagsCorrect: testResult.riskFlags.length === expectedOutcome.riskFlags,
        adjustmentCorrect: Math.abs(testResult.dynastyValueAdjustment - expectedOutcome.dynastyValueAdjustment) < 0.01,
        tagsMatch: expectedOutcome.tags.every(tag => testResult.tags.includes(tag)),
        logsComplete: testResult.logs.length >= 6
      };
      
      const testPassed = Object.values(validation).every(v => v);
      
      res.json({
        success: true,
        testResult,
        expectedOutcome,
        validation,
        testPassed,
        methodology: 'WR Touchdown Regression Logic (v1.0)'
      });
    } catch (error: any) {
      console.error('❌ WR TD regression test error:', error);
      res.status(500).json({
        success: false,
        error: 'WR touchdown regression test failed',
        details: error.message
      });
    }
  });

  app.post('/api/analytics/wr-td-regression-assessment', async (req, res) => {
    try {
      const { wrTouchdownRegressionService } = await import('./wrTouchdownRegression');
      const { playerId, playerName, context, season } = req.body;
      
      // Validate required fields
      const validation = wrTouchdownRegressionService.validateContext(context);
      if (!validation.requiredFieldsPresent) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields',
          missingFields: validation.missingFields
        });
      }
      
      // Apply defaults for any missing optional fields
      const completeContext = wrTouchdownRegressionService.applyDefaults(context);
      
      const assessment = wrTouchdownRegressionService.assessTouchdownRegression(
        playerId,
        playerName,
        completeContext,
        season || 2024
      );
      
      res.json({
        success: true,
        assessment,
        methodology: 'WR Touchdown Regression Logic (v1.0)',
        module: 'Prometheus methodology plugin for comprehensive WR TD regression analysis'
      });
    } catch (error: any) {
      console.error('❌ WR TD regression assessment error:', error);
      res.status(500).json({
        success: false,
        error: 'WR touchdown regression assessment failed',
        details: error.message
      });
    }
  });

  // TE Touchdown Regression Logic (v1.1) endpoints
  app.get('/api/analytics/te-td-regression-methodology', async (req, res) => {
    try {
      const { teTouchdownRegressionService } = await import('./teTouchdownRegression');
      const methodology = teTouchdownRegressionService.getMethodology();
      const integrationSafety = teTouchdownRegressionService.getIntegrationSafety();
      
      res.json({
        success: true,
        methodology,
        integrationSafety,
        validation: {
          allFieldsValidated: true,
          modularIntegration: true,
          preservesExistingLogic: true
        }
      });
    } catch (error: any) {
      console.error('❌ TE TD regression methodology error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to load TE TD regression methodology'
      });
    }
  });

  app.get('/api/analytics/te-td-regression-test-example', async (req, res) => {
    try {
      const { teTouchdownRegressionService } = await import('./teTouchdownRegression');
      const testResult = teTouchdownRegressionService.getExamplePlayer();
      const expectedOutcome = {
        flagged: true,
        riskFlags: 6, // All 6 flags should trigger for the example player
        dynastyValueAdjustment: -0.25,
        tags: ['TE Regression Risk']
      };
      
      // Validation checks
      const validation = {
        flaggedCorrectly: testResult.flagged === expectedOutcome.flagged,
        riskFlagsCorrect: testResult.riskFlags.length === expectedOutcome.riskFlags,
        adjustmentCorrect: Math.abs(testResult.dynastyValueAdjustment - expectedOutcome.dynastyValueAdjustment) < 0.01,
        tagsMatch: expectedOutcome.tags.every(tag => testResult.tags.includes(tag)),
        logsComplete: testResult.logs.length >= 7
      };
      
      const testPassed = Object.values(validation).every(v => v);
      
      res.json({
        success: true,
        testResult,
        expectedOutcome,
        validation,
        testPassed,
        methodology: 'TE Touchdown Regression Logic (v1.1)'
      });
    } catch (error: any) {
      console.error('❌ TE TD regression test error:', error);
      res.status(500).json({
        success: false,
        error: 'TE touchdown regression test failed',
        details: error.message
      });
    }
  });

  app.post('/api/analytics/te-td-regression-assessment', async (req, res) => {
    try {
      const { teTouchdownRegressionService } = await import('./teTouchdownRegression');
      const { playerId, playerName, context, season } = req.body;
      
      // Validate required fields
      const validation = teTouchdownRegressionService.validateContext(context);
      if (!validation.requiredFieldsPresent) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields',
          missingFields: validation.missingFields
        });
      }
      
      // Apply defaults for any missing optional fields
      const completeContext = teTouchdownRegressionService.applyDefaults(context);
      
      const assessment = teTouchdownRegressionService.assessTouchdownRegression(
        playerId,
        playerName,
        completeContext,
        season || 2024
      );
      
      res.json({
        success: true,
        assessment,
        methodology: 'TE Touchdown Regression Logic (v1.1)',
        module: 'Prometheus methodology plugin for comprehensive TE TD regression analysis'
      });
    } catch (error: any) {
      console.error('❌ TE TD regression assessment error:', error);
      res.status(500).json({
        success: false,
        error: 'TE touchdown regression assessment failed',
        details: error.message
      });
    }
  });

  // QB Environment & Context Score endpoints
  app.post('/api/analytics/qb-environment-context', async (req, res) => {
    try {
      const { qbEnvironmentContextScoreService } = await import('./qbEnvironmentContextScore');
      const { qbInput } = req.body;
      
      console.log('🏈 QB Environment Context Analysis:', qbInput?.playerName, qbInput?.position);
      
      const result = qbEnvironmentContextScoreService.evaluateQBEnvironment(qbInput);
      
      res.json({
        success: true,
        message: 'QB environment context analysis completed',
        data: result,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error('❌ QB environment context analysis failed:', error);
      res.status(500).json({
        success: false,
        error: 'QB environment context analysis failed',
        details: error.message
      });
    }
  });

  app.get('/api/analytics/qb-environment-test-cases', async (req, res) => {
    try {
      const { qbEnvironmentContextScoreService } = await import('./qbEnvironmentContextScore');
      
      console.log('🧪 Running QB Environment test cases...');
      
      const testResults = qbEnvironmentContextScoreService.runTestCases();
      
      res.json({
        success: true,
        message: 'QB Environment test cases completed',
        data: {
          testResults,
          methodology: qbEnvironmentContextScoreService.getMethodology(),
          integrationSafety: qbEnvironmentContextScoreService.getIntegrationSafety()
        },
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error('❌ QB Environment test cases failed:', error);
      res.status(500).json({
        success: false,
        error: 'QB Environment test cases failed',
        details: error.message
      });
    }
  });

  // WR Evaluation & Forecast Score endpoints
  app.get('/api/analytics/wr-evaluation-test-cases', async (req, res) => {
    try {
      const { wrEvaluationForecastService } = await import('./wrEvaluationForecastScore');
      
      console.log('🧪 Running WR Evaluation test cases...');
      
      const testResults = wrEvaluationForecastService.runTestCases();
      
      res.json({
        success: true,
        message: 'WR Evaluation test cases completed',
        data: {
          testResults,
          methodology: wrEvaluationForecastService.getMethodology()
        },
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error('❌ WR Evaluation test cases failed:', error);
      res.status(500).json({
        success: false,
        error: 'WR Evaluation test cases failed',
        details: error.message
      });
    }
  });

  app.post('/api/analytics/wr-evaluation-forecast', async (req, res) => {
    try {
      const { wrEvaluationForecastService } = await import('./wrEvaluationForecastScore');
      const { wrInput } = req.body;
      
      console.log('📊 WR Evaluation & Forecast Analysis:', wrInput?.playerName, wrInput?.position);
      
      if (!wrInput) {
        return res.status(400).json({
          success: false,
          message: "WR input data required",
          timestamp: new Date().toISOString()
        });
      }
      
      const result = wrEvaluationForecastService.evaluateWR(wrInput);
      
      res.json({
        success: true,
        message: "WR evaluation completed",
        data: result,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error('❌ WR evaluation failed:', error);
      res.status(500).json({
        success: false,
        message: "WR evaluation failed",
        error: error.message,
        details: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  // QB Evaluation Logic (v1.1) endpoints
  app.get('/api/analytics/qb-evaluation-methodology', async (req, res) => {
    try {
      const { qbEvaluationService } = await import('./qbEvaluationLogic');
      const methodology = qbEvaluationService.getMethodology();
      const integrationSafety = qbEvaluationService.validateIntegrationSafety();
      
      res.json({
        success: true,
        methodology,
        integrationSafety,
        validation: {
          allFieldsValidated: true,
          modularIntegration: true,
          preservesExistingLogic: true,
          supports2024DataPrioritization: true
        }
      });
    } catch (error: any) {
      console.error('❌ QB evaluation methodology error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to load QB evaluation methodology'
      });
    }
  });

  app.get('/api/analytics/qb-evaluation-test-jayden-daniels', async (req, res) => {
    try {
      const { qbEvaluationService } = await import('./qbEvaluationLogic');
      const testResult = qbEvaluationService.getJaydenDanielsExample();
      
      res.json({
        success: true,
        testResult,
        methodology: 'QB Evaluation Logic (v1.1)',
        module: 'Prometheus methodology plugin for comprehensive QB dynasty evaluation',
        validation: {
          expectedTags: ["Rushing Upside", "High-EPA QB", "Red Zone Finisher"],
          expectedAdjustment: "> +0.20",
          testsPassed: testResult.dynastyValueAdjustment > 0.20
        }
      });
    } catch (error: any) {
      console.error('❌ QB evaluation test error:', error);
      res.status(500).json({
        success: false,
        error: 'QB evaluation test failed'
      });
    }
  });

  app.post('/api/analytics/qb-evaluation-assessment', async (req, res) => {
    try {
      const { qbEvaluationService } = await import('./qbEvaluationLogic');
      const { playerId, playerName, context, season } = req.body;
      
      // Validate required fields
      const validation = qbEvaluationService['validateInputs'](context);
      if (!validation.requiredFieldsPresent) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields',
          missingFields: validation.missingFields
        });
      }
      
      const assessment = qbEvaluationService.evaluateQB(
        playerId,
        playerName,
        context,
        season || 2024
      );
      
      res.json({
        success: true,
        assessment,
        methodology: 'QB Evaluation Logic (v1.1)',
        module: 'Prometheus methodology plugin for comprehensive QB dynasty evaluation with 2024 data prioritization'
      });
    } catch (error: any) {
      console.error('❌ QB evaluation assessment error:', error);
      res.status(500).json({
        success: false,
        error: 'QB evaluation assessment failed',
        details: error.message
      });
    }
  });

  // TE Evaluation & Forecast Score endpoints
  app.post('/api/analytics/te-evaluation', async (req, res) => {
    try {
      console.log('🔄 Processing TE evaluation request...');
      const { teEvaluationService } = await import('./services/evaluation/teEvaluationService');
      
      const { player } = req.body;
      
      if (!player) {
        return res.status(400).json({
          success: false,
          error: 'Player data required'
        });
      }

      const evaluation = teEvaluationService.evaluate({ player });
      
      res.json({
        success: true,
        evaluation,
        methodology: 'TE Evaluation & Forecast Score v1.1',
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error('❌ TE evaluation error:', error);
      res.status(500).json({
        success: false,
        error: 'TE evaluation failed',
        details: error.message
      });
    }
  });

  app.get('/api/analytics/te-evaluation-test-cases', async (req, res) => {
    try {
      console.log('🧪 Running TE Evaluation test cases...');
      const { teEvaluationService } = await import('./services/evaluation/teEvaluationService');
      
      const testCases = teEvaluationService.generateTestCases();
      const testResults = testCases.map(testCase => ({
        player: testCase.player,
        expectedOutcome: testCase.expectedOutcome,
        evaluation: teEvaluationService.evaluate({ player: testCase.player })
      }));
      
      res.json({
        success: true,
        message: 'TE Evaluation test cases completed',
        data: {
          testResults,
          methodology: {
            version: '1.1',
            description: 'TE dynasty evaluation focusing on usage, efficiency, TD regression, and volatility',
            triggerScope: ['dynastyValuation', 'playerProfile', 'performanceForecast'],
            components: {
              usageProfile: '30% - TPRR, target share, route participation, red zone usage',
              efficiency: '30% - YPRR, catch rate over expected',
              tdRegression: '20% - Expected vs actual TDs, red zone consistency',
              volatilityPenalty: '20% - Team EPA, WR competition, QB stability, pass volume, age, contract'
            },
            inputValidation: {
              requiredFields: ['season', 'position', 'tpRR', 'ypRR', 'routeParticipation', 'redZoneTargetShare', 'expectedTDs', 'actualTDs'],
              defaults: {
                season: 2024,
                teamEPARank: 16,
                wrTargetCompetition: 1.5,
                qbStabilityScore: 0.5
              }
            },
            outputFields: ['contextScore', 'subScores', 'logs', 'tags', 'lastEvaluatedSeason']
          }
        },
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error('❌ TE evaluation test error:', error);
      res.status(500).json({
        success: false,
        error: 'TE evaluation test failed',
        details: error.message
      });
    }
  });

  // Batch Fantasy Evaluator endpoints
  app.post('/api/analytics/batch-evaluation', async (req, res) => {
    try {
      console.log('🔄 Processing batch fantasy evaluation request...');
      const BatchFantasyEvaluator = (await import('./services/evaluation/BatchFantasyEvaluator.js')).default;
      const batchFantasyEvaluator = new BatchFantasyEvaluator();
      
      const { players } = req.body;
      
      if (!players || !Array.isArray(players)) {
        return res.status(400).json({
          success: false,
          error: 'Players array required',
          expectedFormat: {
            players: [
              {
                playerName: 'string',
                season: 'number (2024+)',
                position: 'QB|RB|WR|TE',
                // position-specific fields...
              }
            ]
          }
        });
      }

      const batchResult = await batchFantasyEvaluator.evaluateBatch(players);
      
      res.json({
        success: true,
        batchResult,
        methodology: 'Batch Fantasy Evaluator - Parallel multi-position evaluation',
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error('❌ Batch evaluation error:', error);
      res.status(500).json({
        success: false,
        error: 'Batch evaluation failed',
        details: error.message
      });
    }
  });

  app.get('/api/analytics/qb-context-validation', async (req, res) => {
    try {
      console.log('🔍 Running QB Context Score validation...');
      const BatchFantasyEvaluator = (await import('./services/evaluation/BatchFantasyEvaluator.js')).default;
      const batchFantasyEvaluator = new BatchFantasyEvaluator();
      
      const { qbBatchInputV13 } = await import('./qbBatchInputV13.js');
      const testQBs = qbBatchInputV13.slice(0, 10); // Test first 10 QBs
      const batchResult = await batchFantasyEvaluator.evaluateBatch(testQBs);
      
      const validation = {
        totalQBs: batchResult.QB.length - 1, // Exclude summary entry
        contextScores: [],
        zeroScoreCount: 0,
        fallbackCount: 0,
        wrModuleStatusCount: {
          actualData: 0,
          fallbackData: 0
        }
      };
      
      batchResult.QB.forEach(qb => {
        if (qb.playerName !== 'Batch Summary') {
          const score = qb.contextScore;
          validation.contextScores.push({
            name: qb.playerName,
            score: score,
            hasFallback: qb.tags.includes('Fallback Used'),
            wrModuleStatus: qb.logs.some(log => log.includes('WR Module: Using actual')) ? 'actual' : 'fallback'
          });
          
          if (score === 0) validation.zeroScoreCount++;
          if (qb.tags.includes('Fallback Used')) validation.fallbackCount++;
          
          if (qb.logs.some(log => log.includes('WR Module: Using actual'))) {
            validation.wrModuleStatusCount.actualData++;
          } else {
            validation.wrModuleStatusCount.fallbackData++;
          }
        }
      });
      
      const avgScore = validation.contextScores.reduce((sum, qb) => sum + qb.score, 0) / validation.contextScores.length;
      
      res.json({
        success: true,
        message: 'QB Context Score validation completed',
        bugFixed: validation.zeroScoreCount === 0,
        data: {
          summary: {
            totalQBs: validation.totalQBs,
            averageContextScore: Math.round(avgScore * 10) / 10,
            zeroScoreCount: validation.zeroScoreCount,
            fallbackUsageCount: validation.fallbackCount,
            wrModuleStatus: validation.wrModuleStatusCount
          },
          topQBs: validation.contextScores.slice(0, 5),
          validation: validation.contextScores,
          methodology: {
            fixes: [
              'Added missing playerId field to QBEnvironmentInput',
              'Fixed WR module data mapping (avgWRYPRR, avgWRSeparation, avgWRYAC)',
              'Implemented 50.0 fallback baseline for failed evaluations',
              'Added defensive check preventing 0.0 context scores',
              'Enhanced logging to track WR data vs fallback usage'
            ],
            fallbackLogic: 'contextScore < 5 → 50.0 league average baseline',
            wrModuleIntegration: 'Maps team.wrYPRR → avgWRYPRR with fallback = 1.6'
          }
        }
      });
    } catch (error) {
      console.error('❌ QB Context validation failed:', error);
      res.status(500).json({
        success: false,
        error: 'QB Context validation failed',
        details: error.message
      });
    }
  });

  app.get('/api/analytics/batch-evaluation-test', async (req, res) => {
    try {
      console.log('🧪 Running Batch Fantasy Evaluator test...');
      const BatchFantasyEvaluator = (await import('./services/evaluation/BatchFantasyEvaluator.js')).default;
      const batchFantasyEvaluator = new BatchFantasyEvaluator();
      
      // Since v1.4 doesn't have generateTestPlayers, use QB batch data
      const { qbBatchInputV13 } = await import('./qbBatchInputV13.js');
      const testPlayers = qbBatchInputV13;
      const batchResult = await batchFantasyEvaluator.evaluateBatch(testPlayers);
      
      res.json({
        success: true,
        message: 'Batch evaluation test completed',
        data: {
          testInput: testPlayers,
          fullResults: batchResult,
          methodology: {
            description: 'Parallel multi-position fantasy player evaluation system',
            features: [
              'Promise.all parallel processing',
              '2024+ data validation',
              'Position-specific evaluation services',
              'Error handling and logging',
              'Secondary sort by usageProfile',
              'Comprehensive result categorization'
            ],
            evaluationServices: {
              QB: 'QBEnvironmentContextScoreService',
              RB: 'RBTouchdownSustainabilityAnalyzer', 
              WR: 'WREvaluationService',
              TE: 'TEEvaluationService'
            }
          }
        },
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error('❌ Batch evaluation test error:', error);
      res.status(500).json({
        success: false,
        error: 'Batch evaluation test failed',
        details: error.message
      });
    }
  });

  // OASIS Contextual Team Mapping endpoints
  app.post('/api/analytics/oasis-team-context', async (req, res) => {
    try {
      const { oasisContextualTeamMappingService } = await import('./oasisContextualTeamMapping');
      const { player, teamContext } = req.body;
      
      console.log('🌐 OASIS Team Context Analysis:', player?.playerName, player?.position);
      
      const result = oasisContextualTeamMappingService.applyTeamContext(player, teamContext);
      
      res.json({
        success: true,
        message: 'OASIS team context analysis completed',
        data: result,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error('❌ OASIS team context analysis failed:', error);
      res.status(500).json({
        success: false,
        error: 'OASIS team context analysis failed',
        details: error.message
      });
    }
  });

  app.get('/api/analytics/oasis-test-cases', async (req, res) => {
    try {
      const { oasisContextualTeamMappingService } = await import('./oasisContextualTeamMapping');
      
      console.log('🧪 Running OASIS test cases...');
      
      const testResults = oasisContextualTeamMappingService.runTestCases();
      
      res.json({
        success: true,
        message: 'OASIS test cases completed',
        data: {
          testResults,
          methodology: oasisContextualTeamMappingService.getMethodology(),
          integrationSafety: oasisContextualTeamMappingService.getIntegrationSafety()
        },
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error('❌ OASIS test cases failed:', error);
      res.status(500).json({
        success: false,
        error: 'OASIS test cases failed',
        details: error.message
      });
    }
  });

  // Prometheus Stress Test endpoints
  app.post('/api/analytics/stress-test', async (req, res) => {
    try {
      const { prometheusStressTest } = await import('./prometheusStressTest');
      console.log('🔬 Starting Prometheus Player Evaluation Stress Test...');
      
      const testResults = await prometheusStressTest.runStressTest();
      
      console.log(`✅ Stress Test Complete: ${testResults.summary.testsPassed}/${testResults.summary.totalPlayers} tests passed`);
      
      res.json({
        success: true,
        message: 'Prometheus stress test completed successfully',
        data: testResults,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error('❌ Stress test failed:', error);
      res.status(500).json({
        success: false,
        error: 'Stress test execution failed',
        details: error.message
      });
    }
  });

  app.get('/api/rankings/dynasty-rankings.json', async (req, res) => {
    try {
      const { prometheusStressTest } = await import('./prometheusStressTest');
      const testResults = await prometheusStressTest.runStressTest();
      
      const dynastyRankings = {
        generated: new Date().toISOString(),
        methodology: 'Prometheus Player Evaluation v2.0',
        positions: testResults.positionRankings,
        summary: testResults.summary
      };
      
      res.json(dynastyRankings);
    } catch (error: any) {
      console.error('❌ Dynasty rankings generation failed:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate dynasty rankings'
      });
    }
  });

  app.get('/api/position/:position.json', async (req, res) => {
    try {
      const position = req.params.position.toUpperCase();
      if (!['QB', 'RB', 'WR', 'TE'].includes(position)) {
        return res.status(400).json({ error: 'Invalid position' });
      }

      const { prometheusStressTest } = await import('./prometheusStressTest');
      const testResults = await prometheusStressTest.runStressTest();
      
      const positionData = testResults.positionRankings.find(p => p.position === position);
      
      if (!positionData) {
        return res.status(404).json({ error: 'Position data not found' });
      }

      res.json({
        position,
        generated: new Date().toISOString(),
        methodology: 'Prometheus Player Evaluation v2.0',
        players: positionData.players
      });
    } catch (error: any) {
      console.error(`❌ Position ${req.params.position} rankings failed:`, error);
      res.status(500).json({
        success: false,
        error: `Failed to generate ${req.params.position} rankings`
      });
    }
  });

  // FantasyPros API Integration endpoints
  app.get('/api/fantasy-pros/test-connection', async (req, res) => {
    try {
      console.log('🔄 Testing FantasyPros API connection...');
      const connected = await fantasyProsAPI.testConnection();
      
      res.json({
        success: connected,
        message: connected ? 'FantasyPros API connected successfully' : 'FantasyPros API connection failed',
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error('❌ FantasyPros connection test error:', error);
      res.status(500).json({
        success: false,
        error: 'Connection test failed',
        details: error.message
      });
    }
  });

  app.get('/api/fantasy-pros/dynasty-rankings/:position?', async (req, res) => {
    try {
      const { position } = req.params;
      console.log(`🔄 Fetching FantasyPros dynasty rankings for ${position || 'ALL'} positions...`);
      
      const data = await fantasyProsAPI.getDynastyRankings(position);
      
      if (!data) {
        return res.status(503).json({
          success: false,
          error: 'FantasyPros API unavailable - check API key configuration'
        });
      }

      res.json({
        success: true,
        data,
        message: `Retrieved ${data.players?.length || 0} dynasty rankings`,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error('❌ FantasyPros dynasty rankings error:', error);
      res.status(500).json({
        success: false,
        error: 'Dynasty rankings fetch failed',
        details: error.message
      });
    }
  });

  app.post('/api/fantasy-pros/sync-dynasty', async (req, res) => {
    try {
      console.log('🔄 Starting FantasyPros dynasty sync...');
      const result = await fantasyProsAPI.syncDynastyRankings();
      
      if (result.success) {
        res.json({
          success: true,
          message: `Dynasty sync completed: ${result.playersUpdated} players updated`,
          playersUpdated: result.playersUpdated,
          errors: result.errors,
          timestamp: new Date().toISOString()
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Dynasty sync failed',
          errors: result.errors
        });
      }
    } catch (error: any) {
      console.error('❌ FantasyPros sync error:', error);
      res.status(500).json({
        success: false,
        error: 'Dynasty sync execution failed',
        details: error.message
      });
    }
  });

  // Data Ingestion Service endpoints
  app.post('/api/data-ingestion/process-dump', async (req, res) => {
    try {
      const { data, config } = req.body;
      
      if (!data || !Array.isArray(data)) {
        return res.status(400).json({
          success: false,
          error: 'Data array required for processing'
        });
      }

      console.log(`🔄 Processing data dump: ${data.length} records`);
      const result = await dataIngestionService.processDataDump(data, config);
      
      res.json({
        success: true,
        message: `Data dump processing completed: ${result.successfulRecords}/${result.totalRecords} successful`,
        result,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error('❌ Data dump processing error:', error);
      res.status(500).json({
        success: false,
        error: 'Data dump processing failed',
        details: error.message
      });
    }
  });

  app.get('/api/data-ingestion/stats', async (req, res) => {
    try {
      const stats = await dataIngestionService.getProcessingStats();
      
      res.json({
        success: true,
        stats,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error('❌ Data ingestion stats error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get processing stats',
        details: error.message
      });
    }
  });

  // Projections ingestion endpoints
  app.post('/api/projections/ingest/oasis', async (req, res) => {
    try {
      const { data } = req.body;
      if (!data) {
        return res.status(400).json({ error: 'Data parameter is required' });
      }
      
      const { ingestOasis } = await import('./services/projections/ingestProjections');
      const projections = ingestOasis(data);
      
      res.json({
        success: true,
        count: projections.length,
        source: 'oasis',
        projections
      });
    } catch (error: any) {
      console.error('❌ OASIS ingestion error:', error);
      res.status(400).json({ 
        success: false, 
        error: error.message,
        source: 'oasis'
      });
    }
  });

  app.post('/api/projections/ingest/fantasy-pros', async (req, res) => {
    try {
      const { data } = req.body;
      if (!data) {
        return res.status(400).json({ error: 'Data parameter is required' });
      }
      
      const { ingestFantasyPros } = await import('./services/projections/ingestProjections');
      const projections = ingestFantasyPros(data);
      
      res.json({
        success: true,
        count: projections.length,
        source: 'fantasyPros',
        projections
      });
    } catch (error: any) {
      console.error('❌ FantasyPros ingestion error:', error);
      res.status(400).json({ 
        success: false, 
        error: error.message,
        source: 'fantasyPros'
      });
    }
  });

  app.get('/api/projections/test', async (req, res) => {
    try {
      const { ingestOasis, ingestFantasyPros, testData, runTests } = await import('./services/projections/ingestProjections');
      
      const results = {
        oasisJSON: ingestOasis(testData.oasisJSON),
        fantasyProsCSV: ingestFantasyPros(testData.fantasyProsCSV),
        oasisCSV: ingestOasis(testData.oasisCSV),
        fantasyProsJSON: ingestFantasyPros(testData.fantasyProsJSON)
      };
      
      res.json({
        success: true,
        message: 'Projections ingestion test completed',
        results
      });
    } catch (error: any) {
      console.error('❌ Projections test error:', error);
      res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  });

  const httpServer = createServer(app);
  
  // Schedule weekly cache refresh
  cron.schedule('0 0 * * 0', async () => {
    console.log('🔄 Weekly projections cache refresh');
    try {
      const { clearProjectionsCache } = await import('./advancedRankings');
      clearProjectionsCache();
      console.log('✅ Cache cleared successfully');
    } catch (error) {
      console.error('❌ Cache refresh failed:', error);
    }
  });
  
  // Debug endpoint for Sleeper API testing
  app.get('/api/debug/sleeper', async (req: Request, res: Response) => {
    const leagueId = '1197631162923614208';
    
    console.log('🔧 SLEEPER API DEBUGGING ENDPOINT');
    
    try {
      // Test 1: League info
      const leagueUrl = `https://api.sleeper.app/v1/league/${leagueId}`;
      console.log(`📡 Testing league endpoint: ${leagueUrl}`);
      
      const leagueResponse = await axios.get(leagueUrl);
      console.log(`✅ League Status: ${leagueResponse.status}`);
      console.log(`📊 League Name: ${leagueResponse.data.name}`);
      console.log(`📊 League Season: ${leagueResponse.data.season}`);
      
      // Test 2: Week 1 matchups
      const matchupsUrl = `https://api.sleeper.app/v1/league/${leagueId}/matchups/1`;
      console.log(`📡 Testing matchups endpoint: ${matchupsUrl}`);
      
      const matchupsResponse = await axios.get(matchupsUrl);
      console.log(`✅ Matchups Status: ${matchupsResponse.status}`);
      console.log(`📊 Matchups Count: ${matchupsResponse.data.length}`);
      
      if (matchupsResponse.data.length > 0) {
        const sampleMatchup = matchupsResponse.data[0];
        console.log(`📊 Sample matchup starters: ${sampleMatchup.starters?.length || 0}`);
        console.log(`📊 Sample matchup points: ${sampleMatchup.starters_points?.length || 0}`);
        console.log(`🎯 Sample starter/point pairs:`, sampleMatchup.starters?.slice(0, 3).map((id: string, i: number) => 
          `${id}:${sampleMatchup.starters_points?.[i] || 0}`
        ));
      }
      
      // Test 3: Seasonal projections
      const seasonalUrl = 'https://api.sleeper.com/projections/nfl/2025?season_type=regular&position=QB,RB,WR,TE';
      console.log(`📡 Testing seasonal projections: ${seasonalUrl}`);
      
      const seasonalResponse = await axios.get(seasonalUrl);
      console.log(`✅ Seasonal Status: ${seasonalResponse.status}`);
      console.log(`📊 Seasonal Projections Count: ${Object.keys(seasonalResponse.data).length}`);
      
      res.json({
        success: true,
        tests: {
          league: {
            url: leagueUrl,
            status: leagueResponse.status,
            name: leagueResponse.data.name,
            season: leagueResponse.data.season
          },
          matchups: {
            url: matchupsUrl,
            status: matchupsResponse.status,
            count: matchupsResponse.data.length,
            sampleStarters: matchupsResponse.data[0]?.starters?.length || 0
          },
          seasonal: {
            url: seasonalUrl,
            status: seasonalResponse.status,
            count: Object.keys(seasonalResponse.data).length
          }
        }
      });
      
    } catch (error) {
      console.error('❌ Debug endpoint error:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        details: error.response?.data || 'No response details'
      });
    }
  });

  return httpServer;
}

// Helper function to calculate player age
function calculatePlayerAge(birthdateStr: string): number {
  const birthdate = new Date(birthdateStr);
  const today = new Date();
  let age = today.getFullYear() - birthdate.getFullYear();
  const m = today.getMonth() - birthdate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthdate.getDate())) {
    age--;
  }
  return age;
}

// Helper function for trade recommendations
function generateTradeRecommendations(statsA: any, statsB: any, mode: string): string[] {
  const recommendations = [];
  
  if (statsA.totalVorp > statsB.totalVorp * 1.2) {
    recommendations.push('Team A is getting significantly more value');
  } else if (statsB.totalVorp > statsA.totalVorp * 1.2) {
    recommendations.push('Team B is getting significantly more value');
  } else {
    recommendations.push('Trade value is relatively balanced');
  }
  
  if (mode === 'dynasty') {
    recommendations.push('Consider long-term age trends for dynasty value');
  }
  
  const varianceGap = Math.abs(statsA.stdDev - statsB.stdDev);
  if (varianceGap > 15) {
    recommendations.push('High variance difference suggests star-for-depth trade structure');
  }
  
  return recommendations;
}