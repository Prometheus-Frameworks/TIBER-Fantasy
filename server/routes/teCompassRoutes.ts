/**
 * TE Compass API Routes
 * Provides endpoints for tight end player compass analysis
 */

import { Router } from 'express';
import { teCompassDataAdapter } from '../teCompassDataAdapter';
import { calculateTECompass } from '../teCompassCalculations';

const router = Router();

/**
 * GET /api/te-compass
 * Get all TE compass rankings
 */
router.get('/', async (req, res) => {
  try {
    console.log('🧭 Generating TE compass rankings...');
    
    const allTEs = await teCompassDataAdapter.getAllTEPlayers();
    
    if (allTEs.length === 0) {
      return res.json({
        players: [],
        summary: {
          totalPlayers: 0,
          message: 'No TE data available. Please ensure TE player files are stored in /data/players/TE/'
        }
      });
    }

    // Calculate compass for each TE
    const compassRankings = allTEs.map(te => {
      const compass = calculateTECompass(te);
      return {
        ...te,
        compass,
        dynastyScore: compass.score,
        dynastyTier: compass.tier,
        rank: 0 // Will be set after sorting
      };
    });

    // Sort by dynasty score (descending)
    compassRankings.sort((a, b) => b.dynastyScore - a.dynastyScore);

    // Add rankings
    compassRankings.forEach((player, index) => {
      player.rank = index + 1;
    });

    console.log(`🏆 Top 3 TEs by compass score:`);
    compassRankings.slice(0, 3).forEach((player, i) => {
      console.log(`  ${i + 1}. ${player.name} (${player.team}) - Score: ${player.dynastyScore} (${player.dynastyTier})`);
    });

    const summary = await teCompassDataAdapter.getTESummaryStats();

    res.json({
      players: compassRankings,
      summary: {
        ...summary,
        methodology: 'TE Compass: 4-directional dynasty evaluation with equal 25% weighting',
        directions: {
          north: 'Volume/Talent (targets, red zone usage, efficiency)',
          east: 'Environment/Scheme (team context, role definition)', 
          south: 'Risk/Durability (age, injury, competition)',
          west: 'Value/Dynasty (efficiency, scarcity, long-term value)'
        }
      }
    });

  } catch (error) {
    console.error('TE compass error:', error);
    res.status(500).json({ 
      error: 'Failed to generate TE compass rankings',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/te-compass/:name
 * Get compass analysis for specific TE
 */
router.get('/:name', async (req, res) => {
  try {
    const playerName = decodeURIComponent(req.params.name);
    console.log(`🎯 Fetching TE compass for: ${playerName}`);
    
    const tePlayer = await teCompassDataAdapter.getTEPlayer(playerName);
    
    if (!tePlayer) {
      return res.status(404).json({ 
        error: 'TE player not found',
        name: playerName,
        suggestion: 'Check spelling or ensure player data exists in /data/players/TE/'
      });
    }

    const compass = calculateTECompass(tePlayer);
    
    res.json({
      player: {
        ...tePlayer,
        compass,
        dynastyScore: compass.score,
        dynastyTier: compass.tier
      },
      analysis: {
        methodology: 'TE Compass: 4-directional dynasty evaluation',
        breakdown: {
          north: {
            score: compass.north,
            category: 'Volume/Talent',
            factors: 'Targets, red zone usage, reception efficiency, PFF grade'
          },
          east: {
            score: compass.east,
            category: 'Environment/Scheme',
            factors: 'Team offense, QB relationship, role definition, blocking value'
          },
          south: {
            score: compass.south,
            category: 'Risk/Durability', 
            factors: 'Age, injury history, competition, positional security'
          },
          west: {
            score: compass.west,
            category: 'Value/Dynasty',
            factors: 'Efficiency metrics, scarcity premium, long-term value'
          }
        }
      }
    });

  } catch (error) {
    console.error(`Error fetching TE compass for ${req.params.name}:`, error);
    res.status(500).json({ 
      error: 'Failed to fetch TE compass analysis',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/te-compass/compare/:name1/:name2
 * Compare two TEs using compass methodology
 */
router.get('/compare/:name1/:name2', async (req, res) => {
  try {
    const name1 = decodeURIComponent(req.params.name1);
    const name2 = decodeURIComponent(req.params.name2);
    
    console.log(`⚖️ Comparing TEs: ${name1} vs ${name2}`);
    
    const [te1, te2] = await Promise.all([
      teCompassDataAdapter.getTEPlayer(name1),
      teCompassDataAdapter.getTEPlayer(name2)
    ]);

    if (!te1 || !te2) {
      return res.status(404).json({
        error: 'One or both TE players not found',
        missing: {
          player1: !te1 ? name1 : null,
          player2: !te2 ? name2 : null
        }
      });
    }

    const compass1 = calculateTECompass(te1);
    const compass2 = calculateTECompass(te2);

    // Calculate advantages
    const advantage = {
      north: compass1.north - compass2.north,
      east: compass1.east - compass2.east, 
      south: compass1.south - compass2.south,
      west: compass1.west - compass2.west,
      overall: compass1.score - compass2.score
    };

    // Determine winner
    const winner = compass1.score > compass2.score ? name1 : 
                  compass2.score > compass1.score ? name2 : 'Tie';

    res.json({
      comparison: {
        player1: {
          ...te1,
          compass: compass1,
          dynastyScore: compass1.score,
          dynastyTier: compass1.tier
        },
        player2: {
          ...te2,
          compass: compass2,
          dynastyScore: compass2.score,
          dynastyTier: compass2.tier
        }
      },
      analysis: {
        winner,
        scoreDifference: Math.abs(advantage.overall),
        advantages: {
          [name1]: Object.entries(advantage)
            .filter(([_, value]) => value > 0.5)
            .map(([direction, value]) => ({
              direction,
              advantage: Math.round(value * 10) / 10
            })),
          [name2]: Object.entries(advantage)
            .filter(([_, value]) => value < -0.5)
            .map(([direction, value]) => ({
              direction,
              advantage: Math.round(Math.abs(value) * 10) / 10
            }))
        },
        summary: winner === 'Tie' ? 
          'These TEs are essentially equal in compass evaluation' :
          `${winner} has a ${Math.abs(advantage.overall).toFixed(1)} point compass advantage`
      }
    });

  } catch (error) {
    console.error('TE comparison error:', error);
    res.status(500).json({ 
      error: 'Failed to compare TEs',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/te-compass/tiers
 * Get TEs grouped by dynasty tiers
 */
router.get('/tiers', async (req, res) => {
  try {
    console.log('📊 Generating TE dynasty tiers...');
    
    const allTEs = await teCompassDataAdapter.getAllTEPlayers();
    
    const tesByTier: { [tier: string]: any[] } = {};
    
    allTEs.forEach(te => {
      const compass = calculateTECompass(te);
      const tier = compass.tier;
      
      if (!tesByTier[tier]) {
        tesByTier[tier] = [];
      }
      
      tesByTier[tier].push({
        name: te.name,
        team: te.team,
        age: te.age,
        compass,
        dynastyScore: compass.score,
        receiving_yards: te.receiving_yards,
        receiving_touchdowns: te.receiving_touchdowns
      });
    });

    // Sort each tier by dynasty score
    Object.values(tesByTier).forEach(tierPlayers => {
      tierPlayers.sort((a, b) => b.dynastyScore - a.dynastyScore);
    });

    res.json({
      tiers: tesByTier,
      summary: {
        totalPlayers: allTEs.length,
        tierDistribution: Object.entries(tesByTier).reduce((acc, [tier, players]) => {
          acc[tier] = players.length;
          return acc;
        }, {} as { [tier: string]: number }),
        methodology: 'Dynasty tiers based on 4-directional TE compass scores'
      }
    });

  } catch (error) {
    console.error('TE tiers error:', error);
    res.status(500).json({ 
      error: 'Failed to generate TE dynasty tiers',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;