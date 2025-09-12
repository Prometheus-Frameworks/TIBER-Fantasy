// src/data/providers/sleeperLeagues.ts
// Fetch user leagues and league rosters from Sleeper API

import { cacheKey, getCache, setCache } from "../cache";
import { BasicPlayer } from "../resolvers/playerResolver";

export interface SleeperLeague {
  leagueId: string;
  name: string;
  season: number;
  scoring: {
    ppr?: number;
    sf?: boolean;
    te_premium?: number;
  };
  totalRosters: number;
  status: string;
}

export async function fetchSleeperLeagues(username: string): Promise<SleeperLeague[]> {
  const key = cacheKey(["slpLeagues", username]);
  const cached = getCache<SleeperLeague[]>(key);
  if (cached) return cached;

  try {
    // Use existing Sleeper integration if available
    const response = await fetch(`/api/sleeper/user/${username}/leagues/2025`);
    
    if (!response.ok) {
      // Fallback: return demo league
      const fallback: SleeperLeague[] = [
        { 
          leagueId: "demo_league", 
          name: "Demo League (Connect Sleeper for real leagues)",
          season: 2025, 
          scoring: { ppr: 1.0, sf: false },
          totalRosters: 12,
          status: "demo"
        }
      ];
      setCache(key, fallback, 30_000);
      return fallback;
    }

    const data = await response.json();
    
    // Transform Sleeper league data
    const leagues: SleeperLeague[] = (data.leagues || data || []).map((league: any) => ({
      leagueId: league.league_id || league.leagueId,
      name: league.name,
      season: league.season || 2025,
      scoring: {
        ppr: league.scoring_settings?.rec || league.scoring?.ppr || 1.0,
        sf: league.roster_positions?.includes('SUPER_FLEX') || false,
        te_premium: league.scoring_settings?.rec_te || league.scoring?.te_premium || 0,
      },
      totalRosters: league.total_rosters || 12,
      status: league.status || "active"
    }));

    setCache(key, leagues, 10 * 60_000); // 10 minute cache
    return leagues;
  } catch (error) {
    console.error('[sleeper-leagues]', error);
    
    // Return demo league on error
    const fallback: SleeperLeague[] = [
      { 
        leagueId: "demo_league", 
        name: "Demo League (Sleeper connection failed)",
        season: 2025, 
        scoring: { ppr: 1.0, sf: false },
        totalRosters: 12,
        status: "demo"
      }
    ];
    
    setCache(key, fallback, 2 * 60_000);
    return fallback;
  }
}

export async function fetchLeaguePlayers(leagueId: string): Promise<BasicPlayer[]> {
  const key = cacheKey(["slpLeaguePlayers", leagueId]);
  const cached = getCache<BasicPlayer[]>(key);
  if (cached) return cached;

  try {
    // For demo league, return common players
    if (leagueId === "demo_league") {
      const demoPlayers: BasicPlayer[] = [
        { id: "josh_allen", name: "Josh Allen", team: "BUF", position: "QB" },
        { id: "lamar_jackson", name: "Lamar Jackson", team: "BAL", position: "QB" },
        { id: "patrick_mahomes", name: "Patrick Mahomes", team: "KC", position: "QB" },
        { id: "christian_mccaffrey", name: "Christian McCaffrey", team: "SF", position: "RB" },
        { id: "austin_ekeler", name: "Austin Ekeler", team: "WAS", position: "RB" },
        { id: "justin_jefferson", name: "Justin Jefferson", team: "MIN", position: "WR" },
        { id: "puka_nacua", name: "Puka Nacua", team: "LAR", position: "WR" },
        { id: "cooper_kupp", name: "Cooper Kupp", team: "LAR", position: "WR" },
        { id: "travis_kelce", name: "Travis Kelce", team: "KC", position: "TE" },
        { id: "tj_hockenson", name: "T.J. Hockenson", team: "MIN", position: "TE" },
      ];
      setCache(key, demoPlayers, 5 * 60_000);
      return demoPlayers;
    }

    // Get league rosters from Sleeper
    const [rostersResponse, playersResponse] = await Promise.allSettled([
      fetch(`/api/sleeper/league/${leagueId}/rosters`),
      fetch('/api/sleeper/players') // All Sleeper players
    ]);

    let leaguePlayers: BasicPlayer[] = [];

    // Combine roster players with all available players
    if (rostersResponse.status === 'fulfilled' && rostersResponse.value.ok) {
      const rosters = await rostersResponse.value.json();
      
      if (playersResponse.status === 'fulfilled' && playersResponse.value.ok) {
        const allPlayers = await playersResponse.value.json();
        const playerMap = allPlayers.players || allPlayers;
        
        // Get unique player IDs from all rosters
        const rosterPlayerIds = new Set<string>();
        (rosters.rosters || rosters || []).forEach((roster: any) => {
          (roster.players || []).forEach((playerId: string) => {
            rosterPlayerIds.add(playerId);
          });
        });
        
        // Convert to BasicPlayer format
        leaguePlayers = Array.from(rosterPlayerIds)
          .map(playerId => {
            const player = playerMap[playerId];
            if (!player) return null;
            
            const name = `${player.first_name || ''} ${player.last_name || ''}`.trim() || player.full_name;
            const position = player.position || player.fantasy_positions?.[0];
            
            if (!name || !position || !['QB', 'RB', 'WR', 'TE'].includes(position)) {
              return null;
            }
            
            return {
              id: playerId,
              name,
              team: player.team,
              position: position as "QB" | "RB" | "WR" | "TE"
            };
          })
          .filter((p): p is BasicPlayer => p !== null);
      }
    }
    
    // Fallback to common players if league fetch fails
    if (leaguePlayers.length === 0) {
      leaguePlayers = [
        { id: "josh_allen", name: "Josh Allen", team: "BUF", position: "QB" },
        { id: "lamar_jackson", name: "Lamar Jackson", team: "BAL", position: "QB" },
        { id: "puka_nacua", name: "Puka Nacua", team: "LAR", position: "WR" },
        { id: "cooper_kupp", name: "Cooper Kupp", team: "LAR", position: "WR" },
        { id: "christian_mccaffrey", name: "Christian McCaffrey", team: "SF", position: "RB" },
        { id: "travis_kelce", name: "Travis Kelce", team: "KC", position: "TE" },
      ];
    }

    setCache(key, leaguePlayers, 15 * 60_000); // 15 minute cache
    return leaguePlayers;
  } catch (error) {
    console.error('[sleeper-league-players]', error);
    
    // Fallback players
    const fallback: BasicPlayer[] = [
      { id: "josh_allen", name: "Josh Allen", team: "BUF", position: "QB" },
      { id: "lamar_jackson", name: "Lamar Jackson", team: "BAL", position: "QB" },
      { id: "puka_nacua", name: "Puka Nacua", team: "LAR", position: "WR" },
      { id: "christian_mccaffrey", name: "Christian McCaffrey", team: "SF", position: "RB" },
      { id: "travis_kelce", name: "Travis Kelce", team: "KC", position: "TE" },
    ];
    
    setCache(key, fallback, 2 * 60_000);
    return fallback;
  }
}