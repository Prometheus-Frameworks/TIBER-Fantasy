/**
 * Power Rankings API
 * 
 * Phase E: API Integration
 * Exposes FPG-centric scoring system with real rushing upside calculations
 */

import { calculatePowerScores, PowerScore, getDisplayMetrics } from '../data/scoringEngine';
import { getCurrentWeek } from '../../../shared/weekDetection';

/**
 * Main power rankings endpoint
 * GET /api/power/fpg/rankings?pos=QB&week=1&season=2025
 */
export async function handlePowerRankingsRequest(
  req: any, 
  res: any
): Promise<void> {
  
  try {
    const season = parseInt(req.query.season || '2025');
    
    // Use dynamic week detection instead of hardcoded week=1
    let defaultWeek = 1;
    try {
      const currentWeekInfo = getCurrentWeek();
      defaultWeek = currentWeekInfo.currentWeek;
      console.log(`🕒 Dynamic week detection: Currently Week ${defaultWeek}, Status: ${currentWeekInfo.weekStatus}`);
    } catch (error) {
      console.warn('⚠️ Dynamic week detection failed, falling back to Week 1:', error);
    }
    
    const week = parseInt(req.query.week || defaultWeek.toString());
    const position = req.query.pos || 'ALL';
    const limit = parseInt(req.query.limit || '50');
    
    console.log(`🎯 Power rankings request: ${position} ${season} Week ${week}`);
    
    // Determine positions to include
    const positions = position === 'ALL' 
      ? ['QB', 'RB', 'WR', 'TE']
      : [position];
    
    // Calculate power scores
    const powerScores = await calculatePowerScores(season, week, positions);
    
    // Filter by position if specific position requested
    const filteredScores = position === 'ALL' 
      ? powerScores
      : powerScores.filter(score => score.position === position);
    
    // Sort by overall score and apply limit
    const rankedScores = filteredScores
      .sort((a, b) => b.overall_score - a.overall_score)
      .slice(0, limit);
    
    // Format for API response
    const response = {
      season,
      week,
      position,
      ranking_type: 'FPG_CENTRIC',
      timestamp: new Date().toISOString(),
      total_players: rankedScores.length,
      rankings: rankedScores.map((score, index) => ({
        rank: index + 1,
        player_id: score.player_id,
        position: score.position,
        overall_score: score.overall_score,
        confidence: Math.round(score.confidence * 100),
        
        // FPG metrics (key innovation)
        fpg_current: score.fpg_metrics.current_fpg,
        fpg_expected: score.fpg_metrics.expected_fpg,
        fpg_projected: score.fpg_metrics.projected_fpg,
        beat_projection: score.fpg_metrics.beat_projection,
        upside_index: score.fpg_metrics.upside_index,
        
        // RAG SCORING FIELDS (per specification)
        expected_points: score.rag_metrics?.expected_points || score.fpg_metrics.expected_fpg,
        floor_points: score.rag_metrics?.floor_points || (score.fpg_metrics.expected_fpg * 0.75),
        ceiling_points: score.rag_metrics?.ceiling_points || (score.fpg_metrics.expected_fpg * 1.25),
        rag_score: score.rag_metrics?.rag_score || score.overall_score,
        rag_color: score.rag_metrics?.rag_color || 'AMBER',
        reasons: score.rag_metrics?.reasons || [],
        
        // Component breakdown
        components: score.components,
        
        // UI elements
        badges: score.badges,
        display: getDisplayMetrics(score),
        
        // Metadata
        last_updated: new Date().toISOString()
      }))
    };
    
    console.log(`✅ Returning ${rankedScores.length} ${position} power rankings`);
    
    res.json(response);
    
  } catch (error) {
    console.error('❌ Power rankings API error:', error);
    
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to calculate power rankings',
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Individual player power analysis endpoint
 * GET /api/power/fpg/player/:player_id?week=1&season=2025
 */
export async function handlePlayerAnalysisRequest(
  req: any,
  res: any  
): Promise<void> {
  
  try {
    const player_id = req.params.player_id;
    const season = parseInt(req.query.season || '2025');
    
    // Use dynamic week detection instead of hardcoded week=1
    let defaultWeek = 1;
    try {
      const currentWeekInfo = getCurrentWeek();
      defaultWeek = currentWeekInfo.currentWeek;
    } catch (error) {
      console.warn('⚠️ Player analysis week detection failed, falling back to Week 1:', error);
    }
    
    const week = parseInt(req.query.week || defaultWeek.toString());
    
    console.log(`🔍 Player analysis request: ${player_id} ${season} Week ${week}`);
    
    // Get power scores for all positions to find this player
    const powerScores = await calculatePowerScores(season, week);
    
    const playerScore = powerScores.find(score => score.player_id === player_id);
    
    if (!playerScore) {
      res.status(404).json({
        error: 'Player not found',
        player_id,
        timestamp: new Date().toISOString()
      });
      return;
    }
    
    // Get league context for this player's position
    const positionScores = powerScores.filter(score => score.position === playerScore.position);
    const playerRank = positionScores
      .sort((a, b) => b.overall_score - a.overall_score)
      .findIndex(score => score.player_id === player_id) + 1;
    
    const response = {
      player_id,
      season,
      week,
      position: playerScore.position,
      
      // Rankings context
      overall_rank: playerRank,
      position_rank: playerRank,
      total_ranked: positionScores.length,
      
      // Power score breakdown
      overall_score: playerScore.overall_score,
      confidence: Math.round(playerScore.confidence * 100),
      
      // RAG SCORING FIELDS (enhanced API response)
      expected_points: playerScore.rag_metrics.expected_points,
      floor_points: playerScore.rag_metrics.floor_points,
      ceiling_points: playerScore.rag_metrics.ceiling_points,
      rag_score: playerScore.rag_metrics.rag_score,
      rag_color: playerScore.rag_metrics.rag_color,
      reasons: playerScore.rag_metrics.reasons,
      
      // Detailed FPG analysis (key feature)
      fpg_analysis: {
        current_fpg: playerScore.fpg_metrics.current_fpg,
        expected_fpg: playerScore.fpg_metrics.expected_fpg,
        projected_fpg: playerScore.fpg_metrics.projected_fpg,
        beat_projection: playerScore.fpg_metrics.beat_projection,
        upside_index: playerScore.fpg_metrics.upside_index,
        
        // Performance vs expectations
        vs_expected: playerScore.fpg_metrics.current_fpg - playerScore.fpg_metrics.expected_fpg,
        vs_projection: playerScore.fpg_metrics.current_fpg - playerScore.fpg_metrics.projected_fpg
      },
      
      // Component scores
      components: playerScore.components,
      
      // Position-specific insights
      position_insights: getPositionInsights(playerScore),
      
      // UI elements
      badges: playerScore.badges,
      display: getDisplayMetrics(playerScore),
      
      timestamp: new Date().toISOString()
    };
    
    console.log(`✅ Player analysis for ${player_id}: Rank ${playerRank}/${positionScores.length}`);
    
    res.json(response);
    
  } catch (error) {
    console.error(`❌ Player analysis error for ${req.params.player_id}:`, error);
    
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to analyze player',
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Get position-specific insights for detailed analysis
 */
function getPositionInsights(score: PowerScore): any {
  const pos = score.position;
  const fpg = score.fpg_metrics;
  
  if (pos === 'QB') {
    return {
      rushing_profile: {
        upside_index: fpg.upside_index,
        floor_vs_ceiling: fpg.upside_index > 70 ? 'ceiling' : 'floor',
        mobility_tier: fpg.upside_index >= 75 ? 'elite' : fpg.upside_index >= 50 ? 'average' : 'pocket'
      },
      projection_analysis: {
        beat_rate: fpg.beat_projection,
        consistency: fpg.current_fpg / Math.max(fpg.expected_fpg, 1),
        upside_realization: fpg.upside_index * (fpg.beat_projection / 100)
      }
    };
  }
  
  // Add insights for other positions as needed
  return {
    general: {
      beat_projection: fpg.beat_projection,
      upside_potential: fpg.upside_index,
      consistency_rating: score.confidence * 100
    }
  };
}

/**
 * Health check endpoint for the FPG scoring system
 * GET /api/power/fpg/health
 */
export async function handleHealthCheck(req: any, res: any): Promise<void> {
  try {
    const testResult = await calculatePowerScores(2025, 1, ['QB']);
    
    const qbWithUpside = testResult.filter(score => 
      score.position === 'QB' && score.fpg_metrics.upside_index > 50
    );
    
    res.json({
      status: 'healthy',
      system: 'FPG_CENTRIC_SCORING',
      test_results: {
        total_qbs_processed: testResult.length,
        qbs_with_upside: qbWithUpside.length,
        top_qb_upside: Math.max(...testResult.map(s => s.fpg_metrics.upside_index))
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    res.status(500).json({
      status: 'error',
      error: String(error),
      timestamp: new Date().toISOString()
    });
  }
}