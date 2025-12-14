const BASE_URL = 'https://api.sleeper.app/v1';

export interface SleeperLeague {
  league_id: string;
  name: string;
  season: string;
  scoring_settings?: Record<string, any>;
  total_rosters?: number;
  status?: string;
  roster_positions?: string[];
}

export interface SleeperUser {
  user_id: string;
  display_name: string;
  is_owner?: boolean;
  avatar?: string | null;
  metadata?: Record<string, any>;
  is_bot?: boolean;
  team_name?: string;
  username?: string;
}

export interface SleeperRoster {
  roster_id: number;
  owner_id: string;
  co_owners?: string[] | null;
  players?: string[];
  starters?: string[] | null;
}

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Sleeper API error ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

export const sleeperClient = {
  async getLeague(leagueId: string): Promise<SleeperLeague> {
    return fetchJson<SleeperLeague>(`/league/${leagueId}`);
  },

  async getUser(userIdOrUsername: string): Promise<SleeperUser> {
    return fetchJson<SleeperUser>(`/user/${userIdOrUsername}`);
  },

  async getLeagueUsers(leagueId: string): Promise<SleeperUser[]> {
    return fetchJson<SleeperUser[]>(`/league/${leagueId}/users`);
  },

  async getLeagueRosters(leagueId: string): Promise<SleeperRoster[]> {
    return fetchJson<SleeperRoster[]>(`/league/${leagueId}/rosters`);
  }
};

export function deriveSleeperScoringFormat(scoringSettings?: Record<string, any>): string | null {
  if (!scoringSettings) return null;
  const reception = Number(scoringSettings.rec ?? scoringSettings.recption ?? scoringSettings.rec_per_rx ?? scoringSettings.rec_per_game);

  if (Number.isNaN(reception)) return null;
  if (reception >= 1) return 'ppr';
  if (reception >= 0.5) return 'half_ppr';
  if (reception === 0) return 'standard';
  return `${reception}_ppr`;
}
