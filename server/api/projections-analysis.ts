import type { Express } from "express";
import axios from 'axios';
import { SLEEPER_API_SOURCES } from '../services/projections/sleeperProjectionsService';

export function registerProjectionsAnalysisRoutes(app: Express) {
  // Compare league-specific vs base projections
  app.get('/api/projections/compare/:league_id?', async (req, res) => {
    try {
      const { league_id } = req.params;
      const { week = '11' } = req.query;
      
      console.log('🔍 Investigating projection sources...');
      
      const results: any = {
        timestamp: new Date().toISOString(),
        sources_tested: {},
        comparison_summary: {},
        recommendations: []
      };
      
      // Test 1: Base season projections (what we currently use)
      try {
        console.log(`📡 Testing base projections: ${SLEEPER_API_SOURCES.BASE_PROJECTIONS}`);
        const baseResponse = await axios.get(SLEEPER_API_SOURCES.BASE_PROJECTIONS, { timeout: 10000 });
        results.sources_tested.base_projections = {
          url: SLEEPER_API_SOURCES.BASE_PROJECTIONS,
          status: baseResponse.status,
          data_type: Array.isArray(baseResponse.data) ? 'array' : 'object',
          count: Array.isArray(baseResponse.data) ? baseResponse.data.length : Object.keys(baseResponse.data || {}).length,
          sample: Array.isArray(baseResponse.data) ? baseResponse.data[0] : Object.entries(baseResponse.data || {})[0]
        };
      } catch (error: any) {
        results.sources_tested.base_projections = {
          url: SLEEPER_API_SOURCES.BASE_PROJECTIONS,
          error: error.message,
          status: 'failed'
        };
      }
      
      // Test 2: Weekly projections 
      try {
        const weeklyUrl = SLEEPER_API_SOURCES.WEEKLY_PROJECTIONS.replace('{{week}}', week as string);
        console.log(`📡 Testing weekly projections: ${weeklyUrl}`);
        const weeklyResponse = await axios.get(weeklyUrl, { timeout: 10000 });
        results.sources_tested.weekly_projections = {
          url: weeklyUrl,
          status: weeklyResponse.status,
          data_type: Array.isArray(weeklyResponse.data) ? 'array' : 'object',
          count: Array.isArray(weeklyResponse.data) ? weeklyResponse.data.length : Object.keys(weeklyResponse.data || {}).length,
          sample: Array.isArray(weeklyResponse.data) ? weeklyResponse.data[0] : Object.entries(weeklyResponse.data || {})[0]
        };
      } catch (error: any) {
        results.sources_tested.weekly_projections = {
          url: SLEEPER_API_SOURCES.WEEKLY_PROJECTIONS.replace('{{week}}', week as string),
          error: error.message,
          status: 'failed'
        };
      }
      
      // Test 3: League-specific matchups (if league_id provided)
      if (league_id) {
        try {
          const matchupUrl = SLEEPER_API_SOURCES.LEAGUE_MATCHUPS.replace('{{league_id}}', league_id).replace('{{week}}', week as string);
          console.log(`📡 Testing league matchups: ${matchupUrl}`);
          const matchupResponse = await axios.get(matchupUrl, { timeout: 10000 });
          results.sources_tested.league_matchups = {
            url: matchupUrl,
            status: matchupResponse.status,
            data_type: Array.isArray(matchupResponse.data) ? 'array' : 'object',
            count: Array.isArray(matchupResponse.data) ? matchupResponse.data.length : Object.keys(matchupResponse.data || {}).length,
            sample: Array.isArray(matchupResponse.data) ? matchupResponse.data[0] : Object.entries(matchupResponse.data || {})[0]
          };
          
          // Test league settings
          const leagueUrl = SLEEPER_API_SOURCES.LEAGUE_SETTINGS.replace('{{league_id}}', league_id);
          console.log(`📡 Testing league settings: ${leagueUrl}`);
          const leagueResponse = await axios.get(leagueUrl, { timeout: 10000 });
          results.sources_tested.league_settings = {
            url: leagueUrl,
            status: leagueResponse.status,
            scoring_settings: leagueResponse.data?.scoring_settings || 'none',
            roster_positions: leagueResponse.data?.roster_positions || []
          };
        } catch (error: any) {
          results.sources_tested.league_matchups = {
            error: error.message,
            status: 'failed'
          };
        }
      }
      
      // Analysis summary
      const workingSources = Object.entries(results.sources_tested).filter(([_, data]: any) => data.status !== 'failed');
      const failedSources = Object.entries(results.sources_tested).filter(([_, data]: any) => data.status === 'failed');
      
      results.comparison_summary = {
        working_sources: workingSources.length,
        failed_sources: failedSources.length,
        projection_availability: workingSources.map(([name, data]: any) => ({
          source: name,
          url: data.url,
          data_count: data.count || 0,
          has_projections: (data.count || 0) > 0
        }))
      };
      
      // Recommendations
      if (results.sources_tested.base_projections?.count > 0) {
        results.recommendations.push("✅ Base projections available - current implementation correct");
      } else if (results.sources_tested.weekly_projections?.count > 0) {
        results.recommendations.push("🔄 Switch to weekly projections endpoint for live data");
      } else {
        results.recommendations.push("⚠️ No live projections available - synthetic fallback required");
      }
      
      if (league_id && results.sources_tested.league_settings?.scoring_settings) {
        results.recommendations.push("🎯 League-specific scoring detected - consider league-contextual calculations");
      }
      
      res.json(results);
      
    } catch (error: any) {
      console.error('❌ Projections analysis error:', error.message);
      res.status(500).json({ 
        error: 'Projections analysis failed',
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });
}