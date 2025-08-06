import { Router } from 'express';
import { z } from 'zod';
import { computeComponents, getCompassDataFromPython } from '../compassCalculations';

const router = Router();

// Flask-style compass comparison endpoint
// Mirrors your Flask implementation exactly
const comparePlayersSchema = z.object({
  player1: z.string().min(1, "Player 1 name is required"),
  player2: z.string().min(1, "Player 2 name is required"),
  position: z.string().default('rb').transform(s => s.toLowerCase())
});

router.post('/compare', async (req, res) => {
  try {
    console.log('🔄 Flask-style compass compare request received');
    
    const data = comparePlayersSchema.parse(req.body);
    const { player1: player1Name, player2: player2Name, position } = data;

    if (!player1Name || !player2Name) {
      return res.status(400).json({ error: 'Missing player names' });
    }

    console.log(`⚖️ Comparing ${player1Name} vs ${player2Name} (${position.toUpperCase()})`);

    try {
      // Get raw compass data using Python backend (Flask methodology)
      let p1Raw, p2Raw;
      
      if (position === 'rb') {
        p1Raw = await getCompassDataFromPython(player1Name, 'rb');
        p2Raw = await getCompassDataFromPython(player2Name, 'rb');
      } else if (position === 'wr') {
        p1Raw = await getCompassDataFromPython(player1Name, 'wr');
        p2Raw = await getCompassDataFromPython(player2Name, 'wr');
      } else {
        return res.status(400).json({ error: 'Unsupported position' });
      }

      // Compute components using Flask calculations
      const p1Components = computeComponents(p1Raw, position);
      const p2Components = computeComponents(p2Raw, position);

      const p1Score = p1Components.score;
      const p2Score = p2Components.score;

      // Flask threshold logic
      const diff = p1Score - p2Score;
      const threshold = 0.5; // Configurable from Flask

      let verdict: string;
      if (Math.abs(diff) < threshold) {
        verdict = "Even trade";
      } else if (diff > 0) {
        verdict = `${player1Name} wins by ${diff.toFixed(1)}`;
      } else {
        verdict = `${player2Name} wins by ${Math.abs(diff).toFixed(1)}`;
      }

      // Flask-style response structure
      const response = {
        player1: {
          name: player1Name,
          score: p1Score,
          north: p1Components.north,
          east: p1Components.east,
          south: p1Components.south,
          west: p1Components.west
        },
        player2: {
          name: player2Name,
          score: p2Score,
          north: p2Components.north,
          east: p2Components.east,
          south: p2Components.south,
          west: p2Components.west
        },
        verdict
      };

      console.log(`✅ Flask-style analysis complete: ${verdict}`);
      res.json(response);

    } catch (keyError) {
      console.error('❌ Missing data key:', keyError);
      return res.status(400).json({ 
        error: `Missing data key: ${keyError instanceof Error ? keyError.message : String(keyError)}` 
      });
    }

  } catch (error) {
    console.error('❌ Flask-style compass compare error:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Invalid input: ' + error.errors.map(e => e.message).join(', ')
      });
    }

    res.status(500).json({
      error: error instanceof Error ? error.message : 'Compass comparison failed'
    });
  }
});

// Sample trades endpoint for testing Flask integration
router.get('/sample-trades', async (req, res) => {
  try {
    const sampleTrades = [
      { player1: 'Ja\'Marr Chase', player2: 'Cooper Kupp', position: 'wr' },
      { player1: 'Christian McCaffrey', player2: 'Josh Jacobs', position: 'rb' },
      { player1: 'Stefon Diggs', player2: 'Tyreek Hill', position: 'wr' },
      { player1: 'Saquon Barkley', player2: 'Derrick Henry', position: 'rb' },
      { player1: 'CeeDee Lamb', player2: 'DK Metcalf', position: 'wr' }
    ];

    res.json({
      status: 'success',
      sample_trades: sampleTrades,
      note: 'Flask-style compass comparison samples',
      endpoint: '/api/compass/compare'
    });

  } catch (error) {
    console.error('❌ Sample trades error:', error);
    res.status(500).json({
      status: 'error',
      error: 'Failed to get sample trades'
    });
  }
});

export default router;