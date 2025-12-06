import axios from 'axios';

interface QBRWeeklyRecord {
  season: number;
  seasonType: string;
  week: number;
  teamAbbr: string;
  playerName: string;
  playerId?: string;
  qbPlays: number;
  epaTotal: number;
  pass: number;
  run: number;
  expSack: number;
  penalty: number;
  qbr: number;
  pts_added: number;
  rank: number;
}

interface QBRSeasonRecord {
  season: number;
  seasonType: string;
  teamAbbr: string;
  playerName: string;
  playerId?: string;
  qbPlays: number;
  epaTotal: number;
  pass: number;
  run: number;
  expSack: number;
  penalty: number;
  qbr: number;
  pts_added: number;
  rank: number;
}

interface PasserRating {
  playerName: string;
  team: string;
  completions: number;
  attempts: number;
  yards: number;
  touchdowns: number;
  interceptions: number;
  rating: number;
}

const QBR_WEEKLY_URL = 'https://raw.githubusercontent.com/nflverse/espnscrapeR-data/master/data/qbr-nfl-weekly.csv';
const QBR_SEASON_URL = 'https://raw.githubusercontent.com/nflverse/espnscrapeR-data/master/data/qbr-nfl-season.csv';

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (const char of line) {
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function parseCSV(csvText: string): Record<string, string>[] {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) return [];
  
  const headers = parseCSVLine(lines[0]);
  const records: Record<string, string>[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const record: Record<string, string> = {};
    headers.forEach((header, idx) => {
      record[header] = values[idx] || '';
    });
    records.push(record);
  }
  
  return records;
}

export async function fetchQBRWeekly(season: number, week?: number): Promise<QBRWeeklyRecord[]> {
  try {
    const response = await axios.get(QBR_WEEKLY_URL, { timeout: 15000 });
    const records = parseCSV(response.data);
    
    return records
      .filter(r => {
        const recordSeason = parseInt(r.season || '0');
        const gameWeek = r.game_week || '';
        const recordWeek = parseInt(gameWeek) || 0;
        const seasonType = r.season_type || '';
        
        if (recordSeason !== season) return false;
        if (seasonType.toLowerCase() !== 'regular') return false;
        if (isNaN(recordWeek) || recordWeek === 0) return false;
        if (week !== undefined && recordWeek !== week) return false;
        return true;
      })
      .map(r => ({
        season: parseInt(r.season || '0'),
        seasonType: r.season_type || 'Regular',
        week: parseInt(r.game_week || '0'),
        teamAbbr: normalizeTeamAbbr(r.team_abb || r.team || ''),
        playerName: r.name_short || r.name_display || '',
        playerId: r.player_id || undefined,
        qbPlays: parseFloat(r.qb_plays || '0'),
        epaTotal: parseFloat(r.epa_total || '0'),
        pass: parseFloat(r.pass || '0'),
        run: parseFloat(r.run || '0'),
        expSack: parseFloat(r.exp_sack || '0'),
        penalty: parseFloat(r.penalty || '0'),
        qbr: parseFloat(r.qbr_total || '0'),
        pts_added: parseFloat(r.pts_added || '0'),
        rank: parseInt(r.rank || '0'),
      }))
      .sort((a, b) => b.qbr - a.qbr);
  } catch (error) {
    console.error('[QBR Service] Failed to fetch weekly QBR:', error);
    return [];
  }
}

export async function fetchQBRSeason(season: number, minPlays: number = 100): Promise<QBRSeasonRecord[]> {
  try {
    const response = await axios.get(QBR_SEASON_URL, { timeout: 15000 });
    const records = parseCSV(response.data);
    
    return records
      .filter(r => {
        const recordSeason = parseInt(r.season || '0');
        const gameWeek = r.game_week || '';
        const seasonType = r.season_type || '';
        const qbPlays = parseFloat(r.qb_plays || '0');
        
        if (recordSeason !== season) return false;
        if (seasonType.toLowerCase() !== 'regular') return false;
        if (gameWeek.toLowerCase() !== 'season total') return false;
        if (qbPlays < minPlays) return false;
        return true;
      })
      .map(r => ({
        season: parseInt(r.season || '0'),
        seasonType: r.season_type || 'Regular',
        teamAbbr: normalizeTeamAbbr(r.team_abb || r.team || ''),
        playerName: r.name_short || r.name_display || '',
        playerId: r.player_id || undefined,
        qbPlays: parseFloat(r.qb_plays || '0'),
        epaTotal: parseFloat(r.epa_total || '0'),
        pass: parseFloat(r.pass || '0'),
        run: parseFloat(r.run || '0'),
        expSack: parseFloat(r.exp_sack || '0'),
        penalty: parseFloat(r.penalty || '0'),
        qbr: parseFloat(r.qbr_total || '0'),
        pts_added: parseFloat(r.pts_added || '0'),
        rank: parseInt(r.rank || '0'),
      }))
      .sort((a, b) => b.qbr - a.qbr);
  } catch (error) {
    console.error('[QBR Service] Failed to fetch season QBR:', error);
    return [];
  }
}

function normalizeTeamAbbr(abbr: string): string {
  const normalized = abbr.toUpperCase().trim();
  const mapping: Record<string, string> = {
    'WSH': 'WAS',
    'JAC': 'JAX',
    'OAK': 'LV',
    'SD': 'LAC',
    'STL': 'LAR',
  };
  return mapping[normalized] || normalized;
}

export function calculatePasserRating(
  completions: number,
  attempts: number,
  yards: number,
  touchdowns: number,
  interceptions: number
): number {
  if (attempts === 0) return 0;
  
  let a = ((completions / attempts) - 0.3) * 5;
  let b = ((yards / attempts) - 3) * 0.25;
  let c = (touchdowns / attempts) * 20;
  let d = 2.375 - ((interceptions / attempts) * 25);
  
  a = Math.max(0, Math.min(2.375, a));
  b = Math.max(0, Math.min(2.375, b));
  c = Math.max(0, Math.min(2.375, c));
  d = Math.max(0, Math.min(2.375, d));
  
  return ((a + b + c + d) / 6) * 100;
}

export interface QBMetricsComparison {
  playerName: string;
  team: string;
  forgeAlpha: number | null;
  forgeTier: string | null;
  espnQbr: number | null;
  passerRating: number | null;
  gamesPlayed: number;
  qbPlays: number | null;
  ptsAdded: number | null;
}

export async function getQBMetricsComparison(season: number): Promise<QBMetricsComparison[]> {
  const qbrData = await fetchQBRSeason(season, 100);
  
  return qbrData.map(qb => ({
    playerName: qb.playerName,
    team: qb.teamAbbr,
    forgeAlpha: null,
    forgeTier: null,
    espnQbr: Math.round(qb.qbr * 10) / 10,
    passerRating: null,
    gamesPlayed: 0,
    qbPlays: qb.qbPlays,
    ptsAdded: Math.round(qb.pts_added * 10) / 10,
  }));
}
