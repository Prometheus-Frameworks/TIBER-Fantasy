/**
 * Rookie Risers Calculation Verification
 * Testing Grok's Ayomanor example with exact data
 */

import express from 'express';
import { 
  calculateWaiverHeat, 
  calculateUsageGrowth,
  calculateOpportunityDelta,
  calculateMarketLag,
  calculateNewsWeight,
  type WeeklyUsageStats,
  type OpportunityContext,
  type MarketContext,
  type NewsContext
} from '../services/waiverHeat';

const router = express.Router();

/**
 * GET /api/rookie-risers/test/ayomanor
 * Verify Grok's step-by-step calculation using our services
 */
router.get('/test/ayomanor', async (req, res) => {
  try {
    // Grok's Mock Data - Ayomanor Week 1 vs Week 2
    const week1Usage: WeeklyUsageStats = {
      snapPct: 45,
      routes: 25,
      targets: 5,
      carries: 0,
      touches: 5
    };
    
    const week2Usage: WeeklyUsageStats = {
      snapPct: 65,
      routes: 35, 
      targets: 8,
      carries: 0,
      touches: 8
    };
    
    const opportunityContext: OpportunityContext = {
      injuryOpening: true, // Vet Jefferson tweaked ankle
      depthChartMovement: -1, // Moved from rank 4 to rank 3 (negative = moved up)
      teamTargetShare: 120, // Team total target opportunity
      seasonContext: 'early' // Week 2 is early season
    };
    
    const marketContext: MarketContext = {
      rostership: 0.45, // 45% rostered
      startPct: 0.20, // 20% starting him
      adpDelta: -15, // ADP fell 15 spots (market ignoring)
      usageTrend: 0.65 // Based on 65% snap rate trend
    };
    
    const newsContext: NewsContext = {
      coachQuotes: 1, // "Elic's earning starter reps"
      beatReports: 2, // Supporting beat reports
      roleClarity: 0.8, // Clear role expansion
      corroborationGames: 2 // 2 weeks of supporting usage
    };
    
    // Step 1: Calculate Usage Growth using our service
    const usageGrowth = calculateUsageGrowth(week2Usage, week1Usage, 'WR');
    
    // Step 2: Calculate Opportunity Delta using our service
    const opportunityDelta = calculateOpportunityDelta(opportunityContext);
    
    // Step 3: Calculate Market Lag using our service  
    const marketLag = calculateMarketLag(marketContext);
    
    // Step 4: Calculate News Weight using our service
    const newsWeight = calculateNewsWeight(newsContext);
    
    // Step 5: Calculate Final Waiver Heat using our service
    const waiverHeat = calculateWaiverHeat({
      usageGrowth,
      opportunityDelta, 
      marketLag,
      newsWeight
    });
    
    // Manual calculation breakdown for verification
    const manualBreakdown = {
      usage_component: 0.40 * usageGrowth,
      opportunity_component: 0.30 * opportunityDelta,
      market_component: 0.20 * marketLag,
      news_component: 0.10 * newsWeight,
      total_score: (0.40 * usageGrowth) + (0.30 * opportunityDelta) + (0.20 * marketLag) + (0.10 * newsWeight)
    };
    
    // Grok's Expected Calculation (for comparison)
    const groksCalculation = {
      usage_growth_expected: 0.37, // Their calculation
      opportunity_delta_expected: 0.70, // Their calculation  
      market_lag_expected: 0.27, // Their calculation
      news_weight_expected: 0.70, // Their calculation
      waiver_heat_expected: 48 // Their expected result
    };
    
    res.json({
      success: true,
      player: "Elic Ayomanor",
      test_scenario: "Week 1 vs Week 2 - Jefferson injury opportunity",
      
      // Our calculated results
      calculated_components: {
        usage_growth: Number(usageGrowth.toFixed(3)),
        opportunity_delta: Number(opportunityDelta.toFixed(3)),
        market_lag: Number(marketLag.toFixed(3)),
        news_weight: Number(newsWeight.toFixed(3))
      },
      
      // Final result
      waiver_heat_calculated: waiverHeat,
      
      // Step-by-step breakdown
      calculation_breakdown: {
        ...manualBreakdown,
        total_score: Number(manualBreakdown.total_score.toFixed(3))
      },
      
      // Grok's expectations for comparison
      groks_expected: groksCalculation,
      
      // Verification
      matches_grok: {
        usage_close: Math.abs(usageGrowth - groksCalculation.usage_growth_expected) < 0.1,
        opportunity_close: Math.abs(opportunityDelta - groksCalculation.opportunity_delta_expected) < 0.1,
        market_close: Math.abs(marketLag - groksCalculation.market_lag_expected) < 0.1,
        news_close: Math.abs(newsWeight - groksCalculation.news_weight_expected) < 0.1,
        final_heat_close: Math.abs(waiverHeat - groksCalculation.waiver_heat_expected) < 5
      },
      
      // Raw input data for transparency
      input_data: {
        week1_usage: week1Usage,
        week2_usage: week2Usage,
        opportunity_context: opportunityContext,
        market_context: marketContext,
        news_context: newsContext
      },
      
      interpretation: waiverHeat >= 50 ? "Strong waiver add" :
                     waiverHeat >= 30 ? "Warm waiver add" : 
                     "Monitor for next week"
    });
    
  } catch (error) {
    console.error('Ayomanor test calculation failed:', error);
    res.status(500).json({
      error: 'Test calculation failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/rookie-risers/test/manual-verify
 * Manual step-by-step calculation exactly like Grok's breakdown
 */
router.get('/test/manual-verify', async (req, res) => {
  try {
    // Grok's exact manual calculation
    const dSnap = Math.max(0, 65 - 45) / 100; // 0.20
    const dRoutes = Math.max(0, 35 - 25) / Math.max(10, 25); // 10/25 = 0.40  
    const dTargets = Math.max(0, 8 - 5) / Math.max(6, 5); // 3/6 = 0.50
    const usageGrowthManual = (dSnap + dRoutes + dTargets) / 3; // 0.37
    
    const injuryOpening = 0.5; // true
    const depthImprove = (4 - 3) / 5; // 0.20
    const opportunityDeltaManual = Math.min(1, injuryOpening + depthImprove); // 0.70
    
    const rostershipGap = (0.60 - 0.45) * 2; // 0.30 (expected 60% for 65% snaps)
    const adpLag = Math.abs(-15) / 50; // 0.30
    const startLag = 0.20; // Start % too low
    const marketLagManual = (rostershipGap + adpLag + startLag) / 3; // 0.27
    
    const newsWeightManual = 0.70; // Direct from Grok
    
    // Final calculation
    const component1 = 0.40 * usageGrowthManual; // 0.148
    const component2 = 0.30 * opportunityDeltaManual; // 0.210  
    const component3 = 0.20 * marketLagManual; // 0.054
    const component4 = 0.10 * newsWeightManual; // 0.070
    const totalScore = component1 + component2 + component3 + component4; // 0.482
    const waiverHeatManual = Math.round(totalScore * 100); // 48
    
    res.json({
      success: true,
      title: "Manual Verification - Grok's Exact Steps",
      
      step1_usage_growth: {
        snap_delta: dSnap,
        routes_delta: dRoutes, 
        targets_delta: dTargets,
        average: usageGrowthManual,
        result: Number(usageGrowthManual.toFixed(3))
      },
      
      step2_opportunity_delta: {
        injury_opening: injuryOpening,
        depth_improvement: depthImprove,
        total: opportunityDeltaManual,
        result: Number(opportunityDeltaManual.toFixed(3))
      },
      
      step3_market_lag: {
        rostership_gap: rostershipGap,
        adp_lag: adpLag,
        start_lag: startLag,
        average: marketLagManual,
        result: Number(marketLagManual.toFixed(3))
      },
      
      step4_news_weight: {
        coach_quote_strength: newsWeightManual,
        result: newsWeightManual
      },
      
      step5_final_calculation: {
        usage_component: Number(component1.toFixed(3)),
        opportunity_component: Number(component2.toFixed(3)),
        market_component: Number(component3.toFixed(3)),
        news_component: Number(component4.toFixed(3)),
        total_score: Number(totalScore.toFixed(3)),
        waiver_heat: waiverHeatManual
      },
      
      verification: {
        expected_heat: 48,
        calculated_heat: waiverHeatManual,
        matches: waiverHeatManual === 48,
        interpretation: "Warm waiver add - usage ticking up, opportunity from injury, market not fully on board"
      }
    });
    
  } catch (error) {
    console.error('Manual verification failed:', error);
    res.status(500).json({
      error: 'Manual verification failed', 
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;