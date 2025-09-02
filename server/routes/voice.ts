/**
 * Tiber Voice API Routes
 * New data-driven fantasy advice system
 */

import { Router } from "express";
import { tiberAnswer } from "../voice/answer";
import { parseQuery } from "../voice/intentParser";
import type { TiberAsk, TiberAnswer } from "../voice/types";

const router = Router();

/**
 * POST /api/voice
 * Main Tiber endpoint - natural language query to structured advice
 */
router.post('/', async (req, res) => {
  try {
    const { query, season = 2025, week = 1, leagueType, scoring } = req.body;
    
    if (!query || typeof query !== 'string') {
      return res.status(400).json({ 
        error: 'Query is required and must be a string' 
      });
    }

    // Parse natural language into structured ask
    const ask: TiberAsk = parseQuery(query, season, week);
    
    // Override with explicit context if provided
    if (leagueType) ask.leagueType = leagueType;
    if (scoring) ask.scoring = scoring;
    
    // Get data-driven answer
    const answer: TiberAnswer = await tiberAnswer(ask);
    
    res.json({
      ask,
      answer,
      meta: {
        source: 'tiber_voice',
        generatedAt: new Date().toISOString(),
        version: '1.0'
      }
    });
    
  } catch (error) {
    console.error('Tiber voice error:', error);
    res.status(500).json({ 
      error: 'Failed to process query',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/voice/structured
 * Direct structured input for advanced users
 */
router.post('/structured', async (req, res) => {
  try {
    const ask: TiberAsk = req.body;
    
    // Validate required fields
    if (!ask.intent || !ask.players || !Array.isArray(ask.players)) {
      return res.status(400).json({ 
        error: 'Intent and players array are required' 
      });
    }
    
    const answer: TiberAnswer = await tiberAnswer(ask);
    
    res.json({
      ask,
      answer,
      meta: {
        source: 'tiber_voice_structured',
        generatedAt: new Date().toISOString(),
        version: '1.0'
      }
    });
    
  } catch (error) {
    console.error('Tiber structured error:', error);
    res.status(500).json({ 
      error: 'Failed to process structured request',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/voice/health
 * Health check for voice system
 */
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    system: 'tiber_voice',
    version: '1.0',
    capabilities: [
      'START_SIT',
      'TRADE', 
      'WAIVER',
      'RANKING_EXPLAIN',
      'PLAYER_OUTLOOK'
    ],
    data_sources: [
      'otc_power_rankings',
      'fpg_system',
      'rag_scoring'
    ],
    timestamp: new Date().toISOString()
  });
});

export default router;