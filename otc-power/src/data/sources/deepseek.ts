/**
 * DeepSeek Data Source
 * 
 * Phase B: Ingestion Layers - Pull xFP and usage-based projections
 * Interfaces with DeepSeek v3.2 service for expected fantasy points
 */

interface DeepSeekXFPResponse {
  [player_id: string]: number;
}

interface DeepSeekPlayerData {
  player_id: string;
  xfp_weekly: number;
  usage_score: number;
  role_stability: number;
  quadrant_scores: {
    north: number;   // Talent
    east: number;    // Environment  
    south: number;   // Safety/Risk
    west: number;    // Value/Market
  };
}

/**
 * Fetch expected fantasy points (xFP) from DeepSeek
 * @param season NFL season
 * @param week NFL week
 * @returns Record of player_id -> expected fantasy points
 */
export async function fetchXFP(season: number, week: number): Promise<Record<string, number>> {
  try {
    // Use existing DeepSeek v3.2 endpoint
    const response = await fetch(`/api/rankings/deepseek/v3.2?season=${season}&week=${week}`);
    
    if (!response.ok) {
      throw new Error(`DeepSeek API failed: ${response.status}`);
    }
    
    const data = await response.json() as { players: DeepSeekPlayerData[] };
    
    // Convert to player_id -> xFP mapping
    const xfpData: Record<string, number> = {};
    
    for (const player of data.players) {
      xfpData[player.player_id] = player.xfp_weekly || 0;
    }
    
    return xfpData;
  } catch (error) {
    console.error(`Failed to fetch DeepSeek xFP for week ${week}:`, error);
    
    // Return fallback xFP estimates
    return getFallbackXFP();
  }
}

/**
 * Fetch usage scores from DeepSeek (role-based projections)
 * @param season NFL season
 * @param week NFL week
 * @returns Record of player_id -> usage score (0-100)
 */
export async function fetchUsageScores(season: number, week: number): Promise<Record<string, number>> {
  try {
    const response = await fetch(`/api/rankings/deepseek/v3.2/usage?season=${season}&week=${week}`);
    
    if (!response.ok) {
      throw new Error(`DeepSeek usage API failed: ${response.status}`);
    }
    
    const data = await response.json() as { players: DeepSeekPlayerData[] };
    
    const usageScores: Record<string, number> = {};
    
    for (const player of data.players) {
      usageScores[player.player_id] = player.usage_score || 0;
    }
    
    return usageScores;
  } catch (error) {
    console.error(`Failed to fetch DeepSeek usage scores for week ${week}:`, error);
    return {};
  }
}

/**
 * Fetch talent scores from DeepSeek Compass North quadrant
 * @param season NFL season
 * @param week NFL week
 * @returns Record of player_id -> talent score (0-100)
 */
export async function fetchTalentScores(season: number, week: number): Promise<Record<string, number>> {
  try {
    const response = await fetch(`/api/rankings/deepseek/v3.2/talent?season=${season}&week=${week}`);
    
    if (!response.ok) {
      throw new Error(`DeepSeek talent API failed: ${response.status}`);
    }
    
    const data = await response.json() as { players: DeepSeekPlayerData[] };
    
    const talentScores: Record<string, number> = {};
    
    for (const player of data.players) {
      talentScores[player.player_id] = player.quadrant_scores?.north || 0;
    }
    
    return talentScores;
  } catch (error) {
    console.error(`Failed to fetch DeepSeek talent scores for week ${week}:`, error);
    return {};
  }
}

/**
 * Fallback xFP estimates for when DeepSeek service is unavailable
 * Based on positional baselines and tier estimates
 */
function getFallbackXFP(): Record<string, number> {
  return {
    // Elite QBs
    'josh-allen': 24.5,
    'lamar-jackson': 26.2,
    'jalen-hurts': 23.8,
    'joe-burrow': 22.1,
    
    // Rushing upside QBs (our focus)
    'drake-maye': 18.4,      // Development QB with rushing upside
    'jj-mccarthy': 16.2,     // Rookie with mobility
    'anthony-richardson': 19.8,
    'caleb-williams': 17.6,
    
    // Elite RBs
    'christian-mccaffrey': 21.8,
    'saquon-barkley': 19.5,
    'austin-ekeler': 18.2,
    
    // Elite WRs
    'cooper-kupp': 18.7,
    'tyreek-hill': 19.2,
    'davante-adams': 17.9,
    'justin-jefferson': 19.8,
    
    // Elite TEs
    'travis-kelce': 16.5,
    'mark-andrews': 14.8,
    'george-kittle': 15.2
  };
}

/**
 * Fetch individual player's detailed DeepSeek analysis
 * @param player_id Player identifier
 * @param season NFL season
 * @param week NFL week
 * @returns Detailed player analysis
 */
export async function fetchPlayerDeepSeekAnalysis(
  player_id: string, 
  season: number, 
  week: number
): Promise<DeepSeekPlayerData | null> {
  try {
    const response = await fetch(`/api/rankings/deepseek/v3.2/debug/${encodeURIComponent(player_id)}`);
    
    if (!response.ok) {
      return null;
    }
    
    return await response.json() as DeepSeekPlayerData;
  } catch (error) {
    console.error(`Failed to fetch DeepSeek analysis for ${player_id}:`, error);
    return null;
  }
}