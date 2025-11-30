// src/data/providers/oasis.ts
// Pull team/position matchup from your OASIS service
//
// TODO: Replace OASIS with internal FORGE SoS module
// See: docs/oasis_audit.md for migration plan
// Target: Rename to forge.ts and use /api/forge/matchup endpoint

import { cacheKey, getCache, setCache } from "../cache";
import { NFLTeam, OasisMatchup } from "../interfaces";

export interface OasisMatchupWithProvenance extends OasisMatchup {
  __source: string;
  __mock: boolean;
}

export async function fetchOasisMatchup(team: NFLTeam, position: string): Promise<OasisMatchupWithProvenance> {
  const key = cacheKey(["oasis", team, position]);
  const cached = getCache<OasisMatchupWithProvenance>(key);
  if (cached) return cached;

  try {
    // Use existing OASIS integration
    const response = await fetch(`http://localhost:5000/api/oasis/matchup?team=${team}&position=${position}`);
    
    if (!response.ok) {
      // Fallback to neutral matchup
      const fallback: OasisMatchupWithProvenance = {
        defRankVsPos: 16,          // middle of pack
        oasisMatchupScore: 50,     // neutral
        olHealthIndex: 75,         // decent
        __source: "oasis_api_fallback",
        __mock: true,
      };
      setCache(key, fallback, 2 * 60_000);
      return fallback;
    }

    const data = await response.json();
    
    const matchup: OasisMatchupWithProvenance = {
      defRankVsPos: data.defense_rank_vs_position || data.defRankVsPos || 16,
      oasisMatchupScore: data.matchup_score || data.oasisMatchupScore || 50,
      olHealthIndex: data.ol_health_index || data.olHealthIndex || 75,
      __source: "oasis_api_live",
      __mock: false,
    };

    setCache(key, matchup, 30 * 60_000); // 30 minute cache for matchup data
    return matchup;
  } catch (error) {
    console.error('[oasis-matchup]', error);
    
    // Safe neutral defaults
    const fallback: OasisMatchupWithProvenance = {
      defRankVsPos: 16,
      oasisMatchupScore: 50,
      olHealthIndex: 75,
      __source: "oasis_api_error",
      __mock: true,
    };
    
    setCache(key, fallback, 2 * 60_000);
    return fallback;
  }
}