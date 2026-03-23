export interface TeamReference {
  code: string;
  city: string;
  nickname: string;
  conference: string;
  division: string;
}

export const NFL_TEAM_REFERENCE: Record<string, TeamReference> = {
  ARI: { code: 'ARI', city: 'Arizona', nickname: 'Cardinals', conference: 'NFC', division: 'West' },
  ATL: { code: 'ATL', city: 'Atlanta', nickname: 'Falcons', conference: 'NFC', division: 'South' },
  BAL: { code: 'BAL', city: 'Baltimore', nickname: 'Ravens', conference: 'AFC', division: 'North' },
  BUF: { code: 'BUF', city: 'Buffalo', nickname: 'Bills', conference: 'AFC', division: 'East' },
  CAR: { code: 'CAR', city: 'Carolina', nickname: 'Panthers', conference: 'NFC', division: 'South' },
  CHI: { code: 'CHI', city: 'Chicago', nickname: 'Bears', conference: 'NFC', division: 'North' },
  CIN: { code: 'CIN', city: 'Cincinnati', nickname: 'Bengals', conference: 'AFC', division: 'North' },
  CLE: { code: 'CLE', city: 'Cleveland', nickname: 'Browns', conference: 'AFC', division: 'North' },
  DAL: { code: 'DAL', city: 'Dallas', nickname: 'Cowboys', conference: 'NFC', division: 'East' },
  DEN: { code: 'DEN', city: 'Denver', nickname: 'Broncos', conference: 'AFC', division: 'West' },
  DET: { code: 'DET', city: 'Detroit', nickname: 'Lions', conference: 'NFC', division: 'North' },
  GB: { code: 'GB', city: 'Green Bay', nickname: 'Packers', conference: 'NFC', division: 'North' },
  HOU: { code: 'HOU', city: 'Houston', nickname: 'Texans', conference: 'AFC', division: 'South' },
  IND: { code: 'IND', city: 'Indianapolis', nickname: 'Colts', conference: 'AFC', division: 'South' },
  JAX: { code: 'JAX', city: 'Jacksonville', nickname: 'Jaguars', conference: 'AFC', division: 'South' },
  KC: { code: 'KC', city: 'Kansas City', nickname: 'Chiefs', conference: 'AFC', division: 'West' },
  LV: { code: 'LV', city: 'Las Vegas', nickname: 'Raiders', conference: 'AFC', division: 'West' },
  LAC: { code: 'LAC', city: 'Los Angeles', nickname: 'Chargers', conference: 'AFC', division: 'West' },
  LAR: { code: 'LAR', city: 'Los Angeles', nickname: 'Rams', conference: 'NFC', division: 'West' },
  MIA: { code: 'MIA', city: 'Miami', nickname: 'Dolphins', conference: 'AFC', division: 'East' },
  MIN: { code: 'MIN', city: 'Minnesota', nickname: 'Vikings', conference: 'NFC', division: 'North' },
  NE: { code: 'NE', city: 'New England', nickname: 'Patriots', conference: 'AFC', division: 'East' },
  NO: { code: 'NO', city: 'New Orleans', nickname: 'Saints', conference: 'NFC', division: 'South' },
  NYG: { code: 'NYG', city: 'New York', nickname: 'Giants', conference: 'NFC', division: 'East' },
  NYJ: { code: 'NYJ', city: 'New York', nickname: 'Jets', conference: 'AFC', division: 'East' },
  PHI: { code: 'PHI', city: 'Philadelphia', nickname: 'Eagles', conference: 'NFC', division: 'East' },
  PIT: { code: 'PIT', city: 'Pittsburgh', nickname: 'Steelers', conference: 'AFC', division: 'North' },
  SF: { code: 'SF', city: 'San Francisco', nickname: '49ers', conference: 'NFC', division: 'West' },
  SEA: { code: 'SEA', city: 'Seattle', nickname: 'Seahawks', conference: 'NFC', division: 'West' },
  TB: { code: 'TB', city: 'Tampa Bay', nickname: 'Buccaneers', conference: 'NFC', division: 'South' },
  TEN: { code: 'TEN', city: 'Tennessee', nickname: 'Titans', conference: 'AFC', division: 'South' },
  WAS: { code: 'WAS', city: 'Washington', nickname: 'Commanders', conference: 'NFC', division: 'East' },
};

export function getTeamReference(team: string | null | undefined): TeamReference | null {
  if (!team) {
    return null;
  }

  return NFL_TEAM_REFERENCE[team.trim().toUpperCase()] ?? null;
}

export function getTeamDisplayName(team: string | null | undefined): string | null {
  const reference = getTeamReference(team);
  if (!reference) {
    return team?.trim() || null;
  }

  return `${reference.city} ${reference.nickname}`;
}
