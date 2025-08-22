import express from 'express';
import { db } from '../db';
import { playerSeason2024 } from '@shared/schema';
import { eq, desc, asc, and, gte, sql } from 'drizzle-orm';
import type { PlayerSeason2024 } from '@shared/schema';

const router = express.Router();

// Map API metric names to Drizzle schema property names
const METRIC_TO_COLUMN = {
  'rush_att': 'rushAtt',
  'rush_yards': 'rushYards',
  'rush_tds': 'rushTds', 
  'rush_ypc': 'rushYpc',
  'rush_yac_per_att': 'rushYacPerAtt',
  'rush_mtf': 'rushMtf',
  'rush_expl_10p': 'rushExpl10p',
  'targets': 'targets',
  'receptions': 'receptions',
  'rec_yards': 'recYards',
  'rec_tds': 'recTds',
  'yprr': 'yprr',
  'adot': 'adot',
  'racr': 'racr',
  'target_share': 'targetShare',
  'wopr': 'wopr',
  'td_total': 'tdTotal',
  'fpts': 'fpts',
  'fpts_ppr': 'fptsPpr',
  'cmp': 'cmp',
  'att': 'att', 
  'cmp_pct': 'cmpPct',
  'pass_yards': 'passYards',
  'pass_tds': 'passTds',
  'int': 'int',
  'ypa': 'ypa',
  'aypa': 'aypa',
  'epa_per_play': 'epaPerPlay',
  'qb_rush_yards': 'qbRushYards',
  'qb_rush_tds': 'qbRushTds',
  'routes': 'routes'
};

// v1 Metric Whitelist - Live metrics only (enforced in API)
const METRICS_V1 = {
  RB: ['rush_yards', 'rush_att', 'rush_ypc', 'targets', 'rec_yards', 'td_total', 'fpts', 'fpts_ppr'],
  WR: ['targets', 'receptions', 'rec_yards', 'rec_tds', 'fpts', 'fpts_ppr'],
  TE: ['targets', 'receptions', 'rec_yards', 'rec_tds', 'fpts', 'fpts_ppr'],
  QB: ['cmp_pct', 'pass_yards', 'pass_tds', 'int', 'ypa', 'aypa', 'qb_rush_yards', 'qb_rush_tds', 'fpts']
} as const;

// Advanced metrics coming soon (visible as locked in UI, not queryable)
const METRICS_COMING_SOON = {
  RB: ['rush_yac_per_att', 'rush_mtf', 'rush_expl_10p', 'yprr'],
  WR: ['adot', 'yprr', 'racr', 'target_share', 'wopr'],
  TE: ['yprr', 'target_share'],
  QB: ['epa_per_play'] // nullable if populated, but off dropdown for v1
} as const;

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

    // Validate metric - only allow Live metrics (v1)
    const allowedMetrics = METRICS_V1[position as keyof typeof METRICS_V1];
    if (!allowedMetrics.includes(metric as string)) {
      return res.status(400).json({ 
        error: 'metric_not_allowed_for_position',
        position,
        metric,
        allowed: allowedMetrics
      });
    }

    // Build query conditions - start with position filter only
    const conditions = [eq(playerSeason2024.position, position as string)];

    // Build order clause
    const sortDirection = dir === 'asc' ? asc : desc;
    
    // Validate metric and get column name
    const columnName = METRIC_TO_COLUMN[metric as keyof typeof METRIC_TO_COLUMN];
    if (!columnName) {
      return res.status(400).json({ error: `Invalid metric: ${metric}` });
    }
    
    // Get the correct column from the schema  
    const metricColumn = playerSeason2024[columnName as keyof typeof playerSeason2024];
    
    if (!metricColumn) {
      return res.status(400).json({ error: `Column not found for metric: ${metric}` });
    }

    // Execute query with SQL template for debugging
    const results = await db.execute(sql`
      SELECT * FROM player_season_2024 
      WHERE position = ${position}
      ORDER BY ${sql.identifier(metric)} ${sql.raw(dir === 'asc' ? 'ASC' : 'DESC')}
      LIMIT ${parseInt(limit as string)}
    `);

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
    data: {
      live: METRICS_V1,
      coming_soon: METRICS_COMING_SOON
    }
  });
});

export default router;