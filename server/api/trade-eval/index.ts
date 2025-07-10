import express from 'express';
import { evaluateTradePackage, type TradeInput } from '../../services/trade/tradeLogic';

const router = express.Router();

// POST /api/trade-eval
// Enhanced trade evaluation endpoint with comprehensive analysis
router.post('/', async (req, res) => {
  try {
    const tradeInput: TradeInput = req.body;
    
    // Validate input
    if (!tradeInput.teamA || !tradeInput.teamB) {
      return res.status(400).json({
        error: 'Missing required fields: teamA and teamB arrays are required'
      });
    }
    
    if (!Array.isArray(tradeInput.teamA) || !Array.isArray(tradeInput.teamB)) {
      return res.status(400).json({
        error: 'teamA and teamB must be arrays'
      });
    }
    
    if (tradeInput.teamA.length === 0 || tradeInput.teamB.length === 0) {
      return res.status(400).json({
        error: 'Both teams must have at least one player'
      });
    }
    
    // Validate player objects
    const validatePlayer = (player: any, team: string, index: number) => {
      if (!player.id && !player.name) {
        throw new Error(`Player ${index + 1} in ${team} missing id or name`);
      }
      if (typeof player.prometheusScore !== 'number') {
        throw new Error(`Player ${index + 1} in ${team} missing prometheusScore`);
      }
      if (player.prometheusScore < 0 || player.prometheusScore > 100) {
        throw new Error(`Player ${index + 1} in ${team} has invalid prometheusScore (must be 0-100)`);
      }
    };
    
    tradeInput.teamA.forEach((player, index) => validatePlayer(player, 'Team A', index));
    tradeInput.teamB.forEach((player, index) => validatePlayer(player, 'Team B', index));
    
    // Evaluate the trade
    const result = evaluateTradePackage(tradeInput);
    
    // Log the evaluation for debugging
    console.log('🔄 Enhanced trade evaluation completed:', {
      winner: result.winner,
      confidence: result.confidence,
      balanceIndex: result.balanceIndex,
      verdictStrength: result.verdict.strength
    });
    
    res.json(result);
    
  } catch (error) {
    console.error('Trade evaluation error:', error);
    res.status(500).json({
      error: 'Failed to evaluate trade',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;