/**
 * RB Player Compass API Routes
 * RESTful endpoints for RB dynasty evaluation
 */

import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { calculateRBCompass, RB_POPULATION_STATS } from '../rbPlayerCompass';
import { transformRBToCompassData, calculateRBPopulationStats } from '../rbCompassDataAdapter';

const router = Router();

// Load RB data
const loadRBGameLogs = () => {
  try {
    const gameLogsPath = path.join(process.cwd(), 'complete_18_week_rb_logs.json');
    const gameLogsData = fs.readFileSync(gameLogsPath, 'utf8');
    return JSON.parse(gameLogsData);
  } catch (error) {
    console.error('Failed to load RB game logs:', error);
    return { running_backs: [] };
  }
};

const loadRBProjections = () => {
  try {
    const projectionsPath = path.join(process.cwd(), 'server/data/rb_projections_2025.json');
    const projectionsData = fs.readFileSync(projectionsPath, 'utf8');
    return JSON.parse(projectionsData);
  } catch (error) {
    console.error('Failed to load RB projections:', error);
    return [];
  }
};

/**
 * GET /api/rb-compass
 * Returns Player Compass scores for all RBs
 */
router.get('/', async (req, res) => {
  try {
    const gameLogsData = loadRBGameLogs();
    const projections = loadRBProjections();
    const allPlayers = gameLogsData.running_backs || [];
    
    // Calculate population statistics
    const populationStats = calculateRBPopulationStats(allPlayers);
    
    const rbCompassResults = allPlayers.map((player: any) => {
      try {
        const compassData = transformRBToCompassData(player, projections, populationStats);
        const compass = calculateRBCompass(compassData);
        
        return {
          player_name: player.player_name,
          team: player.team,
          age: compassData.age,
          compass_scores: {
            north: Math.round(compass.north * 10) / 10,
            east: Math.round(compass.east * 10) / 10,
            south: Math.round(compass.south * 10) / 10,
            west: Math.round(compass.west * 10) / 10,
            final_score: Math.round(compass.final_score * 10) / 10,
            tier: compass.tier
          },
          season_stats: {
            total_carries: compassData.player_metrics.rush_att,
            yac_per_attempt: Math.round(compassData.player_metrics.yac_per_att * 10) / 10,
            breakaway_rate: Math.round(compassData.player_metrics.breakaway_pct * 100) / 100,
            fumble_rate: Math.round(compassData.fum_rate * 1000) / 1000
          }
        };
      } catch (error) {
        console.error(`Error calculating compass for ${player.player_name}:`, error);
        return null;
      }
    }).filter(Boolean);

    // Sort by final score descending
    rbCompassResults.sort((a: any, b: any) => b.compass_scores.final_score - a.compass_scores.final_score);

    res.json({
      total_players: rbCompassResults.length,
      rb_compass: rbCompassResults.slice(0, 50), // Top 50 RBs
      population_stats: populationStats,
      methodology: {
        north: "Volume/Talent (25%): Rush attempts, target share, goal-line carries, YAC, breakaway rate",
        east: "Scheme/Environment (25%): O-line rank, OC run rate, snap percentage, neutral game script",
        south: "Age/Risk (25%): Age penalties, games missed, fumble rate",
        west: "Market Efficiency (25%): ADP vs projection, positional scarcity, contract security"
      }
    });
  } catch (error) {
    console.error('Error in RB compass route:', error);
    res.status(500).json({ error: 'Failed to calculate RB compass scores' });
  }
});

/**
 * GET /api/rb-compass/:playerName
 * Returns detailed compass analysis for specific RB
 */
router.get('/:playerName', async (req, res) => {
  try {
    const gameLogsData = loadRBGameLogs();
    const projections = loadRBProjections();
    const allPlayers = gameLogsData.running_backs || [];
    
    const playerName = req.params.playerName.replace(/[-_]/g, ' ');
    const player = allPlayers.find((p: any) => 
      p.player_name.toLowerCase().includes(playerName.toLowerCase()) ||
      playerName.toLowerCase().includes(p.player_name.toLowerCase())
    );

    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }

    const populationStats = calculateRBPopulationStats(allPlayers);
    const compassData = transformRBToCompassData(player, projections, populationStats);
    const compass = calculateRBCompass(compassData);

    res.json({
      player_info: {
        name: player.player_name,
        team: player.team,
        position: 'RB',
        age: compassData.age
      },
      compass_breakdown: {
        north: {
          score: Math.round(compass.north * 10) / 10,
          description: "Volume & Talent",
          metrics: {
            rush_attempts: compassData.player_metrics.rush_att,
            target_share: Math.round(compassData.player_metrics.tgt_share * 100) + '%',
            goal_line_carries: compassData.player_metrics.gl_carries,
            yac_per_attempt: Math.round(compassData.player_metrics.yac_per_att * 10) / 10,
            breakaway_rate: Math.round(compassData.player_metrics.breakaway_pct * 100) + '%'
          }
        },
        east: {
          score: Math.round(compass.east * 10) / 10,
          description: "Scheme & Environment",
          metrics: {
            oline_rank: compassData.ol_rank,
            oc_run_rate: Math.round(compassData.oc_run_rate * 100) + '%',
            snap_percentage: Math.round(compassData.pos_snap_pct * 100) + '%',
            neutral_script_rate: Math.round(compassData.neutral_script_rate * 100) + '%'
          }
        },
        south: {
          score: Math.round(compass.south * 10) / 10,
          description: "Age & Risk",
          metrics: {
            age: compassData.age,
            games_missed_2yr: compassData.games_missed_2yr,
            fumble_rate: Math.round(compassData.fum_rate * 1000) / 1000
          }
        },
        west: {
          score: Math.round(compass.west * 10) / 10,
          description: "Market Efficiency",
          metrics: {
            projection_rank: compassData.proj_rank,
            adp_rank: compassData.adp_rank,
            value_gap: Math.abs(compassData.proj_rank - compassData.adp_rank),
            contract_years: compassData.contract_yrs
          }
        }
      },
      final_evaluation: {
        overall_score: Math.round(compass.final_score * 10) / 10,
        dynasty_tier: compass.tier,
        percentile: Math.round((compass.final_score / 10) * 100)
      },
      recent_performance: player.game_logs.slice(-5).map((game: any) => ({
        week: game.week,
        opponent: game.opponent,
        carries: game.rush_attempts,
        rush_yards: game.rush_yards,
        receptions: game.receptions,
        fantasy_points: game.fantasy_points_ppr
      }))
    });
  } catch (error) {
    console.error('Error in specific RB compass route:', error);
    res.status(500).json({ error: 'Failed to calculate player compass' });
  }
});

export default router;