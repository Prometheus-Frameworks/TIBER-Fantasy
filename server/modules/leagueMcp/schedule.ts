import Papa from 'papaparse';
import { readBoundedText } from '../../integrations/boundedFetch';

export const SCHEDULE_URL = 'https://raw.githubusercontent.com/nflverse/nfldata/master/data/games.csv';
export const SCHEDULE_TEAMS = 'ARI ATL BAL BUF CAR CHI CIN CLE DAL DEN DET GB HOU IND JAX KC LAC LAR LV MIA MIN NE NO NYG NYJ PHI PIT SEA SF TB TEN WAS'.split(' ');
const teams = new Set(SCHEDULE_TEAMS);
// nflverse uses LA for the Rams. This is an explicit team-code mapping, not a player join.
const canonical = (team: string) => team === 'LA' ? 'LAR' : team;
/**
 * Hash convention for `contentHash`: SHA-256, lowercase hex, over the UTF-8 encoding of the
 * decoded response text exactly as `readBoundedText` returned it (fatal UTF-8 decoding; a leading
 * BOM is removed by the decoder; no other normalization). It is the same string the compiler
 * parsed. Source bytes are not retained: the hash identifies the fetched content and does not by
 * itself establish historical replay.
 */
export const SCHEDULE_HASH_CONVENTION = 'sha256_hex_utf8_decoded_text_v1';
export type Fixture = { gameId: string; week: number; gameday: string; opponent: string; designation: 'home' | 'away' };
export type Schedule = {
  season: string; receivedAt: string; sourceUrl: string;
  contentHash: string; hashConvention: typeof SCHEDULE_HASH_CONVENTION;
  byeWeeks: Record<string, number>;
  /** 17 validated regular-season fixtures per canonical team, ascending by week; the bye week has no entry. */
  teamWeeks: Record<string, Fixture[]>;
};

export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
}

/** A missing game becomes a bye only after complete modern regular-season coverage. */
export function compileSchedule(csv: string, season: string, receivedAt: string, contentHash: string): Schedule {
  if (!/^20\d{2}$/.test(season) || Number(season) < 2021) throw new Error('Unsupported schedule season');
  if (!/^[0-9a-f]{64}$/.test(contentHash)) throw new Error('Schedule content hash required');
  const parsed = Papa.parse<Record<string, string>>(csv, { header: true, skipEmptyLines: true });
  if (parsed.errors.length || parsed.data.length > 20_000) throw new Error('Malformed schedule');
  const rows = parsed.data.filter(r => r.season === season && r.game_type === 'REG');
  if (rows.length !== 272) throw new Error('Incomplete regular-season schedule');
  const ids = new Set<string>();
  const weeks = Object.fromEntries(Array.from(teams).map(team => [team, new Set<number>()]));
  const teamWeeks: Record<string, Fixture[]> = Object.fromEntries(Array.from(teams).map(team => [team, []]));
  for (const row of rows) {
    const week = Number(row.week), home = canonical(row.home_team), away = canonical(row.away_team);
    const day = Date.parse(`${row.gameday}T00:00:00Z`);
    if (!row.game_id || ids.has(row.game_id) || !/^\d{4}-\d{2}-\d{2}$/.test(row.gameday)
        || !Number.isFinite(day) || new Date(day).toISOString().slice(0, 10) !== row.gameday
        || !Number.isInteger(week) || week < 1 || week > 18 || home === away
        || !teams.has(home) || !teams.has(away) || weeks[home].has(week) || weeks[away].has(week)) {
      throw new Error('Conflicting schedule coverage');
    }
    ids.add(row.game_id); weeks[home].add(week); weeks[away].add(week);
    // One validated row yields both reciprocal team-weeks; designation is the source's home/away label only.
    teamWeeks[home].push({ gameId: row.game_id, week, gameday: row.gameday, opponent: away, designation: 'home' });
    teamWeeks[away].push({ gameId: row.game_id, week, gameday: row.gameday, opponent: home, designation: 'away' });
  }
  const byeWeeks: Record<string, number> = {};
  for (const team of Array.from(teams)) {
    if (weeks[team].size !== 17) throw new Error('Incomplete team schedule');
    byeWeeks[team] = Array.from({ length: 18 }, (_, i) => i + 1).find(w => !weeks[team].has(w))!;
    teamWeeks[team].sort((a, b) => a.week - b.week);
  }
  return { season, receivedAt, sourceUrl: SCHEDULE_URL, contentHash, hashConvention: SCHEDULE_HASH_CONVENTION, byeWeeks, teamWeeks };
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
      if (!response.ok) { void response.body?.cancel().catch(() => {}); throw new Error('Schedule unavailable'); }
      const text = await readBoundedText(response, 4 * 1024 * 1024);
      // The hash and the compiled schedule derive from one text and are cached together.
      cached = compileSchedule(text, season, new Date().toISOString(), await sha256Hex(text));
      return cached;
    } finally { clearTimeout(timer); }
  })().finally(() => { inFlight = null; });
  return inFlight;
}
