/**
 * Rookie Risers Integration Routes
 * Based on Grok's data source recommendations and Tiber's infrastructure audit
 */

import express from 'express';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import { 
  calculateWaiverHeat, 
  calculateUsageGrowth,
  calculateOpportunityDelta,
  calculateMarketLag, 
  calculateNewsWeight,
  isRookie
} from '../services/waiverHeat';

const router = express.Router();

interface WaiverHeatInput {
  playerId: string;
  usageGrowth: number;      // Week-to-week Δ snap %, routes, targets (0-40)
  opportunityDelta: number; // Injury/depth chart opening score (0-30) 
  marketLag: number;        // Rostership % vs usage trend gap (0-20)
  newsWeight: number;       // Beat report/coach quote strength (0-10)
}

interface RookieUsageWeekly {
  playerId: string;
  week: number;
  snapPct: number;
  routes: number;
  targets: number;
  carries: number;
  redZoneOpportunities: number;
}

// Removed - now using server/services/waiverHeat.ts implementation

/**
 * Calculate usage growth from week-to-week data
 */
function calculateUsageGrowth(current: RookieUsageWeekly, previous: RookieUsageWeekly): number {
  if (!previous) return 0; // No baseline
  
  const snapGrowth = Math.max(0, current.snapPct - previous.snapPct);
  const routeGrowth = Math.max(0, current.routes - previous.routes);
  const targetGrowth = Math.max(0, current.targets - previous.targets);
  
  // Normalize to 0-40 scale
  const rawGrowth = (snapGrowth * 0.5) + (routeGrowth * 0.3) + (targetGrowth * 0.2);
  return Math.min(40, rawGrowth * 2); // Scale up and cap at 40
}

/**
 * Get weekly rookie usage data
 * TODO: Integrate with nfl-data-py and Sleeper API
 */
router.get('/usage-weekly', async (req, res) => {
  try {
    const { playerId, week, season = 2025 } = req.query;
    
    // TODO: Pull from Sleeper API + nfl-data-py
    // For now, return structured format that endpoints should provide
    
    const sampleData: RookieUsageWeekly[] = [
      {
        playerId: 'example_rookie_id',
        week: 1,
        snapPct: 65,
        routes: 28,
        targets: 6,
        carries: 0,
        redZoneOpportunities: 2
      }
    ];
    
    res.json({
      success: true,
      data: sampleData,
      note: 'TODO: Integrate Sleeper API snap %, routes, targets data'
    });
    
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to fetch rookie usage data',
      note: 'Missing: Sleeper API integration for snap counts, routes, targets'
    });
  }
});

/**
 * Calculate Waiver Heat Index for rookies
 * Implements Grok's recommended formula
 */
