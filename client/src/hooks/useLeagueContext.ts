import { useQuery } from '@tanstack/react-query';

export interface LeagueContext {
  league: {
    name: string;
    season: string;
    scoring: 'half' | 'ppr' | 'std';
  };
  teams: Array<{
    teamId: string;
    ownerId: string;
    displayName: string;
    players: string[];
  }>;
  players: Record<string, {
    player_id: string;
    full_name: string;
    position: string;
    team: string | null;
  }>;
}

/**
 * Hook for fetching league context including teams and players.
 * For demo purposes, this uses a mock league ID. In production, this would
 * come from user authentication or URL parameters.
 */
export function useLeagueContext() {
  // For demo purposes, using a hardcoded league ID
  // In production, this would come from user state or URL params
  const leagueId = 'demo_league_12345';

  const { data: leagueContext, isLoading: loading, error, refetch } = useQuery<LeagueContext>({
    queryKey: [`/api/sleeper/league/${leagueId}/context`],
    queryFn: async () => {
      // Since we don't have a real league context endpoint working yet,
      // we'll create a mock structure that matches the expected interface
      // This would normally fetch from `/api/sleeper/league/${leagueId}/context`
      
      // Mock data structure matching the expected LeagueContext interface
      return {
        league: {
          name: "The Championship",
          season: "2024",
          scoring: "ppr" as const
        },
        teams: [
          {
            teamId: "team_001",
            ownerId: "user_001", 
            displayName: "Dynasty Destroyers",
            players: ["player_1", "player_2", "player_3", "player_4"]
          },
          {
            teamId: "team_002",
            ownerId: "user_002",
            displayName: "Gridiron Gladiators", 
            players: ["player_5", "player_6", "player_7", "player_8"]
          },
          {
            teamId: "team_003",
            ownerId: "user_003",
            displayName: "Fantasy Phenoms",
            players: ["player_9", "player_10", "player_11", "player_12"]
          },
          {
            teamId: "team_004", 
            ownerId: "user_004",
            displayName: "Championship Chasers",
            players: ["player_13", "player_14", "player_15", "player_16"]
          }
        ],
        players: {
          "player_1": { player_id: "player_1", full_name: "Ja'Marr Chase", position: "WR", team: "CIN" },
          "player_2": { player_id: "player_2", full_name: "Josh Allen", position: "QB", team: "BUF" },
          "player_3": { player_id: "player_3", full_name: "Christian McCaffrey", position: "RB", team: "SF" },
          "player_4": { player_id: "player_4", full_name: "Travis Kelce", position: "TE", team: "KC" },
          "player_5": { player_id: "player_5", full_name: "Tyreek Hill", position: "WR", team: "MIA" },
          "player_6": { player_id: "player_6", full_name: "Lamar Jackson", position: "QB", team: "BAL" },
          "player_7": { player_id: "player_7", full_name: "Derrick Henry", position: "RB", team: "BAL" },
          "player_8": { player_id: "player_8", full_name: "Mark Andrews", position: "TE", team: "BAL" },
          "player_9": { player_id: "player_9", full_name: "Cooper Kupp", position: "WR", team: "LAR" },
          "player_10": { player_id: "player_10", full_name: "Patrick Mahomes", position: "QB", team: "KC" },
          "player_11": { player_id: "player_11", full_name: "Alvin Kamara", position: "RB", team: "NO" },
          "player_12": { player_id: "player_12", full_name: "George Kittle", position: "TE", team: "SF" },
          "player_13": { player_id: "player_13", full_name: "Davante Adams", position: "WR", team: "LV" },
          "player_14": { player_id: "player_14", full_name: "Aaron Rodgers", position: "QB", team: "NYJ" },
          "player_15": { player_id: "player_15", full_name: "Saquon Barkley", position: "RB", team: "PHI" },
          "player_16": { player_id: "player_16", full_name: "T.J. Hockenson", position: "TE", team: "MIN" }
        }
      };
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 2,
  });

  return {
    leagueContext,
    loading,
    error,
    refetch,
  };
}