import Papa from 'papaparse';
import { readBoundedText } from '../../integrations/boundedFetch';

export const SCHEDULE_URL = 'https://raw.githubusercontent.com/nflverse/nfldata/master/data/games.csv';
const teams = new Set('ARI ATL BAL BUF CAR CHI CIN CLE DAL DEN DET GB HOU IND JAX KC LAC LAR LV MIA MIN NE NO NYG NYJ PHI PIT SEA SF TB TEN WAS'.split(' '));
// nflverse uses LA for the Rams. This is an explicit team-code mapping, not a player join.
const canonical = (team: string) => team === 'LA' ? 'LAR' : team;
export type Schedule = { season: string; receivedAt: string; sourceUrl: string; byeWeeks: Record<string, number> };

/** A missing game becomes a bye only after complete modern regular-season coverage. */
export function compileSchedule(csv: string, season: string, receivedAt: string): Schedule {
  if (!/^20\d{2}$/.test(season) || Number(season) < 2021) throw new Error('Unsupported schedule season');
  const parsed = Papa.parse<Record<string, string>>(csv, { header: true, skipEmptyLines: true });
  if (parsed.errors.length || parsed.data.length > 20_000) throw new Error('Malformed schedule');
  const rows = parsed.data.filter(r => r.season === season && r.game_type === 'REG');
  if (rows.length !== 272) throw new Error('Incomplete regular-season schedule');
  const ids = new Set<string>();
  const weeks = Object.fromEntries(Array.from(teams).map(team => [team, new Set<number>()]));
  for (const row of rows) {
    const week = Number(row.week), home = canonical(row.home_team), away = canonical(row.away_team);
    if (!row.game_id || ids.has(row.game_id) || !/^\d{4}-\d{2}-\d{2}$/.test(row.gameday)
        || !Number.isInteger(week) || week < 1 || week > 18 || home === away
        || !teams.has(home) || !teams.has(away) || weeks[home].has(week) || weeks[away].has(week)) {
      throw new Error('Conflicting schedule coverage');
    }
    ids.add(row.game_id); weeks[home].add(week); weeks[away].add(week);
  }
  const byeWeeks: Record<string, number> = {};
  for (const team of Array.from(teams)) {
    if (weeks[team].size !== 17) throw new Error('Incomplete team schedule');
    byeWeeks[team] = Array.from({ length: 18 }, (_, i) => i + 1).find(w => !weeks[team].has(w))!;
  }
  return { season, receivedAt, sourceUrl: SCHEDULE_URL, byeWeeks };
}
let cached: Schedule | null = null;
let inFlight: Promise<Schedule> | null = null;
export async function getSchedule(season: string): Promise<Schedule> {
  if (cached?.season === season && Date.now() - Date.parse(cached.receivedAt) < 3_600_000) return cached;
  if (inFlight) { await inFlight.catch(() => {}); return getSchedule(season); }
  inFlight = (async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    try {
      const response = await fetch(SCHEDULE_URL, { signal: controller.signal, redirect: 'manual' });
      if (!response.ok) { await response.body?.cancel(); throw new Error('Schedule unavailable'); }
      cached = compileSchedule(await readBoundedText(response, 4 * 1024 * 1024), season, new Date().toISOString());
      return cached;
    } finally { clearTimeout(timer); }
  })().finally(() => { inFlight = null; });
  return inFlight;
}
