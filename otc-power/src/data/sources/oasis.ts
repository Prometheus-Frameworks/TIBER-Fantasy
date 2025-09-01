/**
 * OASIS Data Source
 * 
 * Phase B: Ingestion Layers - Pull team environment and context data
 * Interfaces with OASIS (Offensive Architecture Scoring & Insight System)
 */

interface OASISEnvironmentResponse {
  teams: Array<{
    team: string;
    environment_score: number;
    pace: number;
    proe: number;              // Pass rate over expected
    ol_grade: number;          // Offensive line grade
    qb_stability: number;      // QB situation stability
    red_zone_efficiency: number;
    scoring_environment: number;
  }>;
}

/**
 * Fetch team environment index from OASIS service
 * @param season NFL season  
 * @param week NFL week
 * @returns Record of team -> environment score (0-100)
 */
export async function fetchTeamEnvIndex(season: number, week: number): Promise<Record<string, number>> {
  try {
    // Use existing OASIS R server integration
    const response = await fetch(`/api/oasis/environment?season=${season}&week=${week}`);
    
    if (!response.ok) {
      console.warn(`OASIS service unavailable (${response.status}), using baseline environment data`);
      return getBaselineEnvironmentScores();
    }
    
    const data = await response.json() as OASISEnvironmentResponse;
    
    // Convert to team -> environment score mapping
    const envScores: Record<string, number> = {};
    
    for (const teamData of data.teams) {
      envScores[teamData.team] = Math.max(0, Math.min(100, teamData.environment_score));
    }
    
    return envScores;
  } catch (error) {
    console.error(`Failed to fetch OASIS environment data for week ${week}:`, error);
    return getBaselineEnvironmentScores();
  }
}

/**
 * Fetch team pace specifically for usage calculations
 * @param season NFL season
 * @param week NFL week
 * @returns Record of team -> plays per game
 */
export async function fetchTeamPace(season: number, week: number): Promise<Record<string, number>> {
  try {
    const response = await fetch(`/api/oasis/pace?season=${season}&week=${week}`);
    
    if (!response.ok) {
      return getBaselinePaceData();
    }
    
    const data = await response.json() as Array<{team: string, pace: number}>;
    
    const paceData: Record<string, number> = {};
    for (const item of data) {
      paceData[item.team] = item.pace;
    }
    
    return paceData;
  } catch (error) {
    console.error(`Failed to fetch pace data for week ${week}:`, error);
    return getBaselinePaceData();
  }
}

/**
 * Fetch pass rate over expected (PROE) data
 * @param season NFL season
 * @param week NFL week
 * @returns Record of team -> PROE value
 */
export async function fetchTeamPROE(season: number, week: number): Promise<Record<string, number>> {
  try {
    const response = await fetch(`/api/oasis/proe?season=${season}&week=${week}`);
    
    if (!response.ok) {
      return getBaselinePROEData();
    }
    
    const data = await response.json() as Array<{team: string, proe: number}>;
    
    const proeData: Record<string, number> = {};
    for (const item of data) {
      proeData[item.team] = item.proe;
    }
    
    return proeData;
  } catch (error) {
    console.error(`Failed to fetch PROE data for week ${week}:`, error);
    return getBaselinePROEData();
  }
}

/**
 * Baseline environment scores for when OASIS is unavailable
 * Based on offensive line grades, pace, and QB stability
 */
