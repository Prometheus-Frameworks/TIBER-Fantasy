import { Request, Response } from 'express';
import { computeRedraftWeek, computeDynastySeason } from './compute';
import { type Position, type Format } from './weights';
import { db } from '../../../db';

const VALID_POSITIONS = new Set(['QB', 'RB', 'WR', 'TE']);
const VALID_FORMATS = new Set(['redraft', 'dynasty']);

function maxWeekForSeason(season: number): number {
  return season === 2024 ? 17 : 18; // extend as needed
}

function badRequest(res: Response, msg: string) {
  return res.status(400).json({ error: msg });
}

export async function getRatings(req: Request, res: Response) {
  try {
    const format = (req.query.format as Format) ?? 'redraft';
    const position = (req.query.position as Position) ?? 'RB';
    const season = parseInt((req.query.season as string) ?? '2024', 10);
    const week = req.query.week ? parseInt(req.query.week as string, 10) : null;
    const debug = req.query.debug === '1';
    const limit = parseInt((req.query.limit as string) ?? '200', 10);
    const weightsOverride = req.query.weights as string;

    // Enhanced validation
    if (!VALID_FORMATS.has(format)) {
      return badRequest(res, `invalid format. Must be one of: ${Array.from(VALID_FORMATS).join(', ')}`);
    }
    if (!VALID_POSITIONS.has(position)) {
      return badRequest(res, `invalid position. Must be one of: ${Array.from(VALID_POSITIONS).join(', ')}`);
    }
    if (format === 'redraft') {
      if (!week) {
        return badRequest(res, 'week required for redraft format');
      }
      const maxWeek = maxWeekForSeason(season);
      if (week < 1 || week > maxWeek) {
        return badRequest(res, `week must be 1..${maxWeek} for season ${season}`);
      }
    }

    // Optional recompute on demand
    if (req.query.recompute === '1') {
      if (format === 'redraft') {
        await computeRedraftWeek(season, week!, position, weightsOverride);
      } else {
        await computeDynastySeason(season, position, weightsOverride);
      }
    }

    // Build query based on format
    let query: string;
    let params: any[];
    
    if (format === 'redraft') {
      query = `
        SELECT s.*, p.name, p.team
        FROM player_scores s
        JOIN player_profile p ON p.player_id = s.player_id
        WHERE s.season = ? AND s.position = ? AND s.format = ? AND s.week = ?
        ORDER BY s.score DESC LIMIT ?
      `;
      params = [season, position, format, week, limit];
    } else {
      query = `
        SELECT s.*, p.name, p.team
        FROM player_scores s
        JOIN player_profile p ON p.player_id = s.player_id
        WHERE s.season = ? AND s.position = ? AND s.format = ? AND s.week IS NULL
        ORDER BY s.score DESC LIMIT ?
      `;
      params = [season, position, format, limit];
    }

    const result = await db.execute(query, params);

    const items = result.rows.map((r: any) => ({
      player_id: r.player_id,
      name: r.name,
      team: r.team,
      position: r.position,
      score: Number(r.score),
      vor: Number(r.vor || 0),
      tier: r.tier,
      ...(debug ? { 
        debug: typeof r.debug_json === 'string' ? JSON.parse(r.debug_json) : r.debug_json,
        weights: typeof r.weights_json === 'string' ? JSON.parse(r.weights_json) : r.weights_json
      } : {})
    }));

    return res.json({
      season,
      week: format === 'redraft' ? week : undefined,
      position,
      format,
      items,
      count: items.length
    });

  } catch (error) {
    console.error('❌ Ratings error:', error);
    return res.status(500).json({ error: 'Failed to fetch ratings' });
  }
}

