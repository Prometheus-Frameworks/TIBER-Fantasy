import { Router } from "express";
import type { CompetenceRequest, CompetenceResponse } from "@shared/types/competence";
import { competenceEngine } from "../competence/charter";

const router = Router();

/**
 * POST /api/competence/analyze
 * Analyze a fantasy football query with competence mode principles
 */
router.post('/analyze', async (req, res) => {
  try {
    const request: CompetenceRequest = req.body;
    
    if (!request.query || typeof request.query !== 'string') {
      return res.status(400).json({ 
        error: 'Query is required and must be a string' 
      });
    }

    const response: CompetenceResponse = await competenceEngine.analyzeRequest(request);
    
    res.json(response);
  } catch (error) {
    console.error('Competence analysis error:', error);
    res.status(500).json({ 
      error: 'Failed to analyze request',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/competence/charter
 * Get the competence mode charter configuration
 */
router.get('/charter', (req, res) => {
  res.json({
    charter: {
      truthOverAgreement: true,
      contextAwareness: true,
      proactiveGuidance: true,
      transparentReasoning: true,
      riskAwareness: true,
      userGrowthFocus: true,
    },
    description: "Truth-first, context-aware fantasy football guidance system"
  });
});

export default router;