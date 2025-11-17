import { WeeklyRow } from '../../shared/types/fantasy';
import { hydrateFantasyVariants } from '../lib/scoring';
import { getCurrentNFLWeek } from '../lib/timebox';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const execAsync = promisify(exec);

/**
 * Fetch weekly stats from NFLfastR via Python wrapper.
 * 
 * @param season - NFL season year (e.g., 2025)
 * @param week - Week number (1-18)
 * @returns Array of WeeklyRow with hydrated fantasy points
 */
export async function fetchWeeklyFromNflfastR(season: number, week: number): Promise<WeeklyRow[]> {
  // GUARDRAIL: Prevent full-season fetches for current year
  if (week === undefined || week < 1 || week > 18) {
    throw new Error(
      `[NFLfastR] Invalid week: ${week}. Must specify week 1-18. ` +
      `Use fetchSeasonToDate(${season}) for season-wide data.`
    );
  }
  
  try {
    const scriptPath = path.join(__dirname, 'fetch-weekly.py');
    const { stdout, stderr } = await execAsync(`python3 ${scriptPath} ${season} ${week}`);
    
    if (stderr) {
      console.warn(`[NFLfastR] Python stderr for season=${season} week=${week}:`, stderr);
    }
    
    // Strip any non-JSON text before the opening bracket (pandas warnings, etc.)
    const jsonStart = stdout.indexOf('[');
    const cleanOutput = jsonStart >= 0 ? stdout.substring(jsonStart) : stdout;
    
    const raw: any[] = JSON.parse(cleanOutput);
    
    if (raw.length === 0) {
      console.warn(`[NFLfastR] No data returned for season=${season} week=${week}`);
      return [];
    }
    
    // Map Python output to WeeklyRow interface
    const rows = raw.map(mapNflfastRToWeeklyRow);
    
    // Hydrate fantasy points for all scoring formats
    const hydrated = rows.map(hydrateFantasyVariants);
    
    // Sanity filter: drop rows with zero stats
    return hydrated.filter(r =>
      (r.rush_att ?? 0) + (r.targets ?? 0) + (r.rec ?? 0) + (r.pass_yd ?? 0) > 0
    );
  } catch (error) {
    throw new Error(
      `[NFLfastR] Failed to fetch season=${season} week=${week}: ${(error as Error).message}`
    );
  }
}

/**
 * Fetch season-to-date weekly stats (weeks 1..N).
 * Never tries to fetch "full season" for current year.
 * 
 * @param season - NFL season year (e.g., 2025)
 * @returns Array of all weekly stats for completed weeks
 */
export async function fetchSeasonToDate(season: number): Promise<WeeklyRow[]> {
  const endWeek = getCurrentNFLWeek(season);
  
  if (endWeek === 0) {
    console.warn(`[NFLfastR] Season ${season} has not started yet`);
    return [];
  }
  
  const all: WeeklyRow[] = [];
  
  for (let w = 1; w <= endWeek; w++) {
    try {
      console.log(`[NFLfastR] Fetching season=${season} week=${w}...`);
      const wk = await fetchWeeklyFromNflfastR(season, w);
      all.push(...wk);
      console.log(`[NFLfastR] ✓ Week ${w}: ${wk.length} player records`);
    } catch (e) {
      console.warn(`[NFLfastR] ✗ Skip season=${season} week=${w}:`, (e as Error).message);
      // Continue to next week instead of failing the entire job
    }
  }
  
  console.log(`[NFLfastR] Season ${season} complete: ${all.length} total records (weeks 1-${endWeek})`);
  return all;
}

/**
 * Map NFLfastR/nfl_data_py output to WeeklyRow interface.
 * Handles field name normalization and type conversion.
 */
function mapNflfastRToWeeklyRow(x: any): WeeklyRow {
  return {
    season: Number(x.season),
    week: Number(x.week),
    player_id: x.player_id ?? `${x.player_name}_${x.season}_${x.week}`,
    player_name: x.player_name ?? x.player,
    team: x.team ?? x.recent_team ?? x.posteam,
    position: x.position as 'QB' | 'RB' | 'WR' | 'TE',
    
    // Usage (optional fields from NFLfastR)
    snaps: x.offense_snaps ?? undefined,
    routes: x.routes_run ?? undefined,
    targets: x.targets ?? undefined,
    rush_att: x.rush_att ?? 0,
    
    // Production
    rec: x.rec ?? 0,
    rec_yd: x.rec_yd ?? 0,
    rec_td: x.rec_td ?? 0,
    rush_yd: x.rush_yd ?? 0,
    rush_td: x.rush_td ?? 0,
    pass_yd: x.pass_yd ?? 0,
    pass_td: x.pass_td ?? 0,
    int: x.int ?? 0,
    fumbles: x.fumbles ?? 0,
    two_pt: x.two_pt ?? 0,
    
    // Crosswalk ID
    gsis_id: x.gsis_id ?? undefined,
  };
}