function getBaselineEnvironmentScores(): Record<string, number> {
  return {
    // Tier 1: Elite offensive environments (90-100)
    'BUF': 95,   // Josh Allen + elite supporting cast
    'KC': 94,    // Mahomes + Reid system + weapons  
    'SF': 93,    // Shanahan system + elite OL + weapons
    'MIA': 92,   // High pace + Tua + weapons
    'DAL': 91,   // Good OL + weapons + Dak stability
    'BAL': 90,   // Lamar + running game + pace
    
    // Tier 2: Good environments (80-89)
    'PHI': 88,   // Hurts + weapons + running game
    'DET': 87,   // Good OL + pace + ARSB/Williams
    'CIN': 86,   // Burrow + Chase/Higgins
    'LAC': 85,   // Herbert + weapons
    'MIN': 84,   // Jefferson + good OL
    'HOU': 83,   // C.J. Stroud + weapons development
    'TB': 82,    // Good weapons + decent OL
    'ATL': 81,   // Cousins + Pitts/London
    'LAR': 80,   // McVay system + Stafford
    
    // Tier 3: Average environments (70-79)
    'GB': 79,    // Love + LaFleur + weapons
    'SEA': 78,   // Geno + DK/Lockett
    'IND': 77,   // Richardson + good OL + weapons
    'JAX': 76,   // Lawrence + weapons
    'NO': 75,   // Carr + decent weapons + coaching
    'ARI': 74,   // Murray + Harrison Jr + pace
    'NYJ': 73,   // Rodgers + weapons + defense support
    'PIT': 72,   // QB competition + good defense support
    'CLE': 71,   // Watson questions + good OL
    'WAS': 70,   // Daniels rookie + decent weapons
    
    // Tier 4: Below average environments (60-69)
    'CHI': 68,   // Caleb Williams + weapons but developing OL
    'DEN': 67,   // QB uncertainty + average support
    'TEN': 66,   // Levis development + average weapons
    'LV': 65,    // QB uncertainty + average support
    'NE': 64,    // Drake Maye + rebuilding OL/weapons
    'CAR': 63,   // Young development + limited weapons
    'NYG': 62,   // Poor OL + QB questions
    
    // Tier 5: Challenging environments (50-59)
    // (No teams currently in this tier - all NFL teams have some positives)
  };
}

/**
 * Baseline pace data (plays per game)
 */
function getBaselinePaceData(): Record<string, number> {
  return {
    'MIA': 72.5,   // Highest pace
    'BUF': 69.8,
    'NO': 68.9,
    'PHI': 68.2,
    'BAL': 67.1,
    'KC': 66.8,
    'DAL': 66.5,
    'DET': 66.1,
    'LAC': 65.8,
    'CIN': 65.5,
    'SF': 65.2,
    'MIN': 64.9,
    'HOU': 64.6,
    'ATL': 64.3,
    'TB': 64.0,
    'CHI': 63.7,
    'NE': 63.2,
    'WAS': 63.0,
    'LAR': 62.8,
    'GB': 62.5,
    'IND': 62.2,
    'JAX': 62.0,
    'SEA': 61.8,
    'ARI': 61.5,
    'NYJ': 61.2,
    'DEN': 61.0,
    'CLE': 60.8,
    'PIT': 60.5,
    'LV': 60.2,
    'TEN': 59.9,
    'CAR': 59.5,
    'NYG': 59.2    // Lowest pace
  };
}

/**
 * Baseline PROE data (pass rate over expected)
 */
function getBaselinePROEData(): Record<string, number> {
  return {
    'BUF': 0.08,   // More pass-heavy than expected
    'LAC': 0.06,
    'KC': 0.05,
    'MIA': 0.04,
    'CIN': 0.03,
    'DAL': 0.02,
    'TB': 0.01,
    'SF': 0.00,    // Balanced as expected
    'DET': -0.01,  // Slightly more run-heavy
    'BAL': -0.03,  // More run-heavy (Lamar factor)
    'PHI': -0.02,
    'MIN': 0.01,
    'ATL': 0.02,
    'LAR': 0.01,
    'GB': 0.00,
    'HOU': 0.03,
    'IND': -0.01,
    'JAX': 0.00,
    'SEA': 0.01,
    'NO': 0.02,
    'ARI': 0.01,
    'NYJ': -0.01,
    'CHI': 0.00,   // Neutral for rookie Caleb
    'NE': -0.02,   // More conservative with Drake Maye
    'WAS': -0.01,
    'DEN': 0.00,
    'CLE': -0.01,
    'PIT': -0.03,  // More run-heavy
    'LV': 0.01,
    'TEN': -0.02,
    'CAR': -0.02,
    'NYG': 0.00
  };
}