export async function getPlayerRating(req: Request, res: Response) {
  try {
    const playerId = req.params.id;
    const format = (req.query.format as Format) ?? 'redraft';
    const season = parseInt((req.query.season as string) ?? '2024', 10);
    const week = req.query.week ? parseInt(req.query.week as string, 10) : null;

    // Enhanced validation
    if (!VALID_FORMATS.has(format)) {
      return badRequest(res, `invalid format. Must be one of: ${Array.from(VALID_FORMATS).join(', ')}`);
    }
    if (format === 'redraft') {
      if (!week) {
        return badRequest(res, 'week required for redraft format');
      }
      const maxWeek = maxWeekForSeason(season);
      if (week < 1 || week > maxWeek) {
        return badRequest(res, `week must be 1..${maxWeek} for season ${season}`);
      }
    }

    let query: string;
    let params: any[];
    
    if (format === 'redraft') {
      query = `
        SELECT s.*, p.name, p.team, p.position as player_position, p.age
        FROM player_scores s
        JOIN player_profile p ON p.player_id = s.player_id
        WHERE s.player_id = ? AND s.season = ? AND s.format = ? AND s.week = ?
      `;
      params = [playerId, season, format, week];
    } else {
      query = `
        SELECT s.*, p.name, p.team, p.position as player_position, p.age
        FROM player_scores s
        JOIN player_profile p ON p.player_id = s.player_id
        WHERE s.player_id = ? AND s.season = ? AND s.format = ? AND s.week IS NULL
      `;
      params = [playerId, season, format];
    }

    const result = await db.execute(query, params);

    if (!result.rows.length) {
      return res.status(404).json({ error: 'Player rating not found' });
    }

    const row = result.rows[0] as any;

    // Get trend data for redraft (last 4 weeks)
    let trend: any[] = [];
    if (format === 'redraft' && week) {
      const trendResult = await db.execute(
        `SELECT s.week, s.score
         FROM player_scores s
         WHERE s.player_id = ? AND s.season = ? 
         AND s.format = 'redraft' AND s.week >= ? AND s.week <= ?
         ORDER BY s.week ASC`,
        [playerId, season, Math.max(1, week - 3), week]
      );
      trend = trendResult.rows.map((r: any) => ({
        week: r.week,
        score: Number(r.score)
      }));
    }

    const playerData = {
      player_id: row.player_id,
      name: row.name,
      team: row.team,
      position: row.player_position,
      age: row.age,
      season,
      week: format === 'redraft' ? week : undefined,
      format,
      score: Number(row.score),
      vor: Number(row.vor || 0),
      tier: row.tier,
      debug: typeof row.debug_json === 'string' ? JSON.parse(row.debug_json) : row.debug_json,
      weights: typeof row.weights_json === 'string' ? JSON.parse(row.weights_json) : row.weights_json,
      trend
    };

    return res.json(playerData);

  } catch (error) {
    console.error('❌ Player rating error:', error);
    return res.status(500).json({ error: 'Failed to fetch player rating' });
  }
}

export async function getRatingsTiers(req: Request, res: Response) {
  try {
    const format = (req.query.format as Format) ?? 'redraft';
    const position = (req.query.position as Position) ?? 'RB';
    const season = parseInt((req.query.season as string) ?? '2024', 10);
    const week = req.query.week ? parseInt(req.query.week as string, 10) : null;

    if (format === 'redraft' && !week) {
      return res.status(400).json({ error: 'week required for redraft format' });
    }

    let query: string;
    let params: any[];
    
    if (format === 'redraft') {
      query = `
        SELECT s.tier, MIN(s.score) as min_score, MAX(s.score) as max_score, COUNT(*) as count
        FROM player_scores s
        WHERE s.season = ? AND s.position = ? AND s.format = ? AND s.week = ?
        GROUP BY s.tier ORDER BY s.tier ASC
      `;
      params = [season, position, format, week];
    } else {
      query = `
        SELECT s.tier, MIN(s.score) as min_score, MAX(s.score) as max_score, COUNT(*) as count
        FROM player_scores s
        WHERE s.season = ? AND s.position = ? AND s.format = ? AND s.week IS NULL
        GROUP BY s.tier ORDER BY s.tier ASC
      `;
      params = [season, position, format];
    }

    const result = await db.execute(query, params);

    const tiers = result.rows.map((r: any) => ({
      tier: r.tier,
      min_score: Number(r.min_score),
      max_score: Number(r.max_score),
      count: Number(r.count)
    }));

    return res.json({
      season,
      week: format === 'redraft' ? week : undefined,
      position,
      format,
      tiers
    });

  } catch (error) {
    console.error('❌ Ratings tiers error:', error);
    return res.status(500).json({ error: 'Failed to fetch ratings tiers' });
  }
}

export async function recomputeRatings(req: Request, res: Response) {
  try {
    const format = (req.query.format as Format) ?? 'redraft';
    const position = (req.query.position as Position) ?? 'RB';
    const season = parseInt((req.query.season as string) ?? '2024', 10);
    const week = req.query.week ? parseInt(req.query.week as string, 10) : null;
    const weightsOverride = req.query.weights as string;

    let count = 0;

    if (format === 'redraft') {
      if (!week) {
        return res.status(400).json({ error: 'week required for redraft recompute' });
      }
      count = await computeRedraftWeek(season, week, position, weightsOverride);
    } else {
      count = await computeDynastySeason(season, position, weightsOverride);
    }

    return res.json({
      message: `Recomputed ${count} ${position} ${format} ratings`,
      season,
      week: format === 'redraft' ? week : undefined,
      position,
      format,
      count
    });

  } catch (error) {
    console.error('❌ Recompute ratings error:', error);
    return res.status(500).json({ error: 'Failed to recompute ratings' });
  }
}