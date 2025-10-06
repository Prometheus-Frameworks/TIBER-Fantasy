/**
 * Matchup Intelligence API Routes
 * 
 * Endpoints for player matchup analysis and weekly exploit recommendations
 */

import { Router } from 'express';
import { analyzePlayerMatchup, getWeeklyExploits } from '../services/matchupAnalyzer';

const router = Router();

/**
 * GET /api/matchup/player/:playerId
 * Analyze a specific player's matchup for a given week
 * 
 * Query params:
 * - week: number (required)
 * - season: number (optional, defaults to 2025)
 */
router.get('/player/:playerId', async (req, res) => {
  try {
    const { playerId } = req.params;
    const week = parseInt(req.query.week as string);
    const season = req.query.season ? parseInt(req.query.season as string) : 2025;
    
    if (!week || isNaN(week)) {
      return res.status(400).json({ 
        error: 'Week parameter is required and must be a number' 
      });
    }
    
    const analysis = await analyzePlayerMatchup(playerId, week, season);
    
    if (!analysis) {
      return res.status(404).json({ 
        error: 'No matchup analysis available for this player' 
      });
    }
    
    res.json(analysis);
  } catch (error) {
    console.error('Error analyzing player matchup:', error);
    res.status(500).json({ 
      error: 'Failed to analyze player matchup' 
    });
  }
});

/**
 * GET /api/matchup/exploits
 * Get top weekly matchup exploits by position
 * 
 * Query params:
 * - week: number (required)
 * - position: 'WR' | 'RB' | 'TE' (required)
 * - season: number (optional, defaults to 2025)
 * - limit: number (optional, defaults to 10)
 */
router.get('/exploits', async (req, res) => {
  try {
    const week = parseInt(req.query.week as string);
    const position = (req.query.position as string || 'WR').toUpperCase();
    const season = req.query.season ? parseInt(req.query.season as string) : 2025;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
    
    if (!week || isNaN(week)) {
      return res.status(400).json({ 
        error: 'Week parameter is required and must be a number' 
      });
    }
    
    if (!['WR', 'RB', 'TE'].includes(position)) {
      return res.status(400).json({ 
        error: 'Position must be WR, RB, or TE' 
      });
    }
    
    const exploits = await getWeeklyExploits(
      week, 
      season, 
      position as 'WR' | 'RB' | 'TE', 
      limit
    );
    
    res.json({
      week,
      season,
      position,
      exploits,
      count: exploits.length
    });
  } catch (error) {
    console.error('Error getting weekly exploits:', error);
    res.status(500).json({ 
      error: 'Failed to get weekly exploits' 
    });
  }
});

/**
 * GET /api/matchup/health
 * Health check endpoint
 */
router.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'matchup-analyzer',
    timestamp: new Date().toISOString()
  });
});

export default router;
