/**
 * Rookie Evaluation API Routes
 * Single player and batch processing endpoints
 */

import { Router } from 'express';
import { rookieEvaluationService, RookieBatch, type RookieEvaluationData } from '../services/rookieEvaluationService';
import { rookieStorageService } from '../services/rookieStorageService';

const router = Router();

/**
 * POST /api/rookie-evaluation/single
 * Evaluate single rookie player
 */
router.post('/single', async (req, res) => {
  try {
    const playerData: RookieEvaluationData = req.body;
    
    // Basic validation
    if (!playerData.name || !playerData.position) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: name, position'
      });
    }
    
    if (!['QB', 'RB', 'WR', 'TE'].includes(playerData.position)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid position. Must be QB, RB, WR, or TE'
      });
    }
    
    console.log(`🔍 Single rookie evaluation request: ${playerData.name} (${playerData.position})`);
    
    const evaluation = await rookieEvaluationService.evaluateRookie(playerData);
    
    res.json({
      success: true,
      evaluation,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Error in single rookie evaluation:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to evaluate rookie',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/rookie-evaluation/batch
 * Process batch of rookie evaluations
 */
router.post('/batch', async (req, res) => {
  try {
    const { rookies }: { rookies: RookieEvaluationData[] } = req.body;
    
    if (!Array.isArray(rookies) || rookies.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request. Expected array of rookies.'
      });
    }
    
    if (rookies.length > 50) {
      return res.status(400).json({
        success: false,
        error: 'Batch size too large. Maximum 50 rookies per batch.'
      });
    }
    
    console.log(`🔄 Batch evaluation request: ${rookies.length} rookies`);
    
    const batch = new RookieBatch();
    
    // Add all rookies to batch
    rookies.forEach(rookie => {
      batch.addRookie(rookie);
    });
    
    // Process batch
    const batchResult = await batch.processBatch();
    
    res.json({
      success: true,
      batch_result: batchResult,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Error in batch rookie evaluation:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process rookie batch',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/rookie-evaluation/sample/:position
 * Get sample rookie evaluation using stored data
 */
router.get('/sample/:position', async (req, res) => {
  try {
    const position = req.params.position.toUpperCase() as 'QB' | 'RB' | 'WR' | 'TE';
    
    if (!['QB', 'RB', 'WR', 'TE'].includes(position)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid position'
      });
    }
    
    console.log(`🎯 Sample evaluation request for ${position}`);
    
    // Get top rookie from storage
    const topRookies = rookieStorageService.getTopRookiesByPosition(position, 1);
    
    if (topRookies.length === 0) {
      return res.status(404).json({
        success: false,
        error: `No ${position} rookies found in storage`
      });
    }
    
    const rookie = topRookies[0];
    
    // Convert to evaluation format
    const evaluationData: RookieEvaluationData = {
      name: rookie.name,
      position: rookie.position,
      team: rookie.team,
      adp: rookie.adp,
      projected_points: rookie.projected_points,
      rush_yds: rookie.rush_yds,
      rec_yds: rookie.rec_yds,
      rec: rookie.rec,
      rush_td: rookie.rush_td,
      rec_td: rookie.rec_td,
      rush: rookie.rush
    };
    
    // Evaluate the rookie
    const evaluation = await rookieEvaluationService.evaluateRookie(evaluationData);
    
    res.json({
      success: true,
      sample_evaluation: evaluation,
      source_data: rookie,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Error in sample rookie evaluation:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate sample evaluation',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/rookie-evaluation/malik-nabers
 * Specific test case for Malik Nabers as mentioned in the request
 */
router.post('/malik-nabers', async (req, res) => {
  try {
    console.log('🎯 Evaluating Malik Nabers (test case)');
    
    // Sample Malik Nabers data
    const malikNabers: RookieEvaluationData = {
      name: "Malik Nabers",
      position: "WR",
      team: "NYG",
      college: "LSU",
      draft_round: 1,
      draft_pick: 6,
      adp: 45.2,
      projected_points: 195.5,
      rec: 85,
      rec_yds: 1050,
      rec_td: 7,
      ...req.body // Allow override with request data
    };
    
    const evaluation = await rookieEvaluationService.evaluateRookie(malikNabers);
    
    res.json({
      success: true,
      player: "Malik Nabers",
      evaluation,
      test_case: true,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Error evaluating Malik Nabers:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to evaluate Malik Nabers',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/rookie-evaluation/export-batch/:position?
 * Export evaluation batch as JSON for database storage
 */
router.get('/export-batch/:position?', async (req, res) => {
  try {
    const position = req.params.position?.toUpperCase() as 'QB' | 'RB' | 'WR' | 'TE' | undefined;
    
    console.log(`📦 Export batch request ${position ? `for ${position}` : 'for all positions'}`);
    
    // Get rookies from storage
    const rookies = position 
      ? rookieStorageService.getRookiesByPosition(position)
      : rookieStorageService.getAllRookies();
    
    if (rookies.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No rookies found for export'
      });
    }
    
    // Create batch
    const batch = new RookieBatch();
    
    // Add rookies to batch (limit to top 20 for performance)
    const topRookies = rookies.slice(0, 20);
    topRookies.forEach(rookie => {
      const evaluationData: RookieEvaluationData = {
        name: rookie.name,
        position: rookie.position,
        team: rookie.team,
        adp: rookie.adp,
        projected_points: rookie.projected_points,
        rush_yds: rookie.rush_yds,
        rec_yds: rookie.rec_yds,
        rec: rookie.rec,
        rush_td: rookie.rush_td,
        rec_td: rookie.rec_td,
        rush: rookie.rush
      };
      batch.addRookie(evaluationData);
    });
    
    // Export as JSON
    const jsonOutput = await batch.exportJson();
    
    // Set appropriate headers for JSON download
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="rookie_evaluations_${position || 'all'}_${Date.now()}.json"`);
    
    res.send(jsonOutput);
    
  } catch (error) {
    console.error('❌ Error exporting batch:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to export batch',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;