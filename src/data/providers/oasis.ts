// src/data/providers/oasis.ts
// Pull team/position matchup from your OASIS service

import { cacheKey, getCache, setCache } from "../cache";
import { NFLTeam, OasisMatchup } from "../interfaces";

export async function fetchOasisMatchup(team: NFLTeam, position: string): Promise<OasisMatchup> {
  const key = cacheKey(["oasis", team, position]);
  const cached = getCache<OasisMatchup>(key);
  if (cached) return cached;

  try {
    // Use existing OASIS integration
    const response = await fetch(`/api/oasis/matchup?team=${team}&position=${position}`);
    
    if (!response.ok) {
      // Fallback to neutral matchup
      const fallback: OasisMatchup = {
        defRankVsPos: 16,          // middle of pack
        oasisMatchupScore: 50,     // neutral
        olHealthIndex: 75,         // decent
      };
      setCache(key, fallback, 2 * 60_000);
      return fallback;
    }

    const data = await response.json();
    
    const matchup: OasisMatchup = {
      defRankVsPos: data.defense_rank_vs_position || data.defRankVsPos || 16,
      oasisMatchupScore: data.matchup_score || data.oasisMatchupScore || 50,
      olHealthIndex: data.ol_health_index || data.olHealthIndex || 75,
    };

    setCache(key, matchup, 30 * 60_000); // 30 minute cache for matchup data
    return matchup;
  } catch (error) {
    console.error('[oasis-matchup]', error);
    
    // Safe neutral defaults
    const fallback: OasisMatchup = {
      defRankVsPos: 16,
      oasisMatchupScore: 50,
      olHealthIndex: 75,
    };
    
    setCache(key, fallback, 2 * 60_000);
    return fallback;
  }
}