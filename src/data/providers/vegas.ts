// src/data/providers/vegas.ts
// Get implied team totals + weather signal from betting lines

import { cacheKey, getCache, setCache } from "../cache";
import { NFLTeam, VegasTeamLine } from "../interfaces";

export async function fetchVegasLine(team: NFLTeam): Promise<VegasTeamLine> {
  const key = cacheKey(["vegas", team]);
  const cached = getCache<VegasTeamLine>(key);
  if (cached) return cached;

  try {
    // Check if you have existing betting lines integration
    const response = await fetch(`/api/vegas/lines?team=${team}`);
    
    if (!response.ok) {
      // Fallback to reasonable team total
      const fallback: VegasTeamLine = {
        team,
        opponent: "JAX", // placeholder
        impliedTeamTotal: 22.5,
        weatherImpact: 0.0, // neutral
      };
      setCache(key, fallback, 5 * 60_000);
      return fallback;
    }

    const data = await response.json();
    
    const line: VegasTeamLine = {
      team,
      opponent: data.opponent || "JAX",
      impliedTeamTotal: data.implied_total || data.impliedTeamTotal || 22.5,
      weatherImpact: data.weather_impact || data.weatherImpact || 0.0,
    };

    setCache(key, line, 15 * 60_000); // 15 minute cache for betting lines
    return line;
  } catch (error) {
    console.error('[vegas-lines]', error);
    
    // Use DraftKings/FanDuel-like average team total as fallback
    const teamTotalMap: Record<NFLTeam, number> = {
      "KC": 28.5, "BUF": 27.0, "BAL": 26.5, "LAR": 25.5, "DAL": 25.0,
      "GB": 24.5, "SF": 24.5, "PHI": 24.0, "CIN": 24.0, "LAC": 23.5,
      "MIA": 23.5, "DEN": 23.0, "MIN": 23.0, "TB": 22.5, "ATL": 22.5,
      "NO": 22.0, "IND": 22.0, "SEA": 22.0, "DET": 21.5, "PIT": 21.5,
      "LV": 21.0, "TEN": 21.0, "HOU": 21.0, "WAS": 20.5, "JAX": 20.0,
      "ARI": 20.0, "NYG": 19.5, "CHI": 19.5, "CAR": 19.0, "NE": 19.0,
      "CLE": 18.5, "NYJ": 18.0
    };
    
    const fallback: VegasTeamLine = {
      team,
      opponent: "JAX",
      impliedTeamTotal: teamTotalMap[team] || 21.5,
      weatherImpact: 0.0,
    };
    
    setCache(key, fallback, 5 * 60_000);
    return fallback;
  }
}