router.get('/waiver-heat', async (req, res) => {
  try {
    const { playerId, week = 1 } = req.query;
    
    if (!playerId) {
      return res.status(400).json({ error: 'playerId required' });
    }
    
    // TODO: Get actual usage data from previous endpoint
    // TODO: Get injury/depth chart data from nfl-data-py
    // TODO: Get rostership data from ESPN/Yahoo APIs
    // TODO: Get news weight from RAG system
    
    // Player-specific realistic mock data until APIs integrated
    const getPlayerMockData = (id: string) => {
      const playerId = id.toLowerCase();
      
      // Real rookie scenarios based on typical situations
      if (playerId.includes('ayomanor')) {
        return {
          usageGrowth: 0.37,      // Grok's exact calculation: growing usage
          opportunityDelta: 0.70, // Injury opportunity (Jefferson ankle)
          marketLag: 0.27,        // Market slow to react
          newsWeight: 0.70,       // Strong coach quotes
          context: 'Injury opportunity with strong coach endorsement'
        };
      }
      
      if (playerId.includes('byashul') || playerId.includes('tuten')) {
        return {
          usageGrowth: 0.25,      // Limited usage increase
          opportunityDelta: 0.15, // No major opportunity
          marketLag: 0.35,        // Some market lag
          newsWeight: 0.40,       // Moderate news coverage
          context: 'Steady development without major catalyst'
        };
      }
      
      if (playerId.includes('test_rookie')) {
        return {
          usageGrowth: 0.45,      // Good usage growth
          opportunityDelta: 0.50, // Some opportunity
          marketLag: 0.60,        // Market sleeping 
          newsWeight: 0.30,       // Limited news
          context: 'Sleeper pick with market inefficiency'
        };
      }
      
      if (playerId.includes('high_heat')) {
        return {
          usageGrowth: 0.80,      // Elite usage surge
          opportunityDelta: 0.85, // Major injury opportunity
          marketLag: 0.75,        // Huge market lag
          newsWeight: 0.90,       // Massive news coverage
          context: 'Must-add player with perfect storm of factors'
        };
      }
      
      // Default for unknown players
      return {
        usageGrowth: 0.30 + Math.random() * 0.3,
        opportunityDelta: 0.20 + Math.random() * 0.4,
        marketLag: 0.25 + Math.random() * 0.35,
        newsWeight: 0.25 + Math.random() * 0.35,
        context: 'Standard rookie development pattern'
      };
    };
    
    const playerData = getPlayerMockData(playerId as string);
    const mockNormalizedInput = {
      usageGrowth: playerData.usageGrowth,
      opportunityDelta: playerData.opportunityDelta,
      marketLag: playerData.marketLag,
      newsWeight: playerData.newsWeight
    };
    
    const heatIndex = calculateWaiverHeat(mockNormalizedInput);
    
    res.json({
      success: true,
      playerId,
      week,
      waiver_heat: heatIndex,
      components: {
        usage_growth: mockNormalizedInput.usageGrowth,
        opportunity_delta: mockNormalizedInput.opportunityDelta,
        market_lag: mockNormalizedInput.marketLag,
        news_weight: mockNormalizedInput.newsWeight
      },
      scenario: playerData.context,
      note_grok_fixes: [
        'NaN protection implemented',
        'Position-specific usage calculations', 
        'News weight corroboration guardrails',
        'UDFA edge case handling'
      ],
      formula: 'Grok formula: 40% Usage + 30% Opportunity + 20% Market + 10% News',
      todo: [
        'Integrate Sleeper API for usage data',
        'Add nfl-data-py for injury/depth tracking', 
        'Connect ESPN/Yahoo for rostership %',
        'Link RAG system for news weight scoring'
      ]
    });
    
  } catch (error) {
    res.status(500).json({ error: 'Failed to calculate waiver heat' });
  }
});

/**
 * Get injury status and depth chart changes
 * Based on Grok's nfl-data-py recommendation
 */
router.get('/injury-reports', async (req, res) => {
  try {
    const { week = 1, season = 2025 } = req.query;
    
    // TODO: Use nfl-data-py import_weekly_rosters for depth chart changes
    // TODO: Add injury status tracking (Q/D/O/IR)
    
    res.json({
      success: true,
      data: [],
      note: 'TODO: Implement nfl-data-py injury tracking + depth chart changes',
      recommended_source: 'nfl-data-py (free) or SportsDataIO API (paid)'
    });
    
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch injury reports' });
  }
});

/**
 * Get market sentiment data
 * Based on Grok's FantasyPros + ESPN/Yahoo recommendation
 */
router.get('/market-sentiment', async (req, res) => {
  try {
    const { playerId } = req.query;
    
    // TODO: Integrate FantasyPros ADP API
    // TODO: Add ESPN/Yahoo rostership % via direct APIs
    // TODO: Calculate ADP delta (historical trending)
    
    res.json({
      success: true,
      data: {
        rostership_pct: null,
        start_pct: null,
        adp_current: null,
        adp_delta: null
      },
      note: 'TODO: Integrate FantasyPros ADP + ESPN/Yahoo rostership APIs',
      recommended_sources: [
        'FantasyPros API (ADP data)',
        'ESPN Fantasy API (rostership %)',
        'Yahoo Fantasy Sports API (start %)'
      ]
    });
    
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch market sentiment' });
  }
});

export default router;