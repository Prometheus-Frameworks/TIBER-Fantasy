/**
 * Sleeper Data Source
 * 
 * Phase B: Ingestion Layers - Pull raw data from Sleeper API
 * Fetches fantasy points, game logs, and player statistics
 */

interface SleeperWeekData {
  [player_id: string]: number;
}

interface SleeperPlayerStats {
  player_id: string;
  fantasy_points: number;
  games_played: number;
  stats: {
    pts_ppr?: number;
    pts_half_ppr?: number;
    pts_std?: number;
  };
}

/**
 * Fetch weekly fantasy points from Sleeper API
 * @param season NFL season
 * @param week NFL week
 * @returns Record of player_id -> fantasy points
 */
export async function fetchWeekPoints(season: number, week: number): Promise<Record<string, number>> {
  try {
    // Use existing Sleeper service endpoint
    const response = await fetch(`/api/sleeper/stats/week?season=${season}&week=${week}`);
    
    if (!response.ok) {
      throw new Error(`Sleeper API failed: ${response.status}`);
    }
    
    const data = await response.json() as SleeperPlayerStats[];
    
    // Convert to player_id -> fantasy points mapping
    const weekPoints: Record<string, number> = {};
    
    for (const player of data) {
      weekPoints[player.player_id] = player.stats.pts_ppr || player.fantasy_points || 0;
    }
    
    return weekPoints;
  } catch (error) {
    console.error(`Failed to fetch Sleeper week ${week} points:`, error);
    return {};
  }
}

/**
 * Fetch player ownership percentages from Sleeper
 * @param season NFL season
 * @param week NFL week
 * @returns Record of player_id -> ownership percentage
 */
export async function fetchOwnership(season: number, week: number): Promise<Record<string, number>> {
  try {
    const response = await fetch(`/api/sleeper/ownership?season=${season}&week=${week}`);
    
    if (!response.ok) {
      throw new Error(`Sleeper ownership API failed: ${response.status}`);
    }
    
    const data = await response.json() as Array<{player_id: string, ownership: number}>;
    
    const ownership: Record<string, number> = {};
    for (const player of data) {
      ownership[player.player_id] = player.ownership;
    }
    
    return ownership;
  } catch (error) {
    console.error(`Failed to fetch Sleeper ownership for week ${week}:`, error);
    return {};
  }
}

/**
 * Fetch trade volume data from Sleeper
 * @param season NFL season
 * @param week NFL week
 * @returns Record of player_id -> trades per week
 */
export async function fetchTradeVolume(season: number, week: number): Promise<Record<string, number>> {
  try {
    const response = await fetch(`/api/sleeper/trades?season=${season}&week=${week}`);
    
    if (!response.ok) {
      throw new Error(`Sleeper trades API failed: ${response.status}`);
    }
    
    const data = await response.json() as Array<{player_id: string, trade_count: number}>;
    
    const tradeVolume: Record<string, number> = {};
    for (const player of data) {
      tradeVolume[player.player_id] = player.trade_count;
    }
    
    return tradeVolume;
  } catch (error) {
    console.error(`Failed to fetch Sleeper trade volume for week ${week}:`, error);
    return {};
  }
}

/**
 * Fetch historical FPG data for EWMA calculation
 * @param player_id Player identifier
 * @param season NFL season
 * @param week Current week
 * @param lookback Number of weeks to look back
 * @returns Array of FPG values (most recent first)
 */
export async function fetchHistoricalFPG(
  player_id: string, 
  season: number, 
  week: number, 
  lookback: number = 3
): Promise<number[]> {
  try {
    const fpgSeries: number[] = [];
    
    // Fetch last N weeks of data
    for (let w = week; w > Math.max(0, week - lookback); w--) {
      const weekData = await fetchWeekPoints(season, w);
      if (weekData[player_id] !== undefined) {
        fpgSeries.push(weekData[player_id]);
      }
    }
    
    return fpgSeries;
  } catch (error) {
    console.error(`Failed to fetch historical FPG for ${player_id}:`, error);
    return [];
  }
}