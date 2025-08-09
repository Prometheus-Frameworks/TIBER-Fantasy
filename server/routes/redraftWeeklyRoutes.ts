import { Router, Request, Response } from 'express';
import fs from 'node:fs';
import readline from 'node:readline';
import path from 'node:path';

const router = Router();

const WAREHOUSE_PATH = path.join(process.cwd(), 'warehouse/2024_weekly.jsonl');
const FANTASY_POSITIONS = new Set(['QB', 'RB', 'WR', 'TE', 'K', 'DST']);

interface WarehouseRecord {
  player_id: string;
  player_name?: string;
  season: number;
  week: number;
  team: string;
  position: string;
  routes?: number | null;
  targets?: number | null;
  air_yards?: number | null;
  receptions?: number | null;
  receiving_yards?: number | null;
  receiving_tds?: number | null;
  rushing_att?: number | null;
  rushing_yards?: number | null;
  rushing_tds?: number | null;
  fantasy_ppr?: number | null;
  depth_rank?: string | null;
  formation?: string | null;
}

interface ApiResponse {
  data: WarehouseRecord[];
  next_cursor: string | null;
  total_filtered?: number;
}

// GET /api/redraft/weekly
router.get('/weekly', async (req: Request, res: Response) => {
  try {
    const season = Number(req.query.season ?? 2024);
    const week = req.query.week ? Number(req.query.week) : null;
    const team = (req.query.team as string)?.toUpperCase() || '';
    const posParam = (req.query.pos as string) ?? 'QB,RB,WR,TE,K,DST';
    const limit = Number(req.query.limit ?? 200);
    const cursor = (req.query.cursor as string) ?? '';
    const sort = ((req.query.sort as string) ?? 'routes').toLowerCase();
    const order = ((req.query.order as string) ?? 'desc').toLowerCase();

    const allowedPos = new Set(
      posParam.split(',').map(s => s.trim().toUpperCase())
    );
    
    // Check if warehouse file exists
    if (!fs.existsSync(WAREHOUSE_PATH)) {
      return res.status(404).json({ 
        error: 'Warehouse data not found. Run the data pipeline first.' 
      });
    }

    const fileStream = fs.createReadStream(WAREHOUSE_PATH, { encoding: 'utf8' });
    const rl = readline.createInterface({ 
      input: fileStream, 
      crlfDelay: Infinity 
    });

    const rows: WarehouseRecord[] = [];
    let passedCursor = !cursor;
    let totalFiltered = 0;

    for await (const line of rl) {
      if (!line.trim()) continue;
      
      try {
        // Handle NaN values by replacing them with null before parsing
        const cleanLine = line.replace(/:\s*NaN\b/g, ': null');
        const record = JSON.parse(cleanLine) as WarehouseRecord;
        
        // Apply filters
        if (record.season !== season) continue;
        if (week !== null && record.week !== week) continue;
        if (team && record.team !== team) continue;
        if (!allowedPos.has(record.position)) continue;

        totalFiltered++;

        // Handle cursor pagination
        if (!passedCursor) {
          if (record.player_id === cursor) {
            passedCursor = true;
          }
          continue;
        }

        // Clean up the record for API response
        const cleanRecord: WarehouseRecord = {
          player_id: record.player_id,
          player_name: record.player_name || undefined,
          season: record.season,
          week: record.week,
          team: record.team,
          position: record.position,
          routes: record.routes ?? null,
          targets: record.targets ?? null,
          air_yards: record.air_yards ?? null,
          receptions: record.receptions ?? null,
          receiving_yards: record.receiving_yards ?? null,
          receiving_tds: record.receiving_tds ?? null,
          rushing_att: record.rushing_att ?? null,
          rushing_yards: record.rushing_yards ?? null,
          rushing_tds: record.rushing_tds ?? null,
          fantasy_ppr: record.fantasy_ppr ?? null,
          depth_rank: record.depth_rank ?? null,
          formation: record.formation ?? null
        };

        rows.push(cleanRecord);
        
        if (rows.length >= limit) break;
      } catch (parseError) {
        console.warn('Failed to parse warehouse line:', parseError);
        continue;
      }
    }

    rl.close();

    // Sort rows by the requested metric
    rows.sort((a: any, b: any) => {
      const av = a[sort] ?? -Infinity;
      const bv = b[sort] ?? -Infinity;
      return order === 'asc' ? (av - bv) : (bv - av);
    });

    const next_cursor = rows.length >= limit && rows.length > 0 
      ? rows[rows.length - 1].player_id 
      : null;

    const response: ApiResponse = {
      data: rows,
      next_cursor,
      total_filtered: totalFiltered
    };

    res.json(response);

  } catch (error) {
    console.error('Error in redraft weekly API:', error);
    res.status(500).json({ 
      error: 'Failed to fetch weekly data',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /api/redraft/weeks - Get available weeks for a season
router.get('/weeks', async (req: Request, res: Response) => {
  try {
    const season = Number(req.query.season ?? 2024);
    
    if (!fs.existsSync(WAREHOUSE_PATH)) {
      return res.status(404).json({ 
        error: 'Warehouse data not found' 
      });
    }

    const fileStream = fs.createReadStream(WAREHOUSE_PATH, { encoding: 'utf8' });
    const rl = readline.createInterface({ 
      input: fileStream, 
      crlfDelay: Infinity 
    });

    const weeks = new Set<number>();

    for await (const line of rl) {
      if (!line.trim()) continue;
      
      try {
        const record = JSON.parse(line);
        if (record.season === season && typeof record.week === 'number') {
          weeks.add(record.week);
        }
      } catch (parseError) {
        continue;
      }
    }

    rl.close();

    const sortedWeeks = Array.from(weeks).sort((a, b) => a - b);
    
    res.json({ 
      season, 
      weeks: sortedWeeks,
      latest_week: sortedWeeks[sortedWeeks.length - 1] || null
    });

  } catch (error) {
    console.error('Error fetching weeks:', error);
    res.status(500).json({ 
      error: 'Failed to fetch available weeks' 
    });
  }
});

// GET /api/redraft/teams - Get all teams
router.get('/teams', async (req: Request, res: Response) => {
  try {
    const season = Number(req.query.season ?? 2024);
    
    if (!fs.existsSync(WAREHOUSE_PATH)) {
      return res.status(404).json({ 
        error: 'Warehouse data not found' 
      });
    }

    const fileStream = fs.createReadStream(WAREHOUSE_PATH, { encoding: 'utf8' });
    const rl = readline.createInterface({ 
      input: fileStream, 
      crlfDelay: Infinity 
    });

    const teams = new Set<string>();

    for await (const line of rl) {
      if (!line.trim()) continue;
      
      try {
        const record = JSON.parse(line);
        if (record.season === season && record.team) {
          teams.add(record.team);
        }
      } catch (parseError) {
        continue;
      }
    }

    rl.close();

    const sortedTeams = Array.from(teams).sort();
    
    res.json({ 
      season, 
      teams: sortedTeams 
    });

  } catch (error) {
    console.error('Error fetching teams:', error);
    res.status(500).json({ 
      error: 'Failed to fetch teams' 
    });
  }
});

// GET /api/redraft/rookies - Filter for rookie players
router.get('/rookies', async (req: Request, res: Response) => {
  try {
    const season = Number(req.query.season ?? 2024);
    const week = req.query.week ? Number(req.query.week) : null;
    const limit = Number(req.query.limit ?? 50);
    const cursor = (req.query.cursor as string) ?? '';

    // For now, we'll identify "rookies" as players with high fantasy_ppr values
    // In a real implementation, this would filter by rookie year
    const posParam = 'WR,RB,TE,QB'; // Focus on skill positions for rookies
    const allowedPos = new Set(posParam.split(','));
    
    if (!fs.existsSync(WAREHOUSE_PATH)) {
      return res.status(404).json({ 
        error: 'Warehouse data not found. Run the data pipeline first.' 
      });
    }

    const fileStream = fs.createReadStream(WAREHOUSE_PATH, { encoding: 'utf8' });
    const rl = readline.createInterface({ 
      input: fileStream, 
      crlfDelay: Infinity 
    });

    const rows: WarehouseRecord[] = [];
    let passedCursor = !cursor;
    let totalFiltered = 0;

    for await (const line of rl) {
      if (!line.trim()) continue;
      
      try {
        const cleanLine = line.replace(/:\s*NaN\b/g, ': null');
        const record = JSON.parse(cleanLine) as WarehouseRecord;
        
        // Apply basic filters
        if (record.season !== season) continue;
        if (week !== null && record.week !== week) continue;
        if (!allowedPos.has(record.position)) continue;
        
        // Rookie filter: Players with fantasy production (rough approximation)
        if (!record.fantasy_ppr || record.fantasy_ppr <= 0) continue;

        totalFiltered++;

        // Handle cursor pagination
        if (!passedCursor) {
          if (record.player_id === cursor) {
            passedCursor = true;
          }
          continue;
        }

        const cleanRecord: WarehouseRecord = {
          player_id: record.player_id,
          player_name: record.player_name || undefined,
          season: record.season,
          week: record.week,
          team: record.team,
          position: record.position,
          routes: record.routes ?? null,
          targets: record.targets ?? null,
          air_yards: record.air_yards ?? null,
          receptions: record.receptions ?? null,
          receiving_yards: record.receiving_yards ?? null,
          receiving_tds: record.receiving_tds ?? null,
          rushing_att: record.rushing_att ?? null,
          rushing_yards: record.rushing_yards ?? null,
          rushing_tds: record.rushing_tds ?? null,
          fantasy_ppr: record.fantasy_ppr ?? null,
          depth_rank: record.depth_rank ?? null,
          formation: record.formation ?? null
        };

        rows.push(cleanRecord);
        
        if (rows.length >= limit) break;
      } catch (parseError) {
        console.warn('Failed to parse warehouse line:', parseError);
        continue;
      }
    }

    rl.close();

    // Sort by fantasy_ppr descending to get top performers
    rows.sort((a, b) => (b.fantasy_ppr || 0) - (a.fantasy_ppr || 0));

    const next_cursor = rows.length >= limit && rows.length > 0 
      ? rows[rows.length - 1].player_id 
      : null;

    const response: ApiResponse = {
      data: rows,
      next_cursor,
      total_filtered: totalFiltered
    };

    res.json(response);

  } catch (error) {
    console.error('Error in redraft rookies API:', error);
    res.status(500).json({ 
      error: 'Failed to fetch rookie data',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;