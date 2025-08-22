import express from 'express';
import { db } from '../db';
import { playerSeason2024 } from '@shared/schema';
import { eq, desc, asc, and, gte, sql } from 'drizzle-orm';
import type { PlayerSeason2024 } from '@shared/schema';

const router = express.Router();

// Position-specific metric whitelists
const POSITION_METRICS = {
  RB: [
    'rush_att', 'rush_yards', 'rush_tds', 'rush_ypc', 'rush_yac_per_att', 
    'rush_mtf', 'rush_expl_10p', 'targets', 'rec_yards', 'yprr', 'td_total', 'fpts', 'fpts_ppr'
  ],
  WR: [
    'targets', 'receptions', 'rec_yards', 'rec_tds', 'adot', 'yprr', 'racr', 
    'target_share', 'wopr', 'fpts', 'fpts_ppr'
  ],
  TE: [
    'targets', 'receptions', 'rec_yards', 'rec_tds', 'yprr', 'target_share', 'fpts', 'fpts_ppr'
  ],
  QB: [
    'cmp_pct', 'pass_yards', 'pass_tds', 'int', 'ypa', 'aypa', 'epa_per_play', 
    'qb_rush_yards', 'qb_rush_tds', 'fpts'
  ]
};

// Default thresholds for filtering
const DEFAULT_THRESHOLDS = {
  min_games: 8,
  min_routes: 150,    // For WR/TE
  min_att: 100,       // For RB rushing attempts
  min_att_qb: 250     // For QB passing attempts
};

// GET /api/stats/2024/leaderboard
router.get('/leaderboard', async (req, res) => {
  try {
    const {
      position = 'RB',
      metric = 'fpts_ppr',
      limit = 50,
      dir = 'desc',
      min_games = DEFAULT_THRESHOLDS.min_games,
      min_routes = DEFAULT_THRESHOLDS.min_routes,
      min_att = DEFAULT_THRESHOLDS.min_att,
      min_att_qb = DEFAULT_THRESHOLDS.min_att_qb
    } = req.query;

    // Validate position
    if (!['RB', 'WR', 'TE', 'QB'].includes(position as string)) {
      return res.status(400).json({ error: 'Invalid position. Must be RB, WR, TE, or QB' });
    }

    // Validate metric
    const validMetrics = POSITION_METRICS[position as keyof typeof POSITION_METRICS];
    if (!validMetrics.includes(metric as string)) {
      return res.status(400).json({ 
        error: `Invalid metric for ${position}. Valid metrics: ${validMetrics.join(', ')}` 
      });
    }

    // Build query conditions
    const conditions = [eq(playerSeason2024.position, position as string)];
    
    // Add minimum games filter
    if (min_games) {
      conditions.push(gte(playerSeason2024.games, parseInt(min_games as string)));
    }

    // Add position-specific thresholds
    if (position === 'RB' && min_att) {
      conditions.push(gte(playerSeason2024.rushAtt, parseInt(min_att as string)));
    }
    
    if ((position === 'WR' || position === 'TE') && min_routes) {
      conditions.push(gte(playerSeason2024.routes, parseInt(min_routes as string)));
    }
    
    if (position === 'QB' && min_att_qb) {
      conditions.push(gte(playerSeason2024.att, parseInt(min_att_qb as string)));
    }

    // Build order clause
    const sortDirection = dir === 'asc' ? asc : desc;
    const metricColumn = playerSeason2024[metric as keyof typeof playerSeason2024];
    
    if (!metricColumn) {
      return res.status(400).json({ error: `Invalid metric: ${metric}` });
    }

    // Execute query
    const results = await db
      .select()
      .from(playerSeason2024)
      .where(and(...conditions))
      .orderBy(sortDirection(metricColumn))
      .limit(parseInt(limit as string));

    res.json({
      success: true,
      data: results,
      filters: {
        position,
        metric,
        limit: parseInt(limit as string),
        direction: dir,
        thresholds: {
          min_games: parseInt(min_games as string),
          ...(position === 'RB' && { min_att: parseInt(min_att as string) }),
          ...((position === 'WR' || position === 'TE') && { min_routes: parseInt(min_routes as string) }),
          ...(position === 'QB' && { min_att_qb: parseInt(min_att_qb as string) })
        }
      },
      count: results.length
    });

  } catch (error) {
    console.error('Leaderboard API Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/stats/2024/player (optional search endpoint)
router.get('/player', async (req, res) => {
  try {
    const { name } = req.query;
    
    if (!name) {
      return res.status(400).json({ error: 'Player name is required' });
    }

    const results = await db
      .select()
      .from(playerSeason2024)
      .where(sql`LOWER(${playerSeason2024.playerName}) LIKE LOWER(${'%' + name + '%'})`)
      .limit(10);

    res.json({
      success: true,
      data: results,
      count: results.length
    });

  } catch (error) {
    console.error('Player search API Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/stats/2024/metrics - Return available metrics per position
router.get('/metrics', (req, res) => {
  res.json({
    success: true,
    data: POSITION_METRICS
  });
});

export default router;