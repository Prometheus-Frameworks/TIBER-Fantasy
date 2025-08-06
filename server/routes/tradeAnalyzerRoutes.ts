import { Router } from 'express';
import { z } from 'zod';

const router = Router();

// Input validation schema
const tradeComparisonSchema = z.object({
  player1: z.string().min(1, "Player 1 name is required"),
  player2: z.string().min(1, "Player 2 name is required")
});

interface CompassScores {
  north: number;
  east: number;
  south: number;
  west: number;
  final_score: number;
}

interface PlayerData {
  name: string;
  position: string;
  team: string;
  compass_scores: CompassScores;
  tier?: string;
}

interface TradeAnalysisResponse {
  status: string;
  player1: PlayerData;
  player2: PlayerData;
  verdict: string;
  analysis: {
    score_difference: number;
    winner: string;
    reasoning: string[];
  };
  error?: string;
}

// Compare two players using compass scores
router.post('/compare', async (req, res) => {
  try {
    console.log('🔄 Trade analysis request received');
    
    // Validate input
    const validatedData = tradeComparisonSchema.parse(req.body);
    const { player1, player2 } = validatedData;

    console.log(`⚖️ Comparing ${player1} vs ${player2}`);

    // Mock compass data - in production, this would fetch from actual compass APIs
    const mockCompassData = (playerName: string): PlayerData => {
      // Generate realistic compass scores based on player name hash
      const hash = playerName.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
      const base = 5.0 + (hash % 300) / 100; // 5.0 - 8.0 range
      
      const variance = () => (Math.random() - 0.5) * 1.5; // ±0.75 variance
      
      const north = Math.max(1, Math.min(10, base + variance()));
      const east = Math.max(1, Math.min(10, base + variance()));
      const south = Math.max(1, Math.min(10, base + variance()));
      const west = Math.max(1, Math.min(10, base + variance()));
      const final_score = (north + east + south + west) / 4;

      const positions = ['WR', 'RB', 'QB', 'TE'];
      const teams = ['KC', 'SF', 'BUF', 'CIN', 'LAR', 'BAL', 'GB', 'DAL'];
      const tiers = ['Elite', 'Solid', 'Depth', 'Bench'];
      
      return {
        name: playerName,
        position: positions[hash % positions.length],
        team: teams[hash % teams.length],
        compass_scores: {
          north,
          east,
          south,
          west,
          final_score
        },
        tier: tiers[Math.floor(final_score / 2.5)]
      };
    };

    const player1Data = mockCompassData(player1);
    const player2Data = mockCompassData(player2);

    // Calculate analysis
    const scoreDiff = player1Data.compass_scores.final_score - player2Data.compass_scores.final_score;
    const absDiff = Math.abs(scoreDiff);
    
    let verdict: string;
    let winner: string;
    let reasoning: string[] = [];

    if (absDiff < 0.3) {
      verdict = "Even Trade";
      winner = "Tie";
      reasoning = [
        "Compass scores are very close",
        "Trade value depends on team needs",
        "Consider positional scarcity and roster construction"
      ];
    } else if (scoreDiff > 0) {
      verdict = `${player1} Wins`;
      winner = player1;
      reasoning = [
        `${player1} has higher overall compass score (${player1Data.compass_scores.final_score.toFixed(1)} vs ${player2Data.compass_scores.final_score.toFixed(1)})`,
        `Score advantage: ${absDiff.toFixed(2)} points`,
        "Better dynasty value based on 4-directional analysis"
      ];
    } else {
      verdict = `${player2} Wins`;
      winner = player2;
      reasoning = [
        `${player2} has higher overall compass score (${player2Data.compass_scores.final_score.toFixed(1)} vs ${player1Data.compass_scores.final_score.toFixed(1)})`,
        `Score advantage: ${absDiff.toFixed(2)} points`,
        "Better dynasty value based on 4-directional analysis"
      ];
    }

    // Add directional analysis
    const directions = ['north', 'east', 'south', 'west'];
    const directionNames = ['Volume/Talent', 'Environment', 'Risk', 'Value'];
    
    directions.forEach((dir, index) => {
      const p1Score = player1Data.compass_scores[dir as keyof CompassScores];
      const p2Score = player2Data.compass_scores[dir as keyof CompassScores];
      const diff = Math.abs(p1Score - p2Score);
      
      if (diff > 1.0) {
        const leader = p1Score > p2Score ? player1 : player2;
        reasoning.push(`${leader} has significant ${directionNames[index]} advantage`);
      }
    });

    const response: TradeAnalysisResponse = {
      status: 'success',
      player1: player1Data,
      player2: player2Data,
      verdict,
      analysis: {
        score_difference: scoreDiff,
        winner,
        reasoning
      }
    };

    console.log(`✅ Trade analysis complete: ${verdict}`);
    res.json(response);

  } catch (error) {
    console.error('❌ Trade analysis error:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        status: 'error',
        error: 'Invalid input: ' + error.errors.map(e => e.message).join(', ')
      });
    }

    res.status(500).json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Trade analysis failed'
    });
  }
});

// Get sample trades for testing
router.get('/sample-trades', async (req, res) => {
  try {
    const sampleTrades = [
      { player1: 'Ja\'Marr Chase', player2: 'Cooper Kupp' },
      { player1: 'Christian McCaffrey', player2: 'Josh Jacobs' },
      { player1: 'Josh Allen', player2: 'Lamar Jackson' },
      { player1: 'Travis Kelce', player2: 'Mark Andrews' },
      { player1: 'Stefon Diggs', player2: 'Tyreek Hill' }
    ];

    res.json({
      status: 'success',
      sample_trades: sampleTrades,
      note: 'Use these for testing the trade analyzer'